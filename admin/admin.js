const $ = id => document.getElementById(id);
const form = $('entryForm');
let csrf = '', records = [], current = null, imagePath = null, dirty = false, busy = false;
const stateLabels = {known:'Révélée aux joueurs', sealed:'Archive scellée', hidden:'Brouillon privé'};
const notify = (message, error = false) => { $('notice').textContent = message; $('notice').classList.toggle('error', error); };

async function api(path, method = 'GET', data) {
  const options = {method, cache:'no-store', headers:{}};
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
  document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try { await task(); } catch (error) { notify(error.message, true); }
  finally { busy = false; document.querySelectorAll('button').forEach(b=>b.disabled=false); }
}

function renderList() {
  const query = $('search').value.toLocaleLowerCase('fr');
  $('entryList').replaceChildren();
  for (const row of records.filter(r=>(r.draft.name+' '+r.draft.type).toLocaleLowerCase('fr').includes(query))) {
    const button = document.createElement('button'); button.type='button'; button.className='entry-link';
    button.classList.toggle('active', row.id===current?.id);
    const title=document.createElement('span'); title.textContent=row.draft.name;
    const meta=document.createElement('small'); meta.textContent=row.draft.type+' · '+stateLabels[row.state];
    button.append(title,meta); button.addEventListener('click',()=>{ if(!busy && canLeave()) edit(row); });
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
  $('relations').replaceChildren();
  for(const target of records.filter(r=>r.id!==row?.id)) {
    const label=document.createElement('label'), input=document.createElement('input');
    input.type='checkbox'; input.value=target.id; input.checked=draft.relations.includes(target.id);
    label.append(input, document.createTextNode(target.draft.name+' · '+target.draft.type));
    $('relations').append(label);
  }
  renderList();
}

function readForm() {
  const data={image:imagePath,revision:current?.revision};
  for(const key of ['name','type','subtitle','teaser','description','symbol','notes']) data[key]=form.elements.namedItem(key).value;
  data.details=form.elements.namedItem('details').value.split('\n').filter(v=>v.trim());
  data.tags=form.elements.namedItem('tags').value.split(',').filter(v=>v.trim());
  data.relations=[...$('relations').querySelectorAll('input:checked')].map(i=>i.value);
  return data;
}
async function refresh() { records=(await api('/api/admin/entries')).entries; renderList(); }
async function save() {
  if(!form.reportValidity()) throw new Error('Renseignez le nom et le type de la fiche.');
  const row=await api('/api/admin/entries'+(current?'/'+current.id:''),current?'PUT':'POST',readForm());
  await refresh(); edit(row); notify('Brouillon enregistré.'); return row;
}
async function enter() {
  const session=await api('/api/admin/session'); csrf=session.csrf;
  form.elements.namedItem('type').replaceChildren(...session.types.map(type=>{const o=document.createElement('option');o.value=type;o.textContent=type;return o;}));
  await refresh(); $('loginPanel').hidden=true; $('workspace').hidden=false; $('logout').hidden=false;
  notify('Bienvenue dans l’atelier.');
}
$('loginForm').addEventListener('submit',event=>{event.preventDefault();run(async()=>{await api('/api/login','POST',{password:$('password').value});$('password').value='';await enter();});});
$('logout').addEventListener('click',()=>{if(canLeave())run(async()=>{await api('/api/admin/logout','POST',{});dirty=false;location.reload();});});
$('create').addEventListener('click',()=>{if(canLeave()) {edit(null);form.elements.namedItem('name').focus();}});
$('search').addEventListener('input',renderList);
$('reload').addEventListener('click',()=>{if(canLeave())run(async()=>{const id=current?.id;await refresh();if(id)edit(records.find(r=>r.id===id));notify('Liste actualisée.');});});
form.addEventListener('input',markDirty);
form.addEventListener('change',markDirty);
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
