/* Local PDF archive. No upload, no absolute paths in backups, no source removal
 * until every destination file has been read back and SHA-256 verified. */
(() => {
 'use strict';
 const storage=window.lumenAllegatiStorage,KIND='allegato_cartella_v1',DB='beltrami_allegati_mac_v1';
 const isAttachment=r=>r?.kind===KIND;
 const digest=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
 const valid=ref=>ref?.version===1&&/^[a-f0-9]{64}$/.test(ref.sha256||'')&&Number.isSafeInteger(ref.size)&&ref.size>0&&typeof ref.file==='string'&&ref.file.startsWith(ref.sha256+'_')&&/^[a-f0-9]{64}_[A-Za-z0-9_.-]{1,150}$/.test(ref.file);
 const snapshot=r=>JSON.stringify({...r,blob:r.blob instanceof Blob?{size:r.blob.size,type:r.blob.type}:r.blob??null});
 const fileName=(r,hash)=>hash+'_'+(String(r.name||'documento.pdf').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_.-]/g,'_').slice(-140)||'documento.pdf');
 let connection=null,connectionLoaded=false,migrating=false;
 function configDb(){return new Promise((resolve,reject)=>{const r=lumenStorage.indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('config');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 async function remember(root){const db=await configDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction('config','readwrite');if(root)tx.objectStore('config').put(root,'root');else tx.objectStore('config').delete('root');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Collegamento alla cartella non salvato.'));tx.onerror=()=>{}})}finally{db.close()}}
 async function connected(){
  if(connectionLoaded)return connection;
  const db=await configDb();try{connection=await new Promise((resolve,reject)=>{const r=db.transaction('config').objectStore('config').get('root');r.onsuccess=()=>resolve(r.result?{root:r.result}:null);r.onerror=()=>reject(r.error)});connectionLoaded=true;return connection}finally{db.close()}
 }
 function missing(){return Error('PDF conservato sul Mac. Apri ARCHIVIO PDF SUL MAC e collega la cartella LUMEN_ALLEGATI. Il backup leggero conserva il collegamento, non il PDF.');}
 async function destinationFile(ref,source){
  if(!valid(ref))throw Error('Collegamento esterno non valido. Nessun file è stato modificato.');
  if(source?.files){const file=source.files.get(ref.file);if(!file)throw Error('Manca nella cartella: '+ref.file);return file}
  if(!source?.root)throw missing();
  if(await source.root.queryPermission({mode:'read'})!=='granted')throw missing();
  try{return await (await source.root.getFileHandle(ref.file)).getFile()}catch(e){if(e.name==='NotFoundError')throw Error('PDF non trovato nella cartella del Mac: '+ref.file);throw e}
 }
 async function verify(blob,ref){
  if(!(blob instanceof Blob)||blob.size!==ref.size||await digest(blob)!==ref.sha256)throw Error('Il file sul Mac non coincide con l’originale: '+ref.file+'. Le copie incorporate non sono state rimosse.');
  return blob;
 }
 async function getBlob(row){
  if(row.blob instanceof Blob)return row.blob;
  if(!row.external)throw Error('File originale non disponibile.');
  return verify(await destinationFile(row.external,await connected()),row.external);
 }
 async function read(db,method,key){return new Promise((resolve,reject)=>{const tx=db.transaction(storage.store),s=tx.objectStore(storage.store),r=key===undefined?s[method]():s[method](key);let v;r.onsuccess=()=>{v=r.result};tx.oncomplete=()=>resolve(v);tx.onabort=()=>reject(tx.error||Error('Lettura archivio interrotta.'));tx.onerror=()=>{}})}
 async function references(progress=()=>{}){
  const db=await storage.open(),result=[];
  try{const keys=await read(db,'getAllKeys');for(const id of keys){const row=await read(db,'get',id);if(!isAttachment(row))continue;
   let ref;
   if(row.blob instanceof Blob){const sha256=await digest(row.blob);if(row.hash&&row.hash!==sha256)throw Error('Impronta dell’allegato non corrispondente: '+row.name);if(row.size!==row.blob.size)throw Error('Dimensione dell’allegato non corrispondente: '+row.name);ref={version:1,file:fileName(row,sha256),sha256,size:row.blob.size};}
   else{if(!valid(row.external))throw Error('Allegato privo sia del file sia del collegamento: '+row.name);ref=row.external;}
   result.push({id:row.id,before:snapshot(row),row:{...row,blob:null,external:ref},embedded:row.blob instanceof Blob});progress('Preparazione '+result.length+' documenti…');
  }return result}finally{db.close()}
 }
 async function currentRow(id){const db=await storage.open();try{return await read(db,'get',id)}finally{db.close()}}
 async function writeVerified(root,item,provided){
  const ref=item.row.external;
  try{const existing=await root.getFileHandle(ref.file);await verify(await existing.getFile(),ref);return}catch(e){if(e.name!=='NotFoundError')throw e}
  const row=provided||await currentRow(item.id);if(!row||snapshot(row)!==item.before)throw Error('Un allegato è cambiato. Riprova senza modificare LUMEN durante il trasferimento.');
  const blob=await getBlob(row),handle=await root.getFileHandle(ref.file,{create:true});
  let writable;
  try{writable=await handle.createWritable();await writable.write(blob);await writable.close()}catch(e){if(writable)try{await writable.abort()}catch(_){}throw e}
  await verify(await handle.getFile(),ref);
 }
 async function commitReferences(items){
  const db=await storage.open();try{await new Promise((resolve,reject)=>{
   const tx=db.transaction(storage.store,'readwrite'),st=tx.objectStore(storage.store),expected=new Map(items.map(x=>[x.id,x]));let seen=0,error;
   const req=st.openCursor();req.onsuccess=()=>{try{const cursor=req.result;if(!cursor){if(seen!==items.length){error=Error('Archivio cambiato: trasferimento non applicato. Riprova.');tx.abort()}return}
    const row=cursor.value;if(isAttachment(row)){const item=expected.get(row.id);if(!item||snapshot(row)!==item.before){error=Error('Un allegato è cambiato durante la verifica. Nessuna copia incorporata rimossa.');tx.abort();return}seen++;cursor.update({...row,blob:null,external:item.row.external})}cursor.continue();
   }catch(e){error=e;tx.abort()}};
   tx.oncomplete=resolve;tx.onabort=()=>reject(error||tx.error||Error('Separazione non applicata. Le copie incorporate sono conservate.'));tx.onerror=()=>{};
  })}finally{db.close()}
 }
 function manifest(items){return JSON.stringify({tipo:'LUMEN_ARCHIVIO_ALLEGATI_V1',versione:1,creato:new Date().toISOString(),lumen_prova:lumenStorage.isTest,documenti:items.map(x=>x.row)},null,2)}
 async function migrate(source,{write=false,progress=()=>{}}={}){
  if(migrating)throw Error('Un trasferimento è già in corso.');migrating=true;
  try{
   const items=await references(progress);if(!items.length)throw Error('Non ci sono allegati da separare.');
   for(let i=0;i<items.length;i++){progress('Salvataggio e verifica '+(i+1)+' di '+items.length+'…');if(write)await writeVerified(source.root,items[i]);else await verify(await destinationFile(items[i].row.external,source),items[i].row.external)}
   if(write){
    // Unique manifest names avoid overwriting any unrelated or older index.
    const h=await source.root.getFileHandle('_LUMEN_indice_'+crypto.randomUUID()+'.json',{create:true}),w=await h.createWritable();await w.write(manifest(items));await w.close();
   }
   // Persist the directory capability before removing any embedded bytes.
   await remember(source.root||null);
   await commitReferences(items);
   connection=source;connectionLoaded=true;
   window.dispatchEvent(new Event('lumen-allegati-esterni-updated'));
   return {count:items.length,removed:items.filter(x=>x.embedded).length,bytes:items.filter(x=>x.embedded).reduce((n,x)=>n+x.row.external.size,0)};
  }finally{migrating=false}
 }
 // Stored ZIP with bounded CRC reads; PDF Blob parts are never base64 encoded.
 const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
 async function crc(blob){let c=0xffffffff;for(let o=0;o<blob.size;o+=262144)for(const b of new Uint8Array(await blob.slice(o,o+262144).arrayBuffer()))c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
 function header(n){const b=new Uint8Array(n),v=new DataView(b.buffer);return {b,u16:(o,x)=>v.setUint16(o,x,true),u32:(o,x)=>v.setUint32(o,x,true)}}
 async function exportZip(progress=()=>{}){
  const items=await references(progress),parts=[],central=[];let offset=0,count=0;
  async function append(name,blob){
   const filename=new TextEncoder().encode('LUMEN_ALLEGATI/'+name);if(blob.size>0xffffffff||offset+blob.size+filename.length+30>0xffffffff)throw Error('Archivio oltre 4 GB: usa il salvataggio diretto nella cartella.');
   const checksum=await crc(blob),h=header(30);h.u32(0,0x04034b50);h.u16(4,20);h.u16(6,0x800);h.u16(12,33);h.u32(14,checksum);h.u32(18,blob.size);h.u32(22,blob.size);h.u16(26,filename.length);
   parts.push(h.b,filename,blob);const c=header(46);c.u32(0,0x02014b50);c.u16(4,20);c.u16(6,20);c.u16(8,0x800);c.u16(14,33);c.u32(16,checksum);c.u32(20,blob.size);c.u32(24,blob.size);c.u16(28,filename.length);c.u32(42,offset);central.push(c.b,filename);offset+=30+filename.length+blob.size;count++;
  }
  const included=new Set();
  for(let i=0;i<items.length;i++){
   const item=items[i];progress('Preparazione cartella PDF '+(i+1)+' di '+items.length+'…');if(included.has(item.row.external.file))continue;
   const row=await currentRow(item.id);if(!row||snapshot(row)!==item.before)throw Error('Archivio cambiato durante l’esportazione. Riprova.');
   const blob=await getBlob(row);await verify(blob,item.row.external);await append(item.row.external.file,blob);included.add(item.row.external.file);
  }
  await append('_LUMEN_indice.json',new Blob([manifest(items)],{type:'application/json'}));
  const size=central.reduce((n,b)=>n+b.byteLength,0);if(count>65535||offset+size+22>0xffffffff)throw Error('Archivio troppo grande per ZIP: usa il salvataggio diretto.');
  const end=header(22);end.u32(0,0x06054b50);end.u16(8,count);end.u16(10,count);end.u32(12,size);end.u32(16,offset);
  return new File([...parts,...central,end.b],'LUMEN_ALLEGATI.zip',{type:'application/zip'});
 }
 function sourceFromFiles(files){
  const map=new Map();for(const file of files){const rel=file.webkitRelativePath||file.name,parts=rel.split('/');if(parts.length>2)continue;const name=parts.at(-1);if(map.has(name))throw Error('Nomi duplicati nella cartella selezionata.');map.set(name,file)}
  return {files:map};
 }
 function validateLightRows(rows){
  if(!Array.isArray(rows))throw Error('Elenco allegati del backup non valido.');
  const ids=new Set();for(const row of rows){if(!row||typeof row.id!=='string'||ids.has(row.id))throw Error('Identificativi allegati non validi o duplicati.');ids.add(row.id);
   if(isAttachment(row)&&(!valid(row.external)||row.blob!=null||row.size!==row.external.size||(row.hash&&row.hash!==row.external.sha256)))throw Error('Backup leggero incompleto: allegato senza collegamento verificato.');
  }
 }
 async function preserveLocalFiles(rows){
  validateLightRows(rows);const incoming=new Map(rows.map(r=>[r.id,r])),db=await storage.open();
  try{for(const key of await read(db,'getAllKeys')){const current=await read(db,'get',key);if(!(current?.blob instanceof Blob))continue;const next=incoming.get(key);
   if(!next){incoming.set(key,current);continue}
   if(isAttachment(next)){if(current.hash!==next.external.sha256||current.blob.size!==next.external.size||await digest(current.blob)!==next.external.sha256)throw Error('Conflitto con un allegato locale. Ripristino annullato prima di modificare i dati.');incoming.set(key,{...next,blob:current.blob})}
  }return [...incoming.values()]}finally{db.close()}
 }
 async function stageNew(rows){
  const source=await connected();
  if(!source?.root||await source.root.queryPermission({mode:'readwrite'})!=='granted')return rows;
  const staged=[];
  for(const row of rows){
   const sha256=await digest(row.blob);if(sha256!==row.hash||row.size!==row.blob.size)throw Error('Allegato da salvare non valido: '+row.name);
   const external={version:1,file:fileName(row,sha256),sha256,size:row.size},item={id:row.id,before:snapshot(row),row:{...row,blob:null,external}};
   await writeVerified(source.root,item,row);staged.push(item.row);
  }
  return staged;
 }
 window.lumenExternalAttachments={valid,getBlob,migrate,exportZip,sourceFromFiles,validateLightRows,preserveLocalFiles,stageNew};
 // Deliberate, user-initiated local folder access; nothing runs on page load.
 const trigger=document.createElement('button');trigger.type='button';trigger.id='btnArchivioPdfMac';trigger.textContent='ARCHIVIO PDF SUL MAC';
 document.getElementById('btnBackupCompleto').insertAdjacentElement('afterend',trigger);
 const visibleTrigger=trigger.cloneNode(true);visibleTrigger.id='btnArchivioPdfMacInPagina';visibleTrigger.style.cssText='width:100%;margin:8px 0';document.getElementById('btnBackupInPagina').insertAdjacentElement('beforebegin',visibleTrigger);
 const dialog=document.createElement('dialog');dialog.id='pdfMacDialog';dialog.style.cssText='width:min(650px,94vw);max-height:90vh;overflow:auto;border-radius:12px;padding:22px;box-sizing:border-box';
 dialog.innerHTML=`<h2>PDF sul Mac, backup leggero</h2><p>I documenti vengono salvati nella cartella <strong>LUMEN_ALLEGATI</strong>. Le cartelle sanitarie conservano i collegamenti per consultarli. Firme, storico e risultati OCR restano nei dati.</p><p>Le copie incorporate vengono rimosse soltanto dopo aver riletto e verificato tutti i file salvati. Conserva anche una copia della cartella PDF sulla tua chiavetta: il backup leggero contiene solo i dati e i collegamenti.</p><button type="button" id="pdfMacDirect">SCEGLI CARTELLA E SEPARA I PDF</button><div id="pdfMacFallback"><p>Scarica lo ZIP, aprilo nel Finder e conserva la cartella estratta LUMEN_ALLEGATI sul Mac. Poi seleziona quella cartella qui sotto per verificarla e alleggerire LUMEN.</p><button type="button" id="pdfMacExport">1 · PREPARA CARTELLA PDF</button><a id="pdfMacDownload" hidden>SCARICA LUMEN_ALLEGATI.zip</a></div><p><label>COLLEGA / VERIFICA CARTELLA LUMEN_ALLEGATI<input id="pdfMacFolder" type="file" webkitdirectory multiple></label></p><p>La selezione dei file resta sul dispositivo. Se il browser non ricorda la cartella, selezionala nuovamente per consultare i PDF.</p><p id="pdfMacStatus" role="status" aria-live="polite" style="white-space:pre-line"></p><button type="button" id="pdfMacBackup" hidden>CREA BACKUP LEGGERO</button><button type="button" id="pdfMacFull">BACKUP COMPLETO CON PDF</button><button type="button" id="pdfMacClose">CHIUDI</button>`;
 document.body.append(dialog);const $=id=>document.getElementById(id);let busy=false,url;
 function message(s){$('pdfMacStatus').textContent=s}
 function lock(value){busy=value;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=value)}
 function result(r){message(r.count+' documenti verificati.\n'+r.removed+' copie incorporate rimosse ('+(r.bytes/1048576).toFixed(1)+' MB).\nOra puoi creare il backup leggero.');$('pdfMacBackup').hidden=false}
 async function run(action){lock(true);try{await action()}catch(e){message(e.name==='AbortError'?'Operazione annullata. Le copie incorporate sono conservate.':e.message||String(e))}finally{lock(false)}}
 trigger.onclick=()=>{message('');$('pdfMacBackup').hidden=true;$('pdfMacDirect').hidden=!window.showDirectoryPicker;dialog.showModal()};
 visibleTrigger.onclick=trigger.onclick;
 $('pdfMacDirect').onclick=()=>{
  // Call the native picker synchronously in the click event, before any I/O.
  const picked=window.showDirectoryPicker({id:lumenStorage.isTest?'lumen-pdf-prova':'lumen-pdf',mode:'readwrite'});
  run(async()=>{const parent=await picked,root=parent.name==='LUMEN_ALLEGATI'?parent:await parent.getDirectoryHandle('LUMEN_ALLEGATI',{create:true});result(await migrate({root},{write:true,progress:message}))});
 };
 $('pdfMacExport').onclick=()=>run(async()=>{const file=await exportZip(message);if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);const a=$('pdfMacDownload');a.href=url;a.download=file.name;a.hidden=false;a.style.cssText='display:block;padding:14px;margin:10px 0;background:#1f5f99;color:white';message('ZIP pronto da scaricare. Dopo averlo estratto, seleziona la cartella LUMEN_ALLEGATI qui sotto. Le copie incorporate sono ancora presenti.');});
 $('pdfMacFolder').onchange=()=>{const files=Array.from($('pdfMacFolder').files||[]);if(files.length)run(async()=>result(await migrate(sourceFromFiles(files),{progress:message})));$('pdfMacFolder').value=''};
 $('pdfMacClose').onclick=()=>{if(!busy)dialog.close()};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 $('pdfMacBackup').onclick=()=>{dialog.close();window.lumenBackupActions.light()};
 $('pdfMacFull').onclick=()=>{dialog.close();window.lumenBackupActions.full()};
})();
