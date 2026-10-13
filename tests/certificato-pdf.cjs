// Actual PDF bytes and application entry points, with synthetic clinical data.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/certificato-pdf');
fs.mkdirSync(out,{recursive:true});
const signature='data:image/png;base64,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';
const fixture={cognome:'PROVA',nome:'COLLAUDO',codice_fiscale:'TSTPRV80A01H501X',sesso:'M',
 luogo_nascita:'ROMA',data_nascita:'1980-01-01',datore_lavoro:'AZIENDA FITTIZIA SPA',
 mansione:'OPERATORE DI PRODUZIONE - MULETTISTA',data_giudizio:'2026-10-12',data_cartella:'2026-10-12',
 luogo_visita:'SERMONETA',periodicita:'ANNUALE',giudizio:'IDONEO',prescrizioni:'',
 rischi:['MOVIMENTAZIONE MANUALE DEI CARICHI','IMPEGNO ARTI SUP - MOV. RIP.','RUMORE','POLVERI INERTI'],
 firma_lavoratore_png:signature};
const server=require('./local-server.cjs')(root);
const digest=b=>createHash('sha256').update(b).digest('hex');
let expected;
async function blobBytes(page,expression){return Buffer.from(await page.evaluate(async expression=>Array.from(new Uint8Array(await (await eval(expression)).arrayBuffer())),expression));}
async function state(page){return page.evaluate(()=>JSON.stringify({data:window.lumenBatchCertApi.collect(),local:{...localStorage}}));}
async function run(engine,name,options){
 const browser=await engine.launch(engine===webkit&&process.env.WEBKIT_EXECUTABLE_PATH?{executablePath:process.env.WEBKIT_EXECUTABLE_PATH}:{});
 try{
  const page=await browser.newPage({...options,acceptDownloads:true});page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>{errors.push(d.message());d.dismiss()});
  const origin=`http://127.0.0.1:${server.address().port}`;
  await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await page.goto(origin);await page.waitForFunction(()=>window.lumenBatchCertApi&&window.lumenCertificatePdf);
  await page.evaluate(d=>{window.lumenBatchCertApi.apply(d);window.lumenBatchCertApi.popolaCertificato(undefined,false)},fixture);
  const before=await state(page);
  // Test the real standard button and its download, not a mocked renderer.
  const download=page.waitForEvent('download');await page.locator('#btnPrintCert').click();
  const file=path.join(out,name+'.pdf');await(await download).saveAs(file);
  const bytes=fs.readFileSync(file),hash=digest(bytes);
  if(expected)assert.equal(hash,expected,'PDF bytes differ across browser/viewport/timezone/DPR');else expected=hash;
  assert.equal(digest(await blobBytes(page,'window.lumenCertificatePdf.current()')),hash,'Repeated generation');
  assert.equal(await state(page),before,'Single export changes form/storage');
  // The thermal choice shares exactly the same certificate bytes.
  await page.locator('#printDestinationCertificato').selectOption('thermal');
  await page.locator('#btnPrintCert').click();await page.locator('#thermalPrepare').click();
  await page.locator('#thermalReady').waitFor({state:'visible'});
  const thermalDownload=page.waitForEvent('download');await page.locator('#thermalDownload').click();
  const thermalPath=path.join(out,name+'-thermal.pdf');await(await thermalDownload).saveAs(thermalPath);
  const thermal=fs.readFileSync(thermalPath);
  assert.equal(digest(thermal),hash,'Thermal export changed certificate');await page.locator('#thermalClose').click();
  await page.locator('#printDestinationCertificato').selectOption('standard');
  // Archive batch, including two distinct worker signatures and no archive writes.
  await page.evaluate(async d=>{
   const api=window.lumenBatchCertApi;
   window.testBatch=[d,{...d,nome:'SECONDO',codice_fiscale:'TSTSCN80A01H501Y',firma_lavoratore_png:'',periodicita:'ALTRO',periodicita_altro:'SEMESTRALE'}];
   for(const item of window.testBatch)await api.saveToLocalArchive(item);
   window.testRecords=await Promise.all(window.testBatch.map(item=>api.getCartellaRecord(api.cartellaId(item))));
   window.testArchiveBefore=JSON.stringify(window.testRecords);
  },fixture);
  const batchState=await state(page),batchDownload=page.waitForEvent('download');
  await page.evaluate(async()=>{
   const records=window.testRecords;
   await window.lumenArchiveVisitsApi.prepareCertificates({tipo:'LUMEN_ARCHIVE_CERTIFICATES_V1',records,
    session:{data:'2026-10-12',sede:'SERMONETA',committente:'COLLAUDO',esiti:{},workers:records.map(r=>({...r.data,visited:true}))}});
  });
  await(await batchDownload).saveAs(path.join(out,name+'-batch.pdf'));
  assert.equal(await state(page),batchState,'Batch failed to restore current form/storage');
  assert.equal(await page.evaluate(async()=>JSON.stringify(await Promise.all(window.testBatch.map(d=>window.lumenBatchCertApi.getCartellaRecord(window.lumenBatchCertApi.cartellaId(d)))))===window.testArchiveBefore),true);
  // Legacy session button must call the same renderer and restore even on error.
  await page.evaluate(()=>localStorage.setItem('beltrami_v9_sessione_attiva',JSON.stringify({data:'2026-10-12',sede:'SERMONETA',esiti:{},workers:window.testBatch.map(d=>({...d,visited:true}))})));
  const legacyState=await state(page),legacyDownload=page.waitForEvent('download');
  await page.evaluate(()=>document.getElementById('v9InvioCertificati').click());
  const legacyPath=path.join(out,name+'-session.pdf');await(await legacyDownload).saveAs(legacyPath);
  assert.equal(digest(fs.readFileSync(legacyPath)),digest(fs.readFileSync(path.join(out,name+'-batch.pdf'))),'Session/archive batches differ');
  assert.equal(await state(page),legacyState,'Session batch failed to restore state');
  const restoreState=await state(page);
  const expectedErrors=errors.length;
  await page.evaluate(async()=>{
   window.testOriginalRenderer=window.lumenCertificatePdf;
   window.lumenCertificatePdf={...window.testOriginalRenderer,create:async()=>({addCertificate:async()=>{throw Error('SIMULATED PDF FAILURE')}})};
   await window.lumenArchiveVisitsApi.prepareCertificates({tipo:'LUMEN_ARCHIVE_CERTIFICATES_V1',records:window.testRecords,
    session:{data:'2026-10-12',sede:'SERMONETA',esiti:{},workers:window.testRecords.map(r=>({...r.data,visited:true}))}});
  });
  assert.equal(await state(page),restoreState,'Archive failure left another worker selected');
  await page.evaluate(()=>document.getElementById('v9InvioCertificati').click());
  await page.waitForFunction(()=>!document.getElementById('v9InvioCertificati').disabled);
  assert.equal(await state(page),restoreState,'Session failure left another worker selected');
  assert.equal(errors.length,expectedErrors+2);assert.ok(errors.slice(expectedErrors).every(e=>e.includes('SIMULATED PDF FAILURE')));
  errors.splice(expectedErrors);
  await page.evaluate(()=>{window.lumenCertificatePdf=window.testOriginalRenderer});
  const failures=await page.evaluate(async()=>{
   const api=window.lumenCertificatePdf,snapshot=api.snapshot(),messages=[];
   for(const change of [{prescrizioni:'NOTA COMPLETA '.repeat(1500)},{workerImage:'data:image/png;base64,BROKEN'},{codice_fiscale:'DIFFERENTE'},{azienda:'AZIENDA 😀'}]){
    try{const pdf=await api.create();await pdf.addCertificate({...snapshot,...change});await pdf.toBlob();messages.push('UNEXPECTED SUCCESS');}
    catch(e){messages.push(e.message);}
   }
   return messages;
  });
  assert.ok(failures.every(s=>s!=='UNEXPECTED SUCCESS'),failures.join('\n'));
  // Long, still reasonable fields wrap in full without changing font size.
  await page.evaluate(()=>{
   const api=window.lumenBatchCertApi,d=api.collect();d.prescrizioni='UTILIZZO DEI DISPOSITIVI DI PROTEZIONE PREVISTI. CONTROLLO PERIODICO. '.repeat(4);
   api.apply(d);api.popolaCertificato(undefined,false);
  });
  fs.writeFileSync(path.join(out,name+'-prescrizioni.pdf'),await blobBytes(page,'window.lumenCertificatePdf.current()'));
  // Trial watermark and genuinely absent worker signature/CF remain explicit.
  const trial=await blobBytes(page,`(async()=>{const api=window.lumenCertificatePdf,pdf=await api.create();await pdf.addCertificate({...api.snapshot(),test:true,codice_fiscale:'',barcode:{bars:[],text:''},workerImage:''});return pdf.toBlob()})()`);
  fs.writeFileSync(path.join(out,name+'-prova.pdf'),trial);
  assert.deepEqual(errors,[],name+': application errors');
  console.log(`PASS ${name}: SHA256 ${hash}, repeat, single/thermal, session/archive batch, state/signatures, no truncation`);
 }finally{await browser.close()}
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  await run(chromium,'chromium-desktop',{viewport:{width:1440,height:1000},deviceScaleFactor:1,timezoneId:'Europe/Rome'});
  await run(chromium,'chromium-iphone',{viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:3,timezoneId:'America/New_York'});
  if(!process.env.CHROMIUM_ONLY){
   await run(webkit,'webkit-desktop',{viewport:{width:1440,height:1000},deviceScaleFactor:1,timezoneId:'Europe/Rome'});
   await run(webkit,'webkit-iphone',{viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:3,timezoneId:'America/New_York'});
  }
 }finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
