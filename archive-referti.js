/* Read-only indicators: actual attachments, exact worker identity and visit.
   No clinical results are inferred and no existing records are rewritten. */
(() => {
 'use strict';
 const norm=v=>String(v||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,' ').trim();
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
  let attachments;
  try{attachments=(await window.lumenAllegatiStorage.list()).filter(r=>r.kind==='allegato_cartella_v1')}
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
   return [rec.id,{analisi:analisi?'SÌ':uncertainAnalisi?'DA VERIFICARE':'NO',drug:drug?'SÌ':uncertainDrug?'DA VERIFICARE':'NO'}];
  }));
 }
 window.lumenArchiveReferti={statuses};
 const style=document.createElement('style');
 style.textContent='.archive-referto{display:inline-block;font-weight:700;padding:4px 7px;border-radius:5px;white-space:nowrap}.archive-referto[data-state="SÌ"]{background:#e2f3e6;color:#175c30}.archive-referto[data-state="NO"]{background:#eee;color:#444}.archive-referto[data-state="DA VERIFICARE"]{background:#fff0c8;color:#714c00}.archive-referti-scroll{overflow-x:auto}.archive-referti-scroll .archive-table{min-width:1000px}';
 document.head.appendChild(style);
})();
