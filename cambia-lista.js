/* LUMEN - cambio rapido tra liste importate. 28/08/2026 */
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
function snapshot(id,label){
 return {
  id:id||uid(),
  label:cleanName(label||attachedSourceName||''),
  workers:Array.isArray(workers)?workers.map(w=>({...w})):[],
  currentWorkerIndex:Number.isInteger(currentWorkerIndex)?currentWorkerIndex:-1,
  attachedSourceName:attachedSourceName||label||'',
  session:read(SESSION_KEY,null),
  esiti:read(ESITI_KEY,{}),
  originalMeta:read(ORIGINAL_META_KEY,null),
  updated:new Date().toISOString()
 };
}
function migrateCurrent(){
 let lists=getLists();
 let active=localStorage.getItem(ACTIVE_KEY)||'';
 if(!lists.length){
  const d=read(WORKERS_KEY,null);
  if(d&&Array.isArray(d.workers)&&d.workers.length){
   const id=uid();
   const rec={id,label:cleanName(d.attachedSourceName||'LISTA 1'),workers:d.workers,currentWorkerIndex:Number.isInteger(d.currentWorkerIndex)?d.currentWorkerIndex:-1,attachedSourceName:d.attachedSourceName||'',session:read(SESSION_KEY,null),esiti:read(ESITI_KEY,{}),originalMeta:read(ORIGINAL_META_KEY,null),updated:new Date().toISOString()};
   lists=[rec];active=id;setLists(lists);localStorage.setItem(ACTIVE_KEY,id);
  }
 }
 if(lists.length&&!lists.some(x=>x.id===active)){active=lists[0].id;localStorage.setItem(ACTIVE_KEY,active)}
 return active;
}
function saveActive(){
 const id=localStorage.getItem(ACTIVE_KEY);if(!id)return;
 const lists=getLists(),i=lists.findIndex(x=>x.id===id);if(i<0)return;
 lists[i]=snapshot(id,lists[i].label||attachedSourceName);setLists(lists);
}
function activate(id){
 saveActive();const lists=getLists(),rec=lists.find(x=>x.id===id);if(!rec)return;
 write(WORKERS_KEY,{workers:rec.workers||[],currentWorkerIndex:Number.isInteger(rec.currentWorkerIndex)?rec.currentWorkerIndex:-1,attachedSourceName:rec.attachedSourceName||rec.label||'',when:new Date().toISOString()});
 if(rec.session)write(SESSION_KEY,rec.session);else localStorage.removeItem(SESSION_KEY);
 write(ESITI_KEY,rec.esiti||{});
 if(rec.originalMeta)write(ORIGINAL_META_KEY,rec.originalMeta);else localStorage.removeItem(ORIGINAL_META_KEY);
 localStorage.setItem(ACTIVE_KEY,id);location.reload();
}
function addCurrentAsNewList(){
 const lists=getLists(),id=uid(),base=cleanName(attachedSourceName||('LISTA '+(lists.length+1)));
 let label=base,n=2;while(lists.some(x=>x.label===label)){label=base+' ('+n+++')'}
 const rec=snapshot(id,label);lists.push(rec);setLists(lists);localStorage.setItem(ACTIVE_KEY,id);renderSwitcher();
}
function renderSwitcher(){
 const anchor=document.querySelector('.list-search');if(!anchor)return;
 let bar=document.getElementById('lumenCambiaLista');
 if(!bar){
  bar=document.createElement('div');bar.id='lumenCambiaLista';bar.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0;padding:10px;border:2px solid #173a5e;border-radius:10px;background:#f6f9fc';
  const lab=document.createElement('strong');lab.textContent='CAMBIA LISTA';lab.style.cssText='font-size:15px;white-space:nowrap';
  const sel=document.createElement('select');sel.id='lumenListaSelect';sel.style.cssText='min-height:44px;min-width:230px;max-width:100%;font-size:16px;font-weight:700;padding:6px 10px';sel.onchange=()=>{if(sel.value&&sel.value!==localStorage.getItem(ACTIVE_KEY))activate(sel.value)};
  const info=document.createElement('span');info.id='lumenListaInfo';info.style.cssText='font-size:12px;font-weight:700';
  bar.append(lab,sel,info);anchor.parentNode.insertBefore(bar,anchor);
 }
 const sel=document.getElementById('lumenListaSelect'),info=document.getElementById('lumenListaInfo'),lists=getLists(),active=localStorage.getItem(ACTIVE_KEY)||'';
 sel.innerHTML='';lists.forEach((x,i)=>{const o=document.createElement('option');o.value=x.id;o.textContent=(i+1)+'. '+x.label+' — '+(x.workers||[]).length+' LAVORATORI';o.selected=x.id===active;sel.appendChild(o)});
 if(!lists.length){const o=document.createElement('option');o.textContent='NESSUNA LISTA SALVATA';o.value='';sel.appendChild(o)}
 const a=lists.find(x=>x.id===active);info.textContent=a?'ATTIVA: '+a.label:'';
}

migrateCurrent();
const originalSave=typeof saveWorkersLocal==='function'?saveWorkersLocal:null;
if(originalSave){saveWorkersLocal=function(){originalSave();saveActive()}}

const confirmBtn=document.getElementById('btnConfermaImport');
if(confirmBtn&&typeof confirmBtn.onclick==='function'){
 const oldConfirm=confirmBtn.onclick;
 confirmBtn.onclick=async function(ev){
  saveActive();
  const oldWorkers=Array.isArray(workers)?workers:[],oldRef=oldWorkers.map(w=>[w.cognome,w.nome,w.codice_fiscale].join('|')).join('~'),oldSource=attachedSourceName;
  await oldConfirm.call(this,ev);
  const newWorkers=Array.isArray(workers)?workers:[],newRef=newWorkers.map(w=>[w.cognome,w.nome,w.codice_fiscale].join('|')).join('~');
  if(newWorkers.length&&(newRef!==oldRef||attachedSourceName!==oldSource))addCurrentAsNewList();
  else {saveActive();renderSwitcher()}
 };
}

window.addEventListener('beforeunload',saveActive);
window.addEventListener('pagehide',saveActive);
setTimeout(renderSwitcher,0);
window.lumenCambiaLista={saveActive,activate,getLists};
})();
