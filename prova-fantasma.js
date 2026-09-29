/* The same clinical form and signature transport, with isolated test storage. */
(() => {
 'use strict';
 const mode=window.lumenStorage,api=window.lumenBatchCertApi;
 const entry=document.getElementById('btnModalitaProva');
 entry.onclick=()=>window.open(location.pathname+'?prova=fantasma','_blank','noopener');
 if(!mode.isTest)return;
 const fromQr=location.hash.startsWith('#firma=');
 const style=document.createElement('style');style.textContent=`
 html[data-lumen-prova] [hidden],html[data-lumen-prova] #v9Panel,html[data-lumen-prova] #listPanel{display:none!important}
 #provaBanner{max-width:980px;margin:0 auto 12px;padding:16px;border:3px solid #864b00;border-radius:10px;background:#fff3cf;color:#462700;font:17px/1.4 Arial}
 #provaBanner strong{display:block;font-size:22px}#provaBanner button{margin:8px 8px 0 0;background:#864b00}#provaBanner p{margin:6px 0}
 html[data-lumen-prova] .page:before{content:'PROVA FANTASMA — DOCUMENTO DI PROVA';display:block;text-align:center;color:#864b00;font-weight:bold;border:2px solid #864b00;padding:6px;margin-bottom:8px}
 @media print{#provaBanner{display:none}}
 `;document.head.append(style);
 const banner=document.createElement('section');banner.id='provaBanner';banner.setAttribute('aria-label','Modalità prova');
 const title=document.createElement('strong');title.textContent='PROVA FANTASMA · MODALITÀ PROVA';
 const note=document.createElement('p');note.textContent='Cartella e firme di prova restano separate. Escluse da archivio di lavoro, conteggi, scadenze e Allegato 3B.';
 const hint=document.createElement('p');hint.textContent='Sul Mac premi INVIA A IPHONE. Il QR apre automaticamente la modalità prova anche sull’iPhone. Per tornare al lavoro, chiudi questa scheda e riapri quella di LUMEN.';
 const reset=document.createElement('button');reset.type='button';reset.id='btnAzzeraProva';reset.textContent='AZZERA PROVA';
 reset.onclick=async()=>{
  if(!confirm('Azzerare cartella e firme di PROVA FANTASMA su questo dispositivo? Le cartelle dei lavoratori restano invariate.'))return;
  reset.disabled=true;
  try{await mode.reset();location.replace(location.pathname+'?prova=fantasma')}catch(e){reset.disabled=false;alert(e.message)}
 };
 banner.append(title,note,hint,reset);document.body.prepend(banner);entry.hidden=true;
 // Administrative lists/imports are not part of the single fictional record.
 for(const id of ['fileApri','fileImportaCartellaPdf','btnSopralluogo','btnInviaCartellaCompletaIphone','fileRipristinaBackup','btnRipristinaDaArchivio','btnAzzera']){
  const el=document.getElementById(id);if(el){el.disabled=true;(el.closest('label')||el).hidden=true;}
 }
 for(const id of Object.keys(mode.identity))document.getElementById(id).readOnly=true;
 document.getElementById('btnSalva').textContent='SALVA PROVA';
 document.getElementById('btnArchivioCartelle').textContent='ARCHIVIO DI PROVA';
 document.getElementById('btnBackupCompleto').textContent='ESPORTA BACKUP DI PROVA';
 // Preserve the app's ordinary save and signature flow; label its messages explicitly.
 const observer=new MutationObserver(()=>{
  const el=document.getElementById('saveTitle');if(el.textContent&&!el.textContent.startsWith('PROVA · '))el.textContent='PROVA · '+el.textContent;
 });observer.observe(document.getElementById('saveTitle'),{childList:true});
 async function open(){
  if(fromQr)return;
  try{
   const record=await api.getCartellaRecord(api.cartellaId(mode.identity));
   api.apply(record?.data||{...mode.identity,lumen_prova:true,firma_lavoratore_png:''});
   api.setStatus(record?'PROVA FANTASMA RIAPERTA. DATI E FIRME DI PROVA SEPARATI.':'PROVA FANTASMA PRONTA. PUOI COMPILARE LA CARTELLA O PROVARE LA FIRMA.');
  }catch(e){api.showSaveInfo('error','PROVA NON APERTA',e.message)}
 }
 // Wait for the normal load handlers (including QR import) to finish.
 window.addEventListener('load',open,{once:true});
})();
