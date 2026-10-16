import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'dist');
await mkdir(out, { recursive: true });
await mkdir(path.join(root, 'data'), { recursive: true });
await mkdir(path.join(out, 'data'), { recursive: true });
for (const game of ['persona', 'life', 'task', 'choice']) {
  const local = path.join(root, 'data', game + '.json');
  try { await copyFile(path.join(root, '..', '内容包', game + '.json'), local); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  JSON.parse(await readFile(local, 'utf8'));
  await copyFile(local, path.join(out, 'data', game + '.json'));
}
const shell = await readFile(path.join(root, 'index.html'), 'utf8');
const pages = { index: ['脑洞研究所 OddLab · 今天，来点不一样的。', '每天花一分钟，发现一点不一样的乐趣。离谱人格、平行人生、随机选择与今日奇怪任务，打开即玩。'], persona: ['你的离谱人格 · 脑洞研究所', '6 道题，认识你的另一面。纯属娱乐，离谱但有点像你。'], life: ['平行人生模拟器 · 脑洞研究所', '去另一个世界上个班，抽取一份意想不到的人生。'], choice: ['今天听天由命 · 脑洞研究所', '吃什么，做什么？把小纠结交给随机，支持自定义选项。'], task: ['今日奇怪任务 · 脑洞研究所', '花一分钟，做件没什么用但有点开心的小事。'], about: ['关于实验室 · 脑洞研究所', '一个专门制造小惊喜的网站。'], privacy: ['隐私说明 · 脑洞研究所', '了解脑洞研究所如何处理输入与本地任务进度。'] };
for (const [name, [title, description]] of Object.entries(pages)) await writeFile(path.join(out, name + '.html'), shell.replace(/<title>.*?<\/title>/, `<title>${title}</title>`).replace('每天花一分钟，发现一点不一样的乐趣。', description));
for (const name of ['app.js', 'logic.mjs', 'style.css', 'favicon.svg', 'capability.html', 'tool-test.html']) await copyFile(path.join(root, name), path.join(out, name));
console.log('已准备首页、四玩法、说明页与真实内容包。');
