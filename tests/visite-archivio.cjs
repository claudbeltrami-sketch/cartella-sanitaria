// Synthetic archive records only; actual jsPDF list rendering and simulated
// certificate rasterization. No clinical files or external services are used.
const {app}=require('./allegati-dom.cjs'),{jsPDF}=require('jspdf');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const date='2026-09-30';
function worker(n,d=date){return {cognome:'COLLAUDO '+String(n).padStart(2,'0'),nome:'NOME FITTIZIO',codice_fiscale:'TEST'+String(n).padStart(12,'0'),data_nascita:'1980-01-01',data_giudizio:d,data_cartella:d,mansione:n===3?'ADDETTO ALLA PREPARAZIONE E MOVIMENTAZIONE DELLE MERCI':'IMPIEGATO',datore_lavoro:n===4?'AZIENDA FITTIZIA CON DENOMINAZIONE ESTESA PER COLLAUDO IMPAGINAZIONE':'AZIENDA FITTIZIA',giudizio:'IDONEO',luogo_visita:'SEDE DI COLLAUDO',firma_lavoratore_png:''}}
(async()=>{
 const p=await app();try{
  assert.deepEqual(p.errors,[]);p.w.jspdf={jsPDF};const source=[];
  for(let n=1;n<=16;n++){const d=worker(n);await p.api.saveToLocalArchive(d);source.push(d)}
  // Revisions on the same date must not duplicate visits, and a later visit must
  // not replace a historical certificate requested for the selected date.
  await p.api.saveToLocalArchive({...worker(1),mansione:'IMPIEGATO AGGIORNATO'});await p.api.saveToLocalArchive(worker(1,'2026-10-05'));
  await p.api.saveToLocalArchive(worker(17,'2026-09-29'));const unchanged=JSON.stringify(await p.t.cartelle());
  const records=await p.w.lumenArchiveVisitsApi.list(),selected=p.w.lumenArchiveVisitsApi.selectDate(records,date);assert.equal(selected.length,16);assert.equal(selected[0].data.mansione,'IMPIEGATO AGGIORNATO');assert.ok(selected.every(r=>r.data.data_giudizio===date));
  const misleading=[{...records[0],updatedAt:date+'T12:00:00Z',data:worker(50,'2026-09-29'),history:[]}];assert.equal(p.w.lumenArchiveVisitsApi.selectDate(misleading,date).length,0);
  const duplicate=[...records,{id:'LEGACY',data:worker(2),updatedAt:'2026-09-30T23:00:00Z'}];assert.equal(p.w.lumenArchiveVisitsApi.selectDate(duplicate,date).length,16);
  const beforeDraft={...worker(99,'2026-09-28'),mansione:'BOZZA DA CONSERVARE'};p.api.apply(beforeDraft);const original=JSON.stringify(p.api.collect());
  await p.$('btnElencoVisiteArchivio').onclick();p.$('visiteArchiveDate').value=date;await p.$('visiteArchiveLoad').onclick();assert.match(p.$('visiteArchiveMessage').textContent,/16 VISITE TROVATE — 16 SELEZIONATE/);
  p.$('visiteArchiveClient').value='SERMOLAB';p.$('visiteArchivePdf').onclick();assert.match(p.$('visiteArchiveMessage').textContent,/ELENCO PDF PREPARATO: 16 VISITE/);
  const dir=path.join(__dirname,'../tmp/pdfs');fs.mkdirSync(dir,{recursive:true});const file=p.downloads.at(-1);fs.writeFileSync(path.join(dir,'elenco-16-fittizi.pdf'),Buffer.from(await file.blob.arrayBuffer()));
  const many=p.w.lumenArchiveVisitsApi.createListPdf(Array.from({length:65},(_,i)=>({data:worker(i+1)})),{data:date,committente:'COLLAUDO MULTIPAGINA'});assert.ok(many.getNumberOfPages()>1);fs.writeFileSync(path.join(dir,'elenco-multipagina-fittizio.pdf'),Buffer.from(many.output('arraybuffer')));
  p.$('visiteArchiveNone').onclick();assert.equal(p.$('visiteArchiveCertificates').disabled,true);p.$('visiteArchiveAll').onclick();
  const checkbox=p.$('visiteArchiveRows').querySelector('[data-row="15"]');checkbox.checked=false;checkbox.onchange();assert.match(p.$('visiteArchiveMessage').textContent,/15 SELEZIONATE/);checkbox.checked=true;checkbox.onchange();
  const rendered=[];let fail=false,pages=1;
  p.w.html2canvas=async()=>{rendered.push({...p.api.collect()});if(fail&&rendered.length===2)throw Error('COLLAUDO ERRORE RENDER');return {toDataURL:()=> 'FAKE_RASTER'}};
  p.w.jspdf={jsPDF:class{addPage(){pages++}addImage(){}output(){return new Blob(['CERTIFICATI FITTIZI'],{type:'application/pdf'})}}};
  await p.$('visiteArchiveCertificates').onclick();assert.equal(rendered.length,16);assert.equal(pages,16);assert.ok(rendered.every(d=>d.data_giudizio===date));assert.equal(rendered[0].mansione,'IMPIEGATO AGGIORNATO');assert.equal(JSON.stringify(p.api.collect()),original);assert.equal(JSON.stringify(await p.t.cartelle()),unchanged);assert.equal(p.$('saveActions').textContent,'PREPARA EMAIL');assert.equal(p.$('visiteArchiveDialog').open,false);
  await p.$('btnElencoVisiteArchivio').onclick();p.$('visiteArchiveDate').value=date;await p.$('visiteArchiveLoad').onclick();rendered.length=0;fail=true;await p.$('visiteArchiveCertificates').onclick();assert.equal(JSON.stringify(p.api.collect()),original);assert.equal(JSON.stringify(await p.t.cartelle()),unchanged);assert.equal(p.$('visiteArchiveDialog').open,true);assert.equal(p.errors.length,1);assert.match(p.errors[0],/COLLAUDO ERRORE RENDER/);
  p.$('visiteArchiveDate').value='2026-09-29';p.$('visiteArchiveDate').onchange();assert.equal(p.$('visiteArchiveCertificates').disabled,true);await p.$('visiteArchiveLoad').onclick();assert.match(p.$('visiteArchiveMessage').textContent,/1 VISITE TROVATE — 1 SELEZIONATE/);
  console.log('PASS: exact clinical date (not save date), history selection, newest same-date version, identity deduplication, 16 entries, list PDF and multipage output, selection controls, 16 certificate snapshots/pages, no archived mutations, draft restored on success/failure, email action prepared only.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
