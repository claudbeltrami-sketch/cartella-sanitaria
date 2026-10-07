const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),server=require('./local-server.cjs')(root);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept().catch(()=>{}));
  await p.goto(url);await p.waitForFunction(()=>window.lumenBatchCertApi);
  const initial=await p.evaluate(async()=>{
   const a={cognome:'COLLAUDO',nome:'ALFA',codice_fiscale:'TEST000000000001',data_nascita:'1980-01-01',datore_lavoro:'SERMOLAB - AZIENDA FITTIZIA SRL',mansione:'COLLAUDO',data_giudizio:'2026-10-07',giudizio:'IDONEO',luogo_visita:'ROMA'};
   await lumenBatchCertApi.saveToLocalArchive(a);await lumenBatchCertApi.saveToLocalArchive({...a,nome:'BETA',codice_fiscale:'TEST000000000002',committente:'BUSINESS GROUP',datore_lavoro:'AZIENDA FITTIZIA SRL'});
   return JSON.stringify(await lumenArchiveVisitsApi.list());
  });
  await p.locator('#btnArchivioCartelle').click();await p.locator('#archiveClient').fill('SERMOLAB');await p.locator('#archiveEmployer').fill('AZIENDA FITTIZIA');await p.locator('#btnCercaArchivio').click();
  await p.waitForFunction(()=>document.querySelectorAll('#archiveResults tbody tr').length===1);
  assert.match(await p.locator('#archiveSummary').innerText(),/Cartelle trovate: 1/);
  const mobile=await p.locator('#archiveResults').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,comm:getComputedStyle(e.querySelector('td:nth-child(4)'),'::before').content}));
  assert.ok(mobile.scroll<=mobile.width+1,JSON.stringify(mobile));assert.match(mobile.comm,/COMMITTENTE/);
  fs.mkdirSync(path.join(root,'tmp'),{recursive:true});await p.screenshot({path:path.join(root,'tmp/ruoli-mobile.png')});
  await p.locator('#btnElencoVisiteArchivio').click();await p.locator('#visiteArchiveDate').fill('2026-10-07');await p.locator('#visiteArchiveLoad').click();await p.waitForFunction(()=>document.querySelectorAll('#visiteArchiveRows tbody tr').length===1);
  assert.equal(await p.locator('#visiteArchiveClientFilter').inputValue(),'SERMOLAB');assert.match(await p.locator('#visiteArchiveRows').innerText(),/AZIENDA FITTIZIA SRL/);
  await p.locator('#visiteArchiveClientFilter').fill('BUSINESS GROUP');assert.equal(await p.locator('#visiteArchivePdf').isDisabled(),true);await p.locator('#visiteArchiveLoad').click();await p.waitForFunction(()=>document.querySelector('#visiteArchiveRows').textContent.includes('BETA'));
  assert.equal(await p.evaluate(async()=>JSON.stringify(await lumenArchiveVisitsApi.list())),initial);
  await p.locator('#visiteArchiveClose').click();await p.locator('[data-archive-id]').click();await p.waitForFunction(()=>document.getElementById('committente').value==='SERMOLAB');assert.equal(await p.locator('#committente').inputValue(),'SERMOLAB');assert.equal(await p.locator('#datore_lavoro').inputValue(),'AZIENDA FITTIZIA SRL');
  await p.setViewportSize({width:1200,height:1000});await p.locator('#committente').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(root,'tmp/ruoli-cartella.png')});
  await p.evaluate(()=>lumenBatchCertApi.popolaCertificato(undefined,false));assert.equal(await p.locator('#c_azienda').innerText(),'AZIENDA FITTIZIA SRL');await p.screenshot({path:path.join(root,'tmp/ruoli-certificato.png')});
  await p.evaluate(()=>{document.getElementById('certificate').style.display='none';document.querySelector('.cartella').classList.remove('hidden');document.body.className='print-cartella'});await p.emulateMedia({media:'print'});assert.equal(await p.locator('#committente').isVisible(),false);
  await p.pdf({path:path.join(root,'tmp/ruoli-cartella.pdf'),preferCSSPageSize:true,printBackground:true});
  assert.deepEqual(errors,[]);console.log('PASS: Chromium mobile 390px, no horizontal overflow, correct column labels, combined filters, date dialog, invalidation, archive unmodified, desktop form, certificate employer, print hidden administrative controls.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
