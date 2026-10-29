'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {indexedDB}=require('fake-indexeddb'),core=require('../storico-cartaceo.js');
const row={id:'TEST',kind:'allegato_cartella_v1',workerKey:'ANAG_TEST',workerBirth:'1980-01-01',workerCf:'',visit:'2025-01-02',hash:'a'.repeat(64),blob:new Blob(['%PDF-synthetic']),storicoCartaceo:{tipo:core.FLAG,identitaVerificata:true,cognome:'PROVA',nome:'SINTETICA',azienda:'TEST',pagine:1}};
const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('portable-test',1);r.onupgradeneeded=()=>r.result.createObjectStore('rows',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
const storage={open,store:'rows'};
(async()=>{
 const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction('rows','readwrite');tx.objectStore('rows').add(row);tx.oncomplete=resolve;tx.onabort=reject});db.close();
 const result={ok:true,giudizio:'IDONEO CON LIMITAZIONI',prescrizioni:'NON SOLLEVARE OLTRE 5 KG',periodicita:'ANNUALE',periodicita_altro:'',evidence:[{page:1,text:'Test sintetico'}]};
 const saved=await core.saveExtraction(row,result,{storage});
 assert.equal(core.verifiedJudgment(saved),null,'Automatic extraction must never become a doctor confirmation');
 assert.equal(await saved.blob.text(),await row.blob.text(),'Original bytes remain intact');
 // Same JSON metadata round trip used by the light backup; no PDF/reader on phone.
 const {blob,...meta}=saved,phone=JSON.parse(JSON.stringify({...meta,blob:null}));
 const window={lumenStoricoCartaceo:core,lumenExternalAttachments:{getBlob(){throw Error('PDF unavailable on phone')}}};
 vm.runInNewContext(fs.readFileSync('giudizio-pdf-auto.js','utf8'),{window,setTimeout,clearTimeout});
 const recovered=await window.lumenGiudizioPdfAuto.extract(phone);
 assert.equal(recovered.prescrizioni,result.prescrizioni);assert.equal(recovered.periodicita,'ANNUALE');
 for(const change of [{hash:'b'.repeat(64)},{visit:'2025-02-02'},{workerBirth:'1981-01-01'},{workerKey:'OTHER'},{storicoCartaceo:{...phone.storicoCartaceo,nome:'ALTRA'}}])assert.equal(core.extractedJudgment({...phone,...change}),null);
 await assert.rejects(core.saveExtraction({...row,workerBirth:'1981-01-01'},result,{storage}),/identità/);
 await assert.rejects(core.saveExtraction(row,{ok:false},{storage}),/incompleta/);
 assert.equal(core.extractedJudgment({...phone,storicoCartaceo:{...phone.storicoCartaceo,giudizioEstratto:undefined}}),null);
 console.log('PASS portable extraction: metadata-only phone roundtrip without PDF, unchanged original, no false verification, hash/date/identity invalidation, stale save rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
