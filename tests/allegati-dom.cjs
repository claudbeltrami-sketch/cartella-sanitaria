// Socket-free integration checks with the complete local application scripts.
// This harness does not test browser layout or native file pickers.
const {JSDOM,VirtualConsole}=require('jsdom');
const idb=require('fake-indexeddb');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
async function app(factory=new idb.IDBFactory(),query='',seed={}){
 const errors=[],downloads=[],urls=new Map(),vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://lumen.test/'+query,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;for(const [k,v]of Object.entries(idb))if(k.startsWith('IDB'))w[k]=v;
 w.indexedDB=factory;w.Blob=Blob;w.File=File;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 Object.defineProperty(w,'crypto',{value:webcrypto});
 w.FileReader=class{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onload?.()}).catch(e=>{this.error=e;this.onerror?.()})}};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({canvas:this,measureText:()=>({width:0}),getImageData:()=>({data:new Uint8ClampedArray(4)}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}})};
 w.HTMLCanvasElement.prototype.toDataURL=()=>'';
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.alert=t=>errors.push('ALERT: '+t);w.confirm=()=>true;w.fetch=async()=>{throw Error('Network disabled in test')};
 w.URL.createObjectURL=b=>{const u='blob:test-'+urls.size;urls.set(u,b);return u};w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,blob:urls.get(this.href)})};
 const setTimer=w.setTimeout.bind(w);w.setTimeout=(f,ms,...args)=>ms>=1000?0:setTimer(f,ms,...args);
 const sources=[...w.document.scripts].map(s=>s.src?(s.getAttribute('src').startsWith('http')||s.getAttribute('src').startsWith('vendor/')?'':fs.readFileSync(path.join(root,s.getAttribute('src').split('?')[0]),'utf8')):s.textContent);
 const main=sources.findIndex(s=>s.includes('window.lumenBatchCertApi='));
 sources[main]=sources[main].replace('window.lumenBatchCertApi=','window.testApi={renderArchive,setWorkers:rows=>{workers=rows;currentWorkerIndex=-1;renderWorkers()},selectWorker,findWorkerArchive,openArchiveRecord,putCartellaRecord,rows:()=>readAllFromDb(openOriginalDb,ORIGINAL_STORE),cartelle:()=>readAllFromDb(openCartelleDb,CARTELLE_STORE),backup:creaBackupCompleto,restore:ripristinaBackupCompleto,storeOriginalFile,setConsensi:rows=>replaceAllInDb(openConsensiBackupDb,"consensi",rows)};window.lumenBatchCertApi=');
 for(const [k,v]of Object.entries(seed.session||{}))w.sessionStorage.setItem(k,JSON.stringify(v));
 for(const [k,v]of Object.entries(seed.local||{}))w.localStorage.setItem(k,JSON.stringify(v));
 w.eval(sources.join('\n;\n'));await new Promise(r=>setTimeout(r,60));
 return {w,dom,errors,downloads,$:id=>w.document.getElementById(id),api:w.lumenBatchCertApi,t:w.testApi};
}
const a={cognome:'SINTETICO',nome:'ALFA',codice_fiscale:'SNTLFA80A01H501X',data_nascita:'1980-01-01',data_giudizio:'2026-09-30',mansione:'COLLAUDO',firma_lavoratore_png:''};
const b={...a,nome:'BETA',codice_fiscale:'SNTBTA80A01H501X'};
const pdf=new File(['%PDF-1.4 DOCUMENTO FITTIZIO'],'referto.pdf',{type:'application/pdf'}),png=new File([new Uint8Array([137,80,78,71,13,10,26,10])],'foto.png',{type:'image/png'});
async function select(p,files){Object.defineProperty(p.$('allegatiFiles'),'files',{value:files,configurable:true});p.$('allegatiFiles').onchange();await p.$('allegatiSave').onclick()}
const serial=async rows=>Promise.all(rows.map(async r=>({...r,blob:Buffer.from(await r.blob.arrayBuffer()).toString('base64')})));
module.exports={app};
if(require.main===module)(async()=>{
 const factory=new idb.IDBFactory(),p=await app(factory);
 try{
  assert.deepEqual(p.errors,[]);
  await p.api.saveToLocalArchive(a);await p.api.saveToLocalArchive(b);p.api.apply(a);
  await p.t.storeOriginalFile({name:'lista-fittizia.csv',type:'text/csv',bytes:new TextEncoder().encode('COGNOME,NOME')});
  const before=JSON.stringify(await p.t.cartelle()),original=await serial(await p.t.rows());
  await p.$('btnAllegatiCartella').onclick();p.$('allegatiDate').value='2026-09-29';p.$('allegatiNote').value='REFERTI FITTIZI';await select(p,[pdf,png]);
  assert.match(p.$('allegatiMessage').textContent,/2 ALLEGATI SALVATI/);assert.equal(p.$('allegatiList').children.length,2);
  let rows=await p.t.rows();assert.equal(rows.length,3);assert.equal(JSON.stringify(await p.t.cartelle()),before);assert.deepEqual(await serial(rows.filter(r=>!r.kind)),original);
  for(const r of rows.filter(r=>r.kind)){assert.equal(r.workerKey,'CF_'+a.codice_fiscale);assert.equal(r.documentDate,'2026-09-29')}
  await select(p,[new File([await pdf.arrayBuffer()],'rinominato.pdf'),png]);assert.match(p.$('allegatiMessage').textContent,/2 FILE GIÀ PRESENTI/);assert.equal((await p.t.rows()).length,3);
  await p.$('allegatiList').querySelector('[data-download]').onclick();const file=p.downloads.at(-1);assert.equal(file.blob.size,file.name==='foto.png'?png.size:pdf.size);
  await select(p,[new File(['%PDF OTHER'],'altro.pdf'),new File(['<svg/>'],'script.svg')]);assert.match(p.$('allegatiMessage').textContent,/Formato non supportato/);assert.equal((await p.t.rows()).length,3);
  p.api.apply(b);await select(p,[pdf]);assert.match(p.$('allegatiMessage').textContent,/cartella è cambiata/);assert.equal((await p.t.rows()).length,3);
  p.$('allegatiClose').onclick();await p.$('btnAllegatiCartella').onclick();assert.match(p.$('allegatiList').textContent,/NESSUN ALLEGATO/);
  p.$('allegatiClose').onclick();p.api.apply(a);await p.$('btnAllegatiCartella').onclick();
  const add=idb.IDBObjectStore.prototype.add;let calls=0;idb.IDBObjectStore.prototype.add=function(...args){if(++calls===2)throw new DOMException('Test quota','QuotaExceededError');return add.apply(this,args)};
  try{await select(p,[new File(['%PDF UNO'],'uno.pdf'),new File(['%PDF DUE'],'due.pdf')])}finally{idb.IDBObjectStore.prototype.add=add}
  assert.match(p.$('allegatiMessage').textContent,/ALLEGATI NON SALVATI/);assert.equal((await p.t.rows()).length,3);
  p.$('allegatiClose').onclick();await p.t.backup();const backup=JSON.parse(await p.downloads.at(-1).blob.text());assert.equal(backup.contenuto.originali.length,3);
  const q=await app();try{await q.t.restore(new File([JSON.stringify(backup)],'backup.json'));assert.deepEqual(await serial(await q.t.rows()),await serial(await p.t.rows()));q.api.apply(a);await q.$('btnAllegatiCartella').onclick();assert.equal(q.$('allegatiList').children.length,2);await q.$('allegatiList').querySelector('[data-delete]').onclick();assert.equal((await q.t.rows()).length,2);assert.equal(JSON.stringify(await q.t.cartelle()),before);assert.deepEqual(q.errors,[])}finally{q.dom.window.close()}
  const reopened=await app(factory);try{reopened.api.apply(a);await reopened.$('btnAllegatiCartella').onclick();assert.equal(reopened.$('allegatiList').children.length,2);assert.deepEqual(reopened.errors,[])}finally{reopened.dom.window.close()}
  const ghost=await app(factory,'?prova=fantasma');try{await ghost.$('btnAllegatiCartella').onclick();await select(ghost,[pdf]);assert.equal((await ghost.t.rows()).length,1);assert.equal((await p.t.rows()).length,3);ghost.$('allegatiClose').onclick();await ghost.w.lumenStorage.reset();assert.equal((await ghost.t.rows()).length,0);assert.equal((await p.t.rows()).length,3);assert.deepEqual(ghost.errors,[])}finally{ghost.dom.window.close()}
  assert.deepEqual(p.errors,[]);console.log('PASS: full application initialization; attachment association; deduplication; download; invalid selection rollback; worker-change guard; simulated quota rollback; persistence across app instances; full backup and restore including bytes; deletion; ghost isolation/reset; existing cartelle and source file unchanged. Browser layout not tested by this harness.');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
