# OddLab · A little odd. A little joy.

[简体中文](README.md) | **English**

A collection of browser games and small everyday experiments. Pick a quick random decision, explore another life, or spend a few minutes planning deliveries for two dragons.

**[Play online](https://perry-lynn.github.io/oddlab/?lang=en)** · [Dragon Dispatch](https://perry-lynn.github.io/oddlab/dispatch/?lang=en) · [1024 showcase post (Chinese)](docs/showcase/1024Builder作品秀-脑洞研究所.md)

![OddLab home page, shown in Chinese](1024Builder作品秀配图/01-home-desktop.png)

## What you can play

| Experiment | What happens |
| --- | --- |
| Dragon Dispatch | Assign cargo and plan routes for two dragons with different abilities. Manage capacity, weather, stamina and deadlines, then bring both dragons home. Five levels, plan previews, undo and turn-by-turn execution. |
| Your Absurd Persona | Six playful questions, two question sets and 16 fictional personas. Change one answer to preview a different result. For entertainment only. |
| Parallel Life Simulator | Explore five story worlds through three scenes each. Choices affect resources and endings; an ending gallery and 12 life archives are also available. |
| Leave It to Chance | Draw an option or compare 2–16 candidates in successive pairs. Save decisions in a collection on your current browser. |
| A Strange Task Today | One small daily task with two ways to try it, a local task booklet, streaks and a weekly challenge. |

A small 1024 extra, Duck Debug Room, sits below the main cards: inspect three everyday “programs,” find the faulty step, choose a repair and get a playful commit message.

The website defaults to Simplified Chinese and also supports English, Japanese and Spanish. `?lang=zh|en|ja|es` overrides the saved preference; switching language during play preserves the current session. The language links in this README switch documentation only.

## Run locally

Use **Node.js 24 or later**. The games have no third-party runtime packages, and the static preview below needs no dependency installation.

```bash
npm test
npm run build:pages
npm run verify:pages
npm run preview:pages
```

Open [http://127.0.0.1:8788/oddlab/](http://127.0.0.1:8788/oddlab/).

`npm test` runs six checks covering content, pages, the Worker, dispatch rules and the other games. Worker tests use real in-memory SQLite through a D1-compatible adapter.

## Deploy to GitHub Pages

The public demo uses a separate static build in `dist-pages/`. A push to `main` runs tests, builds and validates the site, then deploys through GitHub Actions. For initial setup, select **GitHub Actions** under **Settings → Pages → Build and deployment → Source**.

Use matching production parameters for both build and verification:

```bash
export ODDLAB_BASE=/oddlab/
export ODDLAB_ORIGIN=https://perry-lynn.github.io
export ODDLAB_PAGES=1
export ODDLAB_DEFAULT_LANG=zh
npm run build:pages
npm run verify:pages
```

Adjust the path and origin for another repository; the existing workflow derives them automatically from repository information.

- Each public route has its own `index.html`, supporting direct visits, refreshes and shared links.
- Navigation, images, modules, locale packs and canonical URLs respect the repository base path.
- `?level=first|return|market|festival|storm` selects a dispatch level. Challenge links contain only a public level and language, never player routes or cargo assignments.
- Pages has no `/api/track`, administrator interface or D1 statistics. Worker code, database files and internal test pages are excluded, and browser analytics are disabled in this build.

## Language, progress and privacy

Public games require no account. Persona answers, life adventures and ongoing candidate comparisons are processed in page memory; custom candidates, answers and routes are not uploaded. Task records, parts of the ending gallery and saved decisions stay in the current browser, with no cross-device sync. Daily tasks rotate at midnight UTC+8.

Shared links can restore supported public results. Adventure progress, comparison progress and custom candidates are not encoded in invitation links. Native sharing depends on the device and browser; when copying fails, text is selected for manual copying.

Effects use native CSS and Web Animations and never drive game rules. Undo, restart or another interaction cancels ongoing dispatch playback. Effects respect the system's reduced-motion preference.

## Source layout

```text
.
├── src/          Application and game modules
├── public/       HTML shell, styles, icons, images and locale packs
├── tests/        Regression checks and original data fixtures
├── scripts/      Build, validation and local preview scripts
├── docs/         Showcase, release notes and test records
├── previews/     Design proposals and legacy diagnostics
├── worker/       Separate Worker backend source
├── db/           Database schema
└── drizzle/      Database migrations
```

Showcase screenshots keep their existing `1024Builder作品秀配图/` paths so published image links continue to work. `dist/`, `dist-pages/` and `worker/index.js` are generated and excluded from version control.

| Files | Responsibility |
| --- | --- |
| `src/app.js`, `src/logic.mjs` | Routing, original persona scoring and archive restoration, daily tasks and sharing fallbacks. |
| `src/games-content.mjs`, `src/games-logic.mjs`, `src/games-ui.mjs` | Content, rules and UI for branching lives, persona previews, candidate comparisons and daily tasks. |
| `src/dispatch-logic.mjs` | Independently testable dispatch rules, immutable projections, cargo handoffs and capacity checks. |
| `src/dispatch-ui.mjs`, `src/dispatch-copy.mjs` | Dispatch map, execution feedback and four-language copy. |
| `src/i18n.mjs`, `src/ui-catalog.mjs`, `public/locales/` | Language selection, interface translations and four locale packs. Keep the packs aligned when editing content. |
| `src/hosting.mjs`, `src/page-content.mjs` | Deployment paths, initial HTML, instructions and crawlable page content. |
| `scripts/build-pages.mjs`, `tests/verify-pages-build.mjs` | Static Pages build and artifact checks. |
| `worker/runtime.mjs`, `db/`, `drizzle/` | Request handling, database schema and migrations for the separate Sites/Worker target. |

See [dispatch asset notes](public/assets/dispatch/README.md) for provenance, dimensions and size budgets. `src/dispatch-assets.mjs` controls the public image allowlist.

## Separate Sites / Worker build

The original Sites project remains independent of Pages. Reuse its existing `.openai/hosting.json` instead of creating a replacement project.

```bash
npm run build
npm run preview
```

The build emits `dist/server/index.js` and `dist/.openai/hosting.json`. Preview runs at `http://127.0.0.1:8765` with a local SQLite file under `/private/tmp`, which is never deployed. Packaging includes the `drizzle/` migrations; the platform provides the `DB` binding and applies migrations. Keep deployed migrations immutable and add a new migration for later changes. Only development database tooling requires installing dependencies from `pnpm-lock.yaml`.

This target records aggregate views and clicks without reading answers, candidate text or routes. Aggregate data has no automatic expiry, and the platform may keep separate access logs. Repeated clicks count, so totals do not represent unique visitors.

`/admin`, legacy `/stats` and `/api/stats` require both platform identity headers and an exact match against server-only `ADMIN_EMAIL`. Configure secrets in the platform, never in source. Public games remain anonymous.

## Pages and search

The build generates initial HTML, individual titles and descriptions, canonical URLs, four-language hreflang and a sitemap for public routes. Chinese canonical URLs omit `lang=zh`; other languages keep their language parameter. Protected pages, APIs, result links and legacy test pages are excluded from indexing. Search engine indexing is not yet confirmed.

Report problems through [GitHub Issues](https://github.com/Perry-Lynn/oddlab/issues), including the game, reproduction steps, device and browser.
