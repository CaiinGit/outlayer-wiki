'use strict';
const $=id=>document.getElementById(id),make=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
let tree=null,selected=null,learned=new Set(),page=1,pages=1,controller,affinityId=null,sequence=0,listSequence=0;
const names={active:'Active',passive:'Passive',ultimate:'Ultime'};
const board=new SkillGraph.Board($('treeBoard'),{onSelect:id=>openCard(id,true),onZoom:z=>$('zoomValue').textContent=Math.round(z*100)+' %'});
async function api(path,signal){const response=await fetch(path,{cache:'no-store',signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Les Affinités sont indisponibles.');return data;}
let cardTimer,pinned=false;
const card=$('skillInspector');
function closeCard(){clearTimeout(cardTimer);card.hidden=true;pinned=false;selected=null;board.selected=null;board.states();}
function positionCard(){const anchor=board.buttons.get(selected);if(!anchor)return;const rect=anchor.getBoundingClientRect(),top=document.querySelector('.topbar').getBoundingClientRect().bottom+10;const w=card.offsetWidth,h=card.offsetHeight;let x=rect.right+18;if(x+w>innerWidth-12)x=rect.left-w-18;card.style.left=Math.max(12,Math.min(x,innerWidth-w-12))+'px';card.style.top=Math.max(top,Math.min(rect.top-20,innerHeight-h-12))+'px';}
function openCard(id,pin=false){clearTimeout(cardTimer);if(pinned&&!pin)return;selected=id;pinned=pin;board.selected=id;board.states();showSkill();card.hidden=false;positionCard();}
function scheduleClose(){clearTimeout(cardTimer);if(!pinned)cardTimer=setTimeout(()=>{if(!card.matches(':hover')&&!card.contains(document.activeElement))closeCard();},180);}
$('treeBoard').addEventListener('pointerover',e=>{const node=e.target.closest('.skill-node');if(node&&e.pointerType!=='touch'&&innerWidth>=700)openCard(node.dataset.id);});
$('treeBoard').addEventListener('pointerout',e=>{if(e.target.closest('.skill-node')&&!e.relatedTarget?.closest?.('.skill-node'))scheduleClose();});
$('treeBoard').addEventListener('focusin',e=>{const node=e.target.closest('.skill-node');if(node&&node.matches(':focus-visible'))openCard(node.dataset.id);});
$('treeBoard').addEventListener('focusout',scheduleClose);
$('treeBoard').addEventListener('pointerdown',e=>{if(!e.target.closest('.skill-node'))closeCard();});
$('treeBoard').addEventListener('wheel',closeCard,{passive:true});
card.addEventListener('pointerenter',()=>clearTimeout(cardTimer));card.addEventListener('pointerleave',scheduleClose);card.addEventListener('focusout',scheduleClose);
$('closeSkill').onclick=()=>{const node=board.buttons.get(selected);closeCard();node?.focus({preventScroll:true});closeCard();};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCard();});
document.addEventListener('pointerdown',e=>{if(!card.contains(e.target)&&!e.target.closest('.skill-node'))closeCard();});
window.addEventListener('resize',closeCard);
function updateSimulation(){learned=SkillGraph.prune(tree,learned);board.learned=$('simulate').checked?learned:null;board.states();const points=tree.nodes.filter(n=>learned.has(n.id)).reduce((sum,n)=>sum+n.points,0);$('simulationTotal').textContent=$('simulate').checked?learned.size+' compétences · '+points+' points simulés':'Consultation de l’arbre';}
function showSkill(){
 const node=tree?.nodes.find(n=>n.id===selected);$('skillDetail').hidden=!node;if(!node)return;
 $('skillName').textContent=node.name;$('skillType').textContent=names[node.kind]+' · '+node.points+' point'+(node.points>1?'s':'')+' de déblocage';
 for(const [key,id,fallback] of [['description','skillDescription','Aucune description renseignée.'],['acquisition','skillAcquisition','Consultez les prérequis ci-dessous.'],['usage','skillUsage','Utilisation à préciser par le MJ.'],['cost','skillCost','Coût à préciser par le MJ.'],['cooldown','skillCooldown','Non précisé.'],['range','skillRange','Non précisée.']])$(id).textContent=node[key]||fallback;
 const required=SkillGraph.parents(tree,node.id);$('skillPrerequisites').replaceChildren();$('requirementMode').textContent=required.length?(node.requirement_mode==='any'?'Au moins un de ces prérequis :':'Tous ces prérequis :'):'Aucun prérequis dans cet arbre.';
 for(const id of required){const item=make('li',''),button=make('button',(learned.has(id)&&$('simulate').checked?'✓ ':'')+tree.nodes.find(n=>n.id===id).name);button.onclick=()=>{selected=id;board.selected=id;board.states();openCard(id,true);};item.append(button);$('skillPrerequisites').append(item);}
 $('learnSkill').hidden=!$('simulate').checked;$('learnSkill').disabled=!learned.has(node.id)&&!SkillGraph.canUnlock(tree,node.id,learned);$('learnSkill').textContent=learned.has(node.id)?'Retirer du parcours':SkillGraph.canUnlock(tree,node.id,learned)?'Ajouter au parcours':'Prérequis manquants';
}
async function openAffinity(id){closeCard();$('affinityPicker').open=false;controller?.abort();const request=controller=new AbortController(),seq=++sequence;affinityId=id;$('skillsNotice').textContent='Chargement de l’arbre…';$('talentLayout').hidden=true;
 try{const data=await api('/api/affinities/'+id,request.signal);if(seq!==sequence)return;tree=data.tree;selected=null;learned=new Set();$('treeName').textContent=tree.name;$('affinityDescription').textContent=tree.description;$('talentLayout').hidden=false;$('skillsNotice').textContent='';$('treeEmpty').hidden=!!tree.nodes.length;board.selected=null;board.render(tree);board.fit();updateSimulation();document.querySelectorAll('.affinity-choice').forEach(button=>{if(button.dataset.id===id)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});}
 catch(error){if(error.name!=='AbortError')$('skillsNotice').textContent=error.message;}
}
async function loadAffinities(){
 const seq=++listSequence;
 try{const data=await api('/api/affinities?page='+page);if(seq!==listSequence)return;page=data.page;pages=data.pages;$('affinityList').replaceChildren();for(const row of data.items){const button=make('button','','affinity-choice');button.dataset.id=row.id;button.style.setProperty('--affinity',row.color);button.append(make('b',row.symbol||'✦'),make('span',row.name));button.onclick=()=>openAffinity(row.id);$('affinityList').append(button);}
 $('affinityPager').hidden=pages<=1;$('prevAffinity').disabled=page<=1;$('nextAffinity').disabled=page>=pages;$('affinityPage').textContent=page+' / '+pages;$('affinityEmpty').hidden=!!data.total;
 if(data.items.length)await openAffinity(data.items.some(n=>n.id===affinityId)?affinityId:data.items[0].id);else $('talentLayout').hidden=true;
 }catch(error){$('skillsNotice').textContent=error.message;}
}
$('learnSkill').onclick=()=>{if(!selected)return;if(learned.has(selected))learned.delete(selected);else if(SkillGraph.canUnlock(tree,selected,learned))learned.add(selected);updateSimulation();showSkill();};
$('simulate').onchange=()=>{if(tree){updateSimulation();showSkill();}};$('resetBuild').onclick=()=>{learned.clear();if(tree){updateSimulation();showSkill();}};
$('zoomIn').onclick=()=>board.zoomBy(1.2);$('zoomOut').onclick=()=>board.zoomBy(1/1.2);$('fitTree').onclick=()=>board.fit();
$('prevAffinity').onclick=()=>{page--;loadAffinities();};$('nextAffinity').onclick=()=>{page++;loadAffinities();};
const toggle=document.querySelector('.menu-toggle'),nav=$('mainNav');function closeMenu(){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Ouvrir le menu');}toggle.onclick=()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');};document.addEventListener('click',e=>{if(!e.target.closest('.topbar'))closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});document.querySelector('.topbar').addEventListener('focusout',e=>{if(!e.currentTarget.contains(e.relatedTarget))closeMenu();});matchMedia('(max-width:1080px)').addEventListener('change',closeMenu);
new ResizeObserver(()=>document.documentElement.style.setProperty('--header-size',document.querySelector('.topbar').getBoundingClientRect().height+'px')).observe(document.querySelector('.topbar'));
(async()=>{try{const {user}=await api('/api/session');const allowed=user&&['mj','player'].includes(user.role);document.body.classList.toggle('access-locked',!allowed);$('skillsContent').hidden=!allowed;$('accessGate').hidden=!!allowed;$('editSkills').hidden=user?.role!=='mj';document.querySelector('.account-link').textContent=user?'Mon compte':'Connexion';if(allowed)await loadAffinities();}catch(error){$('skillsNotice').textContent=error.message;$('accessGate').hidden=false;}})();
