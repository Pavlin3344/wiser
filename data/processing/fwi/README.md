# FWI worker (Фаза 1)

Консумира `weather.ingest` → записва FWI точки в TimescaleDB (`fire_weather_index`).
Контракт: [`shared/schemas/message-contracts.md`](../../../shared/schemas/message-contracts.md).

## Setup (еднократно)

```bash
cd data/processing/fwi
python3 -m venv .venv
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

> Mock publisher-ът замества още-неготовия EFFIS downloader на бекенда. Като той стане готов,
> worker-ът не се променя — само спираш да пускаш mock-а.
