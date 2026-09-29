// Synthetic records only. Real and test pages share an origin to verify isolation.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),f=path.join(root,u.pathname==='/'?'index.html':u.pathname);if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(f))});
let url;
async function run(engine,name){
 const browser=await engine.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:430,height:932}});
  await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
  const normal=await ctx.newPage(),errors=[];normal.on('pageerror',e=>errors.push(e.message));await normal.goto(url);
  const before=await normal.evaluate(async()=>{
   const a=lumenBatchCertApi;a.apply({cognome:'SINTETICO',nome:'REALE',codice_fiscale:'TEST_REAL',data_giudizio:'2026-09-29',firma_lavoratore_png:''});await a.saveToLocalArchive();
   localStorage.setItem('beltrami_workers_v8',JSON.stringify({workers:[{cognome:'SINTETICO',nome:'REALE'}]}));
   const canvas=document.createElement('canvas');canvas.width=80;canvas.height=30;canvas.getContext('2d').fillRect(2,2,60,2);
   await lumenFirmaOffline.persist({id:'REAL_REQUEST',packet:{tipo:'BELTRAMI_FIRMA_IPHONE_V1',versione:2,id:'REAL_REQUEST',identita:'TEST_REAL',cognome:'SINTETICO',nome:'REALE',visita:'2026-09-29',firma_lavoratore_png:canvas.toDataURL()},status:'pending'});
   return {record:await a.getCartellaRecord(a.cartellaId(a.collect())),local:{...localStorage},pending:await lumenFirmaOffline.list()};
  });
  const popup=normal.waitForEvent('popup');await normal.locator('#btnModalitaProva').click();const ghost=await popup;ghost.on('pageerror',e=>errors.push(e.message));await ghost.waitForFunction(()=>document.getElementById('nome')?.value==='FANTASMA');
  assert.match(ghost.url(),/prova=fantasma/);assert.equal(await ghost.locator('#v9Panel').isVisible(),false);
  assert.equal(await ghost.evaluate(()=>lumenStorage.local.getItem('beltrami_workers_v8')),null);
  assert.equal((await ghost.evaluate(()=>lumenFirmaOffline.list())).length,0);
  await ghost.locator('#mansione').fill('COLLAUDO');await ghost.locator('#btnSalva').click();await ghost.waitForFunction(async()=>{const a=lumenBatchCertApi;return (await a.getCartellaRecord(a.cartellaId(a.collect())))?.data.mansione==='COLLAUDO'});
  await ghost.reload();await ghost.waitForFunction(()=>document.getElementById('mansione').value==='COLLAUDO');
  const qr=await ghost.evaluate(async()=>{
   window.QRCode=function(_,options){window.testQr=options.text};window.QRCode.CorrectLevel={M:1};openAutomaticSignatureReceiver=async()=>'';
   await beltramiFirmaIphone.prepare();return window.testQr;
  });assert.match(qr,/\?prova=fantasma#firma=/);
  const iphone=await browser.newContext({viewport:{width:390,height:844}});await iphone.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
  const phone=await iphone.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(qr);await phone.locator('#workerSignCanvas').waitFor({state:'visible'});
  assert.equal(await phone.locator('#nome').inputValue(),'FANTASMA');assert.match(phone.url(),/prova=fantasma/);
  const b=await phone.locator('#workerSignCanvas').boundingBox();await phone.mouse.move(b.x+30,b.y+30);await phone.mouse.down();await phone.mouse.move(b.x+170,b.y+60,{steps:10});await phone.mouse.move(b.x+70,b.y+100,{steps:10});await phone.mouse.up();await phone.locator('#workerSignConfirm').click();
  await phone.waitForFunction(()=>document.getElementById('saveTitle').textContent.includes('SALVATA SU IPHONE'));
  const packet=(await phone.evaluate(()=>lumenFirmaOffline.list()))[0].packet;assert.equal(packet.lumen_prova,true);
  await phone.reload();await phone.waitForFunction(()=>document.getElementById('nome').value==='FANTASMA');
  await phone.getByRole('button',{name:'RECUPERA FIRME',exact:true}).click();await phone.locator('#lumenPendingSignatures article').waitFor();
  assert.match(await phone.locator('#lumenPendingSignatures a').getAttribute('href'),/prova=fantasma/);
  await phone.goto(url+'recupera-firme.html?prova=fantasma');await phone.locator('#pendingList article').waitFor();assert.match(await phone.locator('h1').innerText(),/PROVA FANTASMA/);
  await ghost.evaluate(p=>beltramiFirmaIphone.importPacket(p),packet);
  await ghost.reload();await ghost.waitForFunction(()=>lumenBatchCertApi.collect().firma_lavoratore_png);
  const data=await ghost.evaluate(()=>lumenBatchCertApi.collect());assert.equal(data.firma_lavoratore_png,packet.firma_lavoratore_png);assert.equal(data.lumen_prova,true);
  const denied=await normal.evaluate(async({data,packet})=>{
   const results=[];for(const op of [()=>lumenBatchCertApi.apply(data),()=>lumenBatchCertApi.saveToLocalArchive(data),()=>beltramiFirmaIphone.importPacket(packet),()=>lumenFirmaOffline.persist({id:packet.id,packet})]){try{await op();results.push(false)}catch(_){results.push(true)}}return results;
  },{data,packet});assert.deepEqual(denied,[true,true,true,true]);
  const download=ghost.waitForEvent('download');await ghost.locator('#btnBackupCompleto').click();const backup=JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));assert.equal(backup.lumen_prova,true);assert.equal(backup.contenuto.cartelle.length,1);
  assert.equal(await normal.evaluate(async b=>{try{await ripristinaBackupCompleto(new File([JSON.stringify(b)],'prova.json'));return false}catch(_){return true}},backup),true);
  fs.mkdirSync(path.join(root,'tmp/prova-fantasma'),{recursive:true});await ghost.screenshot({path:path.join(root,'tmp/prova-fantasma',name+'.png')});
  ghost.on('dialog',d=>d.accept());await ghost.locator('#btnAzzeraProva').click();await ghost.waitForFunction(()=>document.getElementById('nome').value==='FANTASMA'&&!lumenBatchCertApi.collect().firma_lavoratore_png);
  const after=await normal.evaluate(async()=>({record:await lumenBatchCertApi.getCartellaRecord('CF_TESTREAL'),local:{...localStorage},pending:await lumenFirmaOffline.list()}));
  // Ignore only the separate namespace: no normal key/record/outbox may change.
  for(const k of Object.keys(after.local))if(k.startsWith('lumen_prova_fantasma_v1:'))delete after.local[k];
  assert.deepEqual(after,before);assert.deepEqual(errors,[]);
  await iphone.close();await ctx.close();console.log('PASS '+name+': isolated storage; normal draft intact; save/reopen; QR mode; finger signature; offline recovery; Mac import; cross-mode rejection; backup rejection; reset preserves real records and outbox.');
 }finally{await browser.close()}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port+'/';try{await run(chromium,'chromium');if(!process.env.CHROMIUM_ONLY)await run(webkit,'webkit')}finally{server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
