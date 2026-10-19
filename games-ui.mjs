import { gameText, resourceEffect } from './games-content.mjs';
import { adventureEndingId, adventureChoiceAvailable } from './games-logic.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (lang, action, label, value='', disabled=false, cls='button') => `<button class="${cls}" data-action="experiment-action" data-experiment-action="${action}"${value!==''?` data-value="${esc(value)}"`:''} ${disabled?'disabled':''}>${esc(label)}</button>`;

export function renderPersonaExperiment({ lang, pack, answers, selectedQuestion, selectedAnswer, preview, shared, motion }) {
 const c=key=>gameText(lang,'persona',key);
 const mo=motion&&typeof motion==='object'?motion:null;
 const slide=mo?.type==='quiz'?(mo.dir==='prev'?'mo-prev':'mo-next'):'';
 const seq=mo?.type==='quiz'?(mo.dir==='prev'?'mo-prev-seq':'mo-next-seq'):'';
 if(shared || answers.length!==pack.questions.length) return `<section class="experiment-panel" data-no-translate><h3>${esc(c('reviewTitle'))}</h3><p>${esc(c('invite'))}</p></section>`;
 const questionButtons=pack.questions.map((q,i)=>button(lang,'persona-question',`${String(i+1).padStart(2,'0')} · ${q.text}`,String(i),selectedQuestion===i,'chip'));
 const q=selectedQuestion===null?null:pack.questions[selectedQuestion];
 const options=q?q.options.map((o,i)=>button(lang,'persona-answer',`${'ABCD'[i]} · ${o.text}`,String(i),selectedAnswer===i,`answer${mo?.type==='select'&&selectedAnswer===i?' mo-stamp':''}`)):[];
 const current=pack.results[preview?.previousId];const proposed=pack.results[preview?.nextId];
 return `<section class="experiment-panel" data-no-translate><h3>${esc(c('reviewTitle'))}</h3><p>${esc(c('question'))}</p><div class="experiment-row">${questionButtons.join('')}</div>${q?`<h4 class="${slide}">${esc(q.text)}</h4><div class="experiment-options ${seq}">${options.join('')}</div>${button(lang,'persona-preview',c('preview'),'',selectedAnswer===null,'button dark')}`:''}${preview?`<div class="experiment-preview"><p><strong>${esc(c('changed'))}:</strong> ${String(preview.questionIndex+1).padStart(2,'0')} · ${esc(q?.text||pack.questions[preview.questionIndex].text)} → ${esc(pack.questions[preview.questionIndex].options[preview.answerIndex].text)}</p><div class="experiment-compare"><div class="${mo?.type==='preview'?'mo-flash':''}"><small>${esc(c('from'))}</small><strong>${esc(current.name)}</strong></div><div class="${mo?.type==='preview'?'mo-flash-b':''}"><small>${esc(c('to'))}</small><strong>${esc(proposed.name)}</strong></div></div>${preview.previousId===preview.nextId?`<p>${esc(c('same'))}</p>`:''}<div class="actions">${button(lang,'persona-adopt',c('adopt'))}${button(lang,'persona-cancel',c('cancel'))}</div></div>`:''}</section>`;
}

export function renderAdventure({ lang, content, state, selectedTheme, art='', motion }) {
 const c=key=>gameText(lang,'life',key);
 const mo=motion&&typeof motion==='object'?motion:null;
 const animateScene=mo?.type==='scene'||mo?.type==='enter';
 const themes=Object.entries(content).map(([id,item])=>button(lang,'life-world',item.name,id,id===selectedTheme,'chip'));
 if(!state) return `<section class="workbench life experiment-life" data-no-translate><div class="life-start-head"><div class="game-art">${art}</div><div class="life-placeholder"><h2>${esc(content[selectedTheme].name)}</h2><p>${esc(content[selectedTheme].premise)}</p></div></div><div class="theme-row">${themes.join('')}</div><div class="resource-board"><span>${esc(c('time'))}: 4</span><span>${esc(c('favor'))}: 2</span></div>${button(lang,'life-start',c('start'),'',false,'button dark wide')}<p class="note">${esc(c('refresh'))}</p></section>`;
 const theme=content[state.theme];const bumped=key=>animateScene&&Array.isArray(mo.res)&&mo.res.includes(key)?' class="mo-bump mo-flash"':'';const resources=`<div class="resource-board"><span>${esc(c('time'))}: <strong${bumped('time')}>${state.resources.time}</strong></span><span>${esc(c('favor'))}: <strong${bumped('favor')}>${state.resources.favor}</strong></span></div>`;
 const history=state.history.map((entry,i)=>{const choice=theme.scenes[i].choices.find(x=>x.id===entry.choiceId);return `<li class="${animateScene&&i===state.history.length-1?'mo-rise':''}"><strong>${esc(String(i+1))}. ${esc(choice?.label||entry.choiceId)}</strong><span>${esc(choice?.feedback||'')}</span></li>`;}).join('');
 if(state.done){const endingId=adventureEndingId(state,theme);const ending=theme.endings[endingId];const first=theme.scenes[0].choices.find(x=>x.id===state.choices[0]);const second=theme.scenes[1].choices.find(x=>x.id===state.choices[1]);const third=theme.scenes[2].choices.find(x=>x.id===state.choices[2]);const balance=state.resources.time>state.resources.favor?'balanceTime':state.resources.favor>state.resources.time?'balanceFavor':'balanceEven';
  return `<section class="workbench life experiment-life" data-no-translate><div class="bench-top"><span>${esc(theme.name)}</span><span>3 / 3</span></div><div class="game-art compact">${art}</div>${resources}<div class="life-ending ${animateScene?'mo-unfold':''}"><div class="result-kicker">${esc(c('ending'))}</div><h2 class="result-title">${esc(ending[0])}</h2><p>${esc(ending[1])}</p><p class="life-cause">${esc(first.label)} + ${esc(second.label)} → ${esc(ending[0])}<br>${esc(third.label)} → ${esc(c('time'))} ${state.resources.time} · ${esc(c('favor'))} ${state.resources.favor}</p><p>${esc(c(balance))}</p></div><h3>${esc(c('history'))}</h3><ol class="life-history">${history}</ol><div class="actions">${button(lang,'life-undo',c('undo'))}${button(lang,'life-reset',c('restart'))}${button(lang,'life-invite',c('storyShare'),'',false,'button light')}</div><p class="note">${esc(c('refresh'))}</p></section>`;
 }
 const scene=theme.scenes[state.stage];const options=scene.choices.map(choice=>button(lang,'life-choice',`${choice.label} · ${resourceEffect(lang,choice)}`,choice.id,!adventureChoiceAvailable(state,choice),'answer'));
 return `<section class="workbench life experiment-life" data-no-translate><div class="bench-top"><span>${esc(theme.name)}</span><span>${esc(c('stage'))} ${state.stage+1} / 3</span></div><div class="game-art compact">${art}</div><div class="life-progress" aria-label="${esc(c('stage'))} ${state.stage+1} / 3">${[0,1,2].map(i=>`<span class="${i<=state.stage?'complete':''}${animateScene&&i===state.stage?' mo-pop':''}">${i+1}</span>`).join('')}</div>${resources}<div class="life-scene ${animateScene?'mo-scene':''}"><h2>${esc(scene.title)}</h2><p>${esc(scene.prompt)}</p></div><div class="answers experiment-options">${options.join('')}</div>${history?`<h3>${esc(c('history'))}</h3><ol class="life-history">${history}</ol>`:''}<div class="actions">${state.history.length>=2?button(lang,'life-undo',c('undo')):''}${button(lang,'life-reset',c('restart'))}${button(lang,'life-invite',c('storyShare'),'',false,'button light')}</div><p class="note">${esc(c('refresh'))}</p></section>`;
}

export function renderChoice({ lang, scenes, sceneId, mode, items, text, round, quickResult, quickExcluded, quickAccepted, busy, overLimit, art='', motion }) {
 const c=key=>gameText(lang,'choice',key);
 const mo=motion&&typeof motion==='object'?motion:null;
 const modeTabs=[button(lang,'choice-mode',c('quick'),'quick',mode==='quick','chip'),button(lang,'choice-mode',c('slow'),'slow',mode==='slow','chip')].join('');
 const sceneTabs=scenes.map(s=>button(lang,'choice-scene',s.title,s.id,s.id===sceneId||busy,'chip')).join('');
 const activeQuick=items.map((label,index)=>({label,index})).filter(x=>!quickExcluded.includes(x.index));
 let body='';
 if(mode==='quick'){
  body=quickResult?`<div class="choice-result choice-winner"><p class="result-kicker">${esc(c('selected'))}</p><h2 class="result-title ${mo?.type==='draw'?'mo-blur':''}" data-no-translate>${esc(items[quickResult.index]??quickResult.text)}</h2><div class="actions">${button(lang,'choice-accept',c('accept'),'',quickAccepted)}${button(lang,'choice-exclude',c('exclude'),String(quickResult.index),quickAccepted)}${button(lang,'choice-copy',c('copy'))}</div></div>`:'';
  body+=`<p class="note">${esc(c('remaining'))}: ${activeQuick.length}</p>${quickExcluded.length?`<p class="note">${esc(c('excluded'))}: <span data-no-translate>${quickExcluded.map(i=>esc(items[i])).join('、')}</span></p>`:''}${activeQuick.length===0?`<p>${esc(c('noCandidates'))}</p>`:''}${button(lang,'choice-draw',busy?'…':c('draw'), '',busy||activeQuick.length===0||quickAccepted,'button dark wide')}${activeQuick.length===0?button(lang,'choice-restore',c('restore')):''}${quickAccepted?button(lang,'choice-reset',c('reset')):''}`;
 }else{
  body=overLimit?`<p class="notice-box">${esc(c('max'))} <strong>${items.length}</strong></p>`:'';
  if(round){
   body+=`<p class="note">${esc(c('remaining'))}: ${round.active.length}</p>`;
   if(round.pair.length===2){const [a,b]=round.pair;body+=`<h3>${esc(c('pair'))}</h3><div class="answers">${button(lang,'choice-keep',items[a],String(a),false,`answer${mo?.type==='duel'?' mo-duel-left':''}`)} ${button(lang,'choice-keep',items[b],String(b),false,`answer${mo?.type==='duel'?' mo-duel-right':''}`)}</div>${button(lang,'choice-drop',c('drop'))}`;}
   else if(round.active.length>1)body+=button(lang,'choice-pair',c('next'));
   else if(round.active.length===1)body+=`<div class="choice-final"><span data-no-translate>${esc(items[round.active[0]])}</span>${button(lang,'choice-accept',c('accept'))}</div>`;
   else body+=`<p>${esc(c('noCandidates'))}</p>${button(lang,'choice-restore',c('restore'),'','', 'button yellow')}`;
   if(round.records.length)body+=`<h3>${esc(c('retained'))} / ${esc(c('eliminated'))}</h3><ol class="choice-records">${round.records.map((record,i)=>`<li class="${mo?.type==='record'&&i===round.records.length-1?'mo-rise':''}">${record.keptIndex===null?`<span>${esc(c('drop'))}</span>`:`<span>${esc(c('retained'))}: <b data-no-translate>${esc(items[record.keptIndex])}</b>`}<small>${esc(c('eliminated'))}: <span data-no-translate>${record.droppedIndices.map(i=>esc(items[i])).join('、')}</span></small></li>`).join('')}</ol>`;
   if(round.undo)body+=button(lang,'choice-undo',c('undo'));
   if(round.result)body+=`<div class="choice-result"><p>${esc(c('selected'))}</p><strong data-no-translate>${esc(items[round.result.index])}</strong><div class="actions">${button(lang,'choice-copy',c('copy'))}</div></div>`;
   body+=button(lang,'choice-reset',c('reset'));
  }else if(!overLimit)body+=button(lang,'choice-duel-start',c('next'));
 }
 return `<section class="workbench choice experiment-choice" data-no-translate><div class="game-art compact">${art}</div><div class="scene-row">${sceneTabs}</div><div class="experiment-row">${modeTabs}</div><label class="editor-label" for="choice-options">${esc(c('candidates'))}<span>${items.length} ${esc(c('count'))}</span></label><textarea class="choice-editor" id="choice-options" maxlength="10000" spellcheck="false">${esc(text)}</textarea><div class="actions">${button(lang,'choice-clear',c('clear'))}${button(lang,'choice-invite',c('invite'),'','', 'button light')}</div><p class="note">${esc(c('editReset'))}</p>${body}</section>`;
}

export function renderTasks({ lang, task, tasks, state, todayDone, alreadyStamped, memoryOnly, shared, art='', motion }) {
 const c=key=>gameText(lang,'task',key);const pair=task?task.angles:[];
 const mo=motion&&typeof motion==='object'?motion:null;
 const enter=mo?.type==='enter'||mo?.type==='swap';
 if(shared) return `<section class="workbench task experiment-task" data-no-translate><h2 class="task-content">${esc(task.text)}</h2><p>${esc(c('shared'))}</p></section>`;
 const selection=task?.selectedAngle??null;
 const angleCards=pair.map((description,index)=>`<button class="angle-card ${selection===index?'selected':''}" data-action="experiment-action" data-experiment-action="task-angle" data-value="${index}"><span class="answer-key">0${index+1}</span><strong>${esc(c('angle'))} ${index+1}</strong><span>${esc(description)}</span></button>`).join('');
 const picked=selection===null?'':`<div class="angle-detail"><p>${esc(pair[selection])}</p>${alreadyStamped?`<p class="note">${esc(c('stamped'))}. ${esc(c('retry'))}</p>`:''}${todayDone?`<p class="completed ${mo?.type==='stamp'?'mo-stamp-down':''}">${esc(c('feedback'))}</p>`:''}${button(lang,'task-complete',todayDone?c('completedToday'):c('complete'),'',todayDone,'button dark')}</div>`;
 const book=tasks.map(item=>`<article class="mission-card ${state.doneIds.includes(item.id)?'stamped':''}${mo?.type==='stamp'&&(state.todayDoneIds||[]).includes(item.id)?' mo-pop':''}"><span class="task-number">${esc(item.id.toUpperCase())}</span><p>${esc(item.text)}</p><strong>${state.doneIds.includes(item.id)?esc(c('done')):esc(c('todo'))}</strong></article>`).join('');
 return `<section class="workbench task experiment-task" data-no-translate><div class="task-date"><span>${esc(state.date)} · ${esc(task.id.toUpperCase())}</span><span class="pill ${mo?.type==='stamp'?'mo-tick':''}">${state.doneIds.length} / 30</span></div><p class="task-count-caption">${esc(c('count'))}</p><div class="task-swap-row"><button class="button light" data-action="experiment-action" data-experiment-action="task-swap" ${state.swapsUsed>=2?'disabled':''}>${esc(c('swap'))}</button><span class="note">${esc(c('swapsLeft').replace('{count}',String(Math.max(0,2-state.swapsUsed))))}</span></div><div class="task-title-row"><div class="game-art">${art}</div><h2 class="task-content ${mo?.type==='swap'?'mo-swap-in':enter?'mo-rise':''}">${esc(task.text)}</h2></div><p>${esc(c('angle'))}</p><div class="angle-grid${enter?' mo-rise-seq':''}">${angleCards}</div>${picked}<p class="note">${esc(c('noProof'))}</p>${memoryOnly?`<p class="memory-note">${esc(c('memory'))}</p>`:''}<div class="divider"></div><details class="mission-details"><summary><strong>${esc(c('book'))}</strong><span class="${mo?.type==='stamp'?'mo-tick':''}">${state.doneIds.length} / 30</span></summary><div class="mission-book">${book}</div></details></section>`;
}
