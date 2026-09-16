'use strict';
(()=>{
const $=id=>document.getElementById(id),form=$('report'),KEY='lumen_sopralluoghi_v1';
let currentId=null,dirty=false,count=0;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fields=()=>Array.from(form.querySelectorAll('input[name],textarea[name],select[name]'));
const status=(s,error=false)=>{$('status').textContent=s;$('status').style.color=error?'#a12622':'#205e46'};
function addObservation(){
 const n=++count,box=document.createElement('section');box.className='observation';
 const h=document.createElement('h3');h.textContent=`RILIEVO / INDICAZIONE ${n}`;box.append(h);
 const grid=document.createElement('div');grid.className='grid';box.append(grid);
 for(const [key,title,area] of [['rilievo','REPARTO E RILIEVO / EVIDENZA',true],['intervento','INTERVENTO PROPOSTO',true],['priorita','PRIORITÀ',false],['referente','REFERENTE / RUOLO',false],['termine','TERMINE E MODALITÀ DI VERIFICA',true]]){
 const label=document.createElement('label');label.className='field'+(area?' wide':'');const span=document.createElement('span');span.textContent=title;label.append(span);
 const el=document.createElement(area?'textarea':'input');el.id=el.name=`azione_${n}_${key}`;if(area)el.rows=2;label.append(el);grid.append(label);
 }
 $('rilievi').append(box);
}
function collect(){return {type:'LUMEN_SOPRALLUOGO',version:1,id:currentId||globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`,savedAt:new Date().toISOString(),observations:count,fields:Object.fromEntries(fields().map(e=>[e.name,e.value.toLocaleUpperCase('it-IT')]))}}
function validate(d){
 if(!d||d.type!=='LUMEN_SOPRALLUOGO'||d.version!==1||typeof d.id!=='string'||!d.id||!Number.isInteger(d.observations)||d.observations<1||d.observations>100||!d.fields||typeof d.fields!=='object'||Array.isArray(d.fields)||Object.values(d.fields).some(v=>typeof v!=='string'))throw Error('Il file non è una relazione di sopralluogo LUMEN valida.');
 return d;
}
function getArchive(){const a=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(a))throw Error('Archivio non leggibile: esporta la relazione corrente prima di procedere.');return a.map(validate)}
function save(){
 try{const d=collect();if(!d.fields.azienda.trim()||!d.fields.data){status('Compila almeno RAGIONE SOCIALE e DATA SOPRALLUOGO prima di salvare.',true);return false}
 const a=getArchive(),i=a.findIndex(x=>x.id===d.id);if(i<0)a.push(d);else a[i]=d;localStorage.setItem(KEY,JSON.stringify(a));currentId=d.id;dirty=false;status(`Salvata: ${d.fields.azienda} · ${d.fields.data} · ${new Date().toLocaleTimeString('it-IT')}. Archivio di questo browser.`);return true;
 }catch(e){status(`Salvataggio non riuscito. Usa ESPORTA DATI per conservare una copia. ${e.message}`,true);return false}
}
function canReplace(){return !dirty||confirm('La relazione contiene modifiche non salvate. Continuare e sostituirla?')}
function load(d){validate(d);if(!canReplace())return;form.reset();$('rilievi').replaceChildren();count=0;for(let i=0;i<d.observations;i++)addObservation();fields().forEach(e=>{e.value=d.fields[e.name]||''});currentId=d.id;dirty=false;preparePrint();status('Relazione aperta. Premi SALVA RELAZIONE per conservarla in questo browser.');$('archivePanel').hidden=true}
function filename(){return 'SOPRALLUOGO_'+($('azienda').value||'AZIENDA').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,70).toUpperCase()+'_'+($('data').value||today())}
function preparePrint(){
 fields().forEach(e=>{let out=e.nextElementSibling;if(!out||!out.classList.contains('print-value')){out=document.createElement('div');out.className='print-value';e.after(out)}out.textContent=(e.type==='date'&&e.value?e.value.split('-').reverse().join('/'):e.value).toLocaleUpperCase('it-IT')});$('nomeFirma').textContent=$('medico').value.toLocaleUpperCase('it-IT');document.title=filename();
}
$('save').onclick=save;
$('add').onclick=()=>{if(count>=100)return;addObservation();dirty=true};
form.addEventListener('input',()=>{dirty=true;status('Modifiche da salvare. Premi SALVA RELAZIONE o ESPORTA DATI.')});
$('print').onclick=()=>{preparePrint();window.print()};window.addEventListener('beforeprint',preparePrint);
$('export').onclick=()=>{const d=collect();currentId=d.id;const url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Download dei dati avviato. Conserva il file JSON per riaprire la relazione.');};
$('import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024)throw Error('File troppo grande (massimo 5 MB).');load(JSON.parse(await file.text()))}catch(err){status('Apertura non riuscita: '+err.message,true)}finally{e.target.value=''}};
$('new').onclick=()=>{if(!canReplace())return;form.reset();$('rilievi').replaceChildren();count=0;addObservation();currentId=null;dirty=false;$('data').value=$('redazione').value=today();preparePrint();status('Nuova relazione pronta. Compila i dati del sopralluogo.')};
$('archive').onclick=()=>{try{const a=getArchive().slice().reverse();const list=$('archiveList');list.replaceChildren();if(!a.length)list.textContent='Nessuna relazione salvata in questo browser.';for(const d of a){const row=document.createElement('div');row.className='archive-item';const title=document.createElement('span');title.textContent=`${d.fields.azienda||'SENZA AZIENDA'} · ${d.fields.data||'SENZA DATA'} · ${d.fields.sede||''}`;const btn=document.createElement('button');btn.textContent='APRI';btn.onclick=()=>load(d);row.append(title,btn);list.append(row)}$('archivePanel').hidden=false;$('archivePanel').scrollIntoView({behavior:'smooth'})}catch(e){status('Archivio non disponibile: '+e.message,true)}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
addObservation();$('data').value=$('redazione').value=today();preparePrint();
})();
