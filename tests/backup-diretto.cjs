const {JSDOM}=require('jsdom'),idb=require('fake-indexeddb'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
async function exporter(factory,local={}){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../backup-locale.html'),'utf8'),{url:'https://lumen.test/backup-locale.html',runScripts:'outside-only'}),w=dom.window,files=[];
 w.indexedDB=factory;w.Blob=Blob;w.File=File;
 w.URL.createObjectURL=f=>{files.push(f);return 'blob:test'};w.URL.revokeObjectURL=()=>{};
 w.FileReader=class{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onload()}).catch(e=>{this.error=e;this.onerror()})}};
 for(const [k,v]of Object.entries(local))w.localStorage.setItem(k,v);
 w.eval(fs.readFileSync(path.join(__dirname,'../backup-locale.js'),'utf8'));
 return {dom,w,files,$:id=>w.document.getElementById(id)};
}
(async()=>{
 const factory=new idb.IDBFactory(),p=await app(factory);
 let e,q;
 try{
  await p.api.saveToLocalArchive({cognome:'SINTETICO',nome:'TEST',codice_fiscale:'SNTTST80A01H501X',data_giudizio:'2026-10-10',firma_lavoratore_png:'data:image/png;base64,QUFB'});
  await p.t.storeOriginalFile({name:'test.pdf',type:'application/pdf',bytes:new TextEncoder().encode('%PDF synthetic backup')});
  const signature={id:'synthetic-pending',savedAt:'2026-10-10T10:00:00Z',packet:{id:'synthetic-pending',tipo:'BELTRAMI_FIRMA_IPHONE_V1',versione:2,identita:'CF_SNTTST80A01H501X',visita:'2026-10-10',firma_lavoratore_png:'data:image/png;base64,QUFB'}};
  const local={beltrami_synthetic:'retained',beltrami_firma_pending_v1_test:JSON.stringify(signature),unrelated:'omit'},before=JSON.stringify(await p.t.cartelle()),dbsBefore=await factory.databases();
  e=await exporter(factory,local);await e.$('prepare').onclick();
  assert.equal(e.files.length,1);assert.match(e.$('status').textContent,/BACKUP PRONTO/);
  const file=e.files[0],backup=JSON.parse(await file.text());assert.equal(backup.tipo,'BELTRAMI_BACKUP_COMPLETO_V1');assert.equal(backup.contenuto.cartelle.length,1);assert.equal(backup.contenuto.localStorage.beltrami_synthetic,'retained');assert(!('unrelated' in backup.contenuto.localStorage));assert.equal(backup.contenuto.originali[0].blob,'data:application/pdf;base64,JVBERiBzeW50aGV0aWMgYmFja3Vw');
  assert.deepEqual(backup.contenuto.firme_da_trasferire,[signature]);assert.deepEqual(await factory.databases(),dbsBefore,'missing optional signature DB is not created');assert.equal(JSON.stringify(await p.t.cartelle()),before);
  e.w.navigator.share=()=>Promise.reject(Object.assign(new Error('cancel'),{name:'AbortError'}));await e.$('share').onclick();assert.match(e.$('status').textContent,/annullato/);assert.equal(e.$('download').hidden,false);
  e.$('download').onclick();assert.match(e.$('status').textContent,/Download richiesto/);assert(e.$('download').isConnected);
  q=await app();await q.t.restore(new File([await file.text()],'backup.json'));assert.equal(JSON.stringify(await q.t.cartelle()),before);const restored=await q.t.rows();assert.equal(await restored[0].blob.text(),'%PDF synthetic backup');assert.deepEqual(q.errors,[]);
  const emptyFactory=new idb.IDBFactory(),empty=await exporter(emptyFactory);try{await empty.$('prepare').onclick();assert.equal(empty.files.length,0);assert.match(empty.$('status').textContent,/non risultano cartelle/);assert.deepEqual(await emptyFactory.databases(),[])}finally{empty.dom.window.close()}
  console.log('PASS: standalone read-only exporter; V1 restore roundtrip with signature and attachment bytes; no archive mutations or empty database creation; cancel/download keep page; empty browser blocks misleading backup.');
 }finally{p.dom.window.close();e?.dom.window.close();q?.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
