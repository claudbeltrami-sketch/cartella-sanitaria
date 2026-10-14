const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),server=require('./local-server.cjs')(root);
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
  const page=await browser.newPage({viewport:{width:1350,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const origin='http://127.0.0.1:'+server.address().port;await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin);
  await page.evaluate(async()=>{
   const person={cognome:'SINTETICO',nome:'PDF',codice_fiscale:'TSTPDF80A01H501X',data_giudizio:'2026-10-14',firma_lavoratore_png:''};await lumenBatchCertApi.saveToLocalArchive(person);lumenBatchCertApi.apply(person);
   const blob=new Blob(['%PDF SYNTHETIC NATIVE'],{type:'application/pdf'}),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
   const storage=lumenAllegatiStorage,db=await storage.open();await new Promise((resolve,reject)=>{const tx=db.transaction(storage.store,'readwrite');tx.objectStore(storage.store).put({id:'ATT_NATIVE',kind:'allegato_cartella_v1',workerKey:'CF_'+person.codice_fiscale,workerCf:person.codice_fiscale,workerLabel:'SINTETICO PDF',visit:'2026-10-14',name:'native.pdf',type:blob.type,size:blob.size,hash,savedAt:'2026-10-14T00:00:00Z',blob});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});db.close();
   // A real browser directory handle is used for capability serialization and
   // file writes. OPFS is a synthetic fixture, never the production destination.
   const root=await navigator.storage.getDirectory(),folder=await root.getDirectoryHandle('native-fixture',{create:true});window.showDirectoryPicker=async()=>folder;
  });
  await page.locator('#btnArchivioPdfMacInPagina').click();await page.locator('#pdfMacDirect').click();await page.waitForFunction(()=>document.getElementById('pdfMacStatus').textContent.includes('1 documenti verificati'));
  assert.equal(await page.evaluate(async()=>(await lumenAllegatiStorage.list())[0].blob),null);
  assert.equal(await page.evaluate(async()=>await(await lumenExternalAttachments.getBlob((await lumenAllegatiStorage.list())[0])).text()),'%PDF SYNTHETIC NATIVE');
  await page.locator('#pdfMacBackup').click();await page.waitForFunction(()=>document.getElementById('lumenBackupTitle').textContent==='BACKUP LEGGERO PRONTO DA SALVARE');
  const saved=await page.evaluate(async()=>JSON.parse(await(await fetch(document.getElementById('lumenBackupDownload').href)).text()));assert.equal(saved.tipo,'BELTRAMI_BACKUP_LEGGERO_V2');assert.equal(saved.contenuto.cartelle.length,1);assert.equal(saved.contenuto.originali[0].blob,null);
  // The directory handle survives a new page instance without resending PDFs.
  await page.reload();assert.equal(await page.evaluate(async()=>await(await lumenExternalAttachments.getBlob((await lumenAllegatiStorage.list())[0])).text()),'%PDF SYNTHETIC NATIVE');
  await page.evaluate(async()=>{const old=(await lumenAllegatiStorage.list())[0],blob=new Blob(['%PDF NEW NATIVE'],{type:'application/pdf'}),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');const [staged]=await lumenExternalAttachments.stageNew([{...old,id:'ATT_NEW',name:'new.pdf',blob,size:blob.size,hash,external:undefined}]);if(staged.blob!==null)throw Error('New attachment not external');if(await(await lumenExternalAttachments.getBlob(staged)).text()!=='%PDF NEW NATIVE')throw Error('New bytes mismatch');});
  // Missing permissions produce an actionable message, without changing data.
  const denied=await page.evaluate(async()=>{const original=FileSystemDirectoryHandle.prototype.queryPermission;try{FileSystemDirectoryHandle.prototype.queryPermission=async()=> 'denied';await lumenExternalAttachments.getBlob((await lumenAllegatiStorage.list())[0]);return ''}catch(e){return e.message}finally{FileSystemDirectoryHandle.prototype.queryPermission=original}});assert.match(denied,/collega la cartella/);
  await page.locator('#btnArchivioPdfMacInPagina').click();const out=path.join(root,'tmp/allegati-esterni');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png')});
  assert.equal(await page.evaluate(()=>document.getElementById('pdfMacDialog').scrollWidth<=document.getElementById('pdfMacDialog').clientWidth+1),true);
  assert.deepEqual(errors,[]);console.log('PASS Chromium: native handle writes/readback and persistence across reload, SHA-256, light backup from UI, new attachments saved externally, missing permission, desktop/mobile controls. Physical Mac/native picker not tested.');
 }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
