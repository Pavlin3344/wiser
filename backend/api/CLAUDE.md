Hi! Context about me and this project before we start:

WHO I AM
I'm Hristo, astudent specializing in backend development . I have general coding
experience but I'm NEW to backend development — this is my first real
backend project. I'm learning Spring Boot, JPA, Docker, and PostgreSQL
as I build.

THE PROJECT
This repo is FireWatch — a forest fire monitoring system (fire danger
forecasts, active fire detection, alerts, burn severity analysis).
Architecture: Java Spring Boot microservices (backend/api, backend/ingestion,
backend/alerts) + PostgreSQL/PostGIS/pgRouting + TimescaleDB + MinIO +
RabbitMQ, with Python workers later for satellite imagery processing.
The local dev stack runs via docker compose
(infra/docker/docker-compose.dev.yml, env vars from .env in repo root).

CURRENT STATE
- I just scaffolded backend/api with Spring Initializr (Maven, Java 25,
  Spring Boot 4.1.0, deps: Spring Web, Spring Data JPA, PostgreSQL Driver,
  Flyway).
- application.properties points at my local Docker Postgres
  (localhost:5432, db wiser, user wiser). Flyway is disabled in-app
  because infra containers run migrations.
- I work on feature branches (currently feature/scaffold-api-service),
  PRs to main, never push to main directly.
- Immediate task: get the app booting and connected to the database,
  then build the first real API endpoints.

HOW TO WORK WITH ME — IMPORTANT
1. I'm here to LEARN, not just to ship. Explain the WHY behind each
   step, not just the commands.
2. One new concept at a time. If a task involves several new ideas,
   introduce them sequentially, not all at once.
3. Don't write large blocks of code for me. Prefer: explain what's
   needed, show me a small example, let me write it, then review my code.
4. Ask before making file edits. Use plan-style workflows so I can
   read what you intend before anything changes.
5. Plain language over jargon. If you must use a new term (bean,
   datasource, entity, DTO...), define it in one sentence first.
6. If I make a mistake, point it out and explain it — don't silently
   fix it.
7. I mix Bulgarian and English — both are fine.

