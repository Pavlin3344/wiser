"""Пренася логовете на Azure Container Apps от Log Analytics в Logstash.

ЗАЩО изобщо съществува
----------------------
На Hetzner filebeat чете docker json файловете на хоста и всичко се озовава в ELK.
В Container Apps такъв хост няма. Приложенията, които пишем ние (Java през
logback-spring.xml, Python през data/processing/log_shipper.py), пращат сами по TCP
през tailnet-а. Но три контейнера не са наши и няма как да ги научим да го правят:

  * frontend  - nginx, ~22 000 реда седмично, нито един от които стигаше до Kibana;
  * minio     - обектното хранилище;
  * rabbitmq  - брокерът.

Освен това никой не носеше *системните* събития на платформата - че job е стартирал,
че image pull-ът е гръмнал, че KEDA не вижда съобщения в опашката. Точно те обясняват
защо worker-dnbr не е писал нищо от седмици, а от контейнерите му не може да се научи,
защото те никога не се вдигат.

Log Analytics вече ги събира и двете (console appender-ът в Java и stdout-ът навсякъде
другаде отиват там по подразбиране), така че тук няма нищо за инсталиране в Azure -
само за прочитане. Мостът се върти на Hetzner, до самия Logstash: логовете идват от
Azure, но наблюдателният стек е тук, и събирачът стои при събраното.

Не сложихме втори изпращач в самите контейнери, защото nginx умее само syslog, minio
само webhook, а rabbitmq нищо - три различни механизма, три нови порта и три NSG
правила, срещу един процес, който вече има какво да чете.

ИДЕМПОТЕНТНОСТ
--------------
Същото правило като при базите (виж CLAUDE.md): всеки писач трябва да може да бъде
пуснат втори път. Ingestion lag-ът на Log Analytics означава, че ред със стар
TimeGenerated може да стане видим чак минута по-късно, затова четем със `>=` от
маркера и нарочно се застъпваме. Дублиращите редове ги реже Logstash - `fingerprint`
превръща (@timestamp, service, replica, message) в document_id, така че повторното
подаване презаписва същия документ вместо да създава нов.

СПИРАНЕ БЕЗ ГРЕШКА
------------------
Без AZURE_CLIENT_ID/SECRET процесът излиза веднага и казва защо. Compose стекът се
вдига и без него - мостът е допълнение към наблюдателния стек, не негово условие.
"""

import json
import logging
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

LOG = logging.getLogger("azure-log-bridge")

AUTH_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
QUERY_URL = "https://api.loganalytics.io/v1/workspaces/{workspace}/query"
SCOPE = "https://api.loganalytics.io/.default"

# Контейнерите, които не могат да пращат сами. Всичко извън този списък вече се
# изпраща директно от процеса и НЕ бива да минава оттук - иначе всеки ред от api и
# ingestion щеше да влиза в индекса два пъти, по различен път и с различна забава.
# roads-import е в списъка по същата причина като останалите: shell скрипт около
# osm2pgrouting, който няма как да пише в Logstash. Върви веднъж на няколко месеца, но
# точно тогава единственото, което казва защо се е провалил, е неговият stdout.
BRIDGED_CONTAINERS = [
    c.strip()
    for c in os.getenv("BRIDGE_CONTAINERS", "frontend,minio,rabbitmq,roads-import").split(",")
    if c.strip()
]

# Колко назад да гледа при първо пускане (няма запазен маркер). Достатъчно, за да има
# какво да се види веднага след деплой, без да залива индекса с история.
COLD_START_MINUTES = int(os.getenv("BRIDGE_COLD_START_MINUTES", "30"))

# Log Analytics не показва реда в мига, в който е записан. Ако питаме до "сега" и
# преместим маркера дотам, всеки ред, закъснял повече от заявката, се губи безшумно.
# Затова питаме само до now - LAG и оставяме закъснелите да ни настигнат.
INGEST_LAG_SECONDS = int(os.getenv("BRIDGE_INGEST_LAG_SECONDS", "180"))

POLL_SECONDS = int(os.getenv("BRIDGE_POLL_SECONDS", "60"))

# Таван на един цикъл. При изоставане (спрян мост, задръстен Logstash) маркерът се
# премества до последния получен ред и следващият цикъл продължава оттам - наваксва
# на порции вместо да дърпа един отговор от стотици мегабайти.
PAGE_LIMIT = int(os.getenv("BRIDGE_PAGE_LIMIT", "5000"))

STATE_PATH = os.getenv("BRIDGE_STATE_PATH", "/state/watermark.json")
HEARTBEAT_PATH = os.getenv("BRIDGE_HEARTBEAT_PATH", "/state/heartbeat")

# Отрязват се от имената на ресурсите, за да съвпада `service` с това, което самите
# приложения пращат: ca-wiser-prod-frontend и caj-wiser-prod-worker-dnbr стават
# frontend и worker-dnbr. Иначе един и същ сервиз щеше да се води под две имена
# според това по кой път е дошъл редът.
RESOURCE_PREFIXES = (
    "ca-wiser-prod-", "caj-wiser-prod-",
    "ca-wiser-dev-", "caj-wiser-dev-",
)

# ARM реже имената на job-овете до 32 знака, затова terraform ги съкращава още при
# създаването (substr() в modules/container-apps/main.tf). Тоест лявата страна не е
# показване, а истинското име на ресурса в Azure - но WISER_LOG_SERVICE носи целия ключ,
# така че двата пътя се разминават точно за двата ключа, които не се побират. Без това
# ingest-air-quality се води под две имена според това кой е писал реда.
TRUNCATED_ALIASES = {
    "ingest-air-qualit": "ingest-air-quality",
    "dnbr-scene-fetche": "dnbr-scene-fetcher",
}

# Пълното име на едно изпълнение: caj-wiser-prod-ingest-firms-29814540. Групата хваща
# job-а без опашката с номера.
_EXECUTION_NAME = re.compile(r"\b(caj-[a-z0-9-]+)-\d{4,}\b")


def strip_prefix(name: str) -> str:
    for prefix in RESOURCE_PREFIXES:
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


def canonical_service(resource_name: str) -> str:
    name = strip_prefix(resource_name)
    return TRUNCATED_ALIASES.get(name, name)


class TokenCache:
    """Client credentials токен, преиздаван малко преди да изтече."""

    def __init__(self, tenant: str, client_id: str, client_secret: str) -> None:
        self._url = AUTH_URL.format(tenant=tenant)
        self._body = urllib.parse.urlencode({
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": SCOPE,
        }).encode()
        self._token = ""
        self._expires_at = 0.0

    def get(self) -> str:
        # Шейсет секунди преди изтичане: заявка, тръгнала с токен на ръба, се връща с
        # 401 и целият цикъл се губи за нищо.
        if self._token and time.time() < self._expires_at - 60:
            return self._token

        req = urllib.request.Request(
            self._url,
            data=self._body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.load(resp)

        self._token = payload["access_token"]
        self._expires_at = time.time() + int(payload.get("expires_in", 3600))
        return self._token


class LogAnalytics:
    def __init__(self, workspace: str, tokens: TokenCache) -> None:
        self._url = QUERY_URL.format(workspace=workspace)
        self._tokens = tokens

    def query(self, kql: str) -> list[dict]:
        """Изпълнява KQL и връща редовете като речници.

        Отговорът е колонен (`columns` + `rows`), не списък от обекти - зашиването на
        индекси по позиция е точно видът дребна грешка, която мълчи, докато някой не
        добави колона в проекцията.
        """
        req = urllib.request.Request(
            self._url,
            data=json.dumps({"query": kql}).encode(),
            headers={
                "Authorization": f"Bearer {self._tokens.get()}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = json.load(resp)

        tables = payload.get("tables") or []
        if not tables:
            return []
        names = [c["name"] for c in tables[0]["columns"]]
        return [dict(zip(names, row)) for row in tables[0]["rows"]]


class LogstashSink:
    """JSON редове по TCP - същият вход (5045, `json_lines`), който ползват приложенията."""

    def __init__(self, host: str, port: int) -> None:
        self._addr = (host, port)
        self._sock: socket.socket | None = None

    def _connect(self) -> None:
        if self._sock is None:
            self._sock = socket.create_connection(self._addr, timeout=15)
            self._sock.settimeout(15)

    def send(self, docs: list[dict]) -> None:
        if not docs:
            return
        payload = b"".join(
            (json.dumps(d, ensure_ascii=False) + "\n").encode("utf-8") for d in docs
        )
        for attempt in (1, 2):  # един ретрай: Logstash рестартира при смяна на pipeline
            try:
                self._connect()
                self._sock.sendall(payload)
                return
            except OSError:
                self.close()
                if attempt == 2:
                    raise

    def close(self) -> None:
        if self._sock is not None:
            try:
                self._sock.close()
            finally:
                self._sock = None


def load_state() -> dict:
    try:
        with open(STATE_PATH, encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, ValueError):
        return {}


def save_state(state: dict) -> None:
    # Пише се във временен файл и се преименува: прекъснат запис насред JSON-а прави
    # маркера нечетим, а нечетим маркер значи ново студено пускане и дубликати.
    tmp = STATE_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(state, fh)
    os.replace(tmp, STATE_PATH)


def utc_iso(ts: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(ts)) + ".000Z"


def console_query(since: str, until: str) -> str:
    containers = ", ".join(f'"{c}"' for c in BRIDGED_CONTAINERS)
    return f"""
ContainerAppConsoleLogs_CL
| where TimeGenerated >= datetime({since}) and TimeGenerated < datetime({until})
| where ContainerName_s in ({containers})
| project TimeGenerated, container=ContainerName_s, app=ContainerAppName_s,
          revision=RevisionName_s, replica=ContainerGroupName_s,
          stream=Stream_s, msg=Log_s
| order by TimeGenerated asc
| take {PAGE_LIMIT}
"""


def system_query(since: str, until: str) -> str:
    return f"""
ContainerAppSystemLogs_CL
| where TimeGenerated >= datetime({since}) and TimeGenerated < datetime({until})
| project TimeGenerated, app=ContainerAppName_s, job=JobName_s, reason=Reason_s,
          source=EventSource_s, level=Level, replica=ReplicaName_s, msg=Log_s
| order by TimeGenerated asc
| take {PAGE_LIMIT}
"""


def console_doc(row: dict) -> dict:
    return {
        "@timestamp": row["TimeGenerated"],
        "service": row.get("container") or canonical_service(row.get("app") or "unknown"),
        "logger": "container-console",
        "message": row.get("msg") or "",
        "stream": row.get("stream") or "",
        "revision": row.get("revision") or "",
        "replica": row.get("replica") or "",
        # Как е дошъл редът. `origin` се слага от входа на Logstash (azure) и не бива
        # да се дублира тук - две стойности за едно поле го превръщат в масив.
        "via": "log-analytics",
    }


def system_doc(row: dict) -> dict:
    # Системните събития нямат контейнер - носят името на app-а или на job-а. Едно от
    # двете винаги е празно.
    resource = row.get("job") or row.get("app") or ""
    message = row.get("msg") or ""

    # При част от събитията на контролера JobName_s идва отрязано - "caj-wiser-prod-ingest"
    # за job, който всъщност е "caj-wiser-prod-ingest-firms". Самото съобщение обаче носи
    # цялото име на изпълнението ("Created job caj-wiser-prod-ingest-firms-29814540"), а
    # по-конкретният източник печели. Иначе ingest-firms и ingest-air-quality се пръсват
    # на пет измислени имена в Kibana според това кое събитие ги е описало.
    match = _EXECUTION_NAME.search(message)
    if match:
        resource = match.group(1)

    level = (row.get("level") or "").upper()
    return {
        "@timestamp": row["TimeGenerated"],
        "service": canonical_service(resource) or "container-apps",
        "logger": "container-apps-system",
        # Без level от нас grok-ът в pipeline-а би търсил дума в текста; тук платформата
        # вече ни казва нивото и няма причина да го гадаем.
        "log_level": level if level in ("INFO", "WARN", "WARNING", "ERROR") else "INFO",
        "message": message,
        "reason": row.get("reason") or "",
        "event_source": row.get("source") or "",
        "replica": row.get("replica") or "",
        "via": "log-analytics",
    }


def drain(la: LogAnalytics, sink: LogstashSink, state: dict, key: str,
          build_query, build_doc, until: str) -> None:
    """Един поток (console или system) от маркера си до `until`."""
    since = state.get(key) or utc_iso(time.time() - COLD_START_MINUTES * 60)
    rows = la.query(build_query(since, until))
    if not rows:
        # Няма редове - маркерът все пак тръгва напред, иначе тих период прави
        # прозореца все по-широк, докато една заявка не удари тавана.
        state[key] = until
        return

    sink.send([build_doc(r) for r in rows])

    if len(rows) >= PAGE_LIMIT:
        # Ударен таван: спираме на последния получен ред, а не на `until`, иначе
        # всичко между него и `until` се прескача безшумно.
        state[key] = rows[-1]["TimeGenerated"]
        LOG.info("%s: %d реда (таван), наваксва от %s", key, len(rows), state[key])
    else:
        state[key] = until
        LOG.info("%s: %d реда до %s", key, len(rows), until)


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    tenant = os.getenv("AZURE_TENANT_ID", "").strip()
    client_id = os.getenv("AZURE_CLIENT_ID", "").strip()
    client_secret = os.getenv("AZURE_CLIENT_SECRET", "").strip()
    workspace = os.getenv("AZURE_LOG_ANALYTICS_WORKSPACE_ID", "").strip()

    missing = [
        name for name, value in (
            ("AZURE_TENANT_ID", tenant),
            ("AZURE_CLIENT_ID", client_id),
            ("AZURE_CLIENT_SECRET", client_secret),
            ("AZURE_LOG_ANALYTICS_WORKSPACE_ID", workspace),
        ) if not value
    ]
    if missing:
        LOG.error("Липсват %s - мостът не тръгва. Виж .env.example.", ", ".join(missing))
        return 1

    la = LogAnalytics(workspace, TokenCache(tenant, client_id, client_secret))
    logstash_host = os.getenv("LOGSTASH_HOST", "logstash")
    logstash_port = int(os.getenv("LOGSTASH_PORT", "5045"))
    sink = LogstashSink(logstash_host, logstash_port)
    state = load_state()
    LOG.info(
        "Пренася %s + системните събития от workspace %s към %s:%d на всеки %ds",
        ",".join(BRIDGED_CONTAINERS), workspace, logstash_host, logstash_port,
        POLL_SECONDS,
    )

    while True:
        started = time.time()
        try:
            until = utc_iso(started - INGEST_LAG_SECONDS)
            drain(la, sink, state, "console", console_query, console_doc, until)
            drain(la, sink, state, "system", system_query, system_doc, until)
            save_state(state)
            # Пулсът се пише само след успешен цикъл. Вдигнат контейнер не значи
            # работещ пренос - това е същият урок, който data-metrics вече научи.
            with open(HEARTBEAT_PATH, "w", encoding="utf-8") as fh:
                fh.write(utc_iso(time.time()))
        except urllib.error.HTTPError as exc:
            LOG.error("Log Analytics върна %s: %s", exc.code, exc.read()[:500])
        except Exception:  # noqa: BLE001 - цикълът не бива да умира от един лош пробег
            LOG.exception("Цикълът се провали, продължаваме от същия маркер")

        time.sleep(max(1.0, POLL_SECONDS - (time.time() - started)))


if __name__ == "__main__":
    sys.exit(main())
