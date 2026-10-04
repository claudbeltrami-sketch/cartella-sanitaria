// Regression: 24 visits on one date, only six matching the archive search.
// All identities and data are synthetic and use an isolated in-memory database.
const {app}=require('./allegati-dom.cjs');
const {jsPDF}=require('jspdf');
const assert=require('node:assert/strict');
const date='2026-09-30',otherDate='2026-09-28';
const worker=n=>({cognome:'COLLAUDO '+String(n).padStart(2,'0'),nome:'FITTIZIO',codice_fiscale:'TEST'+String(n).padStart(12,'0'),data_nascita:'1980-01-01',data_giudizio:date,data_cartella:date,datore_lavoro:n<=4?'SERMOLAB CBV':n<=6?'CBV':'ALTRA AZIENDA',mansione:'COLLAUDO',giudizio:'IDONEO',luogo_visita:'SEDE FITTIZIA',firma_lavoratore_png:''});
(async()=>{
 const p=await app();
 try{
  for(let n=1;n<=24;n++)await p.api.saveToLocalArchive(worker(n));
  // A current record on a later date still exposes its historical visit.
  await p.api.saveToLocalArchive({...worker(1),data_giudizio:'2026-10-05'});
  await p.api.saveToLocalArchive({...worker(2),data_giudizio:otherDate});
  const before=JSON.stringify(await p.t.cartelle());
  await p.t.backup();assert.equal(JSON.parse(await p.downloads.at(-1).blob.text()).contenuto.cartelle.length,24);
  p.w.jspdf={jsPDF};
  async function open(query,expected){
   if(p.$('visiteArchiveDialog').open)p.$('visiteArchiveClose').onclick();
   p.$('archiveQuery').value=query;await p.t.renderArchive(query);
   assert.equal(p.w.lumenArchiveVisitsApi.getFilter(),query.trim());
   p.$('visiteArchiveDate').value=date;await p.$('btnElencoVisiteArchivio').onclick();
   assert.equal(p.$('visiteArchiveMessage').textContent,`${expected} VISITE TROVATE — ${expected} SELEZIONATE`);
  }
  await open(' cbv ',6);
  assert.match(p.$('archiveSummary').textContent,/Cartelle trovate: 6/);
  assert.match(p.$('visiteArchiveFilter').textContent,/FILTRO ARCHIVIO: cbv/);
  assert.ok([...p.$('visiteArchiveRows').querySelectorAll('tbody tr')].every(r=>r.textContent.includes('CBV')));
  p.$('visiteArchiveClient').value='SERMOLAB';await p.$('visiteArchivePdf').onclick();
  assert.match(p.$('visiteArchiveMessage').textContent,/ELENCO PDF PREPARATO: 6 VISITE/);
  const pdf=Buffer.from(await p.downloads.at(-1).blob.arrayBuffer()).toString('latin1');
  assert.ok(pdf.includes('COLLAUDO 06'));assert.ok(!pdf.includes('COLLAUDO 07'));
  const rendered=[];
  p.w.html2canvas=async()=>{rendered.push({...p.api.collect()});return {toDataURL:()=> 'FAKE_RASTER'}};
  p.w.jspdf={jsPDF:class{addPage(){}addImage(){}output(){return new Blob(['CERTIFICATI FITTIZI'],{type:'application/pdf'})}}};
  await p.$('visiteArchiveCertificates').onclick();assert.equal(rendered.length,6,p.$('visiteArchiveMessage').textContent+' '+p.errors.join('; '));assert.ok(rendered.every(d=>d.datore_lavoro.includes('CBV')&&d.data_giudizio===date));
  await open('SERMOLAB CBV',4);
  p.$('visiteArchiveDate').value=otherDate;p.$('visiteArchiveDate').onchange();
  assert.equal(p.$('visiteArchivePdf').disabled,true);await p.$('visiteArchiveLoad').onclick();
  assert.equal(p.$('visiteArchiveMessage').textContent,'1 VISITE TROVATE — 1 SELEZIONATE');
  p.$('visiteArchiveDate').value='2026-01-01';p.$('visiteArchiveDate').onchange();await p.$('visiteArchiveLoad').onclick();
  assert.equal(p.$('visiteArchiveMessage').textContent,'0 VISITE TROVATE — 0 SELEZIONATE');
  assert.equal(p.$('visiteArchiveCertificates').disabled,true);
  await open('INESISTENTE',0);assert.equal(p.$('visiteArchivePdf').disabled,true);
  await open('',24);assert.match(p.$('visiteArchiveFilter').textContent,/TUTTE LE CARTELLE/);
  await open('TEST000000000006',1);
  // An unapplied edit of the search box must not change the displayed scope.
  p.$('visiteArchiveClose').onclick();p.$('archiveQuery').value='ALTRA AZIENDA';
  await p.$('btnElencoVisiteArchivio').onclick();assert.equal(p.$('visiteArchiveMessage').textContent,'1 VISITE TROVATE — 1 SELEZIONATE');
  assert.equal(JSON.stringify(await p.t.cartelle()),before);assert.deepEqual(p.errors,[]);
  console.log('PASS: CBV 6/24, combined search 4, exact date and historical snapshots, PDF and certificates restricted to six, no-result filter stays empty, all-record reset, CF search, applied query scope, backup, no archive changes.');
 }finally{p.dom.window.close()}
 // Exercise the actual PROVA namespace as well as multi-worker synthetic data.
 const ghost=await app(undefined,'?prova=fantasma');
 try{
  const d={...ghost.api.collect(),datore_lavoro:'SERMOLAB CBV',data_giudizio:date,data_cartella:date,giudizio:'IDONEO'};
  await ghost.api.saveToLocalArchive(d);await ghost.t.renderArchive('CBV');ghost.$('visiteArchiveDate').value=date;
  await ghost.$('btnElencoVisiteArchivio').onclick();assert.equal(ghost.$('visiteArchiveMessage').textContent,'1 VISITE TROVATE — 1 SELEZIONATE');
  ghost.$('visiteArchiveClose').onclick();await ghost.t.renderArchive('INESISTENTE');await ghost.$('btnElencoVisiteArchivio').onclick();
  assert.equal(ghost.$('visiteArchiveMessage').textContent,'0 VISITE TROVATE — 0 SELEZIONATE');assert.deepEqual(ghost.errors,[]);
  console.log('PASS: actual PROVA FANTASMA mode, inherited archive filter, no fallback to the full archive.');
 }finally{ghost.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
