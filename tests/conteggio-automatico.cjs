const {app}=require('./allegati-dom.cjs');
const assert=require('node:assert/strict'),idb=require('fake-indexeddb');
const visit={cognome:'SINTETICO',nome:'ALFA',codice_fiscale:'SNTLFA80A01H501X',data_nascita:'1980-01-01',data_giudizio:'2026-09-30',giudizio:'IDONEO',datore_lavoro:'AZIENDA FITTIZIA',anamnesi:'SEGRETO CLINICO',firma_lavoratore_png:'FIRMA SEGRETA'};
const link={version:1,token:'a'.repeat(64),salt:'b'.repeat(64),account:'account-test',expires:Date.now()+86400000};
const config=JSON.stringify({'2026-09-30':{client:'SERMOLAB',place:'ROMA'}});
const tick=()=>new Promise(r=>setTimeout(r,20));
async function idle(p){for(let i=0;i<60;i++){await p.$('conteggioAutoRetry').onclick();await tick();if((await p.t.cartelle()).every(r=>Object.values(r.conteggioVisits||{}).every(e=>e.status==='sent')))return}throw Error('outbox not drained')}
(async()=>{
const factory=new idb.IDBFactory(),p=await app(factory);let sent=[];
try{
 await p.api.saveToLocalArchive({...visit,giudizio:''});assert.equal((await p.t.cartelle())[0].conteggioVisits,undefined);
 await p.api.saveToLocalArchive(visit);let rec=(await p.t.cartelle())[0];assert.equal(rec.conteggioVisits['2026-09-30'].client,'');assert.equal(rec.conteggioVisits['2026-09-30'].status,'pending');
 p.$('conteggioAutoDate').value='2026-09-30';p.$('conteggioAutoClient').value='SERMOLAB';p.$('conteggioAutoPlace').value='ROMA';await p.$('conteggioAutoConfigure').onclick();
 p.w.localStorage.setItem('lumen_conteggio_link_v1',JSON.stringify(link));
 p.w.fetch=async(url,opts)=>{sent.push(JSON.parse(opts.body));throw Error('offline')};await p.$('conteggioAutoRetry').onclick();await tick();assert.equal((await p.t.cartelle())[0].conteggioVisits['2026-09-30'].status,'pending');
 await p.t.backup();const backup=JSON.parse(await p.downloads.at(-1).blob.text());assert.equal(backup.contenuto.localStorage.lumen_conteggio_link_v1,undefined);assert.equal(backup.contenuto.cartelle[0].conteggioVisits['2026-09-30'].status,'pending');
 const restored=await app();try{await restored.t.restore(new File([JSON.stringify(backup)],'backup.json'));assert.equal((await restored.t.cartelle())[0].conteggioVisits['2026-09-30'].client,'SERMOLAB')}finally{restored.dom.window.close()}
 const q=await app(factory);try{
 q.w.localStorage.setItem('lumen_conteggio_link_v1',JSON.stringify(link));q.w.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);sent.push(body);return {ok:true,json:async()=>({ok:true,visitId:body.visitId})}};await idle(q);
 const first=sent.at(-1);assert.deepEqual(Object.keys(first).sort(),['visitId','date','client','place','name','company','savedAt'].sort());assert(!JSON.stringify(first).includes('SEGRET'));assert(!JSON.stringify(first).includes(visit.codice_fiscale));assert(!JSON.stringify(first).includes(visit.data_nascita));
 q.w.localStorage.setItem('beltrami_conteggio_config_v1',JSON.stringify({'2026-09-30':{client:'ALTRO',place:'MILANO'}}));await q.api.saveToLocalArchive(visit);await idle(q);assert.equal(sent.at(-1).visitId,first.visitId);assert.equal(sent.at(-1).client,'SERMOLAB');
 // Save a newer version while the first request is in flight; its acknowledgement cannot clear the newer one.
 let release,requests=0;const gate=new Promise(r=>release=r);q.w.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);sent.push(b);if(++requests===1)await gate;return {ok:true,json:async()=>({ok:true,visitId:b.visitId})}};
 await q.api.saveToLocalArchive({...visit,datore_lavoro:'PRIMA'});await tick();await q.api.saveToLocalArchive({...visit,datore_lavoro:'SECONDA'});release();await idle(q);assert.equal(sent.at(-1).company,'SECONDA');assert(requests>=2);assert.equal((await q.t.cartelle())[0].data.datore_lavoro,'SECONDA');
 await q.api.saveToLocalArchive({...visit,data_giudizio:'2026-10-01'});await tick();rec=(await q.t.cartelle())[0];assert.equal(Object.keys(rec.conteggioVisits).length,2);assert.equal(rec.conteggioVisits['2026-10-01'].client,'');
 assert.deepEqual(q.errors,[]);
 }finally{q.dom.window.close()}
 const ghost=await app(factory,'?prova=fantasma');try{let calls=0;ghost.w.fetch=async()=>{calls++;throw Error()};await ghost.api.saveToLocalArchive({...visit,...ghost.w.lumenStorage.identity,lumen_prova:true});await ghost.$('conteggioAutoRetry').onclick();assert.equal(calls,0);assert.equal((await ghost.t.cartelle())[0].conteggioVisits,undefined)}finally{ghost.dom.window.close()}
 assert.deepEqual(p.errors,[]);console.log('PASS: completed-only queue; explicit client; offline retention; backup/restoration excludes token; reopen retry; minimal payload; stable ID and client on repeated saves; concurrent save/ack; different dates; ghost never transmits.');
}finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
