const $ = id => document.getElementById(id);
const form = $('entryForm');
let csrf = '', records = [], current = null, imagePath = null, dirty = false, busy = false;
let listPage = 1, listPages = 1, listTotal = 0, listLoading = false, listController, listSequence = 0, listTimer;
let lookupPage = 1, lookupPages = 1, lookupController, lookupSequence = 0, lookupTimer;
let selectedRelations = new Map();
const stateLabels = {known:'Révélée aux joueurs', sealed:'Archive scellée', hidden:'Brouillon privé'};
const notify = (message, error = false) => { $('notice').textContent = message; $('notice').classList.toggle('error', error); };

async function api(path, method = 'GET', data, signal) {
  const options = {method, cache:'no-store', headers:{}, signal};
  if (method !== 'GET') options.headers['X-CSRF-Token'] = csrf;
  if (data instanceof FormData) options.body = data;
  else if (data !== undefined) { options.body = JSON.stringify(data); options.headers['Content-Type'] = 'application/json'; }
  const response = await fetch(path, options);
  const result = await response.json().catch(()=>({error:'Le serveur est indisponible.'}));
  if (!response.ok) throw new Error(result.error || 'Une erreur est survenue.');
  return result;
}

async function run(task) {
  if (busy) return;
  busy = true;
  form.inert = true;
  document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try { await task(); } catch (error) { notify(error.message, true); }
  finally { busy = false; form.inert = false; document.querySelectorAll('button').forEach(b=>b.disabled=false); syncPager(); syncLookupPager(); }
}

function renderList() {

  $('entryList').replaceChildren();
  for (const row of records) {
    const button = document.createElement('button'); button.type='button'; button.className='entry-link';
    button.classList.toggle('active', row.id===current?.id);
    const title=document.createElement('span'); title.textContent=row.name;
    const meta=document.createElement('small'); meta.textContent=row.type+' · '+stateLabels[row.state];
    button.append(title,meta); button.addEventListener('click',()=>{ if(!busy && canLeave()) run(async()=>edit(await api('/api/admin/entries/'+row.id)));  });
    $('entryList').append(button);
  }
}

const canLeave = () => !dirty || confirm('Quitter cette fiche sans enregistrer les modifications ?');
function markDirty() { dirty=true; $('draftState').textContent='Modifications non enregistrées'; }
function updateImage() { $('imagePreview').hidden=!imagePath; if(imagePath) $('imagePreview').src=imagePath.startsWith('/') ? imagePath : '/'+imagePath; else $('imagePreview').removeAttribute('src'); }
function edit(row) {
  current=row; dirty=false; form.reset();
  $('welcome').hidden=true; form.hidden=false;
  const draft=row?.draft || {name:'',type:'Lieux',subtitle:'',teaser:'',description:'',details:[],tags:[],symbol:'◇',notes:'',relations:[],image:null};
  for (const key of ['name','type','subtitle','teaser','description','symbol','notes']) form.elements.namedItem(key).value=draft[key];
  form.elements.namedItem('details').value=draft.details.join('\n');
  form.elements.namedItem('tags').value=draft.tags.join(', ');
  imagePath=draft.image; updateImage();
  $('editorTitle').textContent=row ? draft.name : 'Nouvelle archive';
  $('publicationState').textContent=stateLabels[row?.state || 'hidden'];
  $('publish').textContent=row?.state==='known' ? 'Publier la mise à jour' : 'Révéler aux joueurs';
  $('draftState').textContent=row ? 'Brouillon enregistré · la version publique change uniquement à la publication' : 'Non enregistrée · privée par défaut';
  selectedRelations = new Map((row?.relationLabels || []).map(target=>[target.id,target]));
  $('relationSearch').value='';lookupPage=1;renderSelected();
  loadRelations().catch(reportReadError);
  renderList();
}

function readForm() {
  const data={image:imagePath,revision:current?.revision};
  for(const key of ['name','type','subtitle','teaser','description','symbol','notes']) data[key]=form.elements.namedItem(key).value;
  data.details=form.elements.namedItem('details').value.split('\n').filter(v=>v.trim());
  data.tags=form.elements.namedItem('tags').value.split(',').filter(v=>v.trim());
  data.relations=[...selectedRelations.keys()];
  return data;
}
function reportReadError(error) { if(error.name !== 'AbortError') notify(error.message,true); }
function syncPager() {
  $('listPrev').disabled=busy || listLoading || listPage<=1;
  $('listNext').disabled=busy || listLoading || listPage>=listPages;
}
async function refresh() {
  clearTimeout(listTimer);listController?.abort();
  const controller=listController=new AbortController(), sequence=++listSequence;
  listLoading=true;syncPager();$('entryList').setAttribute('aria-busy','true');
  const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const params=new URLSearchParams({page:listPage,q:$('search').value.trim(),type:$('listType').value,state:$('listState').value,sort:$('listSort').value});
    const data=await api('/api/admin/entries?'+params,'GET',undefined,controller.signal);
    if(sequence!==listSequence)return;
    records=data.entries;listPage=data.page;listPages=data.pages;listTotal=data.total;
    renderList();$('listStatus').textContent=listTotal+' archives · page '+listPage+' / '+listPages;
  } catch(error) {
    if(sequence===listSequence) { $('entryList').replaceChildren(); $('listStatus').textContent='Liste indisponible · actualisez'; if(error.name!=='AbortError')throw error; }
  } finally {
    clearTimeout(timer);if(sequence===listSequence){listLoading=false;syncPager();$('entryList').setAttribute('aria-busy','false');}
  }
}
function syncLookupPager() {
  $('relationPrev').disabled=busy || lookupPage<=1;
  $('relationNext').disabled=busy || lookupPage>=lookupPages;
}
function renderSelected() {
  $('selectedRelations').replaceChildren();
  for(const target of selectedRelations.values()) {
    const button=document.createElement('button');button.type='button';button.className='relation-chip';
    button.textContent=target.name+' ×';button.setAttribute('aria-label','Retirer le lien vers '+target.name);
    button.addEventListener('click',()=>{selectedRelations.delete(target.id);markDirty();renderSelected();loadRelations().catch(reportReadError);});
    $('selectedRelations').append(button);
  }
  $('selectedCount').textContent=selectedRelations.size+' / 50 liens sélectionnés';
}
async function loadRelations() {
  clearTimeout(lookupTimer);lookupController?.abort();
  const controller=lookupController=new AbortController(),sequence=++lookupSequence;
  const params=new URLSearchParams({page:lookupPage,q:$('relationSearch').value.trim(),exclude:current?.id || '',sort:'name'});
  const timer=setTimeout(()=>controller.abort(),15000);
  $('relationPrev').disabled=true;$('relationNext').disabled=true;
  $('relations').replaceChildren();$('relationStatus').textContent='Recherche…';$('relationRetry').hidden=true;
  try {
    const data=await api('/api/admin/lookup?'+params,'GET',undefined,controller.signal);
    if(sequence!==lookupSequence)return;
    lookupPage=data.page;lookupPages=data.pages;$('relations').replaceChildren();
    $('relationStatus').textContent=data.total+' résultats · page '+lookupPage+' / '+lookupPages;
    for(const target of data.entries) {
      const label=document.createElement('label'),input=document.createElement('input');
      input.type='checkbox';input.value=target.id;input.checked=selectedRelations.has(target.id);
      input.disabled=!input.checked && selectedRelations.size>=50;
      input.addEventListener('change',()=>{
        if(input.checked && selectedRelations.size>=50) {input.checked=false;return;}
        if(input.checked)selectedRelations.set(target.id,target);else selectedRelations.delete(target.id);
        $('relations').querySelectorAll('input').forEach(box=>{box.disabled=!box.checked && selectedRelations.size>=50;});
        markDirty();renderSelected();
      });
      label.append(input,document.createTextNode(target.name+' · '+target.type));$('relations').append(label);
    }
  } catch(error) { if(sequence===lookupSequence) { $('relationStatus').textContent='Recherche indisponible';$('relationRetry').hidden=false;if(error.name!=='AbortError')throw error; } }
  finally {clearTimeout(timer);if(sequence===lookupSequence)syncLookupPager();}
}
async function save() {
  if(!form.checkValidity()) throw new Error('Renseignez le nom et le type de la fiche.');
  const row=await api('/api/admin/entries'+(current?'/'+current.id:''),current?'PUT':'POST',readForm());
  edit(row); await refresh(); notify('Brouillon enregistré.'); return row;
}
async function enter() {
  const session=await api('/api/admin/session'); csrf=session.csrf;
  form.elements.namedItem('type').replaceChildren(...session.types.map(type=>{const o=document.createElement('option');o.value=type;o.textContent=type;return o;}));
  $('listType').replaceChildren(new Option('Tous les types',''),...session.types.map(type=>new Option(type,type)));
  await refresh(); $('loginPanel').hidden=true; $('workspace').hidden=false; $('logout').hidden=false;
  notify('Bienvenue dans l’atelier.');
}
$('loginForm').addEventListener('submit',event=>{event.preventDefault();run(async()=>{await api('/api/login','POST',{username:$('username').value,password:$('password').value});$('password').value='';await enter();});});
$('logout').addEventListener('click',()=>{if(canLeave())run(async()=>{await api('/api/admin/logout','POST',{});dirty=false;location.reload();});});
$('create').addEventListener('click',()=>{if(canLeave()) {edit(null);form.elements.namedItem('name').focus();}});
$('search').addEventListener('input',()=>{
  clearTimeout(listTimer);listSequence++;listController?.abort();listPage=1;
  listTimer=setTimeout(()=>refresh().catch(reportReadError),250);
});
for(const id of ['listType','listState','listSort']) $(id).addEventListener('change',()=>{listPage=1;refresh().catch(reportReadError);});
$('listPrev').addEventListener('click',()=>{listPage=Math.max(1,listPage-1);refresh().catch(reportReadError);});
$('listNext').addEventListener('click',()=>{listPage=Math.min(listPages,listPage+1);refresh().catch(reportReadError);});
$('relationSearch').addEventListener('input',()=>{clearTimeout(lookupTimer);lookupSequence++;lookupController?.abort();lookupPage=1;lookupTimer=setTimeout(()=>loadRelations().catch(reportReadError),250);});
$('relationSearch').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();lookupPage=1;loadRelations().catch(reportReadError);}});
$('relationRetry').addEventListener('click',()=>loadRelations().catch(reportReadError));
$('relationPrev').addEventListener('click',()=>{lookupPage=Math.max(1,lookupPage-1);loadRelations().catch(reportReadError);});
$('relationNext').addEventListener('click',()=>{lookupPage=Math.min(lookupPages,lookupPage+1);loadRelations().catch(reportReadError);});
$('reload').addEventListener('click',()=>{if(canLeave())run(async()=>{const id=current?.id;await refresh();if(id)edit(await api('/api/admin/entries/'+id));notify('Liste actualisée.');});});
form.addEventListener('input',event=>{if(event.target.id!=='relationSearch')markDirty();});
form.addEventListener('change',event=>{if(event.target.id!=='relationSearch')markDirty();});
form.addEventListener('submit',event=>{event.preventDefault();run(save);});
$('imageFile').addEventListener('change',()=>run(async()=>{
  const file=$('imageFile').files[0]; if(!file)return;
  if(file.size>10*1024*1024)throw new Error('L’image dépasse 10 Mo.');
  const data=new FormData();data.append('image',file);
  imagePath=(await api('/api/admin/images','POST',data)).image;updateImage();markDirty();notify('Image importée. Enregistrez le brouillon pour la conserver dans cette fiche.');
}));
$('removeImage').addEventListener('click',()=>{imagePath=null;updateImage();markDirty();});
$('preview').addEventListener('click',()=>run(async()=>{
  const row=dirty || !current ? await save() : current;
  $('previewFrame').src='/?preview='+encodeURIComponent(row.id)+'#codex';$('previewDialog').showModal();
}));
$('closePreview').addEventListener('click',()=>$('previewDialog').close());
$('previewDialog').addEventListener('close',()=>$('previewFrame').removeAttribute('src'));
for(const action of ['publish','seal','hide']) $(action).addEventListener('click',()=>run(async()=>{
  const message={publish:'Publier cette version pour tous les joueurs ?',seal:'Masquer son identité et afficher une archive scellée ?',hide:'Retirer cette archive du codex joueur ? Votre brouillon sera conservé.'}[action];
  if(!confirm(message))return;
  const row=dirty || !current ? await save() : current;
  const changed=await api('/api/admin/entries/'+row.id+'/'+action,'POST',{revision:row.revision});
  await refresh();edit(changed);notify({publish:'La fiche est publiée dans le codex.',seal:'L’archive est scellée. Son contenu reste dans votre brouillon.',hide:'L’archive a été retirée du codex.'}[action]);
}));
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
enter().catch(()=>{$('loginPanel').hidden=false;notify('Connectez-vous pour accéder aux archives privées.');});
