/* LUMEN 05/11/2026: rimosso il generatore cumulativo V4 obsoleto.
   Il pulsante PREPARA INVIO CERTIFICATI e' gestito esclusivamente da
   preparaInvioCertificati() in index.html, che chiede di spuntare i lavoratori
   e non include automaticamente tutte le cartelle trovate.
   Si mantiene la correzione IndexedDB sottostante. */

/* LUMEN hotfix 19/09/2026 - prepara gli archivi IndexedDB senza forzare una versione inferiore. */
(function(){'use strict';
function ensureStore(dbName,storeName,createStore){
 return new Promise(function(resolve,reject){
  var first=lumenStorage.indexedDB.open(dbName);
  first.onerror=function(){reject(first.error)};
  first.onsuccess=function(){
   var db=first.result;
   if(db.objectStoreNames.contains(storeName)){db.close();resolve();return}
   var next=db.version+1;db.close();
   var up=lumenStorage.indexedDB.open(dbName,next);
   up.onupgradeneeded=function(){
    var d=up.result;
    if(!d.objectStoreNames.contains(storeName))createStore(d);
   };
   up.onsuccess=function(){up.result.close();resolve()};
   up.onerror=function(){reject(up.error)};
  };
  first.onupgradeneeded=function(){
   var db=first.result;
   if(!db.objectStoreNames.contains(storeName))createStore(db);
  };
 });
}
async function prepareBackupStores(){
 await ensureStore('beltrami_cartelle_db_v1','cartelle',function(db){
  var st=db.createObjectStore('cartelle',{keyPath:'id'});
  st.createIndex('cf','cf',{unique:false});st.createIndex('nomeKey','nomeKey',{unique:false});st.createIndex('updatedAt','updatedAt',{unique:false});
 });
 await ensureStore('beltrami_lumen_files_v1','originali',function(db){
  db.createObjectStore('originali',{keyPath:'id'});
 });
}
function installBackupFix(){
 var input=document.getElementById('fileRipristinaBackup');
 if(!input||input.dataset.lumenBackupFix==='1')return;
 var original=input.onchange;
 input.onchange=async function(e){
  try{await prepareBackupStores()}
  catch(err){
   var box=document.getElementById('status');if(box)box.textContent='RIPRISTINO NON AVVIATO: IMPOSSIBILE PREPARARE GLI ARCHIVI LOCALI.';
   alert('RIPRISTINO NON AVVIATO.\n\nNon è stato possibile preparare gli archivi locali: '+((err&&err.message)||String(err)));e.target.value='';return;
  }
  return original&&original.call(this,e);
 };
 input.dataset.lumenBackupFix='1';
}
installBackupFix();addEventListener('load',installBackupFix);addEventListener('pageshow',installBackupFix);setTimeout(installBackupFix,400);
})();
