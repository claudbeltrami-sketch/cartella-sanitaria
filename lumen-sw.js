/* LUMEN: program files only; clinical records remain in local storage/IndexedDB. */
'use strict';
const VERSION='20261022-offline-3';
const CACHE='lumen-program-'+VERSION;
const ASSETS=["Relazione_sopralluogo.pdf","allegati-cartella.js","allegati-esterni.js","archive-referti.js","backup-io.js","backup-locale.html","backup-locale.js","backup-stream.js","cambia-lista.js","certificato-pdf.js","conteggio-automatico.js","conteggio-visite.html","conteggio-visite/index.html","esami-compatti.js","firma-offline.js","firma-recupero.js","importa-cartelle.js","importa-firma.html","importa-lista-iphone.html","importa-lista.html","importa-referti.js","index.html","liste.html","lumen-dvr.js","lumen-protocolli-auto.js","lumen-urgente.html","protocolli-demo.html","protocolli/index.html","prova-fantasma.js","prova-storage.js","recupera-firme.html","recupera-verifiche.js","ruoli-azienda.js","scadenzario.js","sopralluogo-fields.js","sopralluogo-modello.pdf","sopralluogo.html","sopralluogo.js","spirometria-percentuali.js","storico-cartaceo.js","thermal-print.js","toolbar-compact.css","toolbar-compact.js","vendor/pdf-lib.min.js","vendor/peerjs-1.5.4.min.js","vendor/qr.js","visite-archivio.js"];
const ROOT=new URL('./',self.location.href);
ASSETS.push('lumen-offline.js');
const EXTERNAL=["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js","https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js","https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js","https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js","https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js","https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js","https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(ASSETS.map(path=>new Request(new URL(path,ROOT),{cache:'reload'})));
  await cache.addAll(EXTERNAL.map(url=>new Request(url,{mode:'cors',cache:'reload'})));
  await cache.put(ROOT.href,await cache.match(new URL('index.html',ROOT)));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  await self.clients.claim();
  // Keep older program caches for rollback; never clear clinical storage.
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET')return;
 if(EXTERNAL.includes(url.href)){
  event.respondWith((async()=>{const cache=await caches.open(CACHE);return (await cache.match(url.href))||fetch(request);})());
  return;
 }
 if(url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 const relative=url.pathname.slice(ROOT.pathname.length);
 const path=relative||'index.html';
 if(!ASSETS.includes(path))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  // Scripts and styles must be available immediately, even when a disconnected
  // network hangs instead of rejecting fetch. Navigation can still check updates.
  const cached=await cache.match(new URL(path,ROOT).href);
  if(request.mode!=='navigate'&&cached)return cached;
  // Query strings used by existing build/version checks resolve to the same file offline.
  try{
   const response=await fetch(request);
   if(!response.ok)throw Error('HTTP '+response.status);
   return response;
  }catch(error){
   if(cached)return cached;
   throw error;
  }
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='LUMEN_OFFLINE_STATUS'&&event.ports[0]){
  event.waitUntil((async()=>{
   const cache=await caches.open(CACHE);
   const ready=(await Promise.all([...ASSETS.map(path=>new URL(path,ROOT).href),...EXTERNAL].map(url=>cache.match(url)))).every(Boolean);
   event.ports[0].postMessage({ready,version:VERSION});
  })());
 }
});

