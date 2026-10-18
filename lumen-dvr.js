/* Archivio DVR locale: database indipendente, nessuna scrittura nelle cartelle. */
(function(){
'use strict';
const norm=s=>String(s||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleUpperCase('it');
const key=(a,s)=>JSON.stringify([norm(a),norm(s)]);
if(typeof module!=='undefined'&&module.exports){module.exports={norm,key};return;}
function boot(){
 const company=document.getElementById('datore_lavoro'),site=document.getElementById('sede_lavoro'),job=document.getElementById('mansione');if(!company||!site)return;
 const panel=document.createElement('div');panel.className='field full no-print';panel.id='lumenDvrPanel';panel.setAttribute('data-html2canvas-ignore','true');panel.innerHTML='<strong>DVR e protocollo · consultazione locale</strong><p data-status role="status"></p><div data-list></div><button type="button" data-add>ASSOCIA DVR PDF</button><button type="button" data-protocol>ASSOCIA PROTOCOLLO PDF VALIDATO</button><button type="button" data-export>BACKUP DOCUMENTI E COLLEGAMENTI</button><button type="button" data-import>IMPORTA BACKUP DOCUMENTI</button><input type="file" accept="application/json,.json" data-backup hidden><input type="file" accept="application/pdf,.pdf" data-file hidden><p class="small">Il PDF viene conservato in questo browser, separatamente dalle cartelle. Disponibile offline su questo dispositivo. Questi documenti non sono inclusi nel backup ordinario di LUMEN: usare BACKUP DOCUMENTI E COLLEGAMENTI per trasferirli o conservarli. Non vengono modificati accertamenti, periodicità o cartelle archiviate. Riquadro escluso da stampa e PDF.</p>';
 company.closest('.field').after(panel);
 const status=panel.querySelector('[data-status]'),list=panel.querySelector('[data-list]'),input=panel.querySelector('[data-file]');let rows=[],busy=false,last='',kind='dvr',selection=null;
 const style=document.createElement('style');style.textContent='@media print{#lumenDvrPanel,#lumenDvrPanel *{display:none!important}}';document.head.appendChild(style);
 const context=()=>({company:norm(company.value),site:norm(site.value),job:norm(job?.value)});
 const contextKey=c=>JSON.stringify([c.company,c.site,c.job]);
 const dbPromise=new Promise((resolve,reject)=>{const req=(window.lumenStorage?.indexedDB||indexedDB).open('LUMEN_DVR_LOCALE_V1',1);req.onupgradeneeded=()=>{const db=req.result;db.createObjectStore('pdf',{keyPath:'id'});db.createObjectStore('links',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 async function transaction(stores,mode,fn){const db=await dbPromise;return new Promise((resolve,reject)=>{const tx=db.transaction(stores,mode);let result;try{result=fn(tx)}catch(e){tx.abort();reject(e);return}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Operazione annullata'));});}
 async function read(store,id){const db=await dbPromise;return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
 async function refresh(){const ctx=context(),token=contextKey(ctx);last=token;list.replaceChildren();status.textContent=ctx.company?'Ricerca DVR per '+ctx.company+(ctx.site?' · '+ctx.site:' · sede non indicata'):'Apri una cartella o indica il datore di lavoro.';if(!ctx.company)return;try{const link=await read('links',key(ctx.company,ctx.site));if(last!==token)return;rows=(link?.documents||[]).filter(x=>x.kind!=='protocollo'||(ctx.job&&norm(x.job)===ctx.job));status.textContent=rows.length?'Documenti associati: '+rows.length+' · '+ctx.company+' · '+(ctx.site||'sede non indicata')+' · '+(ctx.job||'mansione non indicata'):'Nessun documento associato esattamente a questa azienda, sede e mansione. Nessun protocollo generico viene applicato.';for(const item of rows){const button=document.createElement('button');button.type='button';button.textContent=(item.kind==='protocollo'?'APRI PROTOCOLLO · ':'APRI DVR · ')+item.name;button.onclick=async()=>{if(contextKey(context())!==token){refresh();return;}try{const record=await read('pdf',item.id);if(!record?.blob)throw new Error('PDF non disponibile in questo browser');const url=URL.createObjectURL(record.blob);const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click();setTimeout(()=>URL.revokeObjectURL(url),300000);}catch(e){status.textContent=e.message;}};list.append(button);}}catch(e){status.textContent='Archivio DVR non disponibile: '+e.message;}}
 function choose(type){const ctx=context();if(!ctx.company){status.textContent='Indica prima il datore di lavoro.';return;}if(type==='protocollo'&&!ctx.job){status.textContent='Indica prima la mansione.';return;}kind=type;selection=ctx;input.click();}
 panel.querySelector('[data-add]').onclick=()=>choose('dvr');panel.querySelector('[data-protocol]').onclick=()=>choose('protocollo');
 input.onchange=async()=>{const file=input.files[0];input.value='';if(!file||busy)return;const ctx=selection,type=kind;if(!ctx?.company)return;if(contextKey(ctx)!==contextKey(context())){status.textContent='Cartella cambiata: seleziona nuovamente il documento.';return;}busy=true;try{const bytes=await file.arrayBuffer();const signature=new TextDecoder().decode(bytes.slice(0,1024));if(!signature.includes('%PDF-'))throw new Error('Il file selezionato non è un PDF leggibile.');if(!confirm('Associare «'+file.name+'» a '+ctx.company+' — '+(ctx.site||'SEDE NON INDICATA')+(type==='protocollo'?' — '+ctx.job+'? Confermi di aver validato questo protocollo sul DVR aziendale?':'?')))return;const digest=await crypto.subtle.digest('SHA-256',bytes),id=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),linkId=key(ctx.company,ctx.site);await transaction(['pdf','links'],'readwrite',tx=>{tx.objectStore('pdf').put({id,blob:new Blob([bytes],{type:'application/pdf'}),name:file.name});const store=tx.objectStore('links'),req=store.get(linkId);req.onsuccess=()=>{const link=req.result||{id:linkId,...ctx,documents:[]};if(!link.documents.some(x=>x.id===id&&(x.kind||'dvr')===type&&(type!=='protocollo'||norm(x.job)===ctx.job)))link.documents.push({id,name:file.name,kind:type,job:type==='protocollo'?ctx.job:'',validated:type==='protocollo',addedAt:new Date().toISOString()});store.put(link);};});await refresh();}catch(e){status.textContent='PDF non associato: '+e.message;}finally{busy=false;}};
 company.addEventListener('input',refresh);company.addEventListener('change',refresh);site.addEventListener('input',refresh);site.addEventListener('change',refresh);job?.addEventListener('input',refresh);job?.addEventListener('change',refresh);
 setInterval(()=>{const ctx=context();if(contextKey(ctx)!==last)refresh();},800);

 const backupInput=panel.querySelector('[data-backup]');
 const getAll=async store=>{const db=await dbPromise;return new Promise((resolve,reject)=>{const r=db.transaction(store,'readonly').objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});};
 const dataUrl=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
 panel.querySelector('[data-export]').onclick=async()=>{try{
  const pdf=await getAll('pdf'),links=await getAll('links');
  const documents=await Promise.all(pdf.map(async r=>({id:r.id,name:r.name,data:await dataUrl(r.blob)})));
  const packet={tipo:'LUMEN_DVR_PROTOCOLLI_V1',lumen_prova:!!window.lumenStorage?.isTest,documents,links};
  const url=URL.createObjectURL(new Blob([JSON.stringify(packet)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='LUMEN_DVR_PROTOCOLLI_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  status.textContent='Backup documenti preparato: '+documents.length+' PDF. Completa il salvataggio del file.';
 }catch(e){status.textContent='Backup non creato: '+e.message;}};
 panel.querySelector('[data-import]').onclick=()=>backupInput.click();
 backupInput.onchange=async()=>{const f=backupInput.files[0];backupInput.value='';if(!f||busy)return;busy=true;try{
  const packet=JSON.parse(await f.text());if(packet.tipo!=='LUMEN_DVR_PROTOCOLLI_V1'||!Array.isArray(packet.documents)||!Array.isArray(packet.links))throw Error('Formato non riconosciuto');
  window.lumenStorage?.checkPacket(packet);
  const records=new Map();for(const d of packet.documents){
   if(typeof d.id!=='string'||typeof d.name!=='string'||!/^data:application\/pdf;base64,/.test(d.data))throw Error('PDF non valido');
   const raw=atob(d.data.split(',')[1]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!==d.id||!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))throw Error('PDF alterato');
   records.set(d.id,{id:d.id,name:d.name,blob:new Blob([bytes],{type:'application/pdf'})});
  }
  const ids=new Set(packet.links.map(l=>l.id));if(ids.size!==packet.links.length)throw Error('Collegamenti duplicati');
  for(const l of packet.links){if(!l.company||l.id!==key(l.company,l.site)||!Array.isArray(l.documents)||l.documents.some(d=>!records.has(d.id)||typeof d.name!=='string'||(d.kind&& !['dvr','protocollo'].includes(d.kind))||(d.kind==='protocollo'&&(!d.job||d.validated!==true))))throw Error('Collegamenti non validi');}
  await transaction(['pdf','links'],'readwrite',tx=>{
   for(const r of records.values())tx.objectStore('pdf').put(r);
   for(const l of packet.links){const st=tx.objectStore('links'),r=st.get(l.id);r.onsuccess=()=>{const old=r.result||{id:l.id,company:l.company,site:l.site,documents:[]};for(const d of l.documents)if(!old.documents.some(x=>x.id===d.id&&(x.kind||'dvr')===(d.kind||'dvr')&&norm(x.job)===norm(d.job)))old.documents.push(d);st.put(old);};}
  });await refresh();
 }catch(e){status.textContent='Backup non importato: '+e.message;}finally{busy=false;}};
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
