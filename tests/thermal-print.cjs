const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/print-layout');fs.mkdirSync(out,{recursive:true});
const fixture=vm.runInNewContext('('+fs.readFileSync(path.join(__dirname,'print-layout.cjs'),'utf8').match(/const fixture=(\{[\s\S]*?\n\});/)[1]+')');
const libraries={html2canvas:fs.readFileSync(require.resolve('html2canvas/dist/html2canvas.min.js'),'utf8'),jspdf:fs.readFileSync(require.resolve('jspdf/dist/jspdf.umd.min.js'),'utf8')};
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!['index.html','thermal-print.js','cambia-lista.js'].includes(name)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(path.join(root,name)))});
async function run(engine,name){
 const browser=await engine.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();const origin=`http://127.0.0.1:${server.address().port}`;
  page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',r=>{const url=r.request().url();if(url.startsWith(origin))return r.continue();if(url.includes('/html2canvas/'))return r.fulfill({contentType:'text/javascript',body:libraries.html2canvas});if(url.includes('/jspdf/'))return r.fulfill({contentType:'text/javascript',body:libraries.jspdf});return r.abort()});
  await page.goto(origin);await page.waitForSelector('#printDestination');assert.equal(await page.locator('#printDestination').inputValue(),'standard');
  await page.selectOption('#printDestination','thermal');await page.reload();assert.equal(await page.locator('#printDestination').inputValue(),'thermal');
  await page.evaluate(d=>{const c=document.createElement('canvas');c.width=400;c.height=100;const x=c.getContext('2d');x.font='30px sans-serif';x.fillText('FIRMA TEST',20,60);d.firma_lavoratore_png=c.toDataURL();window.lumenBatchCertApi.apply(d);window.testInitial=JSON.stringify(window.lumenBatchCertApi.collect());window.testStore=JSON.stringify({...localStorage});window.testShareFiles=[];Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});Object.defineProperty(navigator,'share',{value:async({files})=>{window.testShareFiles=files;if(window.testCancelShare)throw new DOMException('Cancelled','AbortError')},configurable:true});},fixture);
  for(const [type,generate,button] of [['cartella',null,'btnStampa'],['certificato','btnCert','btnPrintCert'],['consenso','btnConsenso','btnPrintConsenso']]){
   if(generate)await page.locator('#'+generate).click();
   await page.locator('#'+button).click();await page.locator('#thermalDialog').waitFor({state:'visible'});
   await page.locator('#thermalPrepare').click();try{await page.waitForFunction(()=>/^PDF (PRONTO|NON CREATO)/.test(document.getElementById('thermalStatus').textContent),{},{timeout:45000});assert.match(await page.locator('#thermalStatus').textContent(),/^PDF PRONTO/)}catch(e){console.error('THERMAL STATUS:',await page.locator('#thermalStatus').textContent());console.error('PAGE ERRORS:',errors);await page.screenshot({path:path.join(out,`thermal-${name}-error.png`)});throw e}
   const download=page.waitForEvent('download');await page.locator('#thermalDownload').click();await(await download).saveAs(path.join(out,`thermal-${name}-${type}.pdf`));
   await page.locator('#thermalShare').click();assert.equal(await page.evaluate(()=>window.testShareFiles[0].type),'application/pdf');assert.match(await page.locator('#thermalStatus').textContent(),/Condivisione completata/);
   await page.evaluate(()=>window.testCancelShare=true);await page.locator('#thermalShare').click();assert.match(await page.locator('#thermalStatus').textContent(),/annullata/);await page.evaluate(()=>window.testCancelShare=false);
   if(type==='cartella')await page.screenshot({path:path.join(out,`thermal-${name}-dialog.png`)});
   await page.locator('#thermalClose').click();assert.equal(await page.locator('iframe[title="Preparazione PDF"]').count(),0);
   assert.equal(await page.evaluate(()=>JSON.stringify(window.lumenBatchCertApi.collect())===window.testInitial),true,'Export must not alter form values');
   assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})===window.testStore),true,'Export must not alter saved records');
   console.log(`PASS ${name}: thermal ${type} PDF, share, cancellation, unchanged records`);
  }
  // Changing printer back to standard must restore the original handler.
  await page.locator('#btnTornaConsenso').click();await page.selectOption('#printDestination','standard');await page.evaluate(()=>window.print=()=>window.testPrinted=true);await page.locator('#btnStampa').click();assert.equal(await page.evaluate(()=>window.testPrinted),true);assert.equal(await page.locator('#thermalDialog').isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await run(chromium,'chromium');await run(webkit,'webkit');}finally{server.close()}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
