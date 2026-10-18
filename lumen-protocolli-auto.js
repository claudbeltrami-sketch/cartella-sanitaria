/* Protocolli aziendali validati: pianificazione sanitaria, mai esiti clinici. */
(function(){
'use strict';
const KEY='beltrami_protocolli_validati_v1',SNAP='lumen_protocollo_snapshot';
const norm=s=>String(s||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleUpperCase('it');
const context=d=>JSON.stringify([norm(d.datore_lavoro),norm(d.sede_lavoro),norm(d.mansione)]);
const fields=['periodicita','periodicita_altro','periodicita_protocollo','periodicita_protocollo_altro'];
function choose(rows,d){const date=d.data_giudizio||d.data_cartella;if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!norm(d.sede_lavoro))return null;
 const candidates=rows.filter(r=>r.validated===true&&context(r)===context(d)&&r.validFrom<=date).sort((a,b)=>b.validFrom.localeCompare(a.validFrom));
 if(!candidates.length)return null;if(candidates.length>1&&candidates[0].validFrom===candidates[1].validFrom)throw Error('Due versioni con la stessa decorrenza: risolvere l’abbinamento prima di compilare.');return candidates[0];}
if(typeof module!=='undefined'&&module.exports){module.exports={choose,context,norm};return;}
function boot(){
 const api=window.lumenBatchCertApi,form=document.getElementById('cartellaForm'),panel=document.getElementById('lumenDvrPanel');if(!api||!form||!panel)return;
 const storage=window.lumenStorage.local;
 const meta=document.getElementById(SNAP);
 const section=document.createElement('div');section.innerHTML='<hr><strong>Compilazione dal protocollo validato</strong><p data-auto-status role="status"></p><button type="button" data-auto-apply>COMPILA DAL PROTOCOLLO</button><details><summary>Registra il protocollo aziendale validato</summary><p>Imposta nella cartella gli accertamenti previsti e le periodicità, poi registra questa combinazione per azienda, sede e mansione. Non vengono memorizzati gli esiti o i dati del lavoratore.</p><label>Riferimento e revisione del DVR / protocollo <input data-auto-reference data-temporary placeholder="Titolo, revisione e data"></label><label>Valido dal <input type="date" data-auto-date data-temporary></label><button type="button" data-auto-save>VALIDA E REGISTRA QUESTA CONFIGURAZIONE</button></details>';
 panel.append(section);const status=section.querySelector('[data-auto-status]');
 const style=document.createElement('style');style.textContent='#lumenDvrPanel details{margin-top:12px}#lumenDvrPanel details label{display:block;margin:10px 0}#lumenDvrPanel details input{display:block;border:1px solid #aaa;padding:9px;max-width:100%;width:100%;text-transform:none}';document.head.append(style);
 const read=()=>{const r=JSON.parse(storage.getItem(KEY)||'[]');if(!Array.isArray(r))throw Error('Archivio protocolli non valido');return r;};
 const plan=()=>({protocollo:[...document.querySelectorAll('#protocollo input:checked')].map(e=>e.value),...Object.fromEntries(fields.map(id=>[id,document.getElementById(id).value]))});
 const empty=()=>!plan().protocollo.length&&fields.every(id=>!document.getElementById(id).value);
 const get=()=>({datore_lavoro:document.getElementById('datore_lavoro').value,sede_lavoro:document.getElementById('sede_lavoro').value,mansione:document.getElementById('mansione').value,data_giudizio:document.getElementById('data_giudizio').value,data_cartella:document.getElementById('data_cartella').value});
 let protectedRecord=!!window.lumenProtocolloSourcePresent,last='',timer;
 function update(manual=false){try{
  const d=get();last=JSON.stringify(d);
  if(meta.value){const snapshot=JSON.parse(meta.value);status.textContent=context(snapshot)!==context(d)?'Azienda, sede o mansione cambiate: il protocollo precedente resta registrato; controllare i campi prima di procedere.':'Protocollo della visita: '+snapshot.reference+' · decorrenza '+snapshot.validFrom+'. '+(JSON.stringify(plan())!==JSON.stringify(snapshot.plan)?'Configurazione personalizzata manualmente per questa visita. ':'')+(snapshot.visitDate&&snapshot.visitDate!==(d.data_giudizio||d.data_cartella)?'Data visita cambiata: verificare la validità del protocollo. ':'')+'I campi restano modificabili; le tue correzioni vengono conservate.';return;}
  if(!norm(d.datore_lavoro)||!norm(d.mansione)){status.textContent='Indica datore, sede di lavoro e mansione per cercare il protocollo validato.';return;}
  const r=choose(read(),d);if(!r){status.textContent='Nessun protocollo validato corrispondente alla visita. Nessuna compilazione eseguita.';return;}
  if(protectedRecord||!empty()){status.textContent='Protocollo disponibile: '+r.reference+'. La cartella contiene già dati: vengono conservati senza sostituzioni.';return;}
  if(!manual&&(!document.getElementById('cognome').value||!document.getElementById('nome').value)){status.textContent='Protocollo disponibile: '+r.reference+'. Apri o compila la nuova cartella per applicarlo.';return;}
  const allowed=[...document.querySelectorAll('#protocollo input')].map(e=>e.value);
  if(!r.plan||!Array.isArray(r.plan.protocollo)||r.plan.protocollo.some(v=>!allowed.includes(v))||fields.some(id=>typeof r.plan[id]!=='string'))throw Error('Configurazione del protocollo non valida; nessun campo modificato.');
  for(const id of ['periodicita','periodicita_protocollo'])if(![...document.getElementById(id).options].some(o=>o.value===r.plan[id])||!r.plan[id]||(r.plan[id]==='ALTRO'&&!r.plan[id+'_altro'].trim()))throw Error('Periodicità del protocollo non valida; nessun campo modificato.');
  document.querySelectorAll('#protocollo input').forEach(e=>e.checked=r.plan.protocollo.includes(e.value));for(const id of fields)document.getElementById(id).value=r.plan[id];
  meta.value=JSON.stringify({...r,visitDate:d.data_giudizio||d.data_cartella,appliedAt:new Date().toISOString()});
  status.textContent='Compilato dal protocollo validato: '+r.reference+'. Accertamenti pianificati; nessun esito clinico aggiunto.';
 }catch(e){status.textContent='Protocollo non applicato: '+e.message;}}
 section.querySelector('[data-auto-apply]').onclick=()=>update(true);
 for(const el of [...document.querySelectorAll('#protocollo input'),...fields.map(id=>document.getElementById(id))])el.addEventListener('change',()=>update());
 section.querySelector('[data-auto-save]').onclick=()=>{try{
  const d=get(),p=plan(),reference=section.querySelector('[data-auto-reference]').value.trim(),validFrom=section.querySelector('[data-auto-date]').value;
  if(!norm(d.datore_lavoro)||!norm(d.sede_lavoro)||!norm(d.mansione))throw Error('Compila datore, sede di lavoro e mansione.');
  if(!reference||!/^\d{4}-\d{2}-\d{2}$/.test(validFrom))throw Error('Indica riferimento/revisione e decorrenza.');
  if(!p.protocollo.length||!p.periodicita||!p.periodicita_protocollo)throw Error('Seleziona accertamenti, periodicità della visita e periodicità del protocollo.');
  if((p.periodicita==='ALTRO'&&!p.periodicita_altro.trim())||(p.periodicita_protocollo==='ALTRO'&&!p.periodicita_protocollo_altro.trim()))throw Error('Specifica le periodicità indicate come ALTRO.');
  const rows=read();if(rows.some(r=>context(r)===context(d)&&r.validFrom===validFrom))throw Error('Esiste già una versione per questa decorrenza. Non viene sovrascritta.');
  if(!confirm('Confermi di aver validato sul DVR «'+reference+'» questi accertamenti e periodicità per '+d.datore_lavoro+' / '+d.sede_lavoro+' / '+d.mansione+'? La configurazione sarà usata per le nuove cartelle dalla decorrenza indicata.'))return;
  const record={id:crypto.randomUUID(),datore_lavoro:norm(d.datore_lavoro),sede_lavoro:norm(d.sede_lavoro),mansione:norm(d.mansione),reference,validFrom,validated:true,validatedAt:new Date().toISOString(),plan:p};
  storage.setItem(KEY,JSON.stringify([...rows,record]));status.textContent='Protocollo validato registrato. Le cartelle già compilate restano invariate. È incluso nel backup ordinario di LUMEN.';
 }catch(e){status.textContent='Protocollo non registrato: '+e.message;}};
 document.addEventListener('lumen:cartella-applied',e=>{
  const d=e.detail||{};protectedRecord=Object.prototype.hasOwnProperty.call(d,'protocollo')||fields.some(id=>Object.prototype.hasOwnProperty.call(d,id));
  update();
 });
 for(const id of ['datore_lavoro','sede_lavoro','mansione','data_cartella','data_giudizio','cognome','nome'])document.getElementById(id).addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>update(),300);});
 update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
