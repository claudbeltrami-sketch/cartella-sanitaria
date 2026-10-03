const assert=require('node:assert/strict');
const {predict}=require('../spirometria-percentuali.js');
// Synthetic dates reproduce the two numerical checks without storing identities.
const male={sesso:'M',altezza:'175',data_nascita:'1951-01-01',data_giudizio:'2026-10-03',spirometria_fvc:'2,86',spirometria_fev1:'2,76',spirometria_pef:'6,52'};
const female={sesso:'F',altezza:'156',data_nascita:'1973-01-01',data_giudizio:'2026-10-03',spirometria_fvc:'2.87',spirometria_fev1:'2.57',spirometria_pef:'3.83'};
assert.ok(Math.abs(predict('M',175,'1951-01-01','2026-10-03').predicted.fvc-3.79)<1e-10);
assert.ok(Math.abs(predict('F',156,'1973-01-01','2026-10-03').predicted.fvc-2.6428)<1e-10);
assert.equal(predict('F',156,'1973-10-04','2026-10-03').age,52);
assert.equal(predict('F',156,'2006-01-01','2026-10-03').ageUsed,25);
assert.ok(predict('M',175,'1980-02-30','2026-10-03').error);
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),server=require('./local-server.cjs')(root);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const origin=`http://127.0.0.1:${server.address().port}`;
   await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
   await page.goto(origin);await page.waitForFunction(()=>window.lumenBatchCertApi&&window.lumenSpirometriaPercentuali);
   const apply=d=>page.evaluate(d=>window.lumenBatchCertApi.apply(d),d);
   const pct=()=>page.evaluate(()=>['fvc','fev1','pef'].map(k=>document.getElementById('spirometria_'+k+'_percentuale').value));
   await apply(male);assert.deepEqual(await pct(),['75','97','85']);
   assert.match(await page.locator('#spirometria_calcolo_nota').textContent(),/ESTRAPOLAZIONE/);
   await apply(female);assert.deepEqual(await pct(),['109','115','65']);
   await page.locator('#spirometria_fvc_percentuale').fill('101');
   await page.locator('#altezza').fill('160');assert.equal((await pct())[0],'101');
   const saved=await page.evaluate(()=>window.lumenBatchCertApi.collect());
   await apply(male);await apply(saved);assert.equal((await pct())[0],'101');
   assert.equal(await page.locator('#spirometria_fvc_percentuale').getAttribute('data-percent-origin'),'manual');
   const oldFev=(await pct())[1];await page.locator('#altezza').fill('170');assert.notEqual((await pct())[1],oldFev);
   await apply({...male,spirometria_fvc_percentuale:'75',spirometria_fev1_percentuale:'96',spirometria_pef_percentuale:'85',firma_lavoratore_png:'FIRMA-SINTETICA'});
   await page.locator('#altezza').fill('180');assert.deepEqual(await pct(),['75','96','85']);
   assert.equal(await page.evaluate(()=>window.lumenBatchCertApi.collect().firma_lavoratore_png),'FIRMA-SINTETICA');
   await page.locator('#spirometria_ricalcola').click();assert.notDeepEqual(await pct(),['75','96','85']);
   await apply(female);await page.locator('#spirometria_fvc').fill('2,,87');assert.equal((await pct())[0],'');
   assert.equal(await page.locator('#spirometria_rapporto').inputValue(),'');
   await apply(female);await page.locator('#altezza').fill('243.8');assert.deepEqual(await pct(),['','','']);
   await apply({...female,data_nascita:'2010-01-01'});assert.deepEqual(await pct(),['','','']);
   await apply({...female,spirometria_pef:'229.8'});assert.equal(await page.locator('#spirometria_pef_unita').inputValue(),'L/min');assert.equal((await pct())[2],'65');
   await page.locator('#spirometria_pef_unita').selectOption('L/s');await page.locator('#spirometria_pef').fill('3.83');assert.equal((await pct())[2],'65');
   await apply({...female,data_giudizio:'2020-01-01'});assert.notDeepEqual(await pct(),['109','115','65']);
   await apply({});assert.deepEqual(await pct(),['','','']);assert.equal(await page.locator('#spirometria_calcolo_nota').isVisible(),false);
   await apply(female);const before=await page.evaluate(()=>JSON.stringify(window.lumenBatchCertApi.collect()));
   await page.evaluate(()=>{document.body.className='print-cartella';window.dispatchEvent(new Event('beforeprint'))});
   assert.match(await page.locator('#spirometria_calcolo_nota').textContent(),/ERS\/ECSC/);
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   assert.equal(await page.evaluate(()=>JSON.stringify(window.lumenBatchCertApi.collect())),before);
   assert.deepEqual(errors,[]);console.log('PASS '+name+': equations, historical/manual preservation, saved metadata, dates, invalid/missing data, reset, units and print lifecycle');
  }finally{await browser.close()}
 }}finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
