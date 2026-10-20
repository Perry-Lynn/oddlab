# OddLab · Five little experiments

Simplified Chinese by default, with English, Japanese, and Spanish. Reuses the existing Sites project and public URL. Four expanded mini-games plus Dragon Dispatch run locally; Dispatch has a six-turn first puzzle, an eight-turn return puzzle, and a nine-turn Market Relay. A small Worker/D1 service persists aggregate activity.

## Source and build

- `app.js`, `logic.mjs`: app routing, original persona scoring and archive restoration, UTC+8 mission rotation/storage, clipboard/share fallbacks. `games-content.mjs`, `games-logic.mjs`, and `games-ui.mjs` provide four-language branching life stories, counterfactual persona previews, choice duels, and two-angle daily missions without changing the original persona scoring or life archive IDs.
- `dispatch-logic.mjs`: deterministic first/return/market routing rules and immutable projections; the pickup levels model cargo responsibility separately from pickup, with delivery-before-pickup settlement and capacity warnings. `dispatch-ui.mjs` and `dispatch-copy.mjs` provide the shared route board, illustrated cargo/places, event-led execution feedback, and four-language interface. The original image prompts, source provenance, output sizes and byte budget are documented in `assets/dispatch/README.md`; `dispatch-assets.mjs` is the four-image public allowlist.
- `ui-catalog.mjs`: pure four-language UI catalog; `i18n.mjs`: browser language preference/query handling. `locales/{en,zh,ja,es}.json`: complete localized content packs. All IDs, scoring, versions, and task rotation remain consistent. Edit the committed locale packs together when changing content; the build does not silently overwrite them from the parent folder.
- `analytics.mjs`: page views and real UI clicks; new game buttons share only the fixed `experiment-action` category. It never reads answer choices, branch IDs, candidate text, task approaches, form contents, or browser identifiers.
- `worker/runtime.mjs`: public assets and `/api/track`, `/api/stats`. `prepare.mjs` generates `worker/index.js` with embedded assets; the four versioned WebPs are emitted as base64 source and decoded/cached only for allowlisted image GETs. HEAD keeps an empty body, and other paths use the normal 404 response.
- `db/schema.ts`, `drizzle/`: D1 schema and versioned migrations. The request handler never creates tables. Sites provisions binding `DB` and applies packaged migrations.

With Node 24+: `node prepare.mjs && bash scripts/build.sh && node scripts/validate-artifact.mjs`. Tests: `node verify.mjs && node verify-server.mjs && node verify-pages.mjs && node verify-dispatch.mjs && node verify-market.mjs && node verify-games.mjs` (also available through `npm test`). The server test uses actual in-memory SQLite through a D1-compatible adapter. `node scripts/preview.mjs` serves port 8765 with a separate SQLite file in `/private/tmp`; local data is never deployed. Dev-only drizzle tooling is locked in `pnpm-lock.yaml`; runtime has no package dependencies.

The Worker ESM build emits `dist/server/index.js` and `dist/.openai/hosting.json`. The Sites packaging helper copies root `drizzle/` to `dist/.openai/drizzle/`. Keep deployed migration files immutable; generate a new migration for future schema changes.

## GitHub Pages (static public build)

A second, independent build target serves the same games as a public static site, for example the TRAE 1024 showcase entry. It includes all four languages, original result restoration, the branching life adventure, counterfactual quiz preview, choice duel, daily mission booklet, and browser-local progress. It adds no accounts, multiplayer, or leaderboards.

```bash
npm test              # existing content, routing and Worker checks
npm run build:pages   # static site -> dist-pages/ (needs no dependencies)
npm run verify:pages  # static path, base-path and blocked-backend checks
npm run preview:pages # serve dist-pages/ at http://127.0.0.1:8788/oddlab/
npm run build         # unchanged Sites/Worker build
```

Standard-tool local run in a browser: `npm test && npm run build:pages && npm run preview:pages`, then open <http://127.0.0.1:8788/oddlab/>.

Motion: Dispatch plays completed turns along the actual roads (including the curved sky road), with pickup/delivery pulses, sequential batch playback and a brief victory celebration. Undo, restart or another interaction cancels playback immediately; animation never drives game state. System reduced-motion preferences disable decorative effects, including when changed during playback. The other games include small button, card and result reveals. All effects use browser-native CSS/Web Animations with no added dependencies.

How the build renders it:

- **Base path.** GitHub project pages live under `/<repo>/`. `hosting.mjs` derives the base at runtime from its own module URL and exposes `link()`, `asset()` and `currentRoute()`, which every browser module uses for navigation, resources, `fetch`, images, level links, share links, `history` calls, canonical, OG and the sitemap. The static build additionally rewrites root-absolute `href`/`src` attributes and injects `window.ODDLAB_PAGES`, `window.ODDLAB_DEFAULT_LANG` and `window.ODDLAB_STATS` into `<head>`.
- **Routing without server rewrites.** Each public route is emitted as a directory with its own `index.html` (`dispatch/index.html`, `life/index.html`, …), so direct opens, refreshes, deep links and share links all resolve without any rewrite rule. `404.html` serves unmapped paths with the original URL intact, and the in-page router renders its own not-found view for them.
- **Level and language parameters** stay query parameters (`?level=return|market&lang=en|zh|ja|es`) and survive refreshes; `?r=` and `?v=` still restore shared results.
- **Default language** for this entry is Simplified Chinese (`ODDLAB_DEFAULT_LANG=zh`); an explicit `?lang=` and a saved language choice still win.
- **Backend boundary.** The Pages build ships no D1 statistics backend, no `/admin` and no `/stats`, and no sign-in entry. `analytics.mjs` returns early when `window.ODDLAB_STATS=false`, so the page never requests a non-existent `/api/track`. The in-page privacy text describes this static behaviour instead of the Sites one.
- **Not published on Pages:** `worker/`, `db/`, `drizzle/`, `.openai/`, and the legacy `/capability.html` and `/tool-test.html` pages. The Sites build keeps all of them.

Automatic deployment: `.github/workflows/pages.yml` runs on every push to `main` and on manual dispatch. It runs `npm test`, derives `ODDLAB_BASE` and `ODDLAB_ORIGIN` from the repository, runs `build:pages` + `verify:pages`, uploads `dist-pages` with `actions/upload-pages-artifact` and deploys with `actions/deploy-pages` using only `contents: read`, `pages: write` and `id-token: write`. The repository Pages setting must be "Build and deployment → Source: GitHub Actions" once.

## Language and data behavior

`?lang=en|zh|ja|es` overrides the saved language preference. `/dispatch?level=return` opens the second puzzle and `?level=market` opens Market Relay; omitting `level` opens the first. Challenge links retain only a public level slug and language, never cargo responsibility, routes, or game state. Links carry language even when localStorage is denied. Changing language preserves quiz answer indices and the selected counterfactual question, archive result IDs, adventure scene/resources/history, choice scene/mode and duel indices, daily task progress, and custom decision text; preset options translate by stable scene and option index. New adventures and duel progress exist only in page memory; invitation links do not encode either game state or custom candidates.

Activity is administrator-only at `/admin` (legacy `/stats` is equally protected), over the last 7/30/90 UTC+8 dates. Page views and clicks are separate events. Counters group by date, event kind, source page, sanitized destination URL, action category, and language. Only known page paths, the public `/dispatch?level=return|market` slugs, and public result IDs/version are retained in URLs; arbitrary query strings, fragments, IPs, identities, and input text are not stored by the application. The hosting platform may separately keep access logs. Aggregate rows currently have no automatic retention expiry. No unique visitor or fraud-proof claim: repeated clicks count; blocking/network errors can drop events. The stats page does not generate usage events about itself. Totals include all rows in the selected period; detail display is limited to 200 rows. Verification clicks after release are real counted events.

Daily missions still reset at UTC+8 midnight in every language. Task date, task IDs, swap count, completion-today IDs and unique booklet IDs stay in the existing browser-local task record; no angle choice is saved, and nothing syncs across devices. Persona answers, life adventures, and choice-duel progress stay in page memory. Clipboard fallback selects the current text. Native mobile sharing remains dependent on the device and browser.

## Publish

Use the existing `.openai/hosting.json` project. Open source through Sites workflow, build/test, push exact source, package, save the matching version, deploy with the existing public audience. Never create a replacement site. Keep local checks and actual production/D1 verification separate. Legacy `/capability.html` and `/tool-test.html` remain available but are outside the product navigation.

## Administrator access

Protected pages and `/api/stats` require both Sites-injected identity headers and an exact email match against server-only secret `ADMIN_EMAIL`. The allowlist is set from the confirmed Site owner; another signed-in visitor is rejected. No admin links appear in public navigation. Sign-in uses the platform-owned `/signin-with-chatgpt` route; public games and event submission remain anonymous. Runtime secrets are configured in Sites, never source.

## Crawlable pages

`page-content.mjs` shares public descriptions, instructions, FAQ and document copy between initial HTML and browser rendering. The build emits ten routes in four languages, each with one H1, its own title/description, canonical, reciprocal hreflang and OG text. Chinese canonical addresses omit `lang=zh`; other locales keep their query. `/sitemap.xml` contains those 40 canonical URLs. `/robots.txt` links it without blocking access to noindex responses. Result links, protected admin, APIs and legacy tests are excluded from indexing; invalid result IDs/versions and unknown paths return genuine 404. Existing `.html` and trailing-slash public aliases redirect permanently while preserving query parameters. No JavaScript is needed to read the initial purpose, steps, FAQ or game links.

Search Console account verification and indexing are not yet confirmed. No verification value or support email is invented. Contact currently explains how early testers can send feedback through the person who shared the site; a direct public support channel remains a launch input. OG images and downloadable result images belong to the following delivery stage.
