const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
const {IDBFactory}=require('fake-indexeddb');
const day='2026-10-31';
const worker={cognome:'COLLAUDO',nome:'AUTOMATICO',codice_fiscale:'CLLMTT80A01H501X',data_giudizio:day,protocollo:['ANALISI EMATOCHIMICHE']};
const lab='LABORATORIO REFERTO RISULTATI VALORI DI RIFERIMENTO Emoglobina 14.5 g/dl Glicemia 90 mg/dl Creatinina 1.0 mg/dl Colesterolo 180 mg/dl';
async function put(p,row){const s=p.w.lumenAllegatiStorage,db=await s.open();try{await new Promise((resolve,reject)=>{const tx=db.transaction(s.store,'readwrite');tx.objectStore(s.store).put(row);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
async function idle(p){for(let n=0;n<100;n++){if(!p.$('refertiScanAll').disabled)return;await new Promise(r=>setTimeout(r,10))}throw Error('Automatic scan did not finish')}
(async()=>{
const factory=new IDBFactory(),p=await app(factory);
try{
 await p.api.saveToLocalArchive(worker);
 const rec=(await p.t.cartelle())[0],original=JSON.stringify(await p.t.cartelle());
 const row={id:'AUTO_LAB',kind:'allegato_cartella_v1',workerKey:rec.id,workerCf:worker.codice_fiscale,workerLabel:'COLLAUDO AUTOMATICO',visit:day,name:'analisi.pdf',size:7,hash:'a'.repeat(64),savedAt:day,blob:new Blob(['fixture'],{type:'application/pdf'})};
 await put(p,row);
 let flags=(await p.w.lumenArchiveReferti.statuses([rec])).get(rec.id);
 assert.equal(flags.analisi,'DA VERIFICARE','filename alone is not clinical evidence');
 await put(p,{...row,id:'OTHER_VISIT',visit:'2025-10-31'});
 await put(p,{...row,id:'WRONG_CF',workerCf:'OTHER'});
 await put(p,{...row,id:'SIGNED_CHART',name:'ORIGINALE CARTELLA FIRMATA.pdf'});
 let reads=0;
 p.w.pdfjsLib={GlobalWorkerOptions:{},getDocument(){reads++;return {promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:lab}]}),cleanup(){}})}),destroy:async()=>{}}}};
 await p.t.renderArchive(worker.codice_fiscale);await idle(p);
 assert.equal(reads,1,'only matching visit and worker reports are read');
 assert.equal(p.$('archiveResults').querySelector('.archive-semaforo').dataset.light,'green');
 const stored=(await p.t.rows()).find(r=>r.kind==='referti_scan_v1');assert.equal(stored.analisi,'SÌ');
 await p.t.renderArchive(worker.codice_fiscale);await idle(p);assert.equal(reads,1,'unchanged evidence is reused');
 const review=p.$('archiveResults').querySelector('[data-verifica-referti]');await review.onclick();
 const dialog=[...p.w.document.querySelectorAll('dialog')].find(d=>d.textContent.includes('VERIFICA REFERTI —'));
 const buttons=dialog.querySelectorAll('[data-open-referto]');assert.equal(buttons.length,1);
 await buttons[0].onclick();assert.equal(dialog.querySelector('iframe').hidden,false);assert.match(dialog.querySelector('iframe').src,/^blob:/);
 [...dialog.querySelectorAll('button')].find(b=>b.textContent==='ANNULLA').onclick();
 // Mimic separating the PDF on the Mac: saved scan fingerprint must remain stable.
 const external={version:1,sha256:row.hash,size:row.size,file:row.hash+'_analisi.pdf'};
 for(const r of (await p.t.rows()).filter(r=>r.kind==='allegato_cartella_v1'))await put(p,{...r,blob:null,external});
 await p.t.backup('light');p.$('lumenBackupDownload').click();const backup=p.downloads.at(-1).blob;
 const q=await app();try{
  await q.t.restore(new File([backup],'backup.json'));
  Object.defineProperty(q.w.navigator,'userAgent',{configurable:true,value:'iPhone'});
  await q.t.renderArchive(worker.codice_fiscale);
  assert.equal(q.$('archiveResults').querySelector('.archive-semaforo').dataset.light,'green','saved Mac scan survives light backup on iPhone without local PDF');
  assert.deepEqual(q.errors,[]);
 }finally{q.dom.window.close()}
 assert.equal(JSON.stringify(await p.t.cartelle()),original,'clinical chart and history unchanged');
 assert.deepEqual(p.errors,[]);
 console.log('PASS automatic content reading, exact worker/visit, signed chart exclusion, scan reuse, inline report preview, light backup/restore on iPhone without PDF, charts preserved.');
}finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
