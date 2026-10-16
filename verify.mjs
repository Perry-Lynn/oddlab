import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { calculatePersona, beijingDate, dailyTask, taskState, pickLife, normalizeChoices, resolveLife } from './logic.mjs';
const pack = n => JSON.parse(readFileSync(new URL('./data/'+n+'.json',import.meta.url),'utf8'));
const p=pack('persona'),t=pack('task'),l=pack('life'),counts={};
for(let n=0;n<4096;n++){let x=n;const answers=Array.from({length:6},()=>{const a=x%4;x=Math.floor(x/4);return a;});const d=calculatePersona(answers,p);counts[d]=(counts[d]||0)+1;}
assert.deepEqual(counts,{D1:641,D2:577,D3:568,D4:527,D5:442,D6:449,D7:455,D8:437});
assert.equal(beijingDate(new Date('2026-10-16T15:59:59Z')),'2026-10-16');
assert.equal(beijingDate(new Date('2026-10-16T16:00:00Z')),'2026-10-17');
assert.equal(dailyTask(t,'2026-10-16').id,'task-19');
assert.equal(dailyTask({...t,tasks:[...t.tasks].reverse()},'2026-10-16').id,'task-19');
const next=taskState({date:'2026-10-16',rotationVersion:'v1',currentTaskId:'task-05',swapsUsed:2,doneIds:['task-19']},t,'2026-10-17');
assert.equal(next.currentTaskId,'task-20');assert.equal(next.swapsUsed,0);assert.deepEqual(next.doneIds,['task-19']);
const corrupt=taskState({date:'2026-10-16',rotationVersion:'v1',currentTaskId:'bad',swapsUsed:-1,doneIds:['bad']},t,'2026-10-16');
assert.equal(corrupt.currentTaskId,'task-19');assert.equal(corrupt.swapsUsed,0);assert.deepEqual(corrupt.doneIds,[]);
for(const theme of Object.keys(l.themes)){const seen=[];for(let i=0;i<3;i++){const r=pickLife(l,theme,seen,i,()=>0);assert.equal(r.theme,theme);assert(!seen.includes(r.id));seen.push(r.id);}}
assert.equal(resolveLife(l,'life-03','1').fields.title,'外卖备注艺术家');
assert.equal(resolveLife(l,'life-03','99'),null);assert.equal(resolveLife(l,'missing','1'),null);
assert.equal(resolveLife({...l,templates:l.templates.map(t=>({...t,status:'retired'}))},'life-03','1'),null);
assert.deepEqual(normalizeChoices(' 茶\n茶\n\n咖啡 '),['茶','咖啡']);
console.log(JSON.stringify({personaPaths:4096,counts,beijingMidnight:true,taskPersistence:true,lifeThemeAndRepeat:true,versionFallback:true,choiceNormalization:true}));
