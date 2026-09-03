"""Изпраща логовете на worker-а към Logstash по TCP, ако е конфигуриран.

На Hetzner логовете стигат до ELK, защото filebeat чете docker json файловете на хоста.
На Azure Container Apps такъв хост няма и този път не съществува - затова процесът праща
сам. Форматът е по един JSON обект на ред, точно каквото чака `json_lines` кодекът на
входа в `infra/docker/logstash/pipeline/wiser.conf`.

Без `LOGSTASH_HOST` модулът не прави нищо, тоест Compose деплойментът остава непроменен.

Пише се на ръка вместо с библиотека (`python-logstash-async`) по две причини: това е
трийсетина реда, а всеки worker има собствен `requirements.txt` и собствен `.venv`, така
че всяка нова зависимост се плаща пет пъти.
"""

import atexit
import json
import logging
import logging.handlers
import os
import queue
import socket
import threading
import time

# Достатъчно за пиковете на един worker, но с таван: ако Logstash е недостъпен, редовете
# се изхвърлят, а не се трупат, докато процесът не остане без памет. Логването никога не
# бива да е причината да падне това, което се опитва да опише.
_QUEUE_SIZE = 2000

# Един tile/сцена може да произведе дълъг traceback; над това реже, вместо да залее
# Elasticsearch с един документ от мегабайти.
_MAX_MESSAGE = 32_000


class _KeepRecordQueueHandler(logging.handlers.QueueHandler):
    """QueueHandler, който подава записа непокътнат.

    Стандартният форматира съобщението предварително и зачиства `exc_info` - разумно,
    когато опашката пресича процеси и записът трябва да се pickle-не. Тук опашката е
    нишкова, така че цената е чиста загуба: traceback-ът се слепва в `message` и полето
    `stack_trace` в индекса остава празно завинаги.
    """

    def prepare(self, record: logging.LogRecord) -> logging.LogRecord:
        return record


class _LogstashTcpHandler(logging.Handler):
    """Записва JSON редове в сокет, като преоткрива връзката при нужда."""

    def __init__(self, host: str, port: int, service: str) -> None:
        super().__init__()
        self._addr = (host, port)
        self._service = service
        self._sock: socket.socket | None = None
        self._lock = threading.Lock()

    def _connect(self) -> socket.socket | None:
        try:
            sock = socket.create_connection(self._addr, timeout=5)
            sock.settimeout(5)
            return sock
        except OSError:
            return None

    def emit(self, record: logging.LogRecord) -> None:
        try:
            payload = self._format(record)
        except Exception:  # noqa: BLE001 - форматирането не бива да убива процеса
            return

        with self._lock:
            for _ in range(2):  # един ретрай: препубликуване след прекъсната връзка
                if self._sock is None:
                    self._sock = self._connect()
                if self._sock is None:
                    return  # Logstash не отговаря - изхвърляме реда, не блокираме
                try:
                    self._sock.sendall(payload)
                    return
                except OSError:
                    try:
                        self._sock.close()
                    finally:
                        self._sock = None

    def _format(self, record: logging.LogRecord) -> bytes:
        message = record.getMessage()
        if len(message) > _MAX_MESSAGE:
            message = message[:_MAX_MESSAGE] + " ...[truncated]"

        doc = {
            # Logstash чете това поле като време на събитието, а то определя и в кой
            # дневен индекс попада редът.
            "@timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created))
            + f".{int(record.msecs):03d}Z",
            "service": self._service,
            "log_level": record.levelname,
            "logger": record.name,
            "thread": record.threadName,
            "message": message,
        }
        if record.exc_info:
            doc["stack_trace"] = logging.Formatter().formatException(record.exc_info)

        return (json.dumps(doc, ensure_ascii=False) + "\n").encode("utf-8")

    def close(self) -> None:
        with self._lock:
            if self._sock is not None:
                try:
                    self._sock.close()
                finally:
                    self._sock = None
        super().close()


def install(service: str) -> bool:
    """Закача изпращача към root logger-а. Връща дали е бил конфигуриран.

    Извиква се СЛЕД `logging.basicConfig`, за да остане stdout недокоснат - на Hetzner
    той е това, което filebeat чете, а в Azure - това, което влиза в Log Analytics.
    """
    host = os.getenv("LOGSTASH_HOST", "").strip()
    if not host:
        return False

    port = int(os.getenv("LOGSTASH_PORT", "5045"))
    handler = _LogstashTcpHandler(host, port, service)

    # QueueHandler праща изпращането в отделна нишка: сокет към машина в друг облак не
    # бива да спира worker, който точно в момента държи Sentinel-2 растер в паметта.
    q: queue.Queue = queue.Queue(maxsize=_QUEUE_SIZE)
    listener = logging.handlers.QueueListener(q, handler, respect_handler_level=True)
    listener.start()

    root = logging.getLogger()
    root.addHandler(_KeepRecordQueueHandler(q))

    # Job-овете (risk-zones, fuel-loader) живеят по трийсетина секунди и излизат. Без
    # това последните редове - включително причината за евентуален провал - си остават
    # в опашката и не тръгват никъде.
    atexit.register(listener.stop)
    return True
