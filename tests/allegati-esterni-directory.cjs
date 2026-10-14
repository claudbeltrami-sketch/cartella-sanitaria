// Directory capability simulation. Native picker testing is separate.
const {app}=require('./allegati-dom.cjs'),idb=require('fake-indexeddb'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const digest=b=>createHash('sha256').update(b).digest('hex');
class Directory {
 constructor(){this.mockDirectory=true;this.name='LUMEN_ALLEGATI';this.files=new Map();this.permission='granted';this.fail=false}
 async queryPermission(){return this.permission}
 async getFileHandle(name,{create=false}={}){
  if(!this.files.has(name)){if(!create)throw new DOMException('Missing','NotFoundError');this.files.set(name,new Blob([]))}
  return {getFile:async()=>this.files.get(name),createWritable:async()=>{let blob;return {write:async value=>{blob=value instanceof Blob?value:new Blob([value])},close:async()=>{if(this.fail)throw Error('Synthetic disk full');this.files.set(name,blob)},abort:async()=>{}}}};
 }
}
async function put(p,row){const s=p.w.lumenAllegatiStorage,db=await s.open();try{await new Promise((res,rej)=>{const tx=db.transaction(s.store,'readwrite');tx.objectStore(s.store).put(row);tx.oncomplete=res;tx.onabort=()=>rej(tx.error)})}finally{db.close()}}
function make(id,text){return {id,kind:'allegato_cartella_v1',name:id+'.pdf',workerKey:'CF_SYNTHETIC',workerCf:'SYNTHETIC',visit:'2026-10-14',savedAt:'2026-10-14T00:00:00Z',hash:digest(text),size:Buffer.byteLength(text),type:'application/pdf',blob:new Blob([text],{type:'application/pdf'})}}
(async()=>{
 // Structured cloning of native FileSystem handles is implemented by browsers;
 // this fixture preserves only these simulated capability objects.
 const clone=global.structuredClone;global.structuredClone=(v,...rest)=>v?.mockDirectory?v:clone(v,...rest);
 const factory=new idb.IDBFactory(),p=await app(factory);let reopened;
 try{
  const root=new Directory(),a=make('ATT_NATIVE','%PDF NATIVE'),b=make('ATT_NEW','%PDF NEW');await put(p,a);
  root.fail=true;await assert.rejects(p.w.lumenExternalAttachments.migrate({root},{write:true}),/disk full/);assert((await p.t.rows())[0].blob instanceof Blob);
  // The failed write left an empty fixture file; a nonmatching destination
  // must never be overwritten, even when the source is still available.
  root.fail=false;await assert.rejects(p.w.lumenExternalAttachments.migrate({root},{write:true}),/non coincide/);assert((await p.t.rows())[0].blob instanceof Blob);
  root.files.clear();await p.w.lumenExternalAttachments.migrate({root},{write:true});const ref=(await p.t.rows())[0];assert.equal(ref.blob,null);assert.equal(await(await p.w.lumenExternalAttachments.getBlob(ref)).text(),'%PDF NATIVE');
  assert([...root.files.keys()].some(n=>n.startsWith('_LUMEN_indice_')));
  reopened=await app(factory);assert.equal(await(await reopened.w.lumenExternalAttachments.getBlob((await reopened.t.rows())[0])).text(),'%PDF NATIVE');
  const [newRow]=await reopened.w.lumenExternalAttachments.stageNew([b]);assert.equal(newRow.blob,null);assert.equal(await(await reopened.w.lumenExternalAttachments.getBlob(newRow)).text(),'%PDF NEW');
  root.permission='denied';await assert.rejects(reopened.w.lumenExternalAttachments.getBlob(ref),/collega la cartella/);
  const [pending]=await reopened.w.lumenExternalAttachments.stageNew([make('ATT_PENDING','%PDF PENDING')]);assert(pending.blob instanceof Blob);
  const before=JSON.stringify(await reopened.t.cartelle());await reopened.w.lumenBackupActions.light();assert.match(reopened.$('lumenBackupTitle').textContent,/LEGGERO PRONTO/);assert.equal(JSON.stringify(await reopened.t.cartelle()),before);
  const ghost=await app(factory,'?prova=fantasma');try{assert.equal((await ghost.t.rows()).length,0);await assert.rejects(ghost.w.lumenExternalAttachments.getBlob(ref),/collega la cartella/)}finally{ghost.dom.window.close()}
  assert.deepEqual(p.errors,[]);assert.deepEqual(reopened.errors,[]);
  console.log('PASS: simulated directory writes, readback, no source removal on write failure, no overwrite of mismatched destination, remembered capability, new external attachments, permission revocation, light backup without permission, ghost isolation.');
 }finally{p.dom.window.close();reopened?.dom.window.close();global.structuredClone=clone}
})().catch(e=>{console.error(e);process.exitCode=1});
