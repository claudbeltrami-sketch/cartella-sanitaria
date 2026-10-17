const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
(async()=>{
 const p=await app();
 try{
  const d={cognome:'SINTETICO',nome:'RECUPERO',codice_fiscale:'TESTRECUPERO',data_nascita:'1980-01-01',data_giudizio:'2026-10-12'};
  await p.api.saveToLocalArchive(d);
  const charts=await p.t.cartelle(),before=JSON.stringify(charts),rec=charts[0];
  const row={kind:'referti_verifica_v1',workerKey:rec.id,workerCf:d.codice_fiscale,visit:d.data_giudizio,analisi:'SÌ',drug:'NO',verifiedAt:'2026-10-16T12:00:00Z'};
  const packet={tipo:'LUMEN_VERIFICHE_REFERTI_V1',contenuto:{originali:[row]}};
  const api=p.w.lumenRecuperaVerifiche;
  assert.deepEqual(JSON.parse(JSON.stringify(await api.recover(packet))),{added:1,kept:0});
  assert.equal(JSON.stringify(await p.t.cartelle()),before,'charts unchanged');
  const rows=JSON.stringify(await p.t.rows());
  assert.deepEqual(JSON.parse(JSON.stringify(await api.recover({...packet,contenuto:{originali:[{...row,drug:'SÌ'}]}}))),{added:0,kept:1});
  assert.equal(JSON.stringify(await p.t.rows()),rows,'existing confirmations unchanged');
  for(const change of [{visit:'2026-09-12'},{workerCf:'OTHER'},{workerKey:'OTHER'}])assert.equal(api.plan({...packet,contenuto:{originali:[{...row,...change}]}},charts).length,0);
  assert.throws(()=>api.plan({...packet,contenuto:{originali:[{...row,drug:'INVALID'}]}},charts));
  assert.throws(()=>api.plan({...packet,contenuto:{originali:[row,{...row,drug:'SÌ'}]}},charts));
  assert.deepEqual(p.errors,[]);
  console.log('PASS recovery: matching identity/date, no chart edits, idempotence, preserve existing, invalid/conflicting input');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
