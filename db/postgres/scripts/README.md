# Roads import (OSM → pgRouting)

Пълни таблицата `roads` с реалната пътна мрежа на България и routing топологията
(`source`/`target`/`cost`/`reverse_cost`), която `pgr_dijkstra` изисква.

**Без този импорт евакуационните маршрути не работят.** `GET /api/evacuation/routes`
проверява `SELECT COUNT(*) FROM roads WHERE source IS NOT NULL AND target IS NOT NULL`
и при нула връща `409 routing_topology_missing`, а картата показва „Routing data not
imported". Нищо не пълни `roads` автоматично — OSM importer-ът в `ingestion` пише само
`critical_infrastructure`.

Върши се с `osm2pgrouting`, а не със собствен Java код: това е стандартният инструмент
за превръщане на OSM way-ове в routable мрежа (реже way-овете по кръстовищата и раздава
topology node ID-та). При теста върху Лихтенщайн 5 931 way-а станаха **9 842 сегмента** —
разликата е точно това рязане и точно затова `pgr_createTopology` върху цели way-ове не е
заместител.

## Как се пуска (Azure)

```bash
az containerapp job start -g rg-wiser-prod -n caj-wiser-prod-roads-import
```

Job-ът върви **вътре във VNet-а**, тоест стига частния endpoint на базата директно — без
tailnet, без одобрен маршрут, без нищо между него и Postgres. Свалянето, рязането,
преобразуването и импортът са в един образ (`db/postgres/scripts/Dockerfile`), който CI
качва в ACR като всеки друг.

Проследяване:

```bash
az containerapp job execution list -g rg-wiser-prod -n caj-wiser-prod-roads-import \
  --query "[0].{name:name,status:properties.status,start:properties.startTime}" -o table
```

Логовете влизат в Kibana като `service: roads-import` — контейнерът е shell скрипт и не
може да праща сам, затова минава през `azure-log-bridge`.

Отнема десетина до трийсетина минути. Накрая казва колко сегмента има топология и
**се проваля**, ако са под 1000 — тиха празна таблица значи, че маршрутите пак ще връщат
409, но без нищо в логовете, което да го обясни.

## Какво прави, стъпка по стъпка

1. Сваля `bulgaria-latest.osm.pbf` от Geofabrik (~170 MB).
2. Реже с `osmium tags-filter` до **точно седемнайсетте** `highway` стойности, които
   `mapconfig_for_cars.xml` приема.
3. Преобразува в XML (`osm2pgrouting` не чете `.pbf`).
4. Пуска `osm2pgrouting --clean` в схема `osm_staging`.
5. Прехвърля staging таблиците в `roads` с `import_roads_from_osm.sql`.

### Защо рязането е преди преобразуването, а не при импорта

`osm2pgrouting` зарежда XML-а в паметта. Цялата страна дава няколко GB XML и процесът
бива убит от OOM — това е причината филтърът да съществува изобщо.

Филтърът обаче е стеснен още: не просто `w/highway`, а изброените седемнайсет класа.
Пътеките, коловозите, стълбите и велоалеите са голяма част от `highway` way-овете в
България и **без изключение** биват изхвърлени при импорта, защото car профилът не ги
познава. Единственото, което правеха, беше да раздуят пиковата памет. Резултатът в базата
е идентичен.

### Идемпотентност

Второ пускане дава същия резултат, не двойно повече редове: стъпка 4 е с `--clean`
(пресъздава staging таблиците), а `import_roads_from_osm.sql` прави `TRUNCATE roads`
преди `INSERT`.

## Ръчно пускане (резервен вариант)

Ако job-ът не може да се пусне — например докато образът още не е в ACR — същият контейнер
върви отвсякъде, откъдето базата е достъпна. Това значи през tailnet-а, тоест маршрутът
`10.60.0.0/21` трябва да е одобрен (виж `docs/team/connection-guide.md`):

```bash
docker build -t wiser-roads-import db/postgres/scripts

docker run --rm \
  -e POSTGRES_HOST=10.60.2.6 \
  -e POSTGRES_USER=wiser \
  -e POSTGRES_DB=wiser \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  wiser-roads-import
```

Срещу локален Compose Postgres (без TLS) се добавя `-e PGSSLMODE=disable` и
`--network docker_default`.

> ⚠️ Тази страница описваше по-рано `docker exec wiser-postgres` и мрежа `docker_default`.
> И двете изчезнаха с миграцията към Azure — контейнерът `wiser-postgres` е в профил
> `full` и не се вдига. Инструкцията остана да сочи към машина, която вече не съществува,
> и точно затова `roads` стоя празна.

## Настройки

| Променлива | По подразбиране | За какво е |
|---|---|---|
| `POSTGRES_HOST` | — | Задължителна. |
| `POSTGRES_PORT` | `5432` | |
| `POSTGRES_DB` / `POSTGRES_USER` | `wiser` | |
| `POSTGRES_PASSWORD` | — | Задължителна. |
| `PGSSLMODE` | `require` | Azure отказва връзка без TLS. `osm2pgrouting` няма собствен флаг за това, но libpq чете променливата — затова тя покрива и него, и `psql`. |
| `OSM_EXTRACT_URL` | Geofabrik България | Сменя се за тест с малък extract. |
| `STAGING_SCHEMA` | `osm_staging` | |

## Бележки

- `osm_staging.ways.tag_id` се свързва с `osm_staging.configuration.tag_id`, за да се
  възстанови истинската стойност на `highway` тага (`residential`, `primary`…) за
  колоната `roads.highway`.
- Импортът е еднократен/рядък — OSM пътищата за България не се променят често — затова
  job-ът е ръчен, а не по график.
- Базовият образ е `pgrouting/pgrouting-extra:16-3.5-4.0`: същата версия като Postgres-а
  в `docker-compose.yml`, само че вариантът `-extra` носи и `osm2pgrouting`.
