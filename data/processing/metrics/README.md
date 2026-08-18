# Data metrics exporter (Фаза 1)

Малък Prometheus exporter за **свежестта на данните** от трите worker-а. Java сервизите
Prometheus ги вижда през actuator; Python worker-ите нямаха нищо.

Не мери самите процеси, а резултата от тях. Причината е конкретна: `zones` стоя празна
седмици, докато всеки контейнер беше вдигнат и зелен — „процесът работи" не значи
„данните идват".

Контейнер: `data-metrics` в `infra/docker/docker-compose.yml`. Само чете (двете бази +
списък в MinIO), не пише никъде.

## Метрики

| метрика | значение |
|---|---|
| `wiser_data_zones_last_computed_timestamp_seconds` | кога risk zones job-ът е писал за последно |
| `wiser_data_zones_rows_today` | брой зони за днешната дата |
| `wiser_data_fwi_last_observation_timestamp_seconds` | най-новото FWI наблюдение |
| `wiser_data_fwi_points_latest_day` | брой FWI точки за последния ден (~2772 при пълна решетка) |
| `wiser_data_ndvi_last_product_timestamp_seconds` | най-новият NDVI растер в MinIO |
| `wiser_data_ndvi_product_count` | брой NDVI растери |
| `wiser_data_fuel_map_present` | 1 ако fuel картата е в MinIO |
| `wiser_data_dnbr_last_analysis_timestamp_seconds` | последният анализ на изгаряне (Фаза 3) |
| `wiser_data_dnbr_analyses_total` | брой редове в `burn_severity` |
| `wiser_data_scrape_success{source}` | отговори ли този източник на текущия scrape |

Времената са Unix timestamp-и, за да се питат като възраст:

```promql
time() - wiser_data_zones_last_computed_timestamp_seconds > 86400
```

Две решения, които изглеждат странно, но са нарочни:

- **Липсваща стойност не се публикува като нула.** Празна таблица би дала 1970-та, което
  прилича на истинска стара стойност. Вместо това метриката липсва и се лови с `absent()`.
- **Провалена проба не сваля целия scrape.** Останалите метрики излизат, а
  `wiser_data_scrape_success` за този източник става 0 — иначе паднала база изглежда
  като „всичко е наред, просто няма новини".

## Аларми

`infra/docker/prometheus/rules/data-processing.yml` — стари зони, празна таблица `zones`,
спрял FWI, смалена решетка, стар NDVI, липсваща fuel карта, съобщения в DLQ и натрупване
във входните опашки.

За dNBR нарочно **няма** аларма за давност: анализът е събитиен и „отдавна няма нов" значи
„отдавна няма пожар" — добра новина, не повод за будене. Метриките са за справка и графики.

## Пускане локално (Python 3.11)

```bash
cd data/processing/metrics
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python exporter.py          # → http://localhost:9105/metrics
```

Изисква локалния стек (`docker-compose.dev.yml`); връзките се четат от `.env` в корена.

## Тестове

```bash
pip install -r ../requirements-dev.txt
python -m pytest
```

Без база и без MinIO — пробите се подават отвън и в теста се заменят с фалшиви.
