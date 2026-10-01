const {app}=require('./allegati-dom.cjs');
const assert=require('node:assert/strict'),idb=require('fake-indexeddb');
const KEY='lumen_conteggio_link_v1',PAIR='lumen_conteggio_pair_pending_v1';
const old={version:1,token:'a'.repeat(64),salt:'b'.repeat(64),account:'old',expires:Date.now()+86400000};
const link={...old,token:'c'.repeat(64),salt:'d'.repeat(64),account:'new'};
const day='2026-09-30',state='e'.repeat(64);
const base={cognome:'SINTETICO',nome:'ALFA',codice_fiscale:'SNTLFA80A01H501X',giudizio:'IDONEO',data_giudizio:day,datore_lavoro:'TEST',anamnesi_patologica:'NON INVIARE',firma_lavoratore_png:'FIRMA'};
(async()=>{
 const factory=new idb.IDBFactory();const p=await app(factory);let before;
 try{
  for(let i=0;i<16;i++)await p.api.saveToLocalArchive({...base,nome:'PERSONA '+i,codice_fiscale:'TEST'+String(i).padStart(12,'0')});
  p.$('conteggioAutoDate').value=day;p.$('conteggioAutoClient').value='SERMOLAB';await p.$('conteggioAutoConfigure').onclick();
  for(const r of await p.t.cartelle())await p.w.lumenConteggioStorage.change(r.id,current=>{current.conteggioVisits[day].status='sent'});
  before=await p.t.cartelle();assert.equal(before.length,16);
 }finally{p.dom.window.close()}
 const callback='#lumen-connected='+encodeURIComponent(JSON.stringify({state,link}));
 const q=await app(factory,callback,{session:{[PAIR]:{state,createdAt:Date.now()}},local:{[KEY]:old}});
 try{
  let rows=await q.t.cartelle();assert.equal(rows.filter(r=>r.conteggioVisits[day].status==='pending').length,16);
  for(const row of rows){const original=before.find(r=>r.id===row.id);for(const k of ['data','history','createdAt','updatedAt'])assert.deepEqual(row[k],original[k]);assert.equal(row.conteggioVisits[day].savedAt,original.conteggioVisits[day].savedAt)}
  const received=new Map();q.w.fetch=async(url,options)=>{const v=JSON.parse(options.body);assert.equal(options.headers.Authorization,'Bearer '+link.token);assert.equal(v.date,day);assert.equal(v.client,'SERMOLAB');assert.deepEqual(Object.keys(v).sort(),['visitId','date','client','place','name','company','savedAt'].sort());received.set(v.visitId,v);return {ok:true,json:async()=>({ok:true,visitId:v.visitId})}};
  await q.$('conteggioAutoRetry').onclick();assert.equal(received.size,16);
  rows=await q.t.cartelle();assert(rows.every(r=>r.conteggioVisits[day].status==='sent'&&r.conteggioVisits[day].sentAccount==='new'));
  await q.$('conteggioAutoRetry').onclick();assert.equal(received.size,16);
  for(const row of rows){const original=before.find(r=>r.id===row.id);for(const k of ['data','history','createdAt','updatedAt'])assert.deepEqual(row[k],original[k])}
  assert.deepEqual(q.errors,[]);
 }finally{q.dom.window.close()}
 // A saved replay marker resumes after a reload, without needing another pairing.
 const r=await app(factory,'',{local:{[KEY]:{...link,replay:true}}});
 try{assert.equal((await r.t.cartelle()).filter(x=>x.conteggioVisits[day].status==='pending').length,16);assert.equal(JSON.parse(r.w.localStorage.getItem(KEY)).replay,false);assert.deepEqual(r.errors,[])}finally{r.dom.window.close()}
 // An unsolicited callback cannot replace a connection or authorize recovery.
 const bad=await app(factory,callback,{local:{[KEY]:old}});
 try{assert.equal(JSON.parse(bad.w.localStorage.getItem(KEY)).account,'old');assert.match(bad.$('conteggioAutoDetails').textContent,/NON RICHIESTO|OFFLINE/)}finally{bad.dom.window.close()}
 console.log('PASS: 16 sent visits recovered for new account; original dates preserved; clinical records and signatures unchanged; administrative whitelist; retry idempotence; interrupted replay resumes; unsolicited callback rejected.');
})().catch(e=>{console.error(e);process.exitCode=1});
