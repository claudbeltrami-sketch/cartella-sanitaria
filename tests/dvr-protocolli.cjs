const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');const fs=require('node:fs');
const server=require('./local-server.cjs')(path.resolve(__dirname,'..'));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
for(const engine of (process.env.LUMEN_QA_CHROMIUM?[chromium]:[chromium,webkit])){const browser=await engine.launch(process.env.LUMEN_QA_CHROMIUM?{executablePath:process.env.LUMEN_QA_CHROMIUM,args:JSON.parse(process.env.LUMEN_QA_ARGS||'[]')}:{});try{
const page=await browser.newPage();const origin=`http://127.0.0.1:${server.address().port}`;const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
await page.goto(origin+'/?prova=fantasma');await page.waitForFunction(()=>window.lumenBatchCertApi&&document.getElementById('lumenDvrPanel'));
await page.locator('#datore_lavoro').fill('AZIENDA PROVA');await page.locator('#sede_lavoro').fill('SEDE A');await page.locator('#mansione').fill('MANSIONE A');
await page.waitForTimeout(900);
const before=await page.evaluate(()=>JSON.stringify(window.lumenBatchCertApi.collect()));
page.on('dialog',d=>d.accept());
await page.locator('[data-add]').click();await page.locator('[data-file]').setInputFiles({name:'DVR_PROVA.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nPROVA DVR\n%%EOF')});
await page.getByRole('button',{name:'APRI DVR · DVR_PROVA.pdf',exact:true}).waitFor();
await page.locator('[data-protocol]').click();await page.locator('[data-file]').setInputFiles({name:'PROTOCOLLO_PROVA.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nPROVA PROTOCOLLO\n%%EOF')});
await page.getByRole('button',{name:'APRI PROTOCOLLO · PROTOCOLLO_PROVA.pdf',exact:true}).waitFor();
assert.equal(await page.evaluate(()=>JSON.stringify(window.lumenBatchCertApi.collect())),before);
await page.locator('#mansione').fill('MANSIONE B');await page.waitForTimeout(900);assert.equal(await page.locator('[data-list] button').count(),1);
await page.locator('#sede_lavoro').fill('SEDE B');await page.waitForTimeout(900);assert.equal(await page.locator('[data-list] button').count(),0);
await page.locator('#sede_lavoro').fill('SEDE A');await page.locator('#mansione').fill('MANSIONE A');await page.waitForTimeout(900);
fs.mkdirSync(path.join(__dirname,'../tmp/dvr-protocolli'),{recursive:true});await page.locator('#lumenDvrPanel').screenshot({path:path.join(__dirname,'../tmp/dvr-protocolli/schermo.png')});
await page.evaluate(()=>{document.body.className='print-cartella';window.dispatchEvent(new Event('beforeprint'));});await page.emulateMedia({media:'print'});assert.equal(await page.locator('#lumenDvrPanel').isVisible(),false);if(engine===chromium){const pdf=path.join(__dirname,'../tmp/dvr-protocolli/cartella.pdf');await page.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});const text=require('node:child_process').execFileSync('pdftotext',[pdf,'-'],{encoding:'utf8'});assert.ok(!/DVR_PROVA|PROTOCOLLO_PROVA|DVR e protocollo|BACKUP DOCUMENTI|ASSOCIA DVR/.test(text));}
await page.emulateMedia({media:'screen'});await page.evaluate(()=>{window.dispatchEvent(new Event('afterprint'));document.body.className='';});
const dl=page.waitForEvent('download');await page.locator('[data-export]').click();const download=await dl;const packet=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(packet.documents.length,2);assert.equal(packet.lumen_prova,true);
await page.reload();await page.locator('#datore_lavoro').fill('AZIENDA PROVA');await page.locator('#sede_lavoro').fill('SEDE A');await page.locator('#mansione').fill('MANSIONE A');await page.waitForTimeout(1000);assert.equal(await page.locator('[data-list] button').count(),2);
await page.locator('[data-backup]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});await page.waitForTimeout(500);assert.equal(await page.locator('[data-list] button').count(),2);
assert.deepEqual(errors,[]);console.log(engine.name()+': matching, offline persistence, backup, print exclusion, clinical data unchanged OK');
}finally{await browser.close();}}
}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
