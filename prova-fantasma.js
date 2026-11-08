/* The same clinical form and signature transport, with isolated test storage. */
(() => {
 'use strict';
 const mode=window.lumenStorage,api=window.lumenBatchCertApi;
 const entry=document.getElementById('btnModalitaProva');
 entry.onclick=()=>window.open(location.pathname+'?prova=fantasma','_blank','noopener');
 if(!mode.isTest)return;
 // Trial only: the last smoking choice replaces the other two. Electronic
 // cigarettes and alcohol stay independent; loading old records never guesses.
 const smokingIds=['fumatore','non_fumatore','ex_fumatore'];
 for(const id of smokingIds){
  const field=document.getElementById(id);
  field.addEventListener('change',event=>{
   if(!event.isTrusted||!field.checked)return;
   for(const otherId of smokingIds){
    const other=document.getElementById(otherId);
    if(other!==field&&other.checked){
     other.checked=false;
     other.dispatchEvent(new Event('change',{bubbles:true}));
    }
   }
  });
 }
 // Check the protocol only after a user enters a result, never on defaults,
 // record restoration, automatic interpretations, age or measurement units.
 const examFields=new Map();
 for(const ear of ['dx','sx'])for(const hz of [500,1000,2000,4000])
  examFields.set('audio_'+ear+'_'+hz,{exam:'AUDIOMETRIA',numeric:true});
 for(const id of ['audiometria_esito','audiometria_difetto','audiometria_interpretazione'])
  examFields.set(id,{exam:'AUDIOMETRIA'});
 for(const measurement of ['fvc','fev1','pef'])for(const suffix of ['','_percentuale'])
  examFields.set('spirometria_'+measurement+suffix,{exam:'SPIROMETRIA BASALE',numeric:true,positive:true});
 for(const id of ['visiotest_esito','visiotest_note'])
  examFields.set(id,{exam:'VISIOTEST'});
 function checkEnteredExam(event){
  if(!event.isTrusted)return;
  const field=event.target,rule=examFields.get(field.id);
  if(!rule)return;
  const value=field.value.trim();
  if(!value)return;
  if(rule.numeric){
   const number=Number(value.replace(',','.'));
   if(!Number.isFinite(number)||(rule.positive&&number<=0))return;
  }
  const checkbox=document.querySelector('#protocollo input[value="'+rule.exam+'"]');
  if(checkbox&&!checkbox.checked){
   checkbox.checked=true;
   checkbox.dispatchEvent(new Event('change',{bubbles:true}));
  }
 }
 // Never remove a protocol selection when results are cleared: an exam may
 // still be planned. Explicit checkbox edits remain available to the doctor.
 document.addEventListener('input',checkEnteredExam);
 document.addEventListener('change',checkEnteredExam);
 const fromQr=location.hash.startsWith('#firma=');
 const style=document.createElement('style');style.textContent=`
 html[data-lumen-prova] [hidden],html[data-lumen-prova] #v9Panel,html[data-lumen-prova] #listPanel{display:none!important}
 #provaBanner{max-width:980px;margin:0 auto 12px;padding:16px;border:3px solid #864b00;border-radius:10px;background:#fff3cf;color:#462700;font:17px/1.4 Arial}
 #provaBanner strong{display:block;font-size:22px}#provaBanner button{margin:8px 8px 0 0;background:#864b00}#provaBanner p{margin:6px 0}
 html[data-lumen-prova] .page:before{content:'PROVA FANTASMA — DOCUMENTO DI PROVA';display:block;text-align:center;color:#864b00;font-weight:bold;border:2px solid #864b00;padding:6px;margin-bottom:8px}
 @media print{#provaBanner{display:none}}

 /* Use the same five-page layout as the clinical record, including exam charts. */
 `;document.head.append(style);
 const banner=document.createElement('section');banner.id='provaBanner';banner.setAttribute('aria-label','Modalità prova');
 const title=document.createElement('strong');title.textContent='PROVA FANTASMA · MODALITÀ PROVA';
 const note=document.createElement('p');note.textContent='Cartella e firme di prova restano separate. Escluse da archivio di lavoro, conteggi, scadenze e Allegato 3B.';
 const hint=document.createElement('p');hint.textContent='Sul Mac premi INVIA A IPHONE. Il QR apre automaticamente la modalità prova anche sull’iPhone. Per tornare al lavoro, chiudi questa scheda e riapri quella di LUMEN.';
 const nextBtn=document.createElement('button');nextBtn.type='button';nextBtn.id='btnNuovaCartellaProva';
 nextBtn.textContent='NUOVA CARTELLA DI PROVA';
 nextBtn.onclick=async()=>{
  if(nextBtn.disabled)return;
  nextBtn.disabled=true;
  try{
   const current=api.collect();mode.checkData(current);
   const saved=await api.getCartellaRecord(api.cartellaId(current));
   if(!saved||JSON.stringify(saved.data)!==JSON.stringify(current))
    throw Error('Prima premi 1 · SALVA PROVA, e verifica il salvataggio della cartella attuale.');
   let next=0;
   for(let n=2;n<=20;n++){
    const candidate={cognome:'PROVA',nome:'FANTASMA '+n,codice_fiscale:'',data_nascita:''};
    if(!await api.getCartellaRecord(api.cartellaId(candidate))){next=n;break}
   }
   if(!next)throw Error('Limite di 20 cartelle di prova raggiunto.');
   mode.setTestIdentity(next);
   api.apply({...mode.identity,lumen_prova:true,stato_rapporto:'ATTIVO',firma_lavoratore_png:'',
    data_cartella:current.data_cartella||current.data_giudizio||'',data_giudizio:current.data_giudizio||current.data_cartella||''});
   api.setStatus('NUOVA CARTELLA DI PROVA '+next+' APERTA. PROVA PRECEDENTE CONSERVATA NELL’ARCHIVIO DI PROVA.');
   window.scrollTo({top:0,behavior:'smooth'});
  }catch(e){api.showSaveInfo('warn','NUOVA CARTELLA NON APERTA',e.message||String(e))}
  finally{nextBtn.disabled=false}
 };
 const reset=document.createElement('button');reset.type='button';reset.id='btnAzzeraProva';reset.textContent='AZZERA PROVA';
 reset.onclick=async()=>{
  if(!confirm('Azzerare cartella e firme di PROVA FANTASMA su questo dispositivo? Le cartelle dei lavoratori restano invariate.'))return;
  reset.disabled=true;
  try{await mode.reset();location.replace(location.pathname+'?prova=fantasma')}catch(e){reset.disabled=false;alert(e.message)}
 };
 // Export is deliberately kept on the clinical page: an in-app browser
 // or another iOS tab may have a different, empty IndexedDB archive.
 const exportBtn=document.createElement('button');exportBtn.type='button';exportBtn.id='btnEsportaProvaJson';
 exportBtn.textContent='2 · PREPARA JSON SENZA CAMBIARE PAGINA';
 const exportHint=document.createElement('p');exportHint.textContent='SALVA PROVA verifica solo l’archivio di questo browser. Poi prepara e salva il JSON qui, senza aprire un altro browser. Verifica il file con il controllo sottostante.';
 const exportBox=document.createElement('div');exportBox.id='provaExportBox';exportBox.hidden=true;
 const exportStatus=document.createElement('p');exportStatus.id='provaExportStatus';exportStatus.setAttribute('role','status');
 const shareBtn=document.createElement('button');shareBtn.type='button';shareBtn.id='provaCondividiJson';shareBtn.textContent='3 · SALVA SU FILE / AIRDROP';
 const download=document.createElement('a');download.id='provaScaricaJson';download.textContent='SCARICA COPIA JSON (ALTERNATIVA)';download.style.cssText='display:block;margin:8px 0;padding:10px;color:#174c77;font-weight:bold';
 const verifyLabel=document.createElement('label');verifyLabel.textContent='4 · VERIFICA IL JSON SALVATO IN FILE';
 const verifyInput=document.createElement('input');verifyInput.type='file';verifyInput.accept='.json,application/json';verifyInput.id='provaVerificaJson';
 verifyInput.style.cssText='display:block;width:100%;margin:8px 0';
 const verifyStatus=document.createElement('p');verifyStatus.id='provaVerificaEsito';verifyStatus.setAttribute('role','status');verifyStatus.textContent='FILE NON ANCORA VERIFICATO.';
 exportBox.append(exportStatus,shareBtn,download,verifyLabel,verifyInput,verifyStatus);
 banner.append(title,note,hint,exportHint,exportBtn,exportBox,nextBtn,reset);document.body.prepend(banner);entry.hidden=true;
 let prepared=null,preparedUrl=null;
 function fileBlobBase64(blob){return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(reader.error||Error('Allegato non leggibile'));reader.readAsDataURL(blob);
 })}
 async function testOriginals(){
  return new Promise((resolve,reject)=>{
   let nonexistent=false;
   const req=mode.indexedDB.open('beltrami_lumen_files_v1');
   req.onupgradeneeded=()=>{nonexistent=true;req.transaction.abort()};
   req.onerror=()=>nonexistent?resolve([]):reject(req.error||Error('Archivio allegati non leggibile'));
   req.onsuccess=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains('originali')){db.close();reject(Error('Archivio allegati incompleto'));return}
    const tx=db.transaction('originali','readonly'),all=tx.objectStore('originali').getAll();
    all.onsuccess=()=>resolve(all.result||[]);
    all.onerror=()=>reject(all.error||Error('Lettura allegati non riuscita'));
    tx.oncomplete=tx.onabort=()=>db.close();
   };
  });
 }
 exportBtn.onclick=async()=>{
  if(exportBtn.disabled)return;
  exportBtn.disabled=true;exportBox.hidden=true;prepared=null;
  if(preparedUrl){URL.revokeObjectURL(preparedUrl);preparedUrl=null}
  try{
   const current=api.collect();mode.checkData(current);
   const rec=await api.getCartellaRecord(api.cartellaId(current));
   if(!rec||!rec.data)throw Error('NON RISULTA ALCUNA CARTELLA SALVATA IN QUESTO BROWSER. Prima premi 1 · SALVA PROVA.');
   if(JSON.stringify(rec.data)!==JSON.stringify(current))
    throw Error('LA CARTELLA MOSTRATA NON COINCIDE CON QUELLA SALVATA. Premi 1 · SALVA PROVA, poi riprova.');
   const day=rec.data.data_giudizio||rec.data.data_cartella||'';
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Imposta la data della visita prima di salvare.');
   const sameDay=s=>s&&s.data&&(s.data.data_giudizio||s.data.data_cartella)===day;
   const selected=[];
   for(let n=1;n<=20;n++){
    const testIdentity={cognome:'PROVA',nome:n===1?'FANTASMA':'FANTASMA '+n,codice_fiscale:'',data_nascita:''};
    const item=await api.getCartellaRecord(api.cartellaId(testIdentity));
    if(item?.data&&sameDay(item)){
     selected.push({...item,history:(item.history||[]).filter(sameDay),
      conteggioVisits:item.conteggioVisits?.[day]?{[day]:item.conteggioVisits[day]}:{}});
    }
   }
   if(!selected.length)throw Error('Nessuna cartella di prova salvata per la data '+day+'.');
   const keys=new Set(selected.map(item=>item.id));
   const docs=(await testOriginals()).filter(x=>keys.has(x.workerKey)&&(!x.visit||x.visit===day));
   const originals=[];
   for(const row of docs){
    if(!(row.blob instanceof Blob))throw Error('Allegato non incorporato: '+(row.name||row.id||'sconosciuto')+'. JSON non preparato.');
    const {blob,...other}=row;originals.push({...other,blob:await fileBlobBase64(blob)});
   }
   const packet={tipo:'LUMEN_EMERGENZA_SESSIONE_V1',versione:1,data:day,creato:new Date().toISOString(),
    lumen_prova:true,cartelle:selected,originali:originals,sessione:null};
   const filename='LUMEN_EMERGENZA_'+day+'_PROVA'+(selected.length>1?'_'+selected.length+'_CARTELLE':'')+'.json';
   const file=new File([JSON.stringify(packet)],filename,{type:'application/json'});
   prepared={file,packet};preparedUrl=URL.createObjectURL(file);
   download.href=preparedUrl;download.download=filename;
   shareBtn.hidden=!(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}));
   exportStatus.textContent='JSON PREPARATO, MA NON ANCORA SALVATO. Data: '+day+
    '. Cartelle: '+selected.length+'. Allegati: '+originals.length+'. Dimensione: '+file.size+' byte. Scegli SALVA SU FILE oppure SCARICA.';
   verifyStatus.textContent='FILE NON ANCORA VERIFICATO.';verifyInput.value='';exportBox.hidden=false;
  }catch(e){api.showSaveInfo('error','ESPORTAZIONE NON ESEGUITA',e.message||String(e));api.setStatus('NESSUN FILE JSON CREATO: '+(e.message||String(e)))}
  finally{exportBtn.disabled=false}
 };
 shareBtn.onclick=async()=>{
  if(!prepared)return;
  try{await navigator.share({files:[prepared.file],title:'LUMEN PROVA FANTASMA'});
   verifyStatus.textContent='Condivisione terminata, ma salvataggio NON CONFERMATO. Seleziona il file con 4 · VERIFICA.';}
  catch(e){verifyStatus.textContent='Condivisione NON confermata: '+(e.message||String(e))+' — puoi usare SCARICA COPIA JSON.'}
 };
 verifyInput.onchange=async()=>{
  const file=verifyInput.files?.[0];
  if(!file||!prepared)return;
  try{
   if(file.name!==prepared.file.name||file.size!==prepared.file.size||await file.text()!==await prepared.file.text())
    throw Error('Il file selezionato non coincide con quello preparato.');
   const parsed=JSON.parse(await file.text());
   if(parsed.tipo!=='LUMEN_EMERGENZA_SESSIONE_V1'||!parsed.lumen_prova||!parsed.cartelle?.length)
    throw Error('Contenuto JSON non valido.');
   verifyStatus.textContent='✓ JSON VERIFICATO IN FILE: '+file.name+' ('+file.size+' byte). Pronto per il trasferimento.';
  }catch(e){verifyStatus.textContent='FILE NON VERIFICATO: '+(e.message||String(e))}
  finally{verifyInput.value=''}
 };
 // Administrative lists/imports are not part of the single fictional record.
 for(const id of ['fileApri','fileImportaCartellaPdf','btnSopralluogo','btnInviaCartellaCompletaIphone','fileRipristinaBackup','btnRipristinaDaArchivio','btnAzzera']){
  const el=document.getElementById(id);if(el){el.disabled=true;(el.closest('label')||el).hidden=true;}
 }
 for(const id of Object.keys(mode.identity))document.getElementById(id).readOnly=true;
 const saveBtn=document.getElementById('btnSalva');saveBtn.textContent='1 · SALVA PROVA';
 // On iOS a delayed synthetic download is not a verified file save. Save and
 // re-read the isolated IndexedDB record; offer export as a fresh user gesture.
 // This overrides only test mode, never the production save handler.
 saveBtn.onclick=async()=>{
  if(saveBtn.disabled)return;
  saveBtn.disabled=true;
  try{
   const snapshot=api.collect();mode.checkData(snapshot);
   const x=await api.saveToLocalArchive(snapshot);
   const readBack=await api.getCartellaRecord(x.rec.id);
   if(!readBack||JSON.stringify(readBack.data)!==JSON.stringify(snapshot))
    throw Error('La rilettura dei dati non coincide con la cartella compilata.');
   api.showSaveInfo('ok','✓ PROVA SALVATA NELL’ARCHIVIO LOCALE',
    'PROVA FANTASMA memorizzata e riletta su questo dispositivo.\\nNON È ANCORA UN FILE JSON.\\nPremi 2 · PREPARA JSON, poi Salva su File. Controlla il file prima di chiudere.',[
      {label:'2 · PREPARA JSON',className:'success',onclick:()=>exportBtn.click()}
    ]);
   api.setStatus('PROVA SALVATA E RILETTA NEL BROWSER. PER OTTENERE IL FILE: 2 · PREPARA JSON.');
  }catch(e){
   api.showSaveInfo('error','PROVA NON SALVATA O NON VERIFICATA',e.message||String(e));
   api.setStatus('SALVATAGGIO PROVA NON CONFERMATO.');
  }finally{saveBtn.disabled=false}
 };
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
   api.apply(record?.data||{...mode.identity,lumen_prova:true,stato_rapporto:'ATTIVO',firma_lavoratore_png:''});
   api.setStatus(record?'CARTELLA '+mode.identity.nome+' RIAPERTA. DATI E FIRME DI PROVA SEPARATI.':'CARTELLA '+mode.identity.nome+' PRONTA. PUOI COMPILARLA O PROVARE LA FIRMA.');
  }catch(e){api.showSaveInfo('error','PROVA NON APERTA',e.message)}
 }
 // Wait for the normal load handlers (including QR import) to finish.
 window.addEventListener('load',open,{once:true});
})();
