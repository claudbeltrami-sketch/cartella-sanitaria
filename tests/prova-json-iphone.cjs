// Independent PROVA JSON acceptance test. Synthetic data only, no normal archive writes.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),p=path.join(root,u.pathname==='/'?'index.html':u.pathname);
 if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end()}
 res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(p));
});
async function test(engine,name,url){
 const browser=await engine.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url.startsWith(url)?r.continue():r.abort());
  await page.goto(url+'?prova=fantasma');
  await page.waitForFunction(()=>window.lumenBatchCertApi&&document.getElementById('nome')?.value==='FANTASMA');
  await page.locator('#mansione').fill('COLLAUDO IPHONE');
  await page.locator('#btnSalva').click();
  await page.waitForFunction(async()=>{const a=lumenBatchCertApi;return (await a.getCartellaRecord(a.cartellaId(a.collect())))?.data.mansione==='COLLAUDO IPHONE'});
  await page.locator('#btnEsportaProvaJson').click();
  await page.locator('#provaExportBox').waitFor({state:'visible',timeout:15000});
  assert.match(await page.locator('#provaExportStatus').textContent(),/JSON PREPARATO, MA NON ANCORA SALVATO/);
  assert.match(page.url(),/\?prova=fantasma$/);
  const event=page.waitForEvent('download');await page.locator('#provaScaricaJson').click();
  const downloaded=await event;const bytes=fs.readFileSync(await downloaded.path());
  const packet=JSON.parse(bytes.toString('utf8'));
  assert.equal(packet.tipo,'LUMEN_EMERGENZA_SESSIONE_V1');
  assert.equal(packet.lumen_prova,true);assert.equal(packet.cartelle.length,1);
  assert.equal(packet.cartelle[0].data.mansione,'COLLAUDO IPHONE');
  await page.locator('#provaVerificaJson').setInputFiles({name:downloaded.suggestedFilename(),mimeType:'application/json',buffer:bytes});
  await page.waitForFunction(()=>document.getElementById('provaVerificaEsito').textContent.includes('JSON VERIFICATO IN FILE'));
  await page.locator('#mansione').fill('MODIFICA NON SALVATA');
  await page.locator('#btnEsportaProvaJson').click();
  await page.waitForFunction(()=>document.body.innerText.includes('LA CARTELLA MOSTRATA NON COINCIDE'));
  assert.equal(await page.locator('#provaExportBox').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS '+name+': save/read-back; same-browser export; genuine download; JSON file verification; unsaved changes blocked');
 }finally{await browser.close()}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/';
 try{await test(chromium,'chromium',url);if(!process.env.CHROMIUM_ONLY)await test(webkit,'webkit',url)}
 finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
