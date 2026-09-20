/* Recupero esplicito di firme storiche. Nessuna migrazione o scrittura all'avvio. */
(() => {
 'use strict';
 const prefix='LUMEN-FIRMA:', maxLength=4000000;
 const validImage=v=>typeof v==='string'&&v.length<=maxLength&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(v);
 const upper=v=>String(v||'').trim().toLocaleUpperCase('it-IT');
 function node(tag,text){const e=document.createElement(tag);if(text)e.textContent=text;return e}
 function modal(title){
  const d=node('dialog');d.style.cssText='width:min(560px,90vw);max-height:85vh;overflow:auto;padding:22px;border:2px solid #1f5f99;border-radius:12px;background:#fff;color:#152536;font:18px system-ui;box-sizing:border-box';
  const heading=node('h2',title);heading.style.cssText='font-size:23px;margin:0 0 16px';d.append(heading);document.body.append(d);d.showModal();return d;
 }
 function button(text){const b=node('button',text);b.type='button';b.style.cssText='font:700 16px system-ui;padding:13px;margin:12px 10px 0 0;border:0;border-radius:8px;background:#1f5f99;color:white;cursor:pointer';return b}
 function status(message){
  const el=document.getElementById('status');if(el)el.textContent=message;
  if(typeof window.setStatus==='function')window.setStatus(message);
 }
 async function copyPacket(packet){
  const value=prefix+JSON.stringify(packet);
  try{
   if(!navigator.clipboard||!navigator.clipboard.writeText)throw Error('clipboard');
   await navigator.clipboard.writeText(value);
   status('Firma copiata. Sul Mac apri la cartella corretta e premi INCOLLA FIRMA. Il passaggio tra dispositivi richiede gli Appunti condivisi Apple.');
  }catch(_){
   const d=modal('COPIA FIRMA');d.append(node('p','Seleziona e copia tutto il testo qui sotto. Sul Mac apri la cartella corretta e premi INCOLLA FIRMA.'));
   const area=node('textarea');area.value=value;area.setAttribute('aria-label','Firma da copiare');area.style.cssText='width:100%;height:140px;font-size:16px;box-sizing:border-box';d.append(area);
   const close=button('CHIUDI');close.onclick=()=>{d.close();d.remove()};d.append(close);d.addEventListener('cancel',()=>d.remove(),{once:true});area.focus();area.select();
  }
 }
 function validateRecovered(packet,snapshot){
  if(!packet||packet.tipo!=='BELTRAMI_FIRMA_IPHONE_V1'||packet.versione!==1||packet.recuperata!==true||packet.visita||!validImage(packet.firma_lavoratore_png))throw Error('Il file non è una firma recuperata valida.');
  const identity=upper(packet.identita), exact=workerSignatureIdentity(snapshot);
  const nameDate=[upper(snapshot.cognome),upper(snapshot.nome),upper(snapshot.data_nascita)].join('|');
  // Permit the original full name/date identity even if a CF was added later.
  const same=identity===exact||(snapshot.cognome&&snapshot.nome&&snapshot.data_nascita&&identity===nameDate);
  if(!same||!identity||!snapshot.cognome||!snapshot.nome)throw Error('La firma non appartiene al lavoratore aperto. Apri la cartella corretta.');
  checkedSignatureVisit(snapshot);
  if(snapshot.firma_lavoratore_png&&snapshot.firma_lavoratore_png!==packet.firma_lavoratore_png)throw Error('La cartella contiene già una firma. Il recupero non la sostituisce.');
 }
 function askRecovery(packet,snapshot){
  return new Promise(resolve=>{
   const d=modal('CONFERMA FIRMA RECUPERATA');d.id='lumenRecoveryConfirm';
   d.append(node('p',[snapshot.cognome,snapshot.nome].join(' ')+' — visita del '+checkedSignatureVisit(snapshot)));
   d.append(node('p','Questa firma è stata recuperata dall’archivio dell’iPhone, che non conserva la data di acquisizione. Verifica che appartenga alla visita indicata. Se non puoi confermarlo, annulla.'));
   const img=node('img');img.alt='Anteprima della firma recuperata';img.style.cssText='width:100%;max-height:180px;object-fit:contain;border:1px solid #bbb';d.append(img);
   const label=node('label');label.style.cssText='display:block;margin-top:18px;line-height:1.5';const check=node('input');check.type='checkbox';check.id='lumenRecoveryAttestation';label.append(check,document.createTextNode(' Confermo che questa firma appartiene al lavoratore e alla visita indicati.'));d.append(label);
   const error=node('p');error.setAttribute('role','alert');d.append(error);
   const yes=button('INSERISCI FIRMA NELLA VISITA'),no=button('ANNULLA');yes.disabled=true;
   let loaded=false,done=false;const finish=value=>{if(done)return;done=true;d.close();d.remove();resolve(value)};
   check.onchange=()=>{yes.disabled=!(loaded&&check.checked)};
   img.onload=()=>{loaded=!!img.naturalWidth;yes.disabled=!(loaded&&check.checked)};
   img.onerror=()=>{loaded=false;yes.disabled=true;error.textContent='La firma non è leggibile. Nessun dato è stato modificato.'};img.src=packet.firma_lavoratore_png;
   yes.onclick=()=>{if(loaded&&check.checked)finish(true)};no.onclick=()=>finish(false);d.addEventListener('cancel',e=>{e.preventDefault();finish(false)});d.append(yes,no);
  });
 }
 let recovering=false;
 async function recover(packet){
  if(recovering)throw Error('È già aperta una verifica della firma. Completa o annulla quella verifica.');
  recovering=true;
  try{
   const snapshot=collect(),selection=workerSelectionVersion,unchanged=JSON.stringify(snapshot);
   validateRecovered(packet,snapshot);
   const id=cartellaId(snapshot),old=await getCartellaRecord(id);
   if(old){validateRecovered(packet,old.data);if(signatureVisit(old.data)!==signatureVisit(snapshot))throw Error('La visita aperta non coincide con quella archiviata. Riapri la cartella corretta.');}
   if(!await askRecovery(packet,snapshot)){setStatus('RECUPERO ANNULLATO. Nessun dato modificato.');return;}
   const image=await optimizeWorkerSignature(packet.firma_lavoratore_png,true);
   if(selection!==workerSelectionVersion||JSON.stringify(collect())!==unchanged)throw Error('La cartella è cambiata durante il recupero. Nessuna firma inserita.');
   const current=await getCartellaRecord(id);
   if(JSON.stringify(current)!==JSON.stringify(old))throw Error('La cartella archiviata è cambiata. Riaprila prima di recuperare la firma.');
   if(selection!==workerSelectionVersion||JSON.stringify(collect())!==unchanged)throw Error('La cartella è cambiata durante il recupero. Nessuna firma inserita.');
   // Preserve every existing clinical field; only signature and provenance are added.
   const data={...(old?old.data:snapshot),firma_lavoratore_png:image,firma_lavoratore_recupero:{origine:'archivio_firme_senza_data',identita_originale:packet.identita,visita_confermata:checkedSignatureVisit(snapshot),confermato_il:new Date().toISOString()}};
   const saved=await saveToLocalArchive(data),verified=await getCartellaRecord(saved.rec.id);
   if(!verified||JSON.stringify(verified.data)!==JSON.stringify(data))throw Error('Salvataggio non verificato. Conserva la firma originale e controlla la cartella.');
   if(selection===workerSelectionVersion&&JSON.stringify(collect())===unchanged)useWorkerSignature(image);
   showSaveInfo('ok','FIRMA RECUPERATA E SALVATAGGIO VERIFICATO',[snapshot.cognome,snapshot.nome].join(' ')+' — visita del '+signatureVisit(snapshot)+'. La data della visita è stata confermata da te; la firma originale resta conservata sull’iPhone.');
   setStatus('FIRMA RECUPERATA E VERIFICATA NELL’ARCHIVIO.');
  }finally{recovering=false;}
 }
 function parseClipboard(value){
  const text=String(value||'').trim();if(!text.startsWith(prefix)||text.length>maxLength)throw Error('Negli Appunti non c’è una firma LUMEN. Sull’iPhone usa COPIA FIRMA, poi incolla qui il contenuto.');
  return JSON.parse(text.slice(prefix.length));
 }
 async function pasteDialog(){
  // Read while the click's user activation is still available.
  const read=navigator.clipboard&&navigator.clipboard.readText?navigator.clipboard.readText().catch(()=>null):Promise.resolve(null);
  const d=modal('INCOLLA FIRMA');d.append(node('p','Incolla la firma copiata sull’iPhone. Per gli Appunti condivisi, i due dispositivi devono essere configurati per questa funzione.'));
  const area=node('textarea');area.setAttribute('aria-label','Firma da incollare');area.placeholder='Incolla qui';area.style.cssText='width:100%;height:120px;font-size:16px;box-sizing:border-box';d.append(area);
  const error=node('p');error.setAttribute('role','alert');d.append(error);
  const next=button('CONTROLLA FIRMA'),cancel=button('ANNULLA');d.append(next,cancel);let edited=false,closed=false;
  area.addEventListener('input',()=>{edited=true});const close=()=>{closed=true;d.close();d.remove()};cancel.onclick=close;d.addEventListener('cancel',e=>{e.preventDefault();close()});
  read.then(value=>{if(!closed&&!edited&&value&&value.startsWith(prefix))area.value=value});
  next.onclick=async()=>{
   let packet;try{packet=parseClipboard(area.value)}catch(e){error.textContent=e.message;return;}
   close();try{await window.beltramiFirmaIphone.importPacket(packet)}catch(e){showSaveInfo('error','FIRMA NON IMPORTATA',e.message||String(e));setStatus('FIRMA NON IMPORTATA: '+(e.message||e));}
  };area.focus();
 }
 window.lumenFirmaRecovery={copyPacket,parseClipboard};
 if(window.beltramiFirmaIphone){
  const original=window.beltramiFirmaIphone.importPacket;
  window.beltramiFirmaIphone.importPacket=async packet=>{
   if(packet&&packet.recuperata===true&&packet.versione===1)return recover(packet);
   return original(packet);
  };
  const paste=document.getElementById('btnIncollaFirma');if(paste)paste.onclick=pasteDialog;
 }
})();
