/* Documenti clinici locali. Lo store originali è già incluso nel backup e nella
   modalità PROVA FANTASMA: nessuna migrazione e nessuna modifica alle cartelle. */
(() => {
 'use strict';
 const api=window.lumenBatchCertApi,storage=window.lumenAllegatiStorage,kind='allegato_cartella_v1';
 const button=document.getElementById('btnAllegatiCartella');
 const css=document.createElement('style');
 css.textContent=`
 #allegatiDialog{width:min(900px,calc(100vw - 24px));max-height:90vh;box-sizing:border-box;border:2px solid #27834a;border-radius:12px;padding:20px;color:#222;background:white}
 #allegatiDialog::backdrop{background:#0009}#allegatiDialog h3{margin:0}
 #allegatiDialog .allegati-fields{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}
 #allegatiDialog label{display:flex;flex-direction:column;gap:5px;font-weight:bold;flex:1 1 210px}
 #allegatiDialog input{box-sizing:border-box;max-width:100%;min-height:42px;padding:7px;font-size:16px;border:1px solid #888;border-radius:6px}
 #allegatiDialog input[type=file]{width:100%;background:#f3fbf5}#allegatiDialog .consent-current{white-space:pre-line}
 #allegatiDialog .consent-item-title{overflow-wrap:anywhere}#allegatiMessage{white-space:pre-line;margin:12px 0;font-weight:bold}
 #allegatiMessage[data-error=true]{color:#a51c1c}#allegatiPending{overflow-wrap:anywhere;white-space:pre-line;margin:10px 0}
 @media print{#allegatiDialog{display:none!important}}
 `;
 document.head.appendChild(css);
 const dialog=document.createElement('dialog');dialog.id='allegatiDialog';dialog.setAttribute('aria-labelledby','allegatiTitle');
 dialog.innerHTML=`<div class="consent-head"><h3 id="allegatiTitle">ALLEGATI CARTELLA</h3><button type="button" id="allegatiClose" class="secondary">CHIUDI</button></div>
 <div id="allegatiWorker" class="consent-current"></div>
 <p>Controlla il lavoratore prima di aggiungere foto o referti. Puoi inserirli anche dopo la visita.</p>
 <label for="allegatiFiles">AGGIUNGI FOTO O PDF<input type="file" id="allegatiFiles" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.tif,.tiff,application/pdf,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/tiff"></label>
 <div class="allegati-fields"><label for="allegatiDate">DATA DOCUMENTO (facoltativa)<input id="allegatiDate" type="date"></label><label for="allegatiNote">DESCRIZIONE (facoltativa)<input id="allegatiNote" maxlength="200" placeholder="ES. ANALISI SERMOLAB"></label></div>
 <div id="allegatiPending"></div><button type="button" id="allegatiSave" class="success" disabled>SALVA ALLEGATI</button>
 <div id="allegatiMessage" role="status" aria-live="polite"></div>
 <p class="archive-note">I file restano su questo dispositivo e sono inclusi in CREA BACKUP. Il PDF e il JSON della singola cartella non includono i file allegati. Massimo 25 MB per file e 100 MB per selezione.</p>
 <h4>DOCUMENTI DEL LAVORATORE</h4><div id="allegatiList" class="consent-list"></div>`;
 document.body.appendChild(dialog);
 const $=id=>document.getElementById(id);
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const fmt=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):String(v||'');
 let target=null,pending=[],busy=false,renderVersion=0;
 function identity(data){
  const x=storage.identity(data);
  if(!x.cognome||!x.nome||(!x.cf&&!x.dn&&!lumenStorage.isTest))throw Error('Apri la cartella del lavoratore. Servono cognome, nome e codice fiscale oppure data di nascita.');
  return {key:api.cartellaId(data),cf:x.cf,name:[data.cognome,data.nome].join(' ').trim(),birth:x.dn,visit:data.data_giudizio||data.data_cartella||''};
 }
 function stamp(x){return JSON.stringify([x.key,x.name,x.birth,x.visit])}
 function assertTarget(){
  if(!target||stamp(identity(api.collect()))!==stamp(target)||api.selectionVersion()!==target.selection)throw Error('La cartella è cambiata. Chiudi ALLEGATI CARTELLA e riaprilo dal lavoratore corretto. Nessun nuovo file salvato.');
 }
 function message(value,error=false){$('allegatiMessage').textContent=value;$('allegatiMessage').dataset.error=String(error)}
 function setBusy(value){busy=value;for(const id of ['allegatiFiles','allegatiDate','allegatiNote','allegatiClose'])$(id).disabled=value;$('allegatiSave').disabled=value||!pending.length;dialog.querySelectorAll('#allegatiList button').forEach(b=>b.disabled=value)}
 function size(n){return n>=1048576?(n/1048576).toFixed(1)+' MB':Math.ceil(n/1024)+' KB'}
 function isMatch(row,person){return row.kind===kind&&row.workerKey===person.key}
 async function list(person){return (await storage.list()).filter(row=>isMatch(row,person)).sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)))}
 async function render(){
  const version=++renderVersion,person=target;
  $('allegatiList').textContent='LETTURA ALLEGATI…';
  const rows=await list(person);if(version!==renderVersion||person!==target)return;
  $('allegatiList').innerHTML=rows.length?rows.map(row=>`<article class="consent-item"><div class="consent-item-title">${escape(row.name)}</div><div class="consent-meta">${escape(size(row.size))} — VISITA: ${escape(fmt(row.visit)||'NON INDICATA')}${row.documentDate?' — DOCUMENTO: '+escape(fmt(row.documentDate)):''}<br>AGGIUNTO: ${escape(new Date(row.savedAt).toLocaleString('it-IT'))}${row.note?'<br>'+escape(row.note):''}</div><div class="consent-actions"><button type="button" class="success" data-open="${escape(row.id)}">APRI</button><button type="button" class="secondary" data-download="${escape(row.id)}">SALVA COPIA</button><button type="button" class="danger" data-delete="${escape(row.id)}">ELIMINA</button></div></article>`).join(''):'NESSUN ALLEGATO PER QUESTO LAVORATORE.';
  const byId=new Map(rows.map(row=>[row.id,row]));
  $('allegatiList').querySelectorAll('button').forEach(b=>b.onclick=async()=>{
   if(busy)return;
   try{
    assertTarget();const id=b.dataset.open||b.dataset.download||b.dataset.delete,row=byId.get(id);
    if(b.dataset.delete){
     if(busy||!confirm('ELIMINARE SOLO QUESTO ALLEGATO?\n'+row.name+'\nLavoratore: '+target.name))return;
     setBusy(true);await remove(row);message('Allegato eliminato.');await render();
    }else{
     if(!(row.blob instanceof Blob))throw Error('File non disponibile. Ripristina una copia di sicurezza che lo contiene.');
     const url=URL.createObjectURL(row.blob),a=document.createElement('a');a.href=url;
     if(b.dataset.download)a.download=row.name;else{a.target='_blank';a.rel='noopener noreferrer'}
     document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),300000);
    }
   }catch(e){message(e.message||String(e),true)}finally{setBusy(false)}
  });
 }
 async function remove(row){
  const db=await storage.open();try{
   assertTarget();await new Promise((resolve,reject)=>{const tx=db.transaction(storage.store,'readwrite');tx.objectStore(storage.store).delete(row.id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Eliminazione non riuscita.'));tx.onerror=()=>{};});
  }finally{db.close()}
 }
 function safeType(file){
  const ext=file.name.split('.').pop().toLowerCase();
  const types={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',heic:'image/heic',heif:'image/heif',tif:'image/tiff',tiff:'image/tiff'};
  if(!Object.hasOwn(types,ext))throw Error('Formato non supportato: '+file.name+'. Scegli foto o PDF.');
  if(!file.size)throw Error('File vuoto: '+file.name);
  if(file.size>25*1048576)throw Error('Il file supera 25 MB: '+file.name);
  return types[ext];
 }
 async function prepare(files,person,meta){
  if(files.reduce((n,f)=>n+f.size,0)>100*1048576)throw Error('La selezione supera 100 MB. Aggiungi meno file per volta.');
  const types=files.map(safeType),rows=[];
  for(let i=0;i<files.length;i++){
   const file=files[i],bytes=await file.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   rows.push({id:'ATT_'+crypto.randomUUID(),kind,workerKey:person.key,workerCf:person.cf,workerLabel:person.name,workerBirth:person.birth,visit:person.visit,documentDate:meta.date,note:meta.note,name:file.name,type:types[i],size:file.size,savedAt:new Date().toISOString(),hash,blob:new Blob([bytes],{type:types[i]}),...(lumenStorage.isTest?{lumen_prova:true}:{})});
  }
  return rows;
 }
 async function persist(rows){
  const db=await storage.open();try{
   assertTarget();
   return await new Promise((resolve,reject)=>{
    const tx=db.transaction(storage.store,'readwrite'),st=tx.objectStore(storage.store);let added=0,skipped=0;
    const req=st.getAll();req.onsuccess=()=>{
     try{
      assertTarget();const seen=new Set(req.result.filter(r=>isMatch(r,target)).map(r=>JSON.stringify([r.visit,r.hash])));
      for(const row of rows){const key=JSON.stringify([row.visit,row.hash]);if(seen.has(key)){skipped++;continue}st.add(row);seen.add(key);added++;}
     }catch(e){tx.abort();reject(e)}
    };
    tx.oncomplete=()=>resolve({added,skipped});tx.onabort=()=>reject(tx.error||Error('Salvataggio non riuscito. Nessun nuovo allegato salvato.'));tx.onerror=()=>{};
   });
  }finally{db.close()}
 }
 button.onclick=async()=>{
  if(busy)return;
  try{
   target={...identity(api.collect()),selection:api.selectionVersion()};pending=[];
   $('allegatiFiles').value='';$('allegatiDate').value='';$('allegatiNote').value='';$('allegatiPending').textContent='';message('');setBusy(false);
   $('allegatiWorker').textContent=target.name+'\n'+(target.cf?'CF: '+target.cf:'NASCITA: '+fmt(target.birth))+'\nVISITA: '+(fmt(target.visit)||'NON INDICATA');
   dialog.showModal();await render();
  }catch(e){if(dialog.open)message(e.message,true);else alert(e.message)}
 };
 $('allegatiFiles').onchange=()=>{pending=Array.from($('allegatiFiles').files||[]);$('allegatiPending').textContent=pending.map(f=>f.name+' — '+size(f.size)).join('\n');message('');setBusy(false)};
 $('allegatiSave').onclick=async()=>{
  if(busy||!pending.length)return;
  setBusy(true);message('SALVATAGGIO IN CORSO…');
  try{
   assertTarget();const rows=await prepare(pending,target,{date:$('allegatiDate').value,note:$('allegatiNote').value.trim()});
   const result=await persist(rows);pending=[];$('allegatiFiles').value='';$('allegatiPending').textContent='';
   message(result.added+' ALLEGATI SALVATI PER '+target.name+(result.skipped?'\n'+result.skipped+' FILE GIÀ PRESENTI: NON DUPLICATI.':''));
   api.setStatus('ALLEGATI ARCHIVIATI LOCALMENTE PER '+target.name+'. INCLUSI NEL BACKUP COMPLETO.');
   try{await render()}catch(e){message('ALLEGATI SALVATI. Impossibile aggiornare l’elenco: chiudi e riapri ALLEGATI CARTELLA.',true)}
  }catch(e){message('ALLEGATI NON SALVATI: '+(e.message||String(e)),true)}finally{setBusy(false)}
 };
 function close(){if(!busy){renderVersion++;dialog.close();button.focus()}}
 $('allegatiClose').onclick=close;
 dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
})();
