/* LUMEN: copia manuale del giudizio da una visita realmente precedente.
 * Nessuna modifica dell'archivio e nessuna copia automatica.
 * Funziona anche offline usando l'archivio locale sul dispositivo.
 */
(function(){
'use strict';
function boot(){
 const form=document.getElementById('cartellaForm');
 const section=document.getElementById('giudizi');
 const api=window.lumenArchiveVisitsApi;
 if(!form||!section||!api||document.getElementById('lumenCopiaGiudizio'))return;
 const anchor=section.previousElementSibling;
 const wrap=document.createElement('div');
 wrap.id='lumenCopiaGiudizio';
 wrap.className='no-print';
 wrap.hidden=true;
 const button=document.createElement('button');
 button.type='button';
 button.textContent='COPIA GIUDIZIO PRECEDENTE';
 button.className='secondary';
 const status=document.createElement('span');
 status.setAttribute('role','status');
 status.style.cssText='display:block;margin-top:6px;color:#364a5e;font-size:12px';
 const review=document.createElement('button');review.type='button';review.textContent='RECUPERA GIUDIZIO DAL PDF PRECEDENTE';review.hidden=true;
 review.addEventListener('click',async()=>{
  review.disabled=true;
  try{
   const current=identity();
   await window.lumenStoricoCartaceo.reviewPrevious({cognome:current.cognome,nome:current.nome,data_nascita:current.nascita,codice_fiscale:current.cf,data_giudizio:current.visita});
  }catch(e){window.alert(e.message||String(e))}finally{review.disabled=false}
 });
 wrap.append(button,review,status);
 if(anchor&&anchor.classList.contains('section-title'))anchor.after(wrap);else section.before(wrap);
 const css=document.createElement('style');
 css.textContent='#lumenCopiaGiudizio{margin:8px 0 12px;padding:10px;border:1px solid #9bb0c4;border-radius:8px;background:#eef5fa}#lumenCopiaGiudizio button[hidden]{display:none!important}#lumenCopiaGiudizio[hidden]{display:none!important}#lumenCopiaGiudizio button{width:100%;max-width:450px;min-height:43px}@media print{#lumenCopiaGiudizio{display:none!important}}';
 document.head.append(css);
 const $=id=>document.getElementById(id);
 const read=id=>String($(id)?.value||'').trim();
 const norm=v=>String(v||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
 const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):'';
 const allowed=new Set([...document.querySelectorAll('input[name="giudizio"]')].map(e=>e.value));
 const identity=()=>({cf:norm(read('codice_fiscale')),cognome:norm(read('cognome')),nome:norm(read('nome')),nascita:read('data_nascita'),visita:date(read('data_giudizio')||read('data_cartella')),azienda:norm(read('datore_lavoro')),mansione:norm(read('mansione'))});
 const stamp=x=>JSON.stringify(x);
 const samePerson=(rec,d,current)=>{
  const cf=norm(d.codice_fiscale||rec.cf),cognome=norm(d.cognome||rec.cognome),nome=norm(d.nome||rec.nome),nascita=d.data_nascita||rec.dataNascita||'';
  if(!current.cognome||!current.nome)return false;
  if(cognome&&cognome!==current.cognome||nome&&nome!==current.nome)return false;
  if(current.nascita&&nascita&&nascita!==current.nascita)return false;
  if(current.cf&&cf)return current.cf===cf;
  // Without an exact CF, surname, name and date of birth must all agree.
  return !!(cognome&&nome&&current.nascita&&nascita&&cognome===current.cognome&&nome===current.nome&&current.nascita===nascita);
 };
 function previous(records,current,originals=[]){
  if(!current.visita||!current.cognome||!current.nome||(!current.cf&&!current.nascita))return null;
  const candidates=[];
  for(const rec of records){
   if(!rec||typeof rec!=='object')continue;
   const versions=[{data:rec.data,savedAt:rec.updatedAt||''},...(Array.isArray(rec.history)?rec.history:[])];
   for(const v of versions){
    const d=v?.data;
    if(!d||!samePerson(rec,d,current))continue;
    const visit=date(d.data_giudizio||d.data_cartella);
    if(!visit||visit>=current.visita||!allowed.has(String(d.giudizio||'')))continue;
    candidates.push({data:d,visit,savedAt:String(v.savedAt||''),source:'cartella'});
   }
  }
  // Include only historical PDF judgments explicitly transcribed and verified by a doctor.
  const historic=window.lumenStoricoCartaceo;
  for(const row of originals){
   if(!historic?.verifiedJudgment||!row||!date(row.visit)||row.visit>=current.visita)continue;
   const j=historic.verifiedJudgment(row);
   if(!j||!allowed.has(j.giudizio))continue;
   candidates.push({
    data:{...j,datore_lavoro:row.storicoCartaceo?.azienda||'',mansione:''},
    visit:row.visit,savedAt:j.verificatoIl,source:'pdf',sourceId:row.id,sourceHash:row.hash
   });
  }
  candidates.sort((a,b)=>b.visit.localeCompare(a.visit)||
    (a.source==='cartella'?-1:1)-(b.source==='cartella'?-1:1)||
    b.savedAt.localeCompare(a.savedAt));
  return candidates[0]||null;
 }
 async function lookupPrevious(current){
  const records=await api.list();
  let originals=[];
  const historic=window.lumenStoricoCartaceo,store=window.lumenAllegatiStorage;
  if(historic?.precedenti&&store?.list){
   try{
    originals=historic.precedenti(await store.list(),{
     cognome:current.cognome,nome:current.nome,data_nascita:current.nascita,
     codice_fiscale:current.cf,data_giudizio:current.visita
    });
   }catch(_){ /* Keep existing structured-chart judgment discovery available. */ }
  }
  let candidate=previous(records,current,originals),reason='';
  const latest=originals[0];
  if(latest&&(!candidate||latest.visit>candidate.visit)&&window.lumenGiudizioPdfAuto){
   candidate=null; // Never silently substitute an older judgment when the latest PDF is unreadable.
   try{
    const extracted=await window.lumenGiudizioPdfAuto.extract(latest);
    if(extracted.ok){
     const {giudizio,prescrizioni,periodicita,periodicita_altro,evidence}=extracted;
     candidate={data:{giudizio,prescrizioni,periodicita,periodicita_altro,datore_lavoro:latest.storicoCartaceo?.azienda||''},visit:latest.visit,source:'pdf-auto',sourceId:latest.id,sourceHash:latest.hash,evidence};
    }else reason=extracted.reason;
   }catch(e){reason=e.message||String(e)}
  }
  return {candidate,hasPdf:originals.length>0,reason};
 }
 let candidate=null,request=0,timer=0;
 function show(c,hasPdf=false,reason=''){
  candidate=c;
  wrap.hidden=!c&&!hasPdf;
  button.hidden=!c;
  review.hidden=!hasPdf||!!c;
  status.textContent=c?'Precedente del '+c.visit.split('-').reverse().join('/')+
    (c.source==='pdf-auto'?' · giudizio letto automaticamente dal PDF: controlla la proposta':c.source==='pdf'?' · giudizio verificato e collegato al PDF':' · visita elettronica collegata automaticamente')+
    '. Il medico deve rivalutarlo prima del salvataggio.':
    hasPdf?'PDF della visita precedente collegato automaticamente. Premi RECUPERA GIUDIZIO DAL PDF PRECEDENTE per consultarlo. '+(reason?reason+' ':'')+'È richiesta una verifica soltanto dove la lettura automatica non è riuscita.':'';
 }
 async function refresh(){
  const token=++request,initial=identity();
  if(!initial.visita||!initial.cognome||!initial.nome||(!initial.cf&&!initial.nascita)){show(null);return;}
  try{
   wrap.hidden=false;button.hidden=true;review.hidden=true;
   status.textContent='LETTURA AUTOMATICA DEL GIUDIZIO PRECEDENTE…';
   const found=await lookupPrevious(initial);
   if(token!==request||stamp(initial)!==stamp(identity()))return;
   show(found.candidate,found.hasPdf,found.reason);
  }catch(_){if(token===request){show(null);}}
 }
 function schedule(){clearTimeout(timer);show(null);timer=setTimeout(refresh,250);}
 button.addEventListener('click',async()=>{
  if(button.disabled)return;
  const start=identity();
  const c=candidate;
  if(!c||!start.visita||c.visit>=start.visita)return;
  button.disabled=true;
  try{
   // Re-read the source immediately before copying: never trust a stale selection.
   const current=(await lookupPrevious(start)).candidate;
   if(stamp(start)!==stamp(identity()))throw Error('Lavoratore o visita cambiati. Riprova.');
   if(!current||current.visit!==c.visit||current.source!==c.source||current.sourceId!==c.sourceId||current.sourceHash!==c.sourceHash||stamp(current.data)!==stamp(c.data))throw Error('Il giudizio precedente è cambiato. Riprova.');
   const d=current.data;
   const period=String(d.periodicita||''),other=String(d.periodicita_altro||'');
   if(period&&![...$('periodicita').options].some(x=>x.value===period))throw Error('Periodicità storica non riconosciuta: controllare la vecchia cartella.');
   const next={giudizio:String(d.giudizio),prescrizioni:String(d.prescrizioni||''),periodicita:period,periodicita_altro:other};
   const old={giudizio:document.querySelector('input[name="giudizio"]:checked')?.value||'',prescrizioni:read('prescrizioni'),periodicita:read('periodicita'),periodicita_altro:read('periodicita_altro')};
   const changed=Object.keys(old).some(k=>old[k]!==next[k]);
   const conflicts=Object.values(old).some(v=>!!v)&&changed;
   const differentJob=!!(d.mansione&&norm(d.mansione)!==start.mansione||d.datore_lavoro&&norm(d.datore_lavoro)!==start.azienda);
   const preview='GIUDIZIO DEL '+current.visit.split('-').reverse().join('/')+(current.source==='pdf-auto'?' (LETTURA AUTOMATICA DEL PDF, DA VERIFICARE)':current.source==='pdf'?' (TRASCRITTO DA PDF STORICO)':'')+'\n\n'+next.giudizio+
    '\nPrescrizioni / limitazioni: '+(next.prescrizioni||'NESSUNA')+
    '\nPeriodicità: '+(next.periodicita||'NON INDICATA')+(other?' — '+other:'')+
    (differentJob?'\n\nATTENZIONE: datore di lavoro o mansione diversi dalla visita attuale.':'')+
    (conflicts?'\n\nATTENZIONE: i campi di giudizio già compilati verranno sostituiti.':'')+
    (current.source==='pdf-auto'?'\n\nLettura automatica: confronta giudizio e testo delle prescrizioni con il PDF originale. Pagine: '+current.evidence.map(x=>x.page).join(', '):'')+
    '\n\nCopiare SOLO questi campi nella visita attuale? Date, firme, esami e altri dati non saranno copiati. Verifica clinica obbligatoria.';
   if(!window.confirm(preview))return;
   if(stamp(start)!==stamp(identity()))throw Error('Lavoratore o visita cambiati. Nessun dato copiato.');
   const checkboxes=[...document.querySelectorAll('input[name="giudizio"]')];
   for(const e of checkboxes)e.checked=e.value===next.giudizio;
   for(const id of ['prescrizioni','periodicita','periodicita_altro'])$(id).value=next[id];
   for(const e of [...checkboxes,...['prescrizioni','periodicita','periodicita_altro'].map($)])
    e.dispatchEvent(new Event('change',{bubbles:true}));
   status.textContent='COPIATO dal '+current.visit.split('-').reverse().join('/')+'. Modifica e verifica il giudizio; per conservarlo premi SALVA CARTELLA.';
   window.lumenCopiaGiudizioUltimaFonte=current.visit;
  }catch(e){window.alert('GIUDIZIO NON COPIATO.\n'+(e.message||String(e)));schedule();}
  finally{button.disabled=false;}
 });
 for(const id of ['cognome','nome','data_nascita','codice_fiscale','data_cartella','data_giudizio']){
  const field=$(id);if(field){field.addEventListener('input',schedule);field.addEventListener('change',schedule);}
 }
 document.addEventListener('lumen:cartella-applied',schedule);
 document.addEventListener('lumen:giudizio-storico-verificato',schedule);
 document.addEventListener('lumen:precedenti-aggiornati',schedule);
 form.addEventListener('reset',()=>setTimeout(schedule,0));
 schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
