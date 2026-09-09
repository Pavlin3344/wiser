# Пътната мрежа с routing топология, като job вместо като списък команди в README.
#
# Досега това беше ръчен pipeline, документиран срещу `docker exec wiser-postgres` и
# мрежа `docker_default`. И двете изчезнаха с миграцията, а `roads` остана празна в
# Azure - тоест евакуационните маршрути не се появиха, а инструкцията как да се оправят
# сочеше към контейнер, който вече не съществува.
#
# Същият образ, който върти Postgres локално (pgrouting/pgrouting:16-3.5-4.0), само че
# вариантът `-extra` носи и osm2pgrouting. Тагът е закован по същата причина, по която
# е закован и в docker-compose.yml: подвижен таг не се връща назад.
FROM pgrouting/pgrouting-extra:16-3.5-4.0

# osmium реже .pbf-а преди преобразуването в XML, wget го сваля. Останалото
# (osm2pgrouting, psql, mapconfig профилите) идва от базовия образ.
#
# Две неща тук са заради това, че Debian 11 излезе от поддръжка, а не заради нас:
#
#   * Release файлът на bullseye-security изтече на 7 септември 2026 и оттогава
#     `apt-get update` връща E: и код 100 - тоест build-ът се чупи от календара, а не
#     от промяна у нас. Check-Valid-Until=false само спира apt да откаже заради датата;
#     пакетите тук идват от bullseye main, който не е засегнат.
#   * wget, а не curl. curl се сервира от bullseye-security, а неговият pool вече е
#     изпразнен - `apt-get install curl` връща 404 за самия .deb. wget стои в main.
RUN apt-get -o Acquire::Check-Valid-Until=false update \
    && apt-get install -y --no-install-recommends osmium-tool ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

COPY import_roads.sh /usr/local/bin/import_roads.sh
COPY import_roads_from_osm.sql /opt/wiser/import_roads_from_osm.sql
RUN chmod +x /usr/local/bin/import_roads.sh

# Базовият образ е сървърен и стартира postgres. Тук той е само клиент.
ENTRYPOINT ["/usr/local/bin/import_roads.sh"]
