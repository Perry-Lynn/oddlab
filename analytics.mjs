const routes=new Set(['/','/persona','/life','/choice','/task','/about','/privacy','/terms','/contact']);
const actions=new Set(['answer','previous','next','theme','draw-life','scene','clear-choices','draw-choice','swap','complete','copy','share','restart','feedback','clear-progress','reload']);
export function startAnalytics(getLanguage){
 const source=location.pathname.replace(/\/$/,'')||'/';if(!routes.has(source))return;
 function send(kind,target,action,locale=getLanguage()){
  // Never read form values, answer IDs, link text, or browser identifiers.
  const body=JSON.stringify({kind,source_path:source,target_url:target,action,locale});
  try{if(navigator.sendBeacon?.('/api/track',new Blob([body],{type:'application/json'})))return;}catch{}
  fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
 }
 send('page_view',location.href,'view');
 document.addEventListener('click',e=>{if(!e.isTrusted)return;const el=e.target.closest('a[href],button');if(!el||el.disabled||el.closest('#copy-dialog'))return;
  if(el.matches('a')){const url=new URL(el.href);if(url.origin===location.origin&&!routes.has(url.pathname.replace(/\/$/,'')||'/'))return;if(url.origin!==location.origin&&url.href!=='https://openai.com/policies/privacy-policy/')return;send('click',url.href,'navigate');}
  else if(actions.has(el.dataset.action))send('click',location.href,el.dataset.action);
 },true);
 document.querySelector('#language').addEventListener('change',e=>{const url=new URL(location.href);url.searchParams.set('lang',e.target.value);send('click',url.href,'language',e.target.value);});
}
