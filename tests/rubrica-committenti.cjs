// Full-application regression: only fictitious contacts, no network.
const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
const A='beltrami_v9_archivi',S='beltrami_v9_sessione_attiva',W='beltrami_workers_v8';
const session={id:'rubrica-test',data:'2026-10-12',fascia:'09:00-13:00',stato:'IN CORSO',committente:'CLIENTE ALFA',email:'alfa@example.test',referente:'REFERENTE ALFA',sede:'SEDE ALFA',indirizzoSede:'VIA FITTIZIA 1',azienda:'AZIENDE VARIE'};
function edit(p,id,value,type='input'){p.$(id).value=value;p.$(id).dispatchEvent(new p.w.Event(type,{bubbles:true}))}
function snapshot(p){return Object.fromEntries(Object.keys(p.w.localStorage).map(k=>[k,JSON.parse(p.w.localStorage.getItem(k))]))}
const get=p=>JSON.parse(p.w.localStorage.getItem(A));
(async()=>{
 const p=await app(undefined,'',{local:{[S]:session,[W]:{workers:[{id:'fake',cognome:'SINTETICO',nome:'TEST',datore_lavoro:'DATORE FITTIZIO',visited:false}]}}});
 try{
  const alerts=[];p.w.alert=t=>alerts.push(t);
  const workers=p.w.localStorage.getItem(W),charts=JSON.stringify(await p.t.cartelle());
  assert.equal(get(p).committenti[0].email,session.email,'Existing session is recovered without retyping');
  assert.equal(get(p).committenti[0].sedi[0].indirizzo,session.indirizzoSede);
  assert.equal(p.$('v9Rubrica').value,'CLIENTE ALFA');
  p.$('v9Nuova').click();assert.equal(p.$('v9Committente').value,'');
  edit(p,'v9Rubrica','CLIENTE ALFA','change');
  assert.equal(p.$('v9Email').value,session.email);assert.equal(p.$('v9Referente').value,session.referente);
  assert.equal(p.$('v9Sede').value,session.sede);assert.equal(p.$('v9IndirizzoSede').value,session.indirizzoSede);
  assert.equal(p.$('v9Azienda').value,'','Employer must not be copied from a client');
  assert.equal(p.$('v9Fascia').value,'','Session schedule must not be copied');
  assert.equal(p.$('v9Stato').value,'PREPARAZIONE');
  edit(p,'v9Referente','REFERENTE AGGIORNATO');p.$('v9SalvaCommittente').click();
  assert.equal(get(p).committenti[0].referente,'REFERENTE AGGIORNATO');
  assert.equal(get(p).committenti.length,1);assert.equal(get(p).committenti[0].sedi.length,1);
  // Adding and editing another site cannot overwrite the first site.
  edit(p,'v9SediSalvate','','change');edit(p,'v9Sede','SEDE BETA');edit(p,'v9IndirizzoSede','VIA FITTIZIA 2');
  p.$('v9SalvaCommittente').click();assert.equal(get(p).committenti[0].sedi.length,2);
  edit(p,'v9IndirizzoSede','VIA FITTIZIA 22');p.$('v9SalvaCommittente').click();
  assert.equal(get(p).committenti[0].sedi.length,2);assert.equal(get(p).committenti[0].sedi[1].indirizzo,'VIA FITTIZIA 22');
  p.$('v9Nuova').click();edit(p,'v9Rubrica','CLIENTE ALFA','change');
  assert.equal(p.$('v9Sede').value,'','Multiple sites require a choice');
  edit(p,'v9SediSalvate','SEDE ALFA|VIA FITTIZIA 1','change');assert.equal(p.$('v9Sede').value,'SEDE ALFA');
  // Switching to an unknown contact clears the old recipient and site.
  edit(p,'v9Committente','CLIENTE BETA','change');
  assert.equal(p.$('v9Email').value,'');assert.equal(p.$('v9Referente').value,'');assert.equal(p.$('v9Sede').value,'');
  edit(p,'v9Email','beta@example.test');edit(p,'v9Sede','SEDE ALFA');edit(p,'v9IndirizzoSede','ALTRO INDIRIZZO 3');
  p.$('v9SalvaCommittente').click();assert.equal(get(p).committenti.length,2);
  edit(p,'v9Rubrica','CLIENTE ALFA','change');edit(p,'v9SediSalvate','SEDE ALFA|VIA FITTIZIA 1','change');
  assert.equal(p.$('v9IndirizzoSede').value,'VIA FITTIZIA 1','Same site name for another client must not collide');
  const q=await app(undefined,'',{local:snapshot(p)});
  try{
   q.$('v9Nuova').click();edit(q,'v9Rubrica','CLIENTE BETA','change');
   assert.equal(q.$('v9Email').value,'beta@example.test');assert.equal(q.$('v9IndirizzoSede').value,'ALTRO INDIRIZZO 3');
   assert.deepEqual(q.errors,[]);
  }finally{q.dom.window.close()}
  await p.t.backup();p.$('lumenBackupDownload').click();
  const backup=JSON.parse(await p.downloads.at(-1).blob.text());
  assert.deepEqual(JSON.parse(backup.contenuto.localStorage[A]),get(p),'Standard backup includes the complete contact directory');
  const q2=await app();
  try{
   await q2.t.restore(new File([JSON.stringify(backup)],'backup-rubrica.json'));
   assert.deepEqual(get(q2),get(p),'Backup restores all saved contact fields and sites');
   assert.deepEqual(q2.errors,[]);
  }finally{q2.dom.window.close()}
  const before=get(p),originalSet=p.w.Storage.prototype.setItem;
  p.w.Storage.prototype.setItem=function(k,v){if(k===A)throw Error('Quota exceeded');return originalSet.call(this,k,v)};
  edit(p,'v9Referente','NON SALVATO');p.$('v9SalvaCommittente').click();
  assert.match(p.$('v9RubricaStatus').textContent,/NON SALVATA/);assert.deepEqual(get(p),before);
  p.w.Storage.prototype.setItem=originalSet;
  assert.equal(p.w.localStorage.getItem(W),workers);assert.equal(JSON.stringify(await p.t.cartelle()),charts);
  assert.deepEqual(p.errors,[]);assert.deepEqual(alerts,[]);
  console.log('PASS: current-contact recovery; new-session recall; persistence; contact/site isolation; multiple sites; edits; backup/restore; storage failure; unchanged workers and charts.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
