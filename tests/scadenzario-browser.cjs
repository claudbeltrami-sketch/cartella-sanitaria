const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/scadenzario');fs.mkdirSync(out,{recursive:true});const server=require('./local-server.cjs')(root);
let expected;
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 for(const engine of [chromium,webkit])for(const mobile of [false,true]){
 const name=engine.name()+(mobile?'-mobile':'-desktop'),browser=await engine.launch(engine===webkit?{executablePath:process.env.WEBKIT_EXECUTABLE_PATH}:{});
 try{const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,deviceScaleFactor:mobile?3:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin='http://127.0.0.1:'+server.address().port;await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin);
 await page.evaluate(async()=>{const d={cognome:'PROVA',nome:'SCADENZARIO',codice_fiscale:'TSTLFA80A01H501X',sesso:'M',data_nascita:'1980-01-01',luogo_nascita:'ROMA',committente:'SERMOLAB',datore_lavoro:'AZIENDA FITTIZIA',mansione:'IMPIEGATO',data_cartella:'2026-10-13',data_giudizio:'2026-10-13',giudizio:'IDONEO',periodicita:'ANNUALE',prossima_visita:'2027-10-13',luogo_visita:'SERMONETA'};
 await window.lumenBatchCertApi.saveToLocalArchive(d);await window.lumenBatchCertApi.saveToLocalArchive({...d,codice_fiscale:'TESTSECOND',nome:'DA COMPLETARE',prossima_visita:'',periodicita:''});await window.lumenBatchCertApi.saveToLocalArchive({...d,codice_fiscale:'TESTANNUAL',nome:'ANNUALE AUTOMATICO',prossima_visita:'',luogo_visita:''});localStorage.setItem('beltrami_v9_sessioni',JSON.stringify([{data:'2026-10-13',committente:'SERMOLAB',azienda:d.datore_lavoro,sede:'SEDE RECUPERATA',workers:[{...d,codice_fiscale:'TESTANNUAL'}]}]));window.lumenBatchCertApi.apply(d);});
 const form=await page.evaluate(()=>JSON.stringify(window.lumenBatchCertApi.collect()));await page.locator('#btnScadenzario').click();await page.locator('#scRows table').waitFor();assert.match(await page.locator('#scMessage').textContent(),/Da completare: 1/);
 assert.match(await page.locator('#scRows').textContent(),/Calcolata da periodicità: ANNUALE/);assert.match(await page.locator('#scRows').textContent(),/SEDE RECUPERATA/);await page.locator('#scRange').selectOption('missing');assert.equal(await page.locator('#scRows tbody tr').count(),1);
 await page.locator('#scRange').selectOption('all');await page.locator('#scPdf').click();await page.locator('#scLink a').waitFor();
 const annualRow=page.locator('#scRows tbody tr').filter({hasText:'ANNUALE AUTOMATICO'});await annualRow.locator('input[type=date]').fill('2027-04-13');await annualRow.locator('button').click();await page.waitForFunction(()=>document.getElementById('scMessage').textContent.includes('Data salvata per'));
 assert.equal(await annualRow.locator('input[type=date]').inputValue(),'2027-04-13');assert.match(await annualRow.textContent(),/Data esplicita/);
 await page.screenshot({path:path.join(out,name+'.png')});
 await page.locator('#scClose').click();assert.equal(await page.evaluate(()=>JSON.stringify(window.lumenBatchCertApi.collect())),form);
 const bytes=Buffer.from(await page.evaluate(async()=>{window.lumenBatchCertApi.popolaCertificato(undefined,false);return Array.from(new Uint8Array(await(await window.lumenCertificatePdf.current()).arrayBuffer()))}));
 fs.writeFileSync(path.join(out,name+'-certificate.pdf'),bytes);const hash=crypto.createHash('sha256').update(bytes).digest('hex');if(expected)assert.equal(hash,expected);else expected=hash;
 assert.deepEqual(errors,[]);console.log('PASS '+name+': schedule controls/PDF, form preserved, next visit certificate '+hash);
 }finally{await browser.close()}}
 }finally{server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
