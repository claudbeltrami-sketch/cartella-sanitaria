/* Local read-only schedule: explicit due date or recorded periodicity. */
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
 function deadline(d,last){
  if(norm(d.prossima_visita))return {next:day(d.prossima_visita),source:'Data esplicita nel giudizio'};
  const p=norm(norm(d.periodicita)==='ALTRO'?d.periodicita_altro:d.periodicita);
  const months={MENSILE:1,BIMESTRALE:2,TRIMESTRALE:3,QUADRIMESTRALE:4,SEMESTRALE:6,ANNUALE:12,BIENNALE:24,TRIENNALE:36,QUADRIENNALE:48,QUINQUENNALE:60};
  let n=months[p],days=0;const match=p.match(/^(?:OGNI |TRA )?(\d{1,3})\s*(MESE|MESI|ANNO|ANNI|GIORNO|GIORNI)$/);
  if(!n&&match){const value=Number(match[1]);if(/ANN/.test(match[2]))n=value*12;else if(/MES/.test(match[2]))n=value;else days=value;}
  if(!last||!(n>0||days>0)||n>120||days>3660)return {next:'',source:''};
  const date=new Date(last+'T12:00:00Z');
  if(days)date.setUTCDate(date.getUTCDate()+days);
  else{const original=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+n);const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(original,end));}
  return {next:date.toISOString().slice(0,10),source:'Calcolata da periodicità: '+p};
 }
 function sameWorker(a,b){
  const ac=norm(a.codice_fiscale),bc=norm(b.codice_fiscale);if(ac&&bc)return ac===bc;
  const ad=day(a.data_nascita),bd=day(b.data_nascita);
  return !!(ad&&bd&&ad===bd&&norm(a.cognome)&&norm(a.nome)&&norm(a.cognome)===norm(b.cognome)&&norm(a.nome)===norm(b.nome));
 }
 function localSessions(){
  const storage=root.lumenStorage?.local;if(!storage)return [];
  const read=(key,fallback)=>{try{return JSON.parse(storage.getItem(key)||'null')||fallback}catch{return fallback}};
  const history=read('beltrami_v9_sessioni',[]),sessions=Array.isArray(history)?history.slice():[];
  const active=read('beltrami_v9_sessione_attiva',null);
  if(active)sessions.push({...active,workers:active.workers||read('beltrami_workers_v8',{}).workers||[],esiti:active.esiti||read('beltrami_v9_esiti',{})});
  for(const list of root.lumenCambiaLista?.getLists?.()||[])if(list.session)sessions.push({...list.session,workers:list.workers||list.session.workers||[],esiti:list.esiti||list.session.esiti||{}});
  return sessions;
 }
 function recover(rec,source,sessions){
  const d=root.lumenRuoliAzienda.forRecord(rec,source),visit=day(d.data_giudizio||d.data_cartella),candidates=[];
  if(!visit)return {data:d,siteSource:'',siteWarning:'Sede non recuperabile senza data visita'};
  const identity={...d,codice_fiscale:d.codice_fiscale||rec.cf,data_nascita:d.data_nascita||rec.dataNascita,cognome:d.cognome||rec.cognome,nome:d.nome||rec.nome};
  const add=(client,company,site,from)=>{const roles=root.lumenRuoliAzienda.normalize({committente:client,datore_lavoro:company});candidates.push({client:root.lumenRuoliAzienda.client(roles.committente),company:norm(roles.datore_lavoro),site:norm(site),from});};
  const count=rec.conteggioVisits?.[visit];
  if(count&&day(count.date)===visit)add(count.client,count.company,count.place,'Conteggio della stessa visita');
  for(const s of sessions){
   if(day(s.data)!==visit||!Array.isArray(s.workers))continue;
   s.workers.forEach((w,i)=>{if(!sameWorker(identity,w))return;const status=norm(s.esiti?.[String(w.id||w.codice_fiscale||i)]);if(status==='ASSENTE')return;
    add(w.committente||s.committente,w.datore_lavoro||s.azienda,s.sede,'Sessione/lista della stessa visita');});
  }
  let matches=candidates.filter(c=>(!d.committente||c.client===root.lumenRuoliAzienda.client(d.committente))&&(!norm(d.datore_lavoro)||!c.company||c.company===norm(d.datore_lavoro)));
  if(!d.committente){const clients=[...new Set(matches.map(c=>c.client).filter(Boolean))];if(clients.length===1)d.committente=clients[0];}
  matches=matches.filter(c=>c.client===root.lumenRuoliAzienda.client(d.committente));
  if(!norm(d.datore_lavoro)){const companies=[...new Set(matches.map(c=>c.company).filter(Boolean))];if(companies.length===1)d.datore_lavoro=companies[0];}
  matches=matches.filter(c=>!c.company||c.company===norm(d.datore_lavoro));
  if(norm(d.luogo_visita))return {data:d,siteSource:'Cartella',siteWarning:''};
  for(const v of [rec.data,...(rec.history||[]).map(h=>h.data)]){
   if(!v||day(v.data_giudizio||v.data_cartella)!==visit||!norm(v.luogo_visita))continue;
   const old=root.lumenRuoliAzienda.forRecord(rec,v);
   if(root.lumenRuoliAzienda.client(old.committente)===root.lumenRuoliAzienda.client(d.committente)&&norm(old.datore_lavoro)===norm(d.datore_lavoro))matches.push({site:norm(old.luogo_visita),from:'Storico della stessa visita'});
  }
  const sites=[...new Set(matches.map(c=>c.site).filter(Boolean))];
  if(sites.length===1)return {data:{...d,luogo_visita:sites[0]},siteSource:matches.find(c=>c.site===sites[0]).from,siteWarning:''};
  return {data:d,siteSource:'',siteWarning:sites.length>1?'Sede ambigua: '+sites.join(' / '):'Sede non presente nelle fonti salvate'};
 }
 function build(records,reference=today(),sessions=[]){
  if(!day(reference))throw Error('Data di riferimento non valida.');
  const groups=new Map();let unassigned=0;
  for(const rec of records){
   const versions=[...(rec.history||[]).map(h=>({data:h.data,saved:h.savedAt||''})),{data:rec.data,saved:rec.updatedAt||rec.createdAt||''}];
   for(const [i,v] of versions.entries()){
    if(!v.data||v.data.lumen_prova)continue;
    const recovered=recover(rec,v.data,sessions),d=recovered.data,client=root.lumenRuoliAzienda.client(d.committente);
    if(!['SERMOLAB','GRUPPO ORIZZONTE'].includes(client)){if(i===versions.length-1&&!client)unassigned++;continue;}
    const cf=norm(d.codice_fiscale||rec.cf),birth=day(d.data_nascita||rec.dataNascita),name=norm([d.cognome||rec.cognome,d.nome||rec.nome].filter(Boolean).join(' '));
    const identity=cf?'CF:'+cf:birth&&name?'ANAG:'+name+'|'+birth:'RECORD:'+rec.id;
    const key=JSON.stringify([identity,client,norm(d.datore_lavoro)]);
    const last=day(d.data_giudizio||d.data_cartella),due=deadline(d,last),next=due.next;
    const row={key,id:rec.id,name,cf,client,employer:d.datore_lavoro||'',site:d.luogo_visita||'',last,next,saved:String(v.saved),revision:i,
     sourceJson:JSON.stringify(v.data),dateSource:due.source,siteSource:recovered.siteSource,siteWarning:recovered.siteWarning,
     ceased:norm(d.stato_rapporto)==='CESSATO'||d.cessato===true,issues:[],warnings:[]};
    if(!last)row.issues.push('Data ultima visita mancante o non valida');
    if(!next)row.issues.push('Data esplicita o periodicità mancante/non interpretabile');
    if(last&&next&&next<last)row.issues.push('Prossima visita precedente all’ultima');
    if(!cf&&!(birth&&name))row.issues.push('Identità incompleta');
    if(!norm(d.datore_lavoro))row.warnings.push('Azienda da completare');
    if(recovered.siteWarning)row.warnings.push(recovered.siteWarning);

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
 async function saveDate(row,value,sessions=localSessions()){
  const next=day(value);if(!next)throw Error('Inserisci una data valida.');
  if(!row.last||next<row.last)throw Error('La prossima visita non può precedere la visita effettuata.');
  let saved=false;
  await root.lumenConteggioStorage.change(row.id,rec=>{
   const fresh=build([rec],today(),sessions).rows.find(r=>r.key===row.key);
   if(!fresh||fresh.last!==row.last||fresh.sourceJson!==row.sourceJson)throw Error('La cartella è cambiata. Aggiorna lo scadenzario prima di salvare.');
   const history=Array.isArray(rec.history)?rec.history:[],current=fresh.revision===history.length;
   const original=current?rec.data:history[fresh.revision]?.data;
   if(!original||JSON.stringify(original)!==row.sourceJson)throw Error('Visita non più disponibile: aggiorna lo scadenzario.');
   const now=new Date().toISOString(),updated={...original,prossima_visita:next};
   if(current){history.push({savedAt:rec.updatedAt||rec.createdAt||now,data:original});rec.data=updated;rec.updatedAt=now;}
   else history.push({savedAt:now,data:updated});
   rec.history=history.slice(-25);saved=true;
  });
  if(!saved)throw Error('Cartella non trovata: data non salvata.');
  // Keep an open form for this same visit in sync without replacing its other edits.
  const api=root.lumenBatchCertApi,field=root.document?.getElementById('prossima_visita');
  if(api&&field){const current=api.collect(),original=JSON.parse(row.sourceJson);
   if(sameWorker(current,original)&&day(current.data_giudizio||current.data_cartella)===row.last&&norm(current.datore_lavoro)===norm(original.datore_lavoro)&&field.value===(original.prossima_visita||''))field.value=next;
  }
  return next;
 }
 function filter(rows,f={}){
  const has=(v,q)=>norm(v).includes(norm(q));
  return rows.filter(r=>has(r.client,f.client)&&has(r.employer,f.employer)&&has(r.site,f.site)&&has(r.name+' '+r.cf,f.search)&&
   (f.range==='ceased'?r.ceased:!r.ceased&&(f.range==='missing'?r.status==='DA COMPLETARE':f.range==='all'?true:
    r.status!=='DA COMPLETARE'&&(f.range==='overdue'?r.days<0:r.days>=0&&r.days<=Number(f.range||90)))));
 }
 async function pdf(rows,caption,reference,selectedClient=''){
  const clients=[...new Set(rows.map(r=>r.client))],heading=selectedClient||(clients.length===1?clients[0]:'ORIZZONTE / SERMOLAB');
  const lib=root.PDFLib;if(!lib)throw Error('Modulo PDF non disponibile. Ricarica LUMEN.');
  const doc=await lib.PDFDocument.create({updateMetadata:false}),font=await doc.embedFont(lib.StandardFonts.Helvetica),bold=await doc.embedFont(lib.StandardFonts.HelveticaBold);
  const size=8,widths=[128,80,100,82,61,70,82,159],headers=['LAVORATORE / CF','COMMITTENTE','AZIENDA','SEDE VISITA','ULTIMA VISITA','PROSSIMA','GIORNI / STATO','NOTE / FONTI'];
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
  function header(){page=doc.addPage([841.89,595.28]);y=24;write('SCADENZARIO VISITE — '+heading,24,y,bold,15);y+=24;
   for(const line of wrap('Al '+fmt(reference)+' | '+caption,790,font,9)){write(line,24,y,font,9);y+=12;}
   write('Solo dati salvati su questo dispositivo. Cessati esclusi dalle convocazioni. Scadenze da data esplicita o periodicità registrata.',24,y,font,9);y+=20;
   let x=24;headers.forEach((s,i)=>{wrap(s,widths[i],bold,7).forEach((line,k)=>write(line,x+3,y+k*9,bold,7));x+=widths[i]});y+=26;
  }
  header();
  for(const r of rows){const cells=[r.name+' / '+(r.cf||'CF MANCANTE'),r.client,r.employer,r.site,fmt(r.last),fmt(r.next),(r.days===null?'':r.days+' / ')+r.status,[...r.issues,...(r.warnings||[]),r.dateSource,r.site&&r.siteSource&&'Luogo: '+r.site+' (fonte: '+r.siteSource+')'].filter(Boolean).join('; ')||'—'];
   const lines=cells.map((s,i)=>wrap(s,widths[i])),h=Math.max(...lines.map(a=>a.length))*11+10;
   if(h>430)throw Error('Un campo è troppo lungo per l’elenco PDF: '+r.name);
   if(y+h>554)header();let x=24;lines.forEach((ls,i)=>{ls.forEach((line,k)=>write(line,x+3,y+4+k*11));x+=widths[i]});y+=h;
   page.drawLine({start:{x:24,y:595.28-y},end:{x:806,y:595.28-y},thickness:.4,color:lib.rgb(.75,.8,.76)});
  }
  const pages=doc.getPages();pages.forEach((p,i)=>{page=p;write('Totale: '+rows.length+' | Pagina '+(i+1)+' di '+pages.length,24,573,font,9)});
  return new Blob([await doc.save()],{type:'application/pdf'});
 }
 root.lumenScadenzario={day,deadline,recover,localSessions,build,filter,pdf,saveDate};
 if(!root.document)return;
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const style=document.createElement('style');style.textContent=`#scadenzarioDialog{box-sizing:border-box;width:min(1200px,calc(100vw - 20px));max-height:92vh;overflow:auto;padding:20px;border:2px solid #27834a;border-radius:12px;background:white;color:#222}#scadenzarioDialog::backdrop{background:#0009}#scadenzarioDialog .sc-controls{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}#scadenzarioDialog label{display:flex;flex:1 1 170px;flex-direction:column;gap:5px;font-weight:bold}#scadenzarioDialog input,#scadenzarioDialog select{box-sizing:border-box;width:100%;padding:8px;font-size:16px;min-height:42px}#scadenzarioDialog table{border-collapse:collapse;width:100%;min-width:960px;font-size:14px}#scadenzarioDialog td,#scadenzarioDialog th{text-align:left;padding:9px;border-bottom:1px solid #ccc;max-width:200px;overflow-wrap:anywhere}#scadenzarioDialog tr[data-status=SCADUTO]{background:#fff0ed}#scadenzarioDialog tr[data-status="DA COMPLETARE"]{background:#fff8dc}#scMessage{white-space:pre-line}#scadenzarioDialog .sc-table{overflow:auto}@media(max-width:700px){#scadenzarioDialog .sc-table{overflow:visible}#scadenzarioDialog table,#scadenzarioDialog tbody{display:block;min-width:0;width:100%}#scadenzarioDialog thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}#scadenzarioDialog tbody tr{display:block;border:1px solid #aaa;border-radius:8px;margin:12px 0;padding:6px}#scadenzarioDialog td{display:grid;grid-template-columns:105px minmax(0,1fr);gap:8px;max-width:none;padding:8px 4px}#scadenzarioDialog td:before{content:attr(data-label);font-weight:bold}#scadenzarioDialog .sc-value{min-width:0}#scadenzarioDialog td small{display:block}}@media print{#scadenzarioDialog{display:none!important}}`;document.head.append(style);
 const dialog=document.createElement('dialog');dialog.id='scadenzarioDialog';dialog.setAttribute('aria-labelledby','scTitle');dialog.innerHTML=`<div class="consent-head"><h3 id="scTitle">SCADENZARIO VISITE</h3><button id="scClose" type="button" class="secondary">CHIUDI</button></div><p id="scScope"></p><p>La prossima scadenza usa la data esplicita oppure la data della visita più la periodicità registrata. Le sedi mancanti si recuperano dalle fonti della stessa visita. La data proposta è modificabile: premi SALVA DATA sulla riga per conservarla nella cartella.</p><div class="sc-controls"><label>Periodo<select id="scRange"><option value="overdue">SCADUTI</option><option value="30">ENTRO 30 GIORNI</option><option value="60">ENTRO 60 GIORNI</option><option value="90">ENTRO 90 GIORNI</option><option value="missing">DA COMPLETARE</option><option value="all" selected>TUTTI GLI ATTIVI</option><option value="ceased">CESSATI (SOLO CONSULTAZIONE)</option></select></label><label>Committente<select id="scClient"><option value="">ENTRAMBI</option><option value="SERMOLAB">SERMOLAB</option><option>GRUPPO ORIZZONTE</option></select></label><label>Azienda<input id="scEmployer" placeholder="TUTTE LE AZIENDE"></label><label>Sede di visita<input id="scSite" placeholder="TUTTE LE SEDI"></label><label>Lavoratore / CF<input id="scSearch"></label></div><div class="sc-controls"><button id="scReload" type="button">AGGIORNA DALL’ARCHIVIO</button><button id="scPdf" type="button" class="success">ELENCO PDF</button></div><p id="scMessage" role="status" aria-live="polite"></p><div id="scLink"></div><div class="sc-table" id="scRows"></div>`;document.body.append(dialog);
 let snapshot={rows:[],unassigned:0,reference:today()},shown=[],url='',busy=false;
 const filters=()=>({range:$('scRange').value,client:$('scClient').value,employer:$('scEmployer').value,site:$('scSite').value,search:$('scSearch').value});
 function clearLink(){if(url)URL.revokeObjectURL(url);url='';$('scLink').replaceChildren();}
 function render(){clearLink();const f=filters();shown=filter(snapshot.rows,f);const active=filter(snapshot.rows,{...f,range:'all'}),valid=active.filter(r=>!r.issues.length),ceased=filter(snapshot.rows,{...f,range:'ceased'});
  $('scTitle').textContent='SCADENZARIO VISITE — '+(f.client||'ORIZZONTE / SERMOLAB');$('scScope').textContent='Ultima visita per lavoratore e azienda • Riepilogo riferito ai filtri selezionati • Archivio locale del dispositivo';
  $('scMessage').textContent=`Al ${fmt(snapshot.reference)} — Visualizzati: ${shown.length}\nScaduti: ${valid.filter(r=>r.days<0).length} • Entro 30 giorni: ${valid.filter(r=>r.days>=0&&r.days<=30).length} • Da completare: ${active.filter(r=>r.issues.length).length} • Sedi da verificare: ${active.filter(r=>r.siteWarning).length} • Cessati esclusi: ${ceased.length}`+(!f.client&&snapshot.unassigned?`\n${snapshot.unassigned} cartelle senza committente: escluse finché non assegnate.`:'');
  $('scRows').innerHTML=shown.length?'<table><thead><tr>'+['Lavoratore / CF','Committente','Azienda','Sede visita','Ultima visita','Prossima visita','Giorni','Stato / Da verificare'].map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'+shown.map((r,i)=>'<tr data-status="'+r.status+'">'+[r.name+' / '+(r.cf||'CF MANCANTE'),r.client,r.employer||'DA COMPLETARE',r.site||'NON INDICATA',fmt(r.last),fmt(r.next)+(r.dateSource?' — '+r.dateSource:''),r.days??'—',[r.status,...r.issues,...r.warnings,r.site&&r.siteSource&&'Luogo: '+r.site+' (fonte: '+r.siteSource+')'].filter(Boolean).join(' — ')].map((t,j)=>'<td data-label="'+['Lavoratore / CF','Committente','Azienda','Luogo della visita','Ultima visita','Prossima visita','Giorni','Stato / Note'][j]+'"><div class="sc-value">'+(j===5?'<input type="date" data-sc-date="'+i+'" aria-label="Prossima visita di '+esc(r.name)+'" value="'+esc(r.next)+'" min="'+esc(r.last)+'"><small>'+esc(r.dateSource||'Data da indicare')+'</small><button type="button" data-sc-save="'+i+'">SALVA DATA</button>':esc(t))+'</div></td>').join('')+'</tr>').join('')+'</tbody></table>':'<p>Nessuna voce per questi filtri. Controlla anche DA COMPLETARE.</p>';
  dialog.querySelectorAll('[data-sc-save]').forEach(button=>button.onclick=async()=>{
   const index=Number(button.dataset.scSave),row=shown[index],value=dialog.querySelector('[data-sc-date="'+index+'"]').value;
   lock(true);clearLink();try{await saveDate(row,value);lock(false);await load();$('scMessage').textContent+='\nData salvata per '+row.name+': '+fmt(value);}
   catch(e){$('scMessage').textContent='Data non salvata: '+e.message;}finally{lock(false);}
  });
  $('scPdf').disabled=busy||!shown.length;
 }
 function lock(value){busy=value;dialog.querySelectorAll('button,input,select').forEach(e=>e.disabled=value);if(!value)$('scPdf').disabled=!shown.length;}
 async function load(){if(busy)return;lock(true);clearLink();$('scMessage').textContent='LETTURA ARCHIVIO…';try{snapshot=build(await root.lumenArchiveVisitsApi.list(),today(),localSessions());render();}catch(e){snapshot={rows:[],unassigned:0,reference:today()};shown=[];$('scRows').replaceChildren();$('scMessage').textContent='Scadenzario non caricato: '+e.message;}finally{lock(false);}}
 $('btnScadenzario').onclick=async()=>{dialog.showModal();await load()};$('scReload').onclick=load;
 function close(){if(!busy){clearLink();dialog.close();$('btnScadenzario').focus()}}
 $('scClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 for(const id of ['scRange','scClient','scEmployer','scSite','scSearch'])$(id).addEventListener('input',render);
 $('scPdf').onclick=async()=>{if(busy||!shown.length)return;lock(true);try{clearLink();const f=filters(),caption=[$('scRange').selectedOptions[0].textContent,f.client,f.employer&&'Azienda: '+f.employer,f.site&&'Sede: '+f.site,f.search&&'Ricerca: '+f.search].filter(Boolean).join(' | ');const blob=await pdf(shown,caption,snapshot.reference,f.client);url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='SCADENZARIO_'+(f.client?f.client.replace(/ /g,'_')+'_':'')+snapshot.reference+'.pdf';a.click();const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent='APRI IL PDF PER STAMPARE';$('scLink').append(link);}catch(e){$('scMessage').textContent='PDF non creato: '+e.message;}finally{lock(false)}};
})(typeof window==='undefined'?globalThis:window);
