const assert=require('node:assert/strict');
require('../ruoli-azienda.js');
const roles=globalThis.lumenRuoliAzienda;
const {app}=require('./allegati-dom.cjs');
const {jsPDF}=require('jspdf');
const {IDBFactory}=require('fake-indexeddb');
const date='2026-04-10';
const worker=(n,company,client='')=>({cognome:'COLLAUDO',nome:'RUOLI '+n,codice_fiscale:'TEST'+String(n).padStart(12,'0'),data_nascita:'1980-01-01',data_cartella:date,data_giudizio:date,datore_lavoro:company,committente:client,mansione:'COLLAUDO',giudizio:'IDONEO',luogo_visita:'ROMA',firma_lavoratore_png:'',anamnesi_patologica:'DATO FITTIZIO DA CONSERVARE'});
(async()=>{
 for(const [company,client,employer]of [['SERMOLAB - ALFA SRL','SERMOLAB','ALFA SRL'],['ORIZZONTE GUIDONIA BETA SRL','GRUPPO ORIZZONTE','BETA SRL'],['ORIZZONTE PRENESTINA GAMMA S.R.L.','GRUPPO ORIZZONTE','GAMMA S.R.L.'],['SERMOLAB','SERMOLAB',''],['ORIZZONTE GUIDONIA','GRUPPO ORIZZONTE',''],['SERMOLABOR SRL','','SERMOLABOR SRL'],['ALFA SRL','','ALFA SRL']]){
  const original=worker(1,company),before=JSON.stringify(original),d=roles.normalize(original);
  assert.equal(d.committente,client);assert.equal(d.datore_lavoro,employer);assert.equal(JSON.stringify(original),before);assert.deepEqual(roles.normalize(d),d);
 }
 assert.equal(roles.normalize({committente:'BUSINESS GROUP',datore_lavoro:'SERMOLAB - ALFA SRL'}).datore_lavoro,'SERMOLAB - ALFA SRL');
 assert.equal(roles.normalize({ruoli_azienda_versione:'1',committente:'SERMOLAB',datore_lavoro:'ORIZZONTE SRL'}).datore_lavoro,'ORIZZONTE SRL');
 const assigned={data:worker(8,'AZIENDA FITTIZIA'),conteggioVisits:{[date]:{date,client:'BUSINESS GROUP'}}};
 assert.equal(roles.forRecord(assigned).committente,'BUSINESS GROUP');assert.equal(roles.forRecord(assigned,{...assigned.data,data_giudizio:'2026-01-01'}).committente,'');
 assert.equal(roles.forRecord(assigned,{...assigned.data,committente:'SERMOLAB'}).committente,'SERMOLAB');
 const p=await app();
 try{
  const records=[worker(1,'SERMOLAB - ALFA SRL'),worker(2,'ALFA SRL','BUSINESS GROUP'),worker(3,'ORIZZONTE GUIDONIA BETA SRL'),worker(4,'SERMOLAB'),worker(5,'AZIENDA SENZA COMMITTENTE')];
  for(const d of records)await p.api.saveToLocalArchive(d);
  // Same worker now has another employer and commissioner: historical filters use the dated snapshot.
  await p.api.saveToLocalArchive({...records[0],committente:'BUSINESS GROUP',datore_lavoro:'NUOVA SRL',data_giudizio:'2026-10-07'});
  const before=JSON.stringify(await p.t.cartelle());
  p.$('archiveClient').value='ORIZZONTE';await p.t.renderArchive('');assert.match(p.$('archiveSummary').textContent,/Cartelle trovate: 1/);assert.match(p.$('archiveResults').textContent,/BETA SRL/);
  p.$('archiveClient').value='BUSINESS GROUP';p.$('archiveEmployer').value='ALFA';await p.t.renderArchive('');assert.match(p.$('archiveSummary').textContent,/Cartelle trovate: 1/);
  // Unapplied typed roles must not change the scope of the date dialog.
  p.$('archiveClient').value='NON APPLICATO';p.$('visiteArchiveDate').value=date;await p.$('btnElencoVisiteArchivio').onclick();
  assert.equal(p.$('visiteArchiveClientFilter').value,'BUSINESS GROUP');assert.equal(p.$('visiteArchiveRows').querySelectorAll('tbody tr').length,1);
  p.$('visiteArchiveClientFilter').value='SERMOLAB';p.$('visiteArchiveClientFilter').oninput();assert.equal(p.$('visiteArchivePdf').disabled,true);await p.$('visiteArchiveLoad').onclick();
  assert.equal(p.$('visiteArchiveRows').querySelectorAll('tbody tr').length,1);assert.match(p.$('visiteArchiveRows').textContent,/RUOLI 1/);assert.doesNotMatch(p.$('visiteArchiveRows').textContent,/RUOLI 2/);
  p.w.jspdf={jsPDF};await p.$('visiteArchivePdf').onclick();assert.match(p.$('visiteArchiveMessage').textContent,/ELENCO PDF PREPARATO: 1 VISITE/);
  const pdf=Buffer.from(await p.downloads.at(-1).blob.arrayBuffer());require('node:fs').mkdirSync('tmp',{recursive:true});require('node:fs').writeFileSync('tmp/ruoli-elenco.pdf',pdf);assert.ok(pdf.toString('latin1').includes('SERMOLAB'));
  p.$('visiteArchiveEmployerFilter').value='INESISTENTE';p.$('visiteArchiveEmployerFilter').oninput();await p.$('visiteArchiveLoad').onclick();assert.equal(p.$('visiteArchiveRows').querySelectorAll('tbody tr').length,0);assert.equal(p.$('visiteArchiveCertificates').disabled,true);
  assert.equal(JSON.stringify(await p.t.cartelle()),before,'Search and PDF must not rewrite the archive');
  p.$('visiteArchiveClose').onclick();
  await p.t.openArchiveRecord(p.api.cartellaId(records[2]));assert.equal(p.$('committente').value,'GRUPPO ORIZZONTE');assert.equal(p.$('datore_lavoro').value,'BETA SRL');
  assert.equal(JSON.stringify(await p.t.cartelle()),before,'Opening must not migrate the archive');
  const d=p.api.collect();assert.equal(d.datore_lavoro_originale,records[2].datore_lavoro);assert.equal(d.anamnesi_patologica,records[2].anamnesi_patologica);
  await p.api.saveToLocalArchive(d);const saved=await p.api.getCartellaRecord(p.api.cartellaId(d));assert.equal(saved.history.at(-1).data.datore_lavoro,records[2].datore_lavoro);p.api.apply(saved.data);assert.equal(p.api.collect().committente,'GRUPPO ORIZZONTE');
  p.api.popolaCertificato(undefined,false);assert.equal(p.$('c_azienda').textContent,'BETA SRL');
  const current=JSON.stringify(await p.t.cartelle());await p.t.backup();const backup=p.downloads.at(-1).blob;
  const fresh=await app(new IDBFactory());try{await fresh.t.restore(new File([await backup.arrayBuffer()],'backup.json'));assert.equal(JSON.stringify(await fresh.t.cartelle()),current)}finally{fresh.dom.window.close()}
  await p.$('btnTutteArchivio').onclick();assert.equal(p.$('archiveClient').value,'');assert.equal(p.$('archiveEmployer').value,'');
  assert.deepEqual(p.errors,[]);console.log('PASS: distinct roles; legacy prefixes; ambiguous labels; no read migrations; combined/applied filters; historical employers; zero results; PDF; certificate; save/reopen; old history preserved; backup/restore.');
 }finally{p.dom.window.close()}
 const ghost=await app(undefined,'?prova=fantasma');try{ghost.api.apply({...ghost.api.collect(),committente:'SERMOLAB',datore_lavoro:'AZIENDA FITTIZIA',giudizio:'IDONEO'});await ghost.api.saveToLocalArchive();assert.equal((await ghost.t.cartelle()).length,1);assert.deepEqual((await ghost.t.cartelle())[0].conteggioVisits,undefined);assert.deepEqual(ghost.errors,[]);console.log('PASS: PROVA FANTASMA with separate roles, isolated archive and no outbox.')}finally{ghost.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
