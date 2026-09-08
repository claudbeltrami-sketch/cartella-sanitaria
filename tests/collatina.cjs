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
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},sessionStorage:{removeItem:k=>store.delete(k)},
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
vm.runInContext(html.slice(html.indexOf('// A complete load'),html.indexOf('\nfunction filename(')),c);
vm.runInContext(html.slice(html.indexOf('const workerDrafts='),html.indexOf('\nfunction moveWorker(')),c);
vm.runInContext(line('checkedValues'),c);
vm.runInContext(html.match(/^const fmt=v=>.+/m)[0],c);
vm.runInContext(html.slice(html.indexOf('function luogoVisitaSessione('),html.indexOf("document.getElementById('btnTorna').onclick")),c);
c.verificaPrimaDelPdf=()=>true;
const signBlock=html.slice(html.indexOf('function updateOutput(){'),html.indexOf('\nfunction sizeCanvas(){'));
vm.runInContext("const outputs=['cartellaAnamnesiWorkerSignature','cartellaFinaleWorkerSignature','certWorkerSignature'].map(document.getElementById); function identity(){return {key:workerSignatureIdentity(collect())}} function readStore(){return workerSignatureStore()}"+signBlock,c);
c.window.lumenBatchCertApi={collect:c.collect};outputUpdate=c.updateOutput;
const A={cognome:'TESTUNO',nome:'ALFA',codice_fiscale:'TEST_WORKER_A',data_nascita:'1980-01-01',data_cartella:'2026-09-08',data_giudizio:'2026-09-08',sesso:'M',farmaci:'FARMACO DI PROVA',anamnesi_patologica:'SOLO ALFA',altezza:'175',peso:'125',prescrizioni:'LIMITAZIONE ALFA',rischi:['ONE'],protocollo:['TWO'],giudizio:'ONE',fumatore:true,firma_lavoratore_png:'SIGNATURE_A'};
const B={cognome:'TESTDUE',nome:'BETA',codice_fiscale:'TEST_WORKER_B',data_nascita:'1990-02-02',data_cartella:'2026-09-08',data_giudizio:'2026-09-08',firma_lavoratore_png:''};
function signatureIs(value){for(const id of ['cartellaAnamnesiWorkerSignature','cartellaFinaleWorkerSignature','certWorkerSignature'])assert.equal(get(id).src||'',value)}
async function run(){
 c.apply(A);assert.equal(c.collect().bmi_classificazione,'OBESITÀ CLASSE III');signatureIs('SIGNATURE_A');
 c.apply(B);for(const id of ['sesso','farmaci','anamnesi_patologica','altezza','peso','bmi','bmi_classificazione','prescrizioni'])assert.equal(get(id).value,'',id);
 assert.equal(get('fumatore').checked,false);assert.equal(c.collect().giudizio,'');assert.equal(c.collect().rischi.length,0);assert.equal(c.collect().protocollo.length,0);signatureIs('');
 store.set('beltrami_firme_lavoratori_v1',JSON.stringify({TEST_WORKER_A:'OLD_SIGNATURE_A',TEST_WORKER_B:'OLD_SIGNATURE_B'}));
 c.apply(B);signatureIs('');assert.equal(c.collect().firma_lavoratore_png,'');
 c.apply({...B,firma_lavoratore_png:'SIGNATURE_B'});signatureIs('SIGNATURE_B');
 c.apply(A);signatureIs('SIGNATURE_A');c.apply(B);signatureIs('');c.apply(A);signatureIs('SIGNATURE_A');
 c.useWorkerSignature('NEW_SIGNATURE_A');signatureIs('NEW_SIGNATURE_A');get('data_giudizio').value='2026-09-09';c.updateOutput();signatureIs('');
 c.apply({...B,pressione:'120/80',invalidita_percentuale:0});assert.equal(get('pas').value,'120');assert.equal(get('pad').value,'80');assert.equal(get('invalidita_percentuale').value,0);
 c.workers=[A,B];get('v9Data').value='2026-09-08';c.apply(A);await c.selectWorker(1);assert.equal(c.collect().codice_fiscale,'TEST_WORKER_B');signatureIs('');await c.selectWorker(0);assert.equal(c.collect().anamnesi_patologica,'SOLO ALFA');signatureIs('SIGNATURE_A');
 // Saved records restore only the selected worker and date, without archive writes.
 const C={...B,cognome:'TESTTRE',nome:'GAMMA',codice_fiscale:'TEST_WORKER_C'};
 c.workers.push(C);c.getCartellaRecord=async()=>({data:{...C,farmaci:'SOLO GAMMA',firma_lavoratore_png:'SIGNATURE_C'}});
 await c.selectWorker(2);assert.equal(c.collect().farmaci,'SOLO GAMMA');signatureIs('SIGNATURE_C');
 const D={...B,cognome:'TESTQUATTRO',nome:'DELTA',codice_fiscale:'TEST_WORKER_D'};c.workers.push(D);
 c.getCartellaRecord=async()=>({data:{...D,data_giudizio:'2026-01-01',farmaci:'OLD'}});await c.selectWorker(3);assert.equal(c.collect().farmaci,'');signatureIs('');
 // A slow archive response must not overwrite a later choice or typed data.
 const E={...B,cognome:'TESTCINQUE',nome:'EPSILON',codice_fiscale:'TEST_WORKER_E'};c.workers.push(E);
 let resolve;c.getCartellaRecord=()=>new Promise(r=>resolve=r);const pending=c.selectWorker(4);c.apply(A);resolve({data:{...E,farmaci:'STALE'}});await pending;assert.equal(c.collect().codice_fiscale,'TEST_WORKER_A');
 const F={...B,cognome:'TESTSEI',nome:'ZETA',codice_fiscale:'TEST_WORKER_F'};c.workers.push(F);
 const typing=c.selectWorker(5);get('farmaci').value='TYPED';resolve({data:{...F,farmaci:'STALE'}});await typing;assert.equal(c.collect().farmaci,'TYPED');
 assert.equal(JSON.parse(store.get('beltrami_firme_lavoratori_v1')).TEST_WORKER_A,'OLD_SIGNATURE_A');
 // Archived visits retain their own place even without a session or with a different one open.
 get('v9Sede').value='';get('v9Data').value='';
 c.apply({...A,luogo_visita:' Roma '});c.popolaCertificato();
 assert.equal(get('c_luogo_data').textContent,'ROMA, 08/09/2026');
 assert.equal(get('c_luogo_visita').textContent,'ROMA');signatureIs('SIGNATURE_A');
 const archived=JSON.parse(JSON.stringify(c.collect()));
 get('v9Sede').value='Milano';get('v9Data').value='2026-09-09';
 c.apply(archived);c.popolaCertificato();assert.equal(get('c_luogo_data').textContent,'ROMA, 08/09/2026');
 // An unrelated session, workplace or birthplace must not become the visit location.
 c.apply({...B,sede_lavoro:'SEDE AZIENDA',luogo_nascita:'COMUNE NASCITA'});
 assert.equal(c.collect().luogo_visita,'');signatureIs('');
 c.prompt=()=>null;get('btnCert').onclick();assert.equal(get('certificate').style.display,'none');
 c.prompt=()=> '  ';get('btnCert').onclick();assert.equal(get('certificate').style.display,'none');
 c.prompt=()=> ' Roma Collatina ';get('btnCert').onclick();
 assert.equal(get('c_luogo_data').textContent,'ROMA COLLATINA, 08/09/2026');
 assert.equal(c.collect().luogo_visita,'ROMA COLLATINA');
 c.prompt=()=>{throw new Error('A known visit location must not prompt again')};get('btnCert').onclick();
 // Same-day session locations initialize a new record and survive its export/reopening.
 get('v9Data').value='2026-09-08';get('v9Sede').value='COLLATINA';c.apply(B);
 assert.equal(c.collect().luogo_visita,'COLLATINA');
 get('v9Sede').value='';get('v9Data').value='';
 store.set('beltrami_v9_sessione_attiva',JSON.stringify({data:'2026-09-08',sede:'Roma'}));
 c.apply(B);assert.equal(c.collect().luogo_visita,'ROMA');
 store.set('beltrami_v9_sessione_attiva',JSON.stringify({data:'2026-09-07',sede:'LATINA'}));
 c.apply(B);assert.equal(c.collect().luogo_visita,'');
 store.delete('beltrami_v9_sessione_attiva');
 // The imported list may lack the CF which was added before archiving the visit.
 get('v9Data').value='2026-09-08';
 const G={...B,cognome:'TESTSETTE',nome:'ETA',codice_fiscale:''};
 const savedG={...G,codice_fiscale:'TEST_WORKER_G',farmaci:'DATI ARCHIVIATI ETA',firma_lavoratore_png:'SIGNATURE_G'};
 const recG={id:'CF_TESTWORKERG',data:savedG};c.workers.push(G);
 c.getCartellaRecord=async()=>null;c.listCartelleArchive=async()=>[recG];
 await c.selectWorker(c.workers.length-1);
 assert.equal(c.collect().farmaci,'DATI ARCHIVIATI ETA','recover an archived CF from an incomplete list');
 assert.equal(c.collect().codice_fiscale,'TEST_WORKER_G');signatureIs('SIGNATURE_G');
 // Untouched blank screens must not become drafts that block a subsequent archive lookup.
 c.listCartelleArchive=async()=>[];
 const H={...B,cognome:'TESTOTTO',nome:'THETA',codice_fiscale:'TEST_WORKER_H'};c.workers.push(H);const hi=c.workers.length-1;
 let resolveH;c.getCartellaRecord=()=>new Promise(resolve=>resolveH=resolve);
 const openingH=c.selectWorker(hi);
 c.getCartellaRecord=async()=>null;await c.selectWorker(0);
 resolveH({data:{...H,farmaci:'DATI THETA',firma_lavoratore_png:'SIGNATURE_H'}});await openingH;
 c.getCartellaRecord=async()=>({data:{...H,farmaci:'DATI THETA',firma_lavoratore_png:'SIGNATURE_H'}});
 await c.selectWorker(hi);assert.equal(c.collect().farmaci,'DATI THETA','retry archive read after leaving a blank loading screen');signatureIs('SIGNATURE_H');
 // Recovered CFs must not prevent an edited draft from reopening through the original list.
 const gi=c.workers.indexOf(G);await c.selectWorker(gi);get('farmaci').value='BOZZA ETA MODIFICATA';
 await c.selectWorker(hi);await c.selectWorker(gi);assert.equal(c.collect().farmaci,'BOZZA ETA MODIFICATA');
 assert.equal(c.collect().codice_fiscale,'TEST_WORKER_G');signatureIs('SIGNATURE_G');
 // A conflicting CF or ambiguous names must never load someone else's clinical data.
 const I={...B,cognome:'TESTNOVE',nome:'IOTA',codice_fiscale:'TEST_WORKER_I',visited:true};c.workers.push(I);
 c.getCartellaRecord=async()=>null;c.listCartelleArchive=async()=>[{data:{...I,codice_fiscale:'CONFLICTING_CF',farmaci:'NON CARICARE',firma_lavoratore_png:'WRONG_SIGNATURE'}}];
 await c.selectWorker(c.workers.length-1);assert.equal(c.collect().farmaci,'');signatureIs('');
 const J={...B,cognome:'TESTDIECI',nome:'KAPPA',codice_fiscale:'',data_nascita:'',visited:true};c.workers.push(J);
 c.listCartelleArchive=async()=>[{data:{...J,data_nascita:'1980-01-01',codice_fiscale:'NAMESAKE_A',farmaci:'NON CARICARE'}}];
 await c.selectWorker(c.workers.length-1);assert.equal(c.collect().farmaci,'');signatureIs('');
 assert.match(c.lastStatus,/archivio/);
 const K={...J,cognome:'TESTUNDICI',data_nascita:'1980-01-01'};c.workers.push(K);
 c.listCartelleArchive=async()=>[{data:{...K,codice_fiscale:'NAMESAKE_A',farmaci:'NON CARICARE'}},{data:{...K,codice_fiscale:'NAMESAKE_B',farmaci:'NON CARICARE'}}];
 await c.selectWorker(c.workers.length-1);assert.equal(c.collect().farmaci,'');signatureIs('');
 // RIAPRI actually opens the record, preserving the attendance mark.
 const selectOriginal=c.selectWorker;let selectedIndex=-1,saves=0;
 c.selectWorker=async i=>{selectedIndex=i};c.saveWorkersLocal=()=>saves++;
 c.workers[hi].visited=true;await c.handleWorkerVisit(hi);
 assert.equal(selectedIndex,hi);assert.equal(c.workers[hi].visited,true);assert.equal(saves,0);
 c.workers[gi].visited=false;await c.handleWorkerVisit(gi);
 assert.equal(c.workers[gi].visited,true);assert.equal(saves,1);assert.equal(selectedIndex,hi);
 c.selectWorker=selectOriginal;
 console.log(`PASS: ${scriptCount} scripts parse; record and signature isolation; saved visits and place/date; missing-place entry; incomplete-list CF recovery; empty loading screens; edited drafts; conflicting and ambiguous identities; RIAPRI opens without clearing attendance.`);
}
run().catch(e=>{console.error(e);process.exitCode=1});
