// Full app DOM regression: the prepared backup survives dismiss events.
// Does not emulate native iOS sharing or browser rendering.
const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
(async()=>{
 const p=await app();
 try{
  assert.deepEqual(p.errors,[]);
  await p.api.saveToLocalArchive({cognome:'SINTETICO',nome:'BACKUP',codice_fiscale:'SNTBCK80A01H501X',data_giudizio:'2026-10-10'});
  const before=JSON.stringify(await p.t.cartelle());
  await p.t.backup();
  const overlay=p.$('lumenBackupOverlay'),panel=p.$('lumenBackupDialog');
  assert(overlay&&panel);assert.equal(panel.tagName,'SECTION');
  for(const type of ['cancel','close'])panel.dispatchEvent(new p.w.Event(type,{bubbles:true,cancelable:true}));
  overlay.dispatchEvent(new p.w.MouseEvent('click',{bubbles:true}));
  const escape=new p.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});panel.dispatchEvent(escape);
  assert(escape.defaultPrevented);assert(overlay.isConnected);assert(panel.isConnected);
  p.$('lumenBackupDownload').click();
  const backup=JSON.parse(await p.downloads.at(-1).blob.text());assert.equal(backup.contenuto.cartelle.length,1);
  assert.equal(JSON.stringify(await p.t.cartelle()),before,'backup does not alter records');
  assert(overlay.isConnected,'download retains panel');
  p.$('lumenBackupClose').onclick();assert(!overlay.isConnected,'only explicit close removes panel');
  assert.deepEqual(p.errors,[]);
  console.log('PASS: full application; prepared backup retained after native close/cancel, Escape, outside tap and download; explicit close works; archive unchanged.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
