// Source paths are organized by purpose; deployed asset URLs stay stable.
const modules = [
  "app.js",
  "logic.mjs",
  "i18n.mjs",
  "hosting.mjs",
  "ui-catalog.mjs",
  "page-content.mjs",
  "analytics.mjs",
  "games-content.mjs",
  "games-logic.mjs",
  "games-ui.mjs",
  "dispatch-logic.mjs",
  "dispatch-copy.mjs",
  "dispatch-assets.mjs",
  "dispatch-ui.mjs"
];
const staticFiles = ['style.css', 'favicon.svg', 'brand-mark.svg'];

export const browserAssets = [
  ...modules.map(file => ({file, source: `src/${file}`})),
  ...staticFiles.map(file => ({file, source: `public/${file}`})),
];

// These legacy diagnostics belong only to the Worker build, never Pages.
export const legacyAssets = ['capability.html', 'tool-test.html']
  .map(file => ({file, source: `previews/legacy/${file}`}));
