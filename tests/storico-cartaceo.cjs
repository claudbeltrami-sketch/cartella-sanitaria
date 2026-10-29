/* Local logic and IndexedDB tests. All committed fixtures are synthetic. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {indexedDB,IDBObjectStore}=require('fake-indexeddb');
const api=require('../storico-cartaceo.js');
const clone=v=>structuredClone(v),dbName='lumen-historical-test-'+Date.now();
function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore('originali',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function list(){const db=await open();try{return await new Promise((resolve,reject)=>{const t=db.transaction('originali'),r=t.objectStore('originali').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}finally{db.close()}}
async function put(rows){const db=await open();try{await new Promise((resolve,reject)=>{const t=db.transaction('originali','readwrite');for(const r of rows)t.objectStore('originali').put(r);t.oncomplete=resolve;t.onabort=()=>reject(t.error)})}finally{db.close()}}
const storage={open,list,store:'originali'},pdf=Buffer.from('%PDF-1.4\n% synthetic original\n%%EOF');
async function source(i=1){return {identitaVerificata:true,cognome:'COLLAUDO',nome:'SINTETICO '+i,dataNascita:'1980-01-01',codiceFiscale:'',dataVisita:'2025-06-06',azienda:'AZIENDA DI PROVA',file:'ORIGINALE_'+i+'.pdf',pagine:4,fonte:'Fonte sintetica di collaudo',note:'',sha256:await api.hash(pdf),base64:pdf.toString('base64')}}
const file=documents=>new File([JSON.stringify({tipo:api.FORMAT,documenti:documents})],'storico.json',{type:'application/json'});
async function run(){
 assert(api.validCF('RSSMRA80A01H501U'));assert(!api.validCF('RSSMRA80A01H501A'));
 const d=await source(),rows=await api.parse(file([d]));
 assert.equal(rows[0].workerKey,'ANAG_COLLAUDO|SINTETICO1|1980-01-01');assert.equal(rows[0].visit,'2025-06-06');
 assert.equal(await rows[0].blob.text(),pdf.toString());
 await assert.rejects(api.parse(file([{...d,sha256:'0'.repeat(64)}])),/Impronta/);
 await assert.rejects(api.parse(file([{...d,identitaVerificata:false}])),/Identità/);
 await assert.rejects(api.parse(file([{...d,dataVisita:'2025-02-30'}])),/data visita/);
 await assert.rejects(api.parse(file([{...d,codiceFiscale:'RSSMRA80A01H501A'}])),/fiscale/);
 await assert.rejects(api.parse(file([{...d,file:'../originale.pdf'}])),/Metadati/);
 await assert.rejects(api.parse(file([{...d,base64:'PGh0bWw+'}])),/Contenuto PDF/);
 await assert.rejects(api.parse(file([{...d,base64:'!!!!'}])),/PDF incorporato/);
 const sentinel={id:'KEEP',kind:'allegato_cartella_v1',workerKey:'CF_KEEP',visit:'2026-01-01',hash:'keep',blob:new Blob(['existing'])};await put([sentinel]);
 const charts=[{id:'ANAG_COLLAUDO|SINTETICO1|1980-01-01',cognome:'COLLAUDO',nome:'SINTETICO 1',dataNascita:'1980-01-01',data:{data_giudizio:'2026-06-08',farmaci:'PREESISTENTE'},history:[{data:{data_giudizio:'2024-01-01'}}],conteggioVisits:{keep:true}}],clinicalBefore=JSON.stringify(charts);
 const opts={storage,readCharts:async()=>clone(charts)};
 let before=api.stamp(await list()),p=api.plan(rows,await list(),charts);assert.equal(p.added.length,1);assert(p.items[0].linked);assert.equal((await list()).length,1);
 let r=await api.commit(rows,before,opts);assert.equal(r.added,1);assert.equal((await list()).length,2);assert.equal(JSON.stringify(charts),clinicalBefore);
 assert.deepEqual((await list()).find(x=>x.id==='KEEP'),sentinel);assert.equal(await (await list()).find(x=>x.id===rows[0].id).blob.text(),pdf.toString());
 // A PDF alone must never make its judgment eligible for copying.
 const original=(await list()).find(x=>x.id===rows[0].id);
 assert.equal(api.verifiedJudgment(original),null);
 // Match an already present PDF automatically to the visit of the same patient,
 // while refusing other names, birth dates or a non-previous date.
 const patient={cognome:'COLLAUDO',nome:'SINTETICO 1',data_nascita:'1980-01-01',codice_fiscale:'',data_giudizio:'2026-06-08'};
 assert.equal(api.precedenti([original],patient).length,1);
 assert.equal(api.precedenti([original],{...patient,nome:'ALTRA'}).length,0);
 assert.equal(api.precedenti([original],{...patient,data_nascita:'1981-01-01'}).length,0);
 assert.equal(api.precedenti([original],{...patient,data_giudizio:'2025-06-06'}).length,0);
 await assert.rejects(api.saveJudgment(original,{giudizio:'IDONEO CON LIMITAZIONI',periodicita:'ANNUALE'},{storage}),/prescrizioni o limitazioni/);
 await assert.rejects(api.saveJudgment(original,{giudizio:'IDONEO',periodicita:'ALTRO'},{storage}),/ALTRO/);
 const recorded=await api.saveJudgment(original,{
  giudizio:'IDONEO CON LIMITAZIONI',prescrizioni:'NON SOLLEVARE CARICHI OLTRE 5 KG',periodicita:'ANNUALE'
 },{storage,now:'2026-10-29T08:00:00.000Z'});
 assert.equal(api.verifiedJudgment(recorded).giudizio,'IDONEO CON LIMITAZIONI');
 assert.equal(recorded.hash,original.hash);
 assert.equal(await recorded.blob.text(),pdf.toString());
 assert.equal(api.verifiedJudgment({...recorded,hash:'f'.repeat(64)}),null);
 await assert.rejects(api.saveJudgment({...original,hash:'0'.repeat(64)},{giudizio:'IDONEO',periodicita:'ANNUALE'},{storage}),/PDF o l’identità sono cambiati/);
 assert.deepEqual((await list()).find(x=>x.id==='KEEP'),sentinel);

 r=await api.commit(rows,api.stamp(await list()),opts);assert.equal(r.added,0);assert.equal(r.duplicates,1);
 const bad={...rows[0],workerKey:'CF_OTHER'};assert.equal(api.plan([bad],await list(),charts).conflicts.length,1);
 const variant={...rows[0],id:'different',hash:'f'.repeat(64)};assert.equal(api.plan([variant],await list(),charts).conflicts.length,1);
 const ambiguous=[{...charts[0],id:'CF_DIFFERENT'}];assert.equal(api.plan(rows,[],ambiguous).conflicts.length,1);
 const newRows=await api.parse(file([{...await source(2),base64:Buffer.from('%PDF-1.4\nsecond\n%%EOF').toString('base64'),sha256:await api.hash(Buffer.from('%PDF-1.4\nsecond\n%%EOF'))}]));
 const stale=api.stamp(await list());await put([{id:'CHANGED',kind:'unrelated'}]);await assert.rejects(api.commit(newRows,stale,opts),/Archivio allegati cambiato/);assert(!(await list()).some(x=>x.id===newRows[0].id));
 const third={...newRows[0],id:'THIRD',workerKey:'CF_THIRD',hash:'c'.repeat(64)},originalAdd=IDBObjectStore.prototype.add;let calls=0;
 IDBObjectStore.prototype.add=function(...args){if(++calls===2)throw new DOMException('TEST QUOTA','QuotaExceededError');return originalAdd.apply(this,args)};
 const count=(await list()).length;
 try{await assert.rejects(api.commit([newRows[0],third],api.stamp(await list()),opts),/TEST QUOTA/)}finally{IDBObjectStore.prototype.add=originalAdd}
 assert.equal((await list()).length,count);assert(!(await list()).some(x=>x.id===newRows[0].id));
 // Backup encoding/reopening must preserve the complete source bytes and metadata.
 const saved=(await list()).find(x=>x.id===rows[0].id);const encoded={...saved,blob:Buffer.from(await saved.blob.arrayBuffer()).toString('base64')};const restored=JSON.parse(JSON.stringify(encoded));
 assert.equal(await api.hash(Buffer.from(restored.blob,'base64')),saved.hash);assert.deepEqual(restored.storicoCartaceo,saved.storicoCartaceo);
 console.log('PASS: automatic PDF precedent matching, strict patient identity, earlier-visit requirement, doctor-verified PDF judgment, source hash binding, stale document blocked, format/identity/date/CF/hash validation, read-only preview, duplicate/conflict protection, exact PDFs, existing clinical data/counts untouched, reopen, stale preview, atomic rollback, backup round trip.');
 if(process.env.LUMEN_HISTORICAL_PACKAGE){
  const privateFile=new File([fs.readFileSync(process.env.LUMEN_HISTORICAL_PACKAGE)],'private.json');const actual=await api.parse(privateFile);
  const backup=JSON.parse(fs.readFileSync(process.env.LUMEN_REFERENCE_BACKUP,'utf8')).contenuto;
  const plan=api.plan(actual,backup.originali,backup.cartelle);assert.equal(plan.conflicts.length,0);assert.equal(plan.added.length,8);
  const snapshot=JSON.stringify(backup.cartelle);const clinicalDigest=await api.hash(new TextEncoder().encode(snapshot));
  await put(backup.originali);const existing=await list();const result=await api.commit(actual,api.stamp(existing),{storage,readCharts:async()=>backup.cartelle});
  assert.equal(result.added,8);assert.equal(JSON.stringify(backup.cartelle),snapshot);
  const imported=await list();for(const original of backup.originali)assert.deepEqual(imported.find(x=>x.id===original.id),original);
  for(const row of actual){const saved=imported.find(x=>x.id===row.id);assert(saved);assert.equal(await api.hash(await saved.blob.arrayBuffer()),row.hash)}
  const repeat=await api.commit(actual,api.stamp(imported),{storage,readCharts:async()=>backup.cartelle});assert.equal(repeat.duplicates,8);assert.equal(repeat.added,0);
  console.log(JSON.stringify({privatePackage:true,originals:8,pages:actual.reduce((n,r)=>n+r.storicoCartaceo.pagine,0),linked:plan.items.filter(x=>x.linked).length,clinicalRecords:backup.cartelle.length,existingDocumentsPreserved:backup.originali.length,clinicalDigest,duplicateReimport:8,environment:'isolated fake-indexeddb; not user device'}));
 }
}
run().catch(e=>{console.error(e);process.exitCode=1});
