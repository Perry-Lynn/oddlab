import { translateText } from './ui-catalog.mjs';
export const languages={en:'English',zh:'简体中文',ja:'日本語',es:'Español'};
export function initialLanguage(){const q=new URLSearchParams(location.search).get('lang');if(Object.hasOwn(languages,q))return q;try{const stored=localStorage.getItem('oddlab_locale');if(Object.hasOwn(languages,stored))return stored;}catch{}return 'en';}
export let language=initialLanguage();
export function setLanguage(lang){if(!Object.hasOwn(languages,lang))return;language=lang;try{localStorage.setItem('oddlab_locale',lang);}catch{}const u=new URL(location.href);u.searchParams.set('lang',lang);history.replaceState(null,'',u.pathname+u.search+u.hash);document.documentElement.lang=lang==='zh'?'zh-CN':lang;}
// Source-key catalogs keep Chinese copy editable while all public UI has four-language coverage.
export const t=source=>translateText(source,language);
const originals=new WeakMap();const attributeOriginals=new WeakMap();
export function localize(root){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){if(node.parentElement?.closest('script,style,textarea,[data-no-translate]'))continue;let old=originals.get(node);if(!old||node.nodeValue!==old.output)old={source:node.nodeValue};const output=t(old.source);node.nodeValue=output;originals.set(node,{source:old.source,output});}
 for(const el of root.querySelectorAll('[aria-label],[placeholder],[title]')){const old=attributeOriginals.get(el)||{};for(const key of ['aria-label','placeholder','title'])if(el.hasAttribute(key)){const value=el.getAttribute(key),entry=old[key];const source=entry&&entry.output===value?entry.source:value;el.setAttribute(key,t(source));old[key]={source,output:el.getAttribute(key)};}attributeOriginals.set(el,old);}
 for(const a of root.querySelectorAll('a[href]:not([data-no-translate])')){const url=new URL(a.getAttribute('href'),location.href);if(url.origin===location.origin&&!url.pathname.startsWith('/api/')){url.searchParams.set('lang',language);a.setAttribute('href',url.pathname+url.search+url.hash);}}
}
export function words(zh,en,ja,es){return ({zh,en,ja,es})[language];}
