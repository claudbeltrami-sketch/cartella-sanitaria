const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),server=require('./local-server.cjs')(root);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port+'/';
 try{
  for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
   if(name==='webkit'&&process.env.CHROMIUM_ONLY)continue;
   const browser=await engine.launch({headless:true,...(name==='chromium'&&process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
   try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await ctx.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
    const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(url);
    const before=await p.evaluate(async()=>{
     for(let n=1;n<=24;n++)await lumenBatchCertApi.saveToLocalArchive({cognome:'COLLAUDO '+String(n).padStart(2,'0'),nome:'FITTIZIO',codice_fiscale:'TEST'+String(n).padStart(12,'0'),data_nascita:'1980-01-01',datore_lavoro:n<=6?'SERMOLAB CBV':'ALTRA AZIENDA',mansione:'COLLAUDO',data_giudizio:'2026-09-30',giudizio:'IDONEO'});
     return JSON.stringify(await lumenArchiveVisitsApi.list());
    });
    await p.locator('#btnArchivioCartelle').click();await p.locator('#archiveQuery').fill('CBV');await p.locator('#btnCercaArchivio').click();
    await p.waitForFunction(()=>document.getElementById('archiveSummary').textContent.includes('Cartelle trovate: 6'));
    await p.locator('#btnElencoVisiteArchivio').click();await p.locator('#visiteArchiveDate').fill('2026-09-30');await p.locator('#visiteArchiveLoad').click();
    await p.waitForFunction(()=>document.getElementById('visiteArchiveMessage').textContent==='6 VISITE TROVATE — 6 SELEZIONATE');
    assert.equal(await p.locator('#visiteArchiveRows tbody tr').count(),6);
    assert.match(await p.locator('#visiteArchiveFilter').innerText(),/FILTRO ARCHIVIO: CBV/);
    const b=await p.locator('#visiteArchiveDialog').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=390);
    fs.mkdirSync(path.join(root,'tmp'),{recursive:true});await p.screenshot({path:path.join(root,'tmp/filtro-'+name+'.png')});
    await p.locator('#visiteArchiveClose').click();await p.locator('#archiveQuery').fill('INESISTENTE');await p.locator('#btnCercaArchivio').click();
    await p.waitForFunction(()=>document.getElementById('archiveSummary').textContent.includes('Cartelle trovate: 0'));
    await p.locator('#btnElencoVisiteArchivio').click();
    await p.waitForFunction(()=>document.getElementById('visiteArchiveMessage').textContent==='0 VISITE TROVATE — 0 SELEZIONATE');
    assert.equal(await p.locator('#visiteArchivePdf').isDisabled(),true);
    await p.locator('#visiteArchiveClose').click();await p.locator('#btnTutteArchivio').click();
    await p.waitForFunction(()=>document.getElementById('archiveSummary').textContent==='Cartelle trovate: 24');
    await p.locator('#btnElencoVisiteArchivio').click();await p.waitForFunction(()=>document.getElementById('visiteArchiveMessage').textContent==='24 VISITE TROVATE — 24 SELEZIONATE');
    assert.equal(await p.evaluate(async()=>JSON.stringify(await lumenArchiveVisitsApi.list())),before);assert.deepEqual(errors,[]);
    console.log('PASS '+name+': mobile UI 390px, CBV 6/24, active filter shown, empty search, reset to 24, selected date retained, archive unchanged.');
   }finally{await browser.close()}
  }
 }finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
