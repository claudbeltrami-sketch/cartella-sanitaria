/* Read-only schedule projection. Dates are explicit medical decisions, never
   inferred from annual defaults. Clinical data remains in the local archive. */
(function(root){
 'use strict';
 const norm=v=>String(v??'').trim().toUpperCase().replace(/\s+/g,' ');
 function day(value){
  let s=String(value||'').trim(),m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m)s=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '';
  const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s?s:'';
 }
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 const fmt=s=>day(s)?day(s).split('-').reverse().join('/'):'DA COMPLETARE';
 const delta=(a,b)=>(Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000;
 function build(records,reference=today()){
  if(!day(reference))throw Error('Data di riferimento non valida.');
  const groups=new Map();let unassigned=0;
  for(const rec of records){
   const versions=[...(rec.history||[]).map(h=>({data:h.data,saved:h.savedAt||''})),{data:rec.data,saved:rec.updatedAt||rec.createdAt||''}];
   for(const [i,v] of versions.entries()){
    if(!v.data||v.data.lumen_prova)continue;
    const d=root.lumenRuoliAzienda.forRecord(rec,v.data),client=root.lumenRuoliAzienda.client(d.committente);
    if(!['SERMOLAB','GRUPPO ORIZZONTE'].includes(client)){if(i===versions.length-1&&!client)unassigned++;continue;}
    const cf=norm(d.codice_fiscale||rec.cf),birth=day(d.data_nascita||rec.dataNascita),name=norm([d.cognome||rec.cognome,d.nome||rec.nome].filter(Boolean).join(' '));
    const identity=cf?'CF:'+cf:birth&&name?'ANAG:'+name+'|'+birth:'RECORD:'+rec.id;
    const key=JSON.stringify([identity,client,norm(d.datore_lavoro)]);
    const last=day(d.data_giudizio||d.data_cartella),next=day(d.prossima_visita);
    const row={key,id:rec.id,name,cf,client,employer:d.datore_lavoro||'',site:d.luogo_visita||'',last,next,saved:String(v.saved),revision:i,
     ceased:norm(d.stato_rapporto)==='CESSATO'||d.cessato===true,issues:[]};
    if(!last)row.issues.push('Data ultima visita mancante o non valida');
    if(!next)row.issues.push('Prossima visita mancante o non valida');
    if(last&&next&&next<last)row.issues.push('Prossima visita precedente all’ultima');
    if(!cf&&!(birth&&name))row.issues.push('Identità incompleta');
    if(!norm(d.datore_lavoro))row.issues.push('Azienda da completare');
    if(!norm(d.giudizio))row.issues.push('Giudizio da completare');
    const old=groups.get(key);
    // A newer undated revision blocks reminders until reviewed. Otherwise use
    // the clinical date, so an old visit imported today cannot replace a renewal.
    const replace=!old||(!last||!old.last?row.saved>old.saved||row.saved===old.saved&&i>=old.revision:
     last>old.last||last===old.last&&(row.saved>old.saved||row.saved===old.saved&&i>=old.revision));
    if(replace)groups.set(key,row);
   }
  }
  const rows=[...groups.values()];
  for(const r of rows){r.days=r.next?delta(r.next,reference):null;r.status=r.ceased?'CESSATO':r.issues.length?'DA COMPLETARE':r.days<0?'SCADUTO':r.days===0?'OGGI':'PROGRAMMATO';}
  rows.sort((a,b)=>(a.next||'9999').localeCompare(b.next||'9999')||a.name.localeCompare(b.name,'it'));
  return {rows,unassigned,reference};
 }
 function filter(rows,f={}){
  const has=(v,q)=>norm(v).includes(norm(q));
  return rows.filter(r=>has(r.client,f.client)&&has(r.employer,f.employer)&&has(r.site,f.site)&&has(r.name+' '+r.cf,f.search)&&
   (f.range==='ceased'?r.ceased:!r.ceased&&(f.range==='missing'?r.status==='DA COMPLETARE':f.range==='all'?true:
    r.status!=='DA COMPLETARE'&&(f.range==='overdue'?r.days<0:r.days>=0&&r.days<=Number(f.range||90)))));
 }
 async function pdf(rows,caption,reference){
  const lib=root.PDFLib;if(!lib)throw Error('Modulo PDF non disponibile. Ricarica LUMEN.');
  const doc=await lib.PDFDocument.create({updateMetadata:false}),font=await doc.embedFont(lib.StandardFonts.Helvetica),bold=await doc.embedFont(lib.StandardFonts.HelveticaBold);
  const size=8,widths=[128,80,100,82,61,70,82,159],headers=['LAVORATORE / CF','COMMITTENTE','AZIENDA','SEDE VISITA','ULTIMA VISITA','PROSSIMA','GIORNI / STATO','DA VERIFICARE'];
  const wrap=(value,w,f=font,s=size)=>{
   const text=String(value||'—').replace(/[\r\n]+/g,' ');f.encodeText(text);const result=[];let line='';
   for(const word of text.split(/ +/)){
    const candidate=line?line+' '+word:word;
    if(f.widthOfTextAtSize(candidate,s)<=w-8){line=candidate;continue;}
    if(line){result.push(line);line='';}
    for(const char of word){if(line&&f.widthOfTextAtSize(line+char,s)>w-8){result.push(line);line='';}line+=char;}
   }result.push(line);return result;
  };
  let page,y;const write=(str,x,top,f=font,s=size)=>page.drawText(str,{x,y:595.28-top-s,size:s,font:f,color:lib.rgb(.1,.14,.12)});
  function header(){page=doc.addPage([841.89,595.28]);y=24;write('SCADENZARIO VISITE — ORIZZONTE / SERMOLAB',24,y,bold,15);y+=24;
   for(const line of wrap('Al '+fmt(reference)+' | '+caption,790,font,9)){write(line,24,y,font,9);y+=12;}
   write('Solo dati salvati su questo dispositivo. Cessati esclusi dalle convocazioni. Nessuna scadenza presunta.',24,y,font,9);y+=20;
   let x=24;headers.forEach((s,i)=>{wrap(s,widths[i],bold,7).forEach((line,k)=>write(line,x+3,y+k*9,bold,7));x+=widths[i]});y+=26;
  }
  header();
  for(const r of rows){const cells=[r.name+' / '+(r.cf||'CF MANCANTE'),r.client,r.employer,r.site,fmt(r.last),fmt(r.next),(r.days===null?'':r.days+' / ')+r.status,r.issues.join('; ')||'—'];
   const lines=cells.map((s,i)=>wrap(s,widths[i])),h=Math.max(...lines.map(a=>a.length))*11+10;
   if(h>430)throw Error('Un campo è troppo lungo per l’elenco PDF: '+r.name);
   if(y+h>554)header();let x=24;lines.forEach((ls,i)=>{ls.forEach((line,k)=>write(line,x+3,y+4+k*11));x+=widths[i]});y+=h;
   page.drawLine({start:{x:24,y:595.28-y},end:{x:806,y:595.28-y},thickness:.4,color:lib.rgb(.75,.8,.76)});
  }
  const pages=doc.getPages();pages.forEach((p,i)=>{page=p;write('Totale: '+rows.length+' | Pagina '+(i+1)+' di '+pages.length,24,573,font,9)});
  return new Blob([await doc.save()],{type:'application/pdf'});
 }
 root.lumenScadenzario={day,build,filter,pdf};
 if(!root.document)return;
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const style=document.createElement('style');style.textContent=`#scadenzarioDialog{box-sizing:border-box;width:min(1200px,calc(100vw - 20px));max-height:92vh;overflow:auto;padding:20px;border:2px solid #27834a;border-radius:12px;background:white;color:#222}#scadenzarioDialog::backdrop{background:#0009}#scadenzarioDialog .sc-controls{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}#scadenzarioDialog label{display:flex;flex:1 1 170px;flex-direction:column;gap:5px;font-weight:bold}#scadenzarioDialog input,#scadenzarioDialog select{box-sizing:border-box;width:100%;padding:8px;font-size:16px;min-height:42px}#scadenzarioDialog table{border-collapse:collapse;width:100%;min-width:960px;font-size:14px}#scadenzarioDialog td,#scadenzarioDialog th{text-align:left;padding:9px;border-bottom:1px solid #ccc;max-width:200px;overflow-wrap:anywhere}#scadenzarioDialog tr[data-status=SCADUTO]{background:#fff0ed}#scadenzarioDialog tr[data-status="DA COMPLETARE"]{background:#fff8dc}#scMessage{white-space:pre-line}#scadenzarioDialog .sc-table{overflow:auto}@media print{#scadenzarioDialog{display:none!important}}`;document.head.append(style);
 const dialog=document.createElement('dialog');dialog.id='scadenzarioDialog';dialog.setAttribute('aria-labelledby','scTitle');dialog.innerHTML=`<div class="consent-head"><h3 id="scTitle">SCADENZARIO VISITE</h3><button id="scClose" type="button" class="secondary">CHIUDI</button></div><p>Orizzonte e Sermolab • Ultima visita per lavoratore e azienda • Archivio locale del dispositivo</p><p>Le date mancanti sono da completare nella cartella, alla voce <b>Prossima visita</b>, e salvare. La periodicità non genera date presunte. Le nomine restano nel Controllo nomine.</p><div class="sc-controls"><label>Periodo<select id="scRange"><option value="overdue">SCADUTI</option><option value="30">ENTRO 30 GIORNI</option><option value="60">ENTRO 60 GIORNI</option><option value="90">ENTRO 90 GIORNI</option><option value="missing">DA COMPLETARE</option><option value="all" selected>TUTTI GLI ATTIVI</option><option value="ceased">CESSATI (SOLO CONSULTAZIONE)</option></select></label><label>Committente<select id="scClient"><option value="">ENTRAMBI</option>SERMOLAB</option><option>GRUPPO ORIZZONTE</option></select></label><label>Azienda<input id="scEmployer" placeholder="TUTTE LE AZIENDE"></label><label>Sede di visita<input id="scSite" placeholder="TUTTE LE SEDI"></label><label>Lavoratore / CF<input id="scSearch"></label></div><div class="sc-controls"><button id="scReload" type="button">AGGIORNA DALL’ARCHIVIO</button><button id="scPdf" type="button" class="success">ELENCO PDF</button></div><p id="scMessage" role="status" aria-live="polite"></p><div id="scLink"></div><div class="sc-table" id="scRows"></div>`;document.body.append(dialog);
 let snapshot={rows:[],unassigned:0,reference:today()},shown=[],url='',busy=false;
 const filters=()=>({range:$('scRange').value,client:$('scClient').value,employer:$('scEmployer').value,site:$('scSite').value,search:$('scSearch').value});
 function clearLink(){if(url)URL.revokeObjectURL(url);url='';$('scLink').replaceChildren();}
 function render(){clearLink();shown=filter(snapshot.rows,filters());const active=snapshot.rows.filter(r=>!r.ceased),valid=active.filter(r=>!r.issues.length);
  $('scMessage').textContent=`Al ${fmt(snapshot.reference)} — Visualizzati: ${shown.length}\nScaduti: ${valid.filter(r=>r.days<0).length} • Entro 30 giorni: ${valid.filter(r=>r.days>=0&&r.days<=30).length} • Da completare: ${active.filter(r=>r.issues.length).length} • Cessati esclusi: ${snapshot.rows.filter(r=>r.ceased).length}`+(snapshot.unassigned?`\n${snapshot.unassigned} cartelle senza committente: escluse finché non assegnate.`:'');
  $('scRows').innerHTML=shown.length?'<table><thead><tr>'+['Lavoratore / CF','Committente','Azienda','Sede visita','Ultima visita','Prossima visita','Giorni','Stato / Da verificare'].map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'+shown.map(r=>'<tr data-status="'+r.status+'">'+[r.name+' / '+(r.cf||'CF MANCANTE'),r.client,r.employer||'DA COMPLETARE',r.site||'NON INDICATA',fmt(r.last),fmt(r.next),r.days??'—',r.status+(r.issues.length?' — '+r.issues.join('; '):'')].map(t=>'<td>'+esc(t)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p>Nessuna voce per questi filtri. Controlla anche DA COMPLETARE.</p>';
  $('scPdf').disabled=busy||!shown.length;
 }
 function lock(value){busy=value;dialog.querySelectorAll('button,input,select').forEach(e=>e.disabled=value);if(!value)$('scPdf').disabled=!shown.length;}
 async function load(){if(busy)return;lock(true);clearLink();$('scMessage').textContent='LETTURA ARCHIVIO…';try{snapshot=build(await root.lumenArchiveVisitsApi.list());render();}catch(e){snapshot={rows:[],unassigned:0,reference:today()};shown=[];$('scRows').replaceChildren();$('scMessage').textContent='Scadenzario non caricato: '+e.message;}finally{lock(false);}}
 $('btnScadenzario').onclick=async()=>{dialog.showModal();await load()};$('scReload').onclick=load;
 function close(){if(!busy){clearLink();dialog.close();$('btnScadenzario').focus()}}
 $('scClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 for(const id of ['scRange','scClient','scEmployer','scSite','scSearch'])$(id).addEventListener('input',render);
 $('scPdf').onclick=async()=>{if(busy||!shown.length)return;lock(true);try{clearLink();const f=filters(),caption=[$('scRange').selectedOptions[0].textContent,f.client,f.employer&&'Azienda: '+f.employer,f.site&&'Sede: '+f.site,f.search&&'Ricerca: '+f.search].filter(Boolean).join(' | ');const blob=await pdf(shown,caption,snapshot.reference);url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='SCADENZARIO_'+snapshot.reference+'.pdf';a.click();const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent='APRI IL PDF PER STAMPARE';$('scLink').append(link);}catch(e){$('scMessage').textContent='PDF non creato: '+e.message;}finally{lock(false)}};
})(typeof window==='undefined'?globalThis:window);
