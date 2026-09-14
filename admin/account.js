'use strict';
const el = id => document.getElementById(id);
let accountCsrf = '';
async function accountApi(path, data) {
  const response = await fetch(path, {method:data===undefined?'GET':'POST', cache:'no-store', headers:{'Content-Type':'application/json','X-CSRF-Token':accountCsrf}, body:data===undefined?undefined:JSON.stringify(data)});
  const result = await response.json();
  if(!response.ok) throw Error(result.error || 'Le serveur est indisponible.');
  return result;
}
async function showAccount() {
  const {user,csrf} = await accountApi('/api/session'); accountCsrf=csrf || '';
  el('anonymous').hidden=!!user; el('connected').hidden=!user;
  el('accountNotice').textContent=user?'Votre session est ouverte.':'Connectez-vous ou créez votre compte pour rejoindre la campagne.';
  if(user) {
    el('accountName').textContent=user.username;
    el('accountRole').textContent={mj:'Maître de jeu · accès total',player:'Joueur · accès au codex',guest:'Invité · votre accès au codex attend la validation du MJ.'}[user.role];
    el('openCodex').hidden=user.role==='guest'; el('openWorkshop').hidden=user.role!=='mj';el('openUsers').hidden=user.role!=='mj';
  }
}
function submit(id, task) {
  el(id).addEventListener('submit',async event=>{
    event.preventDefault(); const form=event.currentTarget, button=form.querySelector('button'); button.disabled=true;
    try {const data=Object.fromEntries(new FormData(form)); if('confirm' in data && data.confirm!==data.password)throw Error('Les mots de passe ne correspondent pas.');await task(data); form.reset();}
    catch(error){el('accountNotice').textContent=error.message;} finally{button.disabled=false;}
  });
}
submit('signIn', async data=>{await accountApi('/api/login',data);await showAccount();});
submit('signUp', async data=>{await accountApi('/api/register',data);await accountApi('/api/login',{username:data.username,password:data.password});await showAccount();});
submit('passwordForm', async data=>{await accountApi('/api/account/password',data);await showAccount();el('accountNotice').textContent='Mot de passe modifié. Reconnectez-vous avec le nouveau.';});
el('signOut').addEventListener('click',async()=>{try{await accountApi('/api/logout',{});await showAccount();}catch(error){el('accountNotice').textContent=error.message;}});
showAccount().catch(()=>{el('accountNotice').textContent='Connexion au serveur impossible. Rechargez cette page.';});
