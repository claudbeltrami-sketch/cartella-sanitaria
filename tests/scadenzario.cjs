const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('../ruoli-azienda.js');require('../scadenzario.js');
const {build,filter,day}=globalThis.lumenScadenzario;
const base={cognome:'PROVA',nome:'ALFA',codice_fiscale:'TSTLFA80A01H501X',data_nascita:'1980-01-01',committente:'SERMOLAB',datore_lavoro:'AZIENDA FITTIZIA',luogo_visita:'SERMONETA',data_giudizio:'2026-09-01',prossima_visita:'2026-10-12',giudizio:'IDONEO'};
const rec=(id,d={},history=[])=>({id,updatedAt:'2026-10-13T16:00:00Z',data:{...base,...d},history});
assert.equal(day('31/02/2026'),'');assert.equal(day('29/02/2028'),'2028-02-29');
const records=[rec('a',{data_giudizio:'2026-10-13',prossima_visita:'2027-10-13'},[{data:base,savedAt:'2026-10-12'}]),
 rec('b',{nome:'BETA',codice_fiscale:'TESTB',prossima_visita:'2026-10-13'}),
 rec('c',{nome:'GAMMA',codice_fiscale:'TESTC',prossima_visita:'2026-11-12'}),
 rec('d',{nome:'DELTA',codice_fiscale:'TESTD',prossima_visita:'2026-12-12'}),
 rec('e',{nome:'EPSILON',codice_fiscale:'TESTE',prossima_visita:'2027-01-11'}),
 rec('f',{nome:'MANCANTE',codice_fiscale:'TESTF',prossima_visita:'',periodicita:''}),
 rec('g',{nome:'CESSATO',codice_fiscale:'TESTG',stato_rapporto:'CESSATO'}),
 rec('h',{nome:'SCADUTO',codice_fiscale:'TESTH'}),
 rec('i',{nome:'NUOVOCLIENTE',codice_fiscale:'TESTI',committente:'NUOVO COMMITTENTE'}),
 rec('j',{nome:'PROVA',codice_fiscale:'TESTJ',lumen_prova:true}),
 rec('k',{nome:'ERRATO',codice_fiscale:'TESTK',prossima_visita:'2026-08-01'}),
 rec('l',{nome:'ALTRO',codice_fiscale:'TESTL',committente:''}),
 rec('m',{nome:'PROVA',codice_fiscale:'TESTM',committente:'ORIZZONTE',datore_lavoro:'BLANCA SRL',luogo_visita:'GUIDONIA'})];
const before=JSON.stringify(records),s=build(records,'2026-10-13');
assert.equal(s.rows.length,11);assert.equal(s.unassigned,1);assert.equal(JSON.stringify(records),before);
assert.equal(filter(s.rows,{range:'overdue'}).length,3);
assert.equal(filter(s.rows,{range:'30'}).length,2);assert.equal(filter(s.rows,{range:'60'}).length,3);assert.equal(filter(s.rows,{range:'90'}).length,4);
assert.equal(filter(s.rows,{range:'missing'}).length,2);assert.equal(filter(s.rows,{range:'ceased'}).length,1);assert.equal(filter(s.rows,{range:'all'}).length,10);
assert.equal(filter(s.rows,{range:'all',client:'ORIZZONTE',employer:'BLANCA',site:'GUIDONIA'}).length,1);
const homonyms=build([rec('one'),rec('two',{codice_fiscale:'OTHERCF'}),rec('duplicate')],'2026-10-13');assert.equal(homonyms.rows.length,2);
const jobs=build([rec('one'),rec('two',{datore_lavoro:'OTHER COMPANY'})],'2026-10-13');assert.equal(jobs.rows.length,2);
const lateImport=build([rec('old',{data_giudizio:'2026-08-01'}),{...rec('new',{data_giudizio:'2026-10-01',prossima_visita:'2027-10-01'}),updatedAt:'2026-10-01'}],'2026-10-13');assert.equal(lateImport.rows[0].next,'2027-10-01');
const missingRenewal=build([rec('a',{data_giudizio:'2026-10-13',prossima_visita:''},[{data:base,savedAt:'2026-09-01'}])],'2026-10-13');assert.equal(missingRenewal.rows[0].status,'DA COMPLETARE');

const {deadline,recover}=globalThis.lumenScadenzario;
for(const [p,last,next] of [['ANNUALE','2026-10-12','2027-10-12'],['BIENNALE','2026-10-12','2028-10-12'],['QUINQUENNALE','2026-10-12','2031-10-12'],['ANNUALE','2024-02-29','2025-02-28'],['SEMESTRALE','2026-08-31','2027-02-28'],['6 MESI','2026-10-13','2027-04-13'],['30 GIORNI','2026-10-13','2026-11-12']])assert.equal(deadline({periodicita:p},last).next,next);
assert.equal(deadline({periodicita:'ALTRO',periodicita_altro:'18 MESI'},'2026-10-13').next,'2028-04-13');
assert.equal(deadline({periodicita:'ANNUALE',prossima_visita:'2027-01-01'},'2026-10-13').next,'2027-01-01');
assert.equal(deadline({periodicita:'ANNUALE',prossima_visita:'31/02/2027'},'2026-10-13').next,'');
assert.equal(deadline({periodicita:'ANNUALE O SEMESTRALE'},'2026-10-13').next,'');
const annual=build([rec('a',{prossima_visita:'',periodicita:'ANNUALE',luogo_visita:'',giudizio:''})],'2026-10-13').rows[0];assert.equal(annual.next,'2027-09-01');assert.equal(annual.status,'PROGRAMMATO');assert.ok(annual.siteWarning);assert.equal(filter([annual],{range:'missing'}).length,0);
const session={data:'2026-09-01',committente:'SERMOLAB',azienda:base.datore_lavoro,sede:'SEDE CERTA',workers:[base]};
const blank=rec('site',{luogo_visita:''});
assert.equal(recover(blank,blank.data,[session]).data.luogo_visita,'SEDE CERTA');
assert.equal(recover(blank,blank.data,[{...session,data:'2026-09-02'}]).data.luogo_visita,'');
assert.equal(recover(blank,blank.data,[{...session,workers:[{...base,codice_fiscale:'OTHER'}]}]).data.luogo_visita,'');
assert.equal(recover(blank,blank.data,[session,{...session,sede:'ALTRA SEDE'}]).data.luogo_visita,'');
assert.match(recover(blank,blank.data,[session,{...session,sede:'ALTRA SEDE'}]).siteWarning,/ambigua/);
const historical=rec('history',{luogo_visita:''},[{data:{...base,luogo_visita:'SEDE STORICA'}}]);assert.equal(recover(historical,historical.data,[]).data.luogo_visita,'SEDE STORICA');
const counted={...blank,conteggioVisits:{'2026-09-01':{date:'2026-09-01',client:'SERMOLAB',company:base.datore_lavoro,place:'SEDE CONTEGGIO'}}};assert.equal(recover(counted,counted.data,[]).data.luogo_visita,'SEDE CONTEGGIO');
const noClient=rec('no-client',{committente:'',luogo_visita:''});assert.equal(build([noClient],'2026-10-13',[session]).rows[0].site,'SEDE CERTA');
assert.equal(recover(blank,blank.data,[{...session,esiti:{[base.codice_fiscale]:'ASSENTE'}}]).data.luogo_visita,'');
(async()=>{
 const {app}=require('./allegati-dom.cjs'),p=await app();
 try{
  assert.deepEqual(p.errors,[]);p.w.eval(fs.readFileSync(path.join(__dirname,'../vendor/pdf-lib.min.js'),'utf8'));
  for(const r of records)if(!r.data.lumen_prova)await p.t.putCartellaRecord(r);
  p.api.apply({...base,prossima_visita:'2027-09-01',stato_rapporto:'CESSATO'});
  assert.equal(p.api.collect().prossima_visita,'2027-09-01');assert.equal(p.api.collect().stato_rapporto,'CESSATO');
  const original=JSON.stringify(p.api.collect()),archive=JSON.stringify(await p.t.cartelle());
  await p.$('btnScadenzario').onclick();assert.equal(p.$('scadenzarioDialog').open,true);assert.match(p.$('scRows').textContent,/MANCANTE/);assert.ok(p.$('scRows').textContent.includes('NUOVOCLIENTE'));assert.ok([...p.$('scClient').options].some(o=>o.value==='NUOVO COMMITTENTE'));
  p.$('scRange').value='missing';p.$('scRange').dispatchEvent(new p.w.Event('input'));assert.match(p.$('scRows').textContent,/MANCANTE/);
  p.$('scRange').value='all';p.$('scRange').dispatchEvent(new p.w.Event('input'));await p.$('scPdf').onclick();assert.ok(p.downloads.length,p.$('scMessage').textContent);assert.equal(p.downloads.at(-1).blob.type,'application/pdf');
  const out=path.join(__dirname,'../tmp/scadenzario');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'elenco.pdf'),Buffer.from(await p.downloads.at(-1).blob.arrayBuffer()));
  p.$('scClient').value='GRUPPO ORIZZONTE';p.$('scClient').dispatchEvent(new p.w.Event('input'));
  assert.equal(p.$('scTitle').textContent,'SCADENZARIO VISITE — GRUPPO ORIZZONTE');assert.ok(!p.$('scRows').textContent.includes('SERMOLAB'));
  assert.match(p.$('scMessage').textContent,/Visualizzati: 1/);assert.match(p.$('scMessage').textContent,/Scaduti: 1/);
  await p.$('scPdf').onclick();assert.match(p.downloads.at(-1).name,/GRUPPO_ORIZZONTE/);
  fs.writeFileSync(path.join(out,'solo-orizzonte.pdf'),Buffer.from(await p.downloads.at(-1).blob.arrayBuffer()));
  p.$('scClient').value='SERMOLAB';p.$('scClient').dispatchEvent(new p.w.Event('input'));
  assert.equal(p.$('scTitle').textContent,'SCADENZARIO VISITE — SERMOLAB');assert.ok(!p.$('scRows').textContent.includes('ORIZZONTE'));
  p.$('scClient').value='';p.$('scClient').dispatchEvent(new p.w.Event('input'));assert.match(p.$('scTitle').textContent,/TUTTI I COMMITTENTI/);

  p.$('scClient').value='NUOVO COMMITTENTE';p.$('scClient').dispatchEvent(new p.w.Event('input'));
  assert.match(p.$('scTitle').textContent,/NUOVO COMMITTENTE/);assert.equal(p.$('scRows').querySelectorAll('tbody tr').length,1);
  p.$('scEmployer').value='INESISTENTE';p.$('scEmployer').dispatchEvent(new p.w.Event('input'));assert.equal(p.$('scPdf').disabled,true);
  p.$('scEmployer').value='FITTIZIA';p.$('scEmployer').dispatchEvent(new p.w.Event('input'));assert.equal(p.$('scPdf').disabled,false);
  await p.$('scPdf').onclick();fs.writeFileSync(path.join(out,'nuovo-committente.pdf'),Buffer.from(await p.downloads.at(-1).blob.arrayBuffer()));
  await p.t.putCartellaRecord(rec('extra',{codice_fiscale:'EXTRACF',committente:'NUOVO COMMITTENTE PLUS'}));
  await p.$('scReload').onclick();assert.equal(p.$('scClient').value,'NUOVO COMMITTENTE');assert.equal(p.$('scRows').querySelectorAll('tbody tr').length,1);assert.ok([...p.$('scClient').options].some(o=>o.value==='NUOVO COMMITTENTE PLUS'));
  // Remove only the synthetic extra record so the read-only assertions below remain valid.
  await new Promise((resolve,reject)=>{const request=p.w.indexedDB.open('beltrami_cartelle_db_v1');request.onsuccess=()=>{const db=request.result,tx=db.transaction('cartelle','readwrite');tx.objectStore('cartelle').delete('extra');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}});
  p.$('scClient').value='';p.$('scEmployer').value='';p.$('scClient').dispatchEvent(new p.w.Event('input'));
  const many=Array.from({length:70},(_,i)=>({...s.rows[i%s.rows.length],name:'LAVORATORE FITTIZIO '+i}));
  const bytes=await (await p.w.lumenScadenzario.pdf(many,'COLLAUDO MULTIPAGINA','2026-10-13')).arrayBuffer();fs.writeFileSync(path.join(out,'multipagina.pdf'),Buffer.from(bytes));
  const doc=await p.w.PDFLib.PDFDocument.load(new p.w.Uint8Array(bytes));assert.ok(doc.getPageCount()>1);
  assert.equal(JSON.stringify(p.api.collect()),original);assert.equal(JSON.stringify(await p.t.cartelle()),archive);
  p.$('scClose').onclick();assert.equal(p.$('scadenzarioDialog').open,false);
  p.api.popolaCertificato(undefined,false);assert.equal(p.$('c_prossima_visita').textContent,'01/09/2027');
  p.api.apply(base);assert.equal(p.api.collect().stato_rapporto,'');
  await p.api.saveToLocalArchive({...base,prossima_visita:'2027-01-01'});assert.equal((await p.api.getCartellaRecord(p.api.cartellaId(base))).data.prossima_visita,'2027-01-01');
  await p.t.backup();p.$('lumenBackupDownload').click();const backup=JSON.parse(await p.downloads.at(-1).blob.text());assert.ok(backup.contenuto.cartelle.some(r=>r.data.prossima_visita==='2027-01-01'));
  const edit=rec('editable',{prossima_visita:'',periodicita:'ANNUALE'});await p.t.putCartellaRecord(edit);
  const selected=p.w.lumenScadenzario.build([edit],'2026-10-13').rows[0];assert.equal(selected.next,'2027-09-01');
  p.api.apply({...edit.data,prescrizioni:'BOZZA NON SALVATA'});
  await p.w.lumenScadenzario.saveDate(selected,'2027-03-01',[]);
  assert.equal(p.api.collect().prossima_visita,'2027-03-01');assert.equal(p.api.collect().prescrizioni,'BOZZA NON SALVATA');
  let updated=await p.api.getCartellaRecord('editable');assert.equal(updated.data.prossima_visita,'2027-03-01');assert.equal(updated.history.at(-1).data.prossima_visita,'');
  await assert.rejects(()=>p.w.lumenScadenzario.saveDate(selected,'2027-04-01',[]),/cambiata/);
  const fresh=p.w.lumenScadenzario.build([updated],'2026-10-13').rows[0];assert.equal(fresh.next,'2027-03-01');
  await assert.rejects(()=>p.w.lumenScadenzario.saveDate(fresh,'2026-01-01',[]),/precedere/);
  await assert.rejects(()=>p.w.lumenScadenzario.saveDate(fresh,'',[]),/valida/);
  const hist=rec('hist-edit',{data_giudizio:'2026-08-01',prossima_visita:'2027-08-01'},[{savedAt:'2026-09-01',data:base}]);await p.t.putCartellaRecord(hist);
  const selectedHist=p.w.lumenScadenzario.build([hist],'2026-10-13').rows[0];assert.equal(selectedHist.last,'2026-09-01');
  await p.w.lumenScadenzario.saveDate(selectedHist,'2027-02-01',[]);updated=await p.api.getCartellaRecord('hist-edit');assert.equal(updated.data.prossima_visita,'2027-08-01');assert.equal(updated.history[0].data.prossima_visita,base.prossima_visita);assert.equal(p.w.lumenScadenzario.build([updated],'2026-10-13').rows[0].next,'2027-02-01');
  assert.deepEqual(p.errors,[]);console.log('PASS: exact dates and boundaries, renewal/history/deduplication, clients and combined filters, ceased/ghost excluded, missing/invalid dates, local archive UI, field persistence/backup, PDF pagination, no form/archive mutations.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
