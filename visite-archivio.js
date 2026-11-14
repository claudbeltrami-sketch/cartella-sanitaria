/* Selezione di visite archiviate: nessuna nuova lista o riscrittura delle cartelle. */
(() => {
 'use strict';
 const api=window.lumenArchiveVisitsApi,cartelle=window.lumenBatchCertApi;
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const fmt=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):String(v||'');
 const localToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 function date(v){const s=String(v||'').trim(),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?[m[3],m[2],m[1]].join('-'):s}
 function visitDay(d){return date(d?.data_giudizio||d?.data_cartella)}
 function visitsInPeriod(records,from,to=from){
  const found=new Map();
  for(const rec of records){
   const versions=[...(rec.history||[]).map(h=>({data:h.data,savedAt:h.savedAt})),{data:rec.data,savedAt:rec.updatedAt||rec.createdAt}];
   for(const v of versions){
    const day=visitDay(v.data);
    if(!v.data||!day||day<from||day>to)continue;
    const d=window.lumenRuoliAzienda.forRecord(rec,v.data);
    if(d.data_giudizio)d.data_giudizio=date(d.data_giudizio);
    if(d.data_cartella)d.data_cartella=date(d.data_cartella);
    const id=cartelle.cartellaId(d),visitKey=JSON.stringify([id,day]),old=found.get(visitKey);
    const entry={id,visitKey,visitDate:day,data:d,savedAt:v.savedAt||''};
    if(!old||entry.savedAt>=old.savedAt)found.set(visitKey,entry);
   }
  }
  return [...found.values()].sort((a,b)=>a.visitDate.localeCompare(b.visitDate)||
   [a.data.cognome,a.data.nome,a.data.codice_fiscale].join(' ').localeCompare([b.data.cognome,b.data.nome,b.data.codice_fiscale].join(' '),'it'));
 }
 function visits(records,wanted){return visitsInPeriod(records,wanted,wanted)}
 const visitKeyOf=r=>r.visitKey||JSON.stringify([r.id,visitDay(r.data)]);
 async function statusesByVisit(rows){
  const out=new Map();
  if(!window.lumenArchiveReferti)return out;
  const groups=new Map();
  for(const r of rows){if(!groups.has(r.id))groups.set(r.id,[]);groups.get(r.id).push(r)}
  const unique=[...groups.values()].filter(g=>g.length===1).map(g=>g[0]);
  if(unique.length){const found=await window.lumenArchiveReferti.statuses(unique);for(const r of unique)out.set(visitKeyOf(r),found.get(r.id))}
  for(const group of groups.values())if(group.length>1)for(const r of group){
   const found=await window.lumenArchiveReferti.statuses([r]);
   out.set(visitKeyOf(r),found.get(r.id));
  }
  return out;
 }
 function scope(){
  const mode=$('visiteArchiveMode').value;
  if(mode==='giorno'){
   const d=$('visiteArchiveDate').value;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw Error('Scegli la data della visita.');
   return {mode,from:d,to:d,label:fmt(d),stamp:d};
  }
  if(mode==='mese'){
   const v=$('visiteArchiveMonth').value;
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(v))throw Error('Scegli il mese.');
   const [y,m]=v.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();
   return {mode,from:v+'-01',to:v+'-'+String(last).padStart(2,'0'),label:new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1))),stamp:v};
  }
  if(mode==='anno'){
   const v=$('visiteArchiveYear').value;
   if(!/^(19|20|21)\d{2}$/.test(v))throw Error('Indica un anno valido.');
   return {mode,from:v+'-01-01',to:v+'-12-31',label:v,stamp:v};
  }
  const from=$('visiteArchiveFrom').value,to=$('visiteArchiveTo').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))throw Error('Indica entrambe le date DAL e AL.');
  if(from>to)throw Error('La data DAL non può essere successiva alla data AL.');
  return {mode:'intervallo',from,to,label:fmt(from)+' — '+fmt(to),stamp:from+'_'+to};
 }
 async function listPdf(rows,info){
  if(!window.jspdf?.jsPDF)throw Error('Modulo PDF non disponibile. Ricarica LUMEN con la connessione attiva.');
  const multiple=info.period?.mode&&info.period.mode!=='giorno';
  const indicators=await statusesByVisit(rows);
  const pdf=new window.jspdf.jsPDF({orientation:multiple?'landscape':'portrait',unit:'mm',format:'a4'});
  const xs=multiple?[14,23,65,91,139,184,222,248]:[14,22,60,90,122,156,177];
  const widths=multiple?[9,42,26,48,45,38,26,35]:[8,38,30,32,34,21,19];
  const printable=multiple?269:182,maxBodyY=multiple?177:263,pageBottom=multiple?198:285;
  let y;
  function header(){
   pdf.setTextColor(25,62,46);pdf.setFont('helvetica','bold');pdf.setFontSize(16);
   pdf.text('ELENCO VISITE EFFETTUATE',14,18);
   pdf.setTextColor(30);pdf.setFontSize(10);pdf.setFont('helvetica','normal');
   pdf.text((multiple?'Periodo visite: '+info.period.label:'Data visita: '+fmt(info.data)),14,27);
   const comm=pdf.splitTextToSize('Committente: '+(info.committente||'NON INDICATO'),printable);
   pdf.text(comm,14,34);y=34+comm.length*4+5;pdf.setFontSize(9);
   pdf.text('Totale selezionato: '+rows.length+(multiple?' | Ordine per data e cognome':' | Ordine alfabetico'),14,y);y+=6;
   pdf.setFontSize(8);pdf.text('Analisi / Drug test: presenza di referti allegati per questa visita, non esito degli esami.',14,y);y+=4;
   pdf.text('NO = nessun referto riconosciuto; DA VERIFICARE = allegato generico o dati insufficienti.',14,y);y+=5;pdf.setFontSize(9);
   pdf.setFillColor(231,240,234);pdf.rect(14,y,printable,12,'F');pdf.setFont('helvetica','bold');pdf.setFontSize(7);
   const heads=multiple?['N.','COGNOME E NOME','DATA VISITA','COMMITTENTE','DATORE DI LAVORO','MANSIONE','ANALISI','DRUG TEST']:['N.','COGNOME E NOME','COMMITTENTE','DATORE DI LAVORO','MANSIONE','ANALISI','DRUG TEST'];
   heads.forEach((t,i)=>pdf.text(pdf.splitTextToSize(t,widths[i]-3),xs[i]+1.5,y+4));y+=12;
  }
  header();
  rows.forEach((r,i)=>{
   const d=window.lumenRuoliAzienda.normalize(r.data),flags=indicators.get(visitKeyOf(r))||{analisi:'DA VERIFICARE',drug:'DA VERIFICARE'};
   const person=[d.cognome,d.nome].filter(Boolean).join(' ');
   const values=multiple?[String(i+1),person,fmt(visitDay(d)),d.committente||'NON INDICATO',d.datore_lavoro||'DA COMPLETARE',d.mansione||'',flags.analisi,flags.drug]:
    [String(i+1),person,d.committente||'NON INDICATO',d.datore_lavoro||'DA COMPLETARE',d.mansione||'',flags.analisi,flags.drug];
   pdf.setFont('helvetica','normal');pdf.setFontSize(7.5);
   const lines=values.map((v,j)=>pdf.splitTextToSize(v,widths[j]-4));
   const h=Math.max(...lines.map(x=>x.length),1)*4.6+5;
   if(h>(multiple?110:200))throw Error('Un campo della cartella è troppo lungo per l’elenco: '+person);
   if(y+h>maxBodyY){pdf.addPage();header();pdf.setFont('helvetica','normal');pdf.setFontSize(7.5)}
   if(i%2===1){pdf.setFillColor(247,249,247);pdf.rect(14,y,printable,h,'F')}
   lines.forEach((line,j)=>pdf.text(line,xs[j]+2,y+5));pdf.setDrawColor(210);pdf.line(14,y+h,14+printable,y+h);y+=h;
  });
  if(y>maxBodyY-20){pdf.addPage();header()}
  pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.text('Totale visite: '+rows.length,14,y+12);
  pdf.setFont('helvetica','normal');pdf.text('Dott. Claudio Beltrami',14+printable,y+24,{align:'right'});
  const total=pdf.getNumberOfPages();
  for(let p=1;p<=total;p++){pdf.setPage(p);pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(90);pdf.text('Pagina '+p+' di '+total,14+printable,pageBottom,{align:'right'})}
  return pdf;
 }
 const style=document.createElement('style');style.textContent=`#visiteArchiveDialog{box-sizing:border-box;width:min(1050px,calc(100vw - 20px));max-height:92vh;overflow:auto;border:2px solid #27834a;border-radius:12px;padding:18px;background:#fff;color:#222}#visiteArchiveDialog::backdrop{background:#0009}#visiteArchiveDialog [hidden]{display:none!important}#visiteArchiveDialog .visit-controls{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}#visiteArchiveDialog label{display:flex;flex-direction:column;gap:4px;font-weight:bold;flex:1 1 180px}#visiteArchiveDialog input:not([type=checkbox]),#visiteArchiveDialog select{min-height:42px;padding:6px;font-size:16px;box-sizing:border-box;max-width:100%}#visiteArchiveDialog table{width:100%;min-width:1080px;border-collapse:collapse;font-size:14px;table-layout:auto}#visiteArchiveDialog td,#visiteArchiveDialog th{padding:8px;border-bottom:1px solid #bbb;text-align:left;overflow-wrap:normal;word-break:normal;vertical-align:middle}#visiteArchiveDialog th{white-space:nowrap}#visiteArchiveDialog td:first-child,#visiteArchiveDialog th:first-child{min-width:62px;text-align:center}#visiteArchiveDialog td:nth-child(2){min-width:150px}#visiteArchiveDialog input[type=checkbox]{width:22px;height:22px}#visiteArchiveDialog .visit-table{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}#visiteArchiveMessage{white-space:pre-line;font-weight:bold;margin:12px 0}#visiteArchiveDialog .visit-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}@media print{#visiteArchiveDialog{display:none!important}}`;document.head.appendChild(style);
 const dialog=document.createElement('dialog');dialog.id='visiteArchiveDialog';dialog.setAttribute('aria-labelledby','visiteArchiveTitle');dialog.innerHTML=`<div class="consent-head"><h3 id="visiteArchiveTitle">VISITE DALL’ARCHIVIO</h3><button type="button" id="visiteArchiveClose" class="secondary">CHIUDI</button></div><p>L’elenco conserva i filtri dell’archivio e ricerca le date delle visite, comprese le versioni storiche. Mostra solo le visite già archiviate su questo dispositivo.</p><p id="visiteArchiveFilter"></p><div class="visit-controls"><label>RICERCA PER<select id="visiteArchiveMode"><option value="giorno">SINGOLO GIORNO</option><option value="mese">MESE</option><option value="anno">ANNO</option><option value="intervallo">DA / A</option></select></label><label id="visiteArchiveDayField">DATA VISITA<input type="date" id="visiteArchiveDate"></label><label id="visiteArchiveMonthField" hidden>MESE<input type="month" id="visiteArchiveMonth"></label><label id="visiteArchiveYearField" hidden>ANNO<input type="number" min="1900" max="2199" step="1" inputmode="numeric" id="visiteArchiveYear"></label><label id="visiteArchiveFromField" hidden>DAL<input type="date" id="visiteArchiveFrom"></label><label id="visiteArchiveToField" hidden>AL<input type="date" id="visiteArchiveTo"></label><label>FILTRA PER COMMITTENTE<input id="visiteArchiveClientFilter" list="committentiCartella" placeholder="TUTTI"></label><label>FILTRA PER DATORE DI LAVORO<input id="visiteArchiveEmployerFilter" placeholder="TUTTE LE AZIENDE"></label><label>COMMITTENTE NELL’ELENCO<input id="visiteArchiveClient" maxlength="100" placeholder="ES. SERMOLAB"></label><button type="button" id="visiteArchiveLoad" class="success">CARICA VISITE</button></div><div id="visiteArchiveMessage" role="status" aria-live="polite"></div><div class="visit-actions"><button type="button" id="visiteArchiveAll" class="secondary">SELEZIONA TUTTE</button><button type="button" id="visiteArchiveNone" class="secondary">DESELEZIONA TUTTE</button><button type="button" id="visiteArchivePdf" class="success">ELENCO PDF</button><button type="button" id="visiteArchiveCertificates" class="success">PREPARA CERTIFICATI</button></div><div id="visiteArchivePdfLink"></div><div class="visit-table" id="visiteArchiveRows"></div>`;document.body.appendChild(dialog);
 let entries=[],selected=new Set(),loadedScope=null,loadedRoles='',archiveQuery='',busy=false,pdfUrl='',referti=new Map(),periodCount=0,unassignedCount=0;
 function message(s){$('visiteArchiveMessage').textContent=s}
 function lock(value){busy=value;dialog.querySelectorAll('button,input,select').forEach(e=>e.disabled=value);if(!value){const none=!selected.size;$('visiteArchivePdf').disabled=none;$('visiteArchiveCertificates').disabled=none||loadedScope?.mode!=='giorno'}}
 function count(){
  let result=entries.length+' VISITE TROVATE — '+selected.size+' SELEZIONATE'+(loadedScope?.mode&&loadedScope.mode!=='giorno'?' — '+loadedScope.label.toUpperCase():'');
  if(!entries.length&&loadedScope?.mode&&loadedScope.mode!=='giorno'){
   result+='\n'+(periodCount
    ? 'Nel periodo risultano '+periodCount+' visite nell’archivio locale, ma nessuna corrisponde ai filtri. '+(unassignedCount?'Di queste, '+unassignedCount+' senza committente riconosciuto. ':'')+'Controlla i filtri e i dati del committente.'
    : 'Nessuna visita datata nel periodo nell’archivio di questo dispositivo. Le cartelle salvate soltanto su Mac o in un backup non ancora importato qui non sono comprese.');
  }
  message(result);lock(false);
 }
 function clearPdf(){if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl='';$('visiteArchivePdfLink').replaceChildren()}
 function render(){
  const multiple=loadedScope?.mode&&loadedScope.mode!=='giorno';
  $('visiteArchiveRows').innerHTML=entries.length?'<table><thead><tr><th>Includi</th><th>Lavoratore</th>'+(multiple?'<th>Data visita</th>':'')+'<th>Committente</th><th>Datore di lavoro</th><th>Mansione</th><th>Analisi</th><th>Drug Test</th></tr></thead><tbody>'+
   entries.map((r,i)=>'<tr><td><input type="checkbox" aria-label="Seleziona '+esc([r.data.cognome,r.data.nome].join(' '))+'" data-row="'+i+'" '+(selected.has(visitKeyOf(r))?'checked':'')+'></td><td>'+esc([r.data.cognome,r.data.nome].join(' '))+'</td>'+(multiple?'<td>'+esc(fmt(r.visitDate))+'</td>':'')+'<td>'+esc(r.data.committente||'NON INDICATO')+'</td><td>'+esc(r.data.datore_lavoro||'DA COMPLETARE')+'</td><td>'+esc(r.data.mansione)+'</td><td>'+esc(referti.get(visitKeyOf(r))?.analisi||'DA VERIFICARE')+'</td><td>'+esc(referti.get(visitKeyOf(r))?.drug||'DA VERIFICARE')+'</td></tr>').join('')+'</tbody></table>':'';
  dialog.querySelectorAll('[data-row]').forEach(e=>e.onchange=()=>{const key=visitKeyOf(entries[Number(e.dataset.row)]);e.checked?selected.add(key):selected.delete(key);clearPdf();count()});
  count();
 }
 function roleFilters(){return {committente:$('visiteArchiveClientFilter').value.trim(),datore_lavoro:$('visiteArchiveEmployerFilter').value.trim()}}
 async function load(){
  if(busy)return;
  let wanted;try{wanted=scope()}catch(e){loadedScope=null;entries=[];selected.clear();clearPdf();$('visiteArchiveRows').replaceChildren();lock(false);message(e.message);return}
  const roles=roleFilters();entries=[];selected.clear();loadedScope=null;periodCount=0;unassignedCount=0;clearPdf();$('visiteArchiveRows').replaceChildren();
  lock(true);message('LETTURA ARCHIVIO…');
  try{
   // A month/year/range is a new archive-wide query: the previous free-text
   // search often concerns a different worker or day and must not hide visits.
   // For a single day, preserve the established archive-filter behaviour.
   const records=await api.list(wanted.mode==='giorno'?archiveQuery:'');
   const inPeriod=visitsInPeriod(records,wanted.from,wanted.to);
   periodCount=inPeriod.length;
   unassignedCount=inPeriod.filter(r=>!r.data.committente).length;
   entries=inPeriod.filter(r=>window.lumenRuoliAzienda.matches(r.data,roles));
   loadedRoles=JSON.stringify(roles);
   const clients=[...new Set(entries.map(r=>r.data.committente||''))];
   $('visiteArchiveClient').value=clients.length===1&&clients[0]?clients[0]:'';
   referti=await statusesByVisit(entries);loadedScope=wanted;selected=new Set(entries.map(visitKeyOf));render();
  }catch(e){loadedScope=null;message(e.message||String(e))}
  finally{lock(false)}
 }
 function selection(){
  if(busy)throw Error('Attendi il completamento.');
  if(!loadedScope||JSON.stringify(loadedScope)!==JSON.stringify(scope())||loadedRoles!==JSON.stringify(roleFilters()))throw Error('Premi CARICA VISITE per il periodo selezionato.');
  const rows=entries.filter(r=>selected.has(visitKeyOf(r)));
  if(!rows.length)throw Error('Seleziona almeno una visita.');
  return rows;
 }
 $('btnElencoVisiteArchivio').onclick=async()=>{
  archiveQuery=api.getFilter();const roles=api.getRoleFilters?.()||{};$('visiteArchiveClientFilter').value=roles.committente||'';$('visiteArchiveEmployerFilter').value=roles.datore_lavoro||'';
  updateFilterNote();
  if(!$('visiteArchiveDate').value)$('visiteArchiveDate').value=localToday();
  if(!$('visiteArchiveMonth').value)$('visiteArchiveMonth').value=localToday().slice(0,7);
  if(!$('visiteArchiveYear').value)$('visiteArchiveYear').value=localToday().slice(0,4);
  if(!$('visiteArchiveFrom').value)$('visiteArchiveFrom').value=localToday();
  if(!$('visiteArchiveTo').value)$('visiteArchiveTo').value=localToday();
  showMode();
  dialog.showModal();await load();
 };
 $('visiteArchiveLoad').onclick=load;
 function invalidate(){entries=[];selected.clear();loadedScope=null;clearPdf();render();message('Premi CARICA VISITE per applicare periodo e filtri.')}
 function updateFilterNote(){
  const note=$('visiteArchiveFilter');
  note.textContent=$('visiteArchiveMode').value==='giorno'
   ? (archiveQuery?'FILTRO ARCHIVIO: '+archiveQuery+' — Per cambiarlo, chiudi e modifica la ricerca nell’archivio.':'FILTRO ARCHIVIO: TUTTE LE CARTELLE')
   : 'RICERCA SU TUTTE LE CARTELLE LOCALI: il filtro testuale precedente dell’archivio non limita il periodo. Si applicano soltanto i filtri per committente e datore di lavoro qui indicati.';
 }
 function showMode(){
  const mode=$('visiteArchiveMode').value;
  for(const [field,value] of [['visiteArchiveDayField','giorno'],['visiteArchiveMonthField','mese'],['visiteArchiveYearField','anno'],['visiteArchiveFromField','intervallo'],['visiteArchiveToField','intervallo']])$(field).hidden=mode!==value;
  updateFilterNote();
 }
 $('visiteArchiveMode').onchange=()=>{showMode();invalidate()};
 for(const id of ['visiteArchiveDate','visiteArchiveMonth','visiteArchiveYear','visiteArchiveFrom','visiteArchiveTo'])$(id).onchange=invalidate;
 ['visiteArchiveClientFilter','visiteArchiveEmployerFilter'].forEach(id=>$(id).oninput=invalidate);
 $('visiteArchiveClient').oninput=clearPdf;
 $('visiteArchiveAll').onclick=()=>{selected=new Set(entries.map(visitKeyOf));clearPdf();render()};$('visiteArchiveNone').onclick=()=>{selected.clear();clearPdf();render()};
 function close(){if(!busy){dialog.close();$('btnElencoVisiteArchivio').focus()}}$('visiteArchiveClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 $('visiteArchivePdf').onclick=async()=>{
  try{
   const rows=selection(),comm=$('visiteArchiveClient').value.trim().toUpperCase();if(comm&&rows.some(r=>r.data.committente&&window.lumenRuoliAzienda.client(r.data.committente)!==window.lumenRuoliAzienda.client(comm)))throw Error('L’intestazione non corrisponde ai committenti selezionati. Usa il filtro per committente o lascia vuota l’intestazione del PDF.');lock(true);message('PREPARAZIONE ELENCO PDF CON ANALISI E DRUG TEST…');const pdf=await listPdf(rows,{data:loadedScope.from,period:loadedScope,committente:comm});clearPdf();pdfUrl=URL.createObjectURL(pdf.output('blob'));
   const name='ELENCO_VISITE_'+loadedScope.stamp+'_'+(comm.replace(/[^A-Z0-9]+/g,'_')||'ARCHIVIO')+'_'+rows.length+'.pdf',a=document.createElement('a');a.href=pdfUrl;a.download=name;document.body.appendChild(a);a.click();a.remove();
   const link=document.createElement('a');link.href=pdfUrl;link.target='_blank';link.rel='noopener';link.textContent='APRI IL PDF PER STAMPARE';$('visiteArchivePdfLink').appendChild(link);message('ELENCO PDF PREPARATO: '+rows.length+' VISITE.\n'+name);
  }catch(e){message(e.message||String(e))}finally{lock(false)}
 };
 $('visiteArchiveCertificates').onclick=async()=>{
  try{
   const rows=selection(),comm=$('visiteArchiveClient').value.trim().toUpperCase();if(comm&&rows.some(r=>r.data.committente&&window.lumenRuoliAzienda.client(r.data.committente)!==window.lumenRuoliAzienda.client(comm)))throw Error('L’intestazione non corrisponde ai committenti selezionati. Usa il filtro per committente o lascia vuota l’intestazione del PDF.');if(loadedScope.mode!=='giorno')throw Error('Prepara i certificati scegliendo una singola data.');if(!comm)throw Error('Indica il committente prima di preparare i certificati.');
   const invalid=rows.filter(r=>!r.data.cognome||!r.data.nome||!r.data.giudizio||!r.data.datore_lavoro);
   if(invalid.length)throw Error('Completa prima nome, cognome, azienda e giudizio nelle cartelle di:\n'+invalid.map(r=>[r.data.cognome,r.data.nome].filter(Boolean).join(' ')||'LAVORATORE NON INDICATO').join('\n'));
   lock(true);message('PREPARAZIONE DI '+rows.length+' CERTIFICATI IN CORSO…');
   const result=await api.prepareCertificates({tipo:'LUMEN_ARCHIVE_CERTIFICATES_V1',session:{data:loadedScope.from,committente:comm,workers:rows.map(r=>({...r.data,visited:true})),esiti:{}},records:rows});
   if(result){dialog.close();$('archiveModal').classList.remove('show');$('saveInfo').scrollIntoView({block:'start'});}else message('PDF non creato. Controlla il messaggio e riprova.');
  }catch(e){message(e.message||String(e))}finally{lock(false)}
 };
 api.selectDate=visits;api.selectPeriod=visitsInPeriod;api.createListPdf=listPdf;
 lock(false);
})();
