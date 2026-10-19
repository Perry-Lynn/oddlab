// Static path verification for the GitHub Pages build.
//
// Runs against a previously produced dist-pages/ directory (npm run build:pages)
// and checks the things a sub-directory static host can break: the deploy base,
// per-route index.html files, canonical/OG/sitemap URLs and the disabled backend.
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

process.env.ODDLAB_PAGES = '1';
process.env.ODDLAB_BASE = process.env.ODDLAB_BASE || '/oddlab/';
process.env.ODDLAB_ORIGIN = (process.env.ODDLAB_ORIGIN || 'http://localhost:8788').replace(/\/+$/, '');
process.env.ODDLAB_DEFAULT_LANG = process.env.ODDLAB_DEFAULT_LANG || 'zh';

const { link, asset, currentRoute, BASE, PAGES, DEFAULT_LANG } = await import('./hosting.mjs');
const { publicRoutes, canonicalURL, localeCodes } = await import('./page-content.mjs');
const { dispatchImageAssets } = await import('./dispatch-assets.mjs');

const out = 'dist-pages';
const base = process.env.ODDLAB_BASE;
const origin = process.env.ODDLAB_ORIGIN;
const locales = ['en', 'zh', 'ja', 'es'];

// 1. Routing decisions must survive the deploy base path and .html aliases.
assert.equal(BASE, base, 'build-time base path is honoured outside the browser');
assert.equal(PAGES, true);
assert.equal(DEFAULT_LANG, 'zh', 'the competition entry page defaults to Chinese');
const routes = {
 '/': 'index', [`${base}`]: 'index', [`${base}index.html`]: 'index',
 [`${base}dispatch/`]: 'dispatch', [`${base}dispatch`]: 'dispatch',
 [`${base}persona/`]: 'persona', [`${base}life.html`]: 'life',
 [`${base}choice`]: 'choice', [`${base}task/`]: 'task',
 [`${base}about/`]: 'about', '/unrelated/path': 'unrelated/path',
};
for (const [pathname, expected] of Object.entries(routes)) assert.equal(currentRoute(pathname), expected, `route for ${pathname}`);
assert.equal(link('/'), base, 'home link keeps the deploy base');
assert.equal(link('/dispatch'), `${base}dispatch/`, 'route links use a directory index path');
assert.equal(asset('/locales/zh.json'), `${base}locales/zh.json`, 'assets are resolved against the base');
assert.equal(canonicalURL('/dispatch', 'zh'), `${origin}${base}dispatch/`, 'the default locale canonical omits ?lang');
assert.equal(canonicalURL('/dispatch', 'en'), `${origin}${base}dispatch/?lang=en`, 'other locales keep an explicit ?lang');

// 2. Every public route is a real directory with its own index.html.
async function exists(rel) { try { await stat(join(out, rel)); return true; } catch { return false; } }
for (const route of publicRoutes) {
 assert.ok(await exists(route === '/' ? 'index.html' : `${route.slice(1)}/index.html`), `${route} has a static index.html`);
}
for (const file of ['404.html', '.nojekyll', 'sitemap.xml', 'robots.txt', 'app.js', 'hosting.mjs', 'page-content.mjs', 'analytics.mjs', 'dispatch-ui.mjs', 'dispatch-assets.mjs', 'style.css', 'favicon.svg']) assert.ok(await exists(file), `missing ${file}`);
for (const lang of locales) assert.ok(await exists(`locales/${lang}.json`), `missing locale ${lang}`);
for (const image of dispatchImageAssets) assert.ok(await exists(image.path), `missing image ${image.path}`);

// 3. The Pages artifact must not ship admin, stats or the Sites backend.
for (const forbidden of ['stats/index.html', 'admin/index.html', 'capability.html', 'tool-test.html', '.openai', 'worker', 'db', 'drizzle']) assert.ok(!(await exists(forbidden)), `the Pages build must not publish ${forbidden}`);

// 4. Each HTML page carries the base path, the hosting flags and the right canonical.
for (const route of publicRoutes) {
 const html = await readFile(join(out, route === '/' ? 'index.html' : `${route.slice(1)}/index.html`), 'utf8');
 const name = `${route} (${route === '/' ? 'index.html' : route + '/index.html'})`;
 assert.ok(html.startsWith('<!doctype html>'), `${name} keeps the doctype as the first token`);
 assert.ok(html.includes('window.ODDLAB_PAGES=true'), `${name} marks the Pages hosting mode`);
 assert.ok(html.indexOf('window.ODDLAB_PAGES=true') < html.indexOf('</head>'), `${name} injects the hosting flags inside head`);
 assert.ok(html.includes('window.ODDLAB_STATS=false'), `${name} disables /api/track reporting`);
 assert.ok(html.includes(`window.ODDLAB_DEFAULT_LANG='zh'`), `${name} defaults to Chinese`);
 assert.ok(html.includes(`src="${base}app.js"`), `${name} loads the bundle through the base path`);
 assert.ok(html.includes(`href="${base}style.css"`), `${name} loads the stylesheet through the base path`);
 assert.ok(!/(?:href|src)="\/app\.js"/.test(html), `${name} has no root-absolute bundle reference`);
 assert.ok(!/(?:href|src)="\/style\.css"/.test(html), `${name} has no root-absolute stylesheet reference`);
 assert.ok(!/(?:href|src)="\/assets\//.test(html), `${name} has no root-absolute asset reference`);
 assert.ok(html.includes(`<html lang="${localeCodes.zh}"`), `${name} declares the Chinese document language`);
 assert.equal((html.match(/<title>/g) || []).length, 1, `${name} has exactly one title`);
 assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${name} has exactly one h1`);
 assert.equal((html.match(/hreflang=/g) || []).length, 5, `${name} lists five hreflang alternates`);
 assert.ok(html.includes(`<link rel="canonical" href="${canonicalURL(route, 'zh')}"`), `${name} canonical points at the deploy base`);
 assert.ok(html.includes(`<meta property="og:url" content="${canonicalURL(route, 'zh')}"`), `${name} og:url points at the deploy base`);
 assert.ok(!/<a[^>]+href="[^"\s]*\/(?:stats|admin)(?:[?"/])/.test(html), `${name} links no admin or stats page`);
}

// 5. Sitemap, robots and the not-found shell.
const sitemap = await readFile(join(out, 'sitemap.xml'), 'utf8');
assert.equal((sitemap.match(/<loc>/g) || []).length, publicRoutes.length * locales.length);
for (const route of publicRoutes) assert.ok(sitemap.includes(`<loc>${canonicalURL(route, 'zh')}</loc>`), `sitemap lists ${route}`);
for (const [, loc] of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) assert.ok(loc.startsWith(`${origin}${base}`), `sitemap entry ${loc} uses the configured origin and base`);
const robots = await readFile(join(out, 'robots.txt'), 'utf8');
assert.ok(robots.includes(`${origin}${base}sitemap.xml`), 'robots.txt points at the deployed sitemap');
const notFound = await readFile(join(out, '404.html'), 'utf8');
assert.ok(notFound.includes(`src="${base}app.js"`), '404.html loads the router through the base path');
assert.ok(notFound.includes('name="robots" content="noindex,follow"'), '404.html is not indexable');

// 6. The shared analytics module must keep the static-host guard.
const analytics = await readFile('analytics.mjs', 'utf8');
assert.ok(analytics.includes('window.ODDLAB_STATS===false'), 'analytics.mjs short-circuits when the backend is absent');

// 7. The privacy text must describe this static deployment, not the Sites one.
const privacy = await readFile(join(out, 'privacy/index.html'), 'utf8');
assert.ok(privacy.includes('GitHub Pages'), 'the privacy page names the real host');
assert.ok(privacy.includes('/api/track'), 'the privacy page states that no activity events are sent');
assert.ok(!privacy.includes('openai.com/policies'), 'the privacy page drops the Sites-only OpenAI policy link');
assert.ok(!privacy.includes('本站由 ChatGPT Sites 托管'), 'the privacy page no longer describes the Sites host as the deploy target');

console.log(`PASS: ${publicRoutes.length} static routes under ${base}, base-path links/assets/canonical, sitemap, 404 shell, blocked admin/stats and disabled /api/track.`);
