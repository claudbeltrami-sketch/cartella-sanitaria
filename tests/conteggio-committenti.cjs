// Synthetic reproduction of the 52 unassigned administrative entries.
const {app}=require('./allegati-dom.cjs');
const assert=require('node:assert/strict'),idb=require('fake-indexeddb');
const clone=x=>JSON.parse(JSON.stringify(x));
const strip=r=>{const copy=clone(r);delete copy.conteggioVisits;return copy};
const day='2026-09-30';
const visit=(n,company)=>({cognome:'COLLAUDO '+n,nome:'FITTIZIO',codice_fiscale:'TEST'+String(n).padStart(12,'0'),data_nascita:'1980-01-01',data_giudizio:day,giudizio:'IDONEO',datore_lavoro:company,anamnesi:'DATO CLINICO FITTIZIO',firma_lavoratore_png:''});
(async()=>{
 const factory=new idb.IDBFactory(),p=await app(factory);let before;
 try{
  for(let n=1;n<=52;n++){
   await p.api.saveToLocalArchive(visit(n,n<=50?'ORIZZONTE SEDE AZIENDA SRL':'SERMOLAB AZIENDA SRL'));
  }
  await p.api.saveToLocalArchive(visit(53,'AZIENDA SENZA ETICHETTA'));
  await p.api.saveToLocalArchive(visit(54,'SERMOLAB ASSEGNAZIONE ESISTENTE'));
  await p.api.saveToLocalArchive(visit(55,'ORIZZONTE CARTELLA SENZA CODA'));
  for(const r of await p.t.cartelle())await p.w.lumenConteggioStorage.change(r.id,current=>{
   if(current.data.cognome==='COLLAUDO 55'){delete current.conteggioVisits;return}
   current.conteggioVisits[day].client=current.data.cognome==='COLLAUDO 54'?'ALTRO COMMITTENTE':'';
   current.conteggioVisits[day].place='SEDE CONSERVATA';
  });
  before=clone(await p.t.cartelle());
 }finally{p.dom.window.close()}
 const q=await app(factory);
 try{
  await q.$('conteggioAutoRetry').onclick();
  const rows=clone(await q.t.cartelle()),entries=rows.flatMap(r=>Object.values(r.conteggioVisits||{}));
  assert.equal(entries.filter(e=>e.client==='GRUPPO ORIZZONTE').length,50);
  assert.equal(entries.filter(e=>e.client==='SERMOLAB').length,2);
  assert.equal(entries.filter(e=>!e.client).length,1);
  assert.equal(entries.filter(e=>e.client==='ALTRO COMMITTENTE').length,1);
  for(const row of rows){
   const original=before.find(r=>r.id===row.id);assert.deepEqual(strip(row),strip(original));
   for(const [date,entry]of Object.entries(row.conteggioVisits||{})){
    const previous=original.conteggioVisits[date];
    for(const key of Object.keys(previous))if(!['client','version'].includes(key))assert.deepEqual(entry[key],previous[key]);
    if(previous.client||!entry.client)assert.deepEqual(entry,previous);
   }
  }
  assert.match(q.$('conteggioAutoStatus').textContent,/1 SENZA COMMITTENTE/);
  await q.$('conteggioAutoRetry').onclick();assert.deepEqual(clone(await q.t.cartelle()),rows,'repeated recovery is idempotent');
  // Prefix matching is strict; mixed commissioners on one day stay separate.
  q.w.localStorage.setItem('beltrami_conteggio_config_v1',JSON.stringify({[day]:{client:'ALTRO COMMITTENTE',place:'SEDE ALTRO'}}));
  const prepare=q.w.lumenConteggio.prepare;
  for(const [company,expected]of [['  orizzonte  sede','GRUPPO ORIZZONTE'],['GRUPPO ORIZZONTE SEDE','GRUPPO ORIZZONTE'],['sermolab azienda','SERMOLAB'],['ORIZZONTEGGIANDO SRL','ALTRO COMMITTENTE'],['AZIENDA ORIZZONTE','ALTRO COMMITTENTE'],['SERMOLABORATORIO','ALTRO COMMITTENTE']]){
   const e=prepare(visit(99,company),null,'CF_TEST',new Date().toISOString())[day];assert.equal(e.client,expected);assert.equal(e.place,expected==='ALTRO COMMITTENTE'?'SEDE ALTRO':'');
  }
  // Backup and restore preserve the repaired entries and clinical data.
  await q.t.backup();const backup=JSON.parse(await q.downloads.at(-1).blob.text());
  const restored=await app();try{await restored.t.restore(new File([JSON.stringify(backup)],'backup.json'));assert.deepEqual(clone(await restored.t.cartelle()),rows)}finally{restored.dom.window.close()}
  // Existing transport keeps stable visit IDs and sends administrative fields only.
  const sent=[];q.w.localStorage.setItem('lumen_conteggio_link_v1',JSON.stringify({version:1,token:'a'.repeat(64),salt:'b'.repeat(64),account:'test',expires:Date.now()+86400000}));
  q.w.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);sent.push(body);return {ok:true,json:async()=>({ok:true,visitId:body.visitId})}};
  await q.$('conteggioAutoRetry').onclick();assert.equal(sent.length,53);assert.equal(new Set(sent.map(e=>e.visitId)).size,53);assert(!JSON.stringify(sent).includes('DATO CLINICO'));
  await q.$('conteggioAutoRetry').onclick();assert.equal(sent.length,53,'no resend after confirmed receipt');
  assert.deepEqual(q.errors,[]);
 }finally{q.dom.window.close()}
 console.log('PASS: 52 recovered (50 Orizzonte, 2 Sermolab); unknown and manual assignments preserved; no new entries; clinical data/history unchanged; repeat-safe; strict prefixes and mixed-day clients; backup/restore; no duplicate sends.');
})().catch(e=>{console.error(e);process.exitCode=1});
