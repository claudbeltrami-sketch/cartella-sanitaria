/* Read-only interpretation of legacy company labels. No database migration. */
(function(root){
 'use strict';
 const clean=v=>String(v||'').trim().replace(/\s+/g,' ');
 const upper=v=>clean(v).toLocaleUpperCase('it-IT');
 const key=v=>upper(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
 function client(v){return /^(GRUPPO )?ORIZZONTE$/.test(upper(v))?'GRUPPO ORIZZONTE':upper(v)}
 function normalize(source={}){
  const d={...source};
  if(String(d.ruoli_azienda_versione||'')==='1')return d;
  const original=clean(d.datore_lavoro),m=original.match(/^(SERMOLAB|(?:GRUPPO\s+)?ORIZZONTE)(?=$|\s|[-–—:])\s*[-–—:]?\s*(.*)$/i);
  d.committente=client(d.committente);
  if(m&&(!d.committente||d.committente===client(m[1]))){
   d.committente=client(m[1]);
   let employer=clean(m[2]);
   // Only strip a known historical site label followed by an explicit legal name.
   if(d.committente==='GRUPPO ORIZZONTE'){
    const site=employer.match(/^(PRENESTINA|GUIDONIA|COLLATINA|CERVETERI)(?:\s*[-–—:]\s*|\s+)(.+\bS\.?\s*R\.?\s*L\.?)$/i);
    if(site)employer=clean(site[2]);
    else if(/^(PRENESTINA|GUIDONIA|COLLATINA|CERVETERI)$/i.test(employer))employer='';
   }
   d.datore_lavoro_originale=d.datore_lavoro_originale||original;
   d.datore_lavoro=employer;
  }
  d.ruoli_azienda_versione='1';
  return d;
 }
 function forRecord(record,source=record.data||{}){
  const d=normalize(source),day=String(d.data_giudizio||d.data_cartella||'');
  const entry=record.conteggioVisits?.[day];
  // Only a stored assignment for this precise visit may fill an absent commissioner.
  if(!d.committente&&entry?.date===day&&entry.client)d.committente=client(entry.client);
  return d;
 }
 function matches(source,filters={}){
  const d=normalize(source),has=(value,q)=>clean(q).split(/\s+/).filter(Boolean).every(t=>key(value).includes(key(t)));
  return has(client(d.committente),filters.committente)&&has(d.datore_lavoro,filters.datore_lavoro);
 }
 root.lumenRuoliAzienda={normalize,forRecord,matches,client};
})(typeof window==='undefined'?globalThis:window);
