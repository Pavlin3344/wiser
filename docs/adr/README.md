# Architecture Decision Records (ADRs)

This directory contains records of significant architectural decisions made during the Wiser project. Each ADR captures the context, decision, and consequences of a single choice so the team — and AI assistants helping us write code — can understand why the system looks the way it does.

## Why we keep ADRs

- **Context for AI sessions.** When any of us opens a fresh AI chat and asks for help with code, we paste the relevant ADR(s) so the AI knows our conventions and constraints. Without this, AI gives generic answers that don't fit our codebase.
- **Memory across the 12-week project.** In month 3 we won't remember why we picked RabbitMQ over Kafka. The ADR tells us.
- **Onboarding.** If anyone joins later or reviews our work, the ADRs explain reasoning, not just what we did.

## Format

We use a lightweight version of [Michael Nygard's template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions). Each ADR has:

- **Status** — Proposed, Accepted, Deprecated, or Superseded by ADR-NNNN
- **Context** — What problem are we solving? What constraints apply?
- **Decision** — What did we choose?
- **Alternatives considered** — What did we reject and why?
- **Consequences** — What becomes easier? What becomes harder?

ADRs are short (1 page) and immutable. If a decision changes, we write a new ADR that supersedes the old one — we don't edit history.

## Index

| Number | Title                                         | Status   |
| ------ | --------------------------------------------- | -------- |
| 0000   | Template                                      | —        |
| 0001   | Monorepo structure                            | Accepted |
| 0002   | Deployment target: Hetzner then Azure         | Accepted |
| 0003   | PostgreSQL + PostGIS + pgRouting              | Proposed |
| 0004   | TimescaleDB for time-series data              | Proposed |
| 0005   | S3-compatible object storage (MinIO → Blob)   | Proposed |
| 0006   | RabbitMQ as message bus                       | Proposed |
| 0007   | Observability stack: Prometheus, Grafana, ELK | Proposed |
| 0008   | Two separate alert systems                    | Accepted |
| 0009   | Frontend hosting on Cloudflare Pages          | Proposed |
| 0010   | Three separate processing workers by phase    | Proposed |
| 0011   | VPN access via Tailscale                      | Proposed |
| 0012   | FWI source: EFFIS vs Insait                   | Proposed |
| 0013   | Frontend Tech Stack: React, Vite, MapLibre    | Proposed |

## Writing a new ADR

1. Copy `0000-template.md` to `NNNN-short-title.md` with the next number
2. Fill in all sections
3. Open a PR — the ADR itself is the discussion
4. After merge, status changes from Proposed to Accepted
