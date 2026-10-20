// Static GitHub Pages build.
//
// Emits dist-pages/ as a base-path-safe static site: every public route becomes a
// directory with its own index.html, so https://<owner>.github.io/<repo>/dispatch/
// works on direct open and refresh without any server-side rewrite.
//
// Environment:
//   ODDLAB_BASE         deploy sub-path, default /oddlab/ (must match the repo name)
//   ODDLAB_ORIGIN       site origin used for canonical/OG/sitemap, e.g. https://owner.github.io
//   ODDLAB_DEFAULT_LANG default language for the entry page, default zh
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { browserAssets } from './build-inputs.mjs';

// The hosting flags must be set before the shared modules are evaluated, so the
// content modules are loaded with dynamic imports below instead of static ones.
process.env.ODDLAB_PAGES = '1';
process.env.ODDLAB_BASE = process.env.ODDLAB_BASE || '/oddlab/';
process.env.ODDLAB_ORIGIN = (process.env.ODDLAB_ORIGIN || 'http://localhost:8788').replace(/\/+$/, '');
process.env.ODDLAB_DEFAULT_LANG = process.env.ODDLAB_DEFAULT_LANG || 'zh';

const { translateText } = await import('../src/ui-catalog.mjs');
const { dispatchImageAssets } = await import('../src/dispatch-assets.mjs');
const { BASE } = await import('../src/hosting.mjs');
const { publicRoutes, siteOrigin, localeCodes, pageData, canonicalURL, renderInitial, renderGuide, renderDocument, esc } = await import('../src/page-content.mjs');

const out = 'dist-pages';
const locales = ['en', 'zh', 'ja', 'es'];
const base = BASE;
const defaultLang = process.env.ODDLAB_DEFAULT_LANG;
const shell = await readFile('public/index.html', 'utf8');

const written = [];

function localizedShell(lang) { return shell.replace(/>([^<>]+)</g, (all, text) => '>' + translateText(text, lang) + '<').replace(/aria-label="([^"]*)"/g, (all, text) => `aria-label="${esc(translateText(text, lang))}"`).replace(/<html lang="[^"]*"/, `<html lang="${localeCodes[lang]}"`).replace(`value="${lang}"`, `value="${lang}" selected`); }
function head(path, lang) {
 const d = pageData(path, lang), canonical = canonicalURL(path, lang);
 const title = path === '/' ? 'OddLab · ' + ({ en: 'A little odd. A little joy.', zh: '今天，来点不一样的。', ja: '日常に小さな驚きを。', es: 'Un poco peculiar. Un poco de alegría.' })[lang] : d.title + ' · OddLab';
 return `<title>${esc(title)}</title><meta name="description" content="${esc(d.description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${esc(canonical)}">${locales.map(l => `<link rel="alternate" hreflang="${l === 'zh' ? 'zh-Hans' : l}" href="${esc(canonicalURL(path, l))}">`).join('')}<link rel="alternate" hreflang="x-default" href="${esc(canonicalURL(path, defaultLang))}"><meta property="og:type" content="website"><meta property="og:site_name" content="OddLab"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(d.description)}"><meta property="og:url" content="${esc(canonical)}"><meta name="twitter:card" content="summary">`;
}
// Classic inline script: runs before the deferred module bundle, so the browser
// modules see the hosting flags on their very first evaluation.
function globals() { return `<script>window.ODDLAB_PAGES=true;window.ODDLAB_DEFAULT_LANG='${defaultLang}';window.ODDLAB_STATS=false;</script>`; }
// The flags go right after the charset declaration so they stay inside <head>,
// keep <!doctype html> as the very first token, and still run before the deferred
// module bundle. Injection happens after shell localization so the script text is
// never treated as translatable page copy.
function withFlags(html) { return html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">' + globals()); }
// Prefix every root-absolute href/src with the deploy base. Absolute URLs emitted
// by page-content (canonical, OG, cross-links) start with a scheme and stay as-is.
function withBase(html) { return html.replace(/\b(href|src)="\/(?!\/)/g, (all, attr) => `${attr}="${base}`); }
function footer(html, lang) { return html.replace('</div></footer>', `<a href="${canonicalURL('/terms', lang)}">${esc(pageData('/terms', lang).title)}</a><a href="${canonicalURL('/contact', lang)}">${esc(pageData('/contact', lang).title)}</a></div></footer>`); }

async function write(path, body) { const file = join(out, path); await mkdir(join(file, '..'), { recursive: true }); await writeFile(file, body); written.push(path); }

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const route of publicRoutes) {
 const lang = defaultLang;
 const isDocument = ['/about', '/privacy', '/terms', '/contact'].includes(route);
 const html = withBase(withFlags(localizedShell(lang)))
  .replace(/<title>.*?<\/title>/, '')
  .replace(/<meta name="description"[^>]*>/, head(route, lang))
  .replace(/<main id="app">[\s\S]*?<\/main>/, `<main id="app">${isDocument ? renderDocument(route, lang) : renderInitial(route, lang)}</main><div id="page-guide">${renderGuide(route, lang)}</div>`);
 await write(route === '/' ? 'index.html' : `${route.slice(1)}/index.html`, footer(html, lang));
}

// GitHub Pages serves this for every unmapped path with the original URL intact,
// so the router still sees the real path and renders its own not-found view.
const notFound = withBase(withFlags(localizedShell(defaultLang))).replace(/<title>.*?<\/title>/, '<title>404 · OddLab</title>').replace(/(<meta name="description"[^>]*>)/, '$1<meta name="robots" content="noindex,follow">');
await write('404.html', notFound);

for (const {file, source} of browserAssets) {
 await copyFile(source, join(out, file));
 written.push(file);
}
for (const lang of locales) { await mkdir(join(out, 'locales'), { recursive: true }); await copyFile(`public/locales/${lang}.json`, join(out, 'locales', `${lang}.json`)); written.push(`locales/${lang}.json`); }
for (const image of dispatchImageAssets) { await mkdir(join(out, image.path, '..'), { recursive: true }); await copyFile(join('public', image.file), join(out, image.path)); written.push(image.path); }

await write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + publicRoutes.flatMap(path => locales.map(lang => `<url><loc>${esc(canonicalURL(path, lang))}</loc></url>`)).join('') + '</urlset>');
await write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}${base}sitemap.xml\n`);
// Bypass Jekyll so GitHub Pages serves the directory index files untouched.
await write('.nojekyll', '');

console.log(`Built ${out}/ : ${publicRoutes.length} crawlable routes in ${defaultLang}, ${locales.length} locale packs, ${dispatchImageAssets.length} images, sitemap and robots under base ${base}.`);
console.log(`Routes: ${written.filter(path => path.endsWith('index.html')).join(', ')}`);
