const {app}=require('./allegati-dom.cjs');
const assert=require('node:assert/strict');
const idb=require('fake-indexeddb');
const fixture={cognome:'PROVA',nome:'FANTASMA',codice_fiscale:'',data_nascita:'',lumen_prova:true,data_giudizio:'2026-10-05',note:'FITTIZIO'};
(async()=>{
 const factory=new idb.IDBFactory(),p=await app(factory,'?prova=fantasma');
 const nodes=[];
 try{
  p.api.apply(fixture);await p.api.saveToLocalArchive(fixture);await p.api.saveToLocalArchive({...fixture,note:'STORICO'});
  await p.t.storeOriginalFile({name:'lista.csv',type:'text/csv',bytes:new TextEncoder().encode('FITTIZIO')});
  await p.t.setConsensi([{id:'consenso-prova',workerKey:'PROVA|FANTASMA',fileName:'consenso.txt',mimeType:'text/plain',blob:new Blob(['CONSENSO FITTIZIO'],{type:'text/plain'})}]);
  const before=JSON.stringify(await p.t.cartelle());
  assert.equal(p.w.lumenAutoBackup.active,false);
  await p.w.lumenAutoBackup.start();assert.equal(p.downloads.length,1);
  const backup=JSON.parse(await p.downloads[0].blob.text());assert.equal(backup.lumen_prova,true);assert.equal(backup.contenuto.consensi_cartacei.length,1);assert.equal(backup.contenuto.cartelle[0].history.length,1);
  assert.match(p.$('autoBackupStatus').textContent,/non è confermato/);
  await p.w.lumenAutoBackup.tick();assert.equal(p.downloads.length,1);
  p.w.Date.now=()=>p.w.lumenAutoBackup.next+1;
  // Use a fixed advanced clock (not a moving deadline).
  const due=p.w.lumenAutoBackup.next+1;p.w.Date.now=()=>due;
  await p.w.lumenAutoBackup.tick();assert.equal(p.downloads.length,2);assert.notEqual(p.downloads[0].name,p.downloads[1].name);
  p.w.lumenAutoBackup.stop();await p.w.lumenAutoBackup.tick();assert.equal(p.downloads.length,2);
  assert.equal(JSON.stringify(await p.t.cartelle()),before);
  const q=await app(new idb.IDBFactory(),'?prova=fantasma');nodes.push(q);
  await q.t.restore(new File([JSON.stringify(backup)],'test.json'));
  assert.equal(JSON.stringify(await q.t.cartelle()),before);
  const restored=await q.w.lumenBackupApi.prepare();assert.equal(JSON.stringify(restored.contenuto.consensi_cartacei),JSON.stringify(backup.contenuto.consensi_cartacei));
  assert.equal(JSON.stringify(restored.contenuto.originali),JSON.stringify(backup.contenuto.originali));
  const legacy=JSON.parse(JSON.stringify(backup));delete legacy.contenuto.consensi_cartacei;
  await q.t.restore(new File([JSON.stringify(legacy)],'legacy.json'));
  assert.equal((await q.w.lumenBackupApi.prepare()).contenuto.consensi_cartacei.length,1);
  const real=await app(factory);nodes.push(real);assert.equal((await real.t.cartelle()).length,0);
  await assert.rejects(real.t.restore(new File([JSON.stringify(backup)],'prova.json')),/PROVA/);
  const reopen=await app(factory,'?prova=fantasma');nodes.push(reopen);assert.equal(reopen.w.lumenAutoBackup.active,false);
  // Reinitialize only the new module with a simulated native folder. Clinical storage stays real IDB.
  const fs=require('node:fs');p.$('autoBackupDialog').remove();p.$('autoBackupStatus').remove();
  const files=new Map();let corrupt=false,denied=false,failClose=false;
  p.w.showDirectoryPicker=async()=>({name:'COLLAUDO',queryPermission:async()=>denied?'denied':'granted',getFileHandle:async name=>({createWritable:async()=>({write:async b=>files.set(name,b),close:async()=>{if(failClose)throw Error('Disco pieno')},abort:async()=>{}}),getFile:async()=>corrupt?new File(['CORROTTO'],name):new File([files.get(name)],name)})});
  p.w.eval(fs.readFileSync(require('node:path').join(__dirname,'../backup-automatico.js'),'utf8'));
  await p.w.lumenAutoBackup.start();assert.equal(files.size,1);assert.match(p.$('autoBackupStatus').textContent,/salvata e verificata/);
  const advanced=p.w.lumenAutoBackup.next+1;p.w.Date.now=()=>advanced;corrupt=true;
  await p.w.lumenAutoBackup.tick();assert.equal(p.w.lumenAutoBackup.active,false);assert.match(p.$('autoBackupStatus').textContent,/INTERROTTO/);assert.equal(files.size,2);
  corrupt=false;denied=true;await p.w.lumenAutoBackup.start();assert.equal(files.size,2);assert.equal(p.w.lumenAutoBackup.active,false);
  denied=false;failClose=true;await p.w.lumenAutoBackup.start();assert.match(p.$('autoBackupStatus').textContent,/Disco pieno/);assert.equal(p.w.lumenAutoBackup.active,false);
  assert.equal(JSON.stringify(await p.t.cartelle()),before);
  for(const x of [p,...nodes])assert.deepEqual(x.errors,[]);
  console.log('PASS automatico: attivazione, timer 30 minuti, stop, file univoci, download non dichiarato verificato, rilettura, corruzione, permessi, disco pieno, ripristino storico/allegati/consensi, legacy, isolamento PROVA/reale e riapertura.');
 }finally{for(const x of [p,...nodes])x.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
