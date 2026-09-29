/* Coda locale delle firme: nessun dato inviato a servizi di archiviazione remoti.
   Ogni firma conserva richiesta, identità e visita. Gli originali non si eliminano. */
(() => {
 'use strict';
 const DB='beltrami_firme_trasferimento_v1', STORE='firme', PREFIX='beltrami_firma_pending_v1_';
 const memory=new Map(), volatile=new Set(), busy=new Set();
 const clone=x=>JSON.parse(JSON.stringify(x));
 const valid=r=>r&&Boolean(r.packet?.lumen_prova)===Boolean(window.lumenStorage?.isTest)&&r.id===r.packet?.id&&r.packet.tipo==='BELTRAMI_FIRMA_IPHONE_V1'&&r.packet.versione===2&&
  typeof r.id==='string'&&r.id.length>0&&r.id.length<200&&typeof r.packet.identita==='string'&&r.packet.identita.length>0&&
  /^\d{4}-\d{2}-\d{2}$/.test(r.packet.visita||'')&&typeof r.packet.firma_lavoratore_png==='string'&&
  r.packet.firma_lavoratore_png.length<4000000&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(r.packet.firma_lavoratore_png);
 function checkConflict(old,next){
  if(old&&(old.packet.identita!==next.packet.identita||old.packet.visita!==next.packet.visita||old.packet.firma_lavoratore_png!==next.packet.firma_lavoratore_png)){
   const e=Error('Questa richiesta contiene già una firma diversa. La firma precedente è conservata. Genera un nuovo QR dal Mac.');e.conflict=true;throw e;
  }
 }
 // Bound blocked/open/transaction waits, including storage unavailable in Safari.
 function database(mode,work){return new Promise((resolve,reject)=>{
  let db,tx,done=false,result;
  const finish=(e)=>{if(done)return;done=true;clearTimeout(timer);if(e&&tx)try{tx.abort()}catch(_){}if(db)db.close();e?reject(e):resolve(result)};
  const timer=setTimeout(()=>finish(Error('Archivio firme non disponibile in tempo utile.')),4000);
  try{
   const request=lumenStorage.indexedDB.open(DB,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'})};
   request.onerror=()=>finish(request.error||Error('Archivio firme non disponibile.'));
   request.onblocked=()=>finish(Error('Archivio firme bloccato da un’altra scheda.'));
   request.onsuccess=()=>{
    db=request.result;if(done){db.close();return}db.onversionchange=()=>db.close();
    try{tx=db.transaction(STORE,mode);tx.oncomplete=()=>finish();tx.onerror=()=>finish(tx.error||Error('Scrittura firma non riuscita.'));tx.onabort=()=>finish(tx.error||Error('Scrittura firma interrotta.'));
     work(tx.objectStore(STORE),value=>{result=value},finish);
    }catch(e){finish(e)}
   };
  }catch(e){finish(e)}
 })}
 async function persist(record){
  if(!valid(record))throw Error('Firma priva di identità, data o richiesta valida.');
  const r=clone(record),previous=memory.get(r.id);checkConflict(previous,r);memory.set(r.id,r);volatile.add(r.id);
  const conflict=e=>{if(previous)memory.set(r.id,previous);else memory.delete(r.id);volatile.delete(r.id);throw e};
  try{
   await database('readwrite',(store,done,fail)=>{
    const get=store.get(r.id);get.onsuccess=()=>{try{checkConflict(get.result,r);store.put(r);done()}catch(e){fail(e)}};
   });
   const read=await database('readonly',(store,done)=>{store.get(r.id).onsuccess=e=>done(e.target.result)});
   if(JSON.stringify(read)!==JSON.stringify(r))throw Error('Rilettura della firma non confermata.');
   volatile.delete(r.id);return true;
  }catch(e){if(e.conflict)conflict(e);}
  // Separate, verified records avoid rewriting the old, potentially full cache.
  try{
   const key=PREFIX+r.id,old=JSON.parse(lumenStorage.local.getItem(key)||'null');checkConflict(old,r);
   const json=JSON.stringify(r);lumenStorage.local.setItem(key,json);
   if(lumenStorage.local.getItem(key)!==json)throw Error('Rilettura non confermata.');
   volatile.delete(r.id);return true;
  }catch(e){if(e.conflict)conflict(e);return false;}
 }
 async function list(strict=false){
  const rows=new Map();let readable=false;
  const add=r=>{if(valid(r)){const old=rows.get(r.id);if(!old||String(r.confirmedAt||r.savedAt)>String(old.confirmedAt||old.savedAt))rows.set(r.id,clone(r))}};
  try{(await database('readonly',(s,done)=>{s.getAll().onsuccess=e=>done(e.target.result||[])})).forEach(add);readable=true}catch(e){if(strict)throw Error('Non posso includere tutte le firme nel backup: archivio firme non leggibile. Riprova.');}
  try{for(let i=0;i<lumenStorage.local.length;i++){const k=lumenStorage.local.key(i);if(k&&k.startsWith(PREFIX)){try{add(JSON.parse(lumenStorage.local.getItem(k)))}catch(_){}}}readable=true}catch(_){}
  memory.forEach(r=>rows.set(r.id,clone(r)));
  if(!readable&&!rows.size)throw Error('Non riesco a leggere le firme in questo browser. Non cancellare i dati del sito.');
  return [...rows.values()].sort((a,b)=>String(b.packet.firmato||'').localeCompare(String(a.packet.firmato||'')));
 }
 const label=r=>[r.packet.cognome,r.packet.nome].filter(Boolean).join(' ')+' — visita '+r.packet.visita;
 function filename(r){const clean=s=>String(s||'').replace(/[^A-Z0-9_-]/gi,'_');return 'FIRMA_PER_MAC_'+clean(r.packet.cognome)+'_'+clean(r.packet.nome)+'_'+r.packet.visita+'_'+clean(r.id)+'.json'}
 function fileFor(r){return new File([JSON.stringify(r.packet,null,2)],filename(r),{type:'application/json'})}
 function download(r,report){
  try{const file=fileFor(r),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   report('Download avviato: controlla il file nei Download. Sul Mac apri la visita corretta e usa RICEVI DA IPHONE. Il download non conferma il salvataggio sul Mac.');
  }catch(_){report('Download non riuscito. La firma resta in questa pagina: usa CONDIVIDI / AIRDROP. Non chiudere la pagina.');}
 }
 // Called directly by a tap: no database/image awaits before native sharing.
 async function share(r,report){
  try{const file=fileFor(r);
   if(!navigator.share||!navigator.canShare||!navigator.canShare({files:[file]})){report('Condivisione file non disponibile qui. Usa SALVA FILE FIRMA, poi trasferisci il file al Mac.');return}
   await navigator.share({files:[file],title:'Firma LUMEN — '+label(r)});
   report('Condivisione completata. Sul Mac apri la visita corretta, premi RICEVI DA IPHONE e scegli il file ricevuto. L’importazione non è ancora confermata.');
  }catch(e){report(e?.name==='AbortError'?'Condivisione annullata. La firma resta disponibile in questa pagina.':'Condivisione non riuscita. Usa SALVA FILE FIRMA. Non chiudere questa pagina se la copia locale non è verificata.');}
 }
 function controls(r,report){return [
  {label:'CONDIVIDI / AIRDROP',onclick:()=>share(r,report)},
  {label:'SALVA FILE FIRMA',onclick:()=>download(r,report)},
  ...(r.peerId?[{label:'RIPROVA INVIO AL MAC',onclick:()=>send(r,report)}]:[]),
  {label:'RIPROVA SALVATAGGIO SU IPHONE',onclick:async()=>{try{report(await persist(r)?'Copia locale salvata e riletta. La firma resta da trasferire se il Mac non ha confermato.':'Copia locale NON salvata. Usa CONDIVIDI / AIRDROP oppure SALVA FILE FIRMA e controlla il file prima di chiudere.')}catch(e){report(e.message)}}}
 ]}
 function state(r){return volatile.has(r.id)?'COPIA LOCALE NON SALVATA — NON CHIUDERE QUESTA PAGINA':r.status==='confirmed'?'FIRMA RICEVUTA E SALVATA DAL MAC':'FIRMA SALVATA SU IPHONE — DA TRASFERIRE'}
 async function send(record,report){
  if(busy.has(record.id))return;
  const r=record;busy.add(r.id);
  try{
   // Refresh persistence before each retry; transport remains usable if storage fails.
   const safe=await persist(r);report((safe?'Copia locale verificata. ':'Copia locale NON salvata: non chiudere la pagina. ')+'Invio al Mac in corso… Puoi già usare CONDIVIDI / AIRDROP.');
   if(!r.peerId||typeof window.lumenBatchCertApi?.sendSignatureDirectly!=='function')throw Error('Collegamento automatico non disponibile.');
   await window.lumenBatchCertApi.sendSignatureDirectly(r.packet,r.peerId);
   r.status='confirmed';r.confirmedAt=new Date().toISOString();await persist(r);
   // Clear only the exact acknowledged request, never a subsequent worker's QR.
   try{if(JSON.parse(lumenStorage.session.getItem('beltrami_firma_handoff')||'null')?.id===r.id)lumenStorage.session.removeItem('beltrami_firma_handoff')}catch(_){}
   report('✓ FIRMA RICEVUTA E SALVATA DAL MAC. '+label(r)+'.');
  }catch(e){report(state(r)+'. '+(e.message||e)+' Usa CONDIVIDI / AIRDROP o SALVA FILE FIRMA; sul Mac premi RICEVI DA IPHONE.');}
  finally{busy.delete(r.id)}
 }
 async function finish(firma,h,d){
  const packet={...(window.lumenStorage?.isTest?{lumen_prova:true}:{}),tipo:'BELTRAMI_FIRMA_IPHONE_V1',versione:2,visita:h.visita,id:h.id,firmato:new Date().toISOString(),identita:h.identita,cognome:d.cognome||'',nome:d.nome||'',firma_lavoratore_png:firma};
  let r={id:packet.id,packet,peerId:h.peerId||'',status:'pending',savedAt:new Date().toISOString()};
  const previous=memory.get(r.id);checkConflict(previous,r);if(previous)r=previous;
  const api=window.lumenBatchCertApi,selection=api.selectionVersion();
  await persist(r);
  const report=message=>{
   const current=api.collect();
   if(selection!==api.selectionVersion()||api.workerSignatureIdentity(current)!==r.packet.identita||api.signatureVisit(current)!==r.packet.visita)return;
   const confirmed=r.status==='confirmed',title=confirmed?'✓ FIRMA RICEVUTA DAL MAC':state(r);
   api.showSaveInfo(confirmed?'ok':'warn',title,label(r)+'\n'+message,controls(r,report));api.setStatus(title);
   const detail=document.getElementById('saveDetail');if(detail){const im=document.createElement('img');im.src=r.packet.firma_lavoratore_png;im.alt='Firma da trasferire';im.style.cssText='display:block;max-width:100%;height:90px;object-fit:contain;background:white;margin-top:12px';detail.append(im)}
  };
  report(volatile.has(r.id)?'Usa subito CONDIVIDI / AIRDROP o SALVA FILE FIRMA e verifica il file prima di chiudere.':'La copia locale è stata riletta. Se la rete manca, puoi condividere o salvare il file.');
  if(r.peerId)await send(r,report);
  return true;
 }
 function renderRows(container,rows){
  rows.forEach(r=>{
   const article=document.createElement('article'),heading=document.createElement('strong'),img=document.createElement('img'),status=document.createElement('p'),note=document.createElement('p');
   article.style.cssText='padding:14px;margin:12px 0;border:1px solid #aaa;border-radius:10px;background:white;color:#152536;overflow-wrap:anywhere';
   heading.textContent=label(r);img.src=r.packet.firma_lavoratore_png;img.alt='Firma '+label(r);img.style.cssText='display:block;width:100%;max-height:140px;object-fit:contain';
   status.textContent=state(r);status.setAttribute('role','status');note.textContent='Acquisita: '+new Date(r.packet.firmato).toLocaleString('it-IT')+'. Sul Mac usa RICEVI DA IPHONE: vengono controllati lavoratore, visita e richiesta.';
   article.append(heading,img,status,note);
   controls(r,message=>{status.textContent=message}).forEach(action=>{const b=document.createElement('button');b.type='button';b.textContent=action.label;b.style.cssText='font:700 15px system-ui;padding:12px;margin:6px;border:0;border-radius:8px;background:#1f5f99;color:white';b.onclick=action.onclick;article.append(b)});container.append(article);
  });
 }
 async function openRecovery(){
  const dialog=document.createElement('dialog');dialog.id='lumenPendingSignatures';dialog.style.cssText='width:min(640px,92vw);max-height:88vh;overflow:auto;border:2px solid #1f5f99;border-radius:12px;font:17px system-ui';
  const title=document.createElement('h2');title.textContent='FIRME DA TRASFERIRE';
  const close=document.createElement('button');close.type='button';close.textContent='CHIUDI';close.onclick=()=>{dialog.close();dialog.remove()};dialog.addEventListener('cancel',()=>dialog.remove(),{once:true});
  const status=document.createElement('p');status.textContent='Lettura delle firme locali…';const body=document.createElement('div');
  const legacy=document.createElement('a');legacy.href='recupera-firme.html'+(window.lumenStorage?.isTest?'?prova=fantasma':'');legacy.textContent='Apri anche le firme storiche senza data';
  dialog.append(title,close,status,body,legacy);document.body.append(dialog);dialog.showModal();
  try{const rows=await list();status.textContent=rows.length?rows.length+' firme con data e richiesta. Le copie restano conservate anche dopo la conferma del Mac.':'Nessuna firma con data trovata in questo browser.';renderRows(body,rows)}catch(e){status.textContent=e.message}
 }
 async function restore(rows){
  if(!Array.isArray(rows)||rows.some(r=>!valid(r)))throw Error('Archivio firme del backup non valido.');
  for(const r of rows)if(!await persist(r))throw Error('Ripristino delle firme non verificato: conserva il backup.');
 }
 window.addEventListener('beforeunload',e=>{if([...volatile].some(id=>memory.get(id)?.status!=='confirmed')){e.preventDefault();e.returnValue=''}});
 window.lumenFirmaOffline={finish,list,persist,restore,valid,openRecovery,renderRows,fileFor,hasVolatile:()=>volatile.size>0};
})();
