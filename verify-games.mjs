import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculatePersona, dailyTask, taskState, normalizeChoices } from './logic.mjs';
import { previewPersonaAnswer, adoptPersonaPreview, createAdventure, chooseAdventure, adventureEndingId, undoLastAdventureChoice, createChoiceRound, drawChoicePair, resolveChoicePair, restoreChoiceRound, undoChoiceRound, acceptChoiceRound, taskCompletion } from './games-logic.mjs';
import { adventureContent, taskAnglePair } from './games-content.mjs';
import { renderChoice, renderTasks } from './games-ui.mjs';

const packs=Object.fromEntries(['en','zh','ja','es'].map(lang=>[lang,JSON.parse(fs.readFileSync(`locales/${lang}.json`,'utf8'))]));

// Counterfactual preview stays pure and reuses the unchanged persona scorer.
const persona=packs.zh.persona;
const answers=[0,1,2,3,0,1];
const before=[...answers];
const preview=previewPersonaAnswer(answers,2,0,persona);
assert.deepEqual(answers,before,'preview must not mutate the live answers');
assert.equal(preview.previousId,calculatePersona(answers,persona));
assert.equal(preview.nextId,calculatePersona(preview.proposedAnswers,persona));
assert.notDeepEqual(adoptPersonaPreview(answers,preview),answers,'adoption returns a distinct proposed answer list');
assert.deepEqual(answers,before,'cancel/keep-original leaves answers untouched');
const distribution=Object.fromEntries(persona.tiebreakOrder.map(id=>[id,0]));
for(let bits=0;bits<4096;bits++){
 const sample=Array.from({length:6},(_,q)=>(bits>>(q*2))&3);
 distribution[calculatePersona(sample,persona)]++;
}
assert.deepEqual(distribution,{D1:641,D2:577,D3:568,D4:527,D5:442,D6:449,D7:455,D8:437},'the original 4096-answer result distribution is unchanged');

// All four adventures have eight playable routes, three endings, and reversible final choices.
const adventures=Object.fromEntries(['en','zh','ja','es'].map(lang=>[lang,adventureContent(lang)]));
const endingsSeen=new Set();
for(const lang of ['en','zh','ja','es'])for(const [theme,content] of Object.entries(adventures[lang])){
 const keys=Object.keys(content.endingRoutes);
 assert.equal(keys.length,8,`${lang}/${theme} has all eight three-scene paths`);
 const seen=new Set();
 for(const first of content.scenes[0].choices)for(const second of content.scenes[1].choices)for(const third of content.scenes[2].choices){
  let state=createAdventure(theme);
  for(const [scene,choice] of [[content.scenes[0],first],[content.scenes[1],second],[content.scenes[2],third]]){
   assert.ok(state.resources.time>=Number(choice.cost.time||0),'every path can pay its displayed cost');
   state=chooseAdventure(state,choice,scene);
   assert.ok(state.resources.time>=0&&state.resources.favor>=0,'resource balances never go negative');
  }
  assert.equal(state.history.length,3);
  assert.ok(content.endingRoutes[state.choices.join('|')]);
  seen.add(adventureEndingId(state,content));
  const undone=undoLastAdventureChoice(state);
  assert.equal(undone.stage,2);
  assert.deepEqual(undone.resources,state.history[2].resourcesBefore,'rewind restores pre-final resources without double credit');
  assert.deepEqual(undone.choices,state.choices.slice(0,2));
 }
 assert.equal(seen.size,3,`${lang}/${theme} reaches all three ending types`);
 for(const first of content.scenes[0].choices)for(const second of content.scenes[1].choices){
  let prefix=createAdventure(theme);prefix=chooseAdventure(prefix,first,content.scenes[0]);prefix=chooseAdventure(prefix,second,content.scenes[1]);
  const a=chooseAdventure(prefix,content.scenes[2].choices[0],content.scenes[2]);
  const b=chooseAdventure(prefix,content.scenes[2].choices[1],content.scenes[2]);
  const idA=adventureEndingId(a,content),idB=adventureEndingId(b,content);
  if(idA!==idB)seen.add(`third-choice:${first.id}|${second.id}`);
 }
 assert.ok([...seen].some(id=>String(id).startsWith('third-choice:')),`${lang}/${theme} has a prefix where the last choice changes the ending`);
 for(const id of Object.keys(content.endings))endingsSeen.add(`${theme}:${id}`);
}
assert.equal(endingsSeen.size,12,'all twelve theme-specific endings exist');
for(const lang of ['en','zh','ja','es']){
 const theme='modern';
 const routes=adventures[lang][theme].endingRoutes;
 assert.notEqual(routes['save|read|shelf'],routes['share|read|shelf'],'first-scene choices can change an ending');
 assert.notEqual(routes['save|read|shelf'],routes['save|ask|shelf'],'second-scene choices can change an ending');
}

// Pairwise choice rounds preserve stable indices, support 2 and 16 entries, and can recover from dropping everything.
const pair2=createChoiceRound(['tea','soup']);
const drawn2=drawChoicePair(pair2,()=>0);
assert.deepEqual(drawn2.pair,[0,1]);
const kept=resolveChoicePair(drawn2,0);
assert.deepEqual(kept.active,[0]);
assert.equal(acceptChoiceRound(kept).result.text,'tea');
const pair16=createChoiceRound(Array.from({length:16},(_,i)=>`candidate-${i}`));
assert.equal(pair16.original.length,16);
assert.throws(()=>createChoiceRound(Array.from({length:17},(_,i)=>String(i))),/2–16/);
const none=resolveChoicePair(drawChoicePair(createChoiceRound(['left','right']),()=>0),null);
assert.deepEqual(none.active,[]);
assert.equal(restoreChoiceRound(none).active.length,2);
assert.equal(restoreChoiceRound(none).records.length,0,'restoring candidates clears the old round log');
assert.deepEqual(undoChoiceRound(kept).active,[0,1]);
const presetScenes=packs.en.choice.scenes.map(scene=>scene.id);
for(const lang of ['en','zh','ja','es']){
 const sceneIds=packs[lang].choice.scenes.map(scene=>scene.id);
 assert.deepEqual(sceneIds,presetScenes,'preset scenes retain stable IDs in every locale');
 for(let i=0;i<packs[lang].choice.scenes.length;i++){
  const scene=packs[lang].choice.scenes[i];
  assert.equal(scene.options.length,packs.en.choice.scenes[i].options.length,'preset option indices stay aligned across locales');
  assert.ok(scene.options.every(option=>typeof option.text==='string'));
 }
}
const custom='</textarea><script>private-list</script>';
const rendered=renderChoice({lang:'en',scenes:packs.en.choice.scenes,sceneId:'eat',mode:'quick',items:normalizeChoices(custom+'\nsecond'),text:custom+'\nsecond',round:null,quickResult:null,quickExcluded:[],quickAccepted:false,busy:false,overLimit:false});
assert.ok(rendered.includes('&lt;/textarea&gt;&lt;script&gt;private-list&lt;/script&gt;'));
assert.ok(rendered.includes('data-no-translate'));
assert.ok(rendered.includes('data-experiment-action="choice-draw"'));
const allExcluded=renderChoice({lang:'en',scenes:packs.en.choice.scenes,sceneId:'eat',mode:'quick',items:['left'],text:'left',round:null,quickResult:null,quickExcluded:[0],quickAccepted:false,busy:false,overLimit:false});
assert.ok(allExcluded.includes('data-experiment-action="choice-restore"'));
assert.match(allExcluded,/Candidates remaining: 0/,'remaining count uses a neutral noun phrase');

// Every mission has two localized approaches. Completion stays idempotent and old saved formats migrate in place.
const ids=packs.zh.task.tasks.filter(task=>task.status==='published').map(task=>task.id);
assert.equal(ids.length,30);
for(const id of ids)for(const lang of ['en','zh','ja','es']){
 const pair=taskAnglePair(lang,id);
 assert.equal(pair.length,2,`${lang}/${id} has two angles`);
 assert.ok(pair.every(text=>typeof text==='string'&&text.trim().length>10));
}
assert.match(taskAnglePair('zh','task-01')[0],/悬疑/);
assert.match(taskAnglePair('zh','task-01')[1],/爱情/);
assert.match(taskAnglePair('en','task-07')[0],/Awards/);
assert.match(taskAnglePair('en','task-07')[1],/News/);
assert.match(taskAnglePair('en','task-23')[0],/Museum/);
assert.match(taskAnglePair('en','task-23')[1],/Field notes/);
const stamped=taskCompletion({date:'2026-10-19',doneIds:['task-01']},'task-01');
assert.deepEqual(stamped.doneIds,['task-01'],'trying the second angle cannot stamp the same task twice');
const savedOld={date:'2026-10-19',rotationVersion:packs.zh.task.rotation.version,currentTaskId:'task-19',swapsUsed:1,doneIds:['task-01']};
const migrated=taskState(savedOld,packs.zh.task,'2026-10-19');
assert.deepEqual(migrated.todayDoneIds,[],'old saved records without todayDoneIds remain valid');
assert.deepEqual(migrated.doneIds,['task-01']);
assert.equal(migrated.swapsUsed,1,'legacy same-day swap count is preserved');
assert.equal(taskState({...savedOld,swapsUsed:9},packs.zh.task,'2026-10-19').swapsUsed,2,'daily swaps remain capped at two');
const completed=taskCompletion(migrated,'task-19');completed.todayDoneIds=['task-19'];
const repeated=taskCompletion(completed,'task-19');
assert.deepEqual(repeated.doneIds,['task-01','task-19']);
const nextDay=taskState(repeated,packs.zh.task,'2026-10-20');
assert.deepEqual(nextDay.todayDoneIds,[],'day rollover clears today completion IDs');
assert.deepEqual(nextDay.doneIds,['task-01','task-19'],'day rollover preserves unique booklet IDs');
assert.equal(nextDay.swapsUsed,0,'day rollover restores the two daily topic changes');
const ownTaskUI=renderTasks({lang:'en',task:{...packs.en.task.tasks[0],angles:taskAnglePair('en','task-01'),selectedAngle:null},tasks:packs.en.task.tasks,state:migrated,todayDone:false,alreadyStamped:false,memoryOnly:false,shared:false});
const friendTaskUI=renderTasks({lang:'en',task:packs.en.task.tasks[0],tasks:packs.en.task.tasks,state:migrated,todayDone:false,alreadyStamped:false,memoryOnly:false,shared:true});
assert.ok(ownTaskUI.includes('data-experiment-action="task-swap"'));
assert.ok(ownTaskUI.includes('data-experiment-action="task-angle"'));
assert.ok(!friendTaskUI.includes('data-experiment-action="task-swap"')&&!friendTaskUI.includes('data-experiment-action="task-angle"'),'shared task cannot affect this device’s task state');
assert.equal(dailyTask(packs.zh.task,'2026-10-16').id,'task-19','the existing UTC+8 rotation is unchanged');

console.log('PASS: persona preview and 4096-result distribution; 32 adventure paths, reversible resources and all 12 endings; 2/16-option duels, restore and safe custom rendering; 30×2×4 mission approaches and legacy/local completion behavior.');
