/* Offline readiness refers to local program assets, not remote OCR services. */
(function(){
'use strict';
function boot(){
 const status=document.createElement('div');status.id='lumenOfflineStatus';status.className='no-print';
 status.setAttribute('role','status');status.style.cssText='max-width:980px;margin:5px auto;font:12px Arial;color:#35536b';
 const anchor=document.getElementById('mainToolbar');if(anchor)anchor.after(status);else document.body.prepend(status);
 if(!('serviceWorker' in navigator)||!window.isSecureContext){status.textContent='Avvio offline non disponibile in questo browser.';return;}
 status.textContent='Preparazione avvio offline… lascia la connessione attiva.';
 navigator.serviceWorker.register('./lumen-sw.js',{scope:'./',updateViaCache:'none'}).then(async registration=>{
  await navigator.serviceWorker.ready;
  const worker=navigator.serviceWorker.controller||registration.active;
  if(!worker)throw Error('Attivazione in corso');
  const result=await new Promise((resolve,reject)=>{
   const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('Verifica scaduta')),15000);
   channel.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data)};
   worker.postMessage({type:'LUMEN_OFFLINE_STATUS'},[channel.port2]);
  });
  if(!result.ready)throw Error('Copia del programma incompleta');
  status.textContent='Avvio offline pronto · '+(navigator.onLine?'connessione attiva':'senza rete');
  window.addEventListener('online',()=>status.textContent='Avvio offline pronto · connessione attiva');
  window.addEventListener('offline',()=>status.textContent='Avvio offline pronto · senza rete');
 }).catch(()=>{status.textContent='Avvio offline non pronto: mantieni la connessione e ricarica la pagina.';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

