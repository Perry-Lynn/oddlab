import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { calculatePersona, beijingDate, dailyTask, taskState, pickLife, normalizeChoices, resolveLife, addDays, mondayOf, stampStreak, stampWeek, streakView, weekView, WEEK_GOAL } from './logic.mjs';
const pack = n => JSON.parse(readFileSync(new URL('./data/'+n+'.json',import.meta.url),'utf8'));
const p=pack('persona'),t=pack('task'),l=pack('life'),counts={};
for(let n=0;n<4096;n++){let x=n;const answers=Array.from({length:6},()=>{const a=x%4;x=Math.floor(x/4);return a;});const d=calculatePersona(answers,p);counts[d]=(counts[d]||0)+1;}
assert.deepEqual(counts,{D1:641,D2:577,D3:568,D4:527,D5:442,D6:449,D7:455,D8:437});
assert.equal(Object.keys(p.results).length,16);assert.equal(p.questions2.length,6);assert.deepEqual(p.tiebreakOrder2,['D9','D10','D11','D12','D13','D14','D15','D16']);
const reach2=new Set();for(let n=0;n<4096;n++){let x=n;const a=Array.from({length:6},()=>{const o=x%4;x=Math.floor(x/4);return o;});reach2.add(calculatePersona(a,p,1));}
assert.deepEqual([...reach2].sort(),['D9','D10','D11','D12','D13','D14','D15','D16'].sort());
assert.equal(beijingDate(new Date('2026-10-16T15:59:59Z')),'2026-10-16');
assert.equal(beijingDate(new Date('2026-10-16T16:00:00Z')),'2026-10-17');
assert.equal(dailyTask(t,'2026-10-16').id,'task-19');
assert.equal(dailyTask({...t,tasks:[...t.tasks].reverse()},'2026-10-16').id,'task-19');
const next=taskState({date:'2026-10-16',rotationVersion:'v1',currentTaskId:'task-05',swapsUsed:2,doneIds:['task-19']},t,'2026-10-17');
assert.equal(next.currentTaskId,'task-20');assert.equal(next.swapsUsed,0);assert.deepEqual(next.doneIds,['task-19']);
const corrupt=taskState({date:'2026-10-16',rotationVersion:'v1',currentTaskId:'bad',swapsUsed:-1,doneIds:['bad']},t,'2026-10-16');
assert.equal(corrupt.currentTaskId,'task-19');assert.equal(corrupt.swapsUsed,0);assert.deepEqual(corrupt.doneIds,[]);
assert.equal(mondayOf('2026-10-20'),'2026-10-19');assert.equal(addDays('2026-10-19',-1),'2026-10-18');
const s1=stampStreak({},'2026-10-19');assert.equal(s1.streak,1);assert.equal(s1.bestStreak,1);assert.equal(s1.lastStampDate,'2026-10-19');
const s2=stampStreak(s1,'2026-10-19');assert.equal(s2.streak,1,'same-day stamp does not extend the streak');
const s3=stampStreak(s2,'2026-10-20');assert.equal(s3.streak,2);assert.equal(s3.bestStreak,2);
const s4=stampStreak(s3,'2026-10-22');assert.equal(s4.streak,1,'a gap resets the streak');assert.equal(s4.bestStreak,2,'best streak is retained');
assert.deepEqual(streakView(s3,'2026-10-20'),{current:2,best:2});assert.deepEqual(streakView(s3,'2026-10-21'),{current:2,best:2});assert.deepEqual(streakView(s3,'2026-10-22'),{current:0,best:2});
const w1=stampWeek({},'2026-10-19');assert.deepEqual(w1.weekDays,['2026-10-19']);
const w2=stampWeek(w1,'2026-10-20');assert.deepEqual(w2.weekDays,['2026-10-19','2026-10-20']);
assert.deepEqual(stampWeek(w2,'2026-10-20').weekDays,['2026-10-19','2026-10-20'],'the same day counts once');
assert.deepEqual(stampWeek(w2,'2026-10-26').weekDays,['2026-10-26'],'a new week resets the count');
assert.equal(WEEK_GOAL,3);assert.deepEqual(weekView(w2,'2026-10-20'),['2026-10-19','2026-10-20']);assert.deepEqual(weekView(w2,'2026-10-26'),[]);
for(const theme of Object.keys(l.themes)){const seen=[];for(let i=0;i<3;i++){const r=pickLife(l,theme,seen,i,()=>0);assert.equal(r.theme,theme);assert(!seen.includes(r.id));seen.push(r.id);}}
assert.equal(resolveLife(l,'life-03','1').fields.title,'外卖备注艺术家');
assert.equal(resolveLife(l,'life-03','99'),null);assert.equal(resolveLife(l,'missing','1'),null);
assert.equal(resolveLife({...l,templates:l.templates.map(t=>({...t,status:'retired'}))},'life-03','1'),null);
assert.deepEqual(normalizeChoices(' 茶\n茶\n\n咖啡 '),['茶','咖啡']);
console.log(JSON.stringify({personaPaths:4096,counts,beijingMidnight:true,taskPersistence:true,lifeThemeAndRepeat:true,versionFallback:true,choiceNormalization:true}));
