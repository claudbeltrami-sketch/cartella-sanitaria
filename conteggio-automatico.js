/* Administrative outbox: stored atomically with each chart; clinical data never leave LUMEN. */
(function(){
'use strict';
const api=window.lumenConteggioStorage,storage=window.lumenStorage;if(!api)return;
const SITE='https://conteggio-visite.mh2f6rcb4p.chatgpt.site',CONFIG='beltrami_conteggio_config_v1',LINK='lumen_conteggio_link_v1';
const local=storage?.local||localStorage,PAIR='lumen_conteggio_pair_pending_v1';
let busy=false,rerun=false,last='',initializing=true,returnToConteggio=false;
const SELECTED_DATE='lumen_conteggio_selected_date_v1';
function rememberDate(){try{sessionStorage.setItem(SELECTED_DATE,$('conteggioAutoDate').value)}catch{}}
function read(key,fallback){try{return JSON.parse(local.getItem(key)||'null')||fallback}catch{return fallback}}
function text(v){return String(v||'').trim().toLocaleUpperCase('it-IT').replace(/\s+/g,' ')}
function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v}
function prepare(data,old,id,now){
 const previous=old?.conteggioVisits||{};if(storage?.isTest||data.lumen_prova)return previous;
 const date=String(data.data_giudizio||data.data_cartella||'');
 if(!data.giudizio||!validDate(date)||!text(data.cognome)||!text(data.nome))return previous;
 const key=date,prev=previous[key],config=read(CONFIG,{})[date]||{};
 const entry={key,version:crypto.randomUUID(),identity:id,date,name:text(data.cognome)+' '+text(data.nome),company:text(data.datore_lavoro),client:prev?.client||config.client||'',place:prev?.client?prev.place:(config.place||''),savedAt:now,status:'pending'};
 return {...previous,[key]:entry};
}
window.lumenConteggio={prepare,wake:()=>{void drain()}};
async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
function connection(){const link=read(LINK,null);return link&&link.expires>Date.now()?link:null}
async function payload(entry,link){return {visitId:await hash(link.salt+'|'+entry.identity+'|'+entry.date),date:entry.date,client:entry.client,place:entry.place,name:entry.name,company:entry.company,savedAt:entry.savedAt}}
async function pending(){const rows=await api.list();return rows.flatMap(r=>Object.values(r.conteggioVisits||{}).filter(e=>e.status==='pending').map(e=>({id:r.id,entry:e})))}
// Recover only explicitly assigned days, including visits saved before this feature.
// Clinical records, signatures, histories and their timestamps are never rewritten.
async function recoverConfigured(date){
 if(storage?.isTest)return 0;
 const config=read(CONFIG,{}),dates=date?[date]:Object.keys(config);let recovered=0;
 for(const record of await api.list())await api.change(record.id,current=>{
   for(const day of dates){
     if(!validDate(day)||!config[day]?.client)continue;
     let entry=current.conteggioVisits?.[day];
     if(!entry){
       const versions=[{data:current.data,savedAt:current.updatedAt},...(current.history||[]).slice().reverse()];
       const found=versions.find(x=>x.data&&!x.data.lumen_prova&&String(x.data.data_giudizio||x.data.data_cartella||'')===day);
       if(found){
         const stamp=Number.isFinite(Date.parse(found.savedAt))?new Date(found.savedAt).toISOString():new Date().toISOString();
         const entries=prepare(found.data,current,current.id,stamp);
         if(entries[day]){current.conteggioVisits=entries;entry=entries[day];recovered++}
       }
     }
     if(entry&&!entry.client){entry.client=config[day].client;entry.place=config[day].place||'';entry.version=crypto.randomUUID()}
   }
 });
 return recovered;
}
function validLink(link){return link?.version===1&&['token','salt'].every(k=>typeof link[k]==='string'&&/^[a-f0-9]{64}$/.test(link[k]))&&typeof link.account==='string'&&Number.isFinite(link.expires)&&link.expires>Date.now()}
// An explicit reconnection must include visits sent using an earlier link.
// Keep the replay flag until all rows are queued, so an interrupted recovery can resume.
async function replaySent(){
 const link=connection();if(storage?.isTest||!link?.replay)return;
 for(const record of await api.list())await api.change(record.id,current=>{
   for(const entry of Object.values(current.conteggioVisits||{}))if(entry.client&&entry.status==='sent'){
     entry.status='pending';entry.version=crypto.randomUUID();
   }
 });
 if(connection()?.token===link.token)local.setItem(LINK,JSON.stringify({...link,replay:false}));
}
function receiveConnection(){
 const match=location.hash.match(/^#lumen-connected=(.+)$/);if(!match)return false;
 // Scrub the credential from the address bar even when the response is rejected.
 history.replaceState(null,'',location.pathname+location.search);
 try{
   if(storage?.isTest)throw Error('COLLEGAMENTO DISATTIVATO IN MODALITÀ PROVA');
   const reply=JSON.parse(decodeURIComponent(match[1])),pending=JSON.parse(sessionStorage.getItem(PAIR)||'null');
   if(pending?.state===reply.state&&pending.draft)window.lumenBatchCertApi?.apply(pending.draft);
   if(!pending||pending.state!==reply.state||!Number.isFinite(pending.createdAt)||Date.now()-pending.createdAt>900000||!validLink(reply.link))throw Error('COLLEGAMENTO SCADUTO O NON RICHIESTO: PREMI COLLEGA CONTEGGIO VISITE');
   const old=read(LINK,null);
   if(old&&old.account!==reply.link.account&&!confirm('Il nuovo collegamento appartiene a un altro account. Recuperare qui anche le visite già inviate? Le cartelle cliniche restano su questo dispositivo.')){sessionStorage.removeItem(PAIR);return false}
   local.setItem(LINK,JSON.stringify({...reply.link,replay:true}));returnToConteggio=pending.returnToConteggio===true;sessionStorage.removeItem(PAIR);
   last='COLLEGAMENTO COMPLETATO: INVIO AUTOMATICO ATTIVO';return true;
 }catch(e){last=e.message||'COLLEGAMENTO NON COMPLETATO';return false}
}
async function status(){
 const items=await pending(),waiting=items.filter(x=>!x.entry.client).length;
 const date=document.getElementById('conteggioAutoDate')?.value||document.getElementById('data_giudizio')?.value||document.getElementById('data_cartella')?.value||'',assignment=read(CONFIG,{})[date];
 const msg=storage?.isTest?'MODALITÀ PROVA: NESSUN INVIO ONLINE.':(connection()?'COLLEGATO':'DA COLLEGARE')+' · '+items.length+' VISITE IN ATTESA'+(waiting?' ('+waiting+' SENZA COMMITTENTE)':'')+(assignment?' · '+date+' → '+assignment.client:'')+(last?' · '+last:'');
 document.getElementById('conteggioAutoStatus').textContent=msg;
 const connectButton=document.getElementById('conteggioAutoConnect');if(connectButton)connectButton.hidden=!!connection();
 document.getElementById('conteggioAutoDetails').textContent=msg;
 const list=document.getElementById('conteggioAutoPending');list.replaceChildren();
 const groups=new Map();for(const {entry:e}of items){const key=e.date+' · '+(e.client||'COMMITTENTE DA INDICARE');groups.set(key,(groups.get(key)||0)+1)}
 for(const [label,count]of groups){const p=document.createElement('p');p.textContent=label+': '+count;list.appendChild(p)}
}
async function drain(){
 if(storage?.isTest)return;
 if(initializing){rerun=true;return}
 if(busy){rerun=true;return}busy=true;
 try{
 const link=connection();if(!link){await status();return}
 for(const {id,entry}of await pending()){
   if(!entry.client)continue;
   if(connection()?.token!==link.token)break;
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
   try{
     const outgoing=await payload(entry,link);
     const response=await fetch(SITE+'/api/lumen/visits',{method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'application/json','Authorization':'Bearer '+link.token},body:JSON.stringify(outgoing),signal:controller.signal});
     if(!response.ok){if(response.status===401)local.setItem(LINK,JSON.stringify({...link,expires:0}));last=response.status===401?'RICOLLEGA CONTEGGIO VISITE':'INVIO NON RIUSCITO: RIPROVERÒ';break}
     const receipt=await response.json();if(receipt.ok!==true||receipt.visitId!==outgoing.visitId)throw Error('Ricevuta non valida');
     await api.change(id,current=>{const row=current.conteggioVisits?.[entry.key];if(row?.version===entry.version){row.status='sent';row.sentAccount=link.account}});
     last='ULTIMO INVIO CONFERMATO';
   }catch{last='OFFLINE O INVIO NON CONFERMATO: VISITE CONSERVATE';break}finally{clearTimeout(timeout)}
 }
 await status();
 if(returnToConteggio&&connection()&&!(await pending()).some(x=>x.entry.client)){returnToConteggio=false;window.location.assign(SITE)}
 }catch{last='CONTEGGIO IN ATTESA: RIAPRI IL PANNELLO PER RIPROVARE';document.getElementById('conteggioAutoStatus').textContent=last}
 finally{busy=false;if(rerun){rerun=false;void drain()}}
}
const style=document.createElement('style');style.textContent='#conteggioAutoPanel{margin:10px 0;padding:12px;border:2px solid #277347;border-radius:8px;background:#f1faf3}#conteggioAutoPanel button{background:#176537;color:white;padding:12px;font-weight:bold}#conteggioAutoDialog{max-width:650px;width:calc(100% - 30px);max-height:90vh;overflow:auto;border:2px solid #277347;border-radius:10px;padding:20px}#conteggioAutoDialog label{display:block;margin:10px 0}#conteggioAutoDialog input,#conteggioAutoDialog textarea,#conteggioAutoDialog select{display:block;width:100%;box-sizing:border-box;padding:10px}#conteggioAutoDialog button{padding:12px;margin:6px 6px 6px 0}#conteggioAutoDialog a{color:#064c94}@media print{#conteggioAutoPanel,#conteggioAutoDialog{display:none!important}}';document.head.appendChild(style);
const panel=document.createElement('section');panel.id='conteggioAutoPanel';panel.innerHTML='<button type="button" id="btnConteggioAuto">CONTEGGIO AUTOMATICO</button><p id="conteggioAutoStatus" role="status">PREPARAZIONE CONTEGGIO…</p>';
const anchor=document.getElementById('btnSalva');const toolbar=anchor?.closest('.toolbar')||anchor?.parentElement; if(toolbar)toolbar.insertAdjacentElement('afterend',panel);else document.body.prepend(panel);
const dialog=document.createElement('dialog');dialog.id='conteggioAutoDialog';dialog.innerHTML='<h2>CONTEGGIO AUTOMATICO</h2><p>Salvi la visita in LUMEN e il conteggio si aggiorna. Si inviano solo nome, azienda, data, committente e sede.</p><p id="conteggioAutoDetails" role="status"></p><div id="conteggioAutoPending"></div><label>VISITE PRESENTI SU QUESTO DISPOSITIVO<select id="conteggioAutoArchiveDates"><option value="">SCEGLI UNA DATA DALL’ARCHIVIO</option></select></label><p id="conteggioAutoResult" role="status"></p><label>DATA DELLE VISITE<input type="date" id="conteggioAutoDate"></label><label>COMMITTENTE<input id="conteggioAutoClient" list="conteggioAutoClients" placeholder="ES. SERMOLAB" maxlength="200"></label><datalist id="conteggioAutoClients"><option>SERMOLAB</option><option>ADÒC HEALTHCARE</option><option>COMPANY CONSULTING</option><option>BUSINESS GROUP</option><option>HEALTHMED</option><option>ALMA CONTROL</option><option>GRUPPO ORIZZONTE</option><option>CARITAS</option></datalist><label>SEDE<input id="conteggioAutoPlace" maxlength="200"></label><button type="button" id="conteggioAutoConfigure">SALVA COMMITTENTE E AGGIORNA CONTEGGIO</button><p>Include anche le visite già archiviate per questa data. Le visite già assegnate mantengono il loro committente.</p><hr><button type="button" id="conteggioAutoConnect">COLLEGA CONTEGGIO VISITE</button><p>Solo la prima volta: se richiesto, accedi al tuo account. Torni automaticamente qui, senza copiare codici. Puoi fare tutto da questo dispositivo.</p><p><a id="conteggioAutoLink" target="_self">APRI CONTEGGIO VISITE</a></p><details><summary>Stato e gestione collegamento</summary><button type="button" id="conteggioAutoRetry">AGGIORNA ORA</button><button type="button" id="conteggioAutoDisconnect">SCOLLEGA QUESTO DISPOSITIVO</button></details><button type="button" id="conteggioAutoClose">CHIUDI</button>';document.body.appendChild(dialog);
const $=id=>document.getElementById(id);$('conteggioAutoLink').href=SITE;
function loadDate(){const c=read(CONFIG,{})[$('conteggioAutoDate').value]||{};$('conteggioAutoClient').value=c.client||'';$('conteggioAutoPlace').value=c.place||'';rememberDate();$('conteggioAutoResult').textContent=''}
async function loadArchiveDates(){
 const counts=new Map();
 for(const record of await api.list()){
   const days=new Set();
   for(const {data:d} of [{data:record.data},...(record.history||[]).slice().reverse()]){
     const day=String(d?.data_giudizio||d?.data_cartella||'');
     if(!d||d.lumen_prova||!validDate(day)||days.has(day))continue;
     days.add(day);
     if(d.giudizio&&text(d.cognome)&&text(d.nome))counts.set(day,(counts.get(day)||0)+1);
   }
 }
 const select=$('conteggioAutoArchiveDates');select.replaceChildren();
 const empty=document.createElement('option');empty.value='';empty.textContent=counts.size?'SCEGLI UNA DATA DALL’ARCHIVIO':'NESSUNA VISITA COMPLETA IN QUESTO ARCHIVIO';select.appendChild(empty);
 for(const [day,count]of [...counts].sort((a,b)=>b[0].localeCompare(a[0]))){const option=document.createElement('option');option.value=day;option.textContent=day.split('-').reverse().join('/')+' · '+count+' VISITE';select.appendChild(option)}
 select.value=counts.has($('conteggioAutoDate').value)?$('conteggioAutoDate').value:'';
}
$('btnConteggioAuto').onclick=async()=>{
 if(!$('conteggioAutoDate').value){const d=window.lumenBatchCertApi?.collect()||{};let selected='';try{selected=sessionStorage.getItem(SELECTED_DATE)||''}catch{}
 $('conteggioAutoDate').value=validDate(selected)?selected:(d.data_giudizio||d.data_cartella||(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0')));loadDate()}
 if(!dialog.open)dialog.showModal();await status();try{await loadArchiveDates()}catch{$('conteggioAutoResult').textContent='ARCHIVIO NON LETTO: CHIUDI E RIAPRI IL PANNELLO'}
};
$('conteggioAutoDate').onchange=()=>{loadDate();$('conteggioAutoArchiveDates').value=$('conteggioAutoDate').value;void status()};
$('conteggioAutoArchiveDates').onchange=()=>{if($('conteggioAutoArchiveDates').value){$('conteggioAutoDate').value=$('conteggioAutoArchiveDates').value;loadDate();void status()}};
$('conteggioAutoClose').onclick=()=>dialog.close();
$('conteggioAutoConfigure').onclick=async()=>{
 try{const date=$('conteggioAutoDate').value,client=text($('conteggioAutoClient').value),place=text($('conteggioAutoPlace').value);if(!validDate(date)||!client)throw Error('INSERISCI DATA E COMMITTENTE');
 const config=read(CONFIG,{});config[date]={client,place};local.setItem(CONFIG,JSON.stringify(config));
 rememberDate();
 const recovered=await recoverConfigured(date);
 const entries=(await api.list()).flatMap(r=>r.conteggioVisits?.[date]?[r.conteggioVisits[date]]:[]);
 $('conteggioAutoResult').textContent=date.split('-').reverse().join('/')+' · '+(entries.length?entries.length+' VISITE NEL CONTEGGIO ('+entries.filter(e=>e.status==='sent').length+' GIÀ INVIATE).':'NESSUNA VISITA COMPLETA TROVATA NELL’ARCHIVIO DI QUESTO DISPOSITIVO.');
 last='COMMITTENTE SALVATO: '+client+(recovered?' · '+recovered+' VISITE RECUPERATE DALL’ARCHIVIO':'');await status();if(recoveryRequested&&initializing)startConnection(true);else void drain();
 }catch(e){$('conteggioAutoDetails').textContent=e.message||'CONFIGURAZIONE NON SALVATA'}
};
function startConnection(returnToConteggio=false){
 try{
   if(storage?.isTest)throw Error('COLLEGAMENTO DISATTIVATO IN MODALITÀ PROVA');
   const state=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
   sessionStorage.setItem(PAIR,JSON.stringify({state,createdAt:Date.now(),draft:window.lumenBatchCertApi?.collect(),returnToConteggio}));
   window.location.assign(SITE+'/collega-lumen?state='+state);
 }catch(e){$('conteggioAutoDetails').textContent=e.message||'COLLEGAMENTO NON AVVIATO: LA CARTELLA RESTA APERTA'}
};
$('conteggioAutoConnect').onclick=()=>startConnection();
$('conteggioAutoRetry').onclick=()=>drain();$('conteggioAutoDisconnect').onclick=async()=>{local.removeItem(LINK);last='DISPOSITIVO SCOLLEGATO';await status()};
window.addEventListener('online',()=>void drain());window.addEventListener('focus',()=>void drain());
setInterval(()=>{if(document.visibilityState!=='hidden')void drain()},30000);
const recoveryRequested=location.hash==='#lumen-recover-conteggio';
if(recoveryRequested){
 history.replaceState(null,'',location.pathname+location.search);
 // Do not send to the previous account while establishing the requested link.
 void recoverConfigured().then(async()=>{
   const count=(await api.list()).reduce((n,r)=>n+Object.values(r.conteggioVisits||{}).filter(e=>e.client).length,0);
   if(count){startConnection(true);return}
   last='NESSUNA VISITA ASSEGNATA AL CONTEGGIO IN QUESTO ARCHIVIO';await $('btnConteggioAuto').onclick();
   $('conteggioAutoResult').textContent='Se le cartelle sono in un altro browser, apri LUMEN da quel browser. Altrimenti scegli la data e il committente delle visite da recuperare.';
 }).catch(()=>{last='ARCHIVIO NON LETTO: RIAPRI LUMEN PER RIPROVARE';void status().catch(()=>{})});
}else{
 const connected=receiveConnection();if(connected)void $('btnConteggioAuto').onclick();
 void recoverConfigured().then(()=>replaySent()).then(()=>{initializing=false;rerun=false;return drain()}).catch(()=>{last='RECUPERO CONTEGGI NON COMPLETATO: RIAPRI LUMEN PER RIPROVARE';void status().catch(()=>{})});
}
})();
