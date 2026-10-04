/* Selezione di visite archiviate: nessuna nuova lista o riscrittura delle cartelle. */
(() => {
 'use strict';
 const api=window.lumenArchiveVisitsApi,cartelle=window.lumenBatchCertApi;
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const fmt=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):String(v||'');
 const localToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 function date(v){const s=String(v||'').trim(),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?[m[3],m[2],m[1]].join('-'):s}
 function visits(records,wanted){
  const found=new Map();
  for(const rec of records){
   const versions=[...(rec.history||[]).map(h=>({data:h.data,savedAt:h.savedAt})),{data:rec.data,savedAt:rec.updatedAt||rec.createdAt}];
   for(const v of versions){
    if(!v.data||date(v.data.data_giudizio||v.data.data_cartella)!==wanted)continue;
    const d={...v.data};if(d.data_giudizio)d.data_giudizio=date(d.data_giudizio);if(d.data_cartella)d.data_cartella=date(d.data_cartella);
    const key=cartelle.cartellaId(d),old=found.get(key),entry={id:key,data:d,savedAt:v.savedAt||''};
    if(!old||entry.savedAt>=old.savedAt)found.set(key,entry);
   }
  }
  return [...found.values()].sort((a,b)=>[a.data.cognome,a.data.nome,a.data.codice_fiscale].join(' ').localeCompare([b.data.cognome,b.data.nome,b.data.codice_fiscale].join(' '),'it'));
 }
 async function listPdf(rows,info){
  if(!window.jspdf?.jsPDF)throw Error('Modulo PDF non disponibile. Ricarica LUMEN con la connessione attiva.');
  const indicators=window.lumenArchiveReferti?await window.lumenArchiveReferti.statuses(rows):new Map();
  const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),xs=[14,22,66,104,146,170],widths=[8,44,38,42,24,26];let y;
  function header(){
   pdf.setTextColor(25,62,46);pdf.setFont('helvetica','bold');pdf.setFontSize(16);pdf.text('ELENCO VISITE EFFETTUATE',14,18);
   pdf.setTextColor(30);pdf.setFontSize(10);pdf.setFont('helvetica','normal');pdf.text('Data visita: '+fmt(info.data),14,27);
   const comm=pdf.splitTextToSize('Committente: '+(info.committente||'NON INDICATO'),182);pdf.text(comm,14,34);
   y=34+comm.length*4+5;pdf.setFontSize(9);pdf.text('Totale selezionato: '+rows.length+' | Ordine alfabetico',14,y);y+=6;
   pdf.setFontSize(8);pdf.text('Analisi / Drug test: presenza di referti allegati per questa visita, non esito degli esami.',14,y);y+=4;
   pdf.text('NO = nessun referto riconosciuto; DA VERIFICARE = allegato generico o dati insufficienti.',14,y);y+=5;pdf.setFontSize(9);
   pdf.setFillColor(231,240,234);pdf.rect(14,y,182,9,'F');pdf.setFont('helvetica','bold');['N.','COGNOME E NOME','AZIENDA','MANSIONE','ANALISI','DRUG TEST'].forEach((s,i)=>pdf.text(s,xs[i]+2,y+6));y+=9;
  }
  header();
  rows.forEach((r,i)=>{
   const d=r.data,flags=indicators.get(r.id)||{analisi:'DA VERIFICARE',drug:'DA VERIFICARE'},values=[String(i+1),[d.cognome,d.nome].filter(Boolean).join(' '),d.datore_lavoro||'',d.mansione||'',flags.analisi,flags.drug];
   pdf.setFont('helvetica','normal');pdf.setFontSize(9);const lines=values.map((s,j)=>pdf.splitTextToSize(s,widths[j]-4));const h=Math.max(...lines.map(x=>x.length),1)*4.6+5;
   if(h>200)throw Error('Un campo della cartella è troppo lungo per l’elenco: '+values[1]);
   if(y+h>263){pdf.addPage();header();pdf.setFont('helvetica','normal');pdf.setFontSize(9)}
   if(i%2===1){pdf.setFillColor(247,249,247);pdf.rect(14,y,182,h,'F')}
   lines.forEach((s,j)=>pdf.text(s,xs[j]+2,y+5));pdf.setDrawColor(210);pdf.line(14,y+h,196,y+h);y+=h;
  });
  if(y>243){pdf.addPage();header()}
  pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.text('Totale visite: '+rows.length,14,y+12);pdf.setFont('helvetica','normal');pdf.text('Dott. Claudio Beltrami',196,y+24,{align:'right'});
  const total=pdf.getNumberOfPages();for(let p=1;p<=total;p++){pdf.setPage(p);pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(90);pdf.text('Pagina '+p+' di '+total,196,285,{align:'right'})}
  return pdf;
 }
 const style=document.createElement('style');style.textContent=`#visiteArchiveDialog{box-sizing:border-box;width:min(1050px,calc(100vw - 20px));max-height:92vh;overflow:auto;border:2px solid #27834a;border-radius:12px;padding:18px;background:#fff;color:#222}#visiteArchiveDialog::backdrop{background:#0009}#visiteArchiveDialog .visit-controls{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}#visiteArchiveDialog label{display:flex;flex-direction:column;gap:4px;font-weight:bold;flex:1 1 180px}#visiteArchiveDialog input:not([type=checkbox]){min-height:42px;padding:6px;font-size:16px;box-sizing:border-box;max-width:100%}#visiteArchiveDialog table{width:100%;border-collapse:collapse;font-size:14px}#visiteArchiveDialog td,#visiteArchiveDialog th{padding:8px;border-bottom:1px solid #bbb;text-align:left;overflow-wrap:anywhere}#visiteArchiveDialog input[type=checkbox]{width:22px;height:22px}#visiteArchiveDialog .visit-table{overflow:auto}#visiteArchiveMessage{white-space:pre-line;font-weight:bold;margin:12px 0}#visiteArchiveDialog .visit-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}@media print{#visiteArchiveDialog{display:none!important}}`;document.head.appendChild(style);
 const dialog=document.createElement('dialog');dialog.id='visiteArchiveDialog';dialog.setAttribute('aria-labelledby','visiteArchiveTitle');dialog.innerHTML=`<div class="consent-head"><h3 id="visiteArchiveTitle">VISITE DALL’ARCHIVIO</h3><button type="button" id="visiteArchiveClose" class="secondary">CHIUDI</button></div><p>L’elenco mantiene la ricerca dell’archivio e usa la data effettiva della visita, anche nelle versioni storiche.</p><p id="visiteArchiveFilter"></p><div class="visit-controls"><label>DATA VISITA<input type="date" id="visiteArchiveDate"></label><label>COMMITTENTE (INTESTAZIONE)<input id="visiteArchiveClient" maxlength="100" placeholder="ES. SERMOLAB"></label><button type="button" id="visiteArchiveLoad" class="success">CARICA VISITE</button></div><div id="visiteArchiveMessage" role="status" aria-live="polite"></div><div class="visit-actions"><button type="button" id="visiteArchiveAll" class="secondary">SELEZIONA TUTTE</button><button type="button" id="visiteArchiveNone" class="secondary">DESELEZIONA TUTTE</button><button type="button" id="visiteArchivePdf" class="success">ELENCO PDF</button><button type="button" id="visiteArchiveCertificates" class="success">PREPARA CERTIFICATI</button></div><div id="visiteArchivePdfLink"></div><div class="visit-table" id="visiteArchiveRows"></div>`;document.body.appendChild(dialog);
 let entries=[],selected=new Set(),loadedDate='',archiveQuery='',busy=false,pdfUrl='',referti=new Map();
 function message(s){$('visiteArchiveMessage').textContent=s}
 function lock(value){busy=value;dialog.querySelectorAll('button,input').forEach(e=>e.disabled=value);if(!value){const none=!selected.size;$('visiteArchivePdf').disabled=none;$('visiteArchiveCertificates').disabled=none}}
 function count(){message(entries.length+' VISITE TROVATE — '+selected.size+' SELEZIONATE');lock(false)}
 function clearPdf(){if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl='';$('visiteArchivePdfLink').replaceChildren()}
 function render(){
  $('visiteArchiveRows').innerHTML=entries.length?'<table><thead><tr><th>Includi</th><th>Lavoratore</th><th>Azienda</th><th>Mansione</th><th>Analisi</th><th>Drug Test</th></tr></thead><tbody>'+entries.map((r,i)=>'<tr><td><input type="checkbox" aria-label="Seleziona '+esc([r.data.cognome,r.data.nome].join(' '))+'" data-row="'+i+'" '+(selected.has(r.id)?'checked':'')+'></td><td>'+esc([r.data.cognome,r.data.nome].join(' '))+'</td><td>'+esc(r.data.datore_lavoro)+'</td><td>'+esc(r.data.mansione)+'</td><td>'+esc(referti.get(r.id)?.analisi||'DA VERIFICARE')+'</td><td>'+esc(referti.get(r.id)?.drug||'DA VERIFICARE')+'</td></tr>').join('')+'</tbody></table>':'';
  dialog.querySelectorAll('[data-row]').forEach(e=>e.onchange=()=>{const id=entries[Number(e.dataset.row)].id;e.checked?selected.add(id):selected.delete(id);clearPdf();count()});count();
 }
 async function load(){
  if(busy)return;const wanted=$('visiteArchiveDate').value;entries=[];selected.clear();clearPdf();$('visiteArchiveRows').replaceChildren();
  if(!wanted){loadedDate='';count();message('Scegli la data della visita.');return}
  lock(true);message('LETTURA ARCHIVIO…');
  try{entries=visits(await api.list(archiveQuery),wanted);referti=window.lumenArchiveReferti?await window.lumenArchiveReferti.statuses(entries):new Map();loadedDate=wanted;selected=new Set(entries.map(r=>r.id));render()}catch(e){loadedDate='';message(e.message||String(e))}finally{lock(false)}
 }
 function selection(){if(busy)throw Error('Attendi il completamento.');if(!loadedDate||loadedDate!==$('visiteArchiveDate').value)throw Error('Premi CARICA VISITE per la data selezionata.');const rows=entries.filter(r=>selected.has(r.id));if(!rows.length)throw Error('Seleziona almeno una visita.');return rows}
 $('btnElencoVisiteArchivio').onclick=async()=>{
  archiveQuery=api.getFilter();
  $('visiteArchiveFilter').textContent=archiveQuery?'FILTRO ARCHIVIO: '+archiveQuery+' — Per cambiarlo, chiudi e modifica la ricerca nell’archivio.':'FILTRO ARCHIVIO: TUTTE LE CARTELLE';
  if(!$('visiteArchiveDate').value)$('visiteArchiveDate').value=localToday();
  dialog.showModal();await load();
 };
 $('visiteArchiveLoad').onclick=load;
 $('visiteArchiveDate').onchange=()=>{entries=[];selected.clear();loadedDate='';clearPdf();render();message('Premi CARICA VISITE per la nuova data.')};
 $('visiteArchiveClient').oninput=clearPdf;
 $('visiteArchiveAll').onclick=()=>{selected=new Set(entries.map(r=>r.id));clearPdf();render()};$('visiteArchiveNone').onclick=()=>{selected.clear();clearPdf();render()};
 function close(){if(!busy){dialog.close();$('btnElencoVisiteArchivio').focus()}}$('visiteArchiveClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 $('visiteArchivePdf').onclick=async()=>{
  try{
   const rows=selection(),comm=$('visiteArchiveClient').value.trim().toUpperCase();lock(true);message('PREPARAZIONE ELENCO PDF CON ANALISI E DRUG TEST…');const pdf=await listPdf(rows,{data:loadedDate,committente:comm});clearPdf();pdfUrl=URL.createObjectURL(pdf.output('blob'));
   const name='ELENCO_VISITE_'+loadedDate+'_'+(comm.replace(/[^A-Z0-9]+/g,'_')||'ARCHIVIO')+'_'+rows.length+'.pdf',a=document.createElement('a');a.href=pdfUrl;a.download=name;document.body.appendChild(a);a.click();a.remove();
   const link=document.createElement('a');link.href=pdfUrl;link.target='_blank';link.rel='noopener';link.textContent='APRI IL PDF PER STAMPARE';$('visiteArchivePdfLink').appendChild(link);message('ELENCO PDF PREPARATO: '+rows.length+' VISITE.\n'+name);
  }catch(e){message(e.message||String(e))}finally{lock(false)}
 };
 $('visiteArchiveCertificates').onclick=async()=>{
  try{
   const rows=selection(),comm=$('visiteArchiveClient').value.trim().toUpperCase();if(!comm)throw Error('Indica il committente prima di preparare i certificati.');
   const invalid=rows.filter(r=>!r.data.cognome||!r.data.nome||!r.data.giudizio||!r.data.datore_lavoro);
   if(invalid.length)throw Error('Completa prima nome, cognome, azienda e giudizio nelle cartelle di:\n'+invalid.map(r=>[r.data.cognome,r.data.nome].filter(Boolean).join(' ')||'LAVORATORE NON INDICATO').join('\n'));
   lock(true);message('PREPARAZIONE DI '+rows.length+' CERTIFICATI IN CORSO…');
   const result=await api.prepareCertificates({tipo:'LUMEN_ARCHIVE_CERTIFICATES_V1',session:{data:loadedDate,committente:comm,workers:rows.map(r=>({...r.data,visited:true})),esiti:{}},records:rows});
   if(result){dialog.close();$('archiveModal').classList.remove('show');$('saveInfo').scrollIntoView({block:'start'});}else message('PDF non creato. Controlla il messaggio e riprova.');
  }catch(e){message(e.message||String(e))}finally{lock(false)}
 };
 api.selectDate=visits;api.createListPdf=listPdf;
 lock(false);
})();
