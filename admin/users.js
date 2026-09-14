'use strict';
const node=id=>document.getElementById(id), roles={guest:'Invité',player:'Joueur',mj:'MJ — accès total'};
let token='', userPage=1, pages=1, sequence=0, searchTimer;
async function usersApi(path,method='GET',data){
  const response=await fetch(path,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:data===undefined?undefined:JSON.stringify(data)});
  const result=await response.json();if(!response.ok)throw Error(result.error || 'Requête impossible.');return result;
}
async function loadUsers(){
  const seq=++sequence;
  const data=await usersApi('/api/admin/users?'+new URLSearchParams({page:userPage,q:node('userSearch').value}));if(seq!==sequence)return;
  userPage=data.page;pages=data.pages;node('usersCount').textContent=data.total+' comptes · page '+userPage+' / '+pages;
  node('usersPrev').disabled=userPage<=1;node('usersNext').disabled=userPage>=pages;node('usersList').replaceChildren();
  for(const user of data.users){
    const form=document.createElement('form');form.className='user-row';
    const title=document.createElement('label');title.textContent='Identifiant';const username=document.createElement('input');username.name='username';username.value=user.username;username.required=true;username.minLength=user.username==='mj'?2:3;username.maxLength=40;username.pattern=(user.username==='mj'?'mj|':'')+'[a-zA-Z0-9][a-zA-Z0-9_.\\-]{2,39}';username.autocomplete='off';title.append(username);
    const roleLabel=document.createElement('label');roleLabel.textContent='Rôle';const role=document.createElement('select');
    for(const [value,label] of Object.entries(roles))role.add(new Option(label,value));role.value=user.role;roleLabel.append(role);
    const activeLabel=document.createElement('label');activeLabel.textContent='Accès';const active=document.createElement('select');active.add(new Option('Actif','1'));active.add(new Option('Désactivé','0'));active.value=String(user.active);activeLabel.append(active);
    const passwordLabel=document.createElement('label');passwordLabel.textContent='Réinitialiser le mot de passe (facultatif)';const password=document.createElement('input');password.type='password';password.minLength=12;password.maxLength=1024;password.autocomplete='new-password';passwordLabel.append(password);
    const save=document.createElement('button');save.textContent='Enregistrer';form.append(title,roleLabel,activeLabel,passwordLabel,save);
    form.addEventListener('submit',async event=>{event.preventDefault();
      if(role.value==='mj' && user.role!=='mj' && !confirm('Accorder l’accès total du MJ à '+user.username+' ?'))return;
      save.disabled=true;
      try{const update={username:username.value,role:role.value,active:active.value==='1'};if(password.value)update.password=password.value;const result=await usersApi('/api/admin/users/'+user.id,'PUT',update);password.value='';await loadUsers();node('usersNotice').textContent=result.sessionsRevoked?'Compte mis à jour. Ses anciennes sessions sont fermées.':'Compte mis à jour. Le nouvel identifiant est utilisable dès maintenant ; le mot de passe reste inchangé.';}
      catch(error){node('usersNotice').textContent=error.message;}finally{save.disabled=false;}
    });node('usersList').append(form);
  }
}
node('createUser').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),data=Object.fromEntries(new FormData(form));if(data.role==='mj'&&!confirm('Créer un compte MJ avec accès total ?'))return;button.disabled=true;try{await usersApi('/api/admin/users','POST',data);form.reset();await loadUsers();node('usersNotice').textContent='Compte créé.';}catch(error){node('usersNotice').textContent=error.message;}finally{button.disabled=false;}});
const report=error=>{node('usersNotice').textContent=error.message;};
node('userSearch').addEventListener('input',()=>{clearTimeout(searchTimer);sequence++;userPage=1;searchTimer=setTimeout(()=>loadUsers().catch(report),250);});
node('usersPrev').addEventListener('click',()=>{userPage=Math.max(1,userPage-1);loadUsers().catch(report);});
node('usersNext').addEventListener('click',()=>{userPage=Math.min(pages,userPage+1);loadUsers().catch(report);});
(async()=>{const session=await usersApi('/api/admin/session');token=session.csrf;await loadUsers();node('usersWorkspace').hidden=false;node('usersNotice').textContent='Validez les invités en leur attribuant le rôle Joueur.';})().catch(()=>{node('usersNotice').replaceChildren(document.createTextNode('Cet espace est réservé au MJ. '));const link=document.createElement('a');link.href='/account/';link.textContent='Se connecter';node('usersNotice').append(link);});
