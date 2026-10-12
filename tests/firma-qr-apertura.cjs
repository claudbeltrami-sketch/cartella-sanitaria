// Isolated QR opening regression: Safari load, tab reuse, and no duplicate modal.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('let firmaQrOpening=false;');
const end=html.indexOf('async function saveCartellaVerified()',start);
assert(start>0&&end>start,'QR initializer exists');
const src=html.slice(start,end);
const listeners={},store={},state={clicks:0,applies:0,modal:false,hash:'',errors:[]};
const context={
 location:{pathname:'/cartella-sanitaria/',search:'',get hash(){return state.hash}},
 window:{addEventListener:(type,fn)=>listeners[type]=fn},
 document:{getElementById(id){if(id==='btnFirmaLavoratore')return {isConnected:true,click(){state.clicks++;state.modal=true}};if(id==='workerSignModal')return {classList:{contains:()=>state.modal}};return null}},
 history:{replaceState(){state.hash=''}},
 handoffDecode:()=>({tipo:'BELTRAMI_RICHIESTA_FIRMA_IPHONE_V1'}),
 checkSignatureRequest:()=>({id:'TEST',visita:'2026-10-12'}),
 apply:()=>state.applies++,
 lumenStorage:{session:{setItem:(k,v)=>store[k]=v}},
 setStatus:()=>{},
 alert:e=>state.errors.push(e),
 requestAnimationFrame:fn=>fn(),
};
vm.createContext(context);vm.runInContext(src,context);
assert.equal(typeof listeners.load,'function');assert.equal(typeof listeners.pageshow,'function');assert.equal(typeof listeners.hashchange,'function');
state.hash='#firma=synthetic';listeners.load();assert.equal(state.clicks,1);assert.equal(state.applies,1);
listeners.pageshow();assert.equal(state.clicks,1,'no duplicate after hash cleared');
state.modal=false;state.hash='#firma=second';listeners.hashchange();assert.equal(state.clicks,2);
assert.equal(JSON.parse(store.beltrami_firma_handoff).id,'TEST');
assert.deepEqual(state.errors,[]);
console.log('PASS: load, pageshow, reused Safari tab/hashchange, no duplicate opening; synthetic QR.');
