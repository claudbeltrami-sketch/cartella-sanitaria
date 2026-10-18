const {app}=require('./allegati-dom.cjs');
const assert=require('node:assert/strict');
(async()=>{const p=await app(undefined,'?prova=fantasma');try{
 const {w}=p,role=p.$('mansione'),box=p.$('lumenProtocolloStandard');
 assert.equal(role.closest('.field').nextElementSibling,box);
 for(const [value,expected] of [['BARISTA','BARISTA'],['addetto barista','BARISTA'],['VDT','IMPIEGATO VIDEOTERMINALISTA'],['ASO','ODONTOIATRA / ASSISTENTE STUDIO ODONTOIATRICO']]){
  role.value=value;role.dispatchEvent(new w.Event('input'));
  assert.equal(box.querySelector('select').value,expected);
  assert.equal(box.querySelector('[data-standard-preview]').hidden,false);
 }
 const before=JSON.stringify(p.api.collect()),text=box.querySelector('[data-standard-risks]');
 text.value='PERSONALIZZAZIONE';text.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(JSON.stringify(p.api.collect()),before);
 role.dispatchEvent(new w.Event('change'));assert.equal(text.value,'PERSONALIZZAZIONE');
 assert.equal(box.getAttribute('data-html2canvas-ignore'),'true');
 assert.ok([...w.document.querySelectorAll('style')].some(s=>s.textContent.includes('@media print{#lumenProtocolloStandard{display:none!important}}')));
 assert.deepEqual(p.errors,[]);
 console.log('PASS: standard immediately below job; aliases BARISTA/VDT/ASO; editable preview; clinical data unchanged; print and canvas exclusions.');
}finally{p.dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
