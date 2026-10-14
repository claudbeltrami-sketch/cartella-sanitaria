/* Local V1 backup writer. Never materialize all attachments or a whole
 * attachment as a JavaScript string. The archive is only read. */
(function () {
 'use strict';
 const CHUNK = 192 * 1024; // Divisible by three: base64 chunks concatenate exactly.
 function read(db, store, method, key) {
  return new Promise((resolve, reject) => {
   const tx = db.transaction(store, 'readonly'), source = tx.objectStore(store);
   const request = key === undefined ? source[method]() : source[method](key);
   let value;
   request.onsuccess = () => { value = request.result; };
   tx.oncomplete = () => resolve(value);
   tx.onerror = tx.onabort = () => reject(tx.error || request.error || Error('Lettura allegati interrotta.'));
  });
 }
 function base64(blob) {
  return new Promise((resolve, reject) => {
   const reader = new FileReader();
   reader.onload = () => resolve(String(reader.result).split(',')[1]);
   reader.onerror = reader.onabort = () => reject(reader.error || Error('Allegato non leggibile.'));
   reader.readAsDataURL(blob);
  });
 }
 async function build({packet, name, openDb, store, mode = 'full', progress = () => {}}) {
  const db = await openDb(), parts = [];
  const append = value => parts.push(new Blob([value]));
  try {
   const keys = await read(db, store, 'getAllKeys');
   const {contenuto, ...header} = packet;
   if(mode==='light'){header.tipo='BELTRAMI_BACKUP_LEGGERO_V2';header.versione=2;header.allegatiSeparati=true;}
   const {originali, ...data} = contenuto;
   append(JSON.stringify(header).slice(0, -1) + ',"contenuto":' + JSON.stringify(data).slice(0, -1) + ',"originali":[');
   for (let i = 0; i < keys.length; i++) {
    const row = await read(db, store, 'get', keys[i]);
    if (!row) throw Error('Un allegato è cambiato durante il backup. Riprova senza modificare l’archivio.');
    let {blob, ...meta} = row;
    if(mode==='light'&&row.kind==='allegato_cartella_v1'){
     if(blob!=null||!window.lumenExternalAttachments?.valid(row.external))throw Error('Prima del backup leggero, apri ARCHIVIO PDF SUL MAC e completa la separazione/verifica degli allegati. Le copie incorporate sono conservate.');
     window.lumenExternalAttachments.validateLightRows([row]);
    }else if(blob==null&&row.external){
     if(!window.lumenExternalAttachments)throw Error('Modulo archivio PDF non disponibile. Ricarica LUMEN.');
     blob=await window.lumenExternalAttachments.getBlob(row);
    }
    append((i ? ',' : '') + JSON.stringify(meta).slice(0, -1) + ',"blob":');
    if (blob == null) append('null');
    else {
     if (!(blob instanceof Blob)) throw Error('Formato allegato non valido. Backup non completato.');
     append(JSON.stringify('data:' + (blob.type || 'application/octet-stream') + ';base64,').slice(0, -1));
     for (let offset = 0; offset < blob.size; offset += CHUNK) {
      append(await base64(blob.slice(offset, offset + CHUNK)));
      progress(i + 1, keys.length, Math.min(100, Math.round((offset + CHUNK) / Math.max(1, blob.size) * 100)));
      await new Promise(resolve => setTimeout(resolve, 0));
     }
     append('"');
    }
    append('}');
    progress(i + 1, keys.length, 100);
   }
   append(']}}');
   return {file: new File(parts, name, {type: 'application/json'}), originals: keys.length};
  } finally { db.close(); }
 }
 window.lumenBackupStream = {build};
})();
