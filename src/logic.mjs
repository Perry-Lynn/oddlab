export function calculatePersona(answers, pack, set = 0) {
  const questions = set ? pack.questions2 : pack.questions;
  const tiebreakOrder = set ? pack.tiebreakOrder2 : pack.tiebreakOrder;
  if (answers.length !== questions.length || answers.some((a, i) => !questions[i].options[a])) throw new Error('请答完所有题目');
  const score = Object.fromEntries(tiebreakOrder.map(k => [k, 0]));
  const hits = { ...score };
  answers.forEach((a, i) => { const o = questions[i].options[a]; score[o.main] += 2; score[o.sub] += 1; hits[o.main]++; });
  return [...tiebreakOrder].sort((a, b) => score[b] - score[a] || hits[b] - hits[a] || tiebreakOrder.indexOf(a) - tiebreakOrder.indexOf(b))[0];
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
    todayDoneIds: sameDay && Array.isArray(saved.todayDoneIds) ? [...new Set(saved.todayDoneIds.filter(x => ids.has(x)))] : (sameDay && ids.has(saved.todayDoneId) ? [saved.todayDoneId] : []),
    doneIds: valid && Array.isArray(saved.doneIds) ? [...new Set(saved.doneIds.filter(x => ids.has(x)))] : [],
    lastStampDate: valid && typeof saved.lastStampDate === 'string' ? saved.lastStampDate : undefined,
    streak: valid && Number.isInteger(saved.streak) ? Math.max(0, saved.streak) : 0,
    bestStreak: valid && Number.isInteger(saved.bestStreak) ? Math.max(0, saved.bestStreak) : 0,
    weekStart: valid && typeof saved.weekStart === 'string' ? saved.weekStart : undefined,
    weekDays: valid && Array.isArray(saved.weekDays) ? [...new Set(saved.weekDays.filter(d => typeof d === 'string'))] : [] };
}
export const WEEK_GOAL = 3;
export function addDays(date, delta) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10); }
export function mondayOf(date) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
export function stampStreak(saved, date = beijingDate()) {
  const prev = saved && typeof saved === 'object' ? saved : {};
  const last = prev.lastStampDate, streak = Number.isInteger(prev.streak) ? prev.streak : 0, best = Number.isInteger(prev.bestStreak) ? Math.max(prev.bestStreak, streak) : streak;
  if (last === date) return { lastStampDate: date, streak, bestStreak: best };
  const next = last === addDays(date, -1) ? streak + 1 : 1;
  return { lastStampDate: date, streak: next, bestStreak: Math.max(best, next) };
}
export function stampWeek(saved, date = beijingDate()) {
  const prev = saved && typeof saved === 'object' ? saved : {};
  const week = mondayOf(date);
  const days = prev.weekStart === week && Array.isArray(prev.weekDays) ? [...new Set(prev.weekDays.filter(d => typeof d === 'string'))] : [];
  if (!days.includes(date)) days.push(date);
  return { weekStart: week, weekDays: days };
}
export function streakView(saved, date = beijingDate()) {
  const prev = saved && typeof saved === 'object' ? saved : {};
  const last = prev.lastStampDate, streak = Number.isInteger(prev.streak) ? prev.streak : 0, best = Number.isInteger(prev.bestStreak) ? Math.max(prev.bestStreak, streak) : streak;
  return { current: (last === date || last === addDays(date, -1)) ? streak : 0, best };
}
export function weekView(saved, date = beijingDate()) {
  const prev = saved && typeof saved === 'object' ? saved : {};
  const week = mondayOf(date);
  return prev.weekStart === week && Array.isArray(prev.weekDays) ? [...new Set(prev.weekDays.filter(d => typeof d === 'string'))] : [];
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
