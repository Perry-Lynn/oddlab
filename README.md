# OddLab · Five little experiments

English by default, with Simplified Chinese, Japanese, and Spanish. Reuses the existing Sites project and public URL. Four original games plus Dragon Dispatch run locally; Dispatch has a six-turn first puzzle and an eight-turn return puzzle. A small Worker/D1 service persists aggregate activity.

## Source and build

- `app.js`, `logic.mjs`: the original four games, result restoration, UTC+8 missions, clipboard/share fallbacks. Dragon Dispatch is the home-page lead game.
- `dispatch-logic.mjs`: deterministic first/return routing rules and immutable projections; the return level models cargo responsibility separately from pickup, with delivery-before-pickup settlement and capacity warnings. `dispatch-ui.mjs` and `dispatch-copy.mjs` provide the shared route board, illustrated cargo/places, event-led execution feedback, and four-language interface. The original image prompts, source provenance, output sizes and byte budget are documented in `assets/dispatch/README.md`; `dispatch-assets.mjs` is the four-image public allowlist.
- `ui-catalog.mjs`: pure four-language UI catalog; `i18n.mjs`: browser language preference/query handling. `locales/{en,zh,ja,es}.json`: complete localized content packs. All IDs, scoring, versions, and task rotation remain consistent. Edit the committed locale packs together when changing content; the build does not silently overwrite them from the parent folder.
- `analytics.mjs`: page views and real UI clicks; never reads answer choices, form contents, or browser identifiers.
- `worker/runtime.mjs`: public assets and `/api/track`, `/api/stats`. `prepare.mjs` generates `worker/index.js` with embedded assets; the four versioned WebPs are emitted as base64 source and decoded/cached only for allowlisted image GETs. HEAD keeps an empty body, and other paths use the normal 404 response.
- `db/schema.ts`, `drizzle/`: D1 schema and versioned migrations. The request handler never creates tables. Sites provisions binding `DB` and applies packaged migrations.

With Node 24+: `node prepare.mjs && bash scripts/build.sh && node scripts/validate-artifact.mjs`. Tests: `node verify.mjs && node verify-server.mjs && node verify-pages.mjs && node verify-dispatch.mjs` (also available through `npm test`). The server test uses actual in-memory SQLite through a D1-compatible adapter. `node scripts/preview.mjs` serves port 8765 with a separate SQLite file in `/private/tmp`; local data is never deployed. Dev-only drizzle tooling is locked in `pnpm-lock.yaml`; runtime has no package dependencies.

The Worker ESM build emits `dist/server/index.js` and `dist/.openai/hosting.json`. The Sites packaging helper copies root `drizzle/` to `dist/.openai/drizzle/`. Keep deployed migration files immutable; generate a new migration for future schema changes.

## Language and data behavior

`?lang=en|zh|ja|es` overrides the saved language preference. `/dispatch?level=return` opens the second puzzle; omitting `level` opens the first. Challenge links retain only this public level slug and language, never cargo responsibility, routes, or game state. Links carry language even when localStorage is denied. Changing language preserves the current quiz answers, public result ID, life theme, daily progress, and custom decision list; untouched preset lists translate. Shared results display in the link’s language. Custom lists stay in the page and never enter share URLs or analytics.

Activity is administrator-only at `/admin` (legacy `/stats` is equally protected), over the last 7/30/90 UTC+8 dates. Page views and clicks are separate events. Counters group by date, event kind, source page, sanitized destination URL, action category, and language. Only known page paths, the public `/dispatch?level=return` slug, and public result IDs/version are retained in URLs; arbitrary query strings, fragments, IPs, identities, and input text are not stored by the application. The hosting platform may separately keep access logs. Aggregate rows currently have no automatic retention expiry. No unique visitor or fraud-proof claim: repeated clicks count; blocking/network errors can drop events. The stats page does not generate usage events about itself. Totals include all rows in the selected period; detail display is limited to 200 rows. Verification clicks after release are real counted events.

Daily missions still reset at UTC+8 midnight in every language. Progress and language preference are browser-local; no account or cross-device sync. Clipboard fallback selects the current text. Native mobile sharing remains dependent on the device and browser.

## Publish

Use the existing `.openai/hosting.json` project. Open source through Sites workflow, build/test, push exact source, package, save the matching version, deploy with the existing public audience. Never create a replacement site. Keep local checks and actual production/D1 verification separate. Legacy `/capability.html` and `/tool-test.html` remain available but are outside the product navigation.

## Administrator access

Protected pages and `/api/stats` require both Sites-injected identity headers and an exact email match against server-only secret `ADMIN_EMAIL`. The allowlist is set from the confirmed Site owner; another signed-in visitor is rejected. No admin links appear in public navigation. Sign-in uses the platform-owned `/signin-with-chatgpt` route; public games and event submission remain anonymous. Runtime secrets are configured in Sites, never source.

## Crawlable pages

`page-content.mjs` shares public descriptions, instructions, FAQ and document copy between initial HTML and browser rendering. The build emits ten routes in four languages, each with one H1, its own title/description, canonical, reciprocal hreflang and OG text. English canonical addresses omit `lang=en`; other locales keep their query. `/sitemap.xml` contains those 40 canonical URLs. `/robots.txt` links it without blocking access to noindex responses. Result links, protected admin, APIs and legacy tests are excluded from indexing; invalid result IDs/versions and unknown paths return genuine 404. Existing `.html` and trailing-slash public aliases redirect permanently while preserving query parameters. No JavaScript is needed to read the initial purpose, steps, FAQ or game links.

Search Console account verification and indexing are not yet confirmed. No verification value or support email is invented. Contact currently explains how early testers can send feedback through the person who shared the site; a direct public support channel remains a launch input. OG images and downloadable result images belong to the following delivery stage.
