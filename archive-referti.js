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
  let attachments,verified;
  try{const all=await window.lumenAllegatiStorage.list();attachments=all.filter(r=>r.kind==='allegato_cartella_v1');verified=new Map(all.filter(r=>r.kind==='referti_verifica_v1').map(r=>[r.id,r]));}
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
    const result=classify(row);analisi=analisi||result.analisi;drug=drug||result.drug;
    uncertainAnalisi=uncertainAnalisi||result.unknown;uncertainDrug=uncertainDrug||result.unknown;
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

 window.lumenArchiveReferti={statuses};
 const style=document.createElement('style');
 style.textContent='.archive-referto{display:inline-block;font-weight:700;padding:4px 7px;border-radius:5px;white-space:nowrap}.archive-referto[data-state="SÌ"]{background:#e2f3e6;color:#175c30}.archive-referto[data-state="NO"]{background:#eee;color:#444}.archive-referto[data-state="DA VERIFICARE"]{background:#fff0c8;color:#714c00}.archive-referti-scroll{overflow-x:auto}.archive-referti-scroll .archive-table{min-width:1000px}';
 document.head.appendChild(style);
})();
