/* Administrative outbox: stored atomically with each chart; clinical data never leave LUMEN. */
(function(){
'use strict';
const api=window.lumenConteggioStorage,storage=window.lumenStorage;if(!api)return;
const SITE='https://conteggio-visite.mh2f6rcb4p.chatgpt.site',CONFIG='beltrami_conteggio_config_v1',LINK='lumen_conteggio_link_v1';
const local=storage?.local||localStorage;
let busy=false,rerun=false,last='';
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
async function status(){
 const items=await pending(),waiting=items.filter(x=>!x.entry.client).length;
 const date=document.getElementById('data_giudizio')?.value||document.getElementById('data_cartella')?.value||'',assignment=read(CONFIG,{})[date];
 const msg=storage?.isTest?'MODALITÀ PROVA: NESSUN INVIO ONLINE.':(connection()?'COLLEGATO':'DA COLLEGARE')+' · '+items.length+' VISITE IN ATTESA'+(waiting?' ('+waiting+' SENZA COMMITTENTE)':'')+(assignment?' · '+date+' → '+assignment.client:'')+(last?' · '+last:'');
 document.getElementById('conteggioAutoStatus').textContent=msg;
 document.getElementById('conteggioAutoDetails').textContent=msg;
 const list=document.getElementById('conteggioAutoPending');list.replaceChildren();
 const groups=new Map();for(const {entry:e}of items){const key=e.date+' · '+(e.client||'COMMITTENTE DA INDICARE');groups.set(key,(groups.get(key)||0)+1)}
 for(const [label,count]of groups){const p=document.createElement('p');p.textContent=label+': '+count;list.appendChild(p)}
}
async function drain(){
 if(storage?.isTest)return;
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
     if(!response.ok){last=response.status===401?'RICOLLEGA CONTEGGIO VISITE':'INVIO NON RIUSCITO: RIPROVERÒ';break}
     const receipt=await response.json();if(receipt.ok!==true||receipt.visitId!==outgoing.visitId)throw Error('Ricevuta non valida');
     await api.change(id,current=>{const row=current.conteggioVisits?.[entry.key];if(row?.version===entry.version)row.status='sent'});
     last='ULTIMO INVIO CONFERMATO';
   }catch{last='OFFLINE O INVIO NON CONFERMATO: VISITE CONSERVATE';break}finally{clearTimeout(timeout)}
 }
 await status();
 }catch{last='CONTEGGIO IN ATTESA: RIAPRI IL PANNELLO PER RIPROVARE';document.getElementById('conteggioAutoStatus').textContent=last}
 finally{busy=false;if(rerun){rerun=false;void drain()}}
}
const style=document.createElement('style');style.textContent='#conteggioAutoPanel{margin:10px 0;padding:12px;border:2px solid #277347;border-radius:8px;background:#f1faf3}#conteggioAutoPanel button{background:#176537;color:white;padding:12px;font-weight:bold}#conteggioAutoDialog{max-width:650px;width:calc(100% - 30px);max-height:90vh;overflow:auto;border:2px solid #277347;border-radius:10px;padding:20px}#conteggioAutoDialog label{display:block;margin:10px 0}#conteggioAutoDialog input,#conteggioAutoDialog textarea{display:block;width:100%;box-sizing:border-box;padding:10px}#conteggioAutoDialog button{padding:12px;margin:6px 6px 6px 0}#conteggioAutoDialog a{color:#064c94}@media print{#conteggioAutoPanel,#conteggioAutoDialog{display:none!important}}';document.head.appendChild(style);
const panel=document.createElement('section');panel.id='conteggioAutoPanel';panel.innerHTML='<button type="button" id="btnConteggioAuto">CONTEGGIO AUTOMATICO</button><p id="conteggioAutoStatus" role="status">PREPARAZIONE CONTEGGIO…</p>';
const anchor=document.getElementById('btnSalva');const toolbar=anchor?.closest('.toolbar')||anchor?.parentElement; if(toolbar)toolbar.insertAdjacentElement('afterend',panel);else document.body.prepend(panel);
const dialog=document.createElement('dialog');dialog.id='conteggioAutoDialog';dialog.innerHTML='<h2>CONTEGGIO AUTOMATICO · MAC E IPHONE</h2><p>Ogni visita con giudizio salvato viene conteggiata una sola volta. Si inviano solo nome, azienda, data, committente e sede.</p><p id="conteggioAutoDetails" role="status"></p><div id="conteggioAutoPending"></div><label>DATA DELLE VISITE<input type="date" id="conteggioAutoDate"></label><label>COMMITTENTE<input id="conteggioAutoClient" list="conteggioAutoClients" placeholder="ES. SERMOLAB" maxlength="200"></label><datalist id="conteggioAutoClients"><option>SERMOLAB</option><option>ADÒC HEALTHCARE</option><option>COMPANY CONSULTING</option><option>BUSINESS GROUP</option><option>HEALTHMED</option><option>ALMA CONTROL</option><option>GRUPPO ORIZZONTE</option><option>CARITAS</option></datalist><label>SEDE<input id="conteggioAutoPlace" maxlength="200"></label><button type="button" id="conteggioAutoConfigure">IMPOSTA COMMITTENTE PER QUESTA DATA</button><p>Vale per le prossime visite di questa data e per quelle in attesa senza committente. Le visite già assegnate mantengono il loro committente.</p><hr><p><a id="conteggioAutoLink" target="_blank" rel="noopener">1. APRI CONTEGGIO VISITE E GENERA IL CODICE</a></p><label>2. INCOLLA IL CODICE DI COLLEGAMENTO<textarea id="conteggioAutoCode" rows="3" autocomplete="off" spellcheck="false"></textarea></label><button type="button" id="conteggioAutoConnect">COLLEGA</button><button type="button" id="conteggioAutoRetry">RIPROVA INVIO</button><button type="button" id="conteggioAutoDisconnect">SCOLLEGA QUESTO DISPOSITIVO</button><p>Sull’iPhone apri Conteggio visite, accedi allo stesso account e premi ATTIVA RICEZIONE. Le nuove visite arrivano all’apertura e mentre il registro è aperto. Il codice di collegamento non è incluso nel backup: dopo un ripristino, ricollega il dispositivo.</p><button type="button" id="conteggioAutoClose">CHIUDI</button>';document.body.appendChild(dialog);
const $=id=>document.getElementById(id);$('conteggioAutoLink').href=SITE+'/collega-lumen';
function loadDate(){const c=read(CONFIG,{})[$('conteggioAutoDate').value]||{};$('conteggioAutoClient').value=c.client||'';$('conteggioAutoPlace').value=c.place||''}
$('btnConteggioAuto').onclick=async()=>{const d=window.lumenBatchCertApi?.collect()||{};$('conteggioAutoDate').value=d.data_giudizio||d.data_cartella||(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0'));loadDate();dialog.showModal();await status()};
$('conteggioAutoDate').onchange=loadDate;$('conteggioAutoClose').onclick=()=>dialog.close();
$('conteggioAutoConfigure').onclick=async()=>{
 try{const date=$('conteggioAutoDate').value,client=text($('conteggioAutoClient').value),place=text($('conteggioAutoPlace').value);if(!validDate(date)||!client)throw Error('INSERISCI DATA E COMMITTENTE');
 const config=read(CONFIG,{});config[date]={client,place};local.setItem(CONFIG,JSON.stringify(config));
 for(const r of await api.list())await api.change(r.id,current=>{for(const row of Object.values(current.conteggioVisits||{}))if(row.date===date&&!row.client){row.client=client;row.place=place;row.version=crypto.randomUUID()}});
 last='COMMITTENTE IMPOSTATO: '+client;await status();void drain();
 }catch(e){$('conteggioAutoDetails').textContent=e.message||'CONFIGURAZIONE NON SALVATA'}
};
$('conteggioAutoConnect').onclick=async()=>{
 try{if(storage?.isTest)throw Error('COLLEGAMENTO DISATTIVATO IN MODALITÀ PROVA');const code=$('conteggioAutoCode').value.trim();if(!code.startsWith('LUMEN1.'))throw Error('CODICE NON VALIDO');const link=JSON.parse(atob(code.slice(7)));if(link.version!==1||!['token','salt'].every(k=>typeof link[k]==='string'&&/^[a-f0-9]{64}$/.test(link[k]))||typeof link.account!=='string'||!Number.isFinite(link.expires)||link.expires<=Date.now())throw Error('CODICE NON VALIDO O SCADUTO');
 const old=read(LINK,null);if(old&&old.account!==link.account&&!confirm('Il codice appartiene a un altro account. Inviare le visite in attesa a questo account?'))return;
 local.setItem(LINK,JSON.stringify(link));$('conteggioAutoCode').value='';last='COLLEGAMENTO SALVATO';await drain();
 }catch(e){$('conteggioAutoDetails').textContent=e.message||'COLLEGAMENTO NON SALVATO'}
};
$('conteggioAutoRetry').onclick=()=>drain();$('conteggioAutoDisconnect').onclick=async()=>{local.removeItem(LINK);last='DISPOSITIVO SCOLLEGATO';await status()};
window.addEventListener('online',()=>void drain());window.addEventListener('focus',()=>void drain());
setInterval(()=>{if(document.visibilityState!=='hidden')void drain()},30000);
void status().catch(()=>{});setTimeout(()=>void drain(),1000);
})();
