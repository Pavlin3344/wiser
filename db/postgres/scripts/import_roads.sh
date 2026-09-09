#!/bin/sh
# Пълни `roads` с реалната пътна мрежа на България и routing топология.
#
# Стъпките са същите, които README.md описваше на ръка. Разликата е, че сега вървят
# вътре в контейнер, който може да бъде пуснат в Azure - в същата мрежа, в която е
# базата - вместо да зависят от tailnet маршрут и от контейнер на Hetzner.
#
# Идемпотентно е от край до край: osm2pgrouting се пуска с --clean (пресъздава staging
# таблиците), а import_roads_from_osm.sql прави TRUNCATE преди INSERT. Второ пускане
# дава същия резултат, не двойно повече редове.
set -eu

POSTGRES_HOST="${POSTGRES_HOST:?POSTGRES_HOST липсва}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-wiser}"
POSTGRES_USER="${POSTGRES_USER:-wiser}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD липсва}"

# Azure Flexible Server отказва връзка без TLS. osm2pgrouting няма собствен флаг за
# sslmode - подава на libpq само хост/порт/база/потребител - но libpq чете тази
# променлива, така че тя покрива и него, и psql.
export PGSSLMODE="${PGSSLMODE:-require}"
export PGPASSWORD="$POSTGRES_PASSWORD"

WORK_DIR="${WORK_DIR:-/tmp/roads}"
EXTRACT_URL="${OSM_EXTRACT_URL:-https://download.geofabrik.de/europe/bulgaria-latest.osm.pbf}"
STAGING_SCHEMA="${STAGING_SCHEMA:-osm_staging}"

# Точно седемнайсетте стойности, които mapconfig_for_cars.xml приема. Изброени са тук,
# за да падне рязането преди преобразуването в XML, а не при импорта: така резултатът е
# идентичен, а XML-ът - многократно по-малък.
#
# Това не е дребна оптимизация. osm2pgrouting зарежда XML-а в паметта и точно затова
# пълната страна го убива (виж README.md). Пътеките, коловозите и велоалеите са голяма
# част от `highway` way-овете в България и без изключение биват изхвърлени при импорта -
# тоест единственото, което правеха, беше да раздуят пиковата памет.
HIGHWAY_VALUES="motorway,motorway_link,motorway_junction,trunk,trunk_link,primary,primary_link,secondary,secondary_link,tertiary,tertiary_link,residential,living_street,service,unclassified,road"

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

psql_do() {
    psql --host="$POSTGRES_HOST" --port="$POSTGRES_PORT" \
         --dbname="$POSTGRES_DB" --username="$POSTGRES_USER" \
         --no-password --set ON_ERROR_STOP=1 "$@"
}

mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

log "Базата е $POSTGRES_USER@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB (sslmode=$PGSSLMODE)"
psql_do -c "SELECT 1" >/dev/null
log "Връзката работи."

# Ако някой е спрял job-а по средата, полусвалените файлове стоят на ephemeral диска и
# следващият пробег ще ги вземе за готови.
rm -f bulgaria-latest.osm.pbf bulgaria-roads.pbf bulgaria-roads.osm

log "1/5 Сваля extract-а от Geofabrik"
wget --tries=3 --waitretry=5 --progress=dot:giga \
     -O bulgaria-latest.osm.pbf "$EXTRACT_URL"
log "    $(du -h bulgaria-latest.osm.pbf | cut -f1)"

log "2/5 Реже до routable highway класовете"
osmium tags-filter --overwrite \
    bulgaria-latest.osm.pbf "w/highway=$HIGHWAY_VALUES" \
    -o bulgaria-roads.pbf
rm -f bulgaria-latest.osm.pbf
log "    $(du -h bulgaria-roads.pbf | cut -f1)"

log "3/5 Преобразува в XML (osm2pgrouting не чете .pbf)"
osmium cat --overwrite bulgaria-roads.pbf -o bulgaria-roads.osm -f osm
rm -f bulgaria-roads.pbf
log "    $(du -h bulgaria-roads.osm | cut -f1)"

log "4/5 osm2pgrouting -> схема $STAGING_SCHEMA"
psql_do -c "CREATE SCHEMA IF NOT EXISTS $STAGING_SCHEMA;"
osm2pgrouting \
    -f bulgaria-roads.osm \
    -c /usr/local/share/osm2pgrouting/mapconfig_for_cars.xml \
    -d "$POSTGRES_DB" -U "$POSTGRES_USER" \
    -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -W "$POSTGRES_PASSWORD" \
    --schema "$STAGING_SCHEMA" --clean
rm -f bulgaria-roads.osm

log "5/5 Прехвърля staging таблиците в roads"
psql_do -f /opt/wiser/import_roads_from_osm.sql

# Проверката, която api-то прави, преди да сметне маршрут (EvacuationRepository:
# hasRoutingTopology). Ако тя не мине, job-ът трябва да се провали тук - тихо празна
# таблица значи, че евакуационните маршрути пак ще връщат 409, но без нищо в логовете,
# което да го обясни.
ROUTABLE=$(psql_do --tuples-only --no-align \
    -c "SELECT COUNT(*) FROM roads WHERE source IS NOT NULL AND target IS NOT NULL")
log "Сегменти с топология: $ROUTABLE"

if [ "$ROUTABLE" -lt 1000 ]; then
    log "ГРЕШКА: под 1000 сегмента с source/target - импортът не е минал както трябва."
    exit 1
fi

log "Готово. Евакуационните маршрути вече имат по какво да се смятат."
