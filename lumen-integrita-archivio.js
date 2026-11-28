/* Controllo di sola lettura: nessuna modifica a cartelle, PDF o giudizi.
 * Non confonde integrità tecnica e completezza rispetto alle fonti indipendenti. */
(function(root){
'use strict';
const day=v=>{const s=String(v||'').trim();const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);const d=m?m[3]+'-'+m[2]+'-'+m[1]:s;return /^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d?d:''};
const norm=v=>String(v||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
const key=(id,date)=>JSON.stringify([id,date]);
const identity=d=>norm(d.codice_fiscale)?'CF_'+norm(d.codice_fiscale):'ANAG_'+[norm(d.cognome),norm(d.nome),d.data_nascita||''].join('|');
const label=d=>[d.cognome,d.nome].filter(Boolean).join(' ');
function inspect(charts,rows){
 const issues=[],visits=new Map(),history=new Map(),hashes=new Map(),ids=new Set(),people=new Map(),attachments=[];
 const issue=(code,detail)=>issues.push({code,detail});
 for(const r of charts){
  if(!r||!r.id||!r.data){issue('CARTELLA_NON_VALIDA','Record senza identificativo o dati');continue}
  ids.add(r.id);
  if(!Array.isArray(r.history)&&r.history!=null)issue('STORICO_NON_VALIDO',r.id);
  const versions=[...(Array.isArray(r.history)?r.history:[]).map(h=>({data:h?.data,savedAt:h?.savedAt})),{data:r.data,savedAt:r.updatedAt}];
  for(const v of versions){
   const d=v.data;if(!d||typeof d!=='object'){issue('VERSIONE_NON_VALIDA',r.id);continue}
   const date=day(d.data_giudizio||d.data_cartella);
   if(!norm(d.cognome)||!norm(d.nome)||(!norm(d.codice_fiscale)&&!day(d.data_nascita)))issue('IDENTITA_INCOMPLETA',label(d)+' · '+r.id);
   if(!date){issue('DATA_VISITA_NON_VALIDA',label(d));continue}
   const id=identity(d);if(id!==r.id)issue('IDENTITA_DIVERGENTE',label(d)+' · '+date);
   const person=[norm(d.cognome),norm(d.nome),day(d.data_nascita)].join('|');
   if(day(d.data_nascita)){const prior=people.get(person);if(prior&&prior!==id)issue('POSSIBILE_DUPLICATO_ANAGRAFICO',label(d));else people.set(person,id)}
   const k=key(r.id,date),old=visits.get(k);
   if(!old||String(v.savedAt||'')>=String(old.savedAt||''))visits.set(k,{id:r.id,date,data:d,savedAt:v.savedAt});
  }
 }
 for(const v of visits.values()){
  if(!String(v.data.giudizio||'').trim())issue('GIUDIZIO_DA_VERIFICARE',label(v.data)+' · '+v.date);
  if(!String(v.data.datore_lavoro||v.data.azienda||'').trim())issue('AZIENDA_DA_VERIFICARE',label(v.data)+' · '+v.date);
 }
 for(const r of rows){
  if(!r||r.kind!=='allegato_cartella_v1')continue;
  attachments.push(r);const date=day(r.visit),k=key(r.workerKey,date),desc=(r.workerLabel||r.workerKey||'?')+' · '+(date||'?')+' · '+(r.name||'?');
  if(!r.workerKey||!date)issue('RIFERIMENTO_ALLEGATO_INCOMPLETO',desc);
  if(!r.blob&&!r.external)issue('ALLEGATO_SENZA_FILE',desc);
  if(r.hash){const prior=hashes.get(r.hash);if(prior&&prior!==k)issue('STESSO_PDF_SU_VISITE_DIVERSE',desc);else hashes.set(r.hash,k)}
  if(r.storicoCartaceo?.tipo==='cartella_storica_originale_v1'){
   if(!r.storicoCartaceo.identitaVerificata)issue('IDENTITA_STORICA_NON_VERIFICATA',desc);
   if(history.has(k)&&history.get(k).hash!==r.hash)issue('PIU_ORIGINALI_STESSA_VISITA',desc);
   history.set(k,r);
   // Originali storici possono esistere senza una cartella digitale: non sono
   // necessariamente orfani, ma non vanno conteggiati automaticamente come visite.
   if(!visits.has(k))issue('STORICO_SENZA_VISITA_DIGITALE',desc);
  }else if(!visits.has(k))issue(ids.has(r.workerKey)?'ALLEGATO_DATA_NON_RICONCILIATA':'ALLEGATO_SENZA_CARTELLA',desc);
 }
 return {issues,visits,history,attachments,charts:charts.length};
}
function reconcile(report,expected){
 if(!Array.isArray(expected)||!expected.length)throw Error('Serve un elenco indipendente non vuoto di visite effettivamente eseguite.');
 const seen=new Set(),missing=[],duplicate=[],ambiguous=[];
 for(const r of expected){
  if(!r||typeof r.id!=='string'||!r.id.trim()||!day(r.date)||typeof r.azienda!=='string'||!r.azienda.trim())throw Error('Riga fonte non valida: servono id LUMEN, date e azienda.');
  const k=key(r.id,day(r.date)),k2=JSON.stringify([k,norm(r.azienda)]);
  if(seen.has(k2)){duplicate.push(r);continue}seen.add(k2);
  const v=report.visits.get(k),h=report.history.get(k);
  const company=v?.data?.datore_lavoro||v?.data?.azienda||h?.storicoCartaceo?.azienda;
  if(!v&&!h)missing.push(r);else if(norm(company)!==norm(r.azienda))ambiguous.push(r);
 }
 return {expected:seen.size,missing,duplicate,ambiguous};
}
const timeout=(p,ms)=>{let t;return Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Tempo di lettura superato')),ms)})]).finally(()=>clearTimeout(t))};
async function checkPdf(row,getBlob){
 const blob=await timeout(Promise.resolve().then(()=>getBlob(row)),15000);
 if(!(blob instanceof Blob)||blob.size<5)throw Error('File assente o vuoto');
 if(Number.isFinite(row.size)&&row.size!==blob.size)throw Error('Dimensione diversa dall’originale');
 const bytes=await timeout(blob.arrayBuffer(),15000);
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Intestazione PDF non valida');
 if(row.hash){
  const hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==row.hash)throw Error('Impronta SHA-256 non corrispondente');
 }
 if(!root.PDFLib?.PDFDocument)throw Error('Libreria di lettura PDF non disponibile');
 const doc=await timeout(root.PDFLib.PDFDocument.load(bytes),15000);
 if(doc.getPageCount()<1)throw Error('PDF senza pagine');
 return {pages:doc.getPageCount(),hashVerified:!!row.hash||!!row.external?.sha256};
}
if(typeof module!=='undefined'&&module.exports){module.exports={inspect,reconcile,day,checkPdf};return}
if(!root.document)return;
const d=root.document,anchor=d.getElementById('btnElencoVisiteArchivio');
if(!anchor)return;
const panel=d.createElement('section');panel.style.cssText='padding:10px;margin:0 0 12px;border:1px solid #8795a1;border-radius:8px';
const title=d.createElement('strong');title.textContent='INTEGRITÀ ARCHIVIO';
const status=d.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Controllo non ancora eseguito.';
const button=d.createElement('button');button.type='button';button.textContent='CONTROLLA INTEGRITÀ ARCHIVIO';
const stop=d.createElement('button');stop.type='button';stop.textContent='INTERROMPI';stop.hidden=true;
const details=d.createElement('details'),summary=d.createElement('summary'),out=d.createElement('pre');summary.textContent='Dettaglio anomalie';out.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto';details.append(summary,out);
const note=d.createElement('p');note.textContent='La completezza per Allegato 3B richiede il confronto con registri di seduta e fonti indipendenti. Questo controllo non la certifica.';
panel.append(title,status,button,stop,details,note);anchor.before(panel);
let running=false,cancel=false,revision=0;
async function run(){
 if(running)return;running=true;cancel=false;const start=revision;button.disabled=true;stop.hidden=false;out.textContent='';
 try{
  status.textContent='Lettura archivio locale…';
  const charts=await timeout(root.lumenArchiveVisitsApi.list(''),30000),rows=await timeout(root.lumenAllegatiStorage.list(),30000);
  const report=inspect(charts,rows);let checked=0,failed=0,unverified=0;
  for(const row of report.attachments){
   if(cancel)break;
   status.textContent='Controllo PDF '+(checked+1)+' di '+report.attachments.length+'…';
   try{const r=await checkPdf(row,r=>r.blob instanceof Blob?r.blob:root.lumenExternalAttachments.getBlob(r));if(!r.hashVerified)unverified++}
   catch(e){failed++;report.issues.push({code:'PDF_NON_VERIFICATO',detail:(row.workerLabel||row.workerKey||'?')+' · '+(row.visit||'?')+' · '+(row.name||'?')+' — '+e.message})}
   checked++;await new Promise(r=>setTimeout(r,0));
  }
  out.textContent=report.issues.map(x=>x.code+' — '+x.detail).join('\n')||'Nessuna anomalia tecnica rilevata nei controlli eseguiti.';
  const incomplete=cancel||start!==revision||!charts.length;
  status.textContent=(incomplete?'CONTROLLO INCOMPLETO O DA RIPETERE':report.issues.length||unverified?'ANOMALIE / VERIFICHE NECESSARIE':'CONTROLLI TECNICI ESEGUITI')+' · '+charts.length+' cartelle · '+report.visits.size+' visite digitali · '+checked+'/'+report.attachments.length+' PDF controllati · '+failed+' PDF non verificati · '+unverified+' senza impronta verificata · '+report.issues.length+' segnalazioni. '+new Date().toLocaleString('it-IT');
 }catch(e){status.textContent='CONTROLLO NON COMPLETATO — '+e.message}
 finally{running=false;button.disabled=false;stop.hidden=true}
}
button.onclick=run;stop.onclick=()=>{cancel=true};
function stale(){revision++;if(!running)status.textContent='Archivio modificato: esito precedente da aggiornare.'}
d.addEventListener('lumen:attivita-salvata',stale);
d.addEventListener('lumen:precedenti-aggiornati',stale);
root.addEventListener('lumen-allegati-esterni-updated',stale);
// Avvio automatico dopo il caricamento; non modifica dati né richiede permessi.
if(!root.lumenStorage?.isTest)setTimeout(run,1500);
})(typeof window!=='undefined'?window:globalThis);
