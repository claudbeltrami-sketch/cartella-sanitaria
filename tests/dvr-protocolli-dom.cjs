const {app}=require('./allegati-dom.cjs');const assert=require('node:assert/strict');const fs=require('node:fs');
const wait=()=>new Promise(r=>setTimeout(r,100));
(async()=>{const p=await app(undefined,'?prova=fantasma');try{
const {w}=p;const panel=w.document.getElementById('lumenDvrPanel');assert.ok(panel);
const set=(id,value)=>{p.$(id).value=value;p.$(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
set('datore_lavoro','AZIENDA PROVA');set('sede_lavoro','SEDE A');set('mansione','MANSIONE A');await wait();
const clinical=JSON.stringify(p.api.collect()),cartelle=JSON.stringify(await p.t.cartelle());
const input=panel.querySelector('[data-file]');
async function add(kind,name){panel.querySelector(kind).click();Object.defineProperty(input,'files',{value:[new File(['%PDF-1.4\n'+name+'\n%%EOF'],name,{type:'application/pdf'})],configurable:true});await input.onchange();await wait();}
await add('[data-add]','dvr.pdf');await add('[data-protocol]','protocollo.pdf');assert.equal(panel.querySelectorAll('[data-list] button').length,2);
assert.equal(JSON.stringify(p.api.collect()),clinical);assert.equal(JSON.stringify(await p.t.cartelle()),cartelle);
set('mansione','MANSIONE B');await wait();assert.equal(panel.querySelectorAll('[data-list] button').length,1);
set('sede_lavoro','SEDE B');await wait();assert.equal(panel.querySelectorAll('[data-list] button').length,0);
set('sede_lavoro','SEDE A');set('mansione','MANSIONE A');await wait();
await panel.querySelector('[data-export]').onclick();assert.equal(p.downloads.length,1);const backup=JSON.parse(await p.downloads[0].blob.text());assert.equal(backup.documents.length,2);assert.equal(backup.lumen_prova,true);
const bi=panel.querySelector('[data-backup]');Object.defineProperty(bi,'files',{value:[new File([JSON.stringify(backup)],'backup.json')],configurable:true});await bi.onchange();await wait();assert.equal(panel.querySelectorAll('[data-list] button').length,2);
backup.documents[0].id='bad';Object.defineProperty(bi,'files',{value:[new File([JSON.stringify(backup)],'bad.json')],configurable:true});await bi.onchange();assert.match(panel.querySelector('[data-status]').textContent,/alterato/);assert.equal(panel.querySelectorAll('[data-list] button').length,2);
assert.equal(panel.getAttribute('data-html2canvas-ignore'),'true');assert.ok([...w.document.querySelectorAll('style')].some(s=>s.textContent.includes('@media print{#lumenDvrPanel')));assert.deepEqual(p.errors,[]);
await w.lumenStorage.reset();console.log('PASS: complete app initializes; exact company/site/job matching; clinical data unchanged; PDF backup, deduplication, corrupt import rejection; print exclusions; isolated test reset. Browser layout not verified.');
}finally{p.dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
