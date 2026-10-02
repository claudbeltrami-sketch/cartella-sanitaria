(()=>{
'use strict';
const input=document.getElementById('fileImportaRefertiZip');
if(!input)return;
const api=window.lumenBatchCertApi, storage=window.lumenAllegatiStorage, archiveApi=window.lumenArchiveVisitsApi;
const KIND='allegato_cartella_v1';
const norm=v=>String(v||'').trim().toLocaleUpperCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const setStatus=t=>{try{api?.setStatus(t)}catch(_){const s=document.getElementById('status');if(s)s.textContent=t}};
function combinedName(x){return norm((x.cognome||'')+(x.nome||''))}
function displayName(x){return [x.cognome,x.nome].filter(Boolean).join(' ').trim()||'LAVORATORE'}
function visitOf(rec){const d=rec.data||{};return d.data_giudizio||d.data_cartella||''}
function clone(v){return JSON.parse(JSON.stringify(v))}
function addProtocol(data,value){const a=Array.isArray(data.protocollo)?data.protocollo.slice():[];if(!a.includes(value))a.push(value);data.protocollo=a}
function appendAccertamento(data,text){const old=String(data.altri_accertamenti||'').trim();if(norm(old).includes(norm(text)))return;data.altri_accertamenti=old?old+'; '+text:text}
function matchCandidates(worker,records){
 const cf=norm(worker.codice_fiscale), full=combinedName(worker);
 return records.filter(r=>{
  const d=r.data||{};
  if(cf&&norm(r.cf||d.codice_fiscale)===cf)return true;
  return full&&combinedName({cognome:r.cognome||d.cognome,nome:r.nome||d.nome})===full;
 });
}
function findZipEntry(zip,name){
 const wanted=norm(String(name||'').replace(/\.pdf$/i,''));
 let candidates=[];
 zip.forEach((path,entry)=>{if(!entry.dir&&/\.pdf$/i.test(path)){const base=path.split('/').pop().replace(/\.pdf$/i,'');if(norm(base)===wanted)candidates.push(entry)}});
 return candidates[0]||null;
}
async function sha256(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')}
async function attachmentExists(workerKey,visit,hash){
 const rows=await storage.list();return rows.some(r=>r.kind===KIND&&r.workerKey===workerKey&&r.visit===visit&&r.hash===hash);
}
async function saveAttachment(rec,entry,worker){
 const bytes=await entry.async('arraybuffer');
 const hash=await sha256(bytes), workerKey=rec.id, visit=visitOf(rec);
 if(await attachmentExists(workerKey,visit,hash))return 'duplicate';
 const blob=new Blob([bytes],{type:'application/pdf'}), now=new Date().toISOString();
 const row={id:'ATT_'+crypto.randomUUID(),kind:KIND,workerKey,workerCf:rec.cf||rec.data?.codice_fiscale||'',workerLabel:displayName(rec),workerBirth:rec.dataNascita||rec.data?.data_nascita||'',visit,documentDate:'',note:'ANALISI SERMOLAB'+(worker.drug_test_presente?' — DRUG TEST PRESENTE':''),name:entry.name.split('/').pop(),type:'application/pdf',size:blob.size,savedAt:now,hash,blob};
 const db=await storage.open();
 try{await new Promise((resolve,reject)=>{const tx=db.transaction(storage.store,'readwrite');tx.objectStore(storage.store).put(row);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Allegato non salvato'));tx.onerror=()=>{}})}finally{db.close()}
 return 'added';
}
async function updateCartella(rec,worker){
 const now=new Date().toISOString();
 await window.lumenConteggioStorage.change(rec.id,current=>{
  const before=clone(current.data||{}), data=current.data||(current.data={});
  addProtocol(data,'ANALISI EMATOCHIMICHE');
  if(worker.drug_test_presente){addProtocol(data,'ESAMI TOSSICOLOGICI');appendAccertamento(data,'DRUG TEST: REFERTO ALLEGATO')}
  const changed=JSON.stringify(before)!==JSON.stringify(data);
  if(changed){
   const history=Array.isArray(current.history)?current.history.slice():[];
   history.push({savedAt:current.updatedAt||current.createdAt||now,data:before});
   current.history=history.slice(-25);current.updatedAt=now;
  }
 });
}
async function loadJsZip(){
 if(window.JSZip)return window.JSZip;
 throw Error('MODULO ZIP NON DISPONIBILE. RICARICARE LUMEN CON CONNESSIONE INTERNET E RIPROVARE.');
}
async function run(file){
 const JSZip=await loadJsZip();setStatus('IMPORTAZIONE REFERTI: LETTURA DEL PACCHETTO…');
 const zip=await JSZip.loadAsync(await file.arrayBuffer());
 const manifestEntry=zip.file('LUMEN_IMPORT_MANIFEST.json')||Object.values(zip.files).find(x=>/LUMEN_IMPORT_MANIFEST\.json$/i.test(x.name));
 if(!manifestEntry)throw Error('MANIFEST LUMEN NON TROVATO NEL PACCHETTO.');
 const manifest=JSON.parse(await manifestEntry.async('string'));
 if(manifest.formato!=='LUMEN_REFERTI_IMPORT_V1'||!Array.isArray(manifest.lavoratori))throw Error('PACCHETTO REFERTI NON RICONOSCIUTO.');
 const records=await archiveApi.list();
 const plan=[],ambiguous=[],missing=[];
 for(const worker of manifest.lavoratori){
  const matches=matchCandidates(worker,records);
  if(matches.length===1)plan.push({worker,rec:matches[0]});
  else if(matches.length>1)ambiguous.push({worker,matches});
  else missing.push(worker);
 }
 let msg='PACCHETTO: '+manifest.lavoratori.length+' REFERTI\nABBINATI CON CERTEZZA: '+plan.length;
 if(ambiguous.length)msg+='\nAMBIGUI (NON TOCCATI): '+ambiguous.length;
 if(missing.length)msg+='\nNON TROVATI IN ARCHIVIO (NON TOCCATI): '+missing.length;
 msg+='\n\nSaranno aggiornate SOLO le cartelle abbinate con certezza. Continuare?';
 if(!confirm(msg))return;
 let updated=0,attached=0,duplicates=0,errors=[];
 for(let i=0;i<plan.length;i++){
  const {worker,rec}=plan[i];setStatus('IMPORTAZIONE REFERTI '+(i+1)+'/'+plan.length+': '+displayName(rec)+'…');
  try{
   const entry=findZipEntry(zip,worker.referto_pdf);
   if(!entry)throw Error('PDF non trovato nel pacchetto: '+worker.referto_pdf);
   const result=await saveAttachment(rec,entry,worker);
   await updateCartella(rec,worker);updated++;
   if(result==='added')attached++;else duplicates++;
  }catch(e){errors.push(displayName(rec)+': '+(e.message||String(e)))}
 }
 const lines=['IMPORTAZIONE COMPLETATA','Cartelle aggiornate: '+updated,'PDF allegati: '+attached];
 if(duplicates)lines.push('PDF già presenti, non duplicati: '+duplicates);
 if(ambiguous.length){lines.push('Ambigui non modificati: '+ambiguous.length);for(const x of ambiguous)lines.push('• '+displayName(x.worker)+' → '+x.matches.map(displayName).join(' / '))}
 if(missing.length){lines.push('Non trovati: '+missing.length);for(const x of missing)lines.push('• '+displayName(x))}
 if(errors.length){lines.push('Errori: '+errors.length);errors.forEach(x=>lines.push('• '+x))}
 setStatus('REFERTI IMPORTATI: '+updated+' CARTELLE AGGIORNATE, '+attached+' PDF ALLEGATI.');
 alert(lines.join('\n'));
}
input.addEventListener('change',async e=>{
 const file=(e.target.files||[])[0];e.target.value='';if(!file)return;
 if(!/\.zip$/i.test(file.name)){alert('SELEZIONARE IL PACCHETTO ZIP PREPARATO PER LUMEN.');return}
 try{await run(file)}catch(err){setStatus('IMPORTAZIONE REFERTI NON RIUSCITA.');alert('IMPORTAZIONE REFERTI NON RIUSCITA.\n\n'+(err.message||String(err)))}
});
})();