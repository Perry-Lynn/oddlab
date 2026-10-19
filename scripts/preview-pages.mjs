// Local static preview for the GitHub Pages build: serves dist-pages/ under
// /oddlab/ so the sub-path behaviour can be checked before deploying.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist-pages/', import.meta.url)));
const base = process.env.ODDLAB_BASE || '/oddlab/';
const port = Number(process.env.ODDLAB_PORT || 8788);

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

function safe(rel) { const target = resolve(root, rel.replace(/^\/+/, '')); return target === root || target.startsWith(root + sep) ? target : null; }

async function resolveFile(pathname) {
 if (!pathname.startsWith(base)) return null;
 let rel = pathname.slice(base.length);
 try { rel = decodeURIComponent(rel); } catch { return null; }
 if (rel === '') rel = 'index.html';
 const candidates = rel.endsWith('/') ? [rel + 'index.html'] : [rel, rel + '/index.html'];
 for (const candidate of candidates) {
  const target = safe(candidate);
  if (!target) continue;
  try { if ((await stat(target)).isFile()) return target; } catch {}
 }
 return null;
}

http.createServer(async (req, res) => {
 try {
  const url = new URL(req.url, 'http://127.0.0.1');
  const file = await resolveFile(url.pathname);
  if (file) { res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(await readFile(file)); return; }
  const fallback = safe('404.html');
  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(fallback ? await readFile(fallback) : 'Not found');
 } catch { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Preview error'); }
}).listen(port, '127.0.0.1', () => console.log(`Static Pages preview http://127.0.0.1:${port}${base}`));
