// Regression checks for explicit legacy signature recovery. Synthetic data only.
// Run with: node tests/signature-recovery.cjs
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
// Exercise the real recovery controller and UI callbacks with synthetic records.
const dialogs=[];
function element(tag){
 const e={tag,children:[],style:{},listeners:{},disabled:false,value:'',checked:false,append(...items){this.children.push(...items)},appendChild(x){this.children.push(x)},setAttribute(k,v){this[k]=v},showModal(){dialogs.push(this)},close(){this.closed=true},remove(){this.removed=true},focus(){},select(){},addEventListener(k,fn){this.listeners[k]=fn}};
 Object.defineProperty(e,'src',{set(v){e._src=v;if(tag==='img'){e.naturalWidth=1;queueMicrotask(()=>e.onload&&e.onload())}},get(){return e._src}});return e;
}
c.document.createElement=element;c.document.createTextNode=text=>({textContent:text});c.document.body.appendChild=()=>{};c.document.body.append=()=>{};
let copied='';c.navigator={clipboard:{writeText:async v=>{copied=v},readText:async()=>copied}};
c.window.setStatus=c.setStatus;
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../firma-recupero.js'),'utf8'),c);
const recover=p=>c.window.beltramiFirmaIphone.importPacket(p);
const recovered={tipo:'BELTRAMI_FIRMA_IPHONE_V1',versione:1,recuperata:true,id:'RECUPERO_TEST',identita:'TEST_FIRMA',firma_lavoratore_png:packet.firma_lavoratore_png};
const settle=()=>new Promise(r=>setImmediate(r));
function activeDialog(){return dialogs.findLast(d=>!d.removed)}
function visit(e,predicate){if(predicate(e))return e;for(const child of e.children||[]){const found=visit(child,predicate);if(found)return found}return null}
async function approve(){await settle();const d=activeDialog();assert.equal(d.id,'lumenRecoveryConfirm');const yes=visit(d,e=>e.textContent==='INSERISCI FIRMA NELLA VISITA');assert.equal(yes.disabled,true);const check=visit(d,e=>e.id==='lumenRecoveryAttestation');check.checked=true;check.onchange();assert.equal(yes.disabled,false);yes.onclick()}
(async()=>{
 c.apply({...A,anamnesi:'ANNOTAZIONE DA CONSERVARE',firma_lavoratore_png:''});await c.saveToLocalArchive();archive.data.extraClinico='DATO NON VISIBILE DA CONSERVARE';
 store.set('beltrami_firme_lavoratori_v1',JSON.stringify({TEST_FIRMA:packet.firma_lavoratore_png,ALTRO:'data:image/png;base64,QUxUUk8='}));
 const cacheBefore=store.get('beltrami_firme_lavoratori_v1'),before=JSON.stringify(archive);
 let pending=recover(recovered);await settle();assert.equal(JSON.stringify(archive),before,'No write before attestation');
 visit(activeDialog(),e=>e.textContent==='ANNULLA').onclick();await pending;assert.equal(JSON.stringify(archive),before);assert.equal(c.collect().firma_lavoratore_png,'');
 pending=recover(recovered);await approve();await pending;
 assert.equal(archive.data.firma_lavoratore_png,packet.firma_lavoratore_png);assert.equal(archive.data.extraClinico,'DATO NON VISIBILE DA CONSERVARE');
 const afterData={...archive.data};delete afterData.firma_lavoratore_recupero;afterData.firma_lavoratore_png='';assert.deepEqual(afterData,JSON.parse(before).data);
 assert.deepEqual(archive.history.at(-1).data,JSON.parse(before).data);assert.equal(store.get('beltrami_firme_lavoratori_v1'),cacheBefore);
 assert.equal(archive.data.firma_lavoratore_recupero.visita_confermata,A.data_giudizio);assert.equal(c.saveKind,'ok');
 c.apply(archive.data);assert.equal(c.collect().firma_lavoratore_png,packet.firma_lavoratore_png);
 await assert.rejects(recover({...recovered,identita:'OTHER'}),/non appartiene/);
 await assert.rejects(recover({...recovered,firma_lavoratore_png:'data:image/png;base64,T1RIRVI='}),/già una firma/);
 c.apply(A);archive=JSON.parse(before);
 // Strict V2 validation remains intact; generic undated packets do not become recovery packets.
 await assert.rejects(recover({...recovered,recuperata:false}),/NON IDENTIFICA/);
 await assert.rejects(recover({...packet,id:'UNKNOWN'}),/NON RICONOSCIUTA/);
 await assert.rejects(recover({...recovered,visita:'2026-09-28'}),/non è una firma recuperata/);
 // Selection changes during confirmation must not write either record.
 pending=recover(recovered);await settle();c.apply({...A,codice_fiscale:'OTHER'});await approve();await assert.rejects(pending,/cambiata/);assert.equal(JSON.stringify(archive),before);
 c.apply(A);writeFail=true;pending=recover(recovered);await approve();await assert.rejects(pending,/DISK FULL/);writeFail=false;assert.equal(JSON.stringify(archive),before);assert.equal(c.collect().firma_lavoratore_png,'');
 // A full name and birth date identity is valid after the CF has been added.
 pending=recover({...recovered,identita:'PROVA|FIRMA|1980-01-01'});await approve();await pending;assert.equal(archive.data.firma_lavoratore_png,packet.firma_lavoratore_png);
 // Existing recovery exports retain V1 and absent dates; the application asks, never invents.
 const recoveryHtml=fs.readFileSync(require('node:path').join(__dirname,'../recupera-firme.html'),'utf8');
 vm.runInContext(recoveryHtml.slice(recoveryHtml.indexOf('function packetFor('),recoveryHtml.indexOf('function fileFor(')),c);
 const oldPacket=c.packetFor('PROVA|TEST|1980-01-01',packet.firma_lavoratore_png);assert.equal(oldPacket.versione,1);assert.equal(oldPacket.visita,undefined);assert.equal(oldPacket.recuperata,true);
 // Copy/paste round trip keeps all signature data and V2 request identifiers.
 await c.window.lumenFirmaRecovery.copyPacket(packet);assert.deepEqual(JSON.parse(JSON.stringify(c.window.lumenFirmaRecovery.parseClipboard(copied))),packet);
 assert.throws(()=>c.window.lumenFirmaRecovery.parseClipboard('other clipboard content'));
 await c.window.lumenFirmaRecovery.copyPacket(recovered);assert.equal(c.window.lumenFirmaRecovery.parseClipboard(copied).recuperata,true);
 get('btnIncollaFirma').onclick();await settle();assert.equal(visit(activeDialog(),e=>e.tag==='textarea').value,copied);visit(activeDialog(),e=>e.textContent==='ANNULLA').onclick();
 assert.equal(store.get('beltrami_firme_lavoratori_v1'),cacheBefore);
 console.log('PASS: recovery requires visible confirmation; cancel unchanged; identity/date protections; existing signature protected; clinical fields/history/cache preserved; disk failure; worker switch; CF added; copy/paste round trip.');
})().catch(e=>{console.error(e);process.exitCode=1});
