/* Read-only indicators: actual attachments, exact worker identity and visit.
   No clinical results are inferred and no existing records are rewritten. */
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
    if(!visit||!rv||!(row.blob instanceof Blob)||!row.blob.size){uncertainAnalisi=true;uncertainDrug=true;continue}
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
   button.onclick=()=>editVerification(rec,button).catch(e=>alert('Impossibile aprire la verifica: '+e.message));cell.append(button);
  });
 }
 const archive=document.getElementById('archiveResults');if(archive)new MutationObserver(addControls).observe(archive,{childList:true,subtree:true});

 
 const SCAN_VERSION=1;
 const scanId=row=>'REFERTI_SCAN_'+row.id;
 const fingerprint=row=>JSON.stringify([row.hash||'',row.size||row.blob?.size||0,row.savedAt||'',row.name||'']);
 function inspectText(pages){
  const text=norm(pages.join(' '));
  // Require results, not an examination ordered in a protocol or a certificate.
  const labTerms=['EMOCROMO','EMOGLOBINA','EMATOCRITO','ERITROCITI','LEUCOCITI','PIASTRINE','GLICEMIA','GLUCOSIO','CREATININA','COLESTEROLO','TRIGLICERIDI','TRANSAMINASI','AST','ALT','GOT','GPT'];
  const excluded=/(?:NON ESEGUIT|NON EFFETTUAT|DA ESEGUIRE|RICHIEST|PRESCRITT|PREVIST|NON PRESENT)/;
  const resultValue=/\b(?:NEGATIV[OAIE]|POSITIV[OAIE]|ASSENT[EI]|PRESENT[EI]|NON RILEVAT[OAIE]|[0-9]+(?: [0-9]+)?)\b/;
  function resultNear(term){
   const re=new RegExp('\\b(?:'+term+')\\b','g');let match;
   while((match=re.exec(text))){const after=text.slice(match.index+match[0].length,match.index+match[0].length+100),before=text.slice(Math.max(0,match.index-35),match.index);if(!excluded.test(before+' '+after.slice(0,35))&&resultValue.test(after))return true}
   return false;
  }
  const labCount=labTerms.filter(term=>resultNear(term)).length;
  const substances=['CANNABINOIDI|CANNABIS|THC','COCAINA|COCAINE|BENZOILECGONINA','OPPIACEI|OPIATES|MORFINA','ANFETAMINE|AMFETAMINE|AMPHETAMINE','METANFETAMINE|METHAMPHETAMINE','METADONE|METHADONE','BENZODIAZEPINE','BUPRENORFINA','BARBITURICI','MDMA|ECSTASY'];
  const drugCount=substances.filter(resultNear).length;
  const drugHeading=/\b(?:MULTI ?DRUG|DRUG TEST|DRUG SCREEN|ESAMI TOSSICOLOGICI|ANALISI TOSSICOLOGICHE|SCREENING STUPEFACENTI)\b/.test(text);
  const reportHeader=/\b(?:REFERTO|RISULTAT[OI]|ESIT[OI]|VALORI DI RIFERIMENTO|INTERVALL[OI] DI RIFERIMENTO)\b/.test(text);
  const orderedOnly=/\b(?:PROTOCOLLO SANITARIO|RICHIESTA ESAMI|CERTIFICATO DI IDONEITA)\b/.test(text)&&!(/\b(?:RISULTAT[OI]|VALORI DI RIFERIMENTO|INTERVALL[OI] DI RIFERIMENTO)\b/.test(text));
  const drug=reportHeader&&!orderedOnly&&(drugCount>=2||(drugHeading&&drugCount>=1));
  const analisi=reportHeader&&!orderedOnly&&labCount>=2;
  const readable=pages.length>0&&pages.every(p=>norm(p).length>=60);
  const clinicalReport=(analisi||drug)&&/\b(?:REFERTO|RISULTAT[OI]|ESIT[OI]|VALORI DI RIFERIMENTO|INTERVALL[OI] DI RIFERIMENTO)\b/.test(text);
  return {analisi:analisi?'SÌ':readable&&clinicalReport?'NO':'DA VERIFICARE',drug:drug?'SÌ':readable&&clinicalReport?'NO':'DA VERIFICARE',readable,reason:readable?'Riconoscimento del testo del referto':'Documento senza testo completo: verifica manuale necessaria'};
 }
 async function scanPdf(row){
  if(!(row.blob instanceof Blob)||!row.blob.size)throw Error('File non disponibile');
  if(!(/\.pdf$/i.test(row.name||'')||row.blob.type==='application/pdf'||row.type==='application/pdf'))throw Error('Immagine o formato senza lettura automatica del testo');
  if(!window.pdfjsLib)throw Error('Lettore PDF non disponibile');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const task=window.pdfjsLib.getDocument({data:new Uint8Array(await row.blob.arrayBuffer()),isEvalSupported:false});
  let pdf;
  try{
   pdf=await task.promise;const pages=[];
   for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const content=await page.getTextContent();pages.push(content.items.map(item=>item.str||'').join(' '));page.cleanup()}
   return inspectText(pages);
  }finally{await task.destroy()}
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
  const groups=new Map();let examined=0,complete=0,partial=0;
  for(const result of all.filter(r=>r.kind==='referti_scan_v1')){
   const row=attachments.get(result.attachmentId);if(!row||result.fingerprint!==fingerprint(row))continue;
   examined++;
   const a=result.analisi!=='DA VERIFICARE',d=result.drug!=='DA VERIFICARE';
   if(a&&d){complete++;continue}
   if(a||d)partial++;
   const reason=result.readable?'Testo letto, riconoscimento degli esami incompleto':result.reason||'Causa non disponibile';
   groups.set(reason,(groups.get(reason)||0)+1);
  }
  return examined?'ESITO ULTIMO CONTROLLO: '+examined+' allegati; '+complete+' riconosciuti completamente; '+partial+' riconosciuti in parte.\n'+[...groups].sort((a,b)=>b[1]-a[1]).map(([reason,count])=>count+' — '+reason).join('\n'):'Nessun esito di lettura salvato.';
 }

 function installScanControl(){
  const summary=document.getElementById('archiveSummary');if(!summary||document.getElementById('refertiScanAll'))return;
  const box=document.createElement('div'),button=document.createElement('button'),status=document.createElement('p');
  button.id='refertiScanAll';button.type='button';button.textContent='CONTROLLA TUTTI GLI ALLEGATI';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const note=document.createElement('p');note.textContent='Legge i PDF di tutte le cartelle sul dispositivo, anche fuori dal filtro attuale. Mantiene le conferme manuali. Immagini e scansioni non leggibili restano da verificare.';
  const diagnostic=document.createElement('p');diagnostic.id='refertiScanDiagnostic';diagnostic.style.whiteSpace='pre-wrap';diagnostic.setAttribute('role','status');
  const showDiagnostic=async()=>{try{diagnostic.textContent=await diagnosticSummary()}catch(e){diagnostic.textContent='Impossibile leggere il riepilogo: '+e.message}};
  box.append(button,note,status,diagnostic);summary.after(box);showDiagnostic();
  button.onclick=async()=>{
   if(scanning)return;scanning=true;button.disabled=true;
   let done=0,uncertain=0,cached=0,failed=0;
   try{
    const all=await window.lumenAllegatiStorage.list(),rows=all.filter(r=>r.kind==='allegato_cartella_v1'),old=new Map(all.filter(r=>r.kind==='referti_scan_v1').map(r=>[r.id,r]));
    for(const row of rows){
     status.textContent='Controllo allegati: '+(done+1)+' di '+rows.length+'.';
     const previous=old.get(scanId(row));let result;
     if(previous?.version===SCAN_VERSION&&previous.fingerprint===fingerprint(row)&&previous.readable){cached++;result=previous}
     else{
      try{result=await scanPdf(row)}catch(e){result={analisi:'DA VERIFICARE',drug:'DA VERIFICARE',readable:false,reason:e.message||'Documento non leggibile'}}
      try{await saveScan(row,result)}catch(e){failed++}
     }
     if(result.analisi==='DA VERIFICARE'||result.drug==='DA VERIFICARE')uncertain++;
     done++;
    }
    await refreshBadges();
    status.textContent='Controllati '+done+' allegati di tutte le cartelle; '+cached+' già letti e invariati. '+uncertain+' documenti non riconosciuti completamente: vedere le cause sotto.'+(failed?' ATTENZIONE: '+failed+' risultati non salvati.':' Risultati salvati sul dispositivo. Le conferme manuali sono state mantenute.');
   }catch(e){status.textContent='Controllo interrotto: '+e.message+'. Elaborati '+done+' allegati.'}
   finally{scanning=false;button.disabled=false;await showDiagnostic()}
  };
 }
 installScanControl();

 window.lumenArchiveReferti={statuses,inspectText};
 const style=document.createElement('style');
 style.textContent='.archive-referto{display:inline-block;font-weight:700;padding:4px 7px;border-radius:5px;white-space:nowrap}.archive-referto[data-state="SÌ"]{background:#e2f3e6;color:#175c30}.archive-referto[data-state="NO"]{background:#eee;color:#444}.archive-referto[data-state="DA VERIFICARE"]{background:#fff0c8;color:#714c00}.archive-referti-scroll{overflow-x:auto}.archive-referti-scroll .archive-table{min-width:1000px}';
 document.head.appendChild(style);
})();
