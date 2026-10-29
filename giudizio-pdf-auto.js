/* Local PDF extraction. Original bytes never leave the device. */
(function(root){
'use strict';
const verdicts=['NON IDONEO TEMPORANEAMENTE','NON IDONEO PERMANENTEMENTE','IDONEO CON PRESCRIZIONI','IDONEO CON LIMITAZIONI','IDONEO'];
function parse(text){
 const lines=String(text||'').toUpperCase().replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
 const found=[];
 for(const line of lines){
  // Printed option lists are not judgments. Accept an explicit selected mark or
  // an isolated "Giudizio: ..." value, never an unmarked option in a form.
  const m=line.match(/^(?:[☒✓✔]|\[\s*[X✓]\s*\]|\(\s*X\s*\)|X\s+)\s*(.+)$/)||line.match(/^GIUDIZIO(?: DI IDONEIT[ÀA])?\s*:\s*(.+)$/);
  if(!m)continue;
  const value=m[1].replace(/[.;]$/,'').trim();
  if(verdicts.includes(value))found.push(value);
 }
 const unique=[...new Set(found)];
 if(unique.length!==1)return {ok:false,reason:'Giudizio assente, segno di selezione non leggibile o più giudizi selezionati.'};
 const start=lines.findIndex(s=>/^PRESCRIZIONI\s*(?:\/\s*LIMITAZIONI)?\s*:/.test(s)||/^LIMITAZIONI\s*:/.test(s));
 if(start<0)return {ok:false,reason:'Testo delle prescrizioni e limitazioni non identificabile con certezza.'};
 const end=lines.findIndex((s,i)=>i>start&&/^(?:PERIODICIT[ÀA]|PROSSIMA VISITA|LUOGO VISITA|DATA\b|FIRMA\b|AVVERSO)/.test(s));
 if(end<0)return {ok:false,reason:'Fine delle prescrizioni non identificabile.'};
 const notes=[lines[start].replace(/^[^:]*:/,''),...lines.slice(start+1,end)].join('\n').trim();
 const periods=lines.map(s=>s.match(/^PERIODICIT[ÀA](?: VISITA MEDICA)?\s*:\s*(ANNUALE|BIENNALE|QUINQUENNALE)\s*$/)).filter(Boolean).map(m=>m[1]);
 if(new Set(periods).size!==1)return {ok:false,reason:'Periodicità assente o ambigua.'};
 const prescrizioni=/^(NESSUNA|NESSUNO|ASSENTI|NESSUNA PRESCRIZIONE|NESSUNA LIMITAZIONE|NESSUNA PRESCRIZIONE O LIMITAZIONE|[-–—])\.?$/.test(notes)?'':notes;
 if(!notes||(/CON (PRESCRIZIONI|LIMITAZIONI)/.test(unique[0])&&!prescrizioni))return {ok:false,reason:'Prescrizioni mancanti o incoerenti.'};
 return {ok:true,giudizio:unique[0],prescrizioni,periodicita:periods[0],periodicita_altro:''};
}
function positioned(items){
 const rows=[];
 for(const item of items){
  if(!item.str?.trim())continue;
  const y=item.transform[5],x=item.transform[4];let row=rows.find(r=>Math.abs(r.y-y)<3);
  if(!row){row={y,items:[]};rows.push(row)}row.items.push({x,text:item.str});
 }
 return rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ')).join('\n');
}
function timed(p,ms){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Lettura automatica interrotta per tempo scaduto. Riprova.')),ms)})]).finally(()=>clearTimeout(timer))}
const cache=new Map();let workerPromise=null,queue=Promise.resolve();
async function worker(){
 if(!root.Tesseract?.createWorker)throw Error('Motore OCR non disponibile. Riapri LUMEN con connessione.');
 if(!workerPromise){
  let abandoned=false;
  const creating=root.Tesseract.createWorker('ita+eng',1).then(async w=>{if(abandoned){await w.terminate();throw Error('Preparazione OCR scaduta.')}return w});
  workerPromise=timed(creating,60000).catch(e=>{abandoned=true;workerPromise=null;throw e});
 }
 return workerPromise;
}
async function extract(row){
 const key=[row.id,row.hash,row.visit].join('|');
 if(cache.has(key))return cache.get(key);
 const task=queue.then(async()=>{
  let pdf;
  try{
   const blob=await root.lumenExternalAttachments.getBlob(row),bytes=await blob.arrayBuffer();
   if(await root.lumenStoricoCartaceo.hash(bytes)!==row.hash)throw Error('Il PDF è diverso dall’originale associato.');
   if(!root.pdfjsLib)throw Error('Lettore PDF non disponibile.');
   root.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
   pdf=await root.pdfjsLib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;
   if(pdf.numPages>20)throw Error('Documento oltre 20 pagine: recupero automatico da verificare separatamente.');
   const proposals=[];let evidence=[];
   for(let n=1;n<=pdf.numPages;n++){
    const page=await pdf.getPage(n),text=positioned((await page.getTextContent()).items);
    let proposal=parse(text),recognized=text;
    // A scanned page needs OCR; never infer selection from the printed options.
    if(!proposal.ok){
     const viewport=page.getViewport({scale:2}),canvas=root.document.createElement('canvas');
     canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
     try{
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      const result=await timed((await worker()).recognize(canvas),90000);
      if(result.data.confidence>=85){recognized=result.data.text;proposal=parse(recognized)}
     }finally{canvas.width=canvas.height=1}
    }
    if(proposal.ok){proposals.push(proposal);evidence.push({page:n,text:recognized})}
    page.cleanup();
   }
   if(proposals.length!==1)return {ok:false,reason:proposals.length?'Più pagine contengono un giudizio: verifica necessaria.':'Giudizio non riconosciuto con sufficiente certezza. Nessun campo copiato.'};
   return {...proposals[0],evidence};
  }finally{if(pdf)await pdf.destroy();if(workerPromise){const old=workerPromise;workerPromise=null;old.then(w=>w.terminate()).catch(()=>{})}}
 });
 queue=task.catch(()=>{});if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(key,task);
 try{return await task}catch(e){cache.delete(key);throw e}
}
const api={parse,positioned,extract};
if(typeof module==='object'&&module.exports)module.exports=api;else root.lumenGiudizioPdfAuto=api;
})(typeof window==='object'?window:globalThis);
