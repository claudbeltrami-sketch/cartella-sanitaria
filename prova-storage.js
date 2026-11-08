/* Device-local, per-page namespaces. Production storage is never migrated. */
(() => {
 'use strict';
 const isTest=new URLSearchParams(location.search).get('prova')==='fantasma';
 const prefix='lumen_prova_fantasma_v1:';
 const initialIdentity={cognome:'PROVA',nome:'FANTASMA',codice_fiscale:'',data_nascita:''};
 let identity={...initialIdentity},activeNumber=1;
 const activeKey='active-prova-number-v1';
 function numberOf(name){
  if(name==='FANTASMA')return 1;
  const match=/^FANTASMA ([2-9]|1[0-9]|20)$/.exec(String(name||''));
  return match?Number(match[1]):0;
 }
 function setTestIdentity(number){
  if(!isTest||!Number.isInteger(number)||number<1||number>20)throw Error('Identità di prova non valida.');
  activeNumber=number;
  identity={...initialIdentity,nome:number===1?'FANTASMA':'FANTASMA '+number};
  scoped(window.localStorage).setItem(activeKey,String(number));
  return identity;
 }
 if(isTest){
  const restored=Number(scoped(window.localStorage).getItem(activeKey));
  if(Number.isInteger(restored)&&restored>=2&&restored<=20)setTestIdentity(restored);
 }
 const connections=new Set();
 function scoped(storage){
  if(!isTest)return storage;
  const keys=()=>Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(k=>k&&k.startsWith(prefix));
  return {getItem:k=>storage.getItem(prefix+k),setItem:(k,v)=>storage.setItem(prefix+k,v),removeItem:k=>storage.removeItem(prefix+k),key:i=>{const k=keys()[i];return k?k.slice(prefix.length):null},get length(){return keys().length},clear:()=>keys().forEach(k=>storage.removeItem(k))};
 }
 const db={open(name,version){
  const r=version===undefined?window.indexedDB.open(isTest?prefix+name:name):window.indexedDB.open(isTest?prefix+name:name,version);
  if(isTest)r.addEventListener('success',()=>{connections.add(r.result);r.result.addEventListener('versionchange',()=>r.result.close())});
  return r;
 }};
 function checkPacket(packet){
  if(Boolean(packet?.lumen_prova)!==isTest)throw Error(isTest?'Apri solo dati di PROVA FANTASMA in questa modalità.':'Dati di PROVA FANTASMA: apri MODALITÀ PROVA per usarli.');
 }
 function checkData(data){
  checkPacket(data);
  if(isTest){
   const n=data?.cognome==='PROVA'&&!data?.codice_fiscale&&!data?.data_nascita?numberOf(data?.nome):0;
   if(!n)throw Error('La modalità prova usa soltanto identità fittizie PROVA FANTASMA numerate.');
   if(n!==activeNumber)setTestIdentity(n);
  }
 }
 async function reset(){
  if(!isTest)throw Error('Azzeramento disponibile solo in modalità prova.');
  connections.forEach(c=>c.close());connections.clear();
  // Explicit allowlist: never delete the production databases.
  for(const name of ['beltrami_cartelle_db_v1','beltrami_lumen_files_v1','beltrami_consensi_cartacei_v1','beltrami_firme_trasferimento_v1','beltrami_allegati_mac_v1','LUMEN_DVR_LOCALE_V1']){
   await new Promise((resolve,reject)=>{const r=window.indexedDB.deleteDatabase(prefix+name);r.onsuccess=resolve;r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Chiudi le altre schede di PROVA FANTASMA e riprova.'))});
  }
  scoped(window.localStorage).clear();scoped(window.sessionStorage).clear();
 }
 window.lumenStorage={isTest,get identity(){return identity},setTestIdentity,local:scoped(window.localStorage),session:scoped(window.sessionStorage),indexedDB:db,checkData,checkPacket,reset};
 if(isTest)document.documentElement.dataset.lumenProva='true';
})();
