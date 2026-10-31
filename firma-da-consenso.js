/* LUMEN — Firma da consenso PDF acquisito, selezione manuale verificata.
 * L'originale nel database consensi non viene modificato. Nessuna trasmissione esterna.
 */
(function(){
'use strict';
const api=window.lumenBatchCertApi;
if(!api||!window.lumenStorage||!window.beltramiFirmaIphone)return;
const form=document.getElementById('cartellaForm');
const handoff=document.querySelector('#toolbarExtra .handoff-tools .tool-buttons');
if(!form||!handoff||document.getElementById('btnFirmaDaConsenso'))return;
const metadata=document.createElement('input');
metadata.type='hidden';metadata.id='firma_consenso_provenienza';metadata.name='firma_consenso_provenienza';
form.appendChild(metadata);
const button=document.createElement('button');
button.type='button';button.id='btnFirmaDaConsenso';button.className='signature-command';
button.textContent='FIRMA DAL CONSENSO';handoff.appendChild(button);
const css=document.createElement('style');
css.textContent='#firmaDaConsensoDialog{width:min(920px,calc(100vw - 22px));max-height:92vh;overflow:auto;border:2px solid #24669b;border-radius:12px;background:white;color:#222;padding:16px}#firmaDaConsensoDialog::backdrop{background:#0009}#firmaDaConsensoDialog h3{margin:0 0 8px}#firmaDaConsensoDialog .fdc-actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:8px 0}#firmaDaConsensoDialog .fdc-actions button{min-width:0;flex:0 1 auto}#firmaDaConsensoDialog .fdc-actions label{display:block}#firmaDaConsensoDialog select{width:100%;padding:9px;margin:7px 0}#firmaDaConsensoDialog .fdc-stage{position:relative;max-width:800px;margin:10px auto;border:1px solid #888}#firmaDaConsensoDialog canvas{display:block;width:100%;height:auto}#firmaDaConsensoDialog #fdcOverlay{position:absolute;inset:0;touch-action:none;cursor:crosshair}#firmaDaConsensoDialog #fdcPreview{max-width:100%;max-height:140px;object-fit:contain;border:1px solid #bbb;background:white}#firmaDaConsensoDialog .fdc-help{font-size:13px;line-height:1.5}#firmaDaConsensoDialog #fdcStatus{white-space:pre-line;padding:7px 0;font-weight:600}#firmaDaConsensoDialog #fdcStatus[data-error="true"]{color:#a12020}#firmaDaConsensoDialog .fdc-check{display:flex;gap:8px;align-items:flex-start;margin:12px 0}#firmaDaConsensoDialog .fdc-check input{flex:none;width:21px;height:21px;margin:0}';
document.head.appendChild(css);
const dialog=document.createElement('dialog');
dialog.id='firmaDaConsensoDialog';
dialog.setAttribute('aria-labelledby','fdcTitle');
dialog.innerHTML='<h3 id="fdcTitle">ACQUISISCI FIRMA DAL CONSENSO</h3>'+
 '<div id="fdcWorker" class="consent-current"></div>'+
 '<p class="fdc-help">Apri il consenso originale già archiviato; se non compare, puoi scegliere il PDF dal Mac. Sul documento trascina il mouse per delimitare <b>solo la firma</b>. L&#39;originale rimane intatto.</p>'+
 '<label for="fdcStored">CONSENSI ARCHIVIATI PER QUESTO LAVORATORE</label><select id="fdcStored"><option value="">SELEZIONA UN CONSENSO…</option></select>'+
 '<label for="fdcFile">OPPURE SCEGLI PDF DAL MAC</label><input id="fdcFile" type="file" accept=".pdf,application/pdf,image/png,image/jpeg,.jpg,.jpeg,.png">'+
 '<div class="fdc-actions"><button id="fdcPrev" type="button">PAGINA PRECEDENTE</button><span id="fdcPage">NESSUN DOCUMENTO</span><button id="fdcNext" type="button">PAGINA SUCCESSIVA</button></div>'+
 '<div id="fdcStage" class="fdc-stage" hidden><canvas id="fdcCanvas"></canvas><canvas id="fdcOverlay"></canvas></div>'+
 '<div id="fdcSelected" class="fdc-help"></div><p class="fdc-help">Anteprima della porzione selezionata:</p><img id="fdcPreview" alt="Anteprima della firma selezionata" hidden>'+
 '<label class="fdc-check"><input id="fdcConfirm" type="checkbox"><span>Ho verificato che la firma appartiene al lavoratore indicato e che il consenso originale si riferisce alla visita corretta. Confermo il riutilizzo della firma come immagine proveniente dal consenso, <b>non</b> come nuova firma apposta sulla cartella o sul giudizio.</span></label>'+
 '<div id="fdcStatus" role="status" aria-live="polite"></div>'+
 '<div class="fdc-actions"><button id="fdcSave" type="button" class="success" disabled>SALVA FIRMA NELLA CARTELLA</button><button id="fdcClose" type="button" class="secondary">CHIUDI</button></div>';
document.body.appendChild(dialog);
const el=id=>document.getElementById(id);
const canvas=el('fdcCanvas'),overlay=el('fdcOverlay'),stage=el('fdcStage');
const ctx=canvas.getContext('2d'),oc=overlay.getContext('2d');
let target=null,records=[],source=null,pdf=null,pages=0,pageNumber=1,selection=null,preview='',busy=false,version=0,drag=null,dragOrigin=null;
function status(msg,error){el('fdcStatus').textContent=msg||'';el('fdcStatus').dataset.error=String(!!error)}
function stamp(data){return JSON.stringify([api.workerSignatureIdentity(data),api.signatureVisit(data),data.cognome,data.nome,data.data_nascita]);}
function worker(){
 const data=api.collect();return {data:data,signature:stamp(data),key:api.workerSignatureIdentity(data),visit:api.checkedSignatureVisit(data),selection:api.selectionVersion()};
}
function assertWorker(){
 const now=worker();
 if(!target||now.signature!==target.signature||now.selection!==target.selection||now.key!==target.key||now.visit!==target.visit)throw Error('LA CARTELLA O LA VISITA SONO CAMBIATE. RIAPRI IL CONSENSO SUL LAVORATORE CORRETTO.');
 return now;
}
function fingerprint(img){return String(img||'').length+':'+String(img||'').slice(0,45)+':'+String(img||'').slice(-45);}
function updateButtons(){
 el('fdcPrev').disabled=busy||pageNumber<=1;el('fdcNext').disabled=busy||pageNumber>=pages;
 el('fdcSave').disabled=busy||!preview||!el('fdcConfirm').checked;
 el('fdcClose').disabled=busy;el('fdcFile').disabled=busy;el('fdcStored').disabled=busy;
}
function resetCrop(){
 selection=null;preview='';drag=null;dragOrigin=null;
 el('fdcPreview').removeAttribute('src');el('fdcPreview').hidden=true;el('fdcSelected').textContent='';
 overlay.width=canvas.width;overlay.height=canvas.height;drawSelection();updateButtons();
}
function drawSelection(){
 oc.clearRect(0,0,overlay.width,overlay.height);
 const r=drag||selection;if(!r)return;
 oc.fillStyle='rgba(43,127,220,.12)';oc.strokeStyle='#005eaa';oc.lineWidth=3;
 oc.fillRect(r.x,r.y,r.w,r.h);oc.strokeRect(r.x,r.y,r.w,r.h);
}
function crop(){
 if(!selection||selection.w<35||selection.h<13){resetCrop();status('SELEZIONA UN RIQUADRO CHE CONTENGA LA FIRMA.',true);return}
 if(selection.w*selection.h>canvas.width*canvas.height*.38){resetCrop();status('AREA TROPPO GRANDE: SELEZIONA SOLTANTO LA FIRMA, NON IL CONSENSO INTERO.',true);return}
 const c=document.createElement('canvas');
 c.width=Math.ceil(selection.w);c.height=Math.ceil(selection.h);
 const cx=c.getContext('2d');cx.fillStyle='white';cx.fillRect(0,0,c.width,c.height);
 cx.drawImage(canvas,selection.x,selection.y,selection.w,selection.h,0,0,c.width,c.height);
 preview=c.toDataURL('image/png');
 el('fdcPreview').src=preview;el('fdcPreview').hidden=false;
 el('fdcSelected').textContent='FONTE: '+source.name+' — PAGINA '+pageNumber+'. Controlla che nell’anteprima compaia soltanto la firma.';
 status('ANTEPRIMA PRONTA. VERIFICA LA FIRMA, POI CONFERMA.',false);
 updateButtons();
}
function point(e){
 const r=overlay.getBoundingClientRect();
 return {x:Math.max(0,Math.min(canvas.width,(e.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(e.clientY-r.top)*canvas.height/r.height))};
}
overlay.addEventListener('pointerdown',e=>{if(busy||!source)return;e.preventDefault();overlay.setPointerCapture(e.pointerId);dragOrigin=point(e);drag={x:dragOrigin.x,y:dragOrigin.y,w:0,h:0};preview='';el('fdcPreview').hidden=true;updateButtons();});
overlay.addEventListener('pointermove',e=>{if(!drag||!dragOrigin||busy)return;e.preventDefault();const p=point(e),start=dragOrigin;drag={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)};drawSelection();});
overlay.addEventListener('pointerup',e=>{if(!dragOrigin)return;e.preventDefault();const p=point(e),start=dragOrigin;selection={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)};drag=null;dragOrigin=null;drawSelection();crop();});
overlay.addEventListener('pointercancel',()=>{drag=null;dragOrigin=null;drawSelection();});
async function readConsents(key){
 return new Promise((resolve,reject)=>{
  const req=lumenStorage.indexedDB.open('beltrami_consensi_cartacei_v1',1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('consensi'))db.createObjectStore('consensi',{keyPath:'id'});};
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction('consensi','readonly');
   const st=tx.objectStore('consensi'),get=st.indexNames.contains('workerKey')?st.index('workerKey').getAll(key):st.getAll();
   get.onsuccess=()=>resolve((get.result||[]).filter(r=>r.workerKey===key&&r.blob instanceof Blob));
   get.onerror=()=>reject(get.error);tx.oncomplete=()=>db.close();tx.onabort=()=>db.close();
  };
 });
}
async function renderPage(){
 const myVersion=++version;preview='';selection=null;el('fdcConfirm').checked=false;
 stage.hidden=true;status('LETTURA DEL DOCUMENTO…');updateButtons();
 try{
  let w,h;
  if(pdf){
   const p=await pdf.getPage(pageNumber);const vp=p.getViewport({scale:1});
   const scale=Math.min(2,1400/vp.width,1900/vp.height);
   const viewport=p.getViewport({scale:scale});
   w=Math.round(viewport.width);h=Math.round(viewport.height);
   canvas.width=w;canvas.height=h;
   await p.render({canvasContext:ctx,viewport:viewport}).promise;
  }else{
   const url=URL.createObjectURL(source.blob);
   try{
    const img=new Image();
    await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error('Immagine del consenso non leggibile.'));img.src=url;});
    const scale=Math.min(1,1400/img.naturalWidth,1900/img.naturalHeight);
    w=Math.round(img.naturalWidth*scale);h=Math.round(img.naturalHeight*scale);
    canvas.width=w;canvas.height=h;ctx.drawImage(img,0,0,w,h);
   }finally{URL.revokeObjectURL(url)}
  }
  if(myVersion!==version)return;
  stage.hidden=false;resetCrop();
  el('fdcPage').textContent='PAGINA '+pageNumber+' DI '+pages;
  status('TRASCINA IL MOUSE SULLA FIRMA PER SELEZIONARLA.');
 }catch(e){if(myVersion===version)status('IMPOSSIBILE APRIRE IL DOCUMENTO: '+(e.message||e),true)}
 updateButtons();
}
async function loadSource(next){
 if(!next)return;assertWorker();source=next;pdf=null;pages=0;pageNumber=1;version++;
 resetCrop();status('APERTURA DI '+source.name+'…');el('fdcPage').textContent='LETTURA…';
 try{
  const mime=source.blob.type||'';
  if(/\.pdf$/i.test(source.name)||mime==='application/pdf'){
   if(!window.pdfjsLib)throw Error('PDF.js non disponibile. Connettiti a Internet e riapri LUMEN.');
   pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
   const doc=await pdfjsLib.getDocument({data:new Uint8Array(await source.blob.arrayBuffer())}).promise;
   pdf=doc;pages=doc.numPages;
  }else if(/^image\//i.test(mime)||/\.(png|jpe?g)$/i.test(source.name))pages=1;
  else throw Error('Formato non supportato: seleziona un PDF, PNG o JPG.');
  if(pages<1||pages>150)throw Error('Documento con numero di pagine non valido.');
  assertWorker();await renderPage();
 }catch(e){source=null;pdf=null;pages=0;stage.hidden=true;status(e.message||String(e),true)}
 updateButtons();
}
async function open(){
 try{
  target=worker();if(!target.key)throw Error('SELEZIONARE PRIMA UN LAVORATORE.');
  // PROVA usa l'archivio isolato: consentito soltanto per documenti di test.
  source=null;pdf=null;pages=0;pageNumber=1;version++;
  el('fdcFile').value='';el('fdcConfirm').checked=false;resetCrop();stage.hidden=true;
  el('fdcWorker').textContent='LAVORATORE: '+target.data.cognome+' '+target.data.nome+' — VISITA: '+target.visit+(target.data.codice_fiscale?' — CF '+target.data.codice_fiscale:'');
  el('fdcStored').innerHTML='<option value="">SELEZIONA UN CONSENSO…</option>';
  status('RICERCA DEI CONSENSI ORIGINALI…');dialog.showModal();
  records=await readConsents(target.key);assertWorker();
  records=records.filter(r=>!r.workerCf||!target.data.codice_fiscale||r.workerCf.toUpperCase()===target.data.codice_fiscale.toUpperCase());
  records.sort((a,b)=>String(b.acquiredAt||'').localeCompare(String(a.acquiredAt||'')));
  records.forEach((r,i)=>{const opt=document.createElement('option');opt.value=String(i);opt.textContent=r.fileName+' — '+new Date(r.acquiredAt).toLocaleDateString('it-IT');el('fdcStored').appendChild(opt)});
  if(records.length===1){el('fdcStored').value='0';await loadSource({kind:'archivio_consensi',id:records[0].id,name:records[0].fileName,acquiredAt:records[0].acquiredAt,blob:records[0].blob});}
  else status(records.length?'SELEZIONA IL CONSENSO DI QUESTA VISITA.':'NESSUN CONSENSO NELL’ARCHIVIO: PUOI SCEGLIERE IL PDF DAL MAC.');
 }catch(e){if(dialog.open)status(e.message||String(e),true);else alert(e.message||String(e))}
 updateButtons();
}
button.onclick=open;
el('fdcStored').onchange=async()=>{
 const i=el('fdcStored').value;
 if(i==='')return;
 const r=records[Number(i)];if(!r)return;
 el('fdcFile').value='';
 await loadSource({kind:'archivio_consensi',id:r.id,name:r.fileName,acquiredAt:r.acquiredAt,blob:r.blob});
};
el('fdcFile').onchange=async()=>{
 const f=el('fdcFile').files[0];if(!f)return;
 el('fdcStored').value='';
 await loadSource({kind:'file_locale_verificato',id:null,name:f.name,acquiredAt:null,blob:f});
};
el('fdcPrev').onclick=()=>{if(pageNumber>1){pageNumber--;renderPage()}};
el('fdcNext').onclick=()=>{if(pageNumber<pages){pageNumber++;renderPage()}};
el('fdcConfirm').onchange=updateButtons;
el('fdcSave').onclick=async()=>{
 if(busy||!preview||!source||!el('fdcConfirm').checked)return;
 const old=metadata.value;let modified=false;
 busy=true;updateButtons();
 try{
  assertWorker();
  const before=api.collect();
  if(before.firma_lavoratore_png&&!confirm('QUESTA CARTELLA HA GIÀ UNA FIRMA. SOSTITUIRLA CON QUELLA ESTRATTA DAL CONSENSO?'))return;
  const image=await api.optimizeWorkerSignature(preview,true);
  assertWorker();
  const provenance={origine:'CONSENSO_ORIGINALE',tipo:source.kind,id_consenso:source.id,nome_documento:source.name,acquisito_il:source.acquiredAt,pagina:pageNumber,area_pixel:{x:Math.round(selection.x),y:Math.round(selection.y),larghezza:Math.round(selection.w),altezza:Math.round(selection.h)},importato_il:new Date().toISOString(),visita:target.visit,identita:target.key,firma_fingerprint:fingerprint(image),nota:'Immagine ricavata da consenso; non nuova sottoscrizione della cartella.'};
  metadata.value=JSON.stringify(provenance);modified=true;
  status('SALVATAGGIO DELLA FIRMA NELLA CARTELLA…');
  await window.beltramiFirmaIphone.archiveLocal(image);
  const current=assertWorker(),saved=await api.getCartellaRecord(api.cartellaId(current.data));
  if(!saved||!saved.data||saved.data.firma_consenso_provenienza!==metadata.value||!saved.data.firma_lavoratore_png)throw Error('La verifica finale della provenienza non è riuscita. Controlla la cartella salvata.');
  modified=false;
  status('✓ FIRMA SALVATA E VERIFICATA NELLA CARTELLA DEL '+target.visit+'.\nFONTE: '+source.name+' (PAGINA '+pageNumber+'). Il consenso originale è rimasto intatto.');
  api.setStatus('FIRMA DA CONSENSO ARCHIVIATA E VERIFICATA PER '+target.data.cognome+' '+target.data.nome+'.');
 }catch(e){if(modified)metadata.value=old;status('SALVATAGGIO NON CONFERMATO: '+(e.message||e),true)}
 finally{busy=false;updateButtons();}
};
function close(){if(busy)return;version++;if(pdf&&pdf.destroy)pdf.destroy();pdf=null;source=null;records=[];preview='';stage.hidden=true;dialog.close();}
el('fdcClose').onclick=close;
dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
window.addEventListener('beltrami-signature-updated',()=>{
 const raw=metadata.value;if(!raw)return;
 try{const meta=JSON.parse(raw),data=api.collect();if(meta.firma_fingerprint&&meta.firma_fingerprint!==fingerprint(data.firma_lavoratore_png))metadata.value='';}catch(_){metadata.value=''}
});
})();
