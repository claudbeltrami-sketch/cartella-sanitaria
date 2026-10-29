const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../lumen-sw.js'),'utf8');
const events={},data=new Map();let offline=false,claimed=false,skipped=false;
const cache={
 async addAll(requests){for(const request of requests){const u=new URL(typeof request==='string'?request:request.url);if(u.origin==='https://example.test'){assert.ok(fs.existsSync(path.join(__dirname,'..',u.pathname.replace('/cartella-sanitaria/',''))),u.href);}data.set(u.href,new Response(u.pathname));}},
 async match(url){return data.get(typeof url==='string'?url:url.url||url.href)?.clone()},
 async put(url,response){data.set(url, response.clone())}
};
const self={location:{href:'https://example.test/cartella-sanitaria/lumen-sw.js'},addEventListener:(name,handler)=>events[name]=handler,skipWaiting:async()=>skipped=true,clients:{claim:async()=>claimed=true}};
vm.runInNewContext(source,{self,URL,Request,caches:{open:async()=>cache},fetch:async request=>{if(offline)throw Error('offline');return new Response('online:'+request.url)}});
async function lifecycle(name){let done;events[name]({waitUntil:p=>done=p});await done}
async function request(url,method='GET'){let response;const request=new Request(url,{method});if(url.endsWith('/cartella-sanitaria/'))Object.defineProperty(request,'mode',{value:'navigate'});events.fetch({request,respondWith:p=>response=p});return response}
(async()=>{
 await lifecycle('install');await lifecycle('activate');assert.ok(skipped&&claimed);
 assert.match(await (await request('https://example.test/cartella-sanitaria/')).text(),/^online:/);
 // An installed unversioned copy must not mask a newer requested script.
 const script='https://example.test/cartella-sanitaria/storico-cartaceo.js?v=nuova';
 assert.equal(await (await request(script)).text(),'online:'+script);
 offline=true;
 assert.equal(await (await request(script)).text(),'online:'+script);

 assert.equal(await (await request('https://example.test/cartella-sanitaria/?prova=fantasma')).text(),'/cartella-sanitaria/index.html');
 assert.equal(await (await request('https://example.test/cartella-sanitaria/esami-compatti.js?v=1')).text(),'/cartella-sanitaria/esami-compatti.js');
 assert.equal(await (await request('https://example.test/cartella-sanitaria/lumen-offline.js?v=1')).text(),'/cartella-sanitaria/lumen-offline.js');
 assert.equal(await (await request('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')).text(),'/ajax/libs/jszip/3.10.1/jszip.min.js');
 assert.equal(await request('https://example.test/cartella-sanitaria/paziente.json'),undefined);
 assert.equal(await request('https://example.test/altro/index.html'),undefined);
 assert.equal(await request('https://example.test/cartella-sanitaria/index.html','POST'),undefined);
 let done,result;events.message({data:{type:'LUMEN_OFFLINE_STATUS'},ports:[{postMessage:d=>result=d}],waitUntil:p=>done=p});await done;assert.equal(result.ready,true);
 data.delete('https://example.test/cartella-sanitaria/esami-compatti.js');events.message({data:{type:'LUMEN_OFFLINE_STATUS'},ports:[{postMessage:d=>result=d}],waitUntil:p=>done=p});await done;assert.equal(result.ready,false);
 console.log('PASS: install, activation, offline root/query/scripts/CDN, scope, clinical exclusion, readiness and incomplete cache');
})().catch(e=>{console.error(e);process.exitCode=1});
