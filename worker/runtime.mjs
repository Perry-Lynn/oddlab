const paths=new Set(['/','/dispatch','/persona','/life','/choice','/task','/debug','/about','/privacy','/terms','/contact','/stats']);
const languages=new Set(['en','zh','ja','es']);
const actions=new Set(['view','navigate','language','answer','previous','next','theme','draw-life','scene','clear-choices','draw-choice','swap','complete','copy','share','restart','feedback','clear-progress','reload','dispatch-action','experiment-action']);
const resultIds=new Set(PUBLIC_RESULT_IDS);
const decodedDispatchImages=new Map();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex'}});
const dayAt=ms=>new Date(ms+8*3600000).toISOString().slice(0,10);
function targetURL(value,origin){
 if(typeof value!=='string'||value.length>2048)return null;
 let input;try{input=new URL(value,origin);}catch{return null;}
 if(input.origin!==origin)return input.href==='https://openai.com/policies/privacy-policy/'?input.href:null;
 const path=input.pathname.replace(/\/$/,'')||'/';if(!paths.has(path)||input.username||input.password)return null;
 const safe=new URL(path,origin);const lang=input.searchParams.get('lang');if(languages.has(lang))safe.searchParams.set('lang',lang);
 if(path==='/dispatch'&&['return','market'].includes(input.searchParams.get('level')))safe.searchParams.set('level',input.searchParams.get('level'));
 const id=input.searchParams.get('r');if(resultIds.has(path+':'+id)){safe.searchParams.set('r',id);const v=input.searchParams.get('v');if(path==='/life'&&LIFE_VERSIONS[id]?.includes(v))safe.searchParams.set('v',v);}
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
 const lang=new URL(request.url).searchParams.get('lang')||'zh';const copy=({en:['Administrator access','Sign in with the site owner’s ChatGPT account to view activity.','Sign in with ChatGPT','This account does not have administrator access.'],zh:['管理员后台','请使用站点所有者的 ChatGPT 账号登录后查看统计。','使用 ChatGPT 登录','当前账号没有管理员权限。'],ja:['管理者専用','サイト所有者のChatGPTアカウントでログインしてください。','ChatGPTでログイン','このアカウントには管理者権限がありません。'],es:['Solo administración','Inicia sesión con la cuenta de ChatGPT del propietario.','Entrar con ChatGPT','Esta cuenta no tiene permisos de administración.']})[lang]||['Administrator access','Sign in with the site owner’s ChatGPT account.','Sign in with ChatGPT','Access denied.'];
 const returnTo='/admin?lang='+(['zh','en','ja','es'].includes(lang)?lang:'zh');
 return new Response(`<!doctype html><html lang="${['zh','en','ja','es'].includes(lang)?lang:'zh'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${copy[0]} · OddLab</title><link rel="stylesheet" href="/style.css"></head><body><main class="tool-wrap"><section class="workbench"><div class="eyebrow">ODDLAB / ADMIN</div><h1>${copy[0]}</h1><p style="margin-top:20px">${status===401?copy[1]:copy[3]}</p><div class="actions"><a class="button dark" target="_top" href="/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}">${copy[2]}</a><a class="button" href="/">OddLab ↗</a></div></section></main></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','vary':'Cookie'}});
}
export default {async fetch(request,env={}){
 const url=new URL(request.url);try{
 if(url.pathname==='/api/track')return request.method==='POST'?await track(request,env):json({error:'method'},405);
 if(url.pathname==='/api/stats'){const permission=adminIdentity(request,env);if(permission!==200)return json({error:permission===401?'authentication_required':'forbidden'},permission);return request.method==='GET'?await stats(request,env):json({error:'method'},405);}
 if(!['GET','HEAD'].includes(request.method))return json({error:'method'},405);
 const path=url.pathname.replace(/\/$/,'')||'/';const adminPath=path.replace(/\.html$/,'');if(adminPath==='/stats'||adminPath==='/admin'){const permission=adminIdentity(request,env);if(permission!==200)return adminDenied(request,permission);const adminLang=languages.has(url.searchParams.get('lang'))?url.searchParams.get('lang'):'zh';const asset=ASSETS['/stats?lang='+adminLang];return new Response(request.method==='HEAD'?null:asset.body,{headers:{'content-type':asset.type,'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','vary':'Cookie'}});}
 const image=ASSETS[path];if(image?.encoding==='base64'&&image.type==='image/webp'){
  let body=null;
  if(request.method==='GET'){
   body=decodedDispatchImages.get(path);
   if(!body){const binary=atob(image.body);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);body=bytes;decodedDispatchImages.set(path,body);}
  }
  return new Response(body,{headers:{'content-type':image.type,'content-length':String(image.byteLength),'cache-control':image.cache,'x-content-type-options':'nosniff'}});
 }
 const lang=languages.has(url.searchParams.get('lang'))?url.searchParams.get('lang'):'zh';const publicPaths=new Set(['/','/dispatch','/persona','/life','/choice','/task','/debug','/about','/privacy','/terms','/contact']);
 const alias=path==='/index.html'?'/':path.replace(/\.html$/,'');if(publicPaths.has(alias)&&path!==alias||publicPaths.has(path)&&url.pathname!==path){const target=new URL(request.url);target.pathname=publicPaths.has(alias)?alias:path;return new Response(null,{status:308,headers:{location:target.pathname+target.search}});}
 let asset=ASSETS[path+'?lang='+lang]||ASSETS[path];let status=200;
 const result=url.searchParams.get('r');const resultPage=['/persona','/life','/task'].includes(path)&&url.searchParams.has('r');
 const badResult=resultPage&&(!resultIds.has(path+':'+result)||(path==='/life'&&url.searchParams.has('v')&&!LIFE_VERSIONS[result]?.includes(url.searchParams.get('v'))));
 if(!asset||badResult){status=404;const text=({en:['This idea wandered off','Back to the lab'],zh:['这份脑洞走丢了','回研究所'],ja:['脳洞が迷子になりました','研究所へ戻る'],es:['Esta idea se ha perdido','Volver al laboratorio']})[lang];const href='/'+(lang==='zh'?'':'?lang='+lang);asset={type:'text/html; charset=utf-8',body:`<!doctype html><html lang="${lang==='zh'?'zh-CN':lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>404 · OddLab</title><link rel="stylesheet" href="/style.css"></head><body><main class="tool-wrap"><section class="workbench empty"><span class="squiggle"><svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M8 42c-3-11 6-17 18-17 10 0 18 3 20 9 2 6-3 11-10 11H18c-5 0-9-2-10-4" stroke-width="5.5"/><path d="M12 33c-5 1-7-2-5-6" stroke-width="4.5"/><path d="M43 5c7 1 13 6 13 12s-6 13-13 13-12-6-12-13 5-11 12-12c3 0 5 1 7 3" stroke-width="5.5"/><path d="M56 13c5 1 8 2 9 4-2 2-6 3-10 2" stroke-width="5"/><path d="M31 36c5-2 11-1 14 2M20 43c4-2 9-1 12 2" stroke-width="4"/><path d="M43 5c-3-3 0-6 4-6" stroke-width="4.5"/></g><circle cx="48" cy="13" r="2" fill="currentColor"/></svg></span><h1>${text[0]}</h1><div class="actions"><a class="button dark" href="${href}">${text[1]} ↗</a></div><nav class="crosslinks">${['/persona','/life','/choice','/task'].map(p=>`<a href="${p}?lang=${lang}">${p.slice(1)} ↗</a>`).join('')}</nav></section></main></body></html>`};}
 const noindex=status===404||url.searchParams.has('r')||['/capability','/tool-test','/capability.html','/tool-test.html'].includes(path)||path.startsWith('/api/');
 let body=asset.body;if(noindex&&asset.type.startsWith('text/html'))body=body.replace('content="index,follow"','content="noindex,follow"');
 return new Response(request.method==='HEAD'?null:body,{status,headers:{'content-type':asset.type,'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',...(noindex?{'x-robots-tag':'noindex, follow'}:{})}});

 }catch{return json({error:'temporarily_unavailable'},503);}
}};
