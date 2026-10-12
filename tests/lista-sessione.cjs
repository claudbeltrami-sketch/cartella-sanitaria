// Regression checks against the full application; synthetic data only.
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {app}=require('./allegati-dom.cjs');
const S='beltrami_v9_sessione_attiva',W='beltrami_workers_v8';
const ws=[{id:'w1',cognome:'COLLAUDO',nome:'ALFA',datore_lavoro:'ALFA SRL',mansione:'BARISTA',orario:'09:00',visited:true},{id:'w2',cognome:'COLLAUDO',nome:'BETA',datore_lavoro:'BETA SRL',mansione:'AUTISTA',orario:'09:30',visited:false}];
const session={id:'session-test',data:'2026-10-12',stato:'PREPARAZIONE',committente:'CLIENTE VECCHIO',sede:'SEDE VECCHIA',email:'vecchio@example.test',azienda:''};
function edit(p,id,value,type='input'){p.$(id).value=value;p.$(id).dispatchEvent(new p.w.Event(type,{bubbles:true}))}
function local(p){return Object.fromEntries(Object.keys(p.w.localStorage).map(k=>[k,JSON.parse(p.w.localStorage.getItem(k))]))}
function capture(p){
 const blobs=[];p.w.URL.createObjectURL=b=>{blobs.push(b);return 'blob:report-'+blobs.length};
 p.w.open=()=>({});p.w.print=()=>{throw Error('Parent chart must never print for a worker list')};
 return async close=>{const n=blobs.length;p.$(close?'v9Chiudi':'v9Esporta').click();assert.equal(blobs.length,n+1);return new JSDOM(await blobs.at(-1).text())};
}
(async()=>{
 const p=await app(undefined,'',{local:{[S]:session,[W]:{workers:ws,currentWorkerIndex:-1,attachedSourceName:'lista-test.xlsx'},beltrami_v9_esiti:{w2:'ASSENTE'}}});
 try{
  assert.deepEqual(p.errors,[]);
  await p.api.saveToLocalArchive({cognome:'COLLAUDO',nome:'ARCHIVIO',codice_fiscale:'TEST000000000001',data_nascita:'1980-01-01',data_cartella:'2026-10-01',firma_lavoratore_png:'FIRMA SINTETICA',anamnesi_patologica:'DATO SINTETICO'});
  await p.t.storeOriginalFile({name:'lista-test.xlsx',type:'application/octet-stream',bytes:new Uint8Array([1,2,3])});
  const before=JSON.stringify(await p.t.cartelle()),files=await p.t.rows(),workersBefore=p.w.localStorage.getItem(W),outcomes=p.w.localStorage.getItem('beltrami_v9_esiti');
  edit(p,'v9Committente','Committente corretto & soci');edit(p,'v9Sede','Sede visita');edit(p,'v9Email','lista@example.test');edit(p,'v9IndirizzoSede','Via di prova 10');edit(p,'v9Fascia','09:00–13:00');
  assert.equal(JSON.parse(p.w.localStorage.getItem(S)).committente,'COMMITTENTE CORRETTO & SOCI');
  assert.equal(JSON.parse(p.w.localStorage.getItem(S)).stato,'PREPARAZIONE');
  const exportDoc=capture(p);
  // Current fields also win when programmatic edits haven't fired an input event.
  p.$('v9Referente').value='REFERENTE TEST';p.$('v9Sede').value='SEDE ULTIMA MODIFICA';
  const report=await exportDoc(false),d=report.window.document;
  assert.match(d.body.textContent,/COMMITTENTE CORRETTO & SOCI/);assert.match(d.body.textContent,/SEDE ULTIMA MODIFICA/);
  assert.match(d.body.textContent,/lista@example.test/);assert.match(d.body.textContent,/VIA DI PROVA 10/);assert.match(d.body.textContent,/AZIENDE DIVERSE/);
  assert.equal(d.querySelectorAll('tbody tr').length,2);
  for(const tr of d.querySelectorAll('tbody tr')){assert.equal(tr.children[6].textContent,'');assert.equal(tr.children[7].textContent,'')}
  assert.match(d.body.textContent,/BARISTA/);assert.match(d.body.textContent,/AUTISTA/);assert.match(d.body.textContent,/09:30/);assert.match(d.body.textContent,/TOTALE: 2/);
  assert.equal(d.querySelector('#cartellaForm'),null);assert.match(d.querySelector('.stampa').getAttribute('onclick'),/window.print/);
  assert.equal(p.w.localStorage.getItem(W),workersBefore);assert.equal(p.w.localStorage.getItem('beltrami_v9_esiti'),outcomes);
  assert.equal(JSON.stringify(await p.t.cartelle()),before);assert.equal((await p.t.rows()).length,files.length);
  report.window.close();
  const saved=local(p),reopened=await app(undefined,'',{local:saved});
  try{assert.equal(reopened.$('v9Committente').value,'COMMITTENTE CORRETTO & SOCI');assert.equal(reopened.$('v9Sede').value,'SEDE ULTIMA MODIFICA');assert.equal(reopened.$('v9Referente').value,'REFERENTE TEST');assert.deepEqual(reopened.errors,[])}finally{reopened.dom.window.close()}
  // Multiple employers can start a session without inventing a single employer.
  const alerts=[];p.w.alert=x=>alerts.push(x);p.$('v9Avvia').click();assert.match(alerts.pop(),/SESSIONE SALVATA/);
  assert.equal(JSON.parse(p.w.localStorage.getItem(S)).stato,'IN CORSO');
  assert.ok(!JSON.parse(p.w.localStorage.getItem('beltrami_v9_archivi')).aziende.some(x=>!x.nome));
  const closed=await exportDoc(true);assert.match(closed.window.document.body.textContent,/RIEPILOGO LISTA/);assert.match(closed.window.document.body.textContent,/VISITATO/);assert.match(closed.window.document.body.textContent,/ASSENTE/);closed.window.close();
  assert.ok(JSON.parse(p.w.localStorage.getItem(S)).chiusa);assert.equal(JSON.stringify(await p.t.cartelle()),before);
  assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close()}
 // Recovery requires the exact active list and unchanged ordered identities.
 const seed={[W]:{workers:ws,attachedSourceName:'lista-test.xlsx'},beltrami_worker_lists_v1:[{id:'list-test',workers:ws,attachedSourceName:'lista-test.xlsx',session}]};
 // The harness seeds JSON values; active-list IDs are intentionally raw strings.
 // Seed a minimal inline initializer before the application to mimic localStorage.
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const recovery=html.slice(html.indexOf('function recoverActiveListSession(){'),html.indexOf('function workersData(){'));
 const storage=new Map(Object.entries(seed).map(([k,v])=>[k,JSON.stringify(v)]));storage.set('beltrami_worker_list_active_v1','list-test');
 const context=vm.createContext({lumenStorage:{local:{getItem:k=>storage.get(k)||null}},read:(k,f)=>JSON.parse(storage.get(k)||'null')||f});vm.runInContext(recovery,context);
 assert.equal(vm.runInContext('recoverActiveListSession().committente',context),session.committente);
 storage.set('beltrami_worker_list_active_v1','other-list');assert.equal(vm.runInContext('recoverActiveListSession()',context),null);
 storage.set('beltrami_worker_list_active_v1','list-test');storage.set(W,JSON.stringify({workers:ws.slice().reverse(),attachedSourceName:'lista-test.xlsx'}));assert.equal(vm.runInContext('recoverActiveListSession()',context),null);
 const fresh=await app();try{edit(fresh,'v9Committente','BOZZA');edit(fresh,'v9Sede','SEDE BOZZA');assert.equal(JSON.parse(fresh.w.localStorage.getItem(S)).committente,'BOZZA');fresh.$('v9Nuova').click();assert.equal(JSON.parse(fresh.w.localStorage.getItem(S)).committente,'');assert.deepEqual(fresh.errors,[])}finally{fresh.dom.window.close()}
 console.log('PASS: live metadata; draft autosave and reload; isolated preparation and closing reports; blank outcomes; multi-employer session; exact-list recovery; archive, signature and source preservation. Native Safari printing/layout not tested by this harness.');
})().catch(e=>{console.error(e);process.exitCode=1});
