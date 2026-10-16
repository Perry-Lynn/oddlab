import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from './worker/index.js';
import {localD1} from './scripts/local-d1.mjs';
const DB=await localD1();const adminEnv={DB,ADMIN_EMAIL:'owner@example.test'};const adminHeaders={'oai-authenticated-user-id':'site-scoped-owner','oai-authenticated-user-email':'owner@example.test'};const origin='https://oddlab.example';
const event={kind:'click',source_path:'/choice',target_url:origin+'/choice?lang=es&secret=PRIVATE_LIST#private',action:'draw-choice',locale:'es'};
const request=(data=event,extra={})=>new Request(origin+'/api/track',{method:'POST',headers:{origin,'content-type':'application/json',...extra},body:JSON.stringify(data)});
assert.equal((await worker.fetch(request(),{DB})).status,204);assert.equal((await worker.fetch(request(),{DB})).status,204);
const rows=DB.sqlite.prepare('SELECT * FROM activity_daily').all();assert.equal(rows.length,1);assert.equal(rows[0].count,2);assert.equal(rows[0].target_url,origin+'/choice?lang=es');assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
assert.equal((await worker.fetch(request(event,{origin:'https://elsewhere.example'}),{DB})).status,403);
assert.equal((await worker.fetch(request({...event,action:'USER_INPUT'}),{DB})).status,400);
assert.equal((await worker.fetch(request({...event,target_url:'https://elsewhere.example/x'}),{DB})).status,400);
assert.equal((await worker.fetch(request({...event,target_url:origin+'/choice?r=PRIVATE_INPUT'}),{DB})).status,204);
const dispatchEvent={kind:'click',source_path:'/dispatch',target_url:origin+'/dispatch?lang=ja&level=return&route=PRIVATE',action:'dispatch-action',locale:'ja'};
assert.equal((await worker.fetch(request(dispatchEvent),{DB})).status,204);
assert.equal((await worker.fetch(request({...dispatchEvent,target_url:origin+'/dispatch?lang=es&level=constructor&route=PRIVATE',locale:'es'}),{DB})).status,204);
assert.equal((await worker.fetch(request({...dispatchEvent,source_path:'/choice',target_url:origin+'/choice?lang=zh&level=return&route=PRIVATE',locale:'zh'}),{DB})).status,204);
const cleaned=DB.sqlite.prepare('SELECT target_url FROM activity_daily WHERE action=? ORDER BY target_url').all('dispatch-action').map(row=>row.target_url);
assert.deepEqual(cleaned,[origin+'/choice?lang=zh',origin+'/dispatch?lang=es',origin+'/dispatch?lang=ja&level=return']);
assert.equal((await worker.fetch(request({...event,target_url:'x'.repeat(5000)}),{DB})).status,413);
assert.equal((await worker.fetch(request(),{})).status,503);
const stats=await (await worker.fetch(new Request(origin+'/api/stats?days=7',{headers:adminHeaders}),adminEnv)).json();assert.equal(stats.totals.clicks,6);assert.equal(stats.totals.page_views,0);assert.equal(stats.timezone,'UTC+8');assert.equal(stats.daily.length,1);
assert.equal((await worker.fetch(new Request(origin+'/api/stats?days=999',{headers:adminHeaders}),adminEnv)).status,400);
assert.equal((await worker.fetch(new Request(origin+'/api/track'),{DB})).status,405);
for(const path of ['/','/persona','/life','/task','/choice','/privacy','/locales/es.json','/i18n.mjs'])assert.equal((await worker.fetch(new Request(origin+path))).status,200);
for(const path of ['/admin','/admin/','/admin.html','/stats','/stats/','/stats.html','/api/stats']){assert.equal((await worker.fetch(new Request(origin+path),adminEnv)).status,401);assert.equal((await worker.fetch(new Request(origin+path,{headers:{...adminHeaders,'oai-authenticated-user-email':'other@example.test'}}),adminEnv)).status,403);assert.equal((await worker.fetch(new Request(origin+path,{headers:adminHeaders}),adminEnv)).status,200);assert.equal((await worker.fetch(new Request(origin+path,{headers:adminHeaders}),{DB})).status,403);}
const locales=await Promise.all(['en','zh','ja','es'].map(async l=>JSON.parse(await readFile('locales/'+l+'.json','utf8'))));
for(const pack of locales){assert.equal(pack.persona.questions.length,6);assert.equal(Object.keys(pack.persona.results).length,8);assert.equal(pack.life.templates.length,12);assert.equal(pack.task.tasks.length,30);assert.equal(pack.choice.scenes.length,4);assert.deepEqual(pack.task.rotation.order,locales[0].task.rotation.order);assert.equal(pack.task.rotation.baselineDate,locales[0].task.rotation.baselineDate);for(let i=0;i<6;i++){assert.equal(pack.persona.questions[i].options.length,4);for(let j=0;j<4;j++){const a=pack.persona.questions[i].options[j],b=locales[0].persona.questions[i].options[j];assert.equal(a.main,b.main);assert.equal(a.sub,b.sub);assert.ok(a.text);}}assert.deepEqual(pack.life.templates.map(x=>[x.id,x.entryVersion,x.status]),locales[0].life.templates.map(x=>[x.id,x.entryVersion,x.status]));}
for(const index of [0,3]){const publicText=JSON.stringify(locales[index]);assert.ok(!/[\u4e00-\u9fff]/.test(publicText),'English and Spanish packs have no untranslated Chinese');}
console.log('PASS: SQLite aggregation, dispatch-level URL allowlist/redaction, origin checks, API errors, static routes, and 4 locale content contracts.');DB.sqlite.close();
