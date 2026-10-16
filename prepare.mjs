import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, '.openai/hosting.json'), 'utf8'));
if (manifest.static?.directory !== 'dist') throw new Error('静态部署目录必须为 dist');
mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const name of ['index.html', 'tool-test.html']) {
  const html = readFileSync(path.join(root, name), 'utf8');
  if (!html.includes('<html lang="zh-CN">')) throw new Error(`${name} 缺少页面主体`);
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    new Script(script[1], { filename: name });
  }
  writeFileSync(path.join(root, 'dist', name), html);
}
console.log('两页语法检查通过；dist 已准备，仅包含两个 HTML 页面。');
