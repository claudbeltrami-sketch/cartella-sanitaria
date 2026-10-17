/* Recover confirmations without replacing charts, files or existing confirmations. */
(() => {
 'use strict';
 const cf=v=>String(v||'').toUpperCase().replace(/\s/g,'');
 const date=v=>{const s=String(v||'').trim(),m=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);return m?[m[3],m[2].padStart(2,'0'),m[1].padStart(2,'0')].join('-'):s};
 function plan(packet,charts){
  if(!['LUMEN_VERIFICHE_REFERTI_V1','BELTRAMI_BACKUP_COMPLETO_V1','BELTRAMI_BACKUP_LEGGERO_V2'].includes(packet?.tipo))throw Error('Scegli un file di verifiche o un backup LUMEN.');
  const source=packet.contenuto?.originali;
  if(!Array.isArray(source))throw Error('File privo di verifiche.');
  const out=new Map();
  for(const row of source){
   if(row?.kind!=='referti_verifica_v1')continue;
   const rec=charts.find(r=>r.id===row.workerKey),d=rec?.data||{},code=cf(rec?.cf||d.codice_fiscale),visit=date(d.data_giudizio||d.data_cartella);
   if(!rec||!code||!visit||code!==cf(row.workerCf)||visit!==date(row.visit))continue;
   if(!['SÌ','NO',''].includes(row.analisi)||!['SÌ','NO',''].includes(row.drug)||(!row.analisi&&!row.drug))throw Error('Verifica non valida: nessuna modifica eseguita.');
   const id='REFERTI_VERIFICA_'+JSON.stringify([rec.id,code,visit]);
   const clean={id,kind:'referti_verifica_v1',workerKey:rec.id,workerCf:code,visit,analisi:row.analisi,drug:row.drug,verifiedAt:row.verifiedAt||'',recoveredAt:new Date().toISOString()};
   if(out.has(id)&&JSON.stringify({...out.get(id),recoveredAt:''})!==JSON.stringify({...clean,recoveredAt:''}))throw Error('Verifiche duplicate discordanti: nessuna modifica eseguita.');
   out.set(id,clean);
  }
  return [...out.values()];
 }
 function movePlan(packet,charts){
  const moves=packet.rettificheAllegati||[];
  if(!Array.isArray(moves)||moves.length>20)throw Error('Rettifiche allegati non valide.');
  const seen=new Set();
  return moves.map(m=>{
   if(!m||seen.has(m.attachmentId)||!m.sha256||!m.from||!m.to)throw Error('Rettifica incompleta o duplicata.');
   seen.add(m.attachmentId);
   for(const side of [m.from,m.to]){
    const r=charts.find(r=>r.id===side.workerKey),d=r?.data||{};
    if(!r||cf(r.cf||d.codice_fiscale)!==side.workerCf||date(r.dataNascita||d.data_nascita)!==side.workerBirth||date(d.data_giudizio||d.data_cartella)!==m.visit)throw Error('Identità o visita della rettifica non corrispondente.');
   }
   if(m.from.workerKey===m.to.workerKey)throw Error('Destinazione identica alla provenienza.');
   return m;
  });
 }
 function relocated(row,m){
  if(!row||row.kind!=='allegato_cartella_v1'||row.hash!==m.sha256||date(row.visit)!==m.visit)throw Error('Allegato assente o diverso: trasferimento annullato.');
  const matches=s=>row.workerKey===s.workerKey&&cf(row.workerCf)===s.workerCf&&date(row.workerBirth)===s.workerBirth;
  if(matches(m.to))return null;
  if(!matches(m.from))throw Error('Il collegamento attuale è diverso da quello previsto.');
  return {...row,workerKey:m.to.workerKey,workerCf:m.to.workerCf,workerBirth:m.to.workerBirth,workerLabel:m.to.workerLabel,identityCorrection:{at:new Date().toISOString(),reason:m.reason,previous:{workerKey:row.workerKey,workerCf:row.workerCf,workerBirth:row.workerBirth,workerLabel:row.workerLabel}}};
 }
 async function recover(packet){
  const charts=await window.lumenArchiveVisitsApi.list(),rows=plan(packet,charts);
  const moves=movePlan(packet,charts);
  if(!rows.length&&!moves.length)throw Error('Nessuna verifica corrisponde alle visite attualmente archiviate.');
  const db=await window.lumenAllegatiStorage.open();
  try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction(window.lumenAllegatiStorage.store,'readwrite'),st=tx.objectStore(window.lumenAllegatiStorage.store);let added=0,kept=0,moved=0,alreadyMoved=0,failure=null;
   for(const m of moves){const req=st.get(m.attachmentId);req.onsuccess=()=>{try{const result=relocated(req.result,m);if(result){st.put(result);moved++}else alreadyMoved++}catch(e){failure=e;tx.abort()}}}
   for(const row of rows){const req=st.get(row.id);req.onsuccess=()=>{if(req.result){kept++;return}st.add(row);added++}};
   tx.oncomplete=()=>resolve({added,kept,moved,alreadyMoved});tx.onabort=()=>reject(failure||tx.error||Error('Recupero annullato.'));tx.onerror=()=>{};
  })}finally{db.close()}
 }
 window.lumenRecuperaVerifiche={plan,recover,movePlan,relocated};
 const summary=document.getElementById('archiveSummary');if(!summary)return;
 const box=document.createElement('div'),button=document.createElement('button'),input=document.createElement('input'),status=document.createElement('p');
 button.type='button';button.className='secondary';button.textContent='RECUPERA VERIFICHE SALVATE';
 input.type='file';input.accept='.json,application/json';input.hidden=true;status.setAttribute('role','status');
 button.onclick=()=>input.click();
 input.onchange=async()=>{const file=input.files?.[0];if(!file)return;button.disabled=true;
  try{status.textContent='Recupero delle verifiche in corso…';const packet=await window.lumenBackupIO.read(file,()=>null);lumenStorage.checkPacket(packet);const r=await recover(packet);status.textContent='Verifiche recuperate: '+r.added+'. Già presenti e mantenute: '+r.kept+'. Collegamenti corretti: '+r.moved+'. Già corretti: '+r.alreadyMoved+'. Cartelle cliniche e contenuto dei PDF conservati.';document.getElementById('btnCercaArchivio')?.click()}
  catch(e){status.textContent='Recupero non completato: '+e.message}finally{button.disabled=false;input.value=''};
 };
 box.append(button,input,status);summary.after(box);
})();

