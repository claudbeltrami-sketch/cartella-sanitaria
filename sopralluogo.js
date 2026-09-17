'use strict';
(() => {
const $ = id => document.getElementById(id);
const KEY = 'lumen_sopralluoghi_firme_v1', PHONE_KEY = 'lumen_sopralluogo_firme_telefono_v1';
const uuid = () => crypto.randomUUID();
const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const upper = s => String(s||'').trim().toLocaleUpperCase('it-IT');
const label = n => n.replaceAll('_',' ').toLocaleUpperCase('it-IT');
const DATE_FIELDS = ['data_sopralluogo','data_di_redazione'];
const ROLES = {datore:['DATORE DI LAVORO / DELEGATO','datore_di_lavoro_delegato_presente'],rspp:['RSPP','rspp_presente'],rls:['RLS / RLST','rls_rlst_presente']};
const sections={ragione_sociale:'1. AZIENDA E SOPRALLUOGO',datore_di_lavoro_delegato_presente:'2. PARTECIPANTI',documenti_esaminati_data_revisione_e_documenti_da_acquisire:'3. DOCUMENTAZIONE E ATTIVITÀ OSSERVATE',condizioni_degli_ambienti_e_delle_postazioni:'4. AMBIENTI, RISCHI E MISURE DI PREVENZIONE',reparto_e_rilievo_evidenza:'5. RILIEVI E INDICAZIONI OPERATIVE',conclusioni_del_medico_competente:'6. CONCLUSIONI E SEGUITO'};
let state,dirty=false,pdfUrl=null,pdfFile=null,phoneRequest=null,phonePacket=null,activeRequest=null,hasInk=false,drawing=false;
const status=(msg,error=false)=>{ $('status').textContent=msg; $('status').className='status'+(error?' error':''); };
function newState(){return {type:'LUMEN_SOPRALLUOGO_FIRME',version:1,id:uuid(),revision:uuid(),fields:{},extra:[],signatures:{},pending:{},includeDoctor:false};}
function controls(){return Array.from($('report').querySelectorAll('[name]'));}
function collect(){state.fields=Object.fromEntries(controls().map(e=>[e.name,upper(e.value)]));state.includeDoctor=$('includeDoctor').checked;return state;}
function locked(){return Object.keys(state.signatures).length>0||Object.keys(state.pending).length>0;}
function signatureImage(s){return typeof s==='string'&&s.length<400000&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(s);}
function validate(d){
 if(!d||d.type!=='LUMEN_SOPRALLUOGO_FIRME'||d.version!==1||typeof d.id!=='string'||typeof d.revision!=='string'||!d.fields||Array.isArray(d.fields)||Object.values(d.fields).some(x=>typeof x!=='string'||x.length>20000)||!Array.isArray(d.extra)||d.extra.length>24||typeof d.includeDoctor!=='boolean'||!d.signatures||!d.pending||Array.isArray(d.signatures)||Array.isArray(d.pending))throw Error('File relazione non valido.');
 const ids=new Set(Object.keys(ROLES));for(const x of d.extra){if(!x||typeof x.id!=='string'||ids.has(x.id)||typeof x.name!=='string'||typeof x.role!=='string')throw Error('Presenti non validi.');ids.add(x.id);}
 for(const [k,s] of Object.entries(d.signatures)){if(!ids.has(k)||!s||!signatureImage(s.png)||s.reportId!==d.id||s.revision!==d.revision)throw Error('Firma non associata a questa relazione.');}
 for(const [k,r] of Object.entries(d.pending)){if(!ids.has(k)||r.reportId!==d.id||r.revision!==d.revision)throw Error('Richiesta firma non valida.');}
 return d;
}
function archive(){const a=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(a))throw Error('Archivio non leggibile. Esporta i dati della relazione aperta.');return a.map(validate);}
function save(){
 try{collect();if(!state.fields.ragione_sociale||!state.fields.data_sopralluogo)throw Error('Compila RAGIONE SOCIALE e DATA SOPRALLUOGO.');
 const list=archive(),copy=JSON.parse(JSON.stringify(state));copy.savedAt=new Date().toISOString();const i=list.findIndex(x=>x.id===copy.id);if(i<0)list.push(copy);else list[i]=copy;
 const raw=JSON.stringify(list);localStorage.setItem(KEY,raw);if(localStorage.getItem(KEY)!==raw)throw Error('Verifica del salvataggio non riuscita.');dirty=false;status(`RELAZIONE E FIRME SALVATE · ${state.fields.ragione_sociale} · ${new Date().toLocaleTimeString('it-IT')}`);return true;
 }catch(e){status('Salvataggio non riuscito: '+e.message+' Usa ESPORTA DATI per conservare una copia.',true);return false;}
}
function invalidatePdf(){if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl=null;pdfFile=null;$('downloadPanel').hidden=true;}
function onChange(){dirty=true;invalidatePdf();status('Modifiche da salvare.');}
function people(){return [...Object.entries(ROLES).map(([id,[role,field]])=>({id,role,name:upper($(field).value)})),...state.extra];}
function renderSigners(){
 const isLocked=locked();controls().forEach(e=>e.readOnly=isLocked||e.name==='medico_competente');$('edit').hidden=!isLocked;$('addSigner').disabled=isLocked;
 const box=$('signers');box.replaceChildren();
 for(const p of people()){
  const row=document.createElement('div');row.className='signer';const h=document.createElement('h3');h.textContent=p.role+' · '+(p.name||'NOME DA COMPILARE');row.append(h);
  if(!ROLES[p.id]){for(const [key,title] of [['name','NOME E COGNOME'],['role','RUOLO']]){const l=document.createElement('label');l.textContent=title;const i=document.createElement('input');i.value=p[key];i.readOnly=isLocked;i.oninput=()=>{p[key]=upper(i.value);onChange();};i.onchange=renderSigners;l.append(i);row.append(l);}}
  const signature=state.signatures[p.id];if(signature){const img=document.createElement('img');img.src=signature.png;img.alt='Firma di '+p.name;img.className='signature-preview';row.append(img);const note=document.createElement('p');note.textContent='FIRMA ACQUISITA';row.append(note);}
  const bar=document.createElement('div');bar.className='toolbar';
  for(const [text,kind] of [['FIRMA QUI','direct'],['FIRMA SU IPHONE','qr']]){const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=!p.name||!!signature;b.onclick=()=>requestSignature(p.id,kind).catch(e=>status(e.message,true));bar.append(b);}
  if(signature||state.pending[p.id]){const b=document.createElement('button');b.textContent=signature?'ANNULLA FIRMA':'ANNULLA RICHIESTA';b.className='secondary';b.onclick=()=>{if(!confirm('Annullare la firma o la richiesta di questo presente?'))return;delete state.signatures[p.id];delete state.pending[p.id];onChange();renderSigners();save();};bar.append(b);}
  if(state.pending[p.id]&&!signature){const note=document.createElement('p');note.textContent='IN ATTESA DEL FILE FIRMATO';row.append(note);}
  if(!ROLES[p.id]&&!isLocked){const b=document.createElement('button');b.textContent='RIMUOVI PRESENTE';b.className='secondary';b.onclick=()=>{state.extra=state.extra.filter(x=>x.id!==p.id);onChange();renderSigners();};bar.append(b);}
  row.append(bar);box.append(row);
 }
}
function load(d){state=validate(JSON.parse(JSON.stringify(d)));controls().forEach(e=>e.value=state.fields[e.name]||'');$('includeDoctor').checked=state.includeDoctor;renderDoctor();dirty=false;invalidatePdf();renderSigners();$('archivePanel').hidden=true;}
function canReplace(){return !dirty||confirm('Ci sono modifiche non salvate. Sostituire la relazione aperta?');}
async function digest(){collect();const canonical=JSON.stringify([state.id,state.revision,REPORT_FIELDS.map(f=>state.fields[f.name]||''),state.extra.map(p=>[p.id,p.name,p.role])]);const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function encode(d){return btoa(Array.from(new TextEncoder().encode(JSON.stringify(d)),b=>String.fromCharCode(b)).join(''));}
function decode(s){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0))));}
function validateRequest(r){if(!r||r.type!=='LUMEN_SOPRALLUOGO_RICHIESTA_FIRMA'||r.version!==1||['requestId','reportId','revision','digest','personId','name','role','company','date'].some(k=>typeof r[k]!=='string'||!r[k]||r[k].length>400)||!/^[a-f0-9]{64}$/.test(r.digest))throw Error('Richiesta firma non valida.');return r;}
function summary(r){return `${r.name} — ${r.role}. ${r.company} · SOPRALLUOGO DEL ${r.date.split('-').reverse().join('/')}`;}
async function requestSignature(id,kind){
 collect();const p=people().find(p=>p.id===id);if(!p?.name)throw Error('Compila il nome del presente.');if(!save())return;
 const hash=await digest();const old=state.pending[id];const r=old?.digest===hash?old:{type:'LUMEN_SOPRALLUOGO_RICHIESTA_FIRMA',version:1,requestId:uuid(),reportId:state.id,revision:state.revision,digest:hash,personId:id,name:p.name,role:p.role,company:state.fields.ragione_sociale,date:state.fields.data_sopralluogo};
 validateRequest(r);state.pending[id]=r;dirty=true;renderSigners();if(!save())return;
 if(kind==='direct'){openPad(r);return;}
 const url=new URL('sopralluogo.html',location.href);url.hash='firma='+encode(r);const qr=new ReportQR(-1,1);qr.addData(url.href);qr.make();const count=qr.getModuleCount(),scale=6,c=$('qrCanvas');c.width=c.height=(count+8)*scale;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#000';for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))ctx.fillRect((x+4)*scale,(y+4)*scale,scale,scale);
 $('qrSummary').textContent=summary(r);$('qrLink').href=url.href;$('qrDialog').showModal();
}
async function acceptSignature(packet){
 if(!packet||packet.type!=='LUMEN_SOPRALLUOGO_FIRMA'||packet.version!==1||!signatureImage(packet.png))throw Error('File firma non valido.');
 const r=state.pending[packet.personId];if(!r)throw Error('Nessuna richiesta corrispondente. Apri la relazione corretta e usa il file generato dal suo QR.');
 for(const k of ['requestId','reportId','revision','digest','personId','name','role','company','date'])if(packet[k]!==r[k])throw Error('La firma appartiene a un’altra relazione, revisione o persona.');
 if(await digest()!==r.digest)throw Error('La relazione è cambiata: serve una nuova firma.');
 await checkImage(packet.png);state.signatures[packet.personId]=packet;delete state.pending[packet.personId];dirty=true;invalidatePdf();renderSigners();return save();
}
function checkImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.width<=2000&&img.height<=1000?resolve():reject(Error('Dimensioni firma non valide.'));img.onerror=()=>reject(Error('Immagine firma non leggibile.'));img.src=src;});}
const pad=$('signaturePad'),ctx=pad.getContext('2d');
function clearPad(){ctx.clearRect(0,0,pad.width,pad.height);ctx.lineWidth=3;ctx.strokeStyle='#142a3b';ctx.lineCap='round';ctx.lineJoin='round';hasInk=false;drawing=false;$('signStatus').textContent='';}
function openPad(r){activeRequest=r;clearPad();$('signSummary').textContent=summary(r);$('signDialog').showModal();}
function point(e){const r=pad.getBoundingClientRect();return [(e.clientX-r.left)*pad.width/r.width,(e.clientY-r.top)*pad.height/r.height];}
pad.addEventListener('pointerdown',e=>{e.preventDefault();drawing=true;pad.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...point(e));});
pad.addEventListener('pointermove',e=>{if(!drawing)return;e.preventDefault();ctx.lineTo(...point(e));ctx.stroke();hasInk=true;});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(ev,()=>drawing=false);
function croppedSignature(){const pixels=ctx.getImageData(0,0,pad.width,pad.height).data;let minX=pad.width,minY=pad.height,maxX=0,maxY=0;for(let y=0;y<pad.height;y++)for(let x=0;x<pad.width;x++)if(pixels[(y*pad.width+x)*4+3]>30){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(maxX-minX<10||maxY-minY<3)throw Error('Firma troppo breve: riprova.');const c=document.createElement('canvas');c.width=maxX-minX+21;c.height=maxY-minY+21;c.getContext('2d').drawImage(pad,minX,minY,maxX-minX+1,maxY-minY+1,10,10,maxX-minX+1,maxY-minY+1);return c.toDataURL('image/png');}
$('confirmSignature').onclick=async()=>{const b=$('confirmSignature');b.disabled=true;try{if(!hasInk)throw Error('Inserisci la firma prima di confermare.');const packet={...activeRequest,type:'LUMEN_SOPRALLUOGO_FIRMA',png:croppedSignature(),signedAt:new Date().toISOString()};
 if(phoneRequest){phonePacket=packet;try{const a=JSON.parse(localStorage.getItem(PHONE_KEY)||'{}');a[packet.requestId]=packet;localStorage.setItem(PHONE_KEY,JSON.stringify(a));$('phoneStatus').textContent='FIRMA ACQUISITA SUL TELEFONO. Ora inviala al Mac.';}catch{$('phoneStatus').textContent='Firma acquisita. Salva subito il file: il browser non ha conservato una copia.';}$('phoneReturn').hidden=false;}else if(!await acceptSignature(packet)){$('signStatus').textContent='Firma acquisita ma salvataggio non riuscito. Chiudi e usa ESPORTA DATI.';return;}
 $('signDialog').close();}catch(e){$('signStatus').textContent=e.message;}finally{b.disabled=false;}};
$('clearSignature').onclick=clearPad;$('closeSignature').onclick=()=>$('signDialog').close();$('closeQr').onclick=()=>$('qrDialog').close();
const filename=()=>`SOPRALLUOGO_${(state.fields.ragione_sociale||'AZIENDA').replace(/[^A-Z0-9]+/g,'_').slice(0,60)}_${state.fields.data_sopralluogo||today()}`;
function download(file){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function share(file){if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:file.name});return;}catch(e){if(e.name==='AbortError')return;}}download(file);}
function phoneFile(){return new File([JSON.stringify(phonePacket)],`FIRMA_SOPRALLUOGO_${phonePacket.name.replace(/[^A-Z0-9]+/g,'_')}_${phonePacket.date}.json`,{type:'application/json'});}
$('phoneShare').onclick=()=>share(phoneFile());$('phoneDownload').onclick=()=>download(phoneFile());$('phoneSign').onclick=()=>openPad(phoneRequest);
function wrapCount(text,font,size,width){let lines=0;for(const para of text.split('\n')){let line='';lines++;for(const word of para.split(/\s+/)){if(font.widthOfTextAtSize(word,size)>width)return Infinity;const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)>width){lines++;line=word;}else line=next;}}return lines;}
function textSize(text,meta,font){for(let size=10;size>=8;size-=.5){if(meta.multiline?wrapCount(text,font,size,meta.width-6)*size*1.2<=meta.height-4:font.widthOfTextAtSize(text,size)<=meta.width-6)return size;}throw Error(`Il testo in «${label(meta.name)}» è troppo lungo per lo spazio del modello. Riducilo o riportalo in un allegato.`);}
async function buildPdf(){
 collect();if(!state.fields.ragione_sociale||!state.fields.data_sopralluogo)throw Error('Compila RAGIONE SOCIALE e DATA SOPRALLUOGO.');
 const currentDigest=await digest();for(const s of Object.values(state.signatures))if(s.digest!==currentDigest)throw Error('Le firme non corrispondono al testo attuale. Usa MODIFICA RELAZIONE e acquisiscile di nuovo.');
 const res=await fetch('sopralluogo-modello.pdf');if(!res.ok)throw Error('Modello PDF non disponibile. Riprova con la connessione attiva.');const pdf=await PDFLib.PDFDocument.load(await res.arrayBuffer()),font=await pdf.embedFont(PDFLib.StandardFonts.Helvetica),bold=await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold),form=pdf.getForm();
 for(const meta of REPORT_FIELDS){let value=state.fields[meta.name]||'';if(DATE_FIELDS.includes(meta.name)&&value)value=value.split('-').reverse().join('/');value=value.replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'");const f=form.getTextField(meta.name);f.setText(value);f.acroField.setDefaultAppearance('/Helv 10 Tf 0 0 0 rg');try{f.setFontSize(textSize(value,meta,font));}catch(e){throw Error(e.message.includes('WinAnsi')?`Carattere non supportato in «${label(meta.name)}». Usa lettere e simboli comuni.`:e.message);}if(Object.keys(state.signatures).length)f.enableReadOnly();}
 form.updateFieldAppearances(font);
 const white=PDFLib.rgb(1,1,1),ink=PDFLib.rgb(.09,.17,.23),rule=PDFLib.rgb(.64,.72,.77),p=pdf.getPages()[2];p.drawRectangle({x:40,y:115,width:515,height:200,color:white});
 const drawText=(page,text,x,y,size=9)=>page.drawText(text,{x,y,size,font,color:ink});
 const imageAt=async(page,src,x,y,w,h,jpeg=false)=>{const im=jpeg?await pdf.embedJpg(src):await pdf.embedPng(src);const scale=Math.min(w/im.width,h/im.height);page.drawImage(im,{x:x+(w-im.width*scale)/2,y:y+(h-im.height*scale)/2,width:im.width*scale,height:im.height*scale});};
 const slots={datore:{x:43,y:207,w:239,h:65},rspp:{x:43,y:121,w:239,h:58},rls:{x:313,y:121,w:239,h:58}};
 drawText(p,'PER PRESA VISIONE / RICEVUTA',43,300);drawText(p,'DATORE DI LAVORO O DELEGATO',43,286);drawText(p,'IL MEDICO COMPETENTE',313,300);drawText(p,'DOTT. CLAUDIO BELTRAMI',313,286);drawText(p,'RSPP PRESENTE - FIRMA',43,186);drawText(p,'RLS / RLST PRESENTE - FIRMA',313,186);
 for(const [id,slot] of Object.entries(slots)){if(state.signatures[id])await imageAt(p,state.signatures[id].png,slot.x,slot.y+3,slot.w,slot.h-5);p.drawLine({start:{x:slot.x,y:slot.y},end:{x:slot.x+slot.w,y:slot.y},thickness:.6,color:rule});}
 if(state.includeDoctor){await imageAt(p,await doctorImage(),313,208,239,71,true);}p.drawLine({start:{x:313,y:207},end:{x:552,y:207},thickness:.6,color:rule});
 const extra=state.extra.filter(x=>x.name);for(let i=0;i<extra.length;i+=6){const page=pdf.addPage([595.2756,841.8898]);page.drawText('FIRME DEGLI ALTRI PRESENTI',{x:43,y:780,size:16,font:bold,color:ink});drawText(page,state.fields.ragione_sociale.slice(0,85),43,755);drawText(page,'SOPRALLUOGO DEL '+state.fields.data_sopralluogo.split('-').reverse().join('/'),43,739);drawText(page,'PER PRESA VISIONE / RICEVUTA',43,720);for(let j=0;j<6&&i+j<extra.length;j++){const x=extra[i+j],top=680-j*95;drawText(page,(x.name+' - '+x.role).slice(0,100),43,top);if(state.signatures[x.id])await imageAt(page,state.signatures[x.id].png,43,top-65,330,56);page.drawLine({start:{x:43,y:top-68},end:{x:552,y:top-68},thickness:.6,color:rule});}}
 const pages=pdf.getPages();pages.forEach((page,i)=>{page.drawRectangle({x:485,y:23,width:75,height:16,color:white});drawText(page,`Pag. ${i+1} di ${pages.length}`,500,29,8);});
 pdf.setTitle('Relazione di sopralluogo - '+state.fields.ragione_sociale);return pdf.save();
}
$('pdf').onclick=async()=>{const btn=$('pdf');btn.disabled=true;try{const pending=Object.keys(state.pending).length;if(pending&&!confirm('Ci sono firme ancora da ricevere. Preparare il PDF con le firme già acquisite?'))return;const bytes=await buildPdf();invalidatePdf();pdfFile=new File([bytes],filename()+'.pdf',{type:'application/pdf'});pdfUrl=URL.createObjectURL(pdfFile);$('openPdf').href=$('savePdf').href=pdfUrl;$('savePdf').download=pdfFile.name;$('downloadPanel').hidden=false;$('downloadPanel').scrollIntoView({behavior:'smooth'});if(save())status('PDF PRONTO. Relazione e firme salvate. Apri il PDF per controllarlo e stamparlo.');}catch(e){status(e.message,true);}finally{btn.disabled=false;}};
$('sharePdf').onclick=()=>pdfFile&&share(pdfFile);
$('save').onclick=save;
$('export').onclick=()=>{collect();download(new File([JSON.stringify(state,null,2)],filename()+'.json',{type:'application/json'}));status('Download dei dati avviato: conserva il file con la relazione e le firme.');};
$('import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>12*1024*1024)throw Error('File troppo grande.');const d=validate(JSON.parse(await f.text()));if(!canReplace())return;load(d);dirty=true;status('Relazione aperta. Premi SALVA RELAZIONE per conservarla qui.');}catch(err){status(err.message,true);}finally{e.target.value='';}};
$('receive').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>500000)throw Error('File firma troppo grande.');await acceptSignature(JSON.parse(await f.text()));}catch(err){status(err.message,true);}finally{e.target.value='';}};
$('new').onclick=()=>{if(!canReplace())return;fresh();status('Nuova relazione. Compila i dati del sopralluogo.');};
$('edit').onclick=()=>{if(!confirm('Modificare il testo richiede nuove firme. Annullare le firme e le richieste di questa relazione?'))return;state.revision=uuid();state.signatures={};state.pending={};onChange();renderSigners();};
$('addSigner').onclick=()=>{if(state.extra.length>=24){status('Massimo 24 altri presenti.',true);return;}state.extra.push({id:uuid(),name:'',role:'ALTRO PRESENTE'});onChange();renderSigners();};
let doctorImagePromise;
function doctorImage(){if(!doctorImagePromise)doctorImagePromise=fetch('index.html').then(r=>{if(!r.ok)throw Error('Timbro non disponibile.');return r.text();}).then(html=>{const m=html.match(/class="firma-timbro-incorporata"[^>]*>\s*<img[^>]*src="(data:image\/jpeg;base64,[A-Za-z0-9+/=]+)"/);if(!m)throw Error('Timbro e firma non trovati in LUMEN.');return m[1];}).catch(e=>{doctorImagePromise=null;throw e;});return doctorImagePromise;}
function renderDoctor(){ if(state.includeDoctor)doctorImage().then(src=>$('doctorImage').src=src).catch(e=>status(e.message,true)); $('doctorPreview').hidden=!state.includeDoctor; $('addDoctor').textContent=state.includeDoctor?'RIMUOVI IL MIO TIMBRO E FIRMA':'INSERISCI IL MIO TIMBRO E FIRMA'; }
$('addDoctor').onclick=()=>{state.includeDoctor=!state.includeDoctor;$('includeDoctor').checked=state.includeDoctor;renderDoctor();onChange();};
$('archive').onclick=()=>{try{const list=$('archiveList');list.replaceChildren();for(const d of archive().slice().reverse()){const row=document.createElement('div');row.className='archive-row';const title=document.createElement('span');title.textContent=d.fields.ragione_sociale+' · '+d.fields.data_sopralluogo+' · '+Object.keys(d.signatures).length+' FIRME';const b=document.createElement('button');b.textContent='APRI';b.onclick=()=>{if(canReplace()){load(d);status('Relazione aperta con le firme salvate.');}};row.append(title,b);list.append(row);}if(!list.children.length)list.textContent='Nessuna relazione salvata.';$('archivePanel').hidden=false;}catch(e){status(e.message,true);}};
function fresh(){state=newState();controls().forEach(e=>e.value=DATE_FIELDS.includes(e.name)?today():e.name==='medico_competente'?'DOTT. CLAUDIO BELTRAMI':'');$('includeDoctor').checked=false;renderDoctor();collect();dirty=false;invalidatePdf();renderSigners();}
let grid;
for(const meta of REPORT_FIELDS){if(sections[meta.name]){const h=document.createElement('h2');h.textContent=sections[meta.name];$('report').append(h);grid=document.createElement('div');grid.className='grid';$('report').append(grid);}const l=document.createElement('label');l.className='field'+(meta.width>300?' wide':'');const span=document.createElement('span');span.textContent=label(meta.name);const el=document.createElement(meta.multiline?'textarea':'input');el.id=el.name=meta.name;if(!meta.multiline)el.type=DATE_FIELDS.includes(meta.name)?'date':'text';el.maxLength=10000;el.addEventListener('input',onChange);el.addEventListener('change',renderSigners);l.append(span,el);grid.append(l);}
$('report').onsubmit=e=>e.preventDefault();window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});fresh();
if(location.hash.startsWith('#firma=')){
 $('mainHeader').hidden=$('main').hidden=true;$('phonePanel').hidden=false;
 try{phoneRequest=validateRequest(decode(location.hash.slice(7)));$('phoneSummary').textContent=summary(phoneRequest);try{const saved=JSON.parse(localStorage.getItem(PHONE_KEY)||'{}')[phoneRequest.requestId];if(saved&&saved.digest===phoneRequest.digest&&signatureImage(saved.png)){phonePacket=saved;$('phoneReturn').hidden=false;$('phoneStatus').textContent='Firma già acquisita sul telefono. Puoi inviare di nuovo il file al Mac.';}}catch{}}
 catch(e){$('phoneStatus').textContent=e.message;$('phoneSign').disabled=true;}
}
})();
