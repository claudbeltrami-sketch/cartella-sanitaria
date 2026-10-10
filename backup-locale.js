/* Read-only archive exporter. No automatic navigation or popup lifecycle. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),prepare=$('prepare'),status=$('status'),details=$('details'),share=$('share'),download=$('download');
 let prepared=null,url=null;
 async function openExisting(name){
  if(typeof indexedDB.databases==='function'&&!(await indexedDB.databases()).some(db=>db.name===name&&db.version>0))return null;
  return new Promise((resolve,reject)=>{
  let settled=false,missing=false;
  const timer=setTimeout(()=>finish(Error('Archivio non disponibile: '+name+'. Torna a LUMEN nello stesso browser.')),12000);
  function finish(error,value){if(settled){value?.close();return}settled=true;clearTimeout(timer);error?reject(error):resolve(value)}
  let req;try{req=indexedDB.open(name)}catch(e){finish(e);return}
  req.onupgradeneeded=()=>{missing=true;req.transaction.abort()};
  req.onerror=()=>missing?finish(null,null):finish(req.error||Error('Impossibile leggere '+name));
  req.onblocked=()=>finish(Error('Archivio occupato da un’altra scheda. Riprova dopo aver terminato l’operazione in LUMEN.'));
  req.onsuccess=()=>finish(null,req.result);
 })}
 function read(db,store,method,key){return new Promise((resolve,reject)=>{
  if(!db)return resolve(method==='get'?undefined:[]);
  if(!db.objectStoreNames.contains(store))return reject(Error('Archivio incompleto: manca '+store));
  const tx=db.transaction(store,'readonly'),request=key===undefined?tx.objectStore(store)[method]():tx.objectStore(store)[method](key);
  let value;request.onsuccess=()=>{value=request.result};
  tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error||request.error||Error('Lettura archivio interrotta.'));
 })}
 function dataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error('Allegato non leggibile.'));r.readAsDataURL(blob)})}
 function stamp(){const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'_'+p(d.getHours())+'-'+p(d.getMinutes())+'-'+p(d.getSeconds())}
 function signatures(rows,local){
  const all=new Map();
  function add(r){const p=r?.packet;if(!p||p.lumen_prova||r.id!==p.id||typeof r.id!=='string'||!r.id.length||r.id.length>=200||p.tipo!=='BELTRAMI_FIRMA_IPHONE_V1'||p.versione!==2||typeof p.identita!=='string'||!p.identita.length||!/^\d{4}-\d{2}-\d{2}$/.test(p.visita||'')||typeof p.firma_lavoratore_png!=='string'||p.firma_lavoratore_png.length>=4000000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.firma_lavoratore_png))return;const old=all.get(r.id);if(!old||String(r.confirmedAt||r.savedAt)>String(old.confirmedAt||old.savedAt))all.set(r.id,r)}
  rows.forEach(add);Object.entries(local).forEach(([key,value])=>{if(key.startsWith('beltrami_firma_pending_v1_')){try{add(JSON.parse(value))}catch(_){}}});return [...all.values()];
 }
 async function build(){
  const local={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('beltrami_'))local[key]=localStorage.getItem(key)}
  let chartsDb,filesDb,signDb;
  try{
   status.textContent='Lettura delle cartelle archiviate…';chartsDb=await openExisting('beltrami_cartelle_db_v1');
   const cartelle=await read(chartsDb,'cartelle','getAll');
   if(!cartelle.length)throw Error('Qui non risultano cartelle archiviate. Apri questa pagina nello stesso browser con cui usi LUMEN. Nessun backup vuoto è stato creato.');
   filesDb=await openExisting('beltrami_lumen_files_v1');const keys=await read(filesDb,'originali','getAllKeys');
   signDb=await openExisting('beltrami_firme_trasferimento_v1');const firme=signatures(await read(signDb,'firme','getAll'),local);
   const parts=[new Blob(['{"tipo":"BELTRAMI_BACKUP_COMPLETO_V1","versione":1,"creato":',JSON.stringify(new Date().toISOString()),',"origine":"BACKUP_DIRETTO_ARCHIVIO","contenuto":{"localStorage":',JSON.stringify(local),',"cartelle":',JSON.stringify(cartelle),',"firme_da_trasferire":',JSON.stringify(firme),',"originali":['])];
   for(let i=0;i<keys.length;i++){
    status.textContent='Cartelle: '+cartelle.length+'\nPreparazione allegato '+(i+1)+' di '+keys.length+'…';
    const row=await read(filesDb,'originali','get',keys[i]);if(!row)throw Error('Un allegato è cambiato durante la lettura. Riprova senza modificare LUMEN nel frattempo.');
    // Serialize and release each attachment separately, rather than holding all base64 strings.
    const text=JSON.stringify({...row,blob:row.blob?await dataURL(row.blob):null});parts.push(new Blob([(i?',':''),text]));
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   parts.push(']}}');return {file:new File(parts,'BACKUP_LUMEN_'+stamp()+'.json',{type:'application/json'}),charts:cartelle.length,files:keys.length,signs:firme.length};
  }finally{chartsDb?.close();filesDb?.close();signDb?.close()}
 }
 prepare.onclick=async()=>{
  if(prepare.disabled)return;prepare.disabled=true;prepare.textContent='PREPARAZIONE IN CORSO…';share.hidden=true;download.hidden=true;$('instructions').hidden=true;details.textContent='';prepared=null;if(url){URL.revokeObjectURL(url);url=null}
  try{
   const result=await build();prepared=result.file;url=URL.createObjectURL(prepared);download.href=url;download.download=prepared.name;download.hidden=false;
   let canShare=false;try{canShare=!!(navigator.share&&navigator.canShare&&navigator.canShare({files:[prepared]}))}catch(_){}share.hidden=!canShare;
   details.textContent='Cartelle archiviate: '+result.charts+'\nFile originali e allegati: '+result.files+'\nFirme da trasferire: '+result.signs+'\nDimensione: '+(prepared.size/1024/1024).toFixed(2)+' MB\nNome: '+prepared.name;
   status.textContent='BACKUP PRONTO, DA SALVARE.\nPremi il pulsante 2 qui sotto.';$('instructions').hidden=!canShare;
  }catch(e){status.textContent='BACKUP NON CREATO\n'+(e.message||String(e))}
  finally{prepare.disabled=false;prepare.textContent='1 · PREPARA NUOVO BACKUP'}
 };
 share.onclick=async()=>{if(!prepared)return;share.disabled=true;try{await navigator.share({files:[prepared],title:'Backup LUMEN'});status.textContent='Condivisione conclusa. Se hai scelto «Salva su File» e confermato «Salva», controlla la cartella scelta. Il browser non può confermare il salvataggio.'}catch(e){status.textContent=e.name==='AbortError'?'Salvataggio annullato. Il file è ancora disponibile: puoi riprovare.':'Condivisione non disponibile: '+(e.message||String(e))+'\nUsa SCARICA BACKUP.'}finally{share.disabled=false}};
 download.onclick=()=>{status.textContent='Download richiesto. Completa il salvataggio nel browser e controlla la cartella scelta. Il file resta disponibile in questa pagina.'};
})();
