# Wiser — бележки за AI асистенти и нови хора

Интегрирана система за наблюдение и управление на горски пожари (сателитни + метео данни,
само България). Този файл е указател — истината е в документите, към които сочи, а не тук,
за да няма две версии, които се разминават.

## Кой какво държи

| Част | Кой | Къде |
|---|---|---|
| Backend (Java, 3 сервиза) | Ицо | `backend/{api,ingestion,alerts}` |
| Data processing (Python workers) | Илиян | `data/processing/` |
| Инфраструктура, CI/CD, frontend | Павлин | `infra/`, `.github/`, `frontend/` |

**Договорът между backend и data processing е `shared/schemas/message-contracts.md`.**
Нищо в него не се променя едностранно — само с PR и ревю от другата страна. Формата на
съобщенията, схемата на таблиците и риск моделът са там.

Статусът на интеграцията и отворените въпроси между двамата са в
`docs/team/connection-guide.md`. Свързването към сървъра (Tailscale, пароли) — също там.

## ⚠️ Отворени молби между хората (към 2026-08-18)

- **Към Ицо:** NDVI покрива ~1% от страната (bbox-ът на Sentinel fetcher-а е едно квадратче),
  и dNBR worker-ът чака producer за `analysis.tasks`. Подробно: секция „За Backend" в
  `docs/team/connection-guide.md`.

Ако работиш по някое от тези — прочети секцията, преди да пишеш код. Формата на
`analysis.tasks` (раздел 10 от договора) е предложение и още се сменя лесно.

## Как се пуска и тества

```bash
# локален стек (бази, RabbitMQ, MinIO)
cp .env.example .env    # паролите са от Павлин, .env не влиза в git
docker compose -f infra/docker/docker-compose.dev.yml up -d

# целият стек, както е на сървъра
docker compose -f infra/docker/docker-compose.yml up -d
```

| Какво | Команда |
|---|---|
| Java тестове | `cd backend/<сервиз> && ./mvnw -B test` |
| Python тестове | `cd data/processing/<worker> && python -m pytest` |
| Frontend | `cd frontend && npm run test:run` |

Всеки Python worker е със свой `.venv` и свой `requirements.txt`;
`data/processing/requirements-dev.txt` добавя pytest. Образите се вдигат на **3.12**
(`data/processing/Dockerfile`) и CI тества на нея; локалните venv-и са на **3.11**, защото
системният python е 3.14, а rasterio/GDAL са сигурни на 3.11. Всичко изброено го пуска и CI
(`.github/workflows/ci.yml`), включително `promtool` върху правилата за аларми.

## Неща, които се научават трудно

- **Всеки писач в база трябва да е идемпотентен.** Producer-ите препубликуват (`@Scheduled`
  гърми при всеки старт на контейнер), затова таблиците имат уникални индекси, а INSERT-ите
  са с `ON CONFLICT`. Виж `V3__fwi_dedup.sql` — преди него всеки деплой дублираше решетката.
- **Вдигнат контейнер не значи работещ pipeline.** `zones` стоя празна седмици, докато
  всичко беше зелено. Затова `data-metrics` мери свежестта на данните, не живота на
  процесите (`data/processing/metrics/`).
- **Обхватът е само България** и координатите са EPSG:4326 навсякъде. Очертанието на
  страната стои в два файла (worker и frontend) и CI ги сравнява — сменяш ли единия, сменяй
  и другия.
- **EFFIS data сървърът има изтекъл SSL сертификат**; свалянето на fuel картата нарочно
  пропуска проверката.

## Конвенции

- Документацията и коментарите в `data/processing/` са на български; кодът е на английски.
- Commit-и: `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`.
- Никой не push-ва директно в `main` — PR с поне едно одобрение (`docs/team/onboarding.md`).
- Архитектурните решения се записват като ADR в `docs/adr/`.
