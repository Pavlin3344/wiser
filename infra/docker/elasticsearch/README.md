# Elasticsearch — шаблон, ILM и еднократно почистване

Тези файлове не се прилагат от Compose. Elasticsearch няма механизъм да зареди index
template от bind mount, така че се качват с `curl` веднъж и оттам нататък важат за всеки
нов индекс.

Пуска се от Hetzner машината (ES слуша само на `127.0.0.1:9200`):

```bash
cd infra/docker/elasticsearch

# 1. ILM политиката преди шаблона - шаблонът я сочи по име и ES се оплаква, ако липсва.
curl -sX PUT localhost:9200/_ilm/policy/wiser-logs \
  -H 'Content-Type: application/json' --data-binary @wiser-logs-ilm.json

# 2. Шаблонът. priority: 100 бие вградените, но не и системните на Elastic.
curl -sX PUT localhost:9200/_index_template/wiser-logs \
  -H 'Content-Type: application/json' --data-binary @wiser-logs-template.json

# 3. Проверка, че се хваща за новите индекси
curl -s "localhost:9200/_index_template/wiser-logs?filter_path=**.index_patterns"
```

## Еднократно почистване (2026-09-02)

Състоянието преди: **481 индекса, 519 активни + 481 неразпределени shard-а, 649 MiB** данни,
диск на 79%. Старата схема правеше по един индекс на услуга на ден, а всеки се създаваше с
`number_of_replicas: 1` на клъстер от един node — реплика, която по дефиниция никога не се
разпределя.

```bash
# Alerta беше махната от стека още през юли - тези индекси нямат никакъв читател.
curl -sX DELETE 'localhost:9200/wiser-alerta-*,wiser-alerta-mongo-*'

# Юни и юли: отпреди новата схема, вече извън всякакъв прозорец за дебъгване.
curl -sX DELETE 'localhost:9200/wiser-*-2026.06.*,wiser-*-2026.07.*'

# Август по старата схема. ⚠ Пази wiser-logs-*, което е новото име.
curl -sX DELETE 'localhost:9200/wiser-*-2026.08.*'

# Репликите на каквото остане - без това те си стоят unassigned завинаги.
curl -sX PUT 'localhost:9200/wiser-*/_settings' \
  -H 'Content-Type: application/json' -d '{"index":{"number_of_replicas":0}}'

# Резултат: status зелен, unassigned_shards 0
curl -s localhost:9200/_cluster/health | jq '{status,active_shards,unassigned_shards}'
```

## Защо `wiser-logs-*`, а не по услуга

Kibana филтрира по поле `service` също толкова бързо, колкото по име на индекс — разликата
беше само в цената. Един индекс дневно вместо двайсет означава ~14 shard-а за целия
retention прозорец, вместо 962.

Виж `../logstash/pipeline/wiser.conf` за схемата и `../docker-compose.yml` за лимитите.
