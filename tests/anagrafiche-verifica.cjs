const {app}=require('./allegati-dom.cjs'),assert=require('node:assert/strict');
(async()=>{const p=await app();try{
 const a={cognome:'SINTETICO',nome:'ALFA',codice_fiscale:'SNTLFA65C45H501X',data_nascita:'1965-03-03',data_cartella:'2026-10-30'};
 p.api.apply(a);assert.equal(p.$('lumenAnagrafiche').hidden,false);assert.match(p.$('lumenAnagrafiche').textContent,/03\/03\/1965.*05\/03/);
 const saved=p.api.collect();assert.equal(saved.verifica_anagrafica.pending.length,1);
 p.$('data_nascita').value='1965-03-05';p.$('data_nascita').dispatchEvent(new p.w.Event('input',{bubbles:true}));assert.equal(p.$('lumenAnagrafiche').hidden,false,'correction alone does not dismiss reminder');
 p.w.prompt=()=>null;await p.$('lumenAnagrafiche').querySelector('button').onclick();assert.equal(p.$('lumenAnagrafiche').hidden,false);
 p.w.prompt=()=> 'Documento controllato: corretta data al 05/03/1965';await p.$('lumenAnagrafiche').querySelector('button').onclick();assert.equal(p.$('lumenAnagrafiche').hidden,true);
 const resolved=p.api.collect();assert.equal(resolved.verifica_anagrafica.resolved.length,1);assert.ok((await p.t.cartelle())[0].data.verifica_anagrafica.resolved[0].verifiedAt);
 p.api.apply({...a,nome:'BETA',data_nascita:'1965-03-05'});assert.equal(p.$('lumenAnagrafiche').hidden,true,'no cross-worker contamination');
 p.api.apply(saved);assert.equal(p.$('lumenAnagrafiche').hidden,false,'unresolved metadata restores');
 p.api.apply(resolved);assert.equal(p.$('lumenAnagrafiche').hidden,true,'resolution survives reopen');
 p.t.setWorkers([a]);assert.match(p.$('workersBody').textContent,/DATI DA VERIFICARE/);await p.t.selectWorker(0);assert.equal(p.$('lumenAnagrafiche').hidden,true,'saved verified record is reopened');
 assert.match(p.w.document.head.textContent,/@media print\{#lumenAnagrafiche\{display:none!important/);
 assert.deepEqual(p.errors,[]);console.log('PASS: mismatch reminder, no automatic correction, explicit verification, persisted audit, reopen, worker isolation, legacy list detection, print exclusion');
}finally{p.dom.window.close()}})().catch(e=>{console.error(e);process.exitCode=1});
