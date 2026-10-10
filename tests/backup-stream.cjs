const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {app}=require('./allegati-dom.cjs');
const idb=require('fake-indexeddb');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
(async()=>{
 const p=await app(),q=await app();
 const getAll=idb.IDBObjectStore.prototype.getAll,read=p.w.FileReader.prototype.readAsDataURL;
 try{
  await p.api.saveToLocalArchive({cognome:'SINTETICO',nome:'GRANDE',codice_fiscale:'SNTGRN80A01H501X',data_giudizio:'2026-10-10',firma_lavoratore_png:'data:image/png;base64,QUFB'});
  // Crosses the restore reader's 64 MiB threshold with one large attachment.
  const bytes=new Uint8Array(49*1024*1024+2);for(let i=0;i<bytes.length;i+=8191)bytes[i]=i%251;
  await p.t.storeOriginalFile({name:'large-synthetic.pdf',type:'application/pdf',bytes});
  for(const n of [0,1,2,3,192*1024-1,192*1024,192*1024+1])await p.t.storeOriginalFile({name:'edge-'+n,type:'application/octet-stream',bytes:Uint8Array.from({length:n},(_,i)=>i%251)});
  const before=JSON.stringify(await p.t.cartelle());
  let largestRead=0;
  idb.IDBObjectStore.prototype.getAll=function(...args){assert.notEqual(this.name,'originali','never load all attachments together');return getAll.apply(this,args)};
  p.w.FileReader.prototype.readAsDataURL=function(blob){largestRead=Math.max(largestRead,blob.size);assert(blob.size<=192*1024,'bounded encoding even for a huge attachment');return read.call(this,blob)};
  await p.t.backup();idb.IDBObjectStore.prototype.getAll=getAll;
  assert.match(p.$('lumenBackupTitle').textContent,/PRONTO DA SALVARE/);
  p.$('lumenBackupDownload').click();const file=p.downloads.at(-1).blob;
  assert(file.size>64*1024*1024);assert.equal(largestRead,192*1024);
  await q.t.restore(file);assert.equal(JSON.stringify(await q.t.cartelle()),before);
  const rows=await q.t.rows();assert.equal(rows.length,8);
  for(const row of rows){const expected=row.name==='large-synthetic.pdf'?bytes:Uint8Array.from({length:Number(row.name.slice(5))},(_,i)=>i%251);assert.deepEqual(new Uint8Array(await row.blob.arrayBuffer()),expected)}
  assert.equal(JSON.stringify(await p.t.cartelle()),before);
  assert.deepEqual(p.errors,[]);assert.deepEqual(q.errors,[]);
  console.log('PASS: >64 MiB V1 backup/restore; exact large, empty and base64-boundary attachments; no attachment getAll; encoding reads <=192 KiB; cartelle and signatures preserved.');
 }finally{idb.IDBObjectStore.prototype.getAll=getAll;p.w.FileReader.prototype.readAsDataURL=read;p.dom.window.close();q.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
