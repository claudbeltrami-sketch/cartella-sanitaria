// Regression: Fantasma intentionally has a blank, locked birth date.
// Its spirometry needs an explicit simulation age, without changing identity.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const server=require('./local-server.cjs')(path.resolve(__dirname,'..'));
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 try{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   const context=await browser.newContext({viewport:{width:390,height:844}}),errors=[];
   await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
   const normal=await context.newPage();
   await normal.goto(origin);await normal.waitForFunction(()=>window.lumenBatchCertApi);
   await normal.evaluate(async()=>{
    lumenBatchCertApi.apply({cognome:'SINTETICO',nome:'CONTROLLO',codice_fiscale:'TEST_SPIRO',data_giudizio:'2026-10-03'});
    await lumenBatchCertApi.saveToLocalArchive();
   });
   const before=await normal.evaluate(async()=>({local:{...localStorage},record:await lumenBatchCertApi.getCartellaRecord(lumenBatchCertApi.cartellaId({codice_fiscale:'TEST_SPIRO'}))}));
   const ghost=await context.newPage();ghost.on('pageerror',e=>errors.push(e.message));
   await ghost.goto(origin+'/?prova=fantasma');
   await ghost.waitForFunction(()=>document.getElementById('nome').value==='FANTASMA');
   await ghost.locator('#sesso').selectOption('M');await ghost.locator('#altezza').fill('175');
   for(const [k,v] of [['fvc','2,86'],['fev1','2,76'],['pef','6,52']])await ghost.locator('#spirometria_'+k).fill(v);
   await ghost.locator('#spirometria_ricalcola').click();
   const pct=()=>ghost.evaluate(()=>['fvc','fev1','pef'].map(k=>document.getElementById('spirometria_'+k+'_percentuale').value));
   assert.deepEqual(await pct(),['','','']);
   assert.match(await ghost.locator('#spirometria_calcolo_nota').textContent(),/ETÀ DI PROVA/,'The blocked calculation must explain the missing simulation age');
   await ghost.locator('#spirometria_eta_prova').fill('75');
   assert.deepEqual(await pct(),['75','97','85']);
   assert.match(await ghost.locator('#spirometria_calcolo_nota').textContent(),/SIMULAZIONE/);
   assert.equal(await ghost.locator('#spirometryCharts').isVisible(),true);
   assert.equal(await ghost.locator('#data_nascita').inputValue(),'');
   assert.equal(await ghost.locator('#data_nascita').getAttribute('readonly'),'');
   await ghost.locator('#spirometria_fev1_percentuale').fill('96');
   await ghost.locator('#spirometria_eta_prova').fill('74');assert.equal((await pct())[1],'96');
   await ghost.locator('#spirometria_eta_prova').fill('75');
   await ghost.locator('#spirometria_ricalcola').click();assert.deepEqual(await pct(),['75','97','85']);
   await ghost.locator('#btnSalva').click();
   await ghost.waitForFunction(async()=>{const a=lumenBatchCertApi;return (await a.getCartellaRecord(a.cartellaId(a.collect())))?.data.spirometria_eta_prova==='75'});
   await ghost.reload();await ghost.waitForFunction(()=>document.getElementById('spirometria_eta_prova')?.value==='75');
   assert.deepEqual(await pct(),['75','97','85']);
   const data=await ghost.evaluate(()=>lumenBatchCertApi.collect());
   assert.equal(data.data_nascita,'');assert.equal(data.codice_fiscale,'');assert.equal(data.nome,'FANTASMA');assert.equal(data.lumen_prova,true);
   await ghost.locator('#spirometria_eta_prova').fill('');assert.deepEqual(await pct(),['','','']);
   for(const age of ['17','101','75.5']){await ghost.locator('#spirometria_eta_prova').fill(age);assert.deepEqual(await pct(),['','','']);}
   await ghost.locator('#spirometria_eta_prova').fill('75');assert.deepEqual(await pct(),['75','97','85']);
   const after=await normal.evaluate(async()=>({local:{...localStorage},record:await lumenBatchCertApi.getCartellaRecord(lumenBatchCertApi.cartellaId({codice_fiscale:'TEST_SPIRO'}))}));
   for(const k of Object.keys(after.local))if(k.startsWith('lumen_prova_fantasma_v1:'))delete after.local[k];
   assert.deepEqual(after,before,'Simulation must not change normal storage');
   await normal.evaluate(()=>lumenBatchCertApi.apply({sesso:'M',altezza:'175',spirometria_eta_prova:'75',spirometria_fvc:'2.86',spirometria_fev1:'2.76',spirometria_pef:'6.52'}));
   assert.equal(await normal.locator('#spirometria_eta_prova').isVisible(),false);
   assert.equal(await normal.locator('#spirometria_fvc_percentuale').inputValue(),'','Simulation age cannot bypass missing birth date in real records');
   assert.match(await normal.locator('#spirometria_calcolo_nota').textContent(),/DATA DI NASCITA/);
   await normal.locator('#spirometria_ricalcola').click();
   assert.match(await normal.locator('#spirometria_calcolo_nota').textContent(),/CALCOLO NON ESEGUITO/);
   assert.deepEqual(errors,[]);
   console.log('PASS '+name+': Fantasma age, button, manual override, save/reload, validation, locked identity and storage isolation');
  }finally{await browser.close()}
 }}finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
