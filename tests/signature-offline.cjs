// Browser fault-injection tests; synthetic strokes only, no public signaling.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.join(root,url.pathname==='/'?'index.html':url.pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file));
});
const A={cognome:'PROVA',nome:'OFFLINE',codice_fiscale:'TEST_OFFLINE',data_nascita:'1980-01-01',data_cartella:'2026-09-28',data_giudizio:'2026-09-28',firma_lavoratore_png:''};
let url;
async function prepare(page,id='REQUEST_ONE',date=A.data_giudizio){
 await page.evaluate(({A,id,date})=>{
  window.lumenBatchCertApi.apply({...A,data_cartella:date,data_giudizio:date});
  sessionStorage.setItem('beltrami_firma_handoff',JSON.stringify({id,identita:A.codice_fiscale,visita:date,peerId:'OFFLINE_MAC'}));
  window.lumenBatchCertApi.sendSignatureDirectly=async()=>{throw Error('Rete non disponibile (collaudo)')};
 },{A,id,date});
 await page.locator('#btnFirmaLavoratore').click();
 const canvas=page.locator('#workerSignCanvas');await canvas.waitFor({state:'visible'});
 const box=await canvas.boundingBox();await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();
 await page.mouse.move(box.x+150,box.y+60,{steps:12});await page.mouse.move(box.x+90,box.y+100,{steps:12});await page.mouse.up();
 await page.locator('#workerSignConfirm').click();
 await page.waitForFunction(()=>!document.getElementById('workerSignConfirm').disabled);
}
async function run(engine,name){
 const browser=await engine.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:3});
  await context.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.lumenFirmaOffline&&window.lumenBatchCertApi);
  // Reproduce the original full-localStorage failure; IDB must still save the signature.
  await page.evaluate(()=>{localStorage.setItem('beltrami_firme_lavoratori_v1','{"STORICA":"originale"}');const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage)throw new DOMException('Full','QuotaExceededError');return set.call(this,k,v)}});
  await prepare(page);
  assert.match(await page.locator('#saveTitle').innerText(),/SALVATA SU IPHONE/);
  let rows=await page.evaluate(()=>window.lumenFirmaOffline.list());assert.equal(rows.length,1);assert.equal(rows[0].packet.visita,A.data_giudizio);assert.equal(rows[0].status,'pending');
  const image=rows[0].packet.firma_lavoratore_png;assert.ok(image.length<100000);
  assert.equal(await page.evaluate(()=>localStorage.getItem('beltrami_firme_lavoratori_v1')),'{"STORICA":"originale"}');
  // Share cancellation keeps the exact packet and never claims Mac acknowledgement.
  await page.evaluate(()=>{navigator.canShare=()=>true;navigator.share=async({files})=>{window.sharedPacket=JSON.parse(await files[0].text());throw new DOMException('Cancelled','AbortError')}});
  await page.getByRole('button',{name:'CONDIVIDI / AIRDROP',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('saveDetail').textContent.includes('annullata'));
  assert.equal((await page.evaluate(()=>window.sharedPacket)).firma_lavoratore_png,image);
  assert.equal((await page.evaluate(()=>window.lumenFirmaOffline.list()))[0].status,'pending');
  // Reload and independent recovery page preserve identity/date/request, not just pixels.
  await page.reload();await page.getByRole('button',{name:'RECUPERA FIRME',exact:true}).click();
  await page.locator('#lumenPendingSignatures article').waitFor();
  assert.match(await page.locator('#lumenPendingSignatures').innerText(),/2026-09-28/);
  await page.locator('#lumenPendingSignatures').getByRole('button',{name:'CHIUDI',exact:true}).click();
  // A second visit for the same worker must not overwrite the first.
  await prepare(page,'REQUEST_TWO','2026-09-29');rows=await page.evaluate(()=>window.lumenFirmaOffline.list());assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>r.packet.visita).sort(),['2026-09-28','2026-09-29']);
  // Full backup contains the outbox; restoring merges it without deleting originals.
  const downloading=page.waitForEvent('download');await page.locator('#btnBackupCompleto').click();const backup=JSON.parse(fs.readFileSync(await (await downloading).path(),'utf8'));
  assert.equal(backup.contenuto.firme_da_trasferire.length,2);
  await page.evaluate(async rows=>{await window.lumenFirmaOffline.restore(rows)},backup.contenuto.firme_da_trasferire);
  assert.equal((await page.evaluate(()=>window.lumenFirmaOffline.list())).length,2);
  await page.goto(url+'recupera-firme.html');await page.waitForFunction(()=>document.querySelectorAll('#pendingList article').length===2);
  const recovered=await page.evaluate(async()=>JSON.parse(await window.lumenFirmaOffline.fileFor((await window.lumenFirmaOffline.list()).find(r=>r.id==='REQUEST_ONE')).text()));
  assert.equal(recovered.firma_lavoratore_png,image);assert.equal(recovered.id,'REQUEST_ONE');assert.equal(recovered.versione,2);
  // Import the exported file into an independent Mac context, with original request only.
  const mac=await browser.newContext();await mac.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
  const mp=await mac.newPage();await mp.goto(url);
  const imported=await mp.evaluate(async({A,recovered})=>{const {apply,collect,getCartellaRecord,cartellaId}=window.lumenBatchCertApi;apply(A);localStorage.setItem('beltrami_richiesta_firma_v2_'+recovered.id,JSON.stringify({id:recovered.id,visita:recovered.visita,identita:recovered.identita}));
   const bad=[];
   for(const altered of [{...recovered,identita:'OTHER'},{...recovered,visita:'2026-09-29'},{...recovered,id:'UNKNOWN'}]){try{await beltramiFirmaIphone.importPacket(altered);bad.push('accepted')}catch(_){bad.push('rejected')}}
   await beltramiFirmaIphone.importPacket(recovered);const saved=await getCartellaRecord(cartellaId(collect()));apply(saved.data);return {bad,data:collect()};
  },{A,recovered});
  assert.deepEqual(imported.bad,['rejected','rejected','rejected']);assert.equal(imported.data.firma_lavoratore_png,image);await mac.close();
  // IDB unavailable: verified per-request localStorage is a fallback and survives reload.
  await page.goto(url);await page.evaluate(()=>{indexedDB.open=()=>{throw Error('IDB unavailable')}});
  await prepare(page,'REQUEST_FALLBACK');assert.match(await page.locator('#saveTitle').innerText(),/SALVATA SU IPHONE/);
  await page.reload();assert.ok((await page.evaluate(()=>window.lumenFirmaOffline.list())).some(r=>r.id==='REQUEST_FALLBACK'));
  // Both stores fail: keep a usable exact packet in memory and clearly avoid a saved claim.
  await page.evaluate(()=>{indexedDB.open=()=>{throw Error('IDB unavailable')};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage)throw new DOMException('Full','QuotaExceededError');return set.call(this,k,v)}});
  await prepare(page,'REQUEST_VOLATILE');assert.match(await page.locator('#saveTitle').innerText(),/NON SALVATA/);
  assert.ok(await page.evaluate(()=>window.lumenFirmaOffline.hasVolatile()));
  // Fully offline in the loaded page: native share is still reachable by a fresh tap.
  await context.setOffline(true);
  await page.evaluate(()=>{navigator.canShare=()=>true;navigator.share=async({files})=>{window.emergencyPacket=JSON.parse(await files[0].text())}});
  await page.getByRole('button',{name:'CONDIVIDI / AIRDROP',exact:true}).click();
  await page.waitForFunction(()=>window.emergencyPacket);
  assert.equal((await page.evaluate(()=>window.emergencyPacket)).id,'REQUEST_VOLATILE');
  assert.doesNotMatch(await page.locator('#saveTitle').innerText(),/RICEVUTA DAL MAC/);
  await page.getByRole('button',{name:'RECUPERA FIRME',exact:true}).click();await page.locator('#lumenPendingSignatures article').first().waitFor();
  assert.match(await page.locator('#lumenPendingSignatures').innerText(),/NON SALVATA/);
  fs.mkdirSync(path.join(root,'tmp/signature-offline'),{recursive:true});await page.screenshot({path:path.join(root,'tmp/signature-offline',name+'.png')});
  await context.setOffline(false);
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS '+name+': full localStorage; verified IDB; network failure; exact share/cancel; reload/recovery; separate visits; backup; independent Mac import; wrong worker/date/request blocked; IDB fallback; both stores failed; offline emergency controls.');
 }finally{await browser.close()}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port+'/';try{await run(chromium,'chromium');if(!process.env.CHROMIUM_ONLY)await run(webkit,'webkit')}finally{server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
