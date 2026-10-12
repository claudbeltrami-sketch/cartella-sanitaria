// Rubrica locale: salvataggio e richiamo di due sedi, con dati sintetici.
const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
const click=(p,id)=>p.$(id).click();
function field(p,id,value){p.$(id).value=value;p.$(id).dispatchEvent(new p.w.Event('input',{bubbles:true}))}
async function run(){
 const p=await app();
 try{
  field(p,'v9Committente','AZIENDA TEST');
  field(p,'v9Referente','REFERENTE TEST');
  field(p,'v9Email','test@example.test');
  field(p,'v9Sede','SEDE NORD');
  field(p,'v9IndirizzoSede','VIA PROVA 1');
  click(p,'v9SalvaCommittente');
  field(p,'v9Sede','SEDE SUD');
  field(p,'v9IndirizzoSede','VIA PROVA 2');
  click(p,'v9SalvaCommittente');
  let arch=JSON.parse(p.w.localStorage.getItem('beltrami_v9_archivi'));
  const client=arch.committenti.find(x=>x.nome==='AZIENDA TEST');
  assert(client);assert.equal(client.sedi.length,2);
  click(p,'v9Nuova');
  p.$('v9Rubrica').value='AZIENDA TEST';p.$('v9Rubrica').dispatchEvent(new p.w.Event('change'));
  assert.equal(p.$('v9Email').value,'test@example.test');
  assert.equal(p.$('v9Referente').value,'REFERENTE TEST');
  assert.equal(p.$('v9SediSalvate').options.length,3);
  assert.equal(p.$('v9Sede').value,'');
  p.$('v9SediSalvate').value='SEDE NORD|VIA PROVA 1';
  p.$('v9SediSalvate').dispatchEvent(new p.w.Event('change'));
  assert.equal(p.$('v9Sede').value,'SEDE NORD');
  assert.equal(p.$('v9IndirizzoSede').value,'VIA PROVA 1');
  const saved=Object.fromEntries(Object.keys(p.w.localStorage).map(k=>[k,JSON.parse(p.w.localStorage.getItem(k))]));
  const q=await app(undefined,'',{local:saved});
  try{
   assert.equal(q.$('v9Committente').value,'AZIENDA TEST');
   assert.equal(q.$('v9Sede').value,'SEDE NORD');
   assert.equal(q.$('v9IndirizzoSede').value,'VIA PROVA 1');
   assert.equal(q.$('v9Email').value,'test@example.test');
   assert.deepEqual(q.errors,[]);
  }finally{q.dom.window.close()}
  assert.equal((await p.t.cartelle()).length,0);
  assert.deepEqual(p.errors,[]);
  console.log('PASS: two saved client sites, contact recall, site selection, session reload, zero medical records');
 }finally{p.dom.window.close()}
}
run().catch(e=>{console.error(e);process.exitCode=1});
