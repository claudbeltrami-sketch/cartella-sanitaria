// Synthetic raster PDF -> PDF.js rendering -> real Tesseract.js -> archive storage.
// NODE_PATH must include jsdom, fake-indexeddb, @napi-rs/canvas, pdf-lib and tesseract.js.
// LUMEN_OCR_ASSETS contains pdf.min.js/pdf.worker.min.js 3.11.174 and ita/eng.traineddata.
const assert=require('node:assert/strict'),path=require('node:path');
const {createCanvas,DOMMatrix,Path2D,ImageData}=require('@napi-rs/canvas');
const {PDFDocument}=require('pdf-lib'),Tesseract=require('tesseract.js');
const {app}=require('./allegati-dom.cjs');
const assets=process.env.LUMEN_OCR_ASSETS;
assert.ok(assets,'Set LUMEN_OCR_ASSETS to the local OCR/PDF test assets directory');
Object.assign(global,{DOMMatrix,Path2D,ImageData});
const pdfjs=require(path.join(assets,'pdf.min.js'));
class CanvasFactory{
 create(width,height){const canvas=createCanvas(width,height);return {canvas,context:canvas.getContext('2d')}}
 reset(pair,width,height){pair.canvas.width=width;pair.canvas.height=height}
 destroy(pair){pair.canvas.width=pair.canvas.height=1}
}
const pages=[
 ['LABORATORIO - REFERTO DI PROVA','PAZIENTE SINTETICO - NESSUN DATO REALE','RISULTATI - VALORI DI RIFERIMENTO','Emoglobina   14.5 g/dl','Glicemia       90 mg/dl','Creatinina     1.0 mg/dl','Colesterolo   180 mg/dl'],
 ['LABORATORIO - REFERTO DI PROVA','PAZIENTE SINTETICO - NESSUN DATO REALE','RISULTATI - MULTIDRUG TEST URINARIO','Cocaina          NEGATIVO','Cannabinoidi THC NEGATIVO','Oppiacei         NEGATIVO','Metadone         NEGATIVO']
];
async function fixture(){
 const pdf=await PDFDocument.create();
 for(const lines of pages){const c=createCanvas(1190,1684),ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='black';ctx.font='28px Arial';lines.forEach((line,i)=>ctx.fillText(line,70,100+i*75));const image=await pdf.embedPng(c.toBuffer('image/png'));pdf.addPage([595,842]).drawImage(image,{x:0,y:0,width:595,height:842})}
 return pdf.save();
}
(async()=>{
 const p=await app();let worker,calls=0;
 try{
  const make=p.w.document.createElement.bind(p.w.document);
  p.w.document.createElement=(tag,...args)=>tag==='canvas'?createCanvas(1,1):make(tag,...args);
  p.w.pdfjsLib={GlobalWorkerOptions:{},getDocument(options){pdfjs.GlobalWorkerOptions.workerSrc=path.join(assets,'pdf.worker.min.js');return pdfjs.getDocument({...options,canvasFactory:new CanvasFactory()})}};
  p.w.Tesseract={async createWorker(langs,oem,options){
   worker=await Tesseract.createWorker(langs,oem,{langPath:assets,gzip:false,cacheMethod:'none',logger:options.logger,errorHandler:options.errorHandler});
   return {setParameters:v=>worker.setParameters(v),terminate:()=>worker.terminate(),async recognize(image){calls++;const result=await worker.recognize(image.toBuffer('image/png'));console.log('Real OCR page',calls,'confidence',result.data.confidence);return result}};
  }};
  const data={cognome:'SINTETICO',nome:'OCR',codice_fiscale:'SNTLFA80A01H501X',data_giudizio:'2026-10-14'};
  await p.api.saveToLocalArchive(data);const rec=(await p.t.cartelle())[0],before=JSON.stringify(await p.t.cartelle());
  const blob=new Blob([await fixture()],{type:'application/pdf'}),s=p.w.lumenAllegatiStorage,db=await s.open();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction(s.store,'readwrite');tx.objectStore(s.store).put({id:'REAL_OCR_SYNTHETIC',kind:'allegato_cartella_v1',workerKey:rec.id,workerCf:data.codice_fiscale,visit:data.data_giudizio,name:'scansione-sintetica.pdf',blob});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})}finally{db.close()}
  await p.$('refertiScanAll').onclick();
  const scan=(await p.t.rows()).find(r=>r.id==='REFERTI_SCAN_REAL_OCR_SYNTHETIC');
  assert.ok(scan,p.$('refertiScanStatus').textContent);
  assert.deepEqual([scan.analisi,scan.drug],['SÌ','SÌ'],JSON.stringify(scan));assert.equal(scan.ocrPages,2);assert.equal(calls,2);
  assert.deepEqual(JSON.parse(JSON.stringify((await p.w.lumenArchiveReferti.statuses([rec])).get(rec.id))),{analisi:'SÌ',drug:'SÌ'});
  assert.equal(JSON.stringify(await p.t.cartelle()),before);
  await p.$('refertiScanAll').onclick();assert.equal(calls,2,'cached scan is reused');
  assert.deepEqual(p.errors,[]);
  console.log('PASS: real PDF.js and Tesseract.js 7 read two raster pages; both archive indicators saved; clinical records untouched; repeat scan uses cache. Browser transport is not covered by this Node test.');
 }finally{if(worker)await worker.terminate().catch(()=>{});p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
