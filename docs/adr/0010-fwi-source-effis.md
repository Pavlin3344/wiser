# ADR-0010: Използване на EFFIS FWI вместо собствен модел на Insait

- **Status:** Accepted
- **Date:** 2026-06-17
- **Deciders:** Pavlin, [името на колегата с данните]

## Context

Phase 1 на Wiser изисква Fire Weather Index (FWI) данни за изчисляване на риск зони и превенция. Имаме две възможни решения:

- Използване на EFFIS FWI — публично предоставян от European Forest Fire Information System
- Използване на собствен FWI модел разработен от Insait

## Decision

Използваме **EFFIS FWI** като източник на FWI данни за Phase 1.

## Alternatives considered

**Insait собствен модел** — отхвърлен по следните причини:

1. **Лицензионен риск** — моделът е обучен от Insait и не може законно да бъде включен в продукт който се продава. Изисква отделно лицензно споразумение.

2. **Operational overhead** — собственият модел изисква:
   - Trениране (compute разходи, GPU)
   - Hostване (infrastructure)
   - Maintenance на model lifecycle
   - Това превръща Wiser от продукт за пожари в ML инфраструктурен проект

3. **Output format** — EFFIS извежда **числова стойност** (FWI индекс) за дадена географска точка по формула, която лесно се обработва от backend-а и се записва в `fire_weather_index` hypertable. Insait моделът извежда **изображение** (растер), което изисква допълнително GIS обработване.

4. **Точност** — Insait моделът се обосновава върху исторически данни и е следователно по-малко точен от EFFIS, който използва actual meteorological forecasting data (ECMWF).

## Consequences

**Positive:**
- Лицензно чисто — EFFIS е публично достъпно
- Лесна интеграция — числови стойности директно в TimescaleDB
- Точни данни от ECMWF
- Без infrastructure overhead за ML модел

**Negative:**
- Зависим сме от EFFIS API uptime
- EFFIS обновява данните 1× дневно — не можем да получим по-чести данни

**Neutral / things to watch:**
- В случай че EFFIS data е недостатъчно за специфични български условия, може да се добави корекционен слой (fine-tuning) върху EFFIS стойностите, без да заменя моделът
