/* Historical source PDFs. Local attachments only: never writes clinical charts,
   signatures, active forms, sessions, due dates or administrative visit counts. */
(function(root){
'use strict';
const FORMAT='LUMEN_STORICO_CARTACEO_V1',FLAG='cartella_storica_originale_v1';
const MAX_BYTES=100*1024*1024,MAX_PDF=25*1024*1024,MAX_TOTAL=64*1024*1024,MAX_ROWS=200;
const norm=v=>String(v||'').trim().toLocaleUpperCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function text(v,key,max=250){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Campo mancante o non valido: '+key);return v.trim()}
const hash=async bytes=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
function validCF(cf){
 if(!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf))return false;
 const odd=[1,0,5,7,9,13,15,17,19,21,1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23];
 let sum=0;for(let i=0;i<15;i++){const n='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(cf[i]);sum+=i%2?(n<10?n:n-10):odd[n]}
 return cf[15]===String.fromCharCode(65+sum%26);
}
async function parse(file){
 if(!file||!file.size||file.size>MAX_BYTES)throw Error('Scegli un pacchetto storico JSON non vuoto fino a 100 MB.');
 let p;try{p=JSON.parse(await file.text())}catch{throw Error('Pacchetto storico JSON non leggibile.')}
 if(p?.tipo!==FORMAT||!Array.isArray(p.documenti)||!p.documenti.length||p.documenti.length>MAX_ROWS)throw Error('Formato storico non riconosciuto (1-200 documenti).');
 const result=[];let total=0;
 for(const d of p.documenti){
  if(d?.identitaVerificata!==true)throw Error('Identità non verificata nel pacchetto.');
  const cognome=text(d.cognome,'cognome',100),nome=text(d.nome,'nome',100),birth=d.dataNascita;
  if(!norm(cognome)||!norm(nome)||!date(birth)||!date(d.dataVisita)||d.dataVisita<birth)throw Error('Identità o data visita non valida.');
  const cf=String(d.codiceFiscale||'').trim().toUpperCase();if(cf&&!validCF(cf))throw Error('Codice fiscale non valido: '+cognome+' '+nome);
  const company=text(d.azienda,'azienda'),name=text(d.file,'file',180),note=d.note||'';
  if(!/^[^/\\]+\.pdf$/i.test(name)||typeof note!=='string'||note.length>2000||!Number.isSafeInteger(d.pagine)||d.pagine<1||d.pagine>500)throw Error('Metadati del PDF non validi.');
  if(typeof d.base64!=='string'||!d.base64.length||d.base64.length>Math.ceil(MAX_PDF/3)*4||d.base64.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(d.base64))throw Error('PDF incorporato non valido o oltre 25 MB.');
  const binary=root.atob(d.base64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));total+=bytes.length;
  if(bytes.length>MAX_PDF||total>MAX_TOTAL||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('Contenuto PDF non valido o pacchetto oltre 64 MB.');
  const sha=await hash(bytes);if(!/^[a-f0-9]{64}$/.test(d.sha256||'')||sha!==d.sha256)throw Error('Impronta PDF diversa dall’originale: '+name);
  const source=text(d.fonte,'fonte',300),workerKey=cf?'CF_'+cf:'ANAG_'+[norm(cognome),norm(nome),birth].join('|');
  const key=JSON.stringify([workerKey,d.dataVisita,sha]);
  result.push({id:'STORICO_'+await hash(new TextEncoder().encode(key)),kind:'allegato_cartella_v1',workerKey,workerCf:cf,workerLabel:cognome+' '+nome,workerBirth:birth,visit:d.dataVisita,documentDate:d.dataVisita,name,type:'application/pdf',size:bytes.length,hash:sha,note:'CARTELLA CARTACEA ORIGINALE FIRMATA - '+company+(note?' - '+note:''),storicoCartaceo:{tipo:FLAG,cognome,nome,azienda:company,pagine:d.pagine,fonte:source,identitaVerificata:true,note},blob:new Blob([bytes],{type:'application/pdf'})});
 }
 return result;
}
function plan(rows,existing,charts=[]){
 const seen=existing.slice(),out=[],added=[],duplicates=[],conflicts=[];
 for(const row of rows){
  const same=seen.filter(r=>r.kind==='allegato_cartella_v1'&&r.workerKey===row.workerKey&&r.visit===row.visit);
  const wrongHash=seen.some(r=>r.kind==='allegato_cartella_v1'&&r.hash===row.hash&&(r.workerKey!==row.workerKey||r.visit!==row.visit));
  const sameIdentity=charts.filter(r=>norm(r.cognome||r.data?.cognome)===norm(row.storicoCartaceo.cognome)&&norm(r.nome||r.data?.nome)===norm(row.storicoCartaceo.nome)&&(r.dataNascita||r.data?.data_nascita)===row.workerBirth);
  const exact=charts.find(r=>r.id===row.workerKey);
  const ambiguous=sameIdentity.some(r=>r.id!==row.workerKey)||exact&&((exact.dataNascita||exact.data?.data_nascita)&& (exact.dataNascita||exact.data?.data_nascita)!==row.workerBirth||norm(exact.cognome||exact.data?.cognome)!==norm(row.storicoCartaceo.cognome));
  let status;
  if(wrongHash||ambiguous||same.some(r=>r.hash!==row.hash&&r.storicoCartaceo?.tipo===FLAG)){status='conflict';conflicts.push(row)}
  else if(same.some(r=>r.hash===row.hash)){status='duplicate';duplicates.push(row)}
  else{status='new';added.push(row);seen.push(row)}
  out.push({row,status,linked:!!exact});
 }
 return {items:out,added,duplicates,conflicts};
}
const stamp=rows=>JSON.stringify(rows.map(r=>[r.id,r.workerKey,r.visit,r.hash,r.size,r.storicoCartaceo]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
async function commit(rows,before,{storage,readCharts,stage=async r=>r,now=new Date().toISOString()}){
 // All PDF validation is complete before any write; originals use one transaction.
 const charts=await readCharts();let pending=plan(rows,await storage.list(),charts);
 if(pending.conflicts.length)throw Error('Identità o documento in conflitto. Nessun PDF importato.');
 const staged=await stage(pending.added.map(r=>({...r,savedAt:now})));
 const stagedById=new Map(staged.map(r=>[r.id,r]));
 if(staged.length!==pending.added.length||pending.added.some(r=>!stagedById.has(r.id)))throw Error('Preparazione allegati incompleta.');
 const db=await storage.open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(storage.store,'readwrite'),store=tx.objectStore(storage.store),req=store.getAll();let result,reason;
  req.onsuccess=()=>{try{
   if(stamp(req.result)!==before)throw Error('Archivio allegati cambiato: riapri il pacchetto prima di importare.');
   result=plan(rows,req.result,charts);if(result.conflicts.length)throw Error('Documento in conflitto. Nessun PDF importato.');
   for(const row of result.added){const saved=stagedById.get(row.id);if(!saved)throw Error('Elenco importazione cambiato.');store.add(saved)}
  }catch(e){reason=e;tx.abort()}};
  tx.oncomplete=()=>resolve({added:result.added.length,duplicates:result.duplicates.length});
  tx.onabort=()=>reject(reason||tx.error||Error('Importazione annullata: nessun PDF salvato.'));tx.onerror=()=>{};
 })}finally{db.close()}
}
// Match only verified full identity; conflicting fiscal codes never cross-link.
function precedenti(rows,data){
 const surname=norm(data.cognome),name=norm(data.nome),birth=data.data_nascita,cf=norm(data.codice_fiscale);
 if(!surname||!name||!date(birth))return [];
 const candidates=rows.filter(r=>r.kind==='allegato_cartella_v1'&&r.storicoCartaceo?.tipo===FLAG&&r.storicoCartaceo.identitaVerificata===true&&norm(r.storicoCartaceo.cognome)===surname&&norm(r.storicoCartaceo.nome)===name&&r.workerBirth===birth);
 const codes=new Set(candidates.map(r=>norm(r.workerCf)).filter(Boolean));
 if(!cf&&codes.size>1)return [];
 const visit=data.data_giudizio||data.data_cartella;
 return candidates.filter(r=>(!cf||!r.workerCf||norm(r.workerCf)===cf)&&date(r.visit)&&(!date(visit)||r.visit<visit)).sort((a,b)=>b.visit.localeCompare(a.visit));
}

async function replaceOriginal(row,file,{storage,stage=async r=>r,pdfLib=root.PDFLib,now=new Date().toISOString()}){
 if(row?.storicoCartaceo?.tipo!==FLAG)throw Error('Seleziona una cartella storica.');
 if(!file||! /\.pdf$/i.test(file.name)||!file.size||file.size>MAX_PDF)throw Error('Scegli un PDF non vuoto fino a 25 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('Il file non è un PDF.');
 if(!pdfLib?.PDFDocument)throw Error('Verifica PDF non disponibile. Riapri LUMEN.');
 const pdf=await pdfLib.PDFDocument.load(bytes);
 const pages=pdf.getPageCount();
 if(pages!==row.storicoCartaceo.pagine)throw Error('Numero pagine diverso: attese '+row.storicoCartaceo.pagine+', trovate '+pages+'. Nessuna sostituzione.');
 const sha=await hash(bytes);if(sha===row.hash)throw Error('Questo PDF è già quello presente.');
 const changed={...row,name:file.name,hash:sha,size:bytes.length,blob:new Blob([bytes],{type:'application/pdf'}),external:undefined,savedAt:now,
  note:'CARTELLA STORICA - PDF SOSTITUITO: '+row.storicoCartaceo.azienda,
  storicoCartaceo:{...row.storicoCartaceo,note:'PDF sostituito dopo verifica manuale; versione precedente conservata negli allegati.',sostituitoIl:now}};
 const staged=await stage([changed]);if(staged.length!==1||staged[0].id!==row.id||staged[0].hash!==sha)throw Error('Preparazione PDF incompleta.');
 const db=await storage.open();
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction(storage.store,'readwrite'),st=tx.objectStore(storage.store);let reason;
  const req=st.get(row.id);req.onsuccess=()=>{try{
   const current=req.result;
   if(!current||stamp([current])!==stamp([row]))throw Error('Documento cambiato. Chiudi e riapri lo storico.');
   const previous={...current,id:'STORICO_PRECEDENTE_'+root.crypto.randomUUID(),note:'VERSIONE PRECEDENTE CONSERVATA - '+current.workerLabel+' - '+current.visit,storicoCartaceo:undefined,storicoVersionePrecedente:{originalId:row.id,conservataIl:now,metadati:current.storicoCartaceo}};
   st.add(previous);st.put(staged[0]);
  }catch(e){reason=e;tx.abort()}};
  tx.oncomplete=resolve;tx.onabort=()=>reject(reason||tx.error||Error('Sostituzione non eseguita.'));tx.onerror=()=>{};
 })}finally{db.close()}
 return changed;
}

const core={replaceOriginal,FORMAT,FLAG,parse,plan,stamp,commit,validCF,hash,precedenti};
if(typeof module==='object'&&module.exports){module.exports=core;return}
root.lumenStoricoCartaceo=core;
if(!root.document||!root.lumenAllegatiStorage||!root.lumenImportCartelle)return;
const doc=root.document,storage=root.lumenAllegatiStorage,readCharts=()=>root.lumenImportCartelle.readRecords();
const trigger=doc.createElement('button');trigger.type='button';trigger.id='btnStoricoCartaceo';trigger.className='secondary';trigger.textContent='CARTELLE STORICHE ORIGINALI';
doc.getElementById('btnArchivioCartelle').insertAdjacentElement('afterend',trigger);
const dialog=doc.createElement('dialog');dialog.id='storicoCartaceoDialog';dialog.setAttribute('aria-labelledby','storicoCartaceoTitle');dialog.style.cssText='width:min(900px,calc(100vw - 24px));max-height:90vh;padding:20px;box-sizing:border-box;color:#172b3a';
dialog.innerHTML='<h2 id="storicoCartaceoTitle">CARTELLE STORICHE ORIGINALI</h2><p>Originali cartacei consultabili per lavoratore e data. I dati clinici e le firme restano nel PDF: questa importazione non trascrive né modifica le visite attuali e non aggiorna i conteggi.</p><label>IMPORTA PACCHETTO STORICO (JSON)<input id="storicoCartaceoFile" type="file" accept=".json,application/json"></label><p>Prima dell’importazione conserva un backup aggiornato di LUMEN e dei PDF sul Mac.</p><label>Cerca lavoratore, anno o azienda<input id="storicoCartaceoQuery" type="search" style="width:100%;box-sizing:border-box"></label><p id="storicoCartaceoMessage" role="status" aria-live="polite" style="white-space:pre-line"></p><div id="storicoCartaceoList"></div><button id="storicoCartaceoConfirm" type="button" class="success" hidden>IMPORTA</button> <button id="storicoCartaceoClose" type="button" class="secondary">CHIUDI</button>';
const css=doc.createElement('style');css.textContent='#storicoCartaceoDialog{overflow:auto}#storicoCartaceoDialog [hidden]{display:none!important}#storicoCartaceoDialog label{display:block;margin:14px 0}#storicoCartaceoDialog input{font:inherit;min-height:44px;max-width:100%}#storicoCartaceoDialog button{min-height:44px}@media print{#storicoCartaceoDialog{display:none!important}}';doc.head.appendChild(css);
doc.body.appendChild(dialog);
const $=id=>doc.getElementById(id);let pending=null,busy=false;
function message(t){$('storicoCartaceoMessage').textContent=t}
function locked(v){busy=v;dialog.querySelectorAll('#storicoCartaceoList button,input').forEach(e=>e.disabled=v);for(const id of ['storicoCartaceoFile','storicoCartaceoQuery','storicoCartaceoConfirm','storicoCartaceoClose'])$(id).disabled=v}
function line(row,status){
 const e=doc.createElement('article');e.style.cssText='border:1px solid #ccc;padding:12px;margin:10px 0;overflow-wrap:anywhere';
 const title=doc.createElement('strong');title.textContent=row.workerLabel+' · '+row.visit.split('-').reverse().join('/');e.appendChild(title);
 const p=doc.createElement('p');p.textContent=(row.storicoCartaceo?.azienda||'')+' · '+(row.storicoCartaceo?.pagine||'?')+' pagine'+(row.storicoCartaceo?.note?' · '+row.storicoCartaceo.note:'')+(status?' · '+status:'');e.appendChild(p);return e;
}
async function openOriginal(row,report){let opened=null;try{if(!(row.blob instanceof Blob)){opened=root.open('','_blank');if(!opened)throw Error('Consenti l’apertura del PDF nel browser.');opened.opener=null}const blob=await root.lumenExternalAttachments.getBlob(row);if(await hash(await blob.arrayBuffer())!==row.hash)throw Error('Il PDF non coincide con l’originale.');const url=URL.createObjectURL(blob);if(opened)opened.location.replace(url);else{const a=doc.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click()}setTimeout(()=>URL.revokeObjectURL(url),300000)}catch(e){if(opened)opened.close();report(e.message)}}
async function render(){
 const q=$('storicoCartaceoQuery').value.trim().toUpperCase(),list=$('storicoCartaceoList');list.replaceChildren();
 const rows=(await storage.list()).filter(r=>r.storicoCartaceo?.tipo===FLAG).filter(r=>[r.workerLabel,r.workerCf,r.visit,r.storicoCartaceo.azienda].join(' ').toUpperCase().includes(q)).sort((a,b)=>b.visit.localeCompare(a.visit)||a.workerLabel.localeCompare(b.workerLabel));
 for(const row of rows){const e=line(row),b=doc.createElement('button');b.type='button';b.textContent='APRI PDF';b.onclick=()=>openOriginal(row,message);e.appendChild(b);
 const label=doc.createElement('label'),input=doc.createElement('input');
 label.textContent='SOSTITUISCI PDF';input.type='file';input.accept='.pdf,application/pdf';label.appendChild(input);
 input.onchange=async()=>{
  const file=input.files[0];input.value='';if(!file||busy)return;
  if(!root.confirm('Sostituire il PDF di '+row.workerLabel+' · '+row.visit+' con '+file.name+'? Controlla che appartenga allo stesso lavoratore e alla stessa visita. La versione precedente sarà conservata negli allegati.'))return;
  locked(true);pending=null;$('storicoCartaceoConfirm').hidden=true;message('Verifica e sostituzione PDF…');
  try{await replaceOriginal(row,file,{storage,stage:r=>root.lumenExternalAttachments.stageNew(r)});await render();message('PDF SOSTITUITO per '+row.workerLabel+'. Versione precedente conservata in ALLEGATI CARTELLA. Crea un backup aggiornato con i PDF.')}
  catch(err){message('SOSTITUZIONE NON ESEGUITA: '+err.message)}finally{locked(false)}
 };
 e.appendChild(label);list.appendChild(e)}
 message(rows.length+' cartelle storiche originali trovate.');
}
const api=root.lumenBatchCertApi,form=doc.getElementById('cartellaForm');
if(api&&form){
 const panel=doc.createElement('aside');panel.id='lumenPrecedenti';panel.hidden=true;panel.setAttribute('aria-live','polite');panel.style.cssText='border:2px solid #287a46;background:#edf7ee;padding:12px;margin:12px 0';
 form.querySelector('h2').insertAdjacentElement('afterend',panel);
 css.textContent+=' #lumenPrecedenti[hidden]{display:none!important} #lumenPrecedenti button{min-height:44px;margin:6px} @media print{#lumenPrecedenti{display:none!important}}';
 let generation=0;
 const identity=()=>JSON.stringify([api.collect().cognome,api.collect().nome,api.collect().data_nascita,api.collect().codice_fiscale,api.collect().data_giudizio,api.collect().data_cartella,api.selectionVersion()]);
 async function refresh(){
  const current=++generation,key=identity();panel.hidden=true;panel.replaceChildren();
  try{
   const rows=precedenti(await storage.list(),api.collect());
   if(current!==generation||key!==identity())return;
   for(const row of rows){
    const entry=doc.createElement('div'),label=doc.createElement('strong'),button=doc.createElement('button');
    label.textContent='Precedente '+row.visit.slice(0,4)+' disponibile · '+row.visit.split('-').reverse().join('/');
    button.type='button';button.textContent='APRI ORIGINALE PDF';
    button.onclick=()=>{if(key!==identity()){refresh();return}openOriginal(row,t=>{if(key===identity()){const error=doc.createElement('p');error.setAttribute('role','alert');error.textContent=t;entry.appendChild(error)}})};
    entry.append(label,button);panel.appendChild(entry);
   }
   panel.hidden=!rows.length;
  }catch(e){if(current===generation&&key===identity()){panel.textContent='Verifica precedenti non disponibile. Riapri la cartella per riprovare.';panel.hidden=false}}
 }
 doc.addEventListener('lumen:cartella-applied',refresh);
 const edited=e=>{if(['cognome','nome','data_nascita','codice_fiscale','data_giudizio','data_cartella'].includes(e.target.id))refresh()};
 form.addEventListener('input',edited);form.addEventListener('change',edited);form.addEventListener('reset',()=>{panel.hidden=true;setTimeout(refresh,0)});
 root.addEventListener('focus',refresh);dialog.addEventListener('close',refresh);
 refresh();
}
trigger.onclick=async()=>{if(busy)return;pending=null;$('storicoCartaceoConfirm').hidden=true;$('storicoCartaceoFile').value='';dialog.showModal();try{await render()}catch(e){message(e.message)}};
$('storicoCartaceoClose').onclick=()=>{if(!busy){pending=null;dialog.close()}};
dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
$('storicoCartaceoQuery').oninput=async()=>{if(busy)return;pending=null;$('storicoCartaceoConfirm').hidden=true;try{await render()}catch(e){message(e.message)}};
$('storicoCartaceoFile').onchange=async()=>{
 const f=$('storicoCartaceoFile').files[0];$('storicoCartaceoFile').value='';if(!f||busy)return;
 locked(true);pending=null;$('storicoCartaceoConfirm').hidden=true;message('Controllo PDF, identità e duplicati…');
 try{const rows=await parse(f),existing=await storage.list(),charts=await readCharts(),result=plan(rows,existing,charts);pending={rows,before:stamp(existing)};
  const list=$('storicoCartaceoList');list.replaceChildren();for(const item of result.items)list.appendChild(line(item.row,item.status==='conflict'?'DA VERIFICARE':item.status==='duplicate'?'GIÀ PRESENTE':item.linked?'DA IMPORTARE · LAVORATORE GIÀ IN ARCHIVIO':'DA IMPORTARE · SOLO ORIGINALE STORICO'));
  message(result.added.length+' da importare · '+result.duplicates.length+' già presenti · '+result.conflicts.length+' in conflitto.\nNessuna visita attuale sarà modificata.');
  $('storicoCartaceoConfirm').textContent='IMPORTA '+result.added.length+' ORIGINALI';$('storicoCartaceoConfirm').hidden=!result.added.length||!!result.conflicts.length;
 }catch(e){message('IMPORTAZIONE NON AVVIATA\n'+e.message+'\nNessun dato modificato.')}finally{locked(false)}
};
$('storicoCartaceoConfirm').onclick=async()=>{
 if(!pending||busy)return;locked(true);message('Salvataggio degli originali sul dispositivo…');
 try{const result=await commit(pending.rows,pending.before,{storage,readCharts,stage:r=>root.lumenExternalAttachments.stageNew(r)});pending=null;$('storicoCartaceoConfirm').hidden=true;await render();message('IMPORTAZIONE COMPLETATA: '+result.added+' originali salvati; '+result.duplicates+' già presenti.\nCartelle cliniche, firme e conteggi attuali conservati.')}catch(e){pending=null;$('storicoCartaceoConfirm').hidden=true;message('IMPORTAZIONE NON ESEGUITA\n'+e.message)}finally{locked(false)}
};
})(typeof window==='object'?window:globalThis);
