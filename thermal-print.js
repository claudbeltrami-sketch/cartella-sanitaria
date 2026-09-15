/* Local PDF handoff. Bluetooth communication remains with the printer's app. */
(function(){
'use strict';
const preference='lumen_print_destination_v1',api=window.lumenBatchCertApi;
if(!api)return;
const style=document.createElement('style');style.textContent=`
.thermal-choice{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:700}.thermal-choice select{max-width:100%;min-height:44px;padding:8px;background:white;color:#163f60;border:1px solid #8497a8;border-radius:6px}
#thermalDialog{box-sizing:border-box;width:min(520px,calc(100% - 24px));max-height:90vh;border:2px solid #1f5f99;border-radius:14px;padding:20px;color:#182b3c;background:#fff}#thermalDialog::backdrop{background:#0009}#thermalDialog h2{font-size:21px;margin-top:0}#thermalDialog p{line-height:1.5}#thermalDialog button,#thermalDialog a{box-sizing:border-box;display:block;width:100%;margin:10px 0;padding:12px;border-radius:8px;text-align:center;font:700 15px Arial;text-decoration:none}#thermalDialog button{border:0;background:#1f5f99;color:#fff}#thermalDialog button:disabled{opacity:.5}#thermalDialog .secondary{background:#edf2f7;color:#184567}#thermalDialog [hidden]{display:none!important}#thermalStatus{white-space:pre-wrap;overflow-wrap:anywhere}@media print{#thermalDialog,.thermal-choice{display:none!important}}`;
document.head.appendChild(style);
const label=document.createElement('label');label.className='thermal-choice';label.textContent='STAMPANTE';
const choice=document.createElement('select');choice.id='printDestination';choice.setAttribute('aria-label','Destinazione di stampa');
choice.innerHTML='<option value="standard">Standard</option><option value="thermal">Termica — PDF per app</option>';label.appendChild(choice);document.querySelector('.tool-group.visit .tool-buttons').appendChild(label);
try{if(localStorage.getItem(preference)==='thermal')choice.value='thermal'}catch(_){}
choice.addEventListener('change',()=>{try{localStorage.setItem(preference,choice.value)}catch(_){}});
const dialog=document.createElement('dialog');dialog.id='thermalDialog';dialog.setAttribute('aria-labelledby','thermalTitle');
dialog.innerHTML='<h2 id="thermalTitle">STAMPANTE TERMICA</h2><p id="thermalDocument"></p><p>Prepara il PDF A4, poi aprilo nell’app della stampantina e scegli lì la stampante Bluetooth.</p><button id="thermalPrepare" type="button">PREPARA PDF</button><p id="thermalStatus" role="status" aria-live="polite"></p><div id="thermalReady" hidden><button id="thermalShare" type="button">CONDIVIDI PDF</button><a id="thermalOpen" target="_blank" rel="noopener">APRI PDF</a><a id="thermalDownload">SALVA PDF</a><p>Se l’app non compare in Condividi, salva il PDF e aprilo dall’app della stampantina.</p></div><button id="thermalClose" class="secondary" type="button">CHIUDI</button>';
document.body.appendChild(dialog);
const el=id=>document.getElementById(id),names={cartella:'CARTELLA SANITARIA',certificato:'CERTIFICATO DI IDONEITÀ',consenso:'CONSENSO'},selectors={cartella:'#cartellaForm',certificato:'#certificate',consenso:'#consenso'};
let kind='',file=null,url='',job=0;
function reset(){job++;file=null;if(url)URL.revokeObjectURL(url);url='';el('thermalReady').hidden=true;el('thermalPrepare').disabled=false;el('thermalStatus').textContent='';}
el('thermalClose').onclick=()=>dialog.close();dialog.addEventListener('close',reset);
function show(type){
 if(type!=='consenso'&&!api.verificaPrimaDelPdf(type.toUpperCase()))return;
 if(type==='certificato'){if(!api.completaLuogoCertificato())return;api.popolaCertificato(undefined,false)}
 reset();kind=type;const d=api.collect();el('thermalDocument').textContent=names[type]+' — '+[d.cognome,d.nome].filter(Boolean).join(' ');dialog.showModal();
}
for(const [id,type] of [['btnStampa','cartella'],['btnPrintCert','certificato'],['btnPrintConsenso','consenso']])el(id).addEventListener('click',e=>{if(choice.value!=='thermal')return;e.preventDefault();e.stopImmediatePropagation();show(type)},true);
function textFields(source,copy){
 const originals=source.querySelectorAll('input,select,textarea'),copies=copy.querySelectorAll('input,select,textarea');
 originals.forEach((field,i)=>{
  const dest=copies[i];if(!dest)return;
  if(['checkbox','radio'].includes(field.type)){dest.checked=field.checked;return}
  if(['hidden','file','button','submit','reset'].includes(field.type)||field.closest('.cf-helper,.altezza-temporary'))return;
  const output=document.createElement('div');output.className='lumen-print-value'+(field.tagName==='TEXTAREA'?' lumen-print-multiline':'');
  let value=field.tagName==='SELECT'?(field.selectedOptions[0]?.textContent||''):field.value||'';
  if(field.type==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(value))value=value.split('-').reverse().join('/');
  output.textContent=value;dest.replaceWith(output);
 });
}
// Choose a blank row before a page break, so text and signatures aren't cut at a line.
function pageEnd(canvas,start,maxHeight){
 const limit=Math.min(canvas.height,start+maxHeight);if(limit===canvas.height)return limit;
 const scan=Math.min(Math.floor(maxHeight*.25),limit-start),top=limit-scan;
 const pixels=canvas.getContext('2d').getImageData(0,top,canvas.width,scan).data;
 let whiteRun=0;
 for(let y=scan-1;y>=0;y--){let blank=true;for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;if(pixels[i]<245||pixels[i+1]<245||pixels[i+2]<245){blank=false;break}}
  whiteRun=blank?whiteRun+1:0;if(whiteRun>=3)return top+y+2;
 }
 return limit;
}
async function createPdf(type,source,token){
 if(!window.html2canvas||!window.jspdf?.jsPDF)throw new Error('Modulo PDF non disponibile. Ricarica LUMEN con la connessione attiva.');
 const copy=source.cloneNode(true);textFields(source,copy);copy.querySelectorAll('script,.toolbar,.cf-helper,.altezza-temporary').forEach(n=>n.remove());copy.classList.remove('hidden');copy.style.display='block';
 const styles=[...document.querySelectorAll('style')].map(n=>n.textContent.replace(/@media\s+print\b/g,'@media all')).join('\n');
 const frame=document.createElement('iframe');frame.title='Preparazione PDF';frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-12000px;top:0;width:820px;height:1200px;border:0;pointer-events:none';document.body.appendChild(frame);
 try{
  const doc=frame.contentDocument;doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');doc.close();
  const css=doc.createElement('style');css.textContent=styles+`\nhtml,html body[class]{width:186mm!important;height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;margin:0!important;overflow:visible!important;background:#fff!important}#thermalExportRoot{display:block!important;position:static!important;width:186mm!important;height:auto!important;max-height:none!important;overflow:visible!important}#thermalExportRoot>.page{display:block!important;position:relative!important;box-sizing:border-box!important;width:186mm!important;height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;margin:0!important;overflow:visible!important;box-shadow:none!important;background:white!important}.thermal-document .lumen-print-value{display:block!important;white-space:pre-wrap;overflow-wrap:anywhere}#thermalExportRoot.certificate .page>.signature-grid:last-child{position:static!important;top:auto!important;margin-top:12px!important}.thermal-document img{max-width:100%}`;doc.head.appendChild(css);
  doc.body.className='print-'+type;copy.classList.add('thermal-document');copy.id='thermalExportRoot';doc.body.appendChild(doc.importNode(copy,true));
  await doc.fonts.ready;await Promise.all([...doc.images].filter(i=>i.getAttribute('src')).map(i=>i.decode()));
  const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});let count=0;
  for(const section of doc.querySelectorAll('.thermal-document>.page')){
   if(token!==job)throw new Error('Preparazione annullata.');
   const canvas=await window.html2canvas(section,{scale:1.5,backgroundColor:'#ffffff',logging:false,useCORS:true,windowWidth:820,windowHeight:Math.max(1200,section.scrollHeight)});
   if(!canvas.width||!canvas.height)throw new Error('Il documento non è stato renderizzato.');
   const max=Math.floor(canvas.width*277/186);
   for(let start=0;start<canvas.height;){const end=pageEnd(canvas,start,max),slice=document.createElement('canvas');slice.width=canvas.width;slice.height=end-start;slice.getContext('2d').drawImage(canvas,0,start,canvas.width,end-start,0,0,canvas.width,end-start);
    if(count++)pdf.addPage();pdf.addImage(slice.toDataURL('image/png'),'PNG',12,10,186,slice.height*186/slice.width,undefined,'FAST');start=end;slice.width=slice.height=1;
   }
   canvas.width=canvas.height=1;
  }
  if(!count)throw new Error('Nessuna pagina da stampare.');return pdf.output('blob');
 }finally{frame.remove()}
}
el('thermalPrepare').onclick=async()=>{
 const token=++job,d=api.collect(),type=kind,source=document.querySelector(selectors[type]);el('thermalPrepare').disabled=true;el('thermalReady').hidden=true;el('thermalStatus').textContent='Preparazione del PDF in corso…';
 const clean=v=>String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/gi,'_').toUpperCase();
 const filename=[clean(d.cognome)||'COGNOME',clean(d.nome)||'NOME',(d.data_giudizio||d.data_cartella||'').replace(/-/g,''),type.toUpperCase()].join('_')+'.pdf';
 try{
  const blob=await createPdf(type,source,token);if(token!==job)return;
  if(url)URL.revokeObjectURL(url);file=new File([blob],filename,{type:'application/pdf'});url=URL.createObjectURL(file);
  el('thermalOpen').href=url;el('thermalDownload').href=url;el('thermalDownload').download=filename;el('thermalReady').hidden=false;
  el('thermalShare').hidden=!(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}));
  el('thermalStatus').textContent='PDF PRONTO: '+filename+'\nAprilo per controllarlo, poi condividilo con l’app della stampantina.';
 }catch(e){if(token===job)el('thermalStatus').textContent='PDF NON CREATO: '+(e.message||e)}finally{if(token===job)el('thermalPrepare').disabled=false}
};
el('thermalShare').onclick=async()=>{
 if(!file)return;
 try{await navigator.share({files:[file],title:names[kind]});el('thermalStatus').textContent='Condivisione completata. Conferma la stampa nell’app della stampantina.'}
 catch(e){el('thermalStatus').textContent=e.name==='AbortError'?'Condivisione annullata. Il PDF è ancora disponibile.':'Condivisione non riuscita. Puoi usare SALVA PDF e aprirlo dall’app della stampantina.'}
};
})();
