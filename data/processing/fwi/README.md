# FWI worker (Фаза 1)

Консумира `weather.ingest` → записва FWI точки в TimescaleDB (`fire_weather_index`).
Контракт: [`shared/schemas/message-contracts.md`](../../../shared/schemas/message-contracts.md).

## Setup (еднократно) — Python 3.11

> Както при другите workers: системният python3 (3.14) не се ползва, за да е един и същ
> навсякъде. Смесен venv (3.14 + 3.11 в една папка) чупи import-ите.

```bash
cd data/processing/fwi
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Изисква локалния стек да е вдигнат (`docker-compose.dev.yml`). Връзките се четат от `.env` в корена.

## Пускане

```bash
# терминал 1 — worker-ът слуша
python worker.py

# терминал 2 — бутни примерно съобщение
python mock_publisher.py            # валидно → пише в базата
python mock_publisher.py --broken   # счупено → отива в weather.dlq
```

Проверка на записаното:
```bash
docker exec wiser-timescale psql -U wiser -d wiser_timeseries \
  -c "SELECT time, lat, lon, fwi, class FROM fire_weather_index ORDER BY time DESC LIMIT 5;"
```

> Реалният EFFIS downloader на бекенда вече публикува в `weather.ingest` — mock publisher-ът
> остава само за ръчна проверка (вкл. `--broken` за DLQ пътя), не е нужен в нормална работа.

## Тестове

```bash
pip install -r ../requirements-dev.txt
python -m pytest
```

Без база и без RabbitMQ — `process_message` получава връзката отвън, така че тестът подава
фалшив cursor. Покрива мапването по договора, идемпотентността (`ON CONFLICT`) и това, че
счупено съобщение хвърля изключение, за да стигне до `weather.dlq`.

## Дедуп

EFFIS downloader-ът публикува цялата решетка за деня наново при всеки старт на контейнера.
Уникалният индекс от миграция `V3__fwi_dedup.sql` — `(time, lat, lon, source)` — плюс
`ON CONFLICT DO NOTHING` правят повторното публикуване безобидно. В лога се вижда като
„Записах 0 от 2772 FWI точки (2772 вече ги имаше)".
