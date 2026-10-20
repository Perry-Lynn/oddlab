import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from './worker/index.js';
import {publicRoutes,canonicalURL,pageData,localeCodes} from './page-content.mjs';
import {translateText} from './ui-catalog.mjs';
const origin='https://oddlab.example';
const fetchPath=(path,env)=>worker.fetch(new Request(origin+path),env);
const decode=s=>s.replaceAll('&amp;','&');
const returnDispatch=await fetchPath('/dispatch?level=return&lang=ja&route=PRIVATE');
assert.equal(returnDispatch.status,200,'the Return Run shares the canonical Dispatch page route');
const returnHtml=await returnDispatch.text();
assert.equal(decode(returnHtml.match(/<link rel="canonical" href="([^"]+)"/)[1]),canonicalURL('/dispatch','ja'),'level query does not create an indexed page');
assert.ok(!returnHtml.includes('PRIVATE'),'route parameters are not reflected in page output');
const marketHtml=await (await fetchPath('/dispatch?level=market&lang=es&route=PRIVATE')).text();
assert.equal(decode(marketHtml.match(/<link rel="canonical" href="([^"]+)"/)[1]),canonicalURL('/dispatch','es'),'Market slug stays a game state, not an indexable page');
assert.ok(marketHtml.includes('relevo del mercado') && marketHtml.includes('Ember sale del Pantano'),'the public guide explains the third puzzle in Spanish');
assert.ok(!marketHtml.includes('PRIVATE'));
for(const lang of ['en','zh','ja','es']){
 const titles=new Set(),descriptions=new Set();
 for(const path of publicRoutes){
  const response=await fetchPath(path+'?lang='+lang+'&ignored=%3Cscript%3EINJECTED');
  assert.equal(response.status,200);const html=await response.text();
  assert.ok(html.includes(`<html lang="${localeCodes[lang]}"`));
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
  assert.equal((html.match(/<title>/g)||[]).length,1);
  const canonical=html.match(/<link rel="canonical" href="([^"]+)"/)[1];
  assert.equal(decode(canonical),canonicalURL(path,lang));
  assert.equal((html.match(/hreflang=/g)||[]).length,5);
  for(const alternate of ['en','zh','ja','es'])assert.ok(html.includes(`hreflang="${alternate==='zh'?'zh-Hans':alternate}" href="${canonicalURL(path,alternate)}"`));
  assert.ok(!html.includes('INJECTED'));
  assert.ok(!/<a[^>]+href="[^"\s]*\/(?:stats|admin)(?:[?"/])/.test(html));
  assert.ok(html.includes('name="robots" content="index,follow"'));
  titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
  descriptions.add(html.match(/name="description" content="([^"]+)"/)[1]);
  if(['en','es'].includes(lang)){const visible=html.replace(/<option[\s\S]*?<\/option>/g,'').replace(/<[^>]*>/g,'');assert.ok(!/[\u4e00-\u9fff]/.test(visible),'no untranslated Chinese: '+path+' '+lang);}
  if(['/', '/dispatch','/persona','/life','/choice','/task'].includes(path)){assert.equal((html.match(/<details>/g)||[]).length,path==='/dispatch'?4:3);assert.equal((html.match(/<li>/g)||[]).length,3);for(const game of ['/dispatch','/persona','/life','/choice','/task'].filter(p=>p!==path))assert.ok(html.includes(`href="${canonicalURL(game,lang)}"`));}
 }
 assert.equal(titles.size,10);assert.equal(descriptions.size,10);
 // A page delivered in any locale must still be able to switch its persistent shell.
 for(const source of ['关于研究所','关于 / 反馈','隐私说明','使用说明','联系与反馈'])for(const next of ['en','zh','ja','es'])assert.equal(translateText(translateText(source,lang),next),translateText(source,next));
}
// The unprefixed entry page must default to Simplified Chinese, with Chinese first in the picker.
const rootDefault=await (await fetchPath('/')).text();
assert.ok(rootDefault.includes('<html lang="zh-CN"'),'the default entry document is Chinese');
assert.ok(rootDefault.includes('今天，来点不一样的。'),'the default entry copy is Chinese');
const defaultOptions=rootDefault.match(/<option value="\w+"[^>]*>/g)||[];
assert.equal(defaultOptions.length,4,'the picker offers four languages');
assert.ok(defaultOptions[0].includes('value="zh"'),'Chinese is the first option');
assert.ok(defaultOptions[0].includes('selected'),'Chinese is selected by default');
assert.ok(!defaultOptions.slice(1).some(option=>option.includes('selected')),'only one language is selected');
assert.ok(!rootDefault.includes('✳'),'the shell drops the old eight-point star glyph');
assert.ok(rootDefault.includes('M8 42c-3-11 6-17 18-17'),'the shell carries the hand-drawn duck mark');
const sitemap=await (await fetchPath('/sitemap.xml')).text();
assert.equal((sitemap.match(/<loc>/g)||[]).length,40);
for(const [,loc] of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)){const u=new URL(decode(loc));assert.ok(publicRoutes.includes(u.pathname));assert.ok(!u.searchParams.has('r'));}
for(const path of publicRoutes)for(const lang of ['en','zh','ja','es'])assert.ok(sitemap.includes(canonicalURL(path,lang)));
assert.ok((await (await fetchPath('/robots.txt')).text()).includes('/sitemap.xml'));
for(const path of ['/life.html?lang=ja&r=life-03&v=1','/persona/?lang=es','/index.html?lang=zh']){const response=await fetchPath(path);assert.equal(response.status,308);const target=new URL(response.headers.get('location'),origin);assert.equal(target.search,new URL(path,origin).search);assert.ok(!target.pathname.endsWith('.html'));}
for(const lang of ['en','zh','ja','es'])for(const path of ['/missing','/life?r=life-03&v=999','/persona?r=not-a-result','/task?r=unknown']){const r=await fetchPath(path+(path.includes('?')?'&':'?')+'lang='+lang);assert.equal(r.status,404);assert.ok(r.headers.get('x-robots-tag').includes('noindex'));}
const pack=JSON.parse(await readFile('locales/en.json','utf8'));
for(const path of ['/persona?r='+Object.values(pack.persona.results)[0].id,'/life?r=life-03&v=1','/task?r='+pack.task.tasks[0].id,'/tool-test','/capability']){const r=await fetchPath(path);assert.equal(r.status,200);assert.ok(r.headers.get('x-robots-tag').includes('noindex'));}
let touched=false;const guardedEnv={ADMIN_EMAIL:'owner@example.test',get DB(){touched=true;throw Error('unauthorized database read');}};
for(const path of ['/admin','/stats.html','/api/stats'])assert.equal((await fetchPath(path,guardedEnv)).status,401);
assert.equal(touched,false);
console.log('PASS: 40 raw HTML pages, four-way shell translation, canonical/hreflang, sitemap, alias redirects, result indexing, genuine 404 and authorization before DB.');
