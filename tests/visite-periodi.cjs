// Test regressione ricerca per mese/anno/intervallo: solo cartelle sintetiche.
const {app}=require('./allegati-dom.cjs'),{jsPDF}=require('jspdf'),assert=require('node:assert/strict');
const work=(id,day,client='SERMOLAB')=>({
 cognome:'PROVA '+id,nome:'FITTIZIO',codice_fiscale:'TEST'+String(id).padStart(12,'0'),
 data_nascita:'1980-01-01',data_cartella:day,data_giudizio:day,
 committente:client,datore_lavoro:'AZIENDA FITTIZIA',mansione:'IMPIEGATO',
 giudizio:'IDONEO',luogo_visita:'ROMA',firma_lavoratore_png:''
});
(async()=>{
 const p=await app();
 try{
  p.w.jspdf={jsPDF};
  await p.api.saveToLocalArchive(work(1,'2026-01-03'));
  await p.api.saveToLocalArchive(work(1,'2026-01-20'));
  await p.api.saveToLocalArchive(work(2,'2026-01-21'));
  await p.api.saveToLocalArchive(work(3,'2026-02-02'));
  await p.api.saveToLocalArchive(work(4,'2026-01-15','ALTRO'));
  const before=JSON.stringify(await p.t.cartelle()),api=p.w.lumenArchiveVisitsApi,records=await api.list();
  assert.equal(api.selectPeriod(records,'2026-01-01','2026-01-31').length,4,'visite ripetute conteggiate');
  assert.equal(api.selectPeriod(records,'2026-01-01','2026-01-31').filter(r=>r.data.codice_fiscale===work(1,'2026-01-03').codice_fiscale).length,2);
  assert.equal(api.selectPeriod(records,'2026-01-15','2026-01-21').length,3);
  assert.equal(api.selectDate(records,'2026-01-03').length,1);
  await p.$('btnElencoVisiteArchivio').onclick();
  const mode=p.$('visiteArchiveMode');
  mode.value='mese';mode.onchange();
  p.$('visiteArchiveMonth').value='2026-01';p.$('visiteArchiveMonth').onchange();
  p.$('visiteArchiveClientFilter').value='SERMOLAB';p.$('visiteArchiveClientFilter').oninput();
  await p.$('visiteArchiveLoad').onclick();
  assert.match(p.$('visiteArchiveMessage').textContent,/3 VISITE TROVATE — 3 SELEZIONATE/);
  assert.match(p.$('visiteArchiveRows').textContent,/Data visita/);
  assert.equal(p.$('visiteArchiveCertificates').disabled,true);
  assert.equal(p.$('visiteArchivePdf').disabled,false);
  await p.$('visiteArchivePdf').onclick();
  assert.match(p.$('visiteArchiveMessage').textContent,/ELENCO PDF PREPARATO: 3 VISITE/);
  assert.equal(p.$('visiteArchiveCertificates').disabled,true);
  mode.value='anno';mode.onchange();p.$('visiteArchiveYear').value='2026';p.$('visiteArchiveYear').onchange();
  await p.$('visiteArchiveLoad').onclick();assert.match(p.$('visiteArchiveMessage').textContent,/4 VISITE TROVATE/);
  mode.value='intervallo';mode.onchange();p.$('visiteArchiveFrom').value='2026-01-20';
  p.$('visiteArchiveTo').value='2026-01-21';p.$('visiteArchiveTo').onchange();
  await p.$('visiteArchiveLoad').onclick();assert.match(p.$('visiteArchiveMessage').textContent,/2 VISITE TROVATE/);
  p.$('visiteArchiveFrom').value='2026-01-22';p.$('visiteArchiveFrom').onchange();
  await p.$('visiteArchiveLoad').onclick();assert.match(p.$('visiteArchiveMessage').textContent,/non può essere successiva/);
  mode.value='giorno';mode.onchange();p.$('visiteArchiveDate').value='2026-01-20';p.$('visiteArchiveDate').onchange();
  await p.$('visiteArchiveLoad').onclick();assert.match(p.$('visiteArchiveMessage').textContent,/1 VISITE TROVATE/);
  assert.equal(p.$('visiteArchiveCertificates').disabled,false);
  assert.equal(JSON.stringify(await p.t.cartelle()),before,'nessuna riscrittura delle cartelle');
  assert.deepEqual(p.errors,[]);
  console.log('PASS: mese, anno, intervallo, filtro committente, PDF, visite ripetute, nessuna modifica archivio.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
