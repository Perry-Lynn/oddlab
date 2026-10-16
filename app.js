import {pageData,renderGuide,renderDocument,canonicalURL} from './page-content.mjs';
import { languages, language, setLanguage, localize, t, words } from './i18n.mjs';
import { startAnalytics } from './analytics.mjs';
import { calculatePersona, beijingDate, dailyTask, taskState, randomOne, pickLife, normalizeChoices, resolveLife } from './logic.mjs';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app = $('#app');
const route = location.pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '') || 'index';
const titles = {persona:'你的离谱人格',life:'平行人生模拟器',choice:'今天听天由命',task:'今日奇怪任务'};
const packs = {};
let answers=[], questionIndex=0, personaResult=null, lifeTheme='random', lifeResult=null, lifeSeen=[], lifeDraws=0;
let sceneId='eat', choiceText='', choiceResult=null, choiceBusy=false, sharedView=false;
let state=null, memoryOnly=false, toastTimer;
const taskKey='oddlab_task_v1';
const face = `<svg viewBox="0 0 220 220" fill="none" aria-hidden="true"><path d="M65 44L86 20L111 44L140 26L157 53L188 53L181 88L205 109L180 133L188 165L154 169L136 199L108 181L78 198L65 168L30 163L40 131L18 107L43 83L35 51Z" fill="#f8f4e9" stroke="#292c25" stroke-width="2.5"/><ellipse cx="89" cy="94" rx="20" ry="27" fill="#292c25" transform="rotate(-8 89 94)"/><ellipse cx="137" cy="94" rx="20" ry="27" fill="#292c25" transform="rotate(8 137 94)"/><ellipse cx="96" cy="89" rx="6" ry="9" fill="#f8f4e9"/><ellipse cx="143" cy="89" rx="6" ry="9" fill="#f8f4e9"/><path d="M82 139Q110 164 144 135" stroke="#292c25" stroke-width="3" stroke-linecap="round"/><path d="M61 124l14 3M153 126l15-4" stroke="#df6441" stroke-width="5" stroke-linecap="round"/><path d="M182 13v15m-7-8h15M17 179v14m-7-7h14" stroke="#292c25" stroke-width="2"/></svg>`;
const door = `<svg viewBox="0 0 150 150" fill="none" aria-hidden="true"><path d="M31 128V31Q75 0 119 31V128" stroke="#292c25" stroke-width="3"/><path d="M42 128V38Q75 15 108 38V128" fill="#f9f5e9" stroke="#292c25" stroke-width="2"/><path d="M61 128V41L108 31V128Z" fill="#b6a0d3" stroke="#292c25" stroke-width="2.5"/><circle cx="94" cy="83" r="4" fill="#292c25"/><path d="M19 130h113M21 49l-8 8m111-40 10-8m-4 49h13" stroke="#292c25" stroke-width="2" stroke-linecap="round"/><path d="M25 17v17M17 25h17" stroke="#df6441" stroke-width="2.5"/></svg>`;
const dice = `<svg viewBox="0 0 150 150" fill="none" aria-hidden="true"><g transform="rotate(-13 75 75)"><rect x="27" y="27" width="96" height="96" rx="21" fill="#f8f4e9" stroke="#292c25" stroke-width="3"/><g fill="#292c25"><circle cx="51" cy="51" r="7"/><circle cx="99" cy="51" r="7"/><circle cx="75" cy="75" r="7"/><circle cx="51" cy="99" r="7"/><circle cx="99" cy="99" r="7"/></g></g><path d="M126 16v18m-9-9h18M13 113l-5 10m129-29 10 4" stroke="#df6441" stroke-width="3" stroke-linecap="round"/></svg>`;
const flower = `<svg viewBox="0 0 150 150" fill="none" aria-hidden="true"><path d="M77 96v42m0-19q-29-29-35-7 12 18 35 7m0 9q26-31 34-13-9 17-34 13" stroke="#292c25" stroke-width="3"/><path d="M77 22C92 0 107 20 103 37C134 27 139 53 116 66C144 81 124 105 103 93C104 121 76 123 69 98C48 119 29 98 42 79C12 73 22 45 46 47C30 23 53 9 68 29Z" fill="#efcc5b" stroke="#292c25" stroke-width="2.5"/><circle cx="78" cy="65" r="22" fill="#faf5e8" stroke="#292c25" stroke-width="2"/><circle cx="71" cy="62" r="2.5" fill="#292c25"/><circle cx="85" cy="62" r="2.5" fill="#292c25"/><path d="M70 72q9 8 17-1" stroke="#292c25" stroke-width="2" stroke-linecap="round"/></svg>`;
function toast(text){ clearTimeout(toastTimer);$('#toast').textContent=t(text);$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500); }
function shell(title, subtitle, content, kind=route){
 app.innerHTML=`<div class="tool-wrap"><a class="back" href="/">← 回研究所</a><div class="tool-head"><div class="eyebrow">ODDLAB / ${esc(kind.toUpperCase())}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${content}${titles[kind]?crosslinks(kind):''}</div>`;localize(app);
}
function crosslinks(kind){return `<div class="crosslinks"><span>玩腻了试试</span>${Object.keys(titles).filter(k=>k!==kind).slice(0,2).map(k=>`<a href="/${k}">${titles[k]} ↗</a>`).join('')}</div>`;}
function footerMark(){return '<div class="result-bottom"><span>✳ 脑洞研究所 / OddLab</span><span>认真生活，偶尔离谱。</span></div>';}
function currentLink(kind,id,version){const u=new URL('/'+kind,location.origin);u.searchParams.set('lang',language);if(id)u.searchParams.set('r',id);if(version)u.searchParams.set('v',String(version));return u.href;}
function resultActions(kind){return `<div class="actions"><button class="button dark" data-action="copy">复制结果</button><button class="button light" data-action="share">${navigator.share?'分享 ↗':'复制分享链接'}</button><button class="button push" data-action="restart">${sharedView?'我也来玩':'再来一次'} ↻</button></div>`;}
function setResultURL(id,version){const u=new URL(location.href);u.search='';u.searchParams.set('lang',language);u.searchParams.set('r',id);if(version)u.searchParams.set('v',version);history.replaceState(null,'',u.pathname+u.search);updateMetadata();}
function clearResultURL(){history.replaceState(null,'','/'+route+'?lang='+language);sharedView=false;updateMetadata();}
function sharedNotice(){return sharedView?'<div class="shared">↗ 这是一份分享给你的脑洞。看完了，你也来试试？</div>':'';}
function home(){
 const task=dailyTask(packs.task); const date=beijingDate();
 app.innerHTML=`<section class="home-hero"><div class="intro"><div class="eyebrow">A LITTLE ODD. A LITTLE JOY.</div><h1>今天，<br>来点<em>不一样的。</em></h1><p>无聊的时候，给生活增加一点随机性。<br>每天花一分钟，发现一点小惊喜。</p><div class="intro-note"><span class="mini-spark" aria-hidden="true">✳</span><span>不必准备，不用注册，带上好奇心就行。</span></div></div><a class="feature" href="/persona"><div class="feature-top"><span class="pill">本期主打 · 离谱人格</span><span>NO. 01</span></div><h2>你是哪种<br>离谱的人？</h2><p>6 道题，挖掘你的隐藏人设。<br>别太认真，但可能有点准。</p><div class="feature-illustration">${face}</div><span class="feature-stamp">纯属娱乐 · 欢迎对号入座</span><div class="feature-action"><span>用 1 分钟，认识另一个你</span><span class="round-arrow" aria-hidden="true">↗</span></div></a></section><section id="play"><div class="section-heading"><h2>换个脑洞，继续逛逛</h2><span>SMALL EXPERIMENTS / 随便玩玩</span></div><div class="play-grid"><a class="play-card life-bg" href="/life"><div class="card-top"><span>NO. 02 / 另一种可能</span><span>约 10 秒</span></div><div class="card-art">${door}</div><h3>平行人生模拟器</h3><p>如果人生可以重新抽签，<br>你会在哪个世界，干哪份离谱工作？</p><div class="card-bottom"><span>去另一个世界上个班</span><span class="small-arrow">↗</span></div></a><a class="play-card choice-bg" href="/choice"><div class="card-top"><span>NO. 03 / 小事随缘</span><span>约 10 秒</span></div><div class="card-art">${dice}</div><h3>今天听天由命</h3><p>吃什么？看什么？要不要出门？<br>把小纠结交给随机，大事还是自己定。</p><div class="card-bottom"><span>帮我做个小决定</span><span class="small-arrow">↗</span></div></a><a class="play-card task-bg" href="/task"><div class="card-top"><span>NO. 04 / 今日奇怪任务</span><span>${date.slice(5).replace('-',' / ')}</span></div><div class="card-art">${flower}</div><h3>给日常加点戏</h3><p>${esc(task.text)}</p><div class="card-bottom"><span>接受今天的小挑战</span><span class="small-arrow">↗</span></div></a></div></section><div class="home-end">不用每件事都有意义，有点开心也很好。</div>`;localize(app);
}
function persona(){
 if(personaResult){const r=personaResult;shell(titles.persona,'你的小小离谱，值得被认真收藏。',`${sharedNotice()}<section class="workbench persona"><div class="result-kicker">YOUR ODD PERSONALITY / 人格鉴定报告</div><div class="result-head"><div class="result-art">${face}</div><div><h2 class="result-title">${esc(r.name)}</h2><p class="tagline">${esc(r.tagline)}</p></div></div><p class="result-desc">${esc(r.desc)}</p><div class="result-detail"><dl><dt>你的隐藏优点</dt><dd>${esc(r.pro)}</dd></dl><dl><dt>一条奇怪的习惯</dt><dd>${esc(r.habit)}</dd></dl></div>${footerMark()}${resultActions('persona')}</section><p class="note">娱乐内容，非心理诊断、医学建议或科学测评。</p>`);return;}
 const q=packs.persona.questions[questionIndex];shell(titles.persona,'凭直觉选就好。这里没有标准答案，只有你的答案。',`<section class="workbench persona"><div class="bench-top"><span>认识你的另一面</span><span>0${questionIndex+1} / 0${packs.persona.questions.length}</span></div><div class="progress" aria-label="答题进度"><span style="width:${(questionIndex+1)/6*100}%"></span></div><h2 class="question" tabindex="-1">${esc(q.text)}</h2><div class="answers">${q.options.map((o,i)=>`<button class="answer ${answers[questionIndex]===i?'selected':''}" aria-pressed="${answers[questionIndex]===i}" data-action="answer" data-value="${i}"><span class="answer-key">${'ABCD'[i]}</span><span>${esc(o.text)}</span></button>`).join('')}</div><div class="actions"><button class="button" data-action="previous" ${questionIndex===0?'disabled':''}>← 上一题</button><button class="button dark push" data-action="next" ${answers[questionIndex]===undefined?'disabled':''}>${questionIndex===5?'看看我的人格 ↗':'下一题 →'}</button></div></section><p class="note">6 道题 · 大约 1 分钟 · 娱乐内容，非科学测评</p>`);
}
function life(){
 const themes=[['random','随机世界'],...Object.entries(packs.life.themes)];
 const themeRow=`<div class="theme-row" aria-label="选择人生主题">${themes.map(([id,title])=>`<button class="chip ${lifeTheme===id?'active':''}" aria-pressed="${lifeTheme===id}" data-action="theme" data-value="${id}">${title}</button>`).join('')}</div>`;
 if(!lifeResult){shell(titles.life,'这辈子先这样，另一辈子可以大胆一点。',`<section class="workbench life"><div class="life-placeholder">${door}<h2>另一种人生，等你开门</h2><p>选一个世界，看看那里的你在忙什么。</p></div>${themeRow}<button class="button dark wide" data-action="draw-life">抽取我的平行人生 ↗</button><p class="note">四个世界 · 十二种人生 · 不需要填写个人信息</p></section>`);return;}
 const r=lifeResult,f=r.fields;
 shell(titles.life,'人生没有如果，但这里可以有一份。',`${sharedNotice()}<section class="workbench life"><div class="bench-top"><span>PARALLEL LIFE / 人生档案</span><span>${esc(packs.life.themes[r.theme]||'另一个世界')}</span></div><h2 class="result-title">${esc(f.title)}</h2>${[['人生职业',f.career],['你的特殊技能',f.skill],['命运拐了个弯',f.twist],['最后，你的结局',f.ending]].map(([k,v])=>`<dl class="life-field"><dt>${k}</dt><dd>${esc(v)}</dd></dl>`).join('')}<p class="comment">“${esc(f.comment)}”</p>${footerMark()}${resultActions('life')}${!sharedView?themeRow:''}${lifeDraws>=6&&!sharedView&&lifeTheme==='random'?'<p class="note">你已经抽了很多人生了。挑个世界，进去待一会儿？</p>':''}</section><p class="note">人生档案纯属虚构，快乐可以当真。</p>`);
}
function choices(){
 const rows=normalizeChoices(choiceText);const valid=rows.length;
 shell(titles.choice,'小事随缘，大事自己定。今天先少纠结一件。',`<section class="workbench choice"><div class="scene-row" aria-label="选择场景">${packs.choice.scenes.map(s=>`<button class="chip ${sceneId===s.id?'active':''}" aria-pressed="${sceneId===s.id}" data-action="scene" data-value="${s.id}" ${choiceBusy?'disabled':''}>${esc(s.title)}</button>`).join('')}</div>${choiceResult?`<div class="choice-result choice-winner"><div class="result-art">${dice}</div><p class="result-kicker">命运的小纸条写着</p><h2 class="result-title" data-no-translate>${esc(choiceResult)}</h2><p class="quiet">${esc(packs.choice.scenes.find(s=>s.id===sceneId)?.options.find(o=>o.text===choiceResult)?.mood||'就这么愉快地决定了')}</p><div class="actions" style="justify-content:center"><button class="button dark" data-action="draw-choice">再抽一次 ↻</button><button class="button" data-action="copy">复制结果</button><button class="button light" data-action="share">${navigator.share?'分享玩法 ↗':'复制玩法链接'}</button></div></div><div class="divider"></div>`:''}<label class="editor-label" for="choice-options">候选清单<span>一行一个，可直接增删</span></label><textarea class="choice-editor" id="choice-options" ${choiceBusy?'disabled':''} maxlength="10000" spellcheck="false" placeholder="写下你的候选项，一行一个">${esc(choiceText)}</textarea><div class="editor-actions"><span id="choice-count">${valid} 个有效选项</span><button class="text-button" data-action="clear-choices" ${choiceBusy?'disabled':''}>全部清空</button></div><button id="draw-choice" class="button dark wide" data-action="draw-choice" ${valid<2||choiceBusy?'disabled':''}>${choiceBusy?'命运正在翻纸条……':valid===0?'好歹给两个选项':valid===1?'只剩一个选项，其实你已经决定了':choiceResult?'用这份清单重新抽取 ↗':'听天由命，帮我选 ↗'}</button><p class="note">空行会忽略，重复项会合并。自定义选项只留在当前页面。</p></section>`);
}
function loadTask(){let saved=state;if(!memoryOnly){try{saved=JSON.parse(localStorage.getItem(taskKey)||'null');}catch{memoryOnly=true;}}state=taskState(saved,packs.task);}
function saveTask(){try{localStorage.setItem(taskKey,JSON.stringify(state));}catch{memoryOnly=true;}}
function tasks(){
 if(!sharedView)loadTask();
 const id=sharedView?new URLSearchParams(location.search).get('r'):state.currentTaskId;
 const t=packs.task.tasks.find(t=>t.id===id&&t.status==='published');if(!t){invalid();return;}
 const done=!sharedView&&state.doneIds.includes(t.id);
 shell(titles.task,'花一分钟，做件没什么用但有点开心的小事。',`${sharedNotice()}<section class="workbench task"><div class="task-date"><span>${sharedView?'朋友的任务小纸条':beijingDate().replaceAll('-',' / ')+' · 今日挑战'}</span><span class="pill">约 1 分钟</span></div><div class="task-art">${flower}</div><div class="task-number">ODD LITTLE MISSION / ${esc(t.id.toUpperCase())}</div><h2 class="task-content">${esc(t.text)}</h2>${sharedView?'<a class="button dark" href="/task">领取我的今日任务 ↗</a>':`<div class="actions"><button class="button ${done?'':'dark'}" data-action="complete" ${done?'disabled':''}>${done?'✓ 已完成这项挑战':'我做到了 ✓'}</button><button class="button push" data-action="swap" ${state.swapsUsed>=2?'disabled':''}>${state.swapsUsed>=2?'明天再来换':'换一个 ↻'}</button></div>${done?'<p class="completed" role="status">收到。今天的日常，已经被你悄悄改写。</p>':''}<p class="note">今天还可换 ${2-state.swapsUsed} 次 · 北京时间每天更新</p>`}<div class="actions"><button class="button light" data-action="copy">复制任务</button><button class="button light" data-action="share">${navigator.share?'分享挑战 ↗':'复制挑战链接'}</button></div>${memoryOnly&&!sharedView?'<p class="memory-note">当前浏览器无法保存进度。本次打卡与换题只在页面打开期间有效。</p>':''}${footerMark()}</section><p class="note">任务可以独自完成。以舒服为准，不想做就换一个。</p>`);
}
function invalid(){shell(titles[route]||'这份脑洞走丢了','旧纸条可能已经收起来了，新脑洞还在。',`<section class="workbench ${esc(route)} empty"><span class="squiggle">✳</span><h2>这份结果暂时无法还原</h2><p>链接可能不完整，或原内容已下架。<br>没关系，再给好奇心一次机会。</p><a class="button dark" href="/${Object.hasOwn(titles,route)?route:''}" style="margin-top:25px">${route==='persona'?'我也测一下':'重新体验'} ↗</a></section>`);}
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
function render(){if(route==='stats'||route==='admin')stats();else if(route==='index')home();else if(route==='persona')persona();else if(route==='life')life();else if(route==='choice')choices();else if(route==='task')tasks();else if(['about','privacy','terms','contact'].includes(route))info();else invalid();}
function payload(share=false){
 if(route==='persona'&&personaResult){const r=personaResult;return `${share?r.share:[t(titles.persona)+': '+r.name,r.tagline,'',r.desc,'',t('你的隐藏优点')+': '+r.pro,t('一条奇怪的习惯')+': '+r.habit].join('\n')}\n${currentLink('persona',r.id)}`;}
 if(route==='life'&&lifeResult){const r=lifeResult,f=r.fields;return `${share?f.share:[t(titles.life)+': '+f.title,...[['人生职业',f.career],['你的特殊技能',f.skill],['命运拐了个弯',f.twist],['最后，你的结局',f.ending]].map(([k,v])=>t(k)+': '+v),'',f.comment].join('\n')}\n${currentLink('life',r.id,r.entryVersion)}`;}
 if(route==='task'){const id=sharedView?new URLSearchParams(location.search).get('r'):state.currentTaskId;const task=packs.task.tasks.find(x=>x.id===id);return `${t(titles.task)}${!sharedView&&state.doneIds.includes(id)?' ✓':''}: ${task.text}\n${currentLink('task',id)}`;}
 return `${share?t('小事随缘，大事自己定。今天先少纠结一件。'):t(titles.choice)+': '+(choiceResult||'')}\n${currentLink('choice')}`;
}
async function copy(text){
 try{await navigator.clipboard.writeText(text);toast('已复制，把这份脑洞带走吧。');return true;}catch{}
 const box=$('#copy-text');box.value=text;
 const dialog=$('#copy-dialog');if(!dialog.open)dialog.showModal();box.focus();box.select();box.setSelectionRange(0,text.length);
 try{if(document.execCommand('copy')){dialog.close();toast('已复制，把这份脑洞带走吧。');return true;}}catch{}
 toast('文案已选中，可以手动复制。');return false;
}
app.addEventListener('input',e=>{if(e.target.id!=='choice-options')return;choiceText=e.target.value;if(choiceResult){$('.choice-result')?.remove();$('.divider')?.remove();}choiceResult=null;const count=normalizeChoices(choiceText).length;$('#choice-count').textContent=count+' 个有效选项';const button=$('#draw-choice');button.disabled=count<2||choiceBusy;button.textContent=count===0?'好歹给两个选项':count===1?'只剩一个选项，其实你已经决定了':'听天由命，帮我选 ↗';localize(app);});
app.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action,v=b.dataset.value;
 if(a==='stats-days'){statsDays=Number(v);stats();}
 else if(a==='stats-refresh')stats();
 else if(a==='answer'){answers[questionIndex]=Number(v);persona();}
 else if(a==='previous'){questionIndex--;persona();}
 else if(a==='next'){if(answers[questionIndex]===undefined)return;if(questionIndex<5){questionIndex++;persona();$('.question').focus({preventScroll:true});}else{personaResult=packs.persona.results[calculatePersona(answers,packs.persona)];setResultURL(personaResult.id);persona();}}
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
 else if(a==='swap'){loadTask();if(state.swapsUsed>=2){tasks();return;}state.currentTaskId=randomOne(packs.task.tasks.filter(t=>t.status==='published'&&t.id!==state.currentTaskId)).id;state.swapsUsed++;saveTask();tasks();}
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
  if(route==='choice'){choiceText=packs.choice.scenes[0].options.map(o=>o.text).join('\n');}
  const params=new URLSearchParams(location.search);
  if(params.has('r')&&Object.hasOwn(titles,route)&&route!=='choice'){
   const id=params.get('r');sharedView=true;
   if(route==='persona'){personaResult=Object.values(packs.persona.results).find(r=>r.id===id);if(!personaResult){invalid();return;}}
   if(route==='life'){lifeResult=resolveLife(packs.life,id,params.get('v'));if(!lifeResult){invalid();return;}lifeTheme=lifeResult.theme;}
   if(route==='task'&&!packs.task.tasks.some(t=>t.id===id&&t.status==='published')){invalid();return;}
  }
  render();
  if(route==='persona'&&!personaResult&&performance.getEntriesByType('navigation')[0]?.type==='reload')toast('从头再来，很快的。');
 }catch(err){shell('脑洞暂时没打开','等一下，再给好奇心一次机会。','<div class="empty"><p>内容加载遇到了一点小问题。</p><button class="button dark" data-action="reload" style="margin-top:20px">重新打开 ↻</button></div>','error');app.querySelector('[data-action="reload"]').onclick=()=>location.reload();}
}
async function loadPacks(lang){const r=await fetch('/locales/'+lang+'.json');if(!r.ok)throw Error('locale');return r.json();}
const languageControl=document.querySelector('#language');
function applyLanguage(){setLanguage(language);languageControl.value=language;localize(document.body);updateMetadata();const guide=$('#page-guide');if(guide)guide.innerHTML=renderGuide(route==='index'?'/':'/'+route,language);}
function updateMetadata(){
 const path=route==='index'?'/':'/'+route;if(route==='stats'||route==='admin'){document.title=t('活动统计')+' · OddLab';return;}
 const d=pageData(path,language);document.title=path==='/'?'OddLab · '+words('今天，来点不一样的。','A little odd. A little joy.','日常に小さな驚きを。','Un poco peculiar. Un poco de alegría.'):d.title+' · OddLab';
 const set=(selector,attribute,value)=>{const el=document.querySelector(selector);if(el)el.setAttribute(attribute,value);};
 set('meta[name="description"]','content',d.description);set('meta[property="og:title"]','content',document.title);set('meta[property="og:description"]','content',d.description);set('meta[property="og:url"]','content',canonicalURL(path,language));set('link[rel="canonical"]','href',canonicalURL(path,language));set('meta[name="robots"]','content',new URLSearchParams(location.search).has('r')?'noindex,follow':'index,follow');
}
languageControl.addEventListener('change',async e=>{const next=e.target.value,previous=language;if(choiceBusy){e.target.value=previous;return;}languageControl.disabled=true;try{
 const translated=await loadPacks(next);const oldPreset=packs.choice?.scenes.find(x=>x.id===sceneId)?.options.map(x=>x.text).join('\n');const isPreset=choiceText===oldPreset;const resultIndex=packs.choice?.scenes.find(x=>x.id===sceneId)?.options.findIndex(x=>x.text===choiceResult);
 Object.assign(packs,translated);setLanguage(next);if(personaResult)personaResult=Object.values(packs.persona.results).find(x=>x.id===personaResult.id);if(lifeResult)lifeResult=resolveLife(packs.life,lifeResult.id,String(lifeResult.entryVersion));if(isPreset){const scene=packs.choice.scenes.find(x=>x.id===sceneId);choiceText=scene.options.map(x=>x.text).join('\n');if(choiceResult&&resultIndex>=0)choiceResult=scene.options[resultIndex].text;}
 applyLanguage();render();
 }catch{languageControl.value=previous;toast('内容加载遇到了一点小问题。');}finally{languageControl.disabled=false;}});
applyLanguage();startAnalytics(()=>language);languageControl.disabled=true;boot().finally(()=>{languageControl.disabled=false;});
