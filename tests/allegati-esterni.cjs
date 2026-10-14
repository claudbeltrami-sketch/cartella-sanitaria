const {app}=require('./allegati-dom.cjs');
const idb=require('fake-indexeddb');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const hash=b=>createHash('sha256').update(b).digest('hex');
const person={cognome:'SINTETICO',nome:'PDF',codice_fiscale:'TSTPDF80A01H501X',data_giudizio:'2026-10-14',firma_lavoratore_png:''};
async function put(p,rows){const st=p.w.lumenAllegatiStorage,db=await st.open();try{await new Promise((resolve,reject)=>{const tx=db.transaction(st.store,'readwrite');rows.forEach(r=>tx.objectStore(st.store).put(r));tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
const row=(id,content)=>({id,kind:'allegato_cartella_v1',workerKey:'CF_'+person.codice_fiscale,workerCf:person.codice_fiscale,workerLabel:'SINTETICO PDF',visit:'2026-10-14',name:id+'.pdf',type:'application/pdf',savedAt:'2026-10-14T00:00:00Z',size:content.length,hash:hash(content),blob:new Blob([content],{type:'application/pdf'})});
async function light(p){await p.w.lumenBackupActions.light();if(p.$('lumenBackupDownload').style.display==='none')throw Error(p.$('lumenBackupMessage').textContent);p.$('lumenBackupDownload').click();return p.downloads.at(-1).blob}
(async()=>{
 const p=await app(),q=await app(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'lumen-external-'));
 try{
  await p.api.saveToLocalArchive(person);await p.api.saveToLocalArchive({...person,mansione:'SECONDA VERSIONE'});p.api.apply(person);
  const a=row('ATT_A',Buffer.from('%PDF SYNTHETIC ONE')),b=row('ATT_B',Buffer.from('%PDF SYNTHETIC TWO'));
  const scan={id:'REFERTI_SCAN_'+a.id,kind:'referti_scan_v1',attachmentId:a.id,version:2,fingerprint:JSON.stringify([a.hash,a.size,a.savedAt,a.name]),analisi:'SÌ',drug:'NO'};
  await put(p,[a,b,scan]);const charts=JSON.stringify(await p.t.cartelle());
  await assert.rejects(light(p),/ARCHIVIO PDF SUL MAC/);assert((await p.t.rows()).filter(x=>x.blob).length===2);
  const api=p.w.lumenExternalAttachments,zip=await api.exportZip();fs.writeFileSync(path.join(temp,'export.zip'),Buffer.from(await zip.arrayBuffer()));
  const zipInfo=JSON.parse(execFileSync('python3',['-c',`import zipfile,json,sys,base64
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 print(json.dumps({n:base64.b64encode(z.read(n)).decode() for n in z.namelist()}))`,path.join(temp,'export.zip')],{encoding:'utf8'}));
  const manifest=JSON.parse(Buffer.from(zipInfo['LUMEN_ALLEGATI/_LUMEN_indice.json'],'base64').toString());assert.equal(manifest.documenti.length,2);
  const files=Object.entries(zipInfo).map(([name,bytes])=>{const f=new File([Buffer.from(bytes,'base64')],name.split('/').pop());Object.defineProperty(f,'webkitRelativePath',{value:name});return f});
  const source=api.sourceFromFiles(files);
  await assert.rejects(api.migrate({files:new Map()}),/Manca/);assert.equal((await p.t.rows()).filter(x=>x.blob).length,2);
  const corrupt=new Map(source.files),name=manifest.documenti[0].external.file;corrupt.set(name,new File(['BROKEN'],name));
  await assert.rejects(api.migrate({files:corrupt}),/non coincide/);assert.equal((await p.t.rows()).filter(x=>x.blob).length,2);
  // A concurrent record edit must abort the entire metadata replacement.
  const racing=new Map(source.files),raceFile=racing.get(name),readRace=raceFile.arrayBuffer.bind(raceFile);let raced=false;
  raceFile.arrayBuffer=async()=>{if(!raced){raced=true;await put(p,[{...b,note:'CONCURRENT EDIT'}])}return readRace()};
  await assert.rejects(api.migrate({files:racing}),/cambiato/);assert.equal((await p.t.rows()).filter(x=>x.blob).length,2);raceFile.arrayBuffer=readRace;
  // Quota/transaction failures cannot remove only a prefix of the documents.
  const update=idb.IDBCursor.prototype.update;let updates=0;
  idb.IDBCursor.prototype.update=function(...args){if(++updates===2)throw new DOMException('Synthetic quota failure','QuotaExceededError');return update.apply(this,args)};
  try{await assert.rejects(api.migrate(source),/quota/)}finally{idb.IDBCursor.prototype.update=update}
  assert.equal((await p.t.rows()).filter(x=>x.blob).length,2);
  const result=await api.migrate(source);assert.equal(result.count,2);assert.equal(result.removed,2);
  const rows=await p.t.rows();assert(rows.filter(r=>r.kind==='allegato_cartella_v1').every(r=>r.blob===null&&api.valid(r.external)));
  assert.equal(JSON.stringify(await p.t.cartelle()),charts);assert.deepEqual(rows.find(r=>r.id===scan.id),scan);
  const flags=await p.w.lumenArchiveReferti.statuses(await p.t.cartelle());assert.equal(flags.get('CF_'+person.codice_fiscale).analisi,'SÌ');
  assert.equal(Buffer.from(await (await api.getBlob(rows.find(r=>r.id===a.id))).arrayBuffer()).toString(),'%PDF SYNTHETIC ONE');
  p.api.apply(person);await p.$('btnAllegatiCartella').onclick();let openedUrl='',closed=false;
  p.w.open=()=>({opener:null,location:{replace:url=>{openedUrl=url}},close:()=>{closed=true}});
  await p.$('allegatiList').querySelector('[data-open="ATT_A"]').onclick();assert.match(openedUrl,/^blob:/);assert.equal(closed,false);
  p.w.open=()=>null;await p.$('allegatiList').querySelector('[data-open="ATT_A"]').onclick();assert.match(p.$('allegatiMessage').textContent,/SALVA COPIA/);p.$('allegatiClose').onclick();
  const backup=await light(p),packet=JSON.parse(await backup.text());assert.equal(packet.tipo,'BELTRAMI_BACKUP_LEGGERO_V2');assert.equal(packet.contenuto.originali.filter(r=>r.kind==='allegato_cartella_v1').length,2);assert(packet.contenuto.originali.every(r=>!r.blob));
  // Restore to a new device: references are valid even without the Mac folder.
  await q.t.restore(backup);assert.equal(JSON.stringify(await q.t.cartelle()),charts);let restored=await q.t.rows();assert.equal(restored.length,3);
  await assert.rejects(q.w.lumenExternalAttachments.getBlob(restored.find(r=>r.id===a.id)),/PDF conservato sul Mac/);
  q.api.apply(person);await q.$('btnAllegatiCartella').onclick();let blankClosed=false;q.w.open=()=>({opener:null,location:{replace:()=>{}},close:()=>{blankClosed=true}});await q.$('allegatiList').querySelector('[data-open="ATT_A"]').onclick();assert.equal(blankClosed,true);q.$('allegatiClose').onclick();
  assert.equal(JSON.parse(await (await light(q)).text()).tipo,'BELTRAMI_BACKUP_LEGGERO_V2');
  // Reconnect the single folder, not one document at a time.
  await q.w.lumenExternalAttachments.migrate(q.w.lumenExternalAttachments.sourceFromFiles(files));
  const reopened=await q.w.lumenExternalAttachments.getBlob(restored.find(r=>r.id===b.id));assert.equal(await reopened.text(),'%PDF SYNTHETIC TWO');
  // Full backup remains self-contained and byte-for-byte lossless.
  await q.w.lumenBackupActions.full();assert.match(q.$('lumenBackupTitle').textContent,/PRONTO DA SALVARE/,q.$('lumenBackupMessage').textContent);q.$('lumenBackupDownload').click();const full=JSON.parse(await q.downloads.at(-1).blob.text());assert.equal(full.tipo,'BELTRAMI_BACKUP_COMPLETO_V1');assert.equal(Buffer.from(full.contenuto.originali.find(r=>r.id===a.id).blob.split(',')[1],'base64').toString(),'%PDF SYNTHETIC ONE');
  // A light restore must not discard embedded files still on the target device.
  await put(q,[a,row('ATT_EXTRA',Buffer.from('%PDF EXTRA'))]);await q.t.restore(backup);restored=await q.t.rows();assert(restored.find(r=>r.id===a.id).blob instanceof Blob);assert(restored.find(r=>r.id==='ATT_EXTRA').blob instanceof Blob);
  await assert.rejects(light(q),/ARCHIVIO PDF SUL MAC/);
  const bad=structuredClone(packet);bad.contenuto.originali.find(r=>r.id===a.id).external.file='../escape.pdf';const before=JSON.stringify(await q.t.cartelle());
  await assert.rejects(q.t.restore(new File([JSON.stringify(bad)],'bad.json')),/senza collegamento/);assert.equal(JSON.stringify(await q.t.cartelle()),before);
  assert.deepEqual(p.errors,[]);assert.deepEqual(q.errors,[]);
  console.log('PASS: ZIP CRC/bytes/manifest, missing and altered files retain originals, verified migration, unchanged charts/history/OCR, light restore without folder, reconnect/open, full backup bytes, light restore preserves local embedded files, malicious path rejected.');
 }finally{p.dom.window.close();q.dom.window.close();fs.rmSync(temp,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
