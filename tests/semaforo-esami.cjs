const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf(' function semaforoEsami('),html.indexOf(' function updateSemaforo('));
const semaforo=vm.runInNewContext(source+';semaforoEsami');
const rec=protocollo=>({data:{protocollo}}),both=rec(['ANALISI EMATOCHIMICHE','ESAMI TOSSICOLOGICI']);
const state=(r,a,d)=>semaforo(r,{analisi:a,drug:d}).state;
assert.equal(state(both,'SÌ','SÌ'),'green');
assert.equal(state(both,'SÌ','NO'),'yellow');
assert.equal(state(both,'NO','NO'),'red');
assert.equal(state(both,'DA VERIFICARE','NO'),'yellow');
assert.equal(state(rec(['VISITA MEDICA']),'NO','NO'),'white');
assert.equal(state(rec(['ANALISI EMATOCHIMICHE']),'SÌ','NO'),'green');
assert.equal(state(rec(['ESAMI TOSSICOLOGICI']),'NO','SÌ'),'green');
assert.equal(state(rec([]),'NO','NO'),'yellow');
assert.equal(state({data:{}},'NO','NO'),'yellow');
assert.equal(state({data:{protocollo:both.data.protocollo,altri_accertamenti:'no drug test'}},'NO','NO'),'yellow');
assert.equal(semaforo(both,{analisi:'SÌ',drug:'SÌ',error:true}).state,'yellow');
assert.equal(semaforo(both,{analisi:'NO',drug:'NO'},{iphone:true}).text,'DA VERIFICARE SUL MAC');
assert.equal(semaforo(both,{analisi:'SÌ',drug:'SÌ'},{iphone:true,local:{}}).state,'green');
assert.equal(semaforo(both,{analisi:'SÌ',drug:'SÌ'},{iphone:true,local:{analisi:true,drug:true}}).state,'green');
assert.equal(semaforo(rec(['VISITA MEDICA']),{analisi:'NO',drug:'NO'},{iphone:true}).state,'white');
for(const data of [{},{protocollo:[]},{protocollo:['VISITA MEDICA'],altri_accertamenti:'DRUG TEST REFERTO ALLEGATO'}]){
 assert.equal(semaforo({data},{analisi:'SÌ',drug:'SÌ'}).state,'green','both recognized reports cover both categories despite incomplete historical protocol');
 assert.equal(semaforo({data},{analisi:'SÌ',drug:'DA VERIFICARE'}).state,'yellow','uncertain evidence still needs review');
}
const before=JSON.stringify(both);state(both,'NO','NO');assert.equal(JSON.stringify(both),before);
for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
console.log('PASS: all four lights; partial/uncertain; only required exams; undefined/custom protocols; read failure; no record mutations; inline script syntax.');
const {app}=require('./allegati-dom.cjs');
(async()=>{
 const p=await app();
 try{
  await p.api.saveToLocalArchive({cognome:'TEST',nome:'SEMAFORO',codice_fiscale:'TESTSEMAFORO',data_giudizio:'2026-10-31',protocollo:['ANALISI EMATOCHIMICHE']});
  const before=JSON.stringify(await p.t.cartelle());
  await p.t.renderArchive('TESTSEMAFORO');await new Promise(r=>setTimeout(r,10));
  const tr=p.$('archiveResults').querySelector('tbody tr'),badge=tr.querySelector('.archive-semaforo');
  assert.equal(badge.dataset.light,'red');assert.match(badge.textContent,/MANCANTI/);
  const flag=tr.querySelector('[data-referto="analisi"] .archive-referto');flag.dataset.state='SÌ';flag.textContent='SÌ';
  await new Promise(r=>setTimeout(r,10));assert.equal(badge.dataset.light,'green');assert.equal(tr.querySelectorAll('.archive-semaforo').length,1);
  Object.defineProperty(p.w.navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'});
  await p.t.renderArchive('TESTSEMAFORO');await new Promise(r=>setTimeout(r,10));
  const phone=p.$('archiveResults').querySelector('.archive-semaforo');assert.equal(phone.dataset.light,'yellow');assert.match(phone.textContent,/DA VERIFICARE SUL MAC/);
  assert.equal(JSON.stringify(await p.t.cartelle()),before);assert.deepEqual(p.errors,[]);
  console.log('PASS: archive DOM light visible; updates after verification; no observer loop/duplicates; records preserved.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

for(const [custom,a,d,expected] of [
 ['Analisi ematochimiche','SÌ','NO','green'],
 ['Visita e VDT; drug test','NO','SÌ','green'],
 ['Esami ematochimici e drug test','SÌ','NO','yellow'],
 ['Analisi ematochimiche','NO','NO','red'],
 ['No drug test','NO','SÌ','yellow'],
 ['Drug test non previsto','NO','SÌ','yellow'],
 ['Drug test da valutare','NO','SÌ','yellow'],
 ['Analisi ematochimiche ed ECG','SÌ','NO','yellow']
]) assert.equal(state({data:{altri_accertamenti:custom}},a,d),expected,custom);
console.log('PASS: explicit historical laboratory prescriptions, missing reports, negation and ambiguous custom tests.');

for(const [protocollo,custom,a,d,expected] of [
 [['VISITA MEDICA','VISIOTEST'],'PROTOCOLLO TRASCRITTO: VISITA MEDICA: BIENNALE; VISIOTEST: BIENNALE.','NO','NO','white'],
 [['VISITA MEDICA','ESAMI TOSSICOLOGICI'],'PROTOCOLLO TRASCRITTO: VISITA MEDICA: ANNUALE; DRUG: ANNUALE. DICITURA MANOSCRITTA CONSERVATA SOPRA; VOCE ESAMI TOSSICOLOGICI USATA COME DESTINAZIONE.','NO','SÌ','green'],
 [['VISITA MEDICA','ESAMI TOSSICOLOGICI'],'PROTOCOLLO TRASCRITTO: VISITA MEDICA: ANNUALE; DRUG: ANNUALE. DICITURA MANOSCRITTA CONSERVATA SOPRA; VOCE ESAMI TOSSICOLOGICI USATA COME DESTINAZIONE.','NO','NO','red'],
 [['VISITA MEDICA'],'PROTOCOLLO TRASCRITTO: VISITA MEDICA: ANNUALE; DRUG: ANNUALE.','NO','SÌ','yellow'],
 [['VISITA MEDICA'],'PROTOCOLLO TRASCRITTO: VISITA MEDICA: ANNUALE. ALTRO DA VALUTARE','NO','NO','yellow'],
 [['VISITA MEDICA','ANALISI EMATOCHIMICHE'],'PROTOCOLLO TRASCRITTO: VISITA MEDICA: ANNUALE.','SÌ','NO','yellow'],
 [['VISITA MEDICA'],'PROTOCOLLO TRASCRITTO: VISITA MEDICA: NON SEGNATA.','NO','NO','white']
]) assert.equal(state({data:{protocollo,altri_accertamenti:custom}},a,d),expected);
console.log('PASS: historical transcript template matches structured prescription; incomplete, conflicting and unknown notes stay uncertain.');

const ecgPlan=['VISITA MEDICA','ELETTROCARDIOGRAMMA','ESAME FUNZIONALE DEL RACHIDE'];
for(const note of ['ECG NEI LIMITI','ECG: nei limiti.','ELETTROCARDIOGRAMMA NELLA NORMA']){
 const data={protocollo:ecgPlan,altri_accertamenti:note},before=JSON.stringify(data);
 assert.equal(state({data},'NO','NO'),'white','recorded ECG does not require a laboratory attachment');
 assert.equal(JSON.stringify(data),before);
 assert.equal(state({data:{...data,protocollo:[...ecgPlan,'ANALISI EMATOCHIMICHE']}},'NO','NO'),'red','missing prescribed labs remain missing');
 assert.equal(state({data:{...data,protocollo:[...ecgPlan,'ESAMI TOSSICOLOGICI']}},'NO','NO'),'red','missing drug reports remain missing');
}
for(const [protocollo,note] of [[['VISITA MEDICA'],'ECG NEI LIMITI'],[ecgPlan,'ECG NEI LIMITI; ALTRO DA VALUTARE'],[ecgPlan,'ECG DA ESEGUIRE']]){
 assert.equal(state({data:{protocollo,altri_accertamenti:note}},'NO','NO'),'yellow','conflicting or ambiguous notes still require review');
}
console.log('PASS: recorded ECG outcome, no separate lab requirement, missing labs/drug and ambiguous notes preserved.');
