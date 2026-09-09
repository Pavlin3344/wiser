# Azure log bridge — какво прави и как се пуска

Пренася в ELK онези логове от Azure, които никой процес не праща сам.

## Защо трябва

На Hetzner filebeat чете docker json файловете на хоста и всичко влиза в Kibana. В
Container Apps такъв хост няма — затова приложенията, които пишем ние, изпращат сами
(`logback-spring.xml` в Java, `data/processing/log_shipper.py` в Python).

Оставаха три дупки, и трите невидими, докато не се преброят документите в индекса:

| Кой | Колко реда | Колко стигаха до Kibana |
|---|---|---|
| `frontend` (nginx) | ~22 000 / седмица | 0 |
| `minio`, `rabbitmq` | старт + грешки | 0 |
| системни събития на платформата | ~1 000 / ден | 0 |

Чуждите образи не могат да се научат да пращат по общия път: nginx умее само syslog,
minio само webhook, rabbitmq нищо. Това са три различни механизма, три нови порта и три
NSG правила. Системните събития пък изобщо нямат контейнер, от който да излязат — а
точно те казват, че job-ът е стартирал, че image pull-ът е гръмнал или че KEDA не вижда
съобщения в опашката. Без тях `worker-dnbr` няма как да обясни защо мълчи от седмици:
той просто никога не се вдига.

Log Analytics вече събира и трите (console appender-ът и stdout-ът отиват там по
подразбиране), така че тук няма нищо за инсталиране в Azure — само за прочитане.

## Защо стои на Hetzner, а не в Azure

Наблюдателният стек е на тази машина и събирачът стои при събраното. Практически:
пише направо в `logstash:5045` по docker мрежата, без tailnet, без NSG правило, без
още един Container App, който да се плаща и наблюдава.

## Разделението на труда

```
        Azure                                          Hetzner
  ┌──────────────────────┐
  │ api, alerts,         │  ──── TCP 5045 през tailnet ────►  ┌──────────┐
  │ ingest-*, worker-*   │      (сами, структуриран JSON)     │ Logstash │
  └──────────────────────┘                                    │   5045   │
  ┌──────────────────────┐                                    └────┬─────┘
  │ frontend, minio,     │  ──► Log Analytics ──► този мост ──►     │
  │ rabbitmq, платформа  │                                    ┌─────▼─────┐
  └──────────────────────┘                                    │ Elastic-  │
                                                              │  search   │
                                                              └───────────┘
```

Списъкът кое минава оттук е `BRIDGE_CONTAINERS` и **не бива** да включва сервиз, който
праща сам — иначе всеки негов ред влиза в индекса два пъти, по два различни пътя и с
различна забава.

## Еднократна подготовка на самоличността

Самоличността е отделна от `wiser-github-deploy`: той влиза през OIDC без парола, а тук
трябва парола, защото машината не е в Azure. Правата са само за четене на един workspace.

Пуска се **от машината на Павлин, в PowerShell** — не на сървъра. `az` тук е `az.cmd`,
така че присвояването в променлива работи, но обратната наклонена черта за продължение
на ред не работи: в PowerShell тя не значи нищо и всеки следващ ред тръгва като нова
команда с `--`, което дава `Missing expression after unary operator '--'`.

```powershell
$appId = az ad app create --display-name wiser-log-reader --sign-in-audience AzureADMyOrg --query appId -o tsv
az ad sp create --id $appId

# Паролата се показва само сега.
$secret = az ad app credential reset --id $appId --years 2 --query password -o tsv

# Права: само четене, само върху този workspace.
$scope = az monitor log-analytics workspace show -g rg-wiser-prod -n log-wiser-prod --query id -o tsv
az role assignment create --assignee $appId --role "Log Analytics Reader" --scope $scope

# Четирите реда за .env, готови за копиране.
"AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
"AZURE_LOG_READER_CLIENT_ID=$appId"
"AZURE_LOG_READER_CLIENT_SECRET=$secret"
"AZURE_LOG_ANALYTICS_WORKSPACE_ID=$(az monitor log-analytics workspace show -g rg-wiser-prod -n log-wiser-prod --query customerId -o tsv)"
```

Ако вече е пускано веднъж, `az ad app list --display-name wiser-log-reader` показва дали
приложението съществува — второ `create` прави дубликат, не преизползва старото.

Стойностите отиват в `/home/pavlin/wiser-repo/.env` на сървъра (`.env` не влиза в git),
след което мостът трябва да се вдигне наново, защото променливите се четат при старт:

```bash
docker compose -f infra/docker/docker-compose.yml up -d --force-recreate azure-log-bridge
```

⚠ **Паролата изтича след две години.** Когато изтече, симптомът е `Log Analytics върна
401` в логовете на моста, а в Kibana спират само `frontend`, `minio`, `rabbitmq` и
системните събития — останалите сервизи продължават да пишат, тоест графиките изглеждат
живи. Проверява се с `docker logs wiser-azure-log-bridge`.

## Проверка след деплой

```bash
docker logs wiser-azure-log-bridge --tail 20   # "console: N реда до ..."
docker inspect --format '{{.State.Health.Status}}' wiser-azure-log-bridge
```

Healthcheck-ът гледа `/state/heartbeat`, а той се пише **само след успешен цикъл** срещу
Log Analytics — не при старт на процеса. Вдигнат контейнер не значи работещ пренос;
това е урокът, който `data-metrics` вече е научил, приложен тук.

В Kibana: `origin: azure AND via: log-analytics`.

## Дубликати

Log Analytics показва реда със забава, така че мостът чете със застъпване и нарочно
подава едно и също нещо повторно. Дублирането се реже в Logstash — `fingerprint` прави
детерминиран `document_id` от `@timestamp + service + replica + message`, тоест
повторното подаване презаписва същия документ. Същото правило като при базите (виж
`CLAUDE.md`), само че ролята на уникалния индекс я играе `_id`-то.

Единственият случай, в който това губи ред, е два **напълно еднакви** реда от една
реплика в една и съща милисекунда. За nginx това значи два идентични request-а с
идентичен URL, статус и User-Agent — предпочетената грешка спрямо половин час дубликати
при всеки рестарт.

## Настройки

| Променлива | По подразбиране | За какво е |
|---|---|---|
| `BRIDGE_CONTAINERS` | `frontend,minio,rabbitmq,roads-import` | Кои контейнера се четат. Сервиз, който праща сам, НЕ влиза тук. |
| `BRIDGE_POLL_SECONDS` | `60` | През колко се пита. |
| `BRIDGE_INGEST_LAG_SECONDS` | `180` | Колко назад от „сега" спира заявката. По-малко значи по-пресни логове, но и изгубени закъснели редове. |
| `BRIDGE_COLD_START_MINUTES` | `30` | Колко назад гледа при първо пускане, когато няма маркер. |
| `BRIDGE_PAGE_LIMIT` | `5000` | Таван на един цикъл; при изоставане наваксва на порции. |
