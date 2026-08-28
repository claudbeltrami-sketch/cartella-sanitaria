/* LUMEN - cambio rapido liste + cancellazione lavoratore. 28/08/2026 */
(function(){
'use strict';
const LISTS_KEY='beltrami_worker_lists_v1';
const ACTIVE_KEY='beltrami_worker_list_active_v1';
const WORKERS_KEY='beltrami_workers_v8';
const SESSION_KEY='beltrami_v9_sessione_attiva';
const ESITI_KEY='beltrami_v9_esiti';
const ORIGINAL_META_KEY='beltrami_lista_originale_attiva_v1';

function read(k,def){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?def:v}catch(_){return def}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}
function uid(){return 'LISTA_'+Date.now()+'_'+Math.random().toString(36).slice(2,8)}
function cleanName(v){return String(v||'').replace(/\.(xlsx?|csv|pdf|docx?|json)$/i,'').trim()||'LISTA SENZA NOME'}
function getLists(){const v=read(LISTS_KEY,[]);return Array.isArray(v)?v:[]}
function setLists(v){write(LISTS_KEY,v)}
function getCurrent(){const d=read(WORKERS_KEY,{workers:[],currentWorkerIndex:-1,attachedSourceName:''});return Array.isArray(d)?{workers:d,currentWorkerIndex:-1,attachedSourceName:''}:d}
function currentSnapshot(id,label){const d=getCurrent();return {id:id||uid(),label:cleanName(label||d.attachedSourceName||''),workers:Array.isArray(d.workers)?d.workers:[],currentWorkerIndex:Number.isInteger(d.currentWorkerIndex)?d.currentWorkerIndex:-1,attachedSourceName:d.attachedSourceName||label||'',session:read(SESSION_KEY,null),esiti:read(ESITI_KEY,{}),originalMeta:read(ORIGINAL_META_KEY,null),updated:new Date().toISOString()}}
function migrateCurrent(){let lists=getLists(),active=localStorage.getItem(ACTIVE_KEY)||'';if(!lists.length){const d=getCurrent();if(Array.isArray(d.workers)&&d.workers.length){const id=uid();lists=[currentSnapshot(id,d.attachedSourceName||'LISTA 1')];active=id;setLists(lists);localStorage.setItem(ACTIVE_KEY,id)}}if(lists.length&&!lists.some(x=>x.id===active)){active=lists[0].id;localStorage.setItem(ACTIVE_KEY,active)}return active}
function saveCurrentIntoActive(){const id=localStorage.getItem(ACTIVE_KEY);if(!id)return;const lists=getLists(),i=lists.findIndex(x=>x.id===id);if(i<0)return;lists[i]=currentSnapshot(id,lists[i].label);setLists(lists)}
function activate(id){saveCurrentIntoActive();const rec=getLists().find(x=>x.id===id);if(!rec)return;write(WORKERS_KEY,{workers:rec.workers||[],currentWorkerIndex:Number.isInteger(rec.currentWorkerIndex)?rec.currentWorkerIndex:-1,attachedSourceName:rec.attachedSourceName||rec.label||'',when:new Date().toISOString()});if(rec.session)write(SESSION_KEY,rec.session);else localStorage.removeItem(SESSION_KEY);write(ESITI_KEY,rec.esiti||{});if(rec.originalMeta)write(ORIGINAL_META_KEY,rec.originalMeta);else localStorage.removeItem(ORIGINAL_META_KEY);localStorage.setItem(ACTIVE_KEY,id);location.reload()}
function renderSwitcher(){const anchor=document.querySelector('.list-search');if(!anchor)return;let bar=document.getElementById('lumenCambiaLista');if(!bar){bar=document.createElement('div');bar.id='lumenCambiaLista';bar.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0;padding:10px;border:2px solid #173a5e;border-radius:10px;background:#f6f9fc';const lab=document.createElement('strong');lab.textContent='CAMBIA LISTA';lab.style.cssText='font-size:15px;white-space:nowrap';const sel=document.createElement('select');sel.id='lumenListaSelect';sel.style.cssText='min-height:44px;min-width:230px;max-width:100%;font-size:16px;font-weight:700;padding:6px 10px';sel.onchange=()=>{if(sel.value&&sel.value!==localStorage.getItem(ACTIVE_KEY))activate(sel.value)};const info=document.createElement('span');info.id='lumenListaInfo';info.style.cssText='font-size:12px;font-weight:700';bar.append(lab,sel,info);anchor.parentNode.insertBefore(bar,anchor)}const sel=document.getElementById('lumenListaSelect'),info=document.getElementById('lumenListaInfo'),lists=getLists(),active=localStorage.getItem(ACTIVE_KEY)||'';sel.innerHTML='';lists.forEach((x,i)=>{const o=document.createElement('option');o.value=x.id;o.textContent=(i+1)+'. '+x.label+' — '+(x.workers||[]).length+' LAVORATORI';o.selected=x.id===active;sel.appendChild(o)});if(!lists.length){const o=document.createElement('option');o.textContent='NESSUNA LISTA SALVATA';o.value='';sel.appendChild(o)}const a=lists.find(x=>x.id===active);info.textContent=a?'ATTIVA: '+a.label:''}

function deleteWorker(index){const d=getCurrent(),ws=Array.isArray(d.workers)?d.workers:[];const w=ws[index];if(!w)return;const nome=((w.cognome||'')+' '+(w.nome||'')).trim()||('N. '+(index+1));if(!confirm('CANCELLARE DEFINITIVAMENTE '+nome+' DALLA LISTA?'))return;ws.splice(index,1);let ci=Number.isInteger(d.currentWorkerIndex)?d.currentWorkerIndex:-1;if(ci===index)ci=-1;else if(ci>index)ci--;write(WORKERS_KEY,{...d,workers:ws,currentWorkerIndex:ci,when:new Date().toISOString()});const active=localStorage.getItem(ACTIVE_KEY),lists=getLists(),li=lists.findIndex(x=>x.id===active);if(li>=0){lists[li]={...lists[li],workers:ws,currentWorkerIndex:ci,updated:new Date().toISOString()};setLists(lists)}location.reload()}
function addDeleteButtons(){document.querySelectorAll('#workersBody tr').forEach(tr=>{const td=tr.lastElementChild;if(!td||td.querySelector('.lumen-delete-worker'))return;const n=parseInt((tr.children[0]||{}).textContent,10)-1;if(n<0)return;const b=document.createElement('button');b.type='button';b.className='danger lumen-delete-worker';b.textContent='CANCELLA';b.style.marginLeft='5px';b.onclick=()=>deleteWorker(n);td.appendChild(b)})}

migrateCurrent();renderSwitcher();addDeleteButtons();
const body=document.getElementById('workersBody');if(body)new MutationObserver(()=>{addDeleteButtons();renderSwitcher()}).observe(body,{childList:true,subtree:true});
window.addEventListener('pagehide',saveCurrentIntoActive);
window.lumenCambiaLista={activate,getLists,deleteWorker};
})();
