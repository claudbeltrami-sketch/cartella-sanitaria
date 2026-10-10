// Permanent panel with actual app handlers and isolated synthetic IndexedDB.
const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
(async()=>{
 const p=await app();
 try{
  await p.api.saveToLocalArchive({cognome:'SINTETICO',nome:'BACKUP',codice_fiscale:'SNTBCK80A01H501X',data_giudizio:'2026-10-10'});
  const bytes=Uint8Array.from({length:2*192*1024+11},(_,i)=>i%251);
  await p.t.storeOriginalFile({name:'synthetic.pdf',type:'application/pdf',bytes});
  const before=JSON.stringify(await p.t.cartelle());
  let shares=0;p.w.navigator.canShare=()=>true;
  p.w.navigator.share=()=>{shares++;return Promise.reject(Object.assign(Error('cancel'),{name:'AbortError'}))};
  const pending=p.$('btnBackupInPagina').onclick();
  assert(p.$('btnBackupInPagina').disabled);
  assert.match(p.$('lumenBackupTitle').textContent,/PREPARAZIONE/);
  await p.t.backup();await pending;
  assert.equal(shares,0,'no automatic native share');
  assert.match(p.$('lumenBackupTitle').textContent,/PRONTO DA SALVARE/);
  assert.equal(p.w.sessionStorage.getItem('lumen_backup_in_corso'),null);
  const panel=p.$('lumenBackupOverlay');
  for(const type of ['cancel','close','click','keydown'])panel.dispatchEvent(new p.w.Event(type,{bubbles:true,cancelable:true}));
  assert(panel.isConnected);
  await p.$('lumenBackupShare').onclick();assert.equal(shares,1);
  assert.match(p.$('lumenBackupMessage').textContent,/annullato/);
  p.$('lumenBackupDownload').click();
  const file=p.downloads.at(-1).blob,backup=JSON.parse(await file.text());
  assert.equal(backup.contenuto.cartelle.length,1);
  assert.deepEqual(Buffer.from(backup.contenuto.originali[0].blob.split(',')[1],'base64'),Buffer.from(bytes));
  assert.equal(JSON.stringify(await p.t.cartelle()),before);
  const build=p.w.lumenBackupStream.build;
  p.w.lumenBackupStream.build=async()=>{throw Error('Errore sintetico')};
  await p.t.backup();assert.match(p.$('lumenBackupTitle').textContent,/NON CREATO/);
  assert.equal(p.$('lumenBackupShare').onclick,null,'old file released on retry');
  assert.equal(p.$('lumenBackupDownload').getAttribute('href'),null);
  assert(!p.$('btnBackupInPagina').disabled);
  p.w.lumenBackupStream.build=build;await p.t.backup();
  assert.match(p.$('lumenBackupTitle').textContent,/PRONTO DA SALVARE/);
  assert.deepEqual(p.errors,[]);
  const interrupted=await app(undefined,'',{session:{lumen_backup_in_corso:'1'}});
  try{assert.match(interrupted.$('lumenBackupTitle').textContent,/INTERROTTO/)}finally{interrupted.dom.window.close()}
  console.log('PASS: progress, duplicate guard, explicit share/cancel, persistent panel, byte-exact chunked attachment, archive unchanged, failed retry releases old file, interrupted preparation visible.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
