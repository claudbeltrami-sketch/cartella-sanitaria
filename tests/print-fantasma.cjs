// Regression: the test banner must not push the doctor onto a separate page.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/print-layout');
fs.mkdirSync(out,{recursive:true});
const fixture=vm.runInNewContext('('+fs.readFileSync(path.join(__dirname,'print-layout.cjs'),'utf8').match(/const fixture=(\{[\s\S]*?\n\});/)[1]+')');
Object.assign(fixture,{nome:'FANTASMA',codice_fiscale:'',data_nascita:'',lumen_prova:true});
const server=require('./local-server.cjs')(root);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:390,height:844}});
   const origin=`http://127.0.0.1:${server.address().port}`;
   await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
   await page.goto(origin+'/?prova=fantasma');
   await page.waitForFunction(()=>window.lumenBatchCertApi&&document.getElementById('nome').value==='FANTASMA');
   await page.evaluate(d=>window.lumenBatchCertApi.apply(d),fixture);
   const snapshot=()=>page.evaluate(()=>JSON.stringify({data:window.lumenBatchCertApi.collect(),storage:{...localStorage}}));
   const before=await snapshot();
   await page.setViewportSize({width:Math.round(186*96/25.4),height:1100});
   await page.emulateMedia({media:'print'});
   await page.evaluate(()=>{document.body.className='print-cartella';window.dispatchEvent(new Event('beforeprint'))});
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#cartellaForm img[src]')].map(i=>i.decode()))});
   const first=await page.locator('#cartellaForm>.page').first().boundingBox();
   assert.ok(first.height<277*96/25.4,`${name}: first section and test banner must fit inside A4 margins`);
   if(name==='chromium'){
    const pdf=path.join(out,'fantasma.pdf');
    await page.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
    execFileSync('python',['-c',`import fitz,sys
p=fitz.open(sys.argv[1])
assert len(p)==5, len(p)
t=p[0].get_text()
for text in ['PROVA FANTASMA','Domicilio','Datore di lavoro','Fattori di rischio','Il Medico Competente']:
 assert text in t, text
assert p[0].get_images(), 'Doctor signature missing from first page'
assert '1. ANAMNESI LAVORATIVA' in p[1].get_text()
p[0].get_pixmap().save(sys.argv[2])`,pdf,path.join(out,'fantasma-first-page.png')]);
   }
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.equal(await snapshot(),before,'Printing must preserve form data and local storage');
   assert.equal(await page.locator('.lumen-print-value').count(),0);
   // Cartella margins must not leak into later certificate/consent printing.
   for(const kind of ['certificato','consenso']){
    await page.evaluate(kind=>{document.body.className='print-'+kind;window.dispatchEvent(new Event('beforeprint'))},kind);
    assert.equal(await page.locator('#lumen-cartella-page-size').getAttribute('media'),'not all');
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   }
   console.log(`PASS ${name}: Fantasma page fits, doctor remains on page 1, print cleanup preserves data`);
  }finally{await browser.close()}
 }}finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
