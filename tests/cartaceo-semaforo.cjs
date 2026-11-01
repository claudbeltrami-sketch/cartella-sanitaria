const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
(async()=>{
 const p=await app();
 try{
  const person={cognome:'SINTETICO',nome:'CARTACEO',codice_fiscale:'TESTCARTACEO',data_nascita:'1990-03-04',data_giudizio:'2026-09-30',protocollo:[]};
  await p.api.saveToLocalArchive(person);
  const rec=(await p.t.cartelle())[0],before=JSON.stringify(await p.t.cartelle());
  const storage=p.w.lumenAllegatiStorage;
  async function put(row){const db=await storage.open();try{await new Promise((resolve,reject)=>{const tx=db.transaction(storage.store,'readwrite');tx.objectStore(storage.store).put(row);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
  async function render(){await p.t.renderArchive(person.codice_fiscale);await new Promise(r=>setTimeout(r,20))}
  const original={id:'ORIGINAL',kind:'allegato_cartella_v1',workerKey:rec.id,workerCf:person.codice_fiscale,workerBirth:person.data_nascita,visit:person.data_giudizio,name:'CARTELLA_CARTACEA_ORIGINALE_FIRMATA.pdf',blob:new Blob(['%PDF synthetic'],{type:'application/pdf'})};
  await put({...original,id:'HISTORY',visit:'2025-09-30'});
  await put({...original,id:'HOMONYM',workerKey:'CF_OTHER',workerCf:'OTHER',workerBirth:'1978-09-12'});
  await put({...original,id:'CONFLICT',workerCf:'OTHER'});
  await put({...original,id:'WRONG_BIRTH',workerBirth:'1978-09-12'});
  await put({...original,id:'REPORT',name:'analisi.pdf'});
  await render();assert.equal(p.$('archiveResults').querySelector('.archive-cartaceo'),null,'no fallback to historical chart, namesake or laboratory report');
  await put(original);await render();
  const button=p.$('archiveResults').querySelector('.archive-cartaceo');
  assert.ok(button);assert.ok(button.previousElementSibling.classList.contains('archive-semaforo'));
  button.click();await new Promise(r=>setTimeout(r,10));
  let dialog=[...p.w.document.querySelectorAll('dialog[open]')].find(d=>d.textContent.includes('CARTACEO ORIGINALE'));
  assert.ok(dialog);assert.match(dialog.textContent,/30\/09\/2026/);assert.match(dialog.querySelector('iframe').src,/^blob:test/);
  dialog.querySelector('button').click();assert.equal(dialog.isConnected,false);
  p.w.lumenArchiveReferti.decorate();p.w.lumenArchiveReferti.decorate();await new Promise(r=>setTimeout(r,20));
  assert.equal(p.$('archiveResults').querySelectorAll('.archive-cartaceo').length,1,'idempotent decoration');
  await put({...original,blob:null,external:{version:1,file:'unavailable.pdf'}});await render();
  p.w.lumenExternalAttachments.getBlob=async()=>{throw Error('PDF conservato sul Mac. Collega la cartella LUMEN_ALLEGATI.')};
  p.$('archiveResults').querySelector('.archive-cartaceo').click();await new Promise(r=>setTimeout(r,10));
  dialog=[...p.w.document.querySelectorAll('dialog[open]')].find(d=>d.textContent.includes('CARTACEO ORIGINALE'));
  assert.match(dialog.querySelector('[role=status]').textContent,/LUMEN_ALLEGATI/);
  assert.equal(dialog.querySelector('iframe').hidden,true);
  dialog.querySelector('button').click();
  assert.equal(JSON.stringify(await p.t.cartelle()),before,'read-only view preserves clinical records');
  assert.deepEqual(p.errors,[]);
  console.log('PASS: exact original/visit/identity, no historical fallback, preview, close, no duplicates/loop, external-file error, records preserved.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
