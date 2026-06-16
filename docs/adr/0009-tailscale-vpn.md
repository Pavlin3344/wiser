# ADR-0009: VPN достъп чрез Tailscale

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Pavlin

## Context

Observability UI-тата (Grafana, Kibana, Alerta, Prometheus) и management интерфейсите (RabbitMQ, MinIO) трябва да са достъпни за всички 5 члена на екипа, но не публично в интернет.

Docker port binding-ът по подразбиране е `127.0.0.1` — достъпен само от самия сървър. SSH tunneling е алтернатива, но изисква активна SSH сесия за всеки достъп и е неудобно за ежедневна работа.

## Decision

Инсталираме **Tailscale** на Hetzner сървъра. Всички observability портове се bind-ват на `0.0.0.0` (всички интерфейси), достъпни по Tailscale IP `100.116.156.92`.

Database портовете (PostgreSQL :5432, TimescaleDB :5433) остават на `127.0.0.1` — достъпни само чрез SSH tunnel, не през Tailscale. Базите данни не трябва да са достъпни дори за членовете на екипа директно — само application кодът се свързва с тях.

UFW firewall правило: `sudo ufw allow in on tailscale0` — позволява всички портове от Tailscale интерфейса.

Всеки член на екипа се добавя с покана от Tailscale admin panel (`tailscale.com/admin → Users → Invite`). Устройствата изискват одобрение от admin (Pavlin) преди да получат достъп.

## Alternatives considered

- **SSH tunneling** — отхвърлено за ежедневна употреба; неудобно, изисква активна сесия, 5 различни хора с различни OS-и.
- **Nginx reverse proxy с Basic Auth** — отхвърлено; излага портовете публично дори с парола; SSL сертификат изисква домейн.
- **Cloudflare Tunnel** — добра алтернатива, но по-сложна конфигурация от Tailscale за малък екип.
- **VPN с WireGuard ръчно** — Tailscale е базиран на WireGuard но с нулева конфигурация; ръчният WireGuard би отнел часове за настройка.

## Consequences

**Positive:**
- Нулева конфигурация — инсталация за 5 минути на всяко устройство
- Всеки член на екипа достига сервизите директно в браузъра
- Не излага нищо публично
- Безплатно за до 100 устройства
- Работи на Windows, Mac, Linux, iOS, Android

**Negative:**
- Зависимост от Tailscale като external service
- При Azure migration трябва да се инсталира отново на новия сървър (5 минути)
- Admin трябва ръчно да одобрява нови устройства

**Neutral / things to watch:**
- При production (след Azure migration) да се обмисли дали observability UI-тата трябва да са достъпни само за екипа или за клиента също — ако за клиента, Nginx + Basic Auth е по-подходящо
- Tailscale free tier е достатъчен за 5 члена на екипа + 1 сървър
