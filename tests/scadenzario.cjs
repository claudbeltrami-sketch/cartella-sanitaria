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
 rec('f',{nome:'MANCANTE',codice_fiscale:'TESTF',prossima_visita:'',periodicita:'ANNUALE'}),
 rec('g',{nome:'CESSATO',codice_fiscale:'TESTG',stato_rapporto:'CESSATO'}),
 rec('h',{nome:'SCADUTO',codice_fiscale:'TESTH'}),
 rec('i',{nome:'ESTERNO',codice_fiscale:'TESTI',committente:'CARITAS'}),
 rec('j',{nome:'PROVA',codice_fiscale:'TESTJ',lumen_prova:true}),
 rec('k',{nome:'ERRATO',codice_fiscale:'TESTK',prossima_visita:'2026-08-01'}),
 rec('l',{nome:'ALTRO',codice_fiscale:'TESTL',committente:''}),
 rec('m',{nome:'PROVA',codice_fiscale:'TESTM',committente:'ORIZZONTE',datore_lavoro:'BLANCA SRL',luogo_visita:'GUIDONIA'})];
const before=JSON.stringify(records),s=build(records,'2026-10-13');
assert.equal(s.rows.length,10);assert.equal(s.unassigned,1);assert.equal(JSON.stringify(records),before);
assert.equal(filter(s.rows,{range:'overdue'}).length,2);
assert.equal(filter(s.rows,{range:'30'}).length,2);assert.equal(filter(s.rows,{range:'60'}).length,3);assert.equal(filter(s.rows,{range:'90'}).length,4);
assert.equal(filter(s.rows,{range:'missing'}).length,2);assert.equal(filter(s.rows,{range:'ceased'}).length,1);assert.equal(filter(s.rows,{range:'all'}).length,9);
assert.equal(filter(s.rows,{range:'all',client:'ORIZZONTE',employer:'BLANCA',site:'GUIDONIA'}).length,1);
const homonyms=build([rec('one'),rec('two',{codice_fiscale:'OTHERCF'}),rec('duplicate')],'2026-10-13');assert.equal(homonyms.rows.length,2);
const jobs=build([rec('one'),rec('two',{datore_lavoro:'OTHER COMPANY'})],'2026-10-13');assert.equal(jobs.rows.length,2);
const lateImport=build([rec('old',{data_giudizio:'2026-08-01'}),{...rec('new',{data_giudizio:'2026-10-01',prossima_visita:'2027-10-01'}),updatedAt:'2026-10-01'}],'2026-10-13');assert.equal(lateImport.rows[0].next,'2027-10-01');
const missingRenewal=build([rec('a',{data_giudizio:'2026-10-13',prossima_visita:''},[{data:base,savedAt:'2026-09-01'}])],'2026-10-13');assert.equal(missingRenewal.rows[0].status,'DA COMPLETARE');
(async()=>{
 const {app}=require('./allegati-dom.cjs'),p=await app();
 try{
  assert.deepEqual(p.errors,[]);p.w.eval(fs.readFileSync(path.join(__dirname,'../vendor/pdf-lib.min.js'),'utf8'));
  for(const r of records)if(!r.data.lumen_prova)await p.t.putCartellaRecord(r);
  p.api.apply({...base,prossima_visita:'2027-09-01',stato_rapporto:'CESSATO'});
  assert.equal(p.api.collect().prossima_visita,'2027-09-01');assert.equal(p.api.collect().stato_rapporto,'CESSATO');
  const original=JSON.stringify(p.api.collect()),archive=JSON.stringify(await p.t.cartelle());
  await p.$('btnScadenzario').onclick();assert.equal(p.$('scadenzarioDialog').open,true);assert.match(p.$('scRows').textContent,/MANCANTE/);assert.ok(!p.$('scRows').textContent.includes('ESTERNO'));
  p.$('scRange').value='missing';p.$('scRange').dispatchEvent(new p.w.Event('input'));assert.match(p.$('scRows').textContent,/MANCANTE/);
  p.$('scRange').value='all';p.$('scRange').dispatchEvent(new p.w.Event('input'));await p.$('scPdf').onclick();assert.ok(p.downloads.length,p.$('scMessage').textContent);assert.equal(p.downloads.at(-1).blob.type,'application/pdf');
  const out=path.join(__dirname,'../tmp/scadenzario');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'elenco.pdf'),Buffer.from(await p.downloads.at(-1).blob.arrayBuffer()));
  const many=Array.from({length:70},(_,i)=>({...s.rows[i%s.rows.length],name:'LAVORATORE FITTIZIO '+i}));
  const bytes=await (await p.w.lumenScadenzario.pdf(many,'COLLAUDO MULTIPAGINA','2026-10-13')).arrayBuffer();fs.writeFileSync(path.join(out,'multipagina.pdf'),Buffer.from(bytes));
  const doc=await p.w.PDFLib.PDFDocument.load(new p.w.Uint8Array(bytes));assert.ok(doc.getPageCount()>1);
  assert.equal(JSON.stringify(p.api.collect()),original);assert.equal(JSON.stringify(await p.t.cartelle()),archive);
  p.$('scClose').onclick();assert.equal(p.$('scadenzarioDialog').open,false);
  p.api.popolaCertificato(undefined,false);assert.equal(p.$('c_prossima_visita').textContent,'01/09/2027');
  p.api.apply(base);assert.equal(p.api.collect().stato_rapporto,'');
  await p.api.saveToLocalArchive({...base,prossima_visita:'2027-01-01'});assert.equal((await p.api.getCartellaRecord(p.api.cartellaId(base))).data.prossima_visita,'2027-01-01');
  await p.t.backup();p.$('lumenBackupDownload').click();const backup=JSON.parse(await p.downloads.at(-1).blob.text());assert.ok(backup.contenuto.cartelle.some(r=>r.data.prossima_visita==='2027-01-01'));
  assert.deepEqual(p.errors,[]);console.log('PASS: exact dates and boundaries, renewal/history/deduplication, clients and combined filters, ceased/ghost excluded, missing/invalid dates, local archive UI, field persistence/backup, PDF pagination, no form/archive mutations.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
