export function calculatePersona(answers, pack) {
  if (answers.length !== pack.questions.length || answers.some((a, i) => !pack.questions[i].options[a])) throw new Error('请答完所有题目');
  const score = Object.fromEntries(pack.tiebreakOrder.map(k => [k, 0]));
  const hits = { ...score };
  answers.forEach((a, i) => { const o = pack.questions[i].options[a]; score[o.main] += 2; score[o.sub] += 1; hits[o.main]++; });
  return [...pack.tiebreakOrder].sort((a, b) => score[b] - score[a] || hits[b] - hits[a] || pack.tiebreakOrder.indexOf(a) - pack.tiebreakOrder.indexOf(b))[0];
}
export function beijingDate(now = new Date()) { return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10); }
export function dailyTask(pack, date = beijingDate()) {
  const order = pack.rotation.order;
  const day = Math.floor((Date.parse(date + 'T00:00:00Z') - Date.parse(pack.rotation.baselineDate + 'T00:00:00Z')) / 86400000);
  const index = ((day % order.length) + order.length) % order.length;
  for (let i = 0; i < order.length; i++) {
    const t = pack.tasks.find(t => t.id === order[(index + i) % order.length] && t.status === 'published');
    if (t) return t;
  }
  return pack.tasks.find(t => t.status === 'published');
}
export function taskState(saved, pack, date = beijingDate()) {
  const ids = new Set(pack.tasks.filter(t => t.status === 'published').map(t => t.id));
  const valid = saved && typeof saved === 'object' && !Array.isArray(saved);
  const sameDay = valid && saved.date === date && saved.rotationVersion === pack.rotation.version;
  return { date, rotationVersion: pack.rotation.version, currentTaskId: sameDay && ids.has(saved.currentTaskId) ? saved.currentTaskId : dailyTask(pack, date).id,
    swapsUsed: sameDay && Number.isInteger(saved.swapsUsed) ? Math.max(0, Math.min(2, saved.swapsUsed)) : 0,
    doneIds: valid && Array.isArray(saved.doneIds) ? [...new Set(saved.doneIds.filter(x => ids.has(x)))] : [] };
}
export function randomOne(items, random = Math.random) { return items[Math.floor(random() * items.length)]; }
export function pickLife(pack, theme, seen = [], drawCount = 0, random = Math.random) {
  const selectedTheme = theme === 'random' ? randomOne(Object.keys(pack.themes), random) : theme;
  let pool = pack.templates.filter(t => t.theme === selectedTheme && t.status === 'published' && t.fields?.title && t.fields?.skill && t.fields?.twist && t.fields?.ending && t.fields?.comment);
  if (drawCount < 3) { const fresh = pool.filter(t => !seen.includes(t.id)); if (fresh.length) pool = fresh; }
  return randomOne(pool, random);
}
export function normalizeChoices(text) { return [...new Set(text.split(/\r?\n/).map(x => x.trim()).filter(Boolean))]; }
export function resolveLife(pack, id, version) {
  const t = pack.templates.find(t => t.id === id);
  if (!t || t.status === 'retired') return null;
  if (!version || String(t.entryVersion) === version) return t;
  const old = t.history?.find(h => String(h.entryVersion) === version);
  return old ? { ...t, entryVersion: old.entryVersion, fields: old.fields } : null;
}
