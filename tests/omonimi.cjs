// Full-script integration regression; synthetic identities and isolated storage only.
// NODE_PATH=/path/to/jsdom-and-fake-indexeddb/node_modules node tests/omonimi.cjs
const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
const day='2026-10-02';
const a={cognome:'OMONIMO',nome:'COLLAUDO',codice_fiscale:'TESTOMONIMOA',data_nascita:'1980-01-01',data_cartella:day,data_giudizio:day,farmaci:'SOLO A',firma_lavoratore_png:'FIRMA_A'};
const b={...a,codice_fiscale:'TESTOMONIMOB',data_nascita:'1990-02-02',farmaci:'SOLO B',firma_lavoratore_png:'FIRMA_B'};
const bare=d=>({cognome:d.cognome,nome:d.nome,codice_fiscale:d.codice_fiscale,data_nascita:d.data_nascita,visited:true});
async function scenario(label,fn){
 const p=await app();
 try{p.$('v9Data').value=day;await fn(p);assert.deepEqual(p.errors,[]);console.log('PASS '+label)}finally{p.dom.window.close()}
}
(async()=>{
 await scenario('same names: CF, clinical data and signatures stay separate; opening leaves stored records unchanged',async p=>{
  await p.api.saveToLocalArchive(a);await p.api.saveToLocalArchive(b);
  const before=JSON.stringify(await p.t.cartelle());p.t.setWorkers([bare(a),bare(b)]);
  for(const i of [0,1,0,1]){
   await p.t.selectWorker(i);const d=p.api.collect(),expected=i?b:a;
   assert.equal(d.codice_fiscale,expected.codice_fiscale);assert.equal(d.farmaci,expected.farmaci);assert.equal(d.firma_lavoratore_png,expected.firma_lavoratore_png);
  }
  assert.equal(JSON.stringify(await p.t.cartelle()),before);
  assert.match(p.$('workersBody').textContent,/TESTOMONIMOA/);assert.match(p.$('workersBody').textContent,/TESTOMONIMOB/);
  let confirmation='';p.w.confirm=t=>{confirmation=t;return true};await p.t.openArchiveRecord(p.api.cartellaId(a));
  assert.match(confirmation,/TESTOMONIMOA/);assert.match(confirmation,/01\/01\/1980/);
  assert.equal(p.api.collect().codice_fiscale,a.codice_fiscale);assert.equal(JSON.stringify(await p.t.cartelle()),before);
 });
 for(const dob of ['',a.data_nascita])await scenario('two incomplete rows preserve distinct drafts; DOB '+(dob||'missing'),async p=>{
  const row={cognome:'BOZZA',nome:'OMONIMA',codice_fiscale:'',data_nascita:dob};
  p.t.setWorkers([{...row,id:'same-import-id'},{...row,id:'same-import-id'}]);
  await p.t.selectWorker(0);p.$('farmaci').value='BOZZA PRIMA';p.api.useWorkerSignature('FIRMA_PRIMA');
  await p.t.selectWorker(1);assert.equal(p.api.collect().farmaci,'');assert.equal(p.api.collect().firma_lavoratore_png,'');
  p.$('farmaci').value='BOZZA SECONDA';p.api.useWorkerSignature('FIRMA_SECONDA');
  await p.t.selectWorker(0);assert.equal(p.api.collect().farmaci,'BOZZA PRIMA');assert.equal(p.api.collect().firma_lavoratore_png,'FIRMA_PRIMA');
  await p.t.selectWorker(1);assert.equal(p.api.collect().farmaci,'BOZZA SECONDA');assert.equal(p.api.collect().firma_lavoratore_png,'FIRMA_SECONDA');
  await assert.rejects(p.api.saveToLocalArchive(p.api.collect()),/CODICE FISCALE/);
  assert.equal((await p.t.cartelle()).length,0);
  // Replacing a list with reused row IDs cannot attach an old incomplete draft.
  p.t.setWorkers([{...row,id:'same-import-id'}]);await p.t.selectWorker(0);
  assert.equal(p.api.collect().farmaci,'');assert.equal(p.api.collect().firma_lavoratore_png,'');
 });
 await scenario('exact legacy ANAG key cannot bypass ambiguity; explicit CF selects the correct homonym',async p=>{
  const sameDobB={...b,data_nascita:a.data_nascita};
  const legacy={...a,codice_fiscale:'',farmaci:'LEGACY AMBIGUO',firma_lavoratore_png:'FIRMA_AMBIGUA'};
  for(const d of [legacy,a,sameDobB])await p.api.saveToLocalArchive(d);
  const before=JSON.stringify(await p.t.cartelle());
  p.t.setWorkers([bare(legacy)]);await p.t.selectWorker(0);
  assert.equal(p.api.collect().farmaci,'');assert.equal(p.api.collect().firma_lavoratore_png,'');
  assert.match(p.$('saveInfo').textContent,/CODICE FISCALE e DATA DI NASCITA/);
  await assert.rejects(p.api.saveToLocalArchive(legacy),/IDENTITÀ AMBIGUA/);
  p.t.setWorkers([bare(a),bare(sameDobB)]);
  for(const i of [0,1]){await p.t.selectWorker(i);assert.equal(p.api.collect().farmaci,i?'SOLO B':'SOLO A')}
  assert.equal(JSON.stringify(await p.t.cartelle()),before);
 });
 await scenario('incomplete archive with two known CFs in the list never supplies either person; old visit never auto-loads',async p=>{
  const sameDobB={...b,data_nascita:a.data_nascita},legacy={...a,codice_fiscale:''};
  await p.api.saveToLocalArchive(legacy);p.t.setWorkers([bare(a),bare(sameDobB)]);
  await p.t.selectWorker(0);assert.equal(p.api.collect().farmaci,'');assert.equal(p.api.collect().firma_lavoratore_png,'');
  await p.api.saveToLocalArchive({...a,data_cartella:'2026-09-30',data_giudizio:'2026-09-30'});
  await p.t.selectWorker(0);assert.equal(p.api.collect().farmaci,'');assert.equal(p.api.collect().firma_lavoratore_png,'');
 });
 await scenario('one unambiguous saved CF remains recoverable from an incomplete list, including edited drafts',async p=>{
  await p.api.saveToLocalArchive(a);p.t.setWorkers([bare({...a,codice_fiscale:''}),bare({...b,cognome:'ALTRO'})]);
  await p.t.selectWorker(0);assert.equal(p.api.collect().farmaci,'SOLO A');assert.equal(p.api.collect().codice_fiscale,a.codice_fiscale);
  p.$('farmaci').value='MODIFICA A';await p.t.selectWorker(1);await p.t.selectWorker(0);
  assert.equal(p.api.collect().farmaci,'MODIFICA A');assert.equal(p.api.collect().firma_lavoratore_png,'FIRMA_A');
 });
})().catch(e=>{console.error(e);process.exitCode=1});
