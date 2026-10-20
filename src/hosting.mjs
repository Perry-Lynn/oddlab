// Shared deploy-base helpers. This module is imported by the browser bundle, the
// Node build scripts, and the Sites Worker bundle, so it must stay dependency-free.
//
// Static hosting exposes every route as its own directory with an index.html, and a
// GitHub project site lives under /<repo>/. The base path is therefore derived at
// runtime from this module's own URL (import.meta.url) instead of a build constant:
// served as /app.js -> base "/", served as /oddlab/app.js -> base "/oddlab/".
const browser = typeof window !== 'undefined';

function normalizeBase(value) {
  const text = String(value ?? '');
  const withLeading = text.startsWith('/') ? text : '/' + text;
  return withLeading.endsWith('/') ? withLeading : withLeading + '/';
}

export const BASE = browser
  ? new URL('.', import.meta.url).pathname
  : normalizeBase(process.env.ODDLAB_BASE || '/');

export const PAGES = browser
  ? window.ODDLAB_PAGES === true
  : process.env.ODDLAB_PAGES === '1';

export const DEFAULT_LANG = browser
  ? window.ODDLAB_DEFAULT_LANG || 'zh'
  : process.env.ODDLAB_DEFAULT_LANG || 'zh';

export const SITE_ORIGIN = browser
  ? location.origin
  : String(process.env.ODDLAB_ORIGIN || 'https://oddlab-capability-check.fpyvip.chatgpt.site').replace(/\/+$/, '');

// A public route as a link target. The Sites Worker keeps clean, extensionless
// paths; the static GitHub Pages build needs a trailing slash so that directory
// index.html files are served without a server-side rewrite.
export function link(path) {
  const clean = String(path ?? '').replace(/^\/+|\/+$/g, '');
  if (!PAGES) return clean ? '/' + clean : '/';
  return clean ? BASE + clean + '/' : BASE;
}

// A static asset path (script, stylesheet, locale pack, image) resolved against BASE.
export function asset(path) {
  return BASE + String(path ?? '').replace(/^\/+/, '');
}

// Route name for the current document, base path and .html aliases removed.
export function currentRoute(pathname) {
  const raw = String(pathname ?? (browser ? location.pathname : '/'));
  const base = BASE.replace(/\/+$/, '');
  const path = raw.replace(/\/+$/, '') || '/';
  if (path === (base || '/')) return 'index';
  const rest = base && path.startsWith(base + '/') ? path.slice(base.length + 1) : path;
  const clean = rest.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
  return clean || 'index';
}
