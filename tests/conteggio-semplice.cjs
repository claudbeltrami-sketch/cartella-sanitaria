const {app}=require('./allegati-dom.cjs');
const assert=require('node:assert/strict'),idb=require('fake-indexeddb');
const link={version:1,token:'a'.repeat(64),salt:'b'.repeat(64),account:'test',expires:Date.now()+86400000};
const base={cognome:'SINTETICO',nome:'ALFA',codice_fiscale:'SNTLFA80A01H501X',giudizio:'IDONEO',data_giudizio:'2026-09-30',datore_lavoro:'TEST',anamnesi_patologica:'NON INVIARE',firma_lavoratore_png:'FIRMA'};
const KEY='lumen_conteggio_link_v1',PAIR='lumen_conteggio_pair_pending_v1';
(async()=>{
 const p=await app();try{
  await p.api.saveToLocalArchive(base);
  await p.w.lumenConteggioStorage.change((await p.t.cartelle())[0].id,r=>{delete r.conteggioVisits});
  const before=(await p.t.cartelle())[0];
  p.$('conteggioAutoDate').value='2026-09-30';p.$('conteggioAutoClient').value='SERMOLAB';await p.$('conteggioAutoConfigure').onclick();
  let rec=(await p.t.cartelle())[0];assert.equal(rec.conteggioVisits['2026-09-30'].client,'SERMOLAB');
  for(const k of ['data','history','updatedAt','createdAt'])assert.deepEqual(rec[k],before[k]);
  const version=rec.conteggioVisits['2026-09-30'].version;
  await p.$('conteggioAutoConfigure').onclick();rec=(await p.t.cartelle())[0];assert.equal(rec.conteggioVisits['2026-09-30'].version,version);
  // Current chart on another date: recover the earlier visit from history, without altering it.
  await p.api.saveToLocalArchive({...base,data_giudizio:'2026-10-01'});
  await p.w.lumenConteggioStorage.change(rec.id,r=>{delete r.conteggioVisits});
  await p.$('conteggioAutoConfigure').onclick();rec=(await p.t.cartelle())[0];assert.equal(Object.keys(rec.conteggioVisits).join(),'2026-09-30');
  // A latest incomplete assessment must not be replaced by an older completed assessment.
  await p.api.saveToLocalArchive({...base,giudizio:''});await p.w.lumenConteggioStorage.change(rec.id,r=>{delete r.conteggioVisits});
  await p.$('conteggioAutoConfigure').onclick();assert.equal((await p.t.cartelle())[0].conteggioVisits,undefined);
  assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close()}
 const state='c'.repeat(64),callback='#lumen-connected='+encodeURIComponent(JSON.stringify({state,link}));
 const seed={session:{[PAIR]:{state,createdAt:Date.now(),draft:base}}};
 const valid=await app(new idb.IDBFactory(),callback,seed);try{
  assert.deepEqual(JSON.parse(valid.w.localStorage.getItem(KEY)),{...link,replay:false});assert.equal(valid.w.location.hash,'');assert.equal(valid.w.sessionStorage.getItem(PAIR),null);
  assert.equal(valid.api.collect().cognome,base.cognome);assert.equal(valid.api.collect().anamnesi_patologica,base.anamnesi_patologica);
  assert.equal((await valid.t.cartelle()).length,0);assert.deepEqual(valid.errors,[]);
 }finally{valid.dom.window.close()}
 for(const bad of [{},{session:{[PAIR]:{state:'d'.repeat(64),createdAt:Date.now()}}},{session:{[PAIR]:{state,createdAt:Date.now()-910000}}}]){
  const q=await app(new idb.IDBFactory(),callback,bad);try{assert.equal(q.w.localStorage.getItem(KEY),null);assert.equal(q.w.location.hash,'');assert.deepEqual(q.errors,[])}finally{q.dom.window.close()}
 }
 const ghost=await app(new idb.IDBFactory(),'?prova=fantasma'+callback,seed);try{assert.equal(ghost.w.localStorage.getItem(KEY),null);assert.equal(ghost.w.location.hash,'')}finally{ghost.dom.window.close()}
 console.log('PASS: old archive recovery; idempotence; clinical fields untouched; history recovery; latest incomplete assessment excluded; automatic pairing; draft preserved without saving; nonce/expiry validation; token scrubbed; ghost isolated.');
})().catch(e=>{console.error(e);process.exitCode=1});
