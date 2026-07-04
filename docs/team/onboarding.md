# Wiser — Team Onboarding Guide

## Стъпка 1: GitHub Access

Приеми поканата от Pavlin към `github.com/Pavlin3344/wiser`.

Настрой SSH ключ за push достъп:
```bash
ssh-keygen -t ed25519 -C "твоето_име@wisertech"
cat ~/.ssh/id_ed25519.pub
```
Качи публичния ключ в GitHub → Settings → SSH and GPG keys → New SSH key.

Клонирай repo-то:
```bash
git clone git@github.com:Pavlin3344/wiser.git
cd wiser
git config pull.rebase true
```

---

## Стъпка 2: VPN Setup (Tailscale)

Tailscale е VPN който свързва твоя компютър директно с dev сървъра.
Без него нямаш достъп до сервизите.

### Инсталация

**Windows:**
Свали от https://tailscale.com/download/windows и инсталирай.

**Mac:**
App Store → търси "Tailscale" → Install.

**Linux:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

### Login

След инсталация ще се отвори браузър за login.
Влез с **GitHub акаунта** си — Pavlin ще те одобри от admin panel-а.

### Проверка

След одобрение пингни сървъра:
```bash
ping 100.116.156.92
```
Трябва да получиш отговор.

---

## Стъпка 3: Dev сервизи

След като Tailscale работи, имаш достъп до следните сервизи:

### Databases (само през SSH tunnel — не са публично достъпни)
```bash
ssh -L 5432:localhost:5432 -L 5433:localhost:5433 pavlin@100.116.156.92
```

| Сервиз | Connection String |
|--------|-------------------|
| PostgreSQL + PostGIS + pgRouting | `postgresql://wiser:***@localhost:5432/wiser` |
| TimescaleDB | `postgresql://wiser:***@localhost:5433/wiser_timeseries` |

Паролата ще ти я даде Pavlin лично — не се пази в repo-то.

### Web UI сервизи (директно в браузъра)

| Сервиз | URL | За какво е |
|--------|-----|------------|
| **Grafana** | http://100.116.156.92:3000 | Метрики, dashboards и infrastructure alerts (Alerting → Alertmanager) |
| **Kibana** | http://100.116.156.92:5601 | Логове от всички контейнери — search и анализ |
| **Prometheus** | http://100.116.156.92:9090 | Raw метрики и alert rules (за DevOps) |
| **RabbitMQ** | http://100.116.156.92:15672 | Message queue management |
| **MinIO** | http://100.116.156.92:9001 | S3-compatible blob storage UI |
| **Elasticsearch** | http://100.116.156.92:9200 | Raw search API (за DevOps) |

### Grafana login
- Username: `admin`
- Password: от Pavlin

---

## Стъпка 4: Local development

За локална разработка използвай docker-compose от repo-то:
```bash
cp .env.example .env
# Попълни .env с паролите от Pavlin
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

---

## Git workflow

```bash
# Преди всяка работа
git checkout main && git pull --rebase

# Създай branch за задачата
git checkout -b feature/моята-задача

# Commit-вай периодично
git add .
git commit -m "feat: описание"

# Push и отвори PR
git push -u origin feature/моята-задача
# После в GitHub UI → New Pull Request → main
```

Commit конвенция: `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`

**Важно:** Никой не push-ва директно в `main` — всичко минава през PR с поне 1 approval.
