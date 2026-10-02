/* Local chart import. One transaction; existing visits are never replaced. */
(function(){
'use strict';
const storage=window.lumenImportCartelleStorage,input=document.getElementById('fileImportaCartelle');
if(!storage||!input)return;
const MAX_CHARTS=200,MAX_FILE=50*1024*1024,MAX_JSON=4*1024*1024,MAX_TOTAL=32*1024*1024;
const form=document.getElementById('cartellaForm');
const fields=[...form.querySelectorAll('input[id],select[id],textarea[id]')].filter(e=>!e.hasAttribute('data-temporary'));
const allowed=selector=>[...document.querySelectorAll(selector)].map(e=>e.value);
const norm=v=>String(v||'').trim().toLocaleUpperCase('it-IT').replace(/\s+/g,' ');
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const visit=d=>d.data_giudizio||d.data_cartella||'';
const label=d=>[d.cognome,d.nome].join(' ')+' · '+visit(d).split('-').reverse().join('/');
const clone=v=>JSON.parse(JSON.stringify(v));
function validate(source){
 if(!source||Array.isArray(source)||typeof source!=='object')throw Error('Cartella JSON non valida.');
 window.lumenStorage.checkData(source);
 if(source.tipo)throw Error('Il file contiene un backup, una richiesta firma o un altro formato, non una cartella.');
 const data={};
 for(const el of fields){
  const value=source[el.id];
  if(el.type==='checkbox'){
   if(value!==undefined&&typeof value!=='boolean')throw Error('Casella non valida: '+el.id);
   data[el.id]=value??false;
  }else{
   if(value!==undefined&&typeof value!=='string')throw Error('Valore non valido: '+el.id);
   data[el.id]=value??'';
   if(el.type==='date'&&data[el.id]&&!validDate(data[el.id]))throw Error('Data non valida: '+el.id);
   if(el.tagName==='SELECT'&&data[el.id]&&![...el.options].some(o=>o.value===data[el.id]))throw Error('Opzione non valida: '+el.id);
  }
 }
 for(const k of ['rischi','protocollo']){
  if(!Array.isArray(source[k])||source[k].some(v=>typeof v!=='string'||!allowed('#'+k+' input').includes(v)))throw Error('Elenco '+k+' mancante o non valido.');
  data[k]=[...new Set(source[k])];
 }
 if(!allowed('input[name="giudizio"]').includes(source.giudizio))throw Error('Giudizio mancante o non valido.');
 data.giudizio=source.giudizio;
 if(source.firma_lavoratore_png!==undefined&&typeof source.firma_lavoratore_png!=='string')throw Error('Firma non valida.');
 data.firma_lavoratore_png=source.firma_lavoratore_png||'';
 if(data.firma_lavoratore_png&&!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$/.test(data.firma_lavoratore_png))throw Error('Formato firma non valido.');
 data.cognome=norm(data.cognome);data.nome=norm(data.nome);data.lavoratore=[data.cognome,data.nome].join(' ');
 data.codice_fiscale=norm(data.codice_fiscale).replace(/\s/g,'');
 if(!data.cognome||!data.nome||!validDate(visit(data))||!data.datore_lavoro.trim()||!data.mansione.trim())throw Error('Mancano nominativo, data visita, azienda o mansione.');
 if(!data.codice_fiscale){
  const calculated=storage.calculateCF(data);
  if(!calculated)throw Error('CF assente: per calcolarlo servono nome, cognome, sesso, data e luogo di nascita riconosciuto.');
  data.codice_fiscale=calculated.cf;data.cf_codice_catastale=calculated.cat;data.cf_comune=data.luogo_nascita||data.cf_comune;
 }
 if(data.codice_fiscale&&!/^(?:[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]|[0-9]{11})$/.test(data.codice_fiscale))throw Error('Codice fiscale non valido.');
 if(!storage.validCF(data.codice_fiscale))throw Error('Carattere di controllo del codice fiscale non valido.');
 return data;
}
function unpack(value){
 if(value?.tipo==='LUMEN_IMPORT_CARTELLE_V1'&&Array.isArray(value.cartelle))return value.cartelle;
 if(Array.isArray(value))return value;
 return [value];
}
async function parse(file){
 if(!file||file.size>MAX_FILE)throw Error('Scegli un file ZIP o JSON fino a 50 MB.');
 const entries=[];let total=0;
 if(/\.zip$/i.test(file.name)){
  if(!window.JSZip)throw Error('Lettura ZIP non disponibile. Ricarica LUMEN con la connessione attiva.');
  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  const candidates=Object.values(zip.files).filter(e=>!e.dir&&/\.json$/i.test(e.name)&&!/(^|\/)(__MACOSX|VERIFICHE|DA_COMPLETARE)\//i.test(e.name)&&!/(^|\/)\./.test(e.name));
  const ready=candidates.filter(e=>/(^|\/)01_CARTELLE_PRONTE\//i.test(e.name));
  const selected=ready.length?ready:candidates.filter(e=>/(^|\/)CARTELLA_[^/]+\.json$/i.test(e.name)||/(^|\/)cartelle\.json$/i.test(e.name));
  if(!selected.length)throw Error('Nello ZIP non trovo cartelle JSON.');
  if(selected.length>MAX_CHARTS)throw Error('Sono ammesse fino a 200 cartelle per importazione.');
  // Check declared expansion before inflating, then verify actual text length too.
  let declared=0;
  for(const entry of selected){const bytes=entry._data?.uncompressedSize;if(!Number.isFinite(bytes)||bytes>MAX_JSON)throw Error('Una cartella nello ZIP supera 4 MB.');declared+=bytes;}
  if(declared>MAX_TOTAL)throw Error('Il contenuto dello ZIP supera 32 MB.');
  for(const entry of selected){const text=await entry.async('string');if(text.length>MAX_JSON)throw Error('Cartella troppo grande: '+entry.name);total+=text.length;entries.push({name:entry.name,text});}
 }else if(/\.json$/i.test(file.name)){
  if(file.size>MAX_TOTAL)throw Error('Il JSON supera 32 MB.');
  entries.push({name:file.name,text:await file.text()});
 }else throw Error('Seleziona il pacchetto ZIP oppure un file JSON.');
 if(total>MAX_TOTAL)throw Error('Il contenuto supera 32 MB.');
 const charts=[];
 for(const entry of entries){
  let parsed;try{parsed=JSON.parse(entry.text)}catch{throw Error('JSON non leggibile: '+entry.name)}
  for(const source of unpack(parsed)){
   try{charts.push({name:entry.name,data:validate(source),calculatedCF:!String(source.codice_fiscale||'').trim()})}catch(e){throw Error(entry.name+': '+e.message)}
   if(charts.length>MAX_CHARTS)throw Error('Sono ammesse fino a 200 cartelle per importazione.');
  }
 }
 if(!charts.length)throw Error('Il file non contiene cartelle.');
 return charts;
}
function sameData(a,b){
 // Ignore provenance metadata, but compare every persisted clinical field.
 const keys=[...fields.map(e=>e.id),'rischi','protocollo','giudizio','firma_lavoratore_png'];
 return keys.every(k=>{
  const value=d=>d?.[k]??(fields.find(e=>e.id===k)?.type==='checkbox'?false:k==='rischi'||k==='protocollo'?[]:'');
  return JSON.stringify(value(a))===JSON.stringify(value(b));
 });
}
function plan(charts,records,now){
 const byId=new Map(records.map(r=>[r.id,clone(r)])),changed=new Map(),rows=[];
 const incompatible=new Set();
 for(let i=0;i<charts.length;i++)for(let j=i+1;j<charts.length;j++){
  const a=charts[i].data,b=charts[j].data;
  if(storage.id(a)!==storage.id(b))continue;
  if(norm(a.cognome)!==norm(b.cognome)||norm(a.nome)!==norm(b.nome)||(a.data_nascita&&b.data_nascita&&a.data_nascita!==b.data_nascita)||(visit(a)===visit(b)&&!sameData(a,b))){incompatible.add(i);incompatible.add(j)}
 }
 for(const item of charts){
  const d=item.data,identity=storage.identity(d),id=storage.id(d),old=byId.get(id);
  const person=r=>({cognome:norm(r.cognome||r.data?.cognome),nome:norm(r.nome||r.data?.nome),dn:r.dataNascita||r.data?.data_nascita||'',cf:norm(r.cf||r.data?.codice_fiscale)});
  const p=person({data:d});
  const possible=[...byId.values()].filter(r=>{const x=person(r);return x.cognome===p.cognome&&x.nome===p.nome&&(!x.dn||!p.dn||x.dn===p.dn)&&(!x.cf||!p.cf||x.cf===p.cf)});
  let status,detail,record;
  const oldP=old&&person(old);
  if(incompatible.has(rows.length)){
   status='conflict';detail='DATI IN CONFLITTO NEL PACCHETTO';
  }else if(old&&(oldP.cognome!==p.cognome||oldP.nome!==p.nome||(oldP.dn&&p.dn&&oldP.dn!==p.dn))||possible.some(r=>r.id!==id)){
   status='conflict';detail='IDENTITÀ DA VERIFICARE';
  }else if(old){
   const versions=[{data:old.data},...(old.history||[])],matching=versions.filter(v=>visit(v.data||{})===visit(d));
   if(matching.some(v=>sameData(v.data,d))){status='duplicate';detail='GIÀ PRESENTE';}
   else if(matching.length){status='conflict';detail='VISITA GIÀ PRESENTE CON DATI DIVERSI';}
   else{
    record=clone(old);record.updatedAt=now;record.history=record.history||[];
    if(visit(d)>visit(old.data||{})){
     if(old.data)record.history.push({savedAt:old.updatedAt||old.createdAt||now,data:old.data});
     record.data=clone(d);record.cognome=d.cognome;record.nome=d.nome;record.dataNascita=d.data_nascita;record.cf=identity.cf;record.nomeKey=identity.nomeKey;
    }else record.history.push({savedAt:now,data:clone(d)});
    status='newVisit';detail='NUOVA VISITA; PRECEDENTI CONSERVATE';
   }
  }else{
   record={id,cf:identity.cf,cognome:d.cognome,nome:d.nome,dataNascita:d.data_nascita,nomeKey:identity.nomeKey,createdAt:now,updatedAt:now,data:clone(d),history:[]};
   status='new';detail='NUOVA CARTELLA';
  }
  if(record){
   record.importazioni=[...(old?.importazioni||[]),{file:item.name,dataVisita:visit(d),importatoIl:now,cfCalcolato:!!item.calculatedCF}];
   // Queue administrative counting only after all charts commit successfully.
   const visits=window.lumenConteggio?.prepare(d,old,id,now);
   if(visits&&Object.keys(visits).length)record.conteggioVisits=visits;
   byId.set(id,record);changed.set(id,record);
  }
  rows.push({label:label(d),company:d.datore_lavoro+' · CF '+d.codice_fiscale+(item.calculatedCF?' (CALCOLATO)':''),status,detail});
 }
 return {rows,records:[...changed.values()],added:rows.filter(r=>r.status==='new'||r.status==='newVisit').length,duplicates:rows.filter(r=>r.status==='duplicate').length,conflicts:rows.filter(r=>r.status==='conflict').length};
}
function fingerprint(records){return JSON.stringify(records.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))))}
async function readRecords(){const db=await storage.open();try{return await new Promise((resolve,reject)=>{const req=db.transaction(storage.store,'readonly').objectStore(storage.store).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}finally{db.close()}}
async function commit(charts,before,now){
 const db=await storage.open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(storage.store,'readwrite'),store=tx.objectStore(storage.store),request=store.getAll();let result,reason;
  request.onsuccess=()=>{try{
   if(fingerprint(request.result)!==before)throw Error('ARCHIVIO CAMBIATO. Riapri il file per aggiornare il controllo prima di importare.');
   result=plan(charts,request.result,now);
   for(const record of result.records)store.put(record);
  }catch(e){reason=e;tx.abort()}};
  tx.oncomplete=()=>resolve(result);
  tx.onabort=tx.onerror=()=>reject(reason||tx.error||Error('Salvataggio non riuscito. Nessuna cartella del pacchetto è stata importata.'));
 })}finally{db.close()}
}
const css=document.createElement('style');css.textContent=`
.chart-import-modal{position:fixed;inset:0;z-index:100100;background:#0009;padding:16px;display:flex;align-items:center;justify-content:center}.chart-import-modal[hidden]{display:none}.chart-import-card{background:#fff;color:#172b3a;border-radius:12px;padding:20px;width:min(850px,100%);max-height:90vh;overflow:auto;box-sizing:border-box}.chart-import-card h2{font-style:normal;text-align:left}.chart-import-list{max-height:45vh;overflow:auto;border:1px solid #ddd;margin:12px 0}.chart-import-row{padding:10px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}.chart-import-row strong,.chart-import-row span{display:block}.chart-import-row[data-status=conflict]{background:#fff0dc}.chart-import-row[data-status=duplicate]{background:#f1f4f6}.chart-import-actions{display:flex;gap:10px;flex-wrap:wrap}.chart-import-actions button{min-height:44px}.chart-import-message{white-space:pre-line}@media print{.chart-import-modal{display:none!important}}`;
css.textContent+=' .chart-import-card [hidden]{display:none!important}';
document.head.appendChild(css);
const modal=document.createElement('div');modal.className='chart-import-modal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','chartImportTitle');
modal.innerHTML='<div class="chart-import-card"><h2 id="chartImportTitle">IMPORTAZIONE CARTELLE</h2><p class="chart-import-message" id="chartImportMessage" role="status"></p><div class="chart-import-list" id="chartImportList"></div><div class="chart-import-actions"><button type="button" class="success" id="chartImportConfirm">IMPORTA</button><button type="button" class="secondary" id="chartImportClose">ANNULLA</button><button type="button" class="secondary" id="chartImportArchive" hidden>APRI ARCHIVIO</button></div></div>';
document.body.appendChild(modal);
const $=id=>document.getElementById(id),message=$('chartImportMessage'),list=$('chartImportList'),confirmButton=$('chartImportConfirm'),closeButton=$('chartImportClose'),archiveButton=$('chartImportArchive');
let pending=null,busy=false,previousFocus=null;
function showRows(result){
 list.replaceChildren();
 for(const row of result.rows){const el=document.createElement('div');el.className='chart-import-row';el.dataset.status=row.status;for(const [tag,value] of [['strong',row.label],['span',row.company],['span',row.detail]]){const child=document.createElement(tag);child.textContent=value;el.appendChild(child)}list.appendChild(el)}
}
function close(){if(busy)return;modal.hidden=true;pending=null;input.disabled=false;previousFocus?.focus()}
closeButton.onclick=close;
archiveButton.onclick=()=>{close();$('btnArchivioCartelle').click()};
modal.addEventListener('keydown',event=>{
 if(event.key==='Escape'){event.preventDefault();close()}
 if(event.key==='Tab'){const focusable=[...modal.querySelectorAll('button')].filter(e=>!e.hidden&&!e.disabled);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
});
input.addEventListener('change',async()=>{
 const file=input.files[0];input.value='';if(!file||busy)return;
 busy=true;input.disabled=true;previousFocus=document.activeElement;modal.hidden=false;pending=null;
 list.replaceChildren();message.textContent='CONTROLLO DEL PACCHETTO IN CORSO…';confirmButton.hidden=true;closeButton.disabled=true;archiveButton.hidden=true;closeButton.textContent='ANNULLA';
 try{
  const charts=await parse(file),records=await readRecords(),now=new Date().toISOString(),result=plan(charts,records,now);
  pending={charts,before:fingerprint(records),now};showRows(result);
  message.textContent=charts.length+' CARTELLE NEL FILE\n'+result.added+' DA IMPORTARE · '+result.duplicates+' GIÀ PRESENTI · '+result.conflicts+' DA VERIFICARE\nLe visite già presenti con dati diversi restano invariate e non vengono importate.';
  confirmButton.textContent='IMPORTA '+result.added+' CARTELLE / VISITE';confirmButton.hidden=!result.added;confirmButton.disabled=false;
 }catch(e){message.textContent='IMPORTAZIONE NON AVVIATA\n'+(e.message||String(e))+'\nNessuna cartella modificata.';closeButton.textContent='CHIUDI'}
 finally{busy=false;closeButton.disabled=false;(confirmButton.hidden?closeButton:confirmButton).focus()}
});
confirmButton.onclick=async()=>{
 if(!pending||busy)return;busy=true;confirmButton.disabled=true;closeButton.disabled=true;message.textContent='SALVATAGGIO DELLE CARTELLE IN CORSO…';
 try{
  const result=await commit(pending.charts,pending.before,pending.now);showRows(result);
  message.textContent='IMPORTAZIONE COMPLETATA\n'+result.added+' CARTELLE / VISITE SALVATE · '+result.duplicates+' GIÀ PRESENTI · '+result.conflicts+' DA VERIFICARE'+(result.conflicts?'\nLe righe da verificare non sono state importate.':'');
  window.lumenBatchCertApi?.setStatus(message.textContent.replace(/\n/g,' — '));
  archiveButton.hidden=false;
  // No clinical data are sent by this importer; existing counting runs after commit.
  window.lumenConteggio?.wake();
 }catch(e){message.textContent='IMPORTAZIONE NON ESEGUITA\n'+(e.message||String(e))+'\nNessuna cartella del pacchetto è stata salvata.'}
 finally{pending=null;busy=false;confirmButton.hidden=true;closeButton.disabled=false;closeButton.textContent='CHIUDI';(archiveButton.hidden?closeButton:archiveButton).focus()}
};
window.lumenImportCartelle={validate,parse,plan,commit,readRecords,fingerprint};
})();
