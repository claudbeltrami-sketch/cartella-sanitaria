// Synthetic data only. Full application + IndexedDB; simulated PDF/OCR for failure paths.
const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
const day='2026-10-14';
const lab='LABORATORIO REFERTO RISULTATI VALORI DI RIFERIMENTO Emoglobina 14.5 g/dl Glicemia 90 mg/dl Creatinina 1.0 mg/dl Colesterolo 180 mg/dl';
const drug='LABORATORIO REFERTO RISULTATI MULTIDRUG TEST URINARIO COCAINA NEGATIVO CANNABINOIDI THC NEGATIVO OPPIACEI NEGATIVO METADONE NEGATIVO';
const order='PROTOCOLLO SANITARIO RICHIESTA ESAMI DA ESEGUIRE GLICEMIA CREATININA COCAINA CANNABINOIDI METADONE 2026';
const worker={cognome:'COLLAUDO',nome:'ALFA',codice_fiscale:'SNTLFA80A01H501X',data_giudizio:day};
async function put(p,row){const s=p.w.lumenAllegatiStorage,db=await s.open();try{await new Promise((resolve,reject)=>{const t=db.transaction(s.store,'readwrite');t.objectStore(s.store).put(row);t.oncomplete=resolve;t.onabort=()=>reject(t.error)})}finally{db.close()}}
const row=(id,extra={})=>({id,kind:'allegato_cartella_v1',workerKey:'CF_'+worker.codice_fiscale,workerCf:worker.codice_fiscale,visit:day,name:'scansione.pdf',blob:new Blob(['fixture'],{type:'application/pdf'}),...extra});
const pair=result=>[result.analisi,result.drug];
async function run(){
 const p=await app();
 try{
  const api=p.w.lumenArchiveReferti;
  assert.deepEqual(pair(api.inspectText([lab])),['SÌ','NO']);
  assert.deepEqual(pair(api.inspectText([drug])),['NO','SÌ'],'negative outcome is still an existing drug report');
  assert.deepEqual(pair(api.inspectText([lab,drug])),['SÌ','SÌ']);
  assert.deepEqual(pair(api.inspectText([order])),['DA VERIFICARE','DA VERIFICARE']);
  assert.deepEqual(pair(api.inspectText([lab,order])),['SÌ','DA VERIFICARE'],'a report header cannot leak across pages into a prescription');
  assert.deepEqual(pair(api.inspectText([lab,''])),['SÌ','DA VERIFICARE'],'keep positive evidence when another page is unreadable');
  await p.api.saveToLocalArchive(worker);
  const record=(await p.t.cartelle())[0];
  const before=JSON.stringify(await p.t.cartelle());
  const confirmation={id:'REFERTI_VERIFICA_'+JSON.stringify([record.id,worker.codice_fiscale,day]),kind:'referti_verifica_v1',workerKey:record.id,workerCf:worker.codice_fiscale,visit:day,analisi:'NO',drug:'SÌ',verifiedAt:'2026-10-13T12:00:00Z'};
  await put(p,confirmation);
  // Attachments outside the visible archive/filter must also be scanned.
  await put(p,row('A'));
  await put(p,row('B',{workerKey:'CF_SNTBTA80A01H501X',workerCf:'SNTBTA80A01H501X',name:'scan.png',blob:new Blob(['fixture'],{type:'image/png'})}));
  await put(p,{id:'REFERTI_SCAN_A',kind:'referti_scan_v1',attachmentId:'A',version:1,fingerprint:JSON.stringify(['',7,'','scansione.pdf']),analisi:'DA VERIFICARE',drug:'DA VERIFICARE',readable:false});
  let pdfCalls=0,ocrCalls=0,created=0,terminated=0,active=0,rendered=0;
  p.w.pdfjsLib={GlobalWorkerOptions:{},getDocument(){pdfCalls++;return {promise:Promise.resolve({numPages:2,getPage:async()=>({getTextContent:async()=>({items:[]}),getViewport:({scale})=>({width:595*scale,height:842*scale}),render(){rendered++;return {promise:Promise.resolve()}},cleanup(){}})}),destroy:async()=>{}}}};
  p.w.Tesseract={createWorker:async(langs,oem,options)=>{created++;return {setParameters:async()=>{},terminate:async()=>{terminated++},recognize:async()=>{assert.equal(active++,0,'sequential OCR avoids simultaneous document copies');ocrCalls++;options.logger({status:'recognizing text',progress:0.5});active--;return {data:{text:ocrCalls===1?lab:drug,confidence:94}}}}}};
  const originalRows=await p.t.rows();
  await p.$('refertiScanAll').onclick();
  assert.equal(pdfCalls,1);assert.equal(rendered,2);assert.equal(ocrCalls,3);assert.equal(created,1);assert.equal(terminated,1);
  const rows=await p.t.rows(),scan=rows.find(r=>r.id==='REFERTI_SCAN_A');
  assert.deepEqual(pair(scan),['SÌ','SÌ']);assert.equal(scan.ocrPages,2);assert.equal(scan.version,2);
  assert.equal(rows.find(r=>r.id==='REFERTI_SCAN_B').drug,'SÌ');
  assert.deepEqual(rows.find(r=>r.id===confirmation.id),confirmation,'manual confirmations remain byte-for-byte intact');
  assert.deepEqual(pair((await api.statuses([record])).get(record.id)),['NO','SÌ'],'manual review overrides automatic recognition');
  assert.equal(JSON.stringify(await p.t.cartelle()),before,'do not rewrite clinical records');
  for(const original of originalRows.filter(r=>r.kind==='allegato_cartella_v1')){
   const after=rows.find(r=>r.id===original.id);assert.deepEqual({...after,blob:null},{...original,blob:null});assert.equal(await after.blob.text(),await original.blob.text());
  }
  assert.match(p.$('refertiScanStatus').textContent,/Elaborati 2 allegati su 2/);
  await p.$('refertiScanAll').onclick();assert.equal(ocrCalls,3,'resume reuses successful unchanged results');assert.equal(created,1);
  // Changed file must be read again, without invalidating another attachment.
  await put(p,row('A',{savedAt:'2026-10-14T16:00:00Z'}));await p.$('refertiScanAll').onclick();assert.equal(pdfCalls,2);
  // Stop after the current page: no partial-document false negatives; earlier results survive.
  await put(p,row('C'));
  p.w.Tesseract.createWorker=async()=>({setParameters:async()=>{},terminate:async()=>{},recognize:async()=>{p.$('refertiScanStop').onclick();return {data:{text:lab,confidence:94}}}});
  await p.$('refertiScanAll').onclick();assert.match(p.$('refertiScanStatus').textContent,/Controllo interrotto/);
  assert.equal((await p.t.rows()).some(r=>r.id==='REFERTI_SCAN_C'),false);assert.equal((await p.t.rows()).find(r=>r.id==='REFERTI_SCAN_A').version,2);
  // Worker failure stops the batch once instead of producing hundreds of failed records.
  let failures=0;p.w.Tesseract.createWorker=async()=>{failures++;throw Error('Simulated offline OCR')};
  await p.$('refertiScanAll').onclick();assert.equal(failures,1);assert.match(p.$('refertiScanStatus').textContent,/OCR non disponibile/);assert.equal(p.$('refertiScanAll').disabled,false);
  // One low-confidence page cannot erase a clear preceding laboratory page.
  let call=0;p.w.Tesseract.createWorker=async()=>({setParameters:async()=>{},terminate:async()=>{},recognize:async()=>({data:++call===1?{text:lab,confidence:94}:{text:drug,confidence:40}})});
  await p.$('refertiScanAll').onclick();assert.deepEqual(pair((await p.t.rows()).find(r=>r.id==='REFERTI_SCAN_C')),['SÌ','DA VERIFICARE']);
  // A damaged page also retains positive evidence from the readable pages.
  await put(p,row('D'));
  p.w.pdfjsLib.getDocument=()=>({promise:Promise.resolve({numPages:2,getPage:async n=>({getTextContent:async()=>{if(n===2)throw Error('Damaged page');return {items:[{str:lab}]}},cleanup(){}})}),destroy:async()=>{}});
  await p.$('refertiScanAll').onclick();assert.deepEqual(pair((await p.t.rows()).find(r=>r.id==='REFERTI_SCAN_D')),['SÌ','DA VERIFICARE']);
  assert.deepEqual(p.errors,[]);
  console.log('PASS: scanned PDFs and images; all workers/filters; page-specific recognition; negative drug outcome; prescriptions excluded; legacy rescan; manual confirmations and original files unchanged; cache/invalidation; interruption/resume; engine failures; partial OCR evidence.');
 }finally{p.dom.window.close()}
}
run().catch(e=>{console.error(e);process.exitCode=1});
