'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const text='[x] IDONEO\nPrescrizioni: NESSUNA\nPeriodicità: ANNUALE';
let opened=0,recognized=0,closed=0,confidence=95,ocrText=text;
const window={
 document:{createElement:()=>({getContext:()=>({}),width:0,height:0})},
 lumenExternalAttachments:{getBlob:async()=>new Blob(['%PDF-test'])},
 lumenStoricoCartaceo:{hash:async()=> 'hash'},
 Tesseract:{createWorker:async()=>({recognize:async()=>{recognized++;return {data:{confidence,text:ocrText}}},terminate:async()=>{}})},
 pdfjsLib:{GlobalWorkerOptions:{},getDocument:()=>{opened++;return {promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[]}),getViewport:()=>({width:10,height:10}),render:()=>({promise:Promise.resolve()}),cleanup(){}}),destroy:async()=>{closed++}})}}}
};
vm.runInNewContext(fs.readFileSync('giudizio-pdf-auto.js','utf8'),{window,setTimeout,clearTimeout});
const api=window.lumenGiudizioPdfAuto;
(async()=>{
 const row={id:'synthetic',hash:'hash',visit:'2025-01-01'};
 const result=await api.extract(row);assert(result.ok);assert.equal(result.evidence[0].page,1);
 await api.extract(row);assert.equal(opened,1,'Unchanged source must use cached extraction');assert.equal(recognized,1);assert.equal(closed,1);
 confidence=40;assert(!(await api.extract({...row,id:'low-confidence'})).ok);
 confidence=95;ocrText='IDONEO\nIDONEO CON LIMITAZIONI\nPrescrizioni: NESSUNA\nPeriodicità: ANNUALE';
 assert(!(await api.extract({...row,id:'unmarked'})).ok);
 await assert.rejects(api.extract({...row,id:'wrong-hash',hash:'different'}),/diverso/);
 console.log('PASS local PDF pipeline: OCR path, confidence rejection, unmarked options, hash validation, cached result and document cleanup (mocked engines).');
})().catch(e=>{console.error(e);process.exitCode=1});
