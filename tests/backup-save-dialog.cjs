// Synthetic checks of the actual backup controller. Native iOS UI is not simulated.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
class Element{
 constructor(){this.style={};this.children=[];this.disabled=false;this.textContent='CREA BACKUP';this.handlers={};this.nodes={}}
 setAttribute(){} appendChild(e){this.children.push(e)} querySelector(id){return this.nodes[id]||(this.nodes[id]=new Element())}
 addEventListener(name,fn){this.handlers[name]=fn} showModal(){this.open=true} focus(){} remove(){this.removed=true}
 close(){this.open=false;this.handlers.close?.()}
}
function fixture(shareMode='ok',fail=false){
 const button=new Element(),body=new Element(),urls=new Map(),calls=[],values={'beltrami_synthetic':'kept','unrelated':'omit'};
 const c={File,Blob,Date,Promise,console,Uint8Array,atob,JSON,document:{body,createElement:()=>new Element(),getElementById:()=>button},navigator:{},setTimeout:()=>1,clearTimeout(){},URL:{createObjectURL:f=>{urls.set('blob:synthetic',f);return 'blob:synthetic'},revokeObjectURL(){}},setStatus:s=>calls.push(s),lumenStorage:{local:{length:2,key:i=>Object.keys(values)[i],getItem:k=>values[k]}},openCartelleDb(){},openOriginalDb(){},CARTELLE_STORE:'cartelle',ORIGINAL_STORE:'originali',readAllFromDb:async(_,store)=>{if(fail)throw Error('Lettura archivio fallita');return store==='cartelle'?[{id:'SYNTHETIC',history:[{data:{note:'history'}}],data:{note:'current'}}]:[{id:'original',blob:new Blob(['synthetic bytes'],{type:'text/plain'})}]},blobToBackupData:async b=>'data:text/plain;base64,'+Buffer.from(await b.arrayBuffer()).toString('base64'),collect:()=>({note:'visible synthetic'}),window:{lumenFirmaOffline:{list:async()=>[{id:'synthetic signature'}]}}};
 if(shareMode!=='none'){c.navigator.canShare=()=>true;c.navigator.share=({files})=>{calls.push('SHARE');assert.equal(files.length,1);if(shareMode==='cancel')return Promise.reject(Object.assign(new Error('cancel'),{name:'AbortError'}));if(shareMode==='error')return Promise.reject(new Error('NotAllowedError'));return Promise.resolve()}}
 vm.createContext(c);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../backup-io.js'),'utf8'),c);
 vm.runInContext(html.slice(html.indexOf('function backupStamp()'),html.indexOf('function blobToBackupData')),c);
 vm.runInContext(html.slice(html.indexOf('function openBackupSaveDialog()'),html.indexOf('async function ripristinaBackupCompleto')),c);
 return {c,button,body,calls,urls};
}
(async()=>{
 for(const mode of ['ok','cancel','error','none']){
  const f=fixture(mode),pending=f.c.creaBackupCompleto();
  assert.equal(f.body.children.length,1,'dialog opens before database reads finish');assert.equal(f.button.disabled,true);
  await f.c.creaBackupCompleto();assert.equal(f.body.children.length,1,'duplicate preparation prevented');
  await pending;assert.equal(f.button.disabled,false);assert(!f.calls.includes('SHARE'),'no async automatic share');
  const overlay=f.body.children[0],d=overlay.children[0],get=id=>d.querySelector('#lumenBackup'+id),file=f.urls.get('blob:synthetic');
  assert(file instanceof File);const packet=JSON.parse(await file.text());
  assert.equal(packet.tipo,'BELTRAMI_BACKUP_COMPLETO_V1');assert.equal(packet.contenuto.localStorage.beltrami_synthetic,'kept');assert.equal(packet.contenuto.localStorage.unrelated,undefined);
  assert.equal(packet.contenuto.cartelle[0].history[0].data.note,'history');assert.equal(packet.contenuto.originali[0].blob,'data:text/plain;base64,c3ludGhldGljIGJ5dGVz');assert.equal(packet.contenuto.firme_da_trasferire[0].id,'synthetic signature');assert.equal(packet.contenuto.cartella_visibile.note,'visible synthetic');
  assert.match(get('Title').textContent,/PRONTO DA SALVARE/);assert.equal(get('Share').hidden,mode==='none');
  if(mode!=='none'){const share=get('Share').onclick();assert(f.calls.includes('SHARE'),'share starts immediately on explicit tap');await share;assert.equal(get('Share').disabled,false);if(mode==='cancel')assert.match(get('Message').textContent,/annullato/);if(mode==='error')assert.match(get('Message').textContent,/Impossibile/)}
  get('Download').onclick();assert.match(get('Message').textContent,/non può confermarne/);assert.equal(get('Download').href,'blob:synthetic');
  d.handlers.close?.();d.handlers.cancel?.({preventDefault(){}});assert(!overlay.removed,'native close/cancel must not remove backup');
  let prevented=false;d.handlers.keydown({key:'Escape',preventDefault(){prevented=true},stopPropagation(){}});assert(prevented);assert(!overlay.removed,'Escape must retain prepared file');
  overlay.handlers.click({stopPropagation(){}});assert(!overlay.removed,'outside click must retain panel');
  get('Close').onclick();assert.equal(overlay.removed,true);
 }
 const f=fixture('ok',true);await f.c.creaBackupCompleto();assert.equal(f.urls.size,0);assert.equal(f.button.disabled,false);const d=f.body.children[0].children[0];assert.match(d.querySelector('#lumenBackupTitle').textContent,/NON CREATO/);assert.match(d.querySelector('#lumenBackupMessage').textContent,/Lettura archivio fallita/);
 console.log('PASS: inline syntax; immediate visible progress; duplicate guard; explicit share; cancellation; share error; download fallback; archive-read error; V1 backup preserves synthetic history, attachments, signatures, local settings and current form. Native iOS save sheet not tested.');
})().catch(e=>{console.error(e);process.exitCode=1});
