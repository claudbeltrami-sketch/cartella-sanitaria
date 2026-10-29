/* Local attachment presence checks: PDF text plus on-device OCR of scans.
   Only derived scan metadata is written; attachments, visits and manual confirmations are preserved. */
(() => {
 'use strict';
 const norm=v=>String(v||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,' ').trim();
 const recordsById=new Map();
 const cf=v=>norm(v).replace(/ /g,'');
 const date=v=>{const s=String(v||'').trim(),m=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);return m?[m[3],m[2].padStart(2,'0'),m[1].padStart(2,'0')].join('-'):s};
 function classify(row){
  const source=norm([row.name,row.note].join(' '));
  const drugPattern='(?:DRUG(?: TEST| CONTROL)?|ESAM[EI] TOSSICOLOGIC[OI]|ANALISI TOSSICOLOGICHE|TEST STUPEFACENTI|SCREENING STUPEFACENTI)';
  const absent=new RegExp('(?:NO|SENZA|ASSENZA DI) '+drugPattern+'|'+drugPattern+' (?:NON PRESENTE|ASSENTE|NON ESEGUITO)','g');
  const text=source.replace(absent,' ');
  const drug=new RegExp('\\b'+drugPattern+'\\b').test(text);
  const analisi=/\b(?:EMATOCHIMIC\w*|EMOCROMO|BIOCHIMIC\w*)\b/.test(text)||/\bANALISI\b/.test(text.replace(/ANALISI TOSSICOLOGICHE/g,''));
  const recognized=analisi||drug||source!==text||/\b(?:ECG|ELETTROCARDIOGRAMMA|AUDIOMETRIA|SPIROMETRIA|VISIOTEST|CONSENSO|IDONEITA|NOMINA)\b/.test(source);
  return {analisi,drug,unknown:!recognized};
 }
 async function statuses(records){
  records.forEach(r=>recordsById.set(r.id,r));
  let attachments,verified,scans;
  try{const all=await window.lumenAllegatiStorage.list();scans=new Map(all.filter(r=>r.kind==='referti_scan_v1').map(r=>[r.id,r]));attachments=all.filter(r=>r.kind==='allegato_cartella_v1');verified=new Map(all.filter(r=>r.kind==='referti_verifica_v1').map(r=>[r.id,r]));}
  catch(_){return new Map(records.map(r=>[r.id,{analisi:'DA VERIFICARE',drug:'DA VERIFICARE',error:true}]))}
  const byKey=new Map(),byCf=new Map();
  for(const r of attachments){
   if(String(r.workerKey||'').startsWith('CF_')&&cf(r.workerCf)&&cf(r.workerKey.slice(3))!==cf(r.workerCf))continue;
   if(!byKey.has(r.workerKey))byKey.set(r.workerKey,[]);byKey.get(r.workerKey).push(r);
   const code=cf(r.workerCf);if(code){if(!byCf.has(code))byCf.set(code,[]);byCf.get(code).push(r)}
  }
  return new Map(records.map(rec=>{
   const d=rec.data||{},code=cf(rec.cf||d.codice_fiscale),visit=date(d.data_giudizio||d.data_cartella);
   const rows=[...new Set([...(byKey.get(rec.id)||[]),...(code?byCf.get(code)||[]:[])])];
   let analisi=false,drug=false,uncertainAnalisi=false,uncertainDrug=false;
   for(const row of rows){
    if(code&&cf(row.workerCf)&&code!==cf(row.workerCf))continue;
    const rv=date(row.visit);if(visit&&rv&&visit!==rv)continue;
    if(!visit||!rv||(!(row.blob instanceof Blob&&row.blob.size)&&!window.lumenExternalAttachments?.valid(row.external))){uncertainAnalisi=true;uncertainDrug=true;continue}
    const scanned=scans.get(scanId(row));
    if(scanned?.version===SCAN_VERSION&&scanned.fingerprint===fingerprint(row)){
     analisi=analisi||scanned.analisi==='SÌ';drug=drug||scanned.drug==='SÌ';
     uncertainAnalisi=uncertainAnalisi||scanned.analisi==='DA VERIFICARE';uncertainDrug=uncertainDrug||scanned.drug==='DA VERIFICARE';
    }else{
     const result=classify(row);analisi=analisi||result.analisi;drug=drug||result.drug;
     uncertainAnalisi=uncertainAnalisi||!result.analisi;uncertainDrug=uncertainDrug||!result.drug;
    }
   }
   const manual=verified.get(verificationId(rec));
   if(manual&&manual.workerCf===code&&manual.visit===visit){if(manual.analisi==='SÌ'||manual.analisi==='NO'){analisi=manual.analisi==='SÌ';uncertainAnalisi=false}if(manual.drug==='SÌ'||manual.drug==='NO'){drug=manual.drug==='SÌ';uncertainDrug=false}}
   return [rec.id,{analisi:analisi?'SÌ':uncertainAnalisi?'DA VERIFICARE':'NO',drug:drug?'SÌ':uncertainDrug?'DA VERIFICARE':'NO'}];
  }));
 }
 
 function verificationId(rec){const d=rec.data||{};return 'REFERTI_VERIFICA_'+JSON.stringify([rec.id,cf(rec.cf||d.codice_fiscale),date(d.data_giudizio||d.data_cartella)])}
 async function editVerification(rec,button){
  const d=rec.data||{},visit=date(d.data_giudizio||d.data_cartella);
  if(!visit){alert('Aprire la cartella e indicare la data della visita prima di verificare i referti.');return}
  const dialog=document.createElement('dialog');
  dialog.style.cssText='max-width:520px;width:90%;padding:20px;border-radius:12px';
  const title=document.createElement('h3');title.textContent='VERIFICA REFERTI — '+[rec.cognome,rec.nome].filter(Boolean).join(' ');dialog.append(title);
  const info=document.createElement('p');info.textContent='Visita: '+visit+'. Conferma la presenza nei referti controllati. “NO” significa non presente nei documenti controllati, non esito negativo. Le spunte della cartella restano separate.';dialog.append(info);
  const previous=(await window.lumenAllegatiStorage.list()).find(r=>r.id===verificationId(rec));
  const selects={};
  for(const [key,label] of [['analisi','Analisi ematochimiche'],['drug','Drug test']]){
   const field=document.createElement('label');field.style.cssText='display:block;margin:15px 0';field.textContent=label+' ';
   const select=document.createElement('select');select.style.cssText='font-size:16px;padding:10px';
   for(const [value,text] of [['','Da verificare'],['SÌ','Presente'],['NO','Non presente nei referti']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option)}
   select.value=previous?.[key]||'';selects[key]=select;field.append(select);dialog.append(field);
  }
  const message=document.createElement('p');message.setAttribute('role','status');dialog.append(message);
  const save=document.createElement('button');save.textContent='SALVA VERIFICA';save.type='button';
  const cancel=document.createElement('button');cancel.textContent='ANNULLA';cancel.type='button';cancel.style.marginLeft='10px';
  const close=()=>{dialog.close();dialog.remove()};cancel.onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();if(!save.disabled)close()});
  save.onclick=async()=>{
   save.disabled=cancel.disabled=true;
   let db;
   try{
    db=await window.lumenAllegatiStorage.open();
    const record={id:verificationId(rec),kind:'referti_verifica_v1',workerKey:rec.id,workerCf:cf(rec.cf||d.codice_fiscale),visit,analisi:selects.analisi.value,drug:selects.drug.value,verifiedAt:new Date().toISOString()};
    await new Promise((resolve,reject)=>{const tx=db.transaction(window.lumenAllegatiStorage.store,'readwrite');tx.objectStore(window.lumenAllegatiStorage.store).put(record);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Salvataggio non riuscito'));tx.onerror=()=>{}});
    const flags=(await statuses([rec])).get(rec.id),tr=button.closest('tr');
    if(tr)for(const key of ['analisi','drug']){const badge=tr.querySelector('[data-referto="'+key+'"] .archive-referto');if(badge){badge.textContent=flags[key];badge.dataset.state=flags[key]}}
    close();
   }catch(e){message.textContent='Verifica non salvata: '+e.message;save.disabled=cancel.disabled=false}
   finally{if(db)db.close()}
  };
  dialog.append(save,cancel);document.body.append(dialog);dialog.showModal();
 }
 function addControls(){
  document.querySelectorAll('#archiveResults button[data-archive-id]').forEach(open=>{
   const rec=recordsById.get(open.dataset.archiveId),cell=open.parentElement;
   if(!rec||cell.querySelector('[data-verifica-referti]'))return;
   const button=document.createElement('button');button.type='button';button.className='secondary';button.dataset.verificaReferti='true';button.textContent='VERIFICA REFERTI';button.style.marginLeft='5px';
   button.onclick=()=>editVerification(rec,button).catch(e=>alert('Impossibile aprire la verifica: '+e.message));(cell.querySelector('.archive-action-commands')||cell).append(button);
  });
 }
 const archive=document.getElementById('archiveResults');if(archive)new MutationObserver(addControls).observe(archive,{childList:true,subtree:true});

 
 const SCAN_VERSION=3;
 const scanId=row=>'REFERTI_SCAN_'+row.id;
 const fingerprint=row=>JSON.stringify([row.hash||'',row.size||row.blob?.size||0,row.savedAt||'',row.name||'']);
 function inspectPage(page){
  const text=norm(page);
  // Require results, not an examination ordered in a protocol or a certificate.
  const labTerms=['EMOCROMO|EMOCROMOCITOMETRICO','EMOGLOBINA|HGB','EMATOCRITO|HCT','ERITROCITI|RBC','LEUCOCITI|WBC','PIASTRINE|PLT','GLICEMIA|GLUCOSIO','CREATININA|CREATININEMIA','COLESTEROLO','TRIGLICERIDI','TRANSAMINASI','AST|GOT','ALT|GPT','GAMMA GT|GGT','AZOTEMIA|UREA'];
  const excluded=/(?:NON ESEGUIT|NON EFFETTUAT|DA ESEGUIRE|RICHIEST|PRESCRITT|PREVIST|NON PRESENT)/;
  const resultValue=/\b(?:NEGATIV[OAIE]|POSITIV[OAIE]|ASSENT[EI]|PRESENT[EI]|NON RILEVAT[OAIE]|[0-9]+(?: [0-9]+)?)\b/;
  function resultNear(term){
   const re=new RegExp('\\b(?:'+term+')\\b','g');let match;
   while((match=re.exec(text))){const after=text.slice(match.index+match[0].length,match.index+match[0].length+100),before=text.slice(Math.max(0,match.index-35),match.index);if(!excluded.test(before+' '+after.slice(0,35))&&resultValue.test(after))return true}
   return false;
  }
  const labCount=labTerms.filter(term=>resultNear(term)).length;
  const substances=['CANNABINOIDI|CANNABIS|THC','COCAINA|COCAINE|BENZOILECGONINA','OPPIACEI|OPIATES|MORFINA','ANFETAMINA|ANFETAMINE|AMFETAMINA|AMFETAMINE|AMPHETAMINE','METANFETAMINA|METANFETAMINE|METAMFETAMINA|METAMFETAMINE|METHAMPHETAMINE','METADONE|METHADONE','BENZODIAZEPINE','BUPRENORFINA','BARBITURICI','MDMA|ECSTASY'];
  const drugCount=substances.filter(resultNear).length;
  const drugHeading=/\b(?:MULTI ?DRUG|DRUG TEST|DRUG SCREEN|ESAMI TOSSICOLOGICI|ANALISI TOSSICOLOGICHE|SCREENING STUPEFACENTI)\b/.test(text);
  const reportHeader=/\b(?:REFERTO|RISULTAT[OI]|ESIT[OI]|VALORI NORMALI|VALORI DI RIFERIMENTO|INTERVALL[OI] DI RIFERIMENTO)\b/.test(text);
  const orderedOnly=/\b(?:PROTOCOLLO SANITARIO|RICHIESTA ESAMI|CERTIFICATO DI IDONEITA)\b/.test(text)&&!(/\b(?:RISULTAT[OI]|VALORI NORMALI|VALORI DI RIFERIMENTO|INTERVALL[OI] DI RIFERIMENTO)\b/.test(text));
  const drug=reportHeader&&!orderedOnly&&(drugCount>=2||(drugHeading&&drugCount>=1));
  const analisi=reportHeader&&!orderedOnly&&labCount>=2;
  const readable=text.length>=60;
  const clinicalReport=(analisi||drug)&&/\b(?:REFERTO|RISULTAT[OI]|ESIT[OI]|VALORI NORMALI|VALORI DI RIFERIMENTO|INTERVALL[OI] DI RIFERIMENTO)\b/.test(text);
  return {analisi:analisi?'SÌ':readable&&clinicalReport?'NO':'DA VERIFICARE',drug:drug?'SÌ':readable&&clinicalReport?'NO':'DA VERIFICARE',readable,reason:readable?'Riconoscimento del testo del referto':'Documento senza testo completo: verifica manuale necessaria'};
 }
 function combinePages(pages){
  const state=key=>pages.some(p=>p[key]==='SÌ')?'SÌ':pages.length&&pages.every(p=>p[key]==='NO')?'NO':'DA VERIFICARE';
  const ocr=pages.filter(p=>p.ocrPages),readable=pages.length>0&&pages.every(p=>p.readable);
  const result={analisi:state('analisi'),drug:state('drug'),readable,pages:pages.length,ocrPages:ocr.length};
  const uncertain=pages.find(p=>p.analisi==='DA VERIFICARE'||p.drug==='DA VERIFICARE');
  result.reason=uncertain?.reason||(ocr.length?'Testo letto con OCR sul dispositivo':'Testo del PDF letto');
  if(ocr.length)result.ocrConfidence=Math.min(...ocr.map(p=>p.ocrConfidence));
  return result;
 }
 function inspectText(pages){return combinePages(pages.map(inspectPage))}

 let ocrWorker=null,ocrLoading=null,stopRequested=false,reportProgress=()=>{},ocrPageLabel='',workerFault=null,activeReject=null;
 function fatal(message){const e=Error(message);e.systemic=true;return e}
 function timed(promise,ms,label){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(fatal(label)),ms)})]).finally(()=>clearTimeout(timer))}
 async function loadOcr(){
  if(ocrWorker)return ocrWorker;
  if(!ocrLoading)ocrLoading=(async()=>{
   reportProgress('Preparazione OCR: scaricamento del lettore e delle lingue. I referti restano sul dispositivo.');
   if(!window.Tesseract)await timed(new Promise((resolve,reject)=>{
    const tag=document.createElement('script');tag.src='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
    tag.onload=resolve;tag.onerror=()=>{tag.remove();reject(fatal('Caricamento OCR non riuscito. Controllare la connessione e riprovare.'))};document.head.append(tag);
   }),60000,'Caricamento OCR scaduto. Controllare la connessione e riprovare.');
   let rejectWorker,abandoned=false;
   const workerFailure=new Promise((_,reject)=>{rejectWorker=reject});
   workerFault=null;
   const creating=window.Tesseract.createWorker('ita+eng',1,{
    workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
    corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',
    langPath:'https://tessdata.projectnaptha.com/4.0.0',
    logger:m=>{if(m.status==='recognizing text')reportProgress(ocrPageLabel+' — OCR '+Math.round((m.progress||0)*100)+'%')},
    errorHandler:e=>{workerFault=fatal('Motore OCR: '+String(e));rejectWorker(workerFault);if(activeReject)activeReject(workerFault)}
   }).then(async worker=>{if(abandoned){await worker.terminate();throw fatal('Preparazione OCR interrotta')}return worker});
   try{
    const worker=await timed(Promise.race([creating,workerFailure]),120000,'Preparazione OCR non riuscita entro due minuti. Riprovare con connessione attiva.');
    ocrWorker=worker;
    await timed(worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'}),15000,'Impostazione OCR non riuscita');
    return worker;
   }catch(e){abandoned=true;throw e}
  })().catch(e=>{ocrLoading=null;throw e.systemic?e:fatal('OCR non disponibile: '+e.message)});
  return ocrLoading;
 }
 async function closeOcr(){const worker=ocrWorker;ocrWorker=null;ocrLoading=null;if(worker)try{await worker.terminate()}catch(_){}}
 async function recognizeImage(image){
  if(stopRequested)throw Error('Controllo interrotto su richiesta');
  const worker=await loadOcr();
  if(stopRequested)throw Error('Controllo interrotto su richiesta');
  if(workerFault)throw workerFault;
  try{
   const failed=new Promise((_,reject)=>{activeReject=reject});
   const result=await timed(Promise.race([worker.recognize(image),failed]),120000,'Tempo OCR superato su una pagina. I risultati precedenti restano salvati.');
   return {text:result.data.text||'',confidence:Number(result.data.confidence)||0};
  }finally{activeReject=null}
 }
 async function scanPdf(row){
  if(!(row.blob instanceof Blob)&&row.external)row={...row,blob:await window.lumenExternalAttachments.getBlob(row)};
  if(!(row.blob instanceof Blob)||!row.blob.size)throw Error('File non disponibile');
  const isPdf=/\.pdf$/i.test(row.name||'')||row.blob.type==='application/pdf'||row.type==='application/pdf';
  if(!isPdf){
   if(!(/^image\//.test(row.blob.type||row.type||'')||/\.(png|jpe?g|webp|bmp)$/i.test(row.name||'')))throw Error('Formato non supportato per OCR');
   ocrPageLabel='Immagine';
   const out=await recognizeImage(row.blob);
   return combinePages([finishOcr(inspectPage(out.text),[out.confidence],1)]);
  }
  if(!window.pdfjsLib)throw fatal('Lettore PDF non disponibile: ricaricare LUMEN con connessione attiva.');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const task=window.pdfjsLib.getDocument({data:new Uint8Array(await row.blob.arrayBuffer()),isEvalSupported:false});
  try{
   const pdf=await task.promise,pages=[];
   for(let n=1;n<=pdf.numPages;n++){
    if(stopRequested)throw Error('Controllo interrotto su richiesta');
    ocrPageLabel='Pagina '+n+' di '+pdf.numPages;reportProgress(ocrPageLabel);
    let page;
    try{
     page=await pdf.getPage(n);
     const content=await page.getTextContent();let text=content.items.map(item=>(item.str||'')+(item.hasEOL?'\n':' ')).join('');
     const initial=inspectPage(text);let pageResult=initial;
     if(norm(text).length<120||(initial.analisi==='DA VERIFICARE'&&initial.drug==='DA VERIFICARE')){
      const base=page.getViewport({scale:1}),scale=Math.min(2.5,Math.sqrt(10000000/(base.width*base.height))),view=page.getViewport({scale});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
      try{
       await page.render({canvasContext:canvas.getContext('2d'),viewport:view,background:'rgb(255,255,255)'}).promise;
       const out=await recognizeImage(canvas),ocrResult=finishOcr(inspectPage(out.text),[out.confidence],1);
       // OCR contributes reliable evidence even if shorter than a noisy embedded text layer.
       pageResult=(initial.analisi==='SÌ'||initial.drug==='SÌ')?combinePages([initial,ocrResult]):ocrResult;
      }finally{canvas.width=canvas.height=1}
     }
     pages.push(pageResult);
    }catch(e){
     if(e.systemic||stopRequested)throw e;
     pages.push({analisi:'DA VERIFICARE',drug:'DA VERIFICARE',readable:false,reason:'Pagina '+n+' non letta: '+(e.message||'Errore di lettura')});
    }finally{page?.cleanup()}
   }
   return combinePages(pages);
  }finally{await task.destroy()}
 }
 function finishOcr(result,confidence,ocrPages){
  if(ocrPages){
   const min=Math.min(...confidence);
   if(min<70){result.analisi='DA VERIFICARE';result.drug='DA VERIFICARE';result.readable=false;result.reason='OCR con affidabilità insufficiente: verifica necessaria'}
   else if(min<85){
    if(result.analisi==='NO')result.analisi='DA VERIFICARE';
    if(result.drug==='NO')result.drug='DA VERIFICARE';
    result.reason='OCR parziale: le assenze richiedono conferma';
   }else result.reason=result.readable?'Testo letto con OCR':'OCR eseguito, testo incompleto';
   result.ocrConfidence=Math.round(min);result.ocrPages=ocrPages;
  }
  return result;
 }
 async function saveScan(row,result){
  const storage=window.lumenAllegatiStorage,db=await storage.open();
  try{await new Promise((resolve,reject)=>{
   const tx=db.transaction(storage.store,'readwrite'),st=tx.objectStore(storage.store),req=st.get(row.id);
   req.onsuccess=()=>{const latest=req.result;if(latest&&fingerprint(latest)===fingerprint(row))st.put({id:scanId(row),kind:'referti_scan_v1',attachmentId:row.id,fingerprint:fingerprint(row),version:SCAN_VERSION,scannedAt:new Date().toISOString(),...result})};
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Risultato non salvato'));tx.onerror=()=>{};
  })}finally{db.close()}
 }
 let scanning=false;
 async function refreshBadges(){
  const flags=await statuses([...recordsById.values()]);
  document.querySelectorAll('#archiveResults button[data-archive-id]').forEach(open=>{
   const state=flags.get(open.dataset.archiveId),tr=open.closest('tr');if(!state||!tr)return;
   for(const key of ['analisi','drug']){const badge=tr.querySelector('[data-referto="'+key+'"] .archive-referto');if(badge&&badge.textContent!==state[key]){badge.textContent=state[key];badge.dataset.state=state[key]}}
  });
 }
 
 async function diagnosticSummary(){
  const all=await window.lumenAllegatiStorage.list(),attachments=new Map(all.filter(r=>r.kind==='allegato_cartella_v1').map(r=>[r.id,r]));
  const groups=new Map();let examined=0,complete=0,partial=0,legacy=0;
  for(const result of all.filter(r=>r.kind==='referti_scan_v1')){
   const row=attachments.get(result.attachmentId);if(!row||result.fingerprint!==fingerprint(row))continue;
   if(result.version!==SCAN_VERSION){legacy++;continue}
   examined++;
   const a=result.analisi!=='DA VERIFICARE',d=result.drug!=='DA VERIFICARE';
   if(a&&d){complete++;continue}
   if(a||d)partial++;
   const reason=result.reason||'Testo letto, riconoscimento degli esami incompleto';
   groups.set(reason,(groups.get(reason)||0)+1);
  }
  return (examined?'ESITO ULTIMO CONTROLLO OCR: '+examined+' allegati; '+complete+' riconosciuti completamente; '+partial+' riconosciuti in parte.\n'+[...groups].sort((a,b)=>b[1]-a[1]).map(([reason,count])=>count+' — '+reason).join('\n'):'Nessun esito del nuovo controllo OCR salvato.')+(legacy?'\n'+legacy+' allegati controllati con la vecchia versione: premi CONTROLLA TUTTI GLI ALLEGATI per leggerli con OCR.':'');
 }

 function installScanControl(){
  const summary=document.getElementById('archiveSummary');if(!summary||document.getElementById('refertiScanAll'))return;
  const box=document.createElement('div'),button=document.createElement('button'),status=document.createElement('p');
  button.id='refertiScanAll';button.type='button';button.textContent='CONTROLLA TUTTI GLI ALLEGATI';status.id='refertiScanStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const note=document.createElement('p');note.textContent='Legge PDF e scansioni con OCR sul dispositivo, per tutte le cartelle anche fuori dal filtro. Al primo utilizzo scarica il lettore OCR; i documenti non vengono inviati. Mantiene le conferme manuali. Lascia aperta questa pagina durante il controllo.';
  const stop=document.createElement('button');stop.id='refertiScanStop';stop.type='button';stop.className='secondary';stop.textContent='INTERROMPI DOPO LA PAGINA';stop.hidden=true;stop.onclick=()=>{stopRequested=true;stop.disabled=true;stop.textContent='INTERRUZIONE IN CORSO…'};
  const diagnostic=document.createElement('p');diagnostic.id='refertiScanDiagnostic';diagnostic.style.whiteSpace='pre-wrap';diagnostic.setAttribute('role','status');
  const showDiagnostic=async()=>{try{diagnostic.textContent=await diagnosticSummary()}catch(e){diagnostic.textContent='Impossibile leggere il riepilogo: '+e.message}};
  box.append(button,stop,note,status,diagnostic);summary.after(box);showDiagnostic();
  button.onclick=async()=>{
   if(scanning)return;scanning=true;stopRequested=false;button.disabled=true;stop.hidden=false;stop.disabled=false;stop.textContent='INTERROMPI DOPO LA PAGINA';
   let done=0,uncertain=0,cached=0,failed=0;
   try{
    const all=await window.lumenAllegatiStorage.list(),rows=all.filter(r=>r.kind==='allegato_cartella_v1'),old=new Map(all.filter(r=>r.kind==='referti_scan_v1').map(r=>[r.id,r]));
    for(const row of rows){
     if(stopRequested)break;
     reportProgress=detail=>{status.textContent='Allegato '+(done+1)+' di '+rows.length+' — '+detail};
     status.textContent='Controllo allegati: '+(done+1)+' di '+rows.length+'.';
     const previous=old.get(scanId(row));let result;
     if(previous?.version===SCAN_VERSION&&previous.fingerprint===fingerprint(row)&&previous.readable){cached++;result=previous}
     else{
      try{result=await scanPdf(row)}catch(e){if(stopRequested)break;if(e.systemic)throw e;result={analisi:'DA VERIFICARE',drug:'DA VERIFICARE',readable:false,reason:e.message||'Documento non leggibile'}}
      try{await saveScan(row,result)}catch(e){failed++}
     }
     if(result.analisi==='DA VERIFICARE'||result.drug==='DA VERIFICARE')uncertain++;
     done++;
    }
    await refreshBadges();
    status.textContent=(stopRequested?'Controllo interrotto. ':'Controllo terminato. ')+'Elaborati '+done+' allegati su '+rows.length+' di tutte le cartelle; '+cached+' già letti e invariati. '+uncertain+' documenti non riconosciuti completamente: vedere le cause sotto.'+(failed?' ATTENZIONE: '+failed+' risultati non salvati.':' Risultati salvati sul dispositivo. Le conferme manuali sono state mantenute.');
   }catch(e){status.textContent='Controllo interrotto: '+e.message+'. Elaborati '+done+' allegati.'}
   finally{await closeOcr();scanning=false;button.disabled=false;stop.hidden=true;await refreshBadges().catch(()=>{});await showDiagnostic()}
  };
 }
 installScanControl();

 window.lumenArchiveReferti={statuses,inspectText};
 const style=document.createElement('style');
 style.textContent='.archive-referto{display:inline-block;font-weight:700;padding:4px 7px;border-radius:5px;white-space:nowrap}.archive-referto[data-state="SÌ"]{background:#e2f3e6;color:#175c30}.archive-referto[data-state="NO"]{background:#eee;color:#444}.archive-referto[data-state="DA VERIFICARE"]{background:#fff0c8;color:#714c00}.archive-referti-scroll{overflow-x:auto}.archive-referti-scroll .archive-table{min-width:1000px}';
 document.head.appendChild(style);
})();
