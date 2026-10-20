import {pageData,renderGuide,renderDocument,canonicalURL} from './page-content.mjs';
import { languages, language, setLanguage, localize, t, words } from './i18n.mjs';
import { startAnalytics } from './analytics.mjs';
import { calculatePersona, beijingDate, dailyTask, taskState, randomOne, pickLife, normalizeChoices, resolveLife, stampStreak, stampWeek } from './logic.mjs';
import { mountDispatch } from './dispatch-ui.mjs';
import { dispatchImageHasFailed, rememberDispatchImageFailure, dispatchImageURL } from './dispatch-assets.mjs';
import { link, asset, currentRoute, PAGES } from './hosting.mjs';
import { previewPersonaAnswer, adoptPersonaPreview, createAdventure, chooseAdventure, undoLastAdventureChoice, adventureEndingId, createChoiceRound, drawChoicePair, resolveChoicePair, undoChoiceRound, restoreChoiceRound, acceptChoiceRound, taskCompletion, createDebugRoom, requestDebugHint, inspectDebugStep, chooseDebugFix, advanceDebugRoom } from './games-logic.mjs';
import { adventureContent, taskAnglePair, gameText, debugRoomContent, debugCommit } from './games-content.mjs';
import { renderPersonaExperiment, renderAdventure, renderEndingGallery, renderChoice, renderChoiceHistory, renderTasks, renderDebugRoom } from './games-ui.mjs';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app = $('#app');
app.addEventListener('error',event=>{const image=event.target;if(!image?.matches?.('img.dispatch-generated-image[data-image-fallback]'))return;rememberDispatchImageFailure(image.getAttribute('src'));image.hidden=true;if(image.nextElementSibling)image.nextElementSibling.hidden=false;},true);
const route = currentRoute();
const dispatchParams = new URLSearchParams(location.search);
if (route === 'dispatch' && dispatchParams.has('level') && !['return', 'market', 'festival', 'storm'].includes(dispatchParams.get('level'))) {
 dispatchParams.delete('level');
 const normalized = location.pathname + (dispatchParams.size ? '?' + dispatchParams.toString() : '') + location.hash;
 history.replaceState(null, '', normalized);
}
const titles = {dispatch:'双龙调度局',persona:'你的离谱人格',life:'平行人生模拟器',choice:'今天听天由命',task:'今日奇怪任务',debug:'鸭子调试室'};
const packs = {};
let answers=[], questionIndex=0, personaResult=null, lifeTheme='modern', lifeResult=null, lifeSeen=[], lifeDraws=0;
let personaEditQuestion=null, personaEditAnswer=null, personaPreview=null, personaSet=0;
let lifeMode='adventure', adventureState=null;
let sceneId='eat', choiceText='', choiceResult=null, choiceBusy=false, sharedView=false;
let choiceMode='quick', choicePreset=true, choiceRound=null, quickResultIndex=null, quickExcluded=[], quickAccepted=false, choiceGeneration=0, choiceRecorded=false;
const taskAngleSelections=new Map();
let state=null, memoryOnly=false, toastTimer;
let debugState=createDebugRoom();
const taskKey='oddlab_task_v1';
const lifeEndingsKey='oddlab_life_endings_v1';
const choiceHistoryKey='oddlab_choice_history_v1';
let lifeEndings=null;
let choiceHistory=null;
const face = `<svg viewBox="0 0 220 220" fill="none" aria-hidden="true"><path d="M65 44L86 20L111 44L140 26L157 53L188 53L181 88L205 109L180 133L188 165L154 169L136 199L108 181L78 198L65 168L30 163L40 131L18 107L43 83L35 51Z" fill="#f8f4e9" stroke="#292c25" stroke-width="2.5"/><ellipse cx="89" cy="94" rx="20" ry="27" fill="#292c25" transform="rotate(-8 89 94)"/><ellipse cx="137" cy="94" rx="20" ry="27" fill="#292c25" transform="rotate(8 137 94)"/><ellipse cx="96" cy="89" rx="6" ry="9" fill="#f8f4e9"/><ellipse cx="143" cy="89" rx="6" ry="9" fill="#f8f4e9"/><path d="M82 139Q110 164 144 135" stroke="#292c25" stroke-width="3" stroke-linecap="round"/><path d="M61 124l14 3M153 126l15-4" stroke="#df6441" stroke-width="5" stroke-linecap="round"/><path d="M182 13v15m-7-8h15M17 179v14m-7-7h14" stroke="#292c25" stroke-width="2"/></svg>`;
const door = `<svg viewBox="0 0 150 150" fill="none" aria-hidden="true"><path d="M31 128V31Q75 0 119 31V128" stroke="#292c25" stroke-width="3"/><path d="M42 128V38Q75 15 108 38V128" fill="#f9f5e9" stroke="#292c25" stroke-width="2"/><path d="M61 128V41L108 31V128Z" fill="#b6a0d3" stroke="#292c25" stroke-width="2.5"/><circle cx="94" cy="83" r="4" fill="#292c25"/><path d="M19 130h113M21 49l-8 8m111-40 10-8m-4 49h13" stroke="#292c25" stroke-width="2" stroke-linecap="round"/><path d="M25 17v17M17 25h17" stroke="#df6441" stroke-width="2.5"/></svg>`;
const dice = `<svg viewBox="0 0 150 150" fill="none" aria-hidden="true"><g transform="rotate(-13 75 75)"><rect x="27" y="27" width="96" height="96" rx="21" fill="#f8f4e9" stroke="#292c25" stroke-width="3"/><g fill="#292c25"><circle cx="51" cy="51" r="7"/><circle cx="99" cy="51" r="7"/><circle cx="75" cy="75" r="7"/><circle cx="51" cy="99" r="7"/><circle cx="99" cy="99" r="7"/></g></g><path d="M126 16v18m-9-9h18M13 113l-5 10m129-29 10 4" stroke="#df6441" stroke-width="3" stroke-linecap="round"/></svg>`;
const flower = `<svg viewBox="0 0 150 150" fill="none" aria-hidden="true"><path d="M77 96v42m0-19q-29-29-35-7 12 18 35 7m0 9q26-31 34-13-9 17-34 13" stroke="#292c25" stroke-width="3"/><path d="M77 22C92 0 107 20 103 37C134 27 139 53 116 66C144 81 124 105 103 93C104 121 76 123 69 98C48 119 29 98 42 79C12 73 22 45 46 47C30 23 53 9 68 29Z" fill="#efcc5b" stroke="#292c25" stroke-width="2.5"/><circle cx="78" cy="65" r="22" fill="#faf5e8" stroke="#292c25" stroke-width="2"/><circle cx="71" cy="62" r="2.5" fill="#292c25"/><circle cx="85" cy="62" r="2.5" fill="#292c25"/><path d="M70 72q9 8 17-1" stroke="#292c25" stroke-width="2" stroke-linecap="round"/></svg>`;
const duck = `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M8 42c-3-11 6-17 18-17 10 0 18 3 20 9 2 6-3 11-10 11H18c-5 0-9-2-10-4" stroke-width="5.5"/><path d="M12 33c-5 1-7-2-5-6" stroke-width="4.5"/><path d="M43 5c7 1 13 6 13 12s-6 13-13 13-12-6-12-13 5-11 12-12c3 0 5 1 7 3" stroke-width="5.5"/><path d="M56 13c5 1 8 2 9 4-2 2-6 3-10 2" stroke-width="5"/><path d="M31 36c5-2 11-1 14 2M20 43c4-2 9-1 12 2" stroke-width="4"/><path d="M43 5c-3-3 0-6 4-6" stroke-width="4.5"/></g><circle cx="48" cy="13" r="2" fill="currentColor"/></svg>`;
const brandMark = `<img data-brand="oddlab-door" src="${asset('/brand-mark.svg')}" width="64" height="64" alt="">`;
const brandSmall = `<img data-brand="oddlab-door" src="${asset('/favicon.svg')}" width="16" height="16" alt="">`;
function toast(text){ clearTimeout(toastTimer);$('#toast').textContent=t(text);$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500); }
function shell(title, subtitle, content, kind=route){
 app.innerHTML=`<div class="tool-wrap"><a class="back" href="${link('/')}">← 回研究所</a><div class="tool-head"><div class="eyebrow">ODDLAB / ${esc(kind.toUpperCase())}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${content}${titles[kind]?crosslinks(kind):''}</div>`;localize(app);
}
function crosslinks(kind){return `<div class="crosslinks"><span>${words('玩腻了试试','Try another','ほかも遊ぶ','Prueba otro')}</span>${Object.keys(titles).filter(k=>k!==kind).slice(0,2).map(k=>`<a href="${link('/'+k)}">${esc(pageData('/'+k,language).title)} ↗</a>`).join('')}</div>`;}
function footerMark(){return '<div class="result-bottom"><span class="result-mark">'+brandSmall+' 脑洞研究所 / OddLab</span><span>认真生活，偶尔离谱。</span></div>';}
function currentLink(kind,id,version){const u=new URL(link('/'+kind),location.origin);u.searchParams.set('lang',language);if(id)u.searchParams.set('r',id);if(version)u.searchParams.set('v',String(version));return u.href;}
function resultActions(kind){return `<div class="actions"><button class="button dark" data-action="copy">复制结果</button><button class="button light" data-action="share">${navigator.share?'分享 ↗':'复制分享链接'}</button><button class="button push" data-action="restart">${sharedView?'我也来玩':'再来一次'} ↻</button></div>`;}
function setResultURL(id,version){const u=new URL(location.href);u.search='';u.searchParams.set('lang',language);u.searchParams.set('r',id);if(version)u.searchParams.set('v',version);history.replaceState(null,'',u.pathname+u.search);updateMetadata();}
function clearResultURL(){history.replaceState(null,'',link('/'+route)+'?lang='+language);sharedView=false;updateMetadata();}
function sharedNotice(){return sharedView?'<div class="shared">↗ 这是一份分享给你的脑洞。看完了，你也来试试？</div>':'';}
// Motion intent for the next render of one surface. A handler sets it right before
// calling the renderer, the renderer consumes it, so a class only exists on the one
// render that needs it and never replays on unrelated re-renders.
let motion=null;
const entered=new Set();
function viewMotion(name){if(motion){const pending=motion;motion=null;return pending;}if(entered.has(name))return null;entered.add(name);return {type:'enter'};}
// Keep the seasonal experiment below the regular games, outside the hero.
function seasonalLink(){
 return `<p class="seasonal-link"><span>${words('1024 小彩蛋','A 1024 extra','1024のおまけ','Un extra de 1024')}</span><a href="${link('/debug')}">${t('鸭子调试室')} ↗</a></p>`;
}
function quickGameLinks(){
 return `<div class="home-quick-links"><a class="button dark" href="${link('/choice')}">${words('10 秒，做个小决定','A small decision · 10 sec','10秒で小さな決断','Una decisión · 10 s')} ↗</a><a class="button light" href="${link('/persona')}">${words('1 分钟，看看离谱人格','Your odd personality · 1 min','1分で意外な性格を発見','Tu personalidad · 1 min')} ↗</a></div>`;
}
function home(){
 const task=dailyTask(packs.task); const date=beijingDate(); const homeHeroFailed=dispatchImageHasFailed('/assets/dispatch/hero-v1.webp'); const homeHeroSrc=dispatchImageURL('/assets/dispatch/hero-v1.webp');
 const dragons=`<svg viewBox="0 0 360 190" aria-hidden="true"><path d="M35 151Q78 102 116 135Q141 69 192 112Q227 51 279 92L325 74L306 111Q338 140 300 164Q257 186 225 151Q183 186 146 152Q91 186 35 151Z" fill="#e9c85d" stroke="#294b40" stroke-width="4"/><path d="M105 130Q105 76 153 91L185 119M207 107Q229 57 265 79L279 101" fill="none" stroke="#294b40" stroke-width="4"/><circle cx="287" cy="120" r="4" fill="#294b40"/><path d="M19 177H344" stroke="#294b40" stroke-width="3" stroke-linecap="round"/><path d="M80 177V155H108V177M172 177V149H202V177M263 177V157H292V177" fill="#f8f4e9" stroke="#294b40" stroke-width="3"/><path d="M176 149L187 128L198 149M264 157L277 136L290 157" fill="#df6441" stroke="#294b40" stroke-width="3"/></svg>`;
 const lifeCard = `<a class="play-card life-bg" href="${link('/life')}"><div class="card-top"><span>NO. 03 / ${words('三幕人生冒险','BRANCHING LIFE STORY','三幕の人生物語','VIDA CON DECISIONES')}</span><span>${words('约 3 分钟','~3 min','約3分','~3 min')}</span></div><div class="card-art">${door}</div><h3>${t(titles.life)}</h3><p>${words('选一个世界，连续做三次选择，看看故事如何收束；也可翻看旧档案。','Choose a world, make three choices, and see how the story lands. The old archives are here too.','世界を選び、三つの決断で物語を進めます。元のアーカイブも見られます。','Elige un mundo, decide tres veces y descubre el desenlace. También sigue el archivo anterior.')}</p><div class="card-bottom"><span>${words('亲自过一局','Live a story','物語を始める','Vive una historia')}</span><span class="small-arrow">↗</span></div></a>`;
 app.innerHTML=`<section class="home-hero"><div class="intro"><div class="eyebrow">A LITTLE ODD. A LITTLE JOY.</div><h1>${words('今天，','Today,','今日は、','Hoy,')}<br>${words('来点','try something ','ちょっと','prueba algo ')}<em>${words('不一样的。','a little odd.','いつもと違うこと。','diferente.')}</em></h1><p>${words('五个小游戏：路线解谜、人格测试、平行人生、小事随缘、日常任务。','Five small games: route puzzles, a personality quiz, a parallel life, small choices, and daily missions.','五つの遊び：ルートパズル、性格テスト、パラレル人生、小さな決断、毎日のミッション。','Cinco juegos: puzles de rutas, un test de personalidad, una vida paralela, pequeñas decisiones y misiones diarias.')}</p><div class="intro-note"><span class="mini-spark" aria-hidden="true">${brandMark}</span><span>${words('不必准备，不用注册，带上好奇心就行。','No prep. No sign-up. Just curiosity.','準備も登録も不要。好奇心だけどうぞ。','Sin preparativos ni registro. Solo curiosidad.')}</span></div>${quickGameLinks()}</div><a class="feature dispatch-feature" href="${link('/dispatch')}"><div class="feature-copy"><div class="feature-top"><span class="pill">${words('本期主打 · 路线解谜','FEATURED · ROUTE PUZZLE','今回のおすすめ・ルートパズル','DESTACADO · ROMPECABEZAS DE RUTAS')}</span><span>NO. 01</span></div><h2>${words('三件怪货，<br>六回合送达。','Three odd parcels.<br>Six turns to deliver.','奇妙な荷物を3つ、<br>6ターンで届けよう。','Tres encargos extraños.<br>Seis turnos para llegar.')}</h2><p>${words('给塔楼巨人的火山汤、档案馆的冻住的梦、沼泽合唱团的唱歌蛋。排好两条龙的路线，再一起回家。','Route volcano broth, a frozen dream, and singing eggs. Bring two dragons home on time.','火山スープ、凍った夢、歌う卵。2頭のルートを組み、期限内に一緒に帰ろう。','Caldo volcánico, un sueño congelado y huevos cantores. Planea las rutas y vuelve a casa.')}</p><span class="feature-stamp">${words('约 5–8 分钟 · 天气公开','5–8 MIN · WEATHER IS KNOWN','約5〜8分 · 天候は公開','5–8 MIN · CLIMA VISIBLE')}</span></div><div class="dispatch-feature-art"><img class="dispatch-generated-image" data-image-fallback ${homeHeroFailed ? '' : 'src="'+homeHeroSrc+'"'} width="1536" height="768" ${homeHeroFailed ? 'hidden' : ''} alt="${words('Ember 和 Gale 在厨房准备火山汤、冻住的梦和会唱歌的蛋。','Ember and Gale prepare a volcano soup, frozen dream, and singing eggs in their kitchen.','Ember と Gale がキッチンで火山スープ、凍った夢、歌う卵を準備しています。','Ember y Gale preparan caldo volcánico, un sueño congelado y huevos cantores en la cocina.')}"><span class="dispatch-home-fallback" ${homeHeroFailed ? '' : 'hidden'}>${dragons}</span></div><div class="feature-action"><span>${words('开始排班，看看能否全员准时 ↗','Plan the routes. Can everyone make it? ↗','ルートを組む。全員間に合う？ ↗','Planea las rutas. ¿Llegarán todos? ↗')}</span><span class="round-arrow" aria-hidden="true">↗</span></div></a></section><section id="play"><div class="section-heading"><h2>${words('想玩个轻松的？','Something lighter?','気軽に遊ぶ？','¿Algo más ligero?')}</h2><span>SMALL EXPERIMENTS / JUST FOR FUN</span></div><div class="play-grid"><a class="play-card persona-bg" href="${link('/persona')}"><div class="card-top"><span>NO. 02 / ${words('快速认识自己','QUICK SELF-PORTRAIT','自分を知る','UN RETRATO RÁPIDO')}</span><span>${words('约 1 分钟','~1 min','約1分','~1 min')}</span></div><div class="card-art">${face}</div><h3>${t(titles.persona)}</h3><p>${words('回答六道趣味题，解锁一份离谱人设。','Answer six playful questions and meet your odd personality.','6つの質問で、おかしな性格を見つけよう。','Seis preguntas para descubrir tu personalidad peculiar.')}</p><div class="card-bottom"><span>${words('看看隐藏人设','Meet your odd side','意外な一面を見る','Descubre tu lado peculiar')}</span><span class="small-arrow">↗</span></div></a>${lifeCard}<a class="play-card choice-bg" href="${link('/choice')}"><div class="card-top"><span>NO. 04 / ${words('小事随缘','SMALL DECISIONS','小さな決断','DECISIONES PEQUEÑAS')}</span><span>${words('约 10 秒','~10 sec','約10秒','~10 s')}</span></div><div class="card-art">${dice}</div><h3>${t(titles.choice)}</h3><p>${words('把午饭、电影这类小纠结交给随机，大事还是自己定。','Let chance handle lunch or a movie. Keep the important decisions yours.','昼食や映画の小さな迷いは運まかせに。大事なことは自分で。','Deja el azar para la comida o una película. Lo importante, decídelo tú.')}</p><div class="card-bottom"><span>${words('帮我做个小决定','Make a small decision','小さな決断を手伝う','Ayúdame a decidir')}</span><span class="small-arrow">↗</span></div></a><a class="play-card task-bg" href="${link('/task')}"><div class="card-top"><span>NO. 05 / ${words('今日奇怪任务','DAILY ODD MISSION','今日のヘンなミッション','MISIÓN PECULIAR')}</span><span>${date.slice(5).replace('-',' / ')}</span></div><div class="card-art">${flower}</div><h3>${words('给日常加点戏','Add a plot twist','日常に小さな展開を','Dale un giro al día')}</h3><p>${esc(task.text)}</p><div class="card-bottom"><span>${words('接受今天的小挑战','Try today’s tiny challenge','今日の小さな挑戦へ','Acepta el reto de hoy')}</span><span class="small-arrow">↗</span></div></a></div>${seasonalLink()}</section><div class="home-end">${words('不用每件事都有意义，有点开心也很好。','Not everything needs a purpose. A little joy is enough.','意味がなくても、ちょっと楽しいなら十分。','No todo necesita un propósito. Una pequeña alegría basta.')}</div>`;localize(app);
}
function personaQuestions(){return personaSet?packs.persona.questions2:packs.persona.questions;}
function persona(){
 const mo=viewMotion('persona');
 const slide=mo?.type==='quiz'?(mo.dir==='prev'?'mo-prev':'mo-next'):'';
 const seq=mo?.type==='quiz'?(mo.dir==='prev'?'mo-prev-seq':'mo-next-seq'):'';
 const questions=personaQuestions();const total=questions.length;
 const setToggle=`<div class="persona-set-toggle" data-no-translate><button class="chip ${personaSet===0?'active':''}" data-action="persona-set" data-value="0">${words('第一套','Set 1','セット1','Set 1')}</button><button class="chip ${personaSet===1?'active':''}" data-action="persona-set" data-value="1">${words('第二套','Set 2','セット2','Set 2')}</button></div>`;
 if(personaResult){const r=personaResult;const experiment=renderPersonaExperiment({lang:language,pack:packs.persona,answers,questions,selectedQuestion:personaEditQuestion,selectedAnswer:personaEditAnswer,preview:personaPreview,shared:sharedView,motion:mo});shell(titles.persona,'你的小小离谱，值得被认真收藏。',`${sharedNotice()}<section class="workbench persona"><div class="result-kicker">YOUR ODD PERSONALITY / 人格鉴定报告</div><div class="result-head"><div class="result-art ${mo?.type==='result'?'mo-blink-art':''}">${face}</div><div><h2 class="result-title ${mo?.type==='result'?'mo-unfold':''}">${esc(r.name)}</h2><p class="tagline">${esc(r.tagline)}</p></div></div><p class="result-desc">${esc(r.desc)}</p><div class="result-detail"><dl><dt>你的隐藏优点</dt><dd>${esc(r.pro)}</dd></dl><dl><dt>一条奇怪的习惯</dt><dd>${esc(r.habit)}</dd></dl></div>${footerMark()}${resultActions('persona')}${experiment}</section><p class="note">娱乐内容，非心理诊断、医学建议或科学测评。</p>`);return;}
 const q=questions[questionIndex];shell(titles.persona,'凭直觉选就好。这里没有标准答案，只有你的答案。',`<section class="workbench persona"><div class="bench-top"><span>认识你的另一面</span><span>0${questionIndex+1} / 0${total}</span></div>${setToggle}<div class="progress" aria-label="答题进度"><span style="width:${(questionIndex+1)/total*100}%"></span></div><h2 class="question ${slide}" tabindex="-1">${esc(q.text)}</h2><div class="answers ${seq}">${q.options.map((o,i)=>`<button class="answer ${answers[questionIndex]===i?'selected':''}${mo?.type==='select'&&answers[questionIndex]===i?' mo-stamp':''}" aria-pressed="${answers[questionIndex]===i}" data-action="answer" data-value="${i}"><span class="answer-key">${'ABCD'[i]}</span><span>${esc(o.text)}</span></button>`).join('')}</div><div class="actions"><button class="button" data-action="previous" ${questionIndex===0?'disabled':''}>← 上一题</button><button class="button dark push" data-action="next" ${answers[questionIndex]===undefined?'disabled':''}>${questionIndex===total-1?'看看我的人格 ↗':'下一题 →'}</button></div></section><p class="note">${total} 道题 · 大约 1 分钟 · 娱乐内容，非科学测评</p>`);
}
function life(){
 const mo=viewMotion('life');
 const archiveContent=gameText(language,'life','archive');const adventureTitle=gameText(language,'life','adventure');const modeTabs=`<div class="mode-tabs" data-no-translate><button class="chip ${lifeMode==='adventure'?'active':''}" data-action="experiment-action" data-experiment-action="life-tab" data-value="adventure">${esc(adventureTitle)}</button><button class="chip ${lifeMode==='archive'?'active':''}" data-action="experiment-action" data-experiment-action="life-tab" data-value="archive">${esc(archiveContent)}</button></div>`;
 if(lifeMode==='adventure'){const adventure=adventureContent(language);shell(titles.life,'这辈子先这样，另一辈子可以大胆一点。',`${modeTabs}${renderAdventure({lang:language,content:adventure,state:adventureState,selectedTheme:lifeTheme,art:door,motion:mo,gallery:renderEndingGallery({lang:language,content:adventure,collected:loadLifeEndings()})})}`);return;}
 const themes=Object.entries(packs.life.themes);
 const themeRow=`<div class="theme-row" aria-label="选择人生主题">${themes.map(([id,title])=>`<button class="chip ${lifeTheme===id?'active':''}" aria-pressed="${lifeTheme===id}" data-action="theme" data-value="${id}">${esc(title)}</button>`).join('')}</div>`;
 if(!lifeResult){shell(titles.life,'人生档案：十二份完整的虚构故事。',`${modeTabs}<section class="workbench life"><div class="life-placeholder">${door}<h2>旧人生档案</h2><p>保留原来的十二份完整模板。</p></div>${themeRow}<button class="button dark wide" data-action="draw-life">抽取一份旧人生档案 ↗</button></section>`);return;}
 const r=lifeResult,f=r.fields;
 shell(titles.life,'人生没有如果，但这里可以有一份。',`${modeTabs}${sharedNotice()}<section class="workbench life"><div class="bench-top"><span>PARALLEL LIFE / 人生档案</span><span>${esc(packs.life.themes[r.theme]||'另一个世界')}</span></div><h2 class="result-title">${esc(f.title)}</h2>${[['人生职业',f.career],['你的特殊技能',f.skill],['命运拐了个弯',f.twist],['最后，你的结局',f.ending]].map(([k,v])=>`<dl class="life-field"><dt>${k}</dt><dd>${esc(v)}</dd></dl>`).join('')}<p class="comment">“${esc(f.comment)}”</p>${footerMark()}${resultActions('life')}${!sharedView?themeRow:''}</section><p class="note">人生档案纯属虚构，快乐可以当真。</p>`);
}
function choices(){
 const mo=viewMotion('choice');
 const items=normalizeChoices(choiceText);const overLimit=choiceMode==='slow'&&items.length>16;
 shell(titles.choice,'小事随缘，大事自己定。今天先少纠结一件。',renderChoice({lang:language,scenes:packs.choice.scenes,sceneId,mode:choiceMode,items,text:choiceText,round:choiceRound,quickResult:quickResultIndex===null?null:{index:quickResultIndex,text:items[quickResultIndex]},quickExcluded,quickAccepted,busy:choiceBusy,overLimit,art:dice,motion:mo,history:renderChoiceHistory({lang:language,scenes:packs.choice.scenes,entries:loadChoiceHistory()})}));
}
function loadTask(){let saved=state;if(!memoryOnly){try{saved=JSON.parse(localStorage.getItem(taskKey)||'null');}catch{memoryOnly=true;}}state=taskState(saved,packs.task);}
function saveTask(){try{localStorage.setItem(taskKey,JSON.stringify(state));}catch{memoryOnly=true;}}
function loadLifeEndings(){if(lifeEndings!==null)return lifeEndings;try{lifeEndings=JSON.parse(localStorage.getItem(lifeEndingsKey)||'{}');}catch{lifeEndings={};}return lifeEndings;}
function saveLifeEnding(theme,endingId){const map=loadLifeEndings();const got=new Set(map[theme]||[]);if(got.has(endingId))return;got.add(endingId);map[theme]=[...got];lifeEndings=map;try{localStorage.setItem(lifeEndingsKey,JSON.stringify(map));}catch{}}
function loadChoiceHistory(){if(choiceHistory!==null)return choiceHistory;try{choiceHistory=JSON.parse(localStorage.getItem(choiceHistoryKey)||'[]');if(!Array.isArray(choiceHistory))choiceHistory=[];}catch{choiceHistory=[];}return choiceHistory;}
function saveChoiceEntry(entry){const list=loadChoiceHistory();list.unshift(entry);if(list.length>60)list.length=60;choiceHistory=list;try{localStorage.setItem(choiceHistoryKey,JSON.stringify(list));}catch{}}
function clearChoiceHistory(){choiceHistory=[];try{localStorage.removeItem(choiceHistoryKey);}catch{}}
function recordCurrentChoice(){if(choiceRecorded)return;const items=normalizeChoices(choiceText);const scene=choicePreset?sceneId:'custom';if(choiceMode==='slow'&&choiceRound?.result){saveChoiceEntry({sceneId:scene,mode:'slow',result:items[choiceRound.result.index]||choiceRound.result.text,total:items.length,eliminated:choiceRound.records.flatMap(r=>r.droppedIndices).map(i=>items[i]).filter(Boolean),at:beijingDate()});choiceRecorded=true;}else if(choiceMode==='quick'&&quickResultIndex!==null){saveChoiceEntry({sceneId:scene,mode:'quick',result:items[quickResultIndex],total:items.length,eliminated:quickExcluded.map(i=>items[i]).filter(Boolean),at:beijingDate()});choiceRecorded=true;}}
function tasks(){
 const mo=viewMotion('task');
 if(!sharedView)loadTask();
 const id=sharedView?new URLSearchParams(location.search).get('r'):state.currentTaskId;
 const base=packs.task.tasks.find(t=>t.id===id&&t.status==='published');if(!base){invalid();return;}
 const selectedAngle=taskAngleSelections.get(id)??null;const t={...base,angles:taskAnglePair(language,id),selectedAngle};const viewState=state||taskState(null,packs.task);const done=!sharedView&&viewState.todayDoneIds.includes(t.id);const stamped=!sharedView&&viewState.doneIds.includes(t.id);
 const sharedActions=`<div class="actions" data-no-translate><a class="button dark" href="${esc(currentLink('task'))}">${esc(gameText(language,'task','claim'))} ↗</a><button class="button light" data-action="experiment-action" data-experiment-action="task-copy">${esc(gameText(language,'task','copy'))}</button><button class="button light" data-action="experiment-action" data-experiment-action="task-invite">${esc(gameText(language,'task','invite'))} ↗</button></div>`;
 const personalActions=`<div class="actions" data-no-translate><button class="button light" data-action="experiment-action" data-experiment-action="task-copy">${esc(gameText(language,'task','copy'))}</button><button class="button light" data-action="experiment-action" data-experiment-action="task-invite">${esc(gameText(language,'task','invite'))} ↗</button></div>`;
 shell(titles.task,'花一分钟，做件没什么用但有点开心的小事。',`${sharedNotice()}${renderTasks({lang:language,task:t,tasks:packs.task.tasks,state:viewState,todayDone:done,alreadyStamped:stamped,memoryOnly,shared:sharedView,art:flower,motion:mo})}${sharedView?sharedActions:personalActions}`);
}
function debugRoom(focusTarget=null,announce=false){
 const mo=viewMotion('debug');
 shell(titles.debug,'把毛病讲给鸭子听，它替你看出来。',renderDebugRoom({lang:language,content:debugRoomContent(language),state:debugState,motion:mo,art:duck}));
 if(focusTarget)app.querySelector(focusTarget)?.focus({preventScroll:focusTarget.startsWith('[data-')});
 // This region lives outside #app, so replacing the game does not destroy it.
 const status=$('#debug-announcement');
 if(announce&&status){status.textContent='';requestAnimationFrame(()=>{if(route==='debug')status.textContent=app.querySelector('.debug-bubble')?.textContent||'';});}
}
function resetChoiceRound(){choiceGeneration++;choiceBusy=false;choiceRound=null;quickResultIndex=null;quickExcluded=[];quickAccepted=false;choiceRecorded=false;}
function sceneOptions(id=sceneId){return packs.choice.scenes.find(s=>s.id===id)?.options.map(o=>o.text)||[];}
function setChoiceScene(id){sceneId=id;choicePreset=true;choiceText=sceneOptions(id).join('\n');resetChoiceRound();choiceResult=null;}
function selectedChoice(){if(choiceMode==='slow'){const i=choiceRound?.result?.index;return i===undefined?'':normalizeChoices(choiceText)[i]||choiceRound.result.text||'';}return quickResultIndex===null?'':normalizeChoices(choiceText)[quickResultIndex]||'';}
function invalid(){shell(titles[route]||'这份脑洞走丢了','旧纸条可能已经收起来了，新脑洞还在。',`<section class="workbench ${esc(route)} empty"><span class="squiggle">${brandMark}</span><h2>这份结果暂时无法还原</h2><p>链接可能不完整，或原内容已下架。<br>没关系，再给好奇心一次机会。</p><a class="button dark" href="${link('/'+(Object.hasOwn(titles,route)?route:''))}" style="margin-top:25px">${route==='persona'?'我也测一下':'重新体验'} ↗</a></section>`);}
function info(){app.innerHTML=renderDocument('/'+route,language);localize(app);}
let statsDays=7,statsRequest=0;
async function stats(){
 const request=++statsRequest;
 shell('活动统计','按页面、链接和语言查看使用情况。','<div class="loading">正在加载统计……</div>','stats');
 try{const response=await fetch('/api/stats?days='+statsDays);if(!response.ok)throw Error(response.status);const data=await response.json();if(request!==statsRequest)return;
 const table=(rows,keys)=>`<div class="table-scroll"><table><thead><tr>${keys.map(([key,label])=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${keys.map(([key])=>`<td>${key==='target_url'?`<a href="${esc(row[key])}" target="_blank" rel="noopener" data-no-translate>${esc(row[key])}</a>`:esc(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 shell('活动统计','按页面、链接和语言查看使用情况。',`<section class="workbench stats"><div class="actions stats-filters">${[7,30,90].map(days=>`<button class="chip ${statsDays===days?'active':''}" data-action="stats-days" data-value="${days}">过去 ${days} 天</button>`).join('')}<button class="text-button" data-action="stats-refresh">刷新统计</button></div><div class="stats-totals"><div><span>页面访问</span><strong>${data.totals.page_views.toLocaleString(language)}</strong></div><div><span>操作点击</span><strong>${data.totals.clicks.toLocaleString(language)}</strong></div></div><h2>按日汇总</h2>${data.daily.length?table(data.daily,[['day','日期'],['page_views','页面访问'],['clicks','操作点击']]):'<p class="note">暂无记录。开始使用网站后，这里会显示汇总数据。</p>'}<h2>查看明细</h2>${data.rows.length?table(data.rows,[['kind_label','操作'],['source_path','来源页面'],['target_url','目标地址'],['action','操作'],['locale','语言'],['count','次数']]):''}<p class="note">统计按 UTC+8 日期汇总，展示最多 200 行明细；合计包含整个所选时段。次数是事件数，包含复测点击，并非访客人数。</p></section>`,'stats');
 }catch{if(request===statsRequest)shell('活动统计','按页面、链接和语言查看使用情况。','<section class="empty"><p>统计暂时无法加载，请稍后重试。</p><button class="button" data-action="stats-refresh">刷新统计</button></section>','stats');}
}
function render(){if(!PAGES&&(route==='stats'||route==='admin'))stats();else if(route==='index')home();else if(route==='dispatch'){const requested=new URLSearchParams(location.search).get('level'),level=['return','market','festival','storm'].includes(requested)?requested:'first';mountDispatch(app,language,level);}else if(route==='persona')persona();else if(route==='life')life();else if(route==='choice')choices();else if(route==='task')tasks();else if(route==='debug')debugRoom();else if(['about','privacy','terms','contact'].includes(route))info();else invalid();}
function payload(share=false){
 if(route==='persona'&&personaResult){const r=personaResult;return `${share?r.share:[t(titles.persona)+': '+r.name,r.tagline,'',r.desc,'',t('你的隐藏优点')+': '+r.pro,t('一条奇怪的习惯')+': '+r.habit].join('\n')}\n${currentLink('persona',r.id)}`;}
 if(route==='life'&&lifeResult){const r=lifeResult,f=r.fields;return `${share?f.share:[t(titles.life)+': '+f.title,...[['人生职业',f.career],['你的特殊技能',f.skill],['命运拐了个弯',f.twist],['最后，你的结局',f.ending]].map(([k,v])=>t(k)+': '+v),'',f.comment].join('\n')}\n${currentLink('life',r.id,r.entryVersion)}`;}
 if(route==='task'){const id=sharedView?new URLSearchParams(location.search).get('r'):state.currentTaskId;const task=packs.task.tasks.find(x=>x.id===id);return `${t(titles.task)}${!sharedView&&state.doneIds.includes(id)?' ✓':''}: ${task.text}\n${currentLink('task',id)}`;}
 if(route==='debug')return `${debugCommit(language,debugState.wrong,debugState.hintsUsed)}\n${currentLink('debug')}`;
 return `${share?t('小事随缘，大事自己定。今天先少纠结一件。'):t(titles.choice)+': '+(choiceResult||'')}\n${currentLink('choice')}`;
}
async function copy(text){
 try{await navigator.clipboard.writeText(text);toast('已复制，把这份脑洞带走吧。');return true;}catch{}
 const box=$('#copy-text');box.value=text;
 const dialog=$('#copy-dialog');if(!dialog.open)dialog.showModal();box.focus();box.select();box.setSelectionRange(0,text.length);
 try{if(document.execCommand('copy')){dialog.close();toast('已复制，把这份脑洞带走吧。');return true;}}catch{}
 toast('文案已选中，可以手动复制。');return false;
}
app.addEventListener('input',e=>{if(e.target.id!=='choice-options')return;const area=e.target,start=area.selectionStart,end=area.selectionEnd;choiceText=area.value;choicePreset=false;choiceResult=null;resetChoiceRound();choices();const next=$('#choice-options');next?.focus({preventScroll:true});next?.setSelectionRange(start,end);});
app.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.experimentAction||b.dataset.action,v=b.dataset.value;
 if(a==='persona-question'){const next=Number(v);motion={type:'quiz',dir:personaEditQuestion!==null&&next<personaEditQuestion?'prev':'next'};personaEditQuestion=next;personaEditAnswer=answers[personaEditQuestion]??null;personaPreview=null;persona();}
 else if(a==='persona-answer'){motion={type:'select'};personaEditAnswer=Number(v);personaPreview=null;persona();}
 else if(a==='persona-preview'){if(personaEditQuestion===null||personaEditAnswer===null)return;personaPreview=previewPersonaAnswer(answers,personaEditQuestion,personaEditAnswer,packs.persona,personaSet);motion={type:'preview'};persona();}
 else if(a==='persona-adopt'){if(!personaPreview)return;answers=adoptPersonaPreview(answers,personaPreview);personaResult=packs.persona.results[calculatePersona(answers,packs.persona,personaSet)];sharedView=false;personaPreview=null;personaEditQuestion=null;personaEditAnswer=null;setResultURL(personaResult.id);motion={type:'result'};persona();}
 else if(a==='persona-cancel'){personaPreview=null;personaEditQuestion=null;personaEditAnswer=null;persona();}
 else if(a==='persona-set'){const nextSet=Number(v);if(nextSet===personaSet)return;personaSet=nextSet;answers=[];questionIndex=0;personaResult=null;personaPreview=null;personaEditQuestion=null;personaEditAnswer=null;clearResultURL();persona();}
 else if(a==='life-tab'){lifeMode=v;if(v==='adventure'){if(new URLSearchParams(location.search).has('r'))clearResultURL();lifeResult=null;}life();}
 else if(a==='life-world'){lifeTheme=v;adventureState=null;life();}
 else if(a==='life-start'){adventureState=createAdventure(lifeTheme);motion={type:'scene'};life();}
 else if(a==='life-choice'){const content=adventureContent(language)[lifeTheme];const scene=content.scenes[adventureState?.stage];const choice=scene?.choices.find(item=>item.id===v);if(!choice)return;const before=adventureState?.resources;try{adventureState=chooseAdventure(adventureState,choice,scene);}catch{return;}if(adventureState.done){const eid=adventureEndingId(adventureState,content);if(eid)saveLifeEnding(lifeTheme,eid);}const after=adventureState.resources;motion={type:'scene',res:before?['time','favor'].filter(key=>before[key]!==after[key]):[]};life();}
 else if(a==='life-undo'){if(adventureState)adventureState=undoLastAdventureChoice(adventureState);motion={type:'scene'};life();}
 else if(a==='life-reset'){adventureState=null;lifeTheme=lifeTheme||'modern';life();}
 else if(a==='life-invite'){const url=currentLink('life');if(navigator.share){try{await navigator.share({title:'OddLab',text:gameText(language,'life','storyShare'),url});}catch(err){if(err.name!=='AbortError')await copy(url);}}else await copy(url);}
 else if(a==='choice-mode'){choiceMode=v;resetChoiceRound();choices();}
 else if(a==='choice-scene'){if(v!==sceneId){setChoiceScene(v);choices();}}
 else if(a==='choice-clear'){choiceText='';choicePreset=false;resetChoiceRound();choices();$('#choice-options')?.focus();}
 else if(a==='choice-duel-start'){const items=normalizeChoices(choiceText);if(items.length<2||items.length>16){choices();return;}try{resetChoiceRound();choiceRound=createChoiceRound(items);}catch{toast(gameText(language,'choice','max'));}motion={type:'duel'};choices();}
 else if(a==='choice-pair'){if(choiceRound)choiceRound=drawChoicePair(choiceRound);motion={type:'duel'};choices();}
 else if(a==='choice-keep'){if(choiceRound)choiceRound=resolveChoicePair(choiceRound,Number(v));motion={type:'record'};choices();}
 else if(a==='choice-drop'){if(choiceRound)choiceRound=resolveChoicePair(choiceRound,null);motion={type:'record'};choices();}
 else if(a==='choice-undo'){if(choiceRound)choiceRound=undoChoiceRound(choiceRound);motion={type:'record'};choices();}
 else if(a==='choice-reset'){resetChoiceRound();choices();}
 else if(a==='choice-restore'){if(choiceRound)choiceRound=restoreChoiceRound(choiceRound);quickExcluded=[];quickAccepted=false;choices();}
 else if(a==='choice-draw'){if(choiceBusy)return;const active=normalizeChoices(choiceText).map((text,index)=>({text,index})).filter(item=>!quickExcluded.includes(item.index));if(!active.length){choices();return;}const token=++choiceGeneration;choiceBusy=true;choices();setTimeout(()=>{if(token!==choiceGeneration||choiceMode!=='quick')return;const pick=active[Math.floor(Math.random()*active.length)];quickResultIndex=pick.index;choiceBusy=false;motion={type:'draw'};choices();},450);}
 else if(a==='choice-exclude'){if(quickResultIndex===null)return;quickExcluded=[...new Set([...quickExcluded,quickResultIndex])];quickResultIndex=null;quickAccepted=false;choices();}
 else if(a==='choice-accept'){if(choiceMode==='slow'){if(!choiceRound)return;try{choiceRound=acceptChoiceRound(choiceRound);}catch{return;}}else if(quickResultIndex!==null)quickAccepted=true;recordCurrentChoice();choices();}
 else if(a==='choice-copy'){const result=selectedChoice();if(result)await copy(result);}
 else if(a==='choice-invite'){const url=currentLink('choice');if(navigator.share){try{await navigator.share({title:'OddLab',text:gameText(language,'choice','invite'),url});}catch(err){if(err.name!=='AbortError')await copy(url);}}else await copy(url);}
else if(a==='choice-history-clear'){clearChoiceHistory();choices();}
 else if(a==='task-angle'){if(sharedView)return;const id=state?.currentTaskId;if(id)taskAngleSelections.set(id,Number(v));motion={type:'angle'};tasks();}
 else if(a==='task-complete'){if(sharedView)return;loadTask();const id=state.currentTaskId;state=taskCompletion(state,id);state.todayDoneIds=[...new Set([...(state.todayDoneIds||[]),id])];state={...state,...stampStreak(state),...stampWeek(state)};saveTask();motion={type:'stamp'};tasks();}
 else if(a==='task-copy'){await copy(payload(false));}
 else if(a==='task-invite'){const text=payload(true);if(navigator.share){try{await navigator.share({title:'OddLab',text,url:text.split('\n').at(-1)});}catch(err){if(err.name!=='AbortError')await copy(text);}}else await copy(text);}
 else if(a==='task-swap'){if(sharedView)return;loadTask();if(state.swapsUsed>=2)return;const candidates=packs.task.tasks.filter(task=>task.status==='published'&&task.id!==state.currentTaskId);if(!candidates.length)return;state.currentTaskId=randomOne(candidates).id;state.swapsUsed++;saveTask();motion={type:'swap'};tasks();}
 else if(a==='choice-slow-accept'){if(choiceRound)choiceRound=acceptChoiceRound(choiceRound);choices();}
 else if(a==='stats-days'){statsDays=Number(v);stats();}
 else if(a==='debug-inspect'){const level=debugRoomContent(language)[debugState.index];const next=inspectDebugStep(debugState,level,Number(v));if(next===debugState)return;debugState=next;motion={type:next.found===null?'look':'found'};debugRoom(next.found===null?`[data-experiment-action="debug-inspect"][data-value="${Number(v)}"]`:'.debug-fix-prompt',true);}
 else if(a==='debug-hint'){const next=requestDebugHint(debugState);if(next===debugState)return;debugState=next;motion={type:'hint'};debugRoom('.debug-bubble');}
 else if(a==='debug-fix'){const level=debugRoomContent(language)[debugState.index];const next=chooseDebugFix(debugState,level,v);if(next===debugState)return;const picked=next.fixId!==null;debugState=next;motion={type:picked?'fixed':'wrong'};debugRoom(picked?'[data-experiment-action="debug-next"]':`[data-experiment-action="debug-fix"][data-value="${v}"]`,true);}
 else if(a==='debug-next'){const next=advanceDebugRoom(debugState);if(next===debugState)return;debugState=next;const done=debugState.index>=debugRoomContent(language).length;motion={type:done?'done':'level'};debugRoom(done?'.debug-log h3':'.debug-title',true);}
 else if(a==='debug-restart'){debugState=createDebugRoom();motion={type:'enter'};debugRoom('.debug-title',true);}
 else if(a==='debug-copy'){await copy(payload(false));}
 else if(a==='debug-invite'){const text=payload(false);if(navigator.share){try{await navigator.share({title:'OddLab',text,url:currentLink('debug')});}catch(err){if(err.name!=='AbortError')await copy(text);}}else await copy(text);}
 else if(a==='stats-refresh')stats();
 else if(a==='answer'){answers[questionIndex]=Number(v);motion={type:'select'};persona();}
 else if(a==='previous'){questionIndex--;motion={type:'quiz',dir:'prev'};persona();}
 else if(a==='next'){if(answers[questionIndex]===undefined)return;if(questionIndex<personaQuestions().length-1){questionIndex++;motion={type:'quiz',dir:'next'};persona();$('.question').focus({preventScroll:true});}else{personaResult=packs.persona.results[calculatePersona(answers,packs.persona,personaSet)];setResultURL(personaResult.id);motion={type:'result'};persona();}}
 else if(a==='theme'){lifeTheme=v;lifeResult=null;lifeDraws=0;lifeSeen=[];clearResultURL();life();}
 else if(a==='draw-life'){lifeResult=pickLife(packs.life,lifeTheme,lifeSeen,lifeDraws);if(!lifeResult){toast('这扇门还没开，换个世界试试。');return;}lifeSeen.push(lifeResult.id);lifeDraws++;setResultURL(lifeResult.id,lifeResult.entryVersion);life();}
 else if(a==='scene'){sceneId=v;choiceText=packs.choice.scenes.find(s=>s.id===v).options.map(o=>o.text).join('\n');choiceResult=null;choices();}
 else if(a==='clear-choices'){choiceText='';choiceResult=null;choices();$('#choice-options').focus();}
 else if(a==='draw-choice'){
  if(choiceBusy)return;const items=normalizeChoices(choiceText);if(items.length<2)return;
  const duplicates=choiceText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).length>items.length;
  choiceText=items.join('\n');choiceResult=null;choiceBusy=true;choices();
  setTimeout(()=>{choiceResult=randomOne(items);choiceBusy=false;choices();if(duplicates)toast('有重复选项，已经帮你合并了。');$('.choice-result').scrollIntoView({block:'nearest',behavior:'smooth'});},550);
 }
 else if(a==='complete'){loadTask();if(!state.doneIds.includes(state.currentTaskId))state.doneIds.push(state.currentTaskId);saveTask();tasks();}
 else if(a==='copy')await copy(payload(false));
 else if(a==='share'){const text=payload(true);if(navigator.share){try{await navigator.share({title:'OddLab',text,url:text.split('\n').at(-1)});}catch(err){if(err.name!=='AbortError')await copy(text);}}else await copy(text);}
 else if(a==='restart'){if(route==='life'&&!sharedView){b.dataset.action='draw-life';b.click();return;}clearResultURL();if(route==='persona'){answers=[];questionIndex=0;personaResult=null;}if(route==='life'){lifeResult=null;lifeSeen=[];lifeDraws=0;}render();}
 else if(a==='feedback')await copy(language==='zh'?'脑洞研究所反馈小纸条\n我玩了：\n让我开心的地方：\n让我卡住的地方：\n我愿意再玩 / 分享吗：':t('复制反馈模板'));
 else if(a==='clear-progress'){try{localStorage.removeItem(taskKey);}catch{}state=null;toast('本机任务进度已清除。');}
});
function checkDay(){if(route==='task'&&!sharedView&&state&&state.date!==beijingDate()){loadTask();saveTask();tasks();toast('新的一天，新的小挑战。');}}
window.addEventListener('storage',e=>{if(e.key===taskKey&&route==='task'&&!sharedView){state=null;tasks();}});window.addEventListener('focus',checkDay);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDay();});setInterval(checkDay,30000);
async function boot(){
 try{
  Object.assign(packs,await loadPacks(language));
  if(route==='choice'){sceneId=packs.choice.scenes[0].id;choiceText=packs.choice.scenes[0].options.map(o=>o.text).join('\n');choicePreset=true;}
  const params=new URLSearchParams(location.search);
  if(params.has('r')&&Object.hasOwn(titles,route)&&route!=='choice'&&route!=='debug'){
   const id=params.get('r');sharedView=true;
   if(route==='persona'){personaResult=Object.values(packs.persona.results).find(r=>r.id===id);if(!personaResult){invalid();return;}}
   if(route==='life'){lifeMode='archive';lifeResult=resolveLife(packs.life,id,params.get('v'));if(!lifeResult){invalid();return;}lifeTheme=lifeResult.theme;}
   if(route==='task'&&!packs.task.tasks.some(t=>t.id===id&&t.status==='published')){invalid();return;}
  }
  render();
  if(route==='persona'&&!personaResult&&performance.getEntriesByType('navigation')[0]?.type==='reload')toast('从头再来，很快的。');
 }catch(err){shell('脑洞暂时没打开','等一下，再给好奇心一次机会。','<div class="empty"><p>内容加载遇到了一点小问题。</p><button class="button dark" data-action="reload" style="margin-top:20px">重新打开 ↻</button></div>','error');app.querySelector('[data-action="reload"]').onclick=()=>location.reload();}
}
async function loadPacks(lang){const r=await fetch(asset('/locales/'+lang+'.json'));if(!r.ok)throw Error('locale');return r.json();}
const languageControl=document.querySelector('#language');
function applyLanguage(){setLanguage(language);languageControl.value=language;localize(document.body);updateMetadata();const guide=$('#page-guide');if(guide)guide.innerHTML=renderGuide(route==='index'?'/':'/'+route,language);}
function updateMetadata(){
 const path=route==='index'?'/':'/'+route;if(route==='stats'||route==='admin'){document.title=t('活动统计')+' · OddLab';return;}
 const d=pageData(path,language);document.title=path==='/'?'OddLab · '+words('今天，来点不一样的。','A little odd. A little joy.','日常に小さな驚きを。','Un poco peculiar. Un poco de alegría.'):d.title+' · OddLab';
 const set=(selector,attribute,value)=>{const el=document.querySelector(selector);if(el)el.setAttribute(attribute,value);};
 set('meta[name="description"]','content',d.description);set('meta[property="og:title"]','content',document.title);set('meta[property="og:description"]','content',d.description);set('meta[property="og:url"]','content',canonicalURL(path,language));set('link[rel="canonical"]','href',canonicalURL(path,language));set('meta[name="robots"]','content',new URLSearchParams(location.search).has('r')?'noindex,follow':'index,follow');
}
languageControl.addEventListener('change',async e=>{const next=e.target.value,previous=language,heldFocus=document.activeElement===languageControl;if(choiceBusy){e.target.value=previous;return;}languageControl.disabled=true;try{
 const translated=await loadPacks(next);
 Object.assign(packs,translated);setLanguage(next);if(personaResult)personaResult=Object.values(packs.persona.results).find(x=>x.id===personaResult.id);if(lifeResult)lifeResult=resolveLife(packs.life,lifeResult.id,String(lifeResult.entryVersion));if(choicePreset){choiceText=sceneOptions(sceneId).join('\n');if(choiceRound){const localized=normalizeChoices(choiceText);choiceRound.original=choiceRound.original.map(item=>({...item,text:localized[item.index]??item.text}));if(choiceRound.undo)choiceRound.undo.records=choiceRound.undo.records.map(record=>({...record,kept:record.keptIndex===null?null:localized[record.keptIndex],dropped:record.droppedIndices.map(i=>localized[i])}));}}
 applyLanguage();render();
 }catch{languageControl.value=previous;toast('内容加载遇到了一点小问题。');}finally{languageControl.disabled=false;if(heldFocus&&(document.activeElement===document.body||document.activeElement===document.documentElement||document.activeElement===languageControl))languageControl.focus({preventScroll:true});}});
applyLanguage();startAnalytics(()=>language);languageControl.disabled=true;boot().finally(()=>{languageControl.disabled=false;});
