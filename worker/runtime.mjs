const paths=new Set(['/','/persona','/life','/choice','/task','/about','/privacy','/stats']);
const languages=new Set(['en','zh','ja','es']);
const actions=new Set(['view','navigate','language','answer','previous','next','theme','draw-life','scene','clear-choices','draw-choice','swap','complete','copy','share','restart','feedback','clear-progress','reload']);
const resultIds=new Set(PUBLIC_RESULT_IDS);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const dayAt=ms=>new Date(ms+8*3600000).toISOString().slice(0,10);
function targetURL(value,origin){
 if(typeof value!=='string'||value.length>2048)return null;
 let input;try{input=new URL(value,origin);}catch{return null;}
 if(input.origin!==origin)return input.href==='https://openai.com/policies/privacy-policy/'?input.href:null;
 const path=input.pathname.replace(/\/$/,'')||'/';if(!paths.has(path)||input.username||input.password)return null;
 const safe=new URL(path,origin);const lang=input.searchParams.get('lang');if(languages.has(lang))safe.searchParams.set('lang',lang);
 const id=input.searchParams.get('r');if(resultIds.has(path+':'+id)){safe.searchParams.set('r',id);const v=input.searchParams.get('v');if(path==='/life'&&v==='1')safe.searchParams.set('v',v);}
 return safe.href;
}
async function track(request,env){
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'origin'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'content_type'},415);
 if(Number(request.headers.get('content-length'))>4096)return json({error:'too_large'},413);
 const text=await request.text();if(new TextEncoder().encode(text).length>4096)return json({error:'too_large'},413);
 let data;try{data=JSON.parse(text);}catch{return json({error:'json'},400);}
 if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'event'},400);
 const {kind,source_path,action,locale}=data;
 if(!['page_view','click'].includes(kind)||!paths.has(source_path)||source_path==='/stats'||!actions.has(action)||!languages.has(locale)||(kind==='page_view'&&action!=='view')||(kind==='click'&&action==='view'))return json({error:'event'},400);
 const target=targetURL(data.target_url,url.origin);if(!target)return json({error:'target'},400);
 if(kind==='page_view'&&new URL(target).pathname!==source_path)return json({error:'source'},400);
 if(!env.DB)return json({error:'storage_unavailable'},503);
 const now=new Date();await env.DB.prepare('INSERT INTO activity_daily (day,kind,source_path,target_url,action,locale,count,updated_at) VALUES (?,?,?,?,?,?,1,?) ON CONFLICT(day,kind,source_path,target_url,action,locale) DO UPDATE SET count=count+1,updated_at=excluded.updated_at').bind(dayAt(now.getTime()),kind,source_path,target,action,locale,now.toISOString()).run();
 return new Response(null,{status:204,headers:{'cache-control':'no-store'}});
}
async function stats(request,env){
 if(!env.DB)return json({error:'storage_unavailable'},503);
 const selected=Number(new URL(request.url).searchParams.get('days')||7);if(![7,30,90].includes(selected))return json({error:'range'},400);
 const since=dayAt(Date.now()-(selected-1)*86400000);
 const statements=[
 'SELECT COALESCE(SUM(CASE WHEN kind=\'page_view\' THEN count ELSE 0 END),0) AS page_views, COALESCE(SUM(CASE WHEN kind=\'click\' THEN count ELSE 0 END),0) AS clicks FROM activity_daily WHERE day>=?',
 'SELECT kind,source_path,target_url,action,locale,SUM(count) AS count FROM activity_daily WHERE day>=? GROUP BY kind,source_path,target_url,action,locale ORDER BY count DESC,target_url,action,locale,source_path,kind LIMIT 200',
 'SELECT day,SUM(CASE WHEN kind=\'page_view\' THEN count ELSE 0 END) AS page_views,SUM(CASE WHEN kind=\'click\' THEN count ELSE 0 END) AS clicks FROM activity_daily WHERE day>=? GROUP BY day ORDER BY day DESC'
 ];
 const result=await env.DB.batch(statements.map(sql=>env.DB.prepare(sql).bind(since)));
 return json({timezone:'UTC+8',days:selected,since,totals:result[0].results[0],rows:result[1].results.map(row=>({...row,kind_label:row.kind==='click'?'操作点击':'页面访问'})),daily:result[2].results});
}
function adminIdentity(request,env){
 const userId=request.headers.get('oai-authenticated-user-id');const email=request.headers.get('oai-authenticated-user-email');
 if(!userId||!email)return 401;
 if(!env.ADMIN_EMAIL||email.trim().toLowerCase()!==env.ADMIN_EMAIL.trim().toLowerCase())return 403;
 return 200;
}
function adminDenied(request,status){
 const lang=new URL(request.url).searchParams.get('lang')||'en';const copy=({en:['Administrator access','Sign in with the site owner’s ChatGPT account to view activity.','Sign in with ChatGPT','This account does not have administrator access.'],zh:['管理员后台','请使用站点所有者的 ChatGPT 账号登录后查看统计。','使用 ChatGPT 登录','当前账号没有管理员权限。'],ja:['管理者専用','サイト所有者のChatGPTアカウントでログインしてください。','ChatGPTでログイン','このアカウントには管理者権限がありません。'],es:['Solo administración','Inicia sesión con la cuenta de ChatGPT del propietario.','Entrar con ChatGPT','Esta cuenta no tiene permisos de administración.']})[lang]||['Administrator access','Sign in with the site owner’s ChatGPT account.','Sign in with ChatGPT','Access denied.'];
 const returnTo='/admin?lang='+(['en','zh','ja','es'].includes(lang)?lang:'en');
 return new Response(`<!doctype html><html lang="${['en','zh','ja','es'].includes(lang)?lang:'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${copy[0]} · OddLab</title><link rel="stylesheet" href="/style.css"></head><body><main class="tool-wrap"><section class="workbench"><div class="eyebrow">ODDLAB / ADMIN</div><h1>${copy[0]}</h1><p style="margin-top:20px">${status===401?copy[1]:copy[3]}</p><div class="actions"><a class="button dark" target="_top" href="/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}">${copy[2]}</a><a class="button" href="/">OddLab ↗</a></div></section></main></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','vary':'Cookie'}});
}
export default {async fetch(request,env={}){
 const url=new URL(request.url);try{
 if(url.pathname==='/api/track')return request.method==='POST'?await track(request,env):json({error:'method'},405);
 if(url.pathname==='/api/stats'){const permission=adminIdentity(request,env);if(permission!==200)return json({error:permission===401?'authentication_required':'forbidden'},permission);return request.method==='GET'?await stats(request,env):json({error:'method'},405);}
 if(!['GET','HEAD'].includes(request.method))return json({error:'method'},405);
 const path=url.pathname.replace(/\/$/,'')||'/';const adminPath=path.replace(/\.html$/,'');if(adminPath==='/stats'||adminPath==='/admin'){const permission=adminIdentity(request,env);if(permission!==200)return adminDenied(request,permission);const asset=ASSETS['/stats'];return new Response(request.method==='HEAD'?null:asset.body,{headers:{'content-type':asset.type,'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','vary':'Cookie'}});}
 const asset=ASSETS[path]||ASSETS[path.replace(/\.html$/,'')];if(!asset)return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:asset.body,{headers:{'content-type':asset.type,'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}});
 }catch{return json({error:'temporarily_unavailable'},503);}
}};
