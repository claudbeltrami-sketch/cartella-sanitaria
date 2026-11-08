/* Motore puro: nessuna lettura/scrittura dell'archivio. Collaudo LUMEN. */
(function(root){
 const api=(function createEngine(){
"use strict";
function dateOf(s){const d=s?.data||s||{};const v=d.data_giudizio||d.data_cartella||"";return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:""}
function canonical(x){if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";if(x&&typeof x==="object")return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";return JSON.stringify(x)}
function snapshots(r){return [...(Array.isArray(r.history)?r.history:[]),{savedAt:r.updatedAt||r.createdAt||"",data:r.data}].filter(x=>x&&x.data&&dateOf(x))}
function identity(r){const d=r.data||{},cf=(r.cf||d.codice_fiscale||"").replace(/\W/g,"").toUpperCase(),name=(r.cognome||d.cognome||"").trim().toUpperCase(),given=(r.nome||d.nome||"").trim().toUpperCase(),birth=r.dataNascita||d.data_nascita||"";return cf?"CF:"+cf:"ID:"+name+"|"+given+"|"+birth}
function resolve(target,packet){
 if(!packet||packet.tipo!=="LUMEN_EMERGENZA_SESSIONE_V1"||packet.versione!==1||!Array.isArray(packet.cartelle)||!Array.isArray(packet.originali)||!/^\d{4}-\d{2}-\d{2}$/.test(packet.data||""))throw Error("File di emergenza non valido.");
 if(!Array.isArray(target))throw Error("Archivio di destinazione non valido.");
 const oldById=new Map(target.map(r=>[r.id,r])),oldByIdentity=new Map(target.map(r=>[identity(r),r])),updates=[],conflicts=[];
 let already=0,addedVisits=0;
 const seen=new Set();
 for(const source of packet.cartelle){
  if(!source||typeof source.id!=="string"||!source.id||!source.data||!source.data.cognome||!source.data.nome){conflicts.push("Cartella sorgente incompleta");continue}
  const sourceSnapshots=snapshots(source).filter(x=>dateOf(x)===packet.data);
  if(!sourceSnapshots.length){conflicts.push("Nessuna visita nella data indicata: "+source.id);continue}
  if(seen.has(source.id)){conflicts.push("Cartella duplicata nel file: "+source.id);continue}seen.add(source.id);
  const dest=oldById.get(source.id)||oldByIdentity.get(identity(source));
  if(dest&&identity(dest)!==identity(source)){conflicts.push("Identità discordante: "+source.id);continue}
  if(dest&&dest.id!==source.id){conflicts.push("Identificatore differente per lo stesso lavoratore: "+source.id);continue}
  const old=dest?snapshots(dest):[],byDate=new Map();
  for(const snap of old){const d=dateOf(snap);if(!byDate.has(d))byDate.set(d,[]);byDate.get(d).push(snap)}
  const incoming=[];let collision=false;
  for(const snap of sourceSnapshots){
    const copies=byDate.get(dateOf(snap))||[];
    if(copies.length){if(!copies.some(c=>canonical(c.data)===canonical(snap.data))){collision=true;break}already++}
    else if(!incoming.some(c=>canonical(c.data)===canonical(snap.data)))incoming.push(snap);
  }
  if(collision){conflicts.push("Stessa visita con dati differenti: "+source.id+" / "+packet.data);continue}
  if(!incoming.length)continue;
  const all=[...old,...incoming].sort((a,b)=>dateOf(a).localeCompare(dateOf(b))||String(a.savedAt||"").localeCompare(String(b.savedAt||"")));
  if(all.length>26){conflicts.push("Storico oltre 25 versioni: "+source.id+" (unione manuale necessaria)");continue}
  const curr=all[all.length-1];
  const out=dest?{...dest,data:curr.data,history:all.slice(0,-1),updatedAt:new Date().toISOString()}:{...source,data:curr.data,history:all.slice(0,-1),updatedAt:source.updatedAt||new Date().toISOString()};
  updates.push(out);addedVisits+=incoming.length;
 }
 return {updates,conflicts,already,addedVisits,newWorkers:updates.filter(x=>!oldById.has(x.id)).length};
}
return {resolve,dateOf,canonical,snapshots,identity};
})();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.lumenEmergencyMerge=api;
})(typeof window!=='undefined'?window:this);
