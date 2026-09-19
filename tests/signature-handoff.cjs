// Regression checks for record replacement and signatures. Synthetic data only.
// Run with: node tests/collatina.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
let scriptCount=0;
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1],{filename:`inline-${++scriptCount}`});
const fields=[],nodes=new Map(),store=new Map(),groups={rischi:[],protocollo:[],giudizio:[]};
function classes(value=''){const s=new Set(value.split(/\s+/));return {contains:x=>s.has(x),add:x=>s.add(x),remove:x=>s.delete(x),toggle:(x,on)=>on?s.add(x):s.delete(x)}}
function node(id,attrs={}){return {id,type:attrs.type||'text',value:'',checked:false,textContent:'',style:{},classList:classes(attrs.class),hasAttribute:k=>k in attrs,setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},scrollIntoView(){},focus(){}}}
const formHTML=html.slice(html.indexOf('<form'),html.indexOf('</form>'));
for(const m of formHTML.matchAll(/<(input|select|textarea)\b([^>]*)>/g)){
 const a={};for(const v of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))a[v[1]]=v[2]??'';
 if(a.id){const el=node(a.id,a);nodes.set(a.id,el);fields.push(el)}
}
for(const name of Object.keys(groups))groups[name]=['ONE','TWO'].map(value=>({...node(''),value,checked:false}));
function get(id){if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id)}
function queryAll(sel){
 const key=sel.includes('#rischi')?'rischi':sel.includes('#protocollo')?'protocollo':sel.includes('giudizio')?'giudizio':null;
 if(!key)return [];
 return sel.includes(':checked')?groups[key].filter(x=>x.checked):groups[key];
}
let outputUpdate=()=>{};
const c={Map,JSON,String,Number,Array,Object,Date,Math,Event:class{constructor(type){this.type=type}},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},sessionStorage:{removeItem:k=>store.delete(k),getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},
 document:{getElementById:get,querySelectorAll:queryAll,querySelector:sel=>sel==='.cartella'?get('cartella'):null,body:get('body')},
 form:{querySelectorAll:()=>fields,reset(){for(const x of fields){x.value='';x.checked=false}Object.values(groups).flat().forEach(x=>x.checked=false)}},
 today:()=> '2026-09-08',rememberMansione(){},syncCFBarcode(){},convertiAltezzaInCm(){},aggiornaInvalidita(){},
 renderWorkers(){},setStatus(v){c.lastStatus=v},showSaveInfo(){},fmt:v=>v,getCartellaRecord:async()=>null,listCartelleArchive:async()=>[],workers:[],currentWorkerIndex:-1};
c.window={dispatchEvent(){outputUpdate()},scrollTo(){}};
vm.createContext(c);
function line(name){return html.match(new RegExp('^(?:async )?function '+name+'\\([^\\n]+','m'))[0]}
for(const name of ['numeroDecimale','text','allFields','workerSignatureIdentity','workerSignatureStore','collect','splitLegacyName','normArchive','cartellaIdentity','cartellaId','syncLavoratore'])vm.runInContext(line(name),c);
vm.runInContext("const WORKER_SIGNATURE_KEY='beltrami_firme_lavoratori_v1';",c);
vm.runInContext(html.slice(html.indexOf('function aggiornaBmi(){'),html.indexOf("['altezza','peso'].forEach")),c);
if(html.includes('// A complete load'))vm.runInContext(html.slice(html.indexOf('// A complete load'),html.indexOf('\nfunction filename(')),c);else vm.runInContext(line('apply'),c);


let archive=null,writeFail=false,readBackFail=false;
c.luogoVisitaCorrente=()=>'';c.optimizeWorkerSignature=async data=>data;c.clock=()=> '10:00';
c.getCartellaRecord=async()=>archive?JSON.parse(JSON.stringify(archive)):null;
c.putCartellaRecord=async rec=>{if(writeFail)throw new Error('DISK FULL');archive=JSON.parse(JSON.stringify(rec));return rec};
vm.runInContext(line('saveToLocalArchive'),c);
vm.runInContext(html.slice(html.indexOf('// Requests are stored'),html.indexOf("window.addEventListener('load',()=>{const m=location.hash.match(/^#firma=")),c);
c.showSaveInfo=(kind,title)=>{c.saveTitle=title;c.saveKind=kind};
const A={cognome:'PROVA',nome:'FIRMA',codice_fiscale:'TEST_FIRMA',data_nascita:'1980-01-01',data_cartella:'2026-09-28',data_giudizio:'2026-09-28',firma_lavoratore_png:''};
const packet={tipo:'BELTRAMI_FIRMA_IPHONE_V1',versione:2,id:'TEST',visita:'2026-09-28',identita:'TEST_FIRMA',cognome:'PROVA',nome:'FIRMA',firma_lavoratore_png:'data:image/png;base64,VEVTVA=='};
const receive=p=>c.window.beltramiFirmaIphone.importPacket(p);
(async()=>{
 c.apply(A);await c.saveToLocalArchive();const unsigned=JSON.stringify(archive);
 const request={id:packet.id,identita:packet.identita,visita:packet.visita};
 store.set(c.signatureRequestKey(packet.id),JSON.stringify(request));
 for(const bad of [{...packet,identita:'OTHER'},{...packet,visita:'2026-09-08'},{...packet,versione:1,visita:undefined},{...packet,id:'UNKNOWN'},{...packet,firma_lavoratore_png:'bad'}]){
  await assert.rejects(receive(bad));assert.equal(JSON.stringify(archive),unsigned);assert.equal(c.collect().firma_lavoratore_png,'');
 }
 await receive(packet);assert.equal(c.saveKind,'ok');assert.equal(archive.data.firma_lavoratore_png,packet.firma_lavoratore_png);
 assert.equal(archive.history.length,1);assert.equal(archive.history[0].data.firma_lavoratore_png,'');
 c.apply(archive.data);assert.equal(c.collect().firma_lavoratore_png,packet.firma_lavoratore_png);
 // Receiving must not depend on the separate legacy signature cache.
 assert.equal(c.workerSignatureStore().TEST_FIRMA,undefined);
 // Full archive failure must never claim success or attach the received signature.
 c.apply(A);writeFail=true;c.saveTitle='';const beforeFailure=JSON.stringify(archive);
 await assert.rejects(receive(packet),/DISK FULL/);assert.equal(c.saveTitle,'');assert.equal(c.collect().firma_lavoratore_png,'');assert.equal(JSON.stringify(archive),beforeFailure);writeFail=false;
 // An image decoding delay must not save a signature on another worker or visit.
 let release;c.optimizeWorkerSignature=()=>new Promise(r=>release=r);
 const pending=receive(packet);c.apply({...A,nome:'ALTRO',codice_fiscale:'OTHER'});release(packet.firma_lavoratore_png);
 await assert.rejects(pending,/CAMBIATA/);assert.equal(JSON.stringify(archive),beforeFailure);assert.equal(c.collect().firma_lavoratore_png,'');
 c.apply(A);const pendingDate=receive(packet);get('data_giudizio').value='2026-09-29';release(packet.firma_lavoratore_png);
 await assert.rejects(pendingDate,/CAMBIATA/);assert.equal(JSON.stringify(archive),beforeFailure);
 // A worker switched while the database writes must not receive the signature.
 c.apply(A);c.optimizeWorkerSignature=async d=>d;
 const put=c.putCartellaRecord;c.putCartellaRecord=async rec=>{c.apply({...A,nome:'ALTRO',codice_fiscale:'OTHER'});return put(rec)};
 await receive(packet);assert.equal(c.collect().codice_fiscale,'OTHER');assert.equal(c.collect().firma_lavoratore_png,'');assert.equal(archive.data.codice_fiscale,'TEST_FIRMA');c.putCartellaRecord=put;
 // Incoming QR/file requests need an explicit matching visit, and do not infer today.
 assert.deepEqual(JSON.parse(JSON.stringify(c.checkSignatureRequest({versione:2,...request,cartella:A}))),request);
 assert.throws(()=>c.checkSignatureRequest({versione:1,...request,cartella:A}));
 assert.throws(()=>c.checkSignatureRequest({versione:2,...request,cartella:{...A,data_giudizio:'2026-09-29'}}));
 // The actual outgoing finish function carries the requested date into its file.
 c.apply(A);store.set('beltrami_firma_handoff',JSON.stringify(request));let outgoing;
 c.File=class{constructor(parts){this.contents=parts.join('')}};c.navigator={canShare:()=>true,share:async ({files})=>{outgoing=JSON.parse(files[0].contents)}};c.handoffName=()=> 'FIRMA_TEST.json';
 await c.window.beltramiFirmaIphone.finish(packet.firma_lavoratore_png);
 assert.equal(outgoing.visita,packet.visita);assert.equal(outgoing.id,packet.id);assert.equal(outgoing.versione,2);
 outgoing=null;get('data_giudizio').value='2026-09-29';await c.window.beltramiFirmaIphone.finish(packet.firma_lavoratore_png);assert.equal(outgoing,null);
 // Native signatures also save without requiring a separate SALVA action.
 c.apply(A);await c.window.beltramiFirmaIphone.archiveLocal(packet.firma_lavoratore_png);c.apply(archive.data);assert.equal(c.collect().firma_lavoratore_png,packet.firma_lavoratore_png);
 // An unreadable PNG cannot become a successful archived signature.
 const optimizer=c.optimizeWorkerSignature;c.Image=class{set src(v){Promise.resolve().then(()=>this.onerror())}};
 vm.runInContext(line('optimizeWorkerSignature'),c);
 await assert.rejects(c.optimizeWorkerSignature(packet.firma_lavoratore_png,true),/NON LEGGIBILE/);c.optimizeWorkerSignature=optimizer;
 // Actual QR payload construction and preparation record the date on the Mac.
 c.apply(A);c.handoffId=()=> 'QR_TEST';let qr;
 c.showFirmaQr=p=>{qr=p;return true};
 await c.window.beltramiFirmaIphone.prepare();
 assert.equal(qr.visita,A.data_giudizio);assert.equal(JSON.parse(store.get(c.signatureRequestKey('QR_TEST'))).visita,A.data_giudizio);
 const overlay={style:{},querySelector:()=>({}),remove(){}};c.document.createElement=()=>overlay;c.document.body.appendChild=()=>{};
 c.location={origin:'https://example.test',pathname:'/lumen/'};c.handoffEncode=o=>Buffer.from(JSON.stringify(o)).toString('base64');
 let qrUrl;c.QRCode=function(el,args){qrUrl=args.text};c.QRCode.CorrectLevel={M:0};c.window.QRCode=c.QRCode;
 vm.runInContext(line('showFirmaQr'),c);c.showFirmaQr(qr);
 const slim=JSON.parse(Buffer.from(qrUrl.split('#firma=')[1],'base64').toString());
 assert.equal(slim.cartella.data_giudizio,A.data_giudizio);assert.equal(slim.cartella.firma_lavoratore_png,'');assert.equal(c.checkSignatureRequest(slim).visita,A.data_giudizio);
 console.log('PASS: signature persisted with history; archive reopen; wrong worker/date, undated and unknown requests rejected; disk failure; delayed decode and worker/visit changes; outgoing visit identity.');
})().catch(e=>{console.error(e);process.exitCode=1});
