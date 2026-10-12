const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const server=require('./local-server.cjs')(path.resolve(__dirname,'..'));
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
 const options={headless:true};
 if(process.env.CHROMIUM_EXECUTABLE_PATH)options.executablePath=process.env.CHROMIUM_EXECUTABLE_PATH;
 if(process.env.LUMEN_CHROMIUM_ARGS)options.args=JSON.parse(process.env.LUMEN_CHROMIUM_ARGS);
 const browser=await chromium.launch(options);
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',r=>r.request().url().startsWith(url)||r.request().url().startsWith('blob:')?r.continue():r.abort());
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  await p.addInitScript(()=>{
   if(localStorage.getItem('test-seeded'))return;localStorage.setItem('test-seeded','1');
   localStorage.setItem('beltrami_v9_sessione_attiva',JSON.stringify({id:'TEST',data:'2026-10-12',stato:'PREPARAZIONE',committente:'CLIENTE PRECEDENTE',sede:'SEDE PRECEDENTE'}));
   localStorage.setItem('beltrami_workers_v8',JSON.stringify({workers:Array.from({length:14},(_,i)=>({id:'test-'+i,cognome:'COLLAUDO '+(i+1),nome:'LAVORATORE FITTIZIO',datore_lavoro:i%2?'BETA SRL':'ALFA SRL',mansione:i%2?'OPERATORE DI PRODUZIONE':'BARISTA',orario:'09:30',visited:false})),currentWorkerIndex:-1,attachedSourceName:'lista-collaudo.xlsx'}));
  });
  await p.goto(url);await p.getByRole('button',{name:'MODIFICA SESSIONE',exact:true}).click();
  await p.locator('#v9Committente').fill('SERMOLAB COLLAUDO');await p.locator('#v9Sede').fill('SEDE FITTIZIA');await p.locator('#v9Email').fill('collaudo@example.test');await p.locator('#v9IndirizzoSede').fill('VIA FITTIZIA 10');
  await p.reload();assert.equal(await p.locator('#v9Committente').inputValue(),'SERMOLAB COLLAUDO');
  await p.evaluate(()=>{window.parentPrintCount=0;window.print=()=>{window.parentPrintCount++}});
  const popupPromise=p.waitForEvent('popup');await p.locator('#v9Esporta').click();const report=await popupPromise;await report.waitForLoadState();
  assert.equal(await report.locator('#cartellaForm').count(),0);assert.equal(await report.locator('tbody tr').count(),14);
  assert.match(await report.locator('body').innerText(),/SERMOLAB COLLAUDO/);assert.match(await report.locator('body').innerText(),/SEDE FITTIZIA/);
  for(const cell of await report.locator('tbody tr td:nth-child(7),tbody tr td:nth-child(8)').all())assert.equal(await cell.innerText(),'');
  await report.evaluate(()=>{window.reportPrintCount=0;window.print=()=>{window.reportPrintCount++}});await report.getByRole('button',{name:'STAMPA / SALVA PDF'}).click();assert.equal(await report.evaluate(()=>window.reportPrintCount),1);assert.equal(await p.evaluate(()=>window.parentPrintCount),0);
  fs.mkdirSync(path.resolve(__dirname,'../tmp'),{recursive:true});
  await report.emulateMedia({media:'print'});await report.setViewportSize({width:1122,height:794});
  await report.pdf({path:path.resolve(__dirname,'../tmp/lista-collaudo.pdf'),preferCSSPageSize:true,printBackground:true});
  await report.screenshot({path:path.resolve(__dirname,'../tmp/lista-collaudo.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS: Chromium mobile 390px, 14 workers, live session persists after reload, separate report window, print button targets report, blank Esito/Note, A4 landscape PDF.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
