// Regression test for the absence toggle, with synthetic workers only.
const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
const S='beltrami_v9_sessione_attiva',W='beltrami_workers_v8',E='beltrami_v9_esiti';
const workers=[
 {id:'abs-1',cognome:'TEST',nome:'UNO',visited:false},
 {id:'abs-2',cognome:'TEST',nome:'DUE',visited:true},
 {id:'abs-3',cognome:'TEST',nome:'TRE',visited:false}
];
const local={ [W]:{workers,currentWorkerIndex:-1,attachedSourceName:'collaudo.csv'},
 [S]:{id:'abs-test',data:'2026-10-12',stato:'IN CORSO',committente:'COLLAUDO',sede:'SEDE TEST'} };
const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
function button(p,i){return p.$('workersBody').querySelectorAll('tr')[i].querySelector('.v9-assente-btn')}
function status(p){return JSON.parse(p.w.localStorage.getItem(E)||'{}')}
function count(p){return p.$('v9Card').textContent}
(async()=>{
 const p=await app(undefined,'',{local});
 try{
  assert.deepEqual(p.errors,[]);
  assert.equal(button(p,0).textContent,'SEGNA ASSENTE');
  button(p,0).click();await tick();
  assert.equal(status(p)['abs-1'],'ASSENTE');
  assert.equal(button(p,0).textContent,'ANNULLA ASSENTE');
  assert.match(count(p),/assenti 1/);
  button(p,2).click();await tick();
  assert.equal(status(p)['abs-3'],'ASSENTE');
  assert.match(count(p),/visitati 1/);
  assert.match(count(p),/assenti 2/);
  button(p,0).click();await tick();
  assert.equal(status(p)['abs-1'],undefined);
  assert.equal(button(p,0).textContent,'SEGNA ASSENTE');
  assert.match(count(p),/assenti 1/);
  const local2=Object.fromEntries(Object.keys(p.w.localStorage).map(k=>[k,JSON.parse(p.w.localStorage.getItem(k))]));
  const reopened=await app(undefined,'',{local:local2});
  try{
   assert.equal(button(reopened,2).textContent,'ANNULLA ASSENTE');
   assert.equal(button(reopened,0).textContent,'SEGNA ASSENTE');
   assert.match(count(reopened),/assenti 1/);
   assert.deepEqual(reopened.errors,[]);
  }finally{reopened.dom.window.close()}
  assert.equal((await p.t.cartelle()).length,0);
  assert.deepEqual(p.errors,[]);
  console.log('PASS: toggle, undo, counters, reload persistence; synthetic workers; no medical records');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
