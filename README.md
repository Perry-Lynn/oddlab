# OddLab · Four little experiments

English by default, with Simplified Chinese, Japanese, and Spanish. Reuses the existing Sites project and public URL. Four games still run locally; a small Worker/D1 service persists aggregate activity.

## Source and build

- `app.js`, `logic.mjs`: four games, result restoration, UTC+8 missions, clipboard/share fallbacks.
- `i18n.mjs`: UI catalog and language preference/query handling. `locales/{en,zh,ja,es}.json`: complete localized content packs. All IDs, scoring, versions, and task rotation remain consistent. Edit the committed locale packs together when changing content; the build does not silently overwrite them from the parent folder.
- `analytics.mjs`: page views and real UI clicks; never reads answer choices, form contents, or browser identifiers.
- `worker/runtime.mjs`: public assets and `/api/track`, `/api/stats`. `prepare.mjs` generates `worker/index.js` with embedded assets.
- `db/schema.ts`, `drizzle/`: D1 schema and versioned migrations. The request handler never creates tables. Sites provisions binding `DB` and applies packaged migrations.

With Node 24+: `node prepare.mjs && bash scripts/build.sh && node scripts/validate-artifact.mjs`. Tests: `node verify.mjs && node verify-server.mjs`. The second test uses actual in-memory SQLite through a D1-compatible adapter. `node scripts/preview.mjs` serves port 8765 with a separate SQLite file in `/private/tmp`; local data is never deployed. Dev-only drizzle tooling is locked in `pnpm-lock.yaml`; runtime has no package dependencies.

The Worker ESM build emits `dist/server/index.js` and `dist/.openai/hosting.json`. The Sites packaging helper copies root `drizzle/` to `dist/.openai/drizzle/`. Keep deployed migration files immutable; generate a new migration for future schema changes.

## Language and data behavior

`?lang=en|zh|ja|es` overrides the saved language preference. Links carry language even when localStorage is denied. Changing language preserves the current quiz answers, public result ID, life theme, daily progress, and custom decision list; untouched preset lists translate. Shared results display in the link’s language. Custom lists stay in the page and never enter share URLs or analytics.

Activity is administrator-only at `/admin` (legacy `/stats` is equally protected), over the last 7/30/90 UTC+8 dates. Page views and clicks are separate events. Counters group by date, event kind, source page, sanitized destination URL, action category, and language. Only known page paths and public result IDs/version are retained in URLs; arbitrary query strings, fragments, IPs, identities, and input text are not stored by the application. The hosting platform may separately keep access logs. Aggregate rows currently have no automatic retention expiry. No unique visitor or fraud-proof claim: repeated clicks count; blocking/network errors can drop events. The stats page does not generate usage events about itself. Totals include all rows in the selected period; detail display is limited to 200 rows. Verification clicks after release are real counted events.

Daily missions still reset at UTC+8 midnight in every language. Progress and language preference are browser-local; no account or cross-device sync. Clipboard fallback selects the current text. Native mobile sharing remains dependent on the device and browser.

## Publish

Use the existing `.openai/hosting.json` project. Open source through Sites workflow, build/test, push exact source, package, save the matching version, deploy with the existing public audience. Never create a replacement site. Keep local checks and actual production/D1 verification separate. Legacy `/capability.html` and `/tool-test.html` remain available but are outside the product navigation.

## Administrator access

Protected pages and `/api/stats` require both Sites-injected identity headers and an exact email match against server-only secret `ADMIN_EMAIL`. The allowlist is set from the confirmed Site owner; another signed-in visitor is rejected. No admin links appear in public navigation. Sign-in uses the platform-owned `/signin-with-chatgpt` route; public games and event submission remain anonymous. Runtime secrets are configured in Sites, never source.
