# ADR-0007: Observability stack — Prometheus, Grafana, ELK, Alerta, cAdvisor

- **Status:** Accepted (изменено 2026-07-04: Alerta + MongoDB са премахнати — алармите се гледат в Grafana през Alertmanager datasource; конкретен нотификационен канал ще се избере отделно)
- **Date:** 2026-06-09
- **Deciders:** Pavlin

## Context

Wiser е 24/7 система за мониторинг на горски пожари. Инфраструктурата трябва да е наблюдаема от ден 1 — преди да се напише един ред application код. При проблем (контейнер падне, диск се напълни, queue се задръсти), екипът трябва да разбере веднага и да знае точно кой компонент е причината.

Имаме два типа observability нужди:

- **Метрики** — числени стойности във времето (CPU, RAM, queue depth, request rate)
- **Логове** — structured text events от всеки контейнер

Системата работи на един Hetzner CPX32 сървър (8GB RAM) с Docker Compose.

## Decision

Деплойваме следния observability stack като Docker контейнери на същия сървър:

### Метрики

- **Prometheus** — scrape-ва метрики от всички targets на 15-секундни интервали; пази 90 дни history
- **Grafana** — визуализация; два импортирани dashboard-а: Node Exporter Full (ID 1860) за хост метрики и cAdvisor exporter (ID 14282) за per-container метрики
- **Node Exporter** — системни метрики на хоста (CPU, RAM, disk, network)
- **cAdvisor** — per-container метрики (CPU/RAM/network per контейнер)
- **postgres-exporter** — PostgreSQL метрики (connections, query time, cache hit rate)
- **Alertmanager** — grouping, deduplication и routing на алерти от Prometheus към Alerta

### Логове

- **Elasticsearch** — log storage и full-text search; single-node, `xpack.security.enabled=false` за dev
- **Logstash** — log processing pipeline; приема от Filebeat, пише в Elasticsearch
- **Kibana** — log search UI; data view `wiser-*`
- **Filebeat** — събира Docker container logs от `/var/lib/docker/containers` и ги изпраща към Logstash

### Alerting

- **Alerta** — unified alert console; получава алерти от Alertmanager чрез webhook; отделен от in-app fire alerts (виж ADR-0008)

### VPN достъп

- **Tailscale** — инсталиран на сървъра; всички observability портове са достъпни само по Tailscale IP (`100.116.156.92`), не публично

### Alert rules (infrastructure.yml)

- `HighCPULoad` — CPU > 80% за 2 минути → warning
- `CriticalCPULoad` — CPU > 95% за 5 минути → critical
- `HighMemoryUsage` — RAM > 85% → warning
- `HighDiskUsage` — Disk > 80% → warning
- `PostgreSQLDown` — postgres-exporter не може да се свърже → critical

## Alternatives considered

- **Azure Monitor + Application Insights** — отхвърлено; платено и обвързва с Azure преди края на проекта. Ще се използва след Azure migration (седмица 12).
- **Grafana Cloud** — безплатен tier, но 10K metrics/month лимит е недостатъчен за 24/7 система с много контейнери.
- **Единствено ELK без Prometheus** — отхвърлено; ELK е за логове, не за метрики. Времеви серии и alerting изискват Prometheus.
- **Loki вместо ELK** — по-лека алтернатива за логове, но по-малко mature search capabilities. ELK е индустриален стандарт с по-добра Kibana UI.

## Consequences

**Positive:**

- Пълна видимост в инфраструктурата от ден 1
- Per-container метрики позволяват да се идентифицира кой сервиз яде ресурси
- Structured logs от всички контейнери са searchable в Kibana
- Alert rules пазят от silent failures

**Negative:**

- ELK stack изисква ~1.5GB RAM само за себе си — причина за upgrade от CPX22 към CPX32
- Много контейнери за поддръжка (14 контейнера общо)
- Grafana datasource трябва да се конфигурира ръчно след всеки volume reset

**Neutral / things to watch:**

- При Azure migration: Prometheus + Grafana + ELK мигрират като контейнери без промяна; само endpoint-ите в конфигурацията се обновяват
- Elasticsearch `xpack.security.enabled=false` е приемливо за dev зад Tailscale VPN; при production migration се включва authentication
- Grafana admin паролата се управлява чрез `.env` файл на сървъра — не се commit-ва в repo
