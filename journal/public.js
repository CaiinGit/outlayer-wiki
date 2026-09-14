'use strict';
const $=id=>document.getElementById(id);
const state={fable:null,arc:null,fp:1,ap:1,sp:1};
let controller, detailController;
function textNode(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
async function api(path,signal){const response=await fetch(path,{cache:'no-store',signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Le journal est indisponible.');return data;}
function pager(id,data,change){const nav=$(id);nav.replaceChildren();nav.hidden=data.pages<=1;if(nav.hidden)return;for(const [label,offset] of [['←',-1],['→',1]]){const button=textNode('button',label);button.setAttribute('aria-label',offset<0?'Page précédente':'Page suivante');button.disabled=offset<0?data.page<=1:data.page>=data.pages;button.onclick=()=>change(data.page+offset);if(offset===1)nav.append(textNode('span',data.page+' / '+data.pages));nav.append(button);}}
const number=value=>String(value).padStart(2,'0');
function dateLabel(value){return value?new Intl.DateTimeFormat('fr',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')):'Date non renseignée';}
function status(row){return row.status==='played'?'Jouée':'À venir';}
async function openSession(row){
 detailController?.abort();detailController=new AbortController();$('sessionTitle').textContent=row.title;$('sessionBody').textContent='Chargement du récit…';$('sessionInfo').textContent='';$('sessionDialog').showModal();
 try{const data=await api('/api/journal/'+encodeURIComponent(row.id),detailController.signal);$('sessionTitle').textContent=data.title;$('sessionInfo').textContent=status(data)+' · '+dateLabel(data.played_on);$('sessionBody').textContent=data.description||'Le récit de cette session n’a pas encore été ajouté.';}catch(error){if(error.name!=='AbortError')$('sessionBody').textContent=error.message;}
}
async function load(){
 controller?.abort();const current=controller=new AbortController(),signal=current.signal;
 $('journalNotice').textContent='';$('journalLayout').setAttribute('aria-busy','true');
 try{
  const fables=await api('/api/journal?kind=fable&page='+state.fp,signal);state.fp=fables.page;
  if(!fables.items.some(x=>x.id===state.fable)){state.fable=fables.items[0]?.id;state.arc=null;state.ap=1;state.sp=1;}
  $('fableList').replaceChildren();
  for(const row of fables.items){const button=textNode('button','', 'fable-link');button.append(textNode('b',number(row.position)),textNode('span','Fable '+row.title));if(row.id===state.fable)button.setAttribute('aria-current','true');button.onclick=()=>{state.fable=row.id;state.arc=null;state.ap=1;state.sp=1;load();};$('fableList').append(button);}
  pager('fablePager',fables,p=>{state.fp=p;state.fable=null;load();});
  $('journalContent').hidden=!state.fable;$('journalEmpty').hidden=!!state.fable;
  if(!state.fable)return;
  const arcs=await api('/api/journal?kind=arc&parent='+encodeURIComponent(state.fable)+'&page='+state.ap,signal);state.ap=arcs.page;
  if(!arcs.items.some(x=>x.id===state.arc)){state.arc=arcs.items[0]?.id;state.sp=1;}
  $('fableTitle').textContent='Fable '+arcs.parent.title;$('fableDescription').textContent=arcs.parent.description;$('fableMark').textContent=number(arcs.parent.position);
  $('arcList').replaceChildren();
  for(const row of arcs.items){const button=textNode('button',row.title,'arc-link');if(row.id===state.arc)button.setAttribute('aria-current','true');button.onclick=()=>{state.arc=row.id;state.sp=1;load();};$('arcList').append(button);}
  pager('arcPager',arcs,p=>{state.ap=p;state.arc=null;load();});
  $('sessionList').replaceChildren();$('arcTitle').textContent='';$('arcDescription').textContent='';$('sessionCount').textContent='';$('sessionPager').hidden=true;
  if(!state.arc){$('sessionList').append(textNode('p','Aucun arc n’a encore été partagé dans cette Fable.','journal-empty'));return;}
  const sessions=await api('/api/journal?kind=session&parent='+encodeURIComponent(state.arc)+'&page='+state.sp,signal);state.sp=sessions.page;
  $('arcTitle').textContent=sessions.parent.title;$('arcDescription').textContent=sessions.parent.description;$('sessionCount').textContent=sessions.total+' session'+(sessions.total>1?'s':'')+' dans cet arc';
  for(const row of sessions.items){
   const card=textNode('article','','session-card'),content=document.createElement('div'),meta=textNode('div','','session-meta');meta.append(textNode('span',status(row),'session-status'+(row.status==='planned'?' planned':'')),textNode('span',dateLabel(row.played_on)));
   content.append(meta,textNode('h4',row.title),textNode('p',row.description?row.description+(row.description.length===180?'…':''):'Le récit de cette session n’a pas encore été ajouté.'));
   const button=textNode('button','Lire le récit ↗','session-open');button.setAttribute('aria-label','Lire le récit : '+row.title);button.onclick=()=>openSession(row);card.append(textNode('div',number(row.position),'session-number'),content,button);$('sessionList').append(card);
  }
  if(!sessions.total)$('sessionList').append(textNode('p','Les prochaines sessions de cet arc apparaîtront ici.','journal-empty'));
  pager('sessionPager',sessions,p=>{state.sp=p;load();});
 }catch(error){if(error.name!=='AbortError'){$('journalNotice').textContent=error.message;$('journalContent').hidden=true;}}
 finally{if(current===controller)$('journalLayout').setAttribute('aria-busy','false');}
}
$('closeSession').onclick=()=>$('sessionDialog').close();$('sessionDialog').addEventListener('close',()=>detailController?.abort());
const toggle=document.querySelector('.menu-toggle'),nav=$('mainNav');
function closeMenu(){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Ouvrir le menu');}
toggle.onclick=()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');};
document.addEventListener('click',e=>{if(!e.target.closest('.topbar'))closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();}});
document.querySelector('.topbar').addEventListener('focusout',e=>{if(!e.currentTarget.contains(e.relatedTarget))closeMenu();});
window.matchMedia('(max-width:1080px)').addEventListener('change',closeMenu);
new ResizeObserver(()=>document.documentElement.style.setProperty('--header-size',document.querySelector('.topbar').getBoundingClientRect().height+'px')).observe(document.querySelector('.topbar'));
(async()=>{try{const {user}=await api('/api/session');const allowed=user&&['mj','player'].includes(user.role);document.querySelector('.account-link').textContent=user?'Mon compte':'Connexion';document.body.classList.toggle('access-locked',!allowed);$('accessGate').hidden=!!allowed;$('journalLayout').hidden=!allowed;$('journalHero').hidden=!allowed;$('manageJournal').hidden=user?.role!=='mj';if(allowed)await load();}catch(error){$('journalNotice').textContent=error.message;$('accessGate').hidden=false;}})();
