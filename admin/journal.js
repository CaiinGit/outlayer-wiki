'use strict';
const $=id=>document.getElementById(id),form=$('nodeForm'),labels={fable:'Fable',arc:'Arc',session:'Session'},kinds=['fable','arc','session'];
let csrf='',stack=[],page=1,pages=1,rows=[],current=null,dirty=false,busy=false,nextPosition=1;
const kind=()=>kinds[stack.length],parent=()=>stack.at(-1)?.id||null;
const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
function notice(message){$('notice').textContent=message;}
function canLeave(){return !dirty||confirm('Quitter sans enregistrer les modifications du journal ?');}
async function api(path,method='GET',data){const response=await fetch(path,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:data===undefined?undefined:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.error||'Le journal est indisponible.');return result;}
async function run(task){if(busy)return;busy=true;$('journalWorkspace').inert=true;try{await task();}catch(error){notice(error.message);}finally{busy=false;$('journalWorkspace').inert=false;}}
function resetEditor(){dirty=false;current=null;form.hidden=true;$('editorWelcome').hidden=false;}
function edit(row){current=row;dirty=false;form.reset();form.hidden=false;$('editorWelcome').hidden=true;$('editorTitle').textContent=row?row.title:'Nouvel élément';$('editorKind').textContent=labels[kind()]+' · '+(stack.at(-1)?.title||'Campagne');
for(const key of ['title','description','played_on','status','position'])form.elements[key].value=row?.[key]??({title:'',description:'',played_on:'',status:'played',position:nextPosition}[key]);
form.elements.visible.checked=!!row?.visible;$('sessionFields').hidden=kind()!=='session';$('deleteNode').hidden=!row;$('saveState').textContent=row?'Enregistré':'Privé par défaut';}
async function load(){
 const data=await api('/api/admin/journal?'+new URLSearchParams({kind:kind(),parent:parent()||'',page}));rows=data.items;page=data.page;pages=data.pages;nextPosition=data.nextPosition;
 $('newNode').textContent='＋ '+({fable:'Nouvelle Fable',arc:'Nouvel Arc',session:'Nouvelle Session'}[kind()]);$('levelInfo').textContent=data.total+' '+({fable:'Fables',arc:'Arcs',session:'Sessions'}[kind()]);$('pageInfo').textContent=page+' / '+pages;$('prevPage').disabled=page<=1;$('nextPage').disabled=page>=pages;
 $('breadcrumbs').replaceChildren();
 for(let depth=0;depth<=stack.length;depth++){if(depth)$('breadcrumbs').append(document.createTextNode(' › '));const b=node('button',depth?stack[depth-1].title:'Toutes les Fables','quiet');b.type='button';b.onclick=()=>{if(canLeave())run(async()=>{stack=stack.slice(0,depth);page=1;resetEditor();await load();});};$('breadcrumbs').append(b);}
 $('nodeList').replaceChildren();
 for(const row of rows){const card=node('div','','journal-editor-row');card.append(node('strong',row.position+'. '+row.title),node('small',row.visible?'Partagé · sous réserve de parents visibles':'Privé'));
 const actions=node('div','','row-actions'),modify=node('button','Modifier');modify.type='button';modify.onclick=()=>{if(canLeave())run(async()=>edit(await api('/api/admin/journal/'+row.id)));};actions.append(modify);
 if(kind()!=='session'){const open=node('button',kind()==='fable'?'Voir les Arcs →':'Voir les Sessions →');open.type='button';open.onclick=()=>{if(canLeave())run(async()=>{stack.push(row);page=1;resetEditor();await load();});};actions.append(open);}
 card.append(actions);$('nodeList').append(card);}
 if(!rows.length)$('nodeList').append(node('p','Aucun élément pour le moment. Créez le premier avec le bouton au-dessus.'));
}
$('newNode').onclick=()=>{if(canLeave())edit(null);};
form.addEventListener('input',()=>{dirty=true;$('saveState').textContent='Modifications non enregistrées';});
form.onsubmit=event=>{event.preventDefault();run(async()=>{const data=Object.fromEntries(new FormData(form));data.position=Number(data.position);data.visible=form.elements.visible.checked;data.kind=kind();data.parent_id=parent();if(current)data.revision=current.revision;const saved=await api('/api/admin/journal'+(current?'/'+current.id:''),current?'PUT':'POST',data);edit(saved);await load();notice('Enregistré. '+(saved.visible?'L’élément est partagé si ses parents sont visibles.':'Cet élément reste privé.'));});};
$('prevPage').onclick=()=>{if(canLeave())run(async()=>{page--;resetEditor();await load();});};$('nextPage').onclick=()=>{if(canLeave())run(async()=>{page++;resetEditor();await load();});};
$('deleteNode').onclick=()=>{$('deleteWarning').textContent='Supprimer « '+current.title+' »'+(current.kind==='session'?' et son récit ?':' et tous ses Arcs / Sessions, y compris leur contenu ?')+' Cette action est définitive.';$('deleteConfirmation').value='';$('deleteDialog').showModal();};
$('cancelDelete').onclick=()=>$('deleteDialog').close();
$('deleteForm').onsubmit=event=>{event.preventDefault();if(busy)return;if($('deleteConfirmation').value!==current.title){$('deleteConfirmation').setCustomValidity('Retapez exactement le titre : '+current.title);$('deleteConfirmation').reportValidity();return;}$('deleteDialog').close();run(async()=>{await api('/api/admin/journal/'+current.id,'DELETE',{revision:current.revision,confirmTitle:$('deleteConfirmation').value});resetEditor();await load();notice('Élément supprimé.');});};
$('deleteConfirmation').oninput=()=>$('deleteConfirmation').setCustomValidity('');
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
(async()=>{try{const session=await api('/api/admin/session');csrf=session.csrf;await load();$('journalWorkspace').hidden=false;notice('Préparez vos récits, puis partagez-les avec les joueurs.');}catch(error){notice(error.message+' ');const link=node('a','Se connecter');link.href='/account/';$('notice').append(link);}})();
