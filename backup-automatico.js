/* Session-scoped automatic backups. No network and no writes to clinical records. */
(() => {
 'use strict';
 const interval=30*60*1000;
 const button=document.getElementById('btnBackupAutomatico');
 if(!button||!window.lumenBackupApi)return;
 let active=false,busy=false,directory=null,next=0,timer=null,sequence=0;
 const dialog=document.createElement('dialog');
 dialog.id='autoBackupDialog';
 dialog.style.cssText='width:min(560px,calc(100vw - 32px));max-height:85vh;overflow:auto;border:1px solid #aac3cf;border-radius:12px;padding:22px;box-sizing:border-box;color:#17364a';
 dialog.innerHTML='<h2>Backup automatico durante l’uso</h2><p>Una copia completa subito e poi ogni 30 minuti con LUMEN aperto e visibile. Dopo una pausa, la copia scaduta parte al ritorno alla pagina.</p><p>Ogni file ha un nome diverso: le copie precedenti restano conservate. Include cartelle e storico, firme, allegati, consensi cartacei, liste e cartella in compilazione.</p><p id="autoBackupHelp"></p><p><strong>Si attiva per questa scheda e questa sessione.</strong> Dopo aver chiuso o ricaricato LUMEN, riattivalo. Attivalo in una sola scheda.</p><p id="autoBackupDetail" role="status" aria-live="polite"></p><div style="display:flex;flex-wrap:wrap;gap:8px"><button type="button" id="autoBackupStart">ATTIVA E CREA PRIMA COPIA</button><button type="button" id="autoBackupStop">DISATTIVA</button><button type="button" id="autoBackupClose">CHIUDI</button></div>';
 document.body.appendChild(dialog);
 const $=id=>document.getElementById(id);
 const notice=document.createElement('div');notice.id='autoBackupStatus';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 notice.style.cssText='padding:8px 12px;background:#edf6fa;color:#17364a;font-size:13px;display:none';
 document.getElementById('mainToolbar').insertAdjacentElement('afterend',notice);
 const css=document.createElement('style');css.textContent='@media print{#autoBackupStatus,#autoBackupDialog{display:none!important}}';document.head.appendChild(css);
 const supported=typeof window.showDirectoryPicker==='function';
 $('autoBackupHelp').textContent=supported?'Scegli una cartella locale del Mac, fuori da iCloud o altre cartelle sincronizzate. LUMEN salva e rilegge ogni file per verificarlo.':'Questo browser usa i download: consenti i download multipli e scegli una cartella locale del Mac. Se il browser chiede dove salvare, dovrai confermare ogni copia. LUMEN non può verificare il file su disco: controlla che compaia nei Download. Non cambiare browser senza trasferire prima il backup: gli archivi sono separati.';
 function render(message,error=false){
  notice.style.display='block';notice.style.background=error?'#fff0e6':'#edf6fa';
  notice.textContent=(window.lumenStorage.isTest?'PROVA — ':'')+message;
  $('autoBackupDetail').textContent=notice.textContent;
  button.textContent=active?'BACKUP AUTO ATTIVO':'BACKUP AUTOMATICO';
  $('autoBackupStart').disabled=busy||active;$('autoBackupStop').disabled=!active;
 }
 function stop(){active=false;directory=null;clearInterval(timer);timer=null;render('Backup automatico disattivato. Le copie già create restano disponibili.');}
 async function copy(){
  if(!active||busy)return;
  busy=true;render('Preparazione della copia automatica…');
  // Retain the selected destination even if the user stops while a write is finishing.
  const target=directory;
  try{
   const packet=await window.lumenBackupApi.prepare();
   const text=JSON.stringify(packet),blob=new Blob([text],{type:'application/json'});
   const stamp=new Date().toISOString().replace(/[:.]/g,'-');
   const random=crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2);
   const name=(window.lumenStorage.isTest?'PROVA_':'')+'BACKUP_LUMEN_AUTO_'+stamp+'_'+(++sequence)+'_'+random+'.json';
   if(!active)return;
   if(target){
    if(await target.queryPermission({mode:'readwrite'})!=='granted')throw Error('Permesso cartella scaduto. Riattiva e scegli la cartella.');
    // UUID prevents overwrites; no existing file is removed or pruned.
    const handle=await target.getFileHandle(name,{create:true});
    const stream=await handle.createWritable();
    try{await stream.write(blob);await stream.close()}catch(e){try{await stream.abort()}catch(_){}throw e}
    const file=await handle.getFile();
    if(file.size!==blob.size||await file.text()!==text)throw Error('La rilettura del file non corrisponde: copia non verificata.');
    next=Date.now()+interval;
    render((active?'Backup automatico attivo. ':'Backup automatico disattivato. ')+'Ultima copia salvata e verificata alle '+new Date().toLocaleTimeString('it-IT')+'. '+packet.contenuto.cartelle.length+' cartelle. Cartella: '+target.name+'.');
   }else{
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    next=Date.now()+interval;
    render('Backup automatico attivo — download avviato alle '+new Date().toLocaleTimeString('it-IT')+'. Verifica il file nei Download: il salvataggio su disco non è confermato da LUMEN.');
   }
  }catch(e){
   active=false;directory=null;clearInterval(timer);timer=null;
   render('BACKUP AUTOMATICO INTERROTTO: '+(e.message||String(e))+' Le copie precedenti restano disponibili. Riattiva per riprovare.',true);
  }finally{busy=false;$('autoBackupStart').disabled=active;$('autoBackupStop').disabled=!active}
 }
 async function tick(){if(active&&!busy&&document.visibilityState==='visible'&&Date.now()>=next)await copy()}
 async function start(){
  if(active||busy)return;
  if(window.lumenBackupApi.restoring){render('Attendere la fine del ripristino prima di attivare il backup.',true);return}
  busy=true;$('autoBackupStart').disabled=true;
  try{
   // Called directly by the activation button, before any async work, for user activation.
   directory=supported?await window.showDirectoryPicker({id:window.lumenStorage.isTest?'lumen-backup-prova':'lumen-backup',mode:'readwrite'}):null;
   active=true;next=Date.now();timer=setInterval(tick,15000);
  }catch(e){if(e.name!=='AbortError')render('Attivazione non riuscita: '+(e.message||e),true);else render('Scelta della cartella annullata: backup automatico non attivo.');}
  finally{busy=false;$('autoBackupStart').disabled=active}
  if(active)await copy();
 }
 button.onclick=()=>{dialog.showModal();$('autoBackupStop').disabled=!active};
 $('autoBackupStart').onclick=start;$('autoBackupStop').onclick=stop;$('autoBackupClose').onclick=()=>dialog.close();
 document.addEventListener('visibilitychange',tick);window.addEventListener('focus',tick);
 window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue=''}});
 window.lumenAutoBackup={start,stop,tick,get active(){return active},get busy(){return busy},get next(){return next}};
})();
