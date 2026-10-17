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
 async function recover(packet){
  const charts=await window.lumenArchiveVisitsApi.list(),rows=plan(packet,charts);
  if(!rows.length)throw Error('Nessuna verifica corrisponde alle visite attualmente archiviate.');
  const db=await window.lumenAllegatiStorage.open();
  try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction(window.lumenAllegatiStorage.store,'readwrite'),st=tx.objectStore(window.lumenAllegatiStorage.store);let added=0,kept=0;
   for(const row of rows){const req=st.get(row.id);req.onsuccess=()=>{if(req.result){kept++;return}st.add(row);added++}};
   tx.oncomplete=()=>resolve({added,kept});tx.onabort=()=>reject(tx.error||Error('Recupero annullato.'));tx.onerror=()=>{};
  })}finally{db.close()}
 }
 window.lumenRecuperaVerifiche={plan,recover};
 const summary=document.getElementById('archiveSummary');if(!summary)return;
 const box=document.createElement('div'),button=document.createElement('button'),input=document.createElement('input'),status=document.createElement('p');
 button.type='button';button.className='secondary';button.textContent='RECUPERA VERIFICHE SALVATE';
 input.type='file';input.accept='.json,application/json';input.hidden=true;status.setAttribute('role','status');
 button.onclick=()=>input.click();
 input.onchange=async()=>{const file=input.files?.[0];if(!file)return;button.disabled=true;
  try{status.textContent='Recupero delle verifiche in corso…';const packet=await window.lumenBackupIO.read(file,()=>null);lumenStorage.checkPacket(packet);const r=await recover(packet);status.textContent='Verifiche recuperate: '+r.added+'. Già presenti e mantenute: '+r.kept+'. Cartelle e allegati conservati.';document.getElementById('btnCercaArchivio')?.click()}
  catch(e){status.textContent='Recupero non completato: '+e.message}finally{button.disabled=false;input.value=''};
 };
 box.append(button,input,status);summary.after(box);
})();
