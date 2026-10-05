// Local browser gate; synthetic data only, with all external requests blocked.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/committenti');fs.mkdirSync(out,{recursive:true});
const server=require('./local-server.cjs')(root);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(url);
  await p.evaluate(async()=>{
   const d={cognome:'COLLAUDO',nome:'FITTIZIO',codice_fiscale:'TEST000000000001',data_nascita:'1980-01-01',datore_lavoro:'ORIZZONTE AZIENDA FITTIZIA',data_cartella:'2026-09-30',data_giudizio:'2026-09-30',luogo_visita:'ROMA',giudizio:'IDONEO',mansione:'COLLAUDO'};
   const {rec}=await lumenBatchCertApi.saveToLocalArchive(d);
   await lumenConteggioStorage.change(rec.id,r=>{r.conteggioVisits['2026-09-30'].client=''});
  });
  await p.reload();await p.waitForFunction(()=>document.getElementById('conteggioAutoStatus').textContent.includes('1 VISITE IN ATTESA'));
  assert(! (await p.locator('#conteggioAutoStatus').innerText()).includes('SENZA COMMITTENTE'));
  await p.locator('#btnConteggioAuto').click();assert.match(await p.locator('#conteggioAutoPending').innerText(),/GRUPPO ORIZZONTE/);
  await p.screenshot({path:path.join(out,'mobile.png')});await p.locator('#conteggioAutoClose').click();
  await p.locator('#btnArchivioCartelle').click();await p.locator('[data-archive-id="CF_TEST000000000001"]').click();
  await p.locator('#archiveModal').waitFor({state:'hidden'});
  assert.equal(await p.locator('#cognome').inputValue(),'COLLAUDO');
  await p.evaluate(()=>document.getElementById('btnCert').onclick());assert.match(await p.locator('#c_azienda').innerText(),/ORIZZONTE/);
  await p.evaluate(()=>{document.body.className='print-certificato';window.dispatchEvent(new Event('beforeprint'))});
  await p.pdf({path:path.join(out,'certificato.pdf'),preferCSSPageSize:true,printBackground:true});
  await p.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await p.locator('#btnTorna').click();
  await p.evaluate(()=>{document.body.className='print-cartella';window.dispatchEvent(new Event('beforeprint'))});
  await p.pdf({path:path.join(out,'cartella.pdf'),preferCSSPageSize:true,printBackground:true});
  await p.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  const ghost=await ctx.newPage();await ghost.goto(url+'?prova=fantasma');
  await ghost.waitForFunction(()=>window.lumenStorage?.isTest);
  await ghost.evaluate(async()=>{const d={...lumenBatchCertApi.collect(),datore_lavoro:'SERMOLAB COLLAUDO',data_giudizio:'2026-09-30',giudizio:'IDONEO'};await lumenBatchCertApi.saveToLocalArchive(d)});
  assert.equal(await ghost.evaluate(async()=>(await lumenConteggioStorage.list()).some(r=>Object.keys(r.conteggioVisits||{}).length)),false);
  assert.deepEqual(errors,[]);console.log('PASS browser mobile: automatic recovery on reopen; commissioner visible; archive open/save; certificate and chart PDFs generated; PROVA does not queue visits.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
