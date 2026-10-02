// Browser integration. Synthetic charts only; optional private ZIP stays outside the repo.
// LUMEN_TEST_ASSETS=/path/to/cached/cdn/files LUMEN_BROWSER_EXECUTABLE=/path/to/chrome node tests/importa-cartelle-browser.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),assets=process.env.LUMEN_TEST_ASSETS||path.join(root,'vendor');
async function setup(browser){
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1000,height:800}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());let file;
  if(url.origin==='https://lumen.test')file=path.join(root,url.pathname==='/'?'index.html':url.pathname);
  else file=path.join(assets,path.basename(url.pathname));
  if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file,contentType:file.endsWith('.html')?'text/html':'text/javascript'});
  return route.abort();
 });
 await page.goto('https://lumen.test/',{waitUntil:'load'});
 await page.waitForFunction(()=>window.lumenImportCartelle&&window.JSZip);
 return {page,context,errors};
}
async function seed(page,n,overrides={}){
 return page.evaluate(({n,overrides})=>{
  const d=window.lumenBatchCertApi.collect();Object.assign(d,{cognome:'COLLAUDO',nome:'SINTETICO',data_nascita:'1980-01-'+String(n).padStart(2,'0'),luogo_nascita:'ROMA',sesso:'M',codice_fiscale:'',cf_comune:'',cf_codice_catastale:'',data_cartella:'2026-06-08',data_dichiarazione:'2026-06-08',data_giudizio:'2026-06-08',datore_lavoro:'AZIENDA FITTIZIA',mansione:'IMPIEGATO',giudizio:'IDONEO',rischi:['VDT'],protocollo:['VISITA MEDICA'],firma_lavoratore_png:'',...overrides});
  return window.lumenImportCartelle.validate(d);
 },{n,overrides});
}
const read=page=>page.evaluate(()=>window.lumenImportCartelle.readRecords());
async function importDirect(page,charts){return page.evaluate(async charts=>{const a=window.lumenImportCartelle,before=await a.readRecords();return a.commit(charts.map(data=>({name:'CARTELLA_TEST.json',data:a.validate(data)})),a.fingerprint(before),new Date().toISOString())},charts)}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.LUMEN_BROWSER_EXECUTABLE?{executablePath:process.env.LUMEN_BROWSER_EXECUTABLE}:{})});
 try{
  const p=await setup(browser),page=p.page;
  try{
   const unrelated=await seed(page,28,{nome:'ESTERNO',farmaci:'DATO PREESISTENTE',firma_lavoratore_png:'data:image/png;base64,AAAA'});
   await page.evaluate(d=>window.lumenBatchCertApi.saveToLocalArchive(d),unrelated);
   const previous=(await read(page))[0];
   await page.evaluate(()=>{localStorage.setItem('beltrami_test_keep','UNCHANGED');document.getElementById('farmaci').value='BOZZA NON SALVATA'});
   const draft=await page.evaluate(()=>window.lumenBatchCertApi.collect());
   const charts=[];for(let n=1;n<=9;n++)charts.push(await seed(page,n));
   const zip=await page.evaluate(async charts=>{const z=new JSZip();charts.forEach((d,i)=>z.file('01_CARTELLE_PRONTE/CARTELLA_TEST_'+i+'.json',JSON.stringify(d)));z.file('VERIFICHE/invalid.json','not chart JSON');z.file('LEGGIMI.txt','Test sintetico');return z.generateAsync({type:'base64'})},charts);
   await page.locator('#fileImportaCartelle').setInputFiles({name:'pacchetto.zip',mimeType:'application/zip',buffer:Buffer.from(zip,'base64')});
   await page.waitForFunction(()=>!document.getElementById('chartImportConfirm').hidden);
   assert.match(await page.locator('#chartImportMessage').innerText(),/9 DA IMPORTARE/);
   assert.equal((await read(page)).length,1,'preview must not write');
   await page.locator('#chartImportConfirm').click();
   await page.waitForFunction(()=>document.getElementById('chartImportMessage').textContent.startsWith('IMPORTAZIONE COMPLETATA'));
   let records=await read(page);assert.equal(records.length,10);assert.deepEqual(records.find(r=>r.id===previous.id),previous);
   assert.deepEqual(await page.evaluate(()=>window.lumenBatchCertApi.collect()),draft);
   assert.equal(await page.evaluate(()=>localStorage.getItem('beltrami_test_keep')),'UNCHANGED');
   for(const chart of charts)assert.deepEqual(records.find(r=>r.cf===chart.codice_fiscale).data,chart);
   console.log('PASS: ZIP UI preview, 9 saves, exact data, draft, unrelated record/signature/settings preserved');
   const before=JSON.stringify(records),repeat=await importDirect(page,charts);
   assert.equal(repeat.added,0);assert.equal(repeat.duplicates,9);assert.equal(JSON.stringify(await read(page)),before);
   const conflict=await importDirect(page,[{...charts[0],farmaci:'DATO DIVERSO'}]);assert.equal(conflict.conflicts,1);assert.equal(JSON.stringify(await read(page)),before);
   const badIdentity=await importDirect(page,[{...charts[0],nome:'ALTRA PERSONA'}]);assert.equal(badIdentity.conflicts,1);
   console.log('PASS: reimport idempotent; different same-date data and conflicting identity do not overwrite');
   const inPackage=await page.evaluate(charts=>window.lumenImportCartelle.plan([{data:charts[0]},{data:{...charts[0],farmaci:'CONFLITTO'}}],[],new Date().toISOString()),charts);
   assert.equal(inPackage.added,0);assert.equal(inPackage.conflicts,2);assert.equal(inPackage.records.length,0);
   await importDirect(page,[{...charts[0],data_cartella:'2025-01-02',data_giudizio:'2025-01-02',farmaci:'STORICO'}]);
   let person=(await read(page)).find(r=>r.cf===charts[0].codice_fiscale);assert.deepEqual(person.data,charts[0]);assert.equal(person.history[0].data.farmaci,'STORICO');
   await importDirect(page,[{...charts[0],data_cartella:'2026-09-30',data_giudizio:'2026-09-30',farmaci:'NUOVA'}]);
   person=(await read(page)).find(r=>r.cf===charts[0].codice_fiscale);assert.equal(person.data.farmaci,'NUOVA');assert.equal(person.history.length,2);assert.deepEqual(person.history[1].data,charts[0]);
   const complete=JSON.stringify(await read(page));
   await page.reload({waitUntil:'load'});assert.equal(JSON.stringify(await read(page)),complete);
   console.log('PASS: older/newer visits retained, latest view correct, archive persistent across reload');
   const fresh=[await seed(page,20),await seed(page,21)];
   const rollback=await page.evaluate(async charts=>{
    const api=window.lumenImportCartelle,before=await api.readRecords(),put=IDBObjectStore.prototype.put;let calls=0,error='';
    IDBObjectStore.prototype.put=function(...args){if(this.name==='cartelle'&&++calls===2)throw new DOMException('TEST QUOTA','QuotaExceededError');return put.apply(this,args)};
    try{await api.commit(charts.map(data=>({name:'test.json',data})),api.fingerprint(before),new Date().toISOString())}catch(e){error=e.message}finally{IDBObjectStore.prototype.put=put}
    return {error,unchanged:JSON.stringify(await api.readRecords())===JSON.stringify(before)};
   },fresh);assert(rollback.unchanged);assert.match(rollback.error,/TEST QUOTA/);
   const stale=await page.evaluate(async charts=>{
    const api=window.lumenImportCartelle,before=await api.readRecords();await window.lumenBatchCertApi.saveToLocalArchive(charts[0]);
    try{await api.commit([{data:charts[1]}],api.fingerprint(before),new Date().toISOString());return ''}catch(e){return e.message}
   },fresh);assert.match(stale,/ARCHIVIO CAMBIATO/);
   console.log('PASS: transaction rollback on second write failure; stale preview refuses commit');
   await page.locator('#fileImportaCartelle').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([fresh[1],{...fresh[1],codice_fiscale:'',luogo_nascita:'',cf_comune:''}]))});
   await page.waitForFunction(()=>document.getElementById('chartImportMessage').textContent.startsWith('IMPORTAZIONE NON AVVIATA'));
   assert.match(await page.locator('#chartImportMessage').innerText(),/CF assente/);assert(!(await read(page)).some(r=>r.cf===fresh[1].codice_fiscale));
   await page.locator('#chartImportClose').click();
   await page.locator('#fileImportaCartelle').setInputFiles({name:'auto.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...fresh[1],codice_fiscale:''}))});
   await page.waitForFunction(()=>!document.getElementById('chartImportConfirm').hidden);
   assert.match(await page.locator('#chartImportList').innerText(),/CALCOLATO/);
   await page.setViewportSize({width:390,height:844});
   assert(await page.locator('#chartImportConfirm').isVisible());
   assert(await page.locator('#chartImportClose').isVisible());
   if(process.env.LUMEN_TEST_SCREENSHOT)await page.screenshot({path:process.env.LUMEN_TEST_SCREENSHOT});
   await page.locator('#chartImportConfirm').click();await page.waitForFunction(()=>document.getElementById('chartImportMessage').textContent.startsWith('IMPORTAZIONE COMPLETATA'));
   assert((await read(page)).some(r=>r.cf===fresh[1].codice_fiscale));
   assert.deepEqual(p.errors,[]);console.log('PASS: invalid batch makes no writes; missing CF calculated with complete birth data; mobile dialog usable');
  }finally{await p.context.close()}
  if(process.env.LUMEN_IMPORT_ZIP){
   const real=await setup(browser);
   try{
    await real.page.locator('#fileImportaCartelle').setInputFiles(process.env.LUMEN_IMPORT_ZIP);
    await real.page.waitForFunction(()=>!document.getElementById('chartImportClose').disabled);
    const summary=await real.page.locator('#chartImportMessage').innerText();assert.match(summary,/9 DA IMPORTARE/);
    await real.page.locator('#chartImportConfirm').click();await real.page.waitForFunction(()=>document.getElementById('chartImportMessage').textContent.startsWith('IMPORTAZIONE COMPLETATA'));
    assert.equal((await read(real.page)).length,9);await real.page.reload({waitUntil:'load'});assert.equal((await read(real.page)).length,9);
    await real.page.locator('#fileImportaCartelle').setInputFiles(process.env.LUMEN_IMPORT_ZIP);await real.page.waitForFunction(()=>!document.getElementById('chartImportClose').disabled);
    assert.match(await real.page.locator('#chartImportMessage').innerText(),/0 DA IMPORTARE · 9 GIÀ PRESENTI/);
    assert.deepEqual(real.errors,[]);console.log('PASS: supplied private 9-chart ZIP, persistence, reimport 9 duplicates, no network egress');
   }finally{await real.context.close()}
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
