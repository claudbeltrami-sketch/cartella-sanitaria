/* Promemoria anagrafici: nessuna correzione automatica dei dati. */
(()=>{'use strict';
const bridge=window.lumenAnagraficheBridge;
const read=id=>document.getElementById(id)?.value||'';
const current=()=>Object.fromEntries(['cognome','nome','codice_fiscale','data_nascita','sesso'].map(k=>[k,read(k)]));
const date=s=>{const m=String(s||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:String(s||'')};
const pretty=s=>s.split('-').reverse().join('/');
function detect(d){
 const issues=[],cf=String(d.codice_fiscale||'').toUpperCase().replace(/\s/g,'');
 const decoded=cf.slice(6,11).replace(/[LMNPQRSTUV]/g,c=>String('LMNPQRSTUV'.indexOf(c)));
 if(/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)){
  const yy=decoded.slice(0,2),month='ABCDEHLMPRST'.indexOf(cf[8])+1,raw=Number(decoded.slice(3)),day=raw>40?raw-40:raw;
  const dob=date(d.data_nascita),parts=dob.split('-');
  if(day>=1&&day<=31&&dob&& (parts[0]?.slice(-2)!==yy||Number(parts[1])!==month||Number(parts[2])!==day))issues.push('Data di nascita discordante: nella cartella '+pretty(dob)+', nel CF '+String(day).padStart(2,'0')+'/'+String(month).padStart(2,'0')+'/anno '+yy+'. Verificare documento.');
 }
 const note=String(d.note_anagrafiche||'').trim();if(note)issues.push(note);
 for(const p of d.problemi||[])if(p&&!issues.includes(p))issues.push(p);
 return [...new Set(issues)];
}
let state={pending:[],resolved:[]};
const box=document.createElement('section');box.id='lumenAnagrafiche';box.className='no-print';box.setAttribute('aria-label','Verifica dati anagrafici');
const title=document.createElement('strong');title.textContent='DATI ANAGRAFICI DA VERIFICARE';const list=document.createElement('ul');const button=document.createElement('button');button.type='button';button.textContent='DOCUMENTO VERIFICATO / RISOLVI';box.append(title,list,button);
document.getElementById('cognome').closest('form').prepend(box);
const style=document.createElement('style');style.textContent='#lumenAnagrafiche{border:2px solid #b56a00;background:#fff4d6;color:#573400;padding:12px;margin:12px 0}#lumenAnagrafiche[hidden]{display:none!important}#lumenAnagrafiche button{background:#805000;color:white;padding:8px}@media print{#lumenAnagrafiche{display:none!important}}';document.head.append(style);
function refresh(){for(const issue of detect(current()))if(!state.pending.includes(issue)&&!state.resolved.some(r=>r.issue===issue))state.pending.push(issue);box.hidden=!state.pending.length;list.replaceChildren(...state.pending.map(s=>{const li=document.createElement('li');li.textContent=s;return li}));}
function load(d){const s=d.verifica_anagrafica;state={pending:Array.isArray(s?.pending)?s.pending.slice():[],resolved:Array.isArray(s?.resolved)?s.resolved.slice():[]};for(const issue of detect(d))if(!state.pending.includes(issue)&&!state.resolved.some(r=>r.issue===issue))state.pending.push(issue);refresh();}
button.onclick=async()=>{
 const note=prompt('Dopo aver controllato il documento, indica il dato verificato e l’eventuale correzione effettuata nei campi della cartella:');if(!note?.trim())return;
 const before=JSON.parse(JSON.stringify(state)),identity=JSON.stringify(current());
 state.resolved.push(...state.pending.map(issue=>({issue,note:note.trim(),verifiedAt:new Date().toISOString()})));state.pending=[];refresh();
 try{const result=await bridge.autosaveCurrentCartella('VERIFICA DOCUMENTO ANAGRAFICO');if(result.error)throw result.error;if(!result.saved&&result.skipped!=='gia salvata')throw new Error('Cartella non salvata.');if(JSON.stringify(current())===identity){bridge.saveRow(current(),JSON.parse(JSON.stringify(state)));}}catch(e){if(JSON.stringify(current())===identity){state=before;refresh()}alert('Verifica non salvata: '+(e.message||e));}
};
window.lumenAnagrafiche={detect,unresolved:d=>detect(d).filter(issue=>!(d.verifica_anagrafica?.resolved||[]).some(r=>r.issue===issue)),load,collect:()=>{refresh();return state.pending.length||state.resolved.length?JSON.parse(JSON.stringify(state)):null},refresh};
document.getElementById('cognome').closest('form').addEventListener('input',e=>{if(['data_nascita','codice_fiscale','sesso'].includes(e.target.id))refresh()});
load(current());bridge.renderWorkers();
})();
