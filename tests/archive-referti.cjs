// Full application, synthetic attachments only. No real clinical data.
const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
const day='2026-10-02';
const a={cognome:'OMONIMO',nome:'FITTIZIO',codice_fiscale:'TESTREFERTIA',data_nascita:'1980-01-01',data_giudizio:day};
const b={...a,codice_fiscale:'TESTREFERTIB',data_nascita:'1990-01-01'};
async function put(p,row){const s=p.w.lumenAllegatiStorage,db=await s.open();try{await new Promise((resolve,reject)=>{const tx=db.transaction(s.store,'readwrite');tx.objectStore(s.store).put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}finally{db.close()}}
function attachment(p,id,data=a,extra={}){return {id,kind:'allegato_cartella_v1',workerKey:p.api.cartellaId(data),workerCf:data.codice_fiscale,workerLabel:'OMONIMO FITTIZIO',visit:day,name:'referto.pdf',note:'',blob:new Blob(['PDF FITTIZIO'],{type:'application/pdf'}),...extra}}
async function flags(p,rec){const result=await p.w.lumenArchiveReferti.statuses([rec]);return JSON.parse(JSON.stringify(result.get(rec.id)))}
(async()=>{
 const p=await app();
 try{
  await p.api.saveToLocalArchive({...a,protocollo:['ANALISI EMATOCHIMICHE','ESAMI TOSSICOLOGICI'],altri_accertamenti:'DRUG TEST: REFERTO ALLEGATO'});
  await p.api.saveToLocalArchive(b);const records=await p.t.cartelle(),ra=records.find(r=>r.cf===a.codice_fiscale),rb=records.find(r=>r.cf===b.codice_fiscale);
  const before=JSON.stringify(records);const expected=(analisi,drug)=>({analisi,drug});
  assert.deepEqual(await flags(p,ra),expected('NO','NO'),'protocol selections cannot stand in for attachments');
  await put(p,attachment(p,'old',a,{visit:'2026-09-30',note:'ANALISI SERMOLAB — DRUG TEST PRESENTE'}));
  assert.deepEqual(await flags(p,ra),expected('NO','NO'),'old visit is excluded');
  await put(p,attachment(p,'current',a,{note:'ANALISI SERMOLAB — DRUG TEST PRESENTE'}));
  assert.deepEqual(await flags(p,ra),expected('SÌ','SÌ'));assert.deepEqual(await flags(p,rb),expected('NO','NO'),'homonym is not a match');
  await p.t.renderArchive('OMONIMO');
  const rows=[...p.$('archiveResults').querySelectorAll('tbody tr')];assert.equal(rows.length,2);
  const rowA=rows.find(tr=>tr.textContent.includes(a.codice_fiscale)),rowB=rows.find(tr=>tr.textContent.includes(b.codice_fiscale));
  assert.equal(rowA.querySelector('[data-referto="drug"]').textContent,'SÌ');assert.equal(rowB.querySelector('[data-referto="drug"]').textContent,'NO');
  // Replacing/removing a file is reflected on the next archive render, without a stale cache.
  await put(p,attachment(p,'current',a,{note:'ANALISI SERMOLAB'}));
  await p.t.renderArchive('OMONIMO');assert.deepEqual(await flags(p,ra),expected('SÌ','NO'));
  await put(p,attachment(p,'current',a,{name:'DRUG_TEST_NEGATIVO.pdf'}));
  assert.deepEqual(await flags(p,ra),expected('NO','SÌ'),'negative result still means the report exists');
  await put(p,attachment(p,'current',a,{note:'ANALISI SERMOLAB — DRUG TEST NON PRESENTE'}));
  assert.deepEqual(await flags(p,ra),expected('SÌ','NO'),'absence annotation is not a positive drug marker');
  await put(p,attachment(p,'current',a,{note:'ANALISI TOSSICOLOGICHE'}));assert.deepEqual(await flags(p,ra),expected('NO','SÌ'));
  await put(p,attachment(p,'current',a));assert.deepEqual(await flags(p,ra),expected('DA VERIFICARE','DA VERIFICARE'));
  await put(p,attachment(p,'current',a,{note:'ANALISI SERMOLAB — DRUG TEST PRESENTE',blob:null}));assert.deepEqual(await flags(p,ra),expected('DA VERIFICARE','DA VERIFICARE'));
  await put(p,attachment(p,'current',a,{note:'ANALISI SERMOLAB — DRUG TEST PRESENTE',visit:''}));assert.deepEqual(await flags(p,ra),expected('DA VERIFICARE','DA VERIFICARE'));
  await put(p,attachment(p,'current',a,{note:'ANALISI SERMOLAB — DRUG TEST PRESENTE',workerCf:b.codice_fiscale}));assert.deepEqual(await flags(p,ra),expected('NO','NO'),'conflicting CF is rejected despite key');assert.deepEqual(await flags(p,rb),expected('NO','NO'),'conflicting metadata cannot be moved to the other worker');
  await put(p,attachment(p,'current',a,{note:'ANALISI SERMOLAB',workerKey:'LEGACY_KEY'}));assert.deepEqual(await flags(p,ra),expected('SÌ','NO'),'exact CF supports legacy attachment keys');
  const attachments=await p.t.rows(),snapshot=JSON.stringify(attachments.map(({blob,...r})=>({...r,bytes:blob?.size})));
  const list=p.w.lumenAllegatiStorage.list;p.w.lumenAllegatiStorage.list=async()=>{throw Error('Test read failure')};
  assert.equal((await flags(p,ra)).error,true);await p.t.renderArchive('OMONIMO');assert.match(p.$('archiveResults').textContent,/DA VERIFICARE/);
  p.w.lumenAllegatiStorage.list=list;
  // Slower old searches must not overwrite newer results.
  const real=p.w.lumenArchiveReferti.statuses;let release;
  p.w.lumenArchiveReferti.statuses=async rows=>{if(rows.length===2)await new Promise(r=>release=r);return real(rows)};
  const stale=p.t.renderArchive('OMONIMO');while(!release)await new Promise(r=>setTimeout(r,5));
  await p.t.renderArchive(a.codice_fiscale);release();await stale;
  assert.equal(p.$('archiveResults').querySelectorAll('tbody tr').length,1);assert.match(p.$('archiveResults').textContent,/TESTREFERTIA/);
  assert.equal(JSON.stringify(await p.t.cartelle()),before,'rendering must not rewrite cartelle or history');
  assert.equal(JSON.stringify((await p.t.rows()).map(({blob,...r})=>({...r,bytes:blob?.size}))),snapshot,'rendering must not modify attachments');
  assert.deepEqual(p.errors,[]);
  console.log('PASS: per-worker/per-visit indicators; imported metadata; homonym and CF conflicts; negative drug result; explicit absence; unknown/missing files and dates; live refresh; read failures; concurrent searches; no data writes.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
