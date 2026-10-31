// A Mac/iPhone may still be controlled by the previous service worker.
// New signature code must bypass its exact old script entry, without clearing data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),source=fs.readFileSync(path.join(root,'lumen-sw.js'),'utf8');
const version=source.match(/const VERSION='([^']+)'/)[1];
assert.ok(html.includes('name="lumen-signature-build" content="'+version+'"'));
const origin='https://example.test/cartella-sanitaria/';
const stores=new Map(),handlers={};
function cache(name){if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);return {match:async key=>entries.get(typeof key==='string'?key:key.url),put:async(key,response)=>entries.set(typeof key==='string'?key:key.url,response)};}
const response=text=>({ok:true,text,clone(){return response(text)}});
let offline=false,fetches=0;
function worker(code){
 const listeners={};
 vm.runInNewContext(code,{URL,Request,console,self:{location:{href:origin+'lumen-sw.js'},addEventListener:(name,fn)=>listeners[name]=fn},caches:{open:async name=>cache(name)},fetch:async()=>{fetches++;if(offline)throw Error('offline');return response('NEW SIGNATURE CODE')}});
 return listeners.fetch;
}
async function request(handler,url){let pending;handler({request:{url,method:'GET',mode:'cors'},respondWith:p=>pending=p});assert.ok(pending);return pending;}
(async()=>{
 const previous='PREVIOUS_SIGNATURE_BUILD',oldName='lumen-program-'+previous;
 const oldCache=cache(oldName);
 await oldCache.put(origin+'firma-offline.js?v=20260929-1',response('STALE SIGNATURE CODE'));
 await oldCache.put(origin+'firma-offline.js',response('STALE SIGNATURE CODE'));
 const oldWorker=worker(source.replace("const VERSION='"+version+"'","const VERSION='"+previous+"'"));
 const script=html.match(/src="(firma-offline\.js\?v=[^"]+)"/)[1];
 assert.equal((await request(oldWorker,origin+script)).text,'NEW SIGNATURE CODE');
 assert.equal(fetches,1,'a new script version cannot silently use the old exact cache');
 const currentCache=cache('lumen-program-'+version);
 await currentCache.put(origin+'firma-offline.js',response('NEW SIGNATURE CODE'));
 offline=true;
 assert.equal((await request(worker(source),origin+script)).text,'NEW SIGNATURE CODE');
 assert.equal((await oldCache.match(origin+'firma-offline.js')).text,'STALE SIGNATURE CODE','old program retained for rollback');
 for(const file of ['firma-recupero.js','lumen-offline.js'])assert.ok(html.includes(file+'?v='+version));
 assert.ok(html.includes('firma_auto=20261031-1#firma='));
 console.log('PASS: previous service worker fetches new signature code; new offline copy works; old cache retained; all signature/update versions aligned.');
})().catch(e=>{console.error(e);process.exitCode=1});
