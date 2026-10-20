import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculatePersona, dailyTask, taskState, normalizeChoices } from './logic.mjs';
import { previewPersonaAnswer, adoptPersonaPreview, createAdventure, chooseAdventure, adventureEndingId, undoLastAdventureChoice, createChoiceRound, drawChoicePair, resolveChoicePair, restoreChoiceRound, undoChoiceRound, acceptChoiceRound, taskCompletion, createDebugRoom, inspectDebugStep, chooseDebugFix, advanceDebugRoom, debugRoomDone, debugStepHint } from './games-logic.mjs';
import { adventureContent, taskAnglePair, debugRoomContent, debugCommit, gameText } from './games-content.mjs';
import { renderChoice, renderChoiceHistory, renderTasks, renderDebugRoom } from './games-ui.mjs';

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

// Second question bank: sixteen results, eight new dimensions, reachable outcomes in every locale.
for(const lang of ['en','zh','ja','es']){
 const p=packs[lang].persona;
 assert.equal(Object.keys(p.results).length,16,`${lang} has sixteen results`);
 assert.equal(p.questions2.length,6,`${lang} has six second-bank questions`);
 assert.deepEqual(p.tiebreakOrder2,['D9','D10','D11','D12','D13','D14','D15','D16'],`${lang} second-bank tiebreak order`);
 assert.ok(p.questions2.every(q=>q.options.length===4&&q.options.every(o=>p.tiebreakOrder2.includes(o.main)&&p.tiebreakOrder2.includes(o.sub))),`${lang} second-bank options reference new dimensions`);
 for(const id of p.tiebreakOrder2){
  assert.ok(p.results[id],`${lang} has result ${id}`);
  assert.ok(p.questions2.some(q=>q.options.some(o=>o.main===id)),`${lang} dimension ${id} is reachable as a main option`);
 }
}
const reachable2=new Set();
for(let bits=0;bits<4096;bits++){
 const sample=Array.from({length:6},(_,q)=>(bits>>(q*2))&3);
 reachable2.add(calculatePersona(sample,packs.zh.persona,1));
}
assert.deepEqual([...reachable2].sort(),['D9','D10','D11','D12','D13','D14','D15','D16'].sort(),'the second bank reaches all eight new results');
const answers2=[0,1,2,3,0,1];
const preview2=previewPersonaAnswer(answers2,2,0,packs.zh.persona,1);
assert.equal(preview2.previousId,calculatePersona(answers2,packs.zh.persona,1));
assert.equal(preview2.nextId,calculatePersona(preview2.proposedAnswers,packs.zh.persona,1));

// All five adventures have eight playable routes, three endings, and reversible final choices.
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
assert.equal(endingsSeen.size,15,'all fifteen theme-specific endings exist');
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
const slowResult=renderChoice({lang:'en',scenes:packs.en.choice.scenes,sceneId:'eat',mode:'slow',items:['a','b','c'],text:'a\nb\nc',round:drawChoicePair(createChoiceRound(['a','b','c']),()=>0),quickResult:null,quickExcluded:[],quickAccepted:false,busy:false,overLimit:false});
assert.match(slowResult,/This round/, 'elimination mode announces its controlled head-to-head pairing');

// The decision archive renders locally-saved entries, scoped to preset scenes or a custom label.
const emptyHistory=renderChoiceHistory({lang:'en',scenes:packs.en.choice.scenes,entries:[]});
assert.ok(emptyHistory.includes('data-action="choice-history-clear"')===false,'an empty archive offers nothing to clear');
assert.match(emptyHistory,/No decisions kept yet/);
const savedHistory=renderChoiceHistory({lang:'en',scenes:packs.en.choice.scenes,entries:[
 {sceneId:'eat',mode:'quick',result:'hotpot',total:3,eliminated:['sushi'],at:'2026-10-19'},
 {sceneId:'custom',mode:'slow',result:'park',total:4,eliminated:['museum','bar'],at:'2026-10-18'},
]});
assert.ok(savedHistory.includes('data-action="choice-history-clear"'),'a stored archive can be cleared');
assert.match(savedHistory,/hotpot/);
assert.match(savedHistory,/Custom/);
assert.match(savedHistory,/Set aside/);
assert.match(savedHistory,/Eliminated/);
assert.match(savedHistory,/2026-10-19/);

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
assert.match(ownTaskUI,/Check-in streak/);
assert.match(ownTaskUI,/Weekly challenge/);
const streakedUI=renderTasks({lang:'en',task:{...packs.en.task.tasks[0],angles:taskAnglePair('en','task-01'),selectedAngle:null},tasks:packs.en.task.tasks,state:{...migrated,streak:4,bestStreak:7,lastStampDate:'2026-10-19',weekStart:'2026-10-19',weekDays:['2026-10-19','2026-10-20','2026-10-21']},todayDone:false,alreadyStamped:false,memoryOnly:false,shared:false});
assert.match(streakedUI,/4 days/);assert.match(streakedUI,/Best: 7 days/);assert.match(streakedUI,/3 of 3 check-ins this week/);assert.match(streakedUI,/Weekly challenge complete/);
assert.equal(dailyTask(packs.zh.task,'2026-10-16').id,'task-19','the existing UTC+8 rotation is unchanged');

// Duck Debug Room: three levels, one broken step each, two candidate fixes with
// exactly one correct, and a commit message that reacts to the mistake count.
const debugLevels=Object.fromEntries(['en','zh','ja','es'].map(lang=>[lang,debugRoomContent(lang)]));
for(const lang of ['en','zh','ja','es']){
 const levels=debugLevels[lang];
 assert.equal(levels.length,3,`${lang} has three levels`);
 assert.deepEqual(levels.map(level=>level.id),debugLevels.en.map(level=>level.id),`${lang} keeps the same level ids`);
 levels.forEach((level,i)=>{
  assert.equal(level.steps.length,4,`${lang}/${level.id} has four steps`);
  assert.equal(level.bugStep,debugLevels.en[i].bugStep,`${lang}/${level.id} points at the same broken step`);
  assert.ok(level.bugStep>=0&&level.bugStep<level.steps.length);
  assert.equal(level.clean.length,level.steps.length-1,`${lang}/${level.id} clears every innocent step`);
  assert.ok(level.clean.every(text=>typeof text==='string'&&text.trim().length>3),`${lang}/${level.id} has a line for each innocent step`);
  level.steps.forEach((_,step)=>assert.equal(debugStepHint(level,step),step===level.bugStep?null:level.clean[step<level.bugStep?step:step-1],`${lang}/${level.id} keeps hints aligned with step ${step}`));
  assert.equal(debugStepHint(level,level.bugStep),null,`${lang}/${level.id} never clears the broken step`);
  assert.equal(level.fixes.length,2,`${lang}/${level.id} offers two fixes`);
  assert.deepEqual(level.fixes.map(fix=>fix.id),debugLevels.en[i].fixes.map(fix=>fix.id),`${lang}/${level.id} keeps stable fix ids`);
  assert.equal(level.fixes.filter(fix=>fix.correct).length,1,`${lang}/${level.id} has exactly one workable fix`);
  assert.ok(level.fixes.every(fix=>fix.label&&fix.result),`${lang}/${level.id} shows every fix and its outcome`);
  assert.ok(level.fixes.filter(fix=>!fix.correct).every(fix=>fix.duck),`${lang}/${level.id} answers a wrong fix`);
  for(const text of [level.title,level.premise,level.bugNote,level.strongHint,level.output,level.commitLine,...level.steps,...level.clean])
   assert.ok(typeof text==='string'&&text.trim().length>2,`${lang}/${level.id} has complete copy`);
 });
}
const firstLevel=debugLevels.zh[0];
const emptyRoom=createDebugRoom();
assert.deepEqual(emptyRoom,{index:0,found:null,fixId:null,checked:[],focus:null,wrongFix:null,hint:false,wrong:0,log:[]});
const innocentStep=firstLevel.bugStep===0?1:0;
let room=inspectDebugStep(emptyRoom,firstLevel,innocentStep);
assert.deepEqual(room.checked,[innocentStep]);assert.equal(room.focus,innocentStep);assert.equal(room.found,null);assert.equal(room.wrong,1,'an innocent step counts as one mistake');
assert.equal(inspectDebugStep(room,firstLevel,innocentStep).wrong,1,'re-reading a checked step adds no further mistakes');
assert.equal(chooseDebugFix(room,firstLevel,firstLevel.fixes[0].id),room,'no fix is offered before the broken step is found');
room=inspectDebugStep(room,firstLevel,firstLevel.bugStep);
assert.equal(room.found,firstLevel.bugStep);
const badFix=firstLevel.fixes.find(fix=>!fix.correct),goodFix=firstLevel.fixes.find(fix=>fix.correct);
const attempted=chooseDebugFix(room,firstLevel,badFix.id);
assert.equal(attempted.fixId,null);assert.equal(attempted.wrongFix,badFix.id);assert.equal(attempted.wrong,room.wrong+1);assert.equal(attempted.log.length,0,'a wrong fix never enters the log');
room=chooseDebugFix(attempted,firstLevel,goodFix.id);
assert.equal(room.fixId,goodFix.id);assert.equal(room.wrongFix,null);assert.deepEqual(room.log,[{levelId:firstLevel.id,fixId:goodFix.id}]);
assert.equal(advanceDebugRoom(room).index,1);
assert.equal(chooseDebugFix({...room,fixId:null},firstLevel,badFix.id).log.length,1,'the fix can still be corrected before moving on');
const walked=debugLevels.zh.reduce((state,level)=>{const found=inspectDebugStep(state,level,level.bugStep);return advanceDebugRoom(chooseDebugFix(found,level,level.fixes.find(fix=>fix.correct).id));},createDebugRoom());
assert.equal(walked.index,3);assert.equal(walked.wrong,0);assert.deepEqual(walked.log.map(entry=>entry.levelId),debugLevels.zh.map(level=>level.id));
assert.equal(debugRoomDone(walked,debugLevels.zh),true);assert.equal(debugRoomDone(createDebugRoom(),debugLevels.zh),false);
for(const lang of ['en','zh','ja','es']){
 const clean=debugCommit(lang,0),sloppy=debugCommit(lang,5);
 assert.notEqual(clean,sloppy,`${lang} commit subject reacts to the mistake count`);
 assert.ok(clean.includes(debugLevels[lang][0].commitLine)&&clean.includes(debugLevels[lang][2].commitLine),`${lang} commit lists every fixed flaw`);
 assert.equal(clean.split('\n').filter(line=>line.startsWith('- ')).length,3,`${lang} commit body lists three lines`);
 assert.ok(clean.startsWith(gameText(lang,'debug','commitPrefix')));
 assert.ok(sloppy.includes(gameText(lang,'debug','verdictSlow'))&&clean.includes(gameText(lang,'debug','verdictPerfect')));
}
const debugHtml=renderDebugRoom({lang:'zh',content:debugLevels.zh,state:createDebugRoom(),motion:null,art:''});
assert.ok(debugHtml.includes('data-experiment-action="debug-inspect"'));
assert.ok(debugHtml.includes('data-experiment-action="debug-hint"'));
assert.ok(!debugHtml.includes('data-experiment-action="debug-fix"'),'fix cards appear only after the broken step is found');
const foundHtml=renderDebugRoom({lang:'zh',content:debugLevels.zh,state:inspectDebugStep(createDebugRoom(),debugLevels.zh[0],debugLevels.zh[0].bugStep),motion:{type:'found'},art:''});
assert.ok(foundHtml.includes('data-experiment-action="debug-fix"'));
assert.ok(foundHtml.includes(debugLevels.zh[0].bugNote));
const doneHtml=renderDebugRoom({lang:'zh',content:debugLevels.zh,state:walked,motion:{type:'done'},art:''});
assert.ok(doneHtml.includes('data-experiment-action="debug-copy"')&&doneHtml.includes('data-experiment-action="debug-restart"'));
assert.ok(doneHtml.includes(debugCommit('zh',0).split('\n')[0]));
// The duck answers whichever innocent step was last checked, even when the broken
// step sits before it in the list (the noodle timer hides its flaw at index 2).
const noodleLevel=debugLevels.zh[1];
const lastInnocent=noodleLevel.steps.length-1;
const hintHtml=renderDebugRoom({lang:'zh',content:debugLevels.zh,state:inspectDebugStep({...createDebugRoom(),index:1},noodleLevel,lastInnocent),motion:{type:'look'},art:''});
assert.ok(hintHtml.includes(noodleLevel.clean[2]),'the duck explains the last checked step');
assert.ok(!hintHtml.includes('undefined'),'every innocent step has its own note');
console.log('PASS: duck debug room levels, single-bug inspection, wrong/right fix paths, memory-only progress and the mistake-aware commit message.');

console.log('PASS: persona preview and 4096-result distribution; 40 adventure paths, reversible resources and all 15 endings; 2/16-option duels, restore, safe custom rendering and decision archive; 30×2×4 mission approaches and legacy/local completion behavior.');
