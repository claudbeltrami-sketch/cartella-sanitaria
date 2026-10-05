const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),server=require('./local-server.cjs')(root);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-gpu']});
  const origin='http://127.0.0.1:'+server.address().port;
  const ctx=await browser.newContext({viewport:{width:1280,height:850},acceptDownloads:true});
  await ctx.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await ctx.addInitScript(()=>{window.showDirectoryPicker=undefined});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(origin+'/?prova=fantasma');
  await p.evaluate(async()=>{const d={...lumenBatchCertApi.collect(),...lumenStorage.identity,lumen_prova:true,data_giudizio:'2026-10-05'};lumenBatchCertApi.apply(d);await lumenBatchCertApi.saveToLocalArchive(d)});
  await p.locator('#btnAltriComandi').click();await p.locator('#btnBackupAutomatico').click();
  assert.equal(await p.locator('#autoBackupDialog').isVisible(),true);
  const promise=p.waitForEvent('download');await p.locator('#autoBackupStart').click();const download=await promise;
  const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(backup.contenuto.cartelle.length,1);assert.equal(backup.lumen_prova,true);assert.ok(Array.isArray(backup.contenuto.consensi_cartacei));
  assert.match(await p.locator('#autoBackupDetail').innerText(),/non è confermato/);
  await p.locator('#autoBackupClose').click();
  await p.emulateMedia({media:'print'});assert.equal(await p.locator('#autoBackupStatus').isVisible(),false);await p.emulateMedia({media:'screen'});
  await p.reload();assert.equal(await p.evaluate(()=>lumenAutoBackup.active),false);assert.equal((await p.evaluate(()=>lumenBackupApi.prepare())).contenuto.cartelle.length,1);
  const rctx=await browser.newContext();await rctx.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const q=await rctx.newPage();q.on('dialog',d=>d.accept());q.on('pageerror',e=>errors.push(e.message));await q.goto(origin+'/?prova=fantasma');
  await q.locator('#fileRipristinaBackup').setInputFiles({name:'prova-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await q.waitForFunction(()=>document.getElementById('status').textContent.includes('RIPRISTINO COMPLETATO'));
  assert.deepEqual((await q.evaluate(()=>lumenBackupApi.prepare())).contenuto.cartelle,backup.contenuto.cartelle);
  await q.locator('#btnAltriComandi').click();await q.locator('#btnBackupAutomatico').click();
  fs.mkdirSync(path.join(root,'tmp'),{recursive:true});await q.screenshot({path:path.join(root,'tmp/backup-automatico.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS browser Chromium: PROVA, UI desktop, download JSON reale, contenuto archivio, stato onesto, riapertura, ripristino in archivio vuoto, esclusione dalla stampa.');
 }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
