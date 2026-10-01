const {app}=require('./allegati-dom.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const p=await app();
 try{
  const day='2026-09-30';
  for(let i=0;i<16;i++){
   await p.api.saveToLocalArchive({cognome:'SINTETICO',nome:'PERSONA '+i,codice_fiscale:'TEST'+i,giudizio:'IDONEO',data_giudizio:day,datore_lavoro:'FITTIZIA'});
  }
  for(const r of await p.t.cartelle())await p.w.lumenConteggioStorage.change(r.id,x=>{delete x.conteggioVisits});
  const before=(await p.t.cartelle()).map(({data,history,updatedAt,createdAt})=>({data,history,updatedAt,createdAt}));
  await p.$('btnConteggioAuto').onclick();
  const select=p.$('conteggioAutoArchiveDates');
  assert.equal([...select.options].find(x=>x.value===day).textContent,'30/09/2026 · 16 VISITE');
  select.value=day;select.onchange();p.$('conteggioAutoClient').value='SERMOLAB';
  p.$('conteggioAutoClose').onclick();await p.$('btnConteggioAuto').onclick();
  assert.equal(p.$('conteggioAutoDate').value,day);assert.equal(p.$('conteggioAutoClient').value,'SERMOLAB');
  const sent=[];
  p.w.localStorage.setItem('lumen_conteggio_link_v1',JSON.stringify({version:1,token:'a'.repeat(64),salt:'b'.repeat(64),account:'TEST',expires:Date.now()+86400000}));
  p.w.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);sent.push(b);return {ok:true,json:async()=>({ok:true,visitId:b.visitId})}};
  await p.$('conteggioAutoConfigure').onclick();
  for(let n=0;n<100;n++){await new Promise(r=>setTimeout(r,10));if((await p.t.cartelle()).every(x=>x.conteggioVisits[day].status==='sent'))break}
  assert.equal(sent.length,16);assert(sent.every(x=>x.date===day&&x.client==='SERMOLAB'));
  assert.equal(p.$('conteggioAutoDate').value,day);
  assert.match(p.$('conteggioAutoDetails').textContent,/2026-09-30 → SERMOLAB/);
  await p.$('conteggioAutoConfigure').onclick();await new Promise(r=>setTimeout(r,30));assert.equal(sent.length,16);
  assert.deepEqual((await p.t.cartelle()).map(({data,history,updatedAt,createdAt})=>({data,history,updatedAt,createdAt})),before);
  p.$('conteggioAutoDate').value='2026-08-01';p.$('conteggioAutoDate').onchange();p.$('conteggioAutoClient').value='TEST';await p.$('conteggioAutoConfigure').onclick();
  assert.match(p.$('conteggioAutoResult').textContent,/NESSUNA VISITA COMPLETA TROVATA/);
  assert.deepEqual(p.errors,[]);
  console.log('PASS: archive date chooser; selected date/client survive reopening; 16 old visits recovered and acknowledged; repeat does not duplicate; clinical records unchanged; missing-date diagnostic.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
