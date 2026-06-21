# ADR-0011: Frontend Tech Stack — React, Vite, MapLibre, Shadcn, Zustand

- **Status:** Accepted
- **Date:** 2026-06-21
- **Deciders:** Suat

## Context

Wiser изисква уеб-базиран dashboard (Command Center) за визуализация на горски пожари в реално време (Phase 1 чрез EFFIS). Frontend приложението трябва да бъде високопроизводително, тъй като ще рендира хиляди географски точки (WebGL) едновременно, като същевременно предоставя модерен, glassmorphic UI без да насича браузъра.

Трябва да изберем базовия технологичен стек за разработка на клиентската част, включващ framework, управление на състоянието (state), UI/стилизиране и GIS (mapping) библиотека.

## Decision

Деплойваме frontend архитектурата със следните технологии:

### Core Framework & Build Tool

- **React 18** — базов UI framework.
- **Vite** — build tool и dev server. Избран заради светкавичния HMR (Hot Module Replacement) и бързия production build спрямо Webpack.

### GIS & Mapping

- **MapLibre GL JS** — основен engine за рендиране на картата. Поддържа 3D Globe projection, хардуерно WebGL ускорение за хиляди точки (fire anomalies) и е напълно open-source.
- **Esri World Imagery (Satellite)** — използваме публичния tile сървър на Esri като базова сателитна карта.

### UI & Styling

- **Tailwind CSS (v4)** — utility-first CSS framework за бързо стилизиране чрез дизайн токени (oklch).
- **Shadcn UI** — headless компоненти (Radix UI) интегрирани чрез Tailwind. Компонентите живеят в нашата кодова база (`src/components/ui`), което ни дава 100% контрол над "Wildfire Red" темата и glassmorphic ефектите.

### State Management

- **Zustand** — lightweight глобален state manager. Използва се за споделяне на състоянието (избран базов слой, 2D/3D изглед, филтри по дати) между UI панелите и MapLibre контейнера без излишни prop-drilling и re-renders.

## Alternatives considered

- **Mapbox GL JS** — отхвърлено. След версия 2.0 Mapbox премина към затворен код и pay-per-load модел, което би генерирало непредвидими разходи за 24/7 мониторинг система. MapLibre е свободен форк на Mapbox.
- **Leaflet** — отхвърлено. Leaflet използва DOM/Canvas рендиране, което е твърде бавно за плавни анимации на хиляди активни пожари и не поддържа 3D Globe изглед "out of the box".
- **Material UI (MUI) / Bootstrap** — отхвърлено. Твърде тежки библиотеки, които налагат специфичен корпоративен дизайн. Shadcn ни позволява да изградим персонализиран "emergency dashboard" вид.
- **Create React App (Webpack)** — отхвърлено. Остаряла и бавна технология; Vite е новият индустриален стандарт за SPA (Single Page Applications).
- **Redux** — отхвърлено. Твърде много boilerplate код за сравнително прост UI state. Zustand върши същата работа с няколко реда код.

## Consequences

**Positive:**

- Изключително бърз Developer Experience благодарение на Vite.
- Нулеви разходи за картографски API ключове (благодарение на MapLibre и Esri).
- Пълен контрол над UI компонентите — няма vendor lock-in към конкретна UI библиотека.
- Висока FPS производителност при рендиране на картата.

**Negative:**

- Shadcn UI изисква ние да поддържаме кода на компонентите. Ако излезе ъпдейт на даден компонент, трябва да го интегрираме ръчно, а не просто да обновим версия в `package.json`.
- Работата с MapLibre и WebGL изисква специфични познания (GeoJSON sources, paint layers), което е по-сложно от стандартното поставяне на маркери в Google Maps.

**Neutral / things to watch:**

- Esri Satellite е безплатен за базово ползване, но ако трафикът стане огромен в production, може да се наложи миграция към кеширан tile server или платен доставчик. Условията им за ползване трябва да се следят преди комерсиализация.
