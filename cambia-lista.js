/* LUMEN hotfix 08/09/2026 - pulsanti certificati */
(function(){
'use strict';
const S='beltrami_v9_sessione_attiva',W='beltrami_workers_v8',E='beltrami_v9_esiti',L='beltrami_worker_lists_v1',A='beltrami_worker_list_active_v1';
function read(k,d){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(_){return d}}
function norm(v){return String(v||'').trim().toUpperCase()}
function fmt(d){const a=String(d||'').split('-');return a.length===3?a[2]+'/'+a[1]+'/'+a[0]:String(d||'')}
function safe(v){return norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')}
function sessione(){
 let s=read(S,null),d=read(W,{workers:[]});
 if(!s){const ls=read(L,[]),id=localStorage.getItem(A)||'',r=Array.isArray(ls)?ls.find(x=>x&&x.id===id):null;if(r&&r.session)s={...r.session,workers:r.workers||[],esiti:r.esiti||{}}}
 if(!s)return null;
 if(!Array.isArray(s.workers))s={...s,workers:Array.isArray(d.workers)?d.workers:[]};
 if(!s.esiti)s={...s,esiti:read(E,{})};
 return s;
}
function key(w,i){return String((w&&w.id)||(w&&w.codice_fiscale)||i)}
async function prepara(){
 const b=document.getElementById('v9InvioCertificati');
 try{
  const s=sessione();if(!s)return alert('NESSUNA SESSIONE DISPONIBILE.');
  const api=window.lumenBatchCertApi;if(!api)return alert('ARCHIVIO CARTELLE NON DISPONIBILE. RICARICARE LUMEN.');
  if(!window.html2canvas||!window.jspdf?.jsPDF)return alert('MODULO PDF NON DISPONIBILE. RICARICARE LUMEN.');
  const es=s.esiti||{},ws=s.workers||[];
  let vis=ws.filter((w,i)=>w&&w.visited&&norm(es[key(w,i)])!=='ASSENTE');
  if(!vis.length)vis=ws.filter((w,i)=>w&&norm(es[key(w,i)])&&norm(es[key(w,i)])!=='ASSENTE');
  if(!vis.length)return alert('NON RISULTANO LAVORATORI VISITATI.');
  b.disabled=true;b.textContent='CONTROLLO CARTELLE...';
  const found=[],missing=[];
  for(const w of vis){const r=await api.getCartellaRecord(api.cartellaId(w));if(r&&r.data)found.push({w,r});else missing.push(((w.cognome||'')+' '+(w.nome||'')).trim())}
  if(missing.length)return alert('MANCANO LE CARTELLE SALVATE DI:\n\n• '+missing.join('\n• '));
  const cert=document.getElementById('certificate'),page=cert&&cert.querySelector('.page'),cart=document.querySelector('.cartella');
  if(!page)return alert('PAGINA CERTIFICATO NON TROVATA.');
  const original=api.collect(),oldDisplay=cert.style.display,cartWasHidden=cart&&cart.classList.contains('hidden');
  cert.style.display='block';if(cart)cart.classList.add('hidden');
  const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  const sede=(s.sede||((document.getElementById('v9Sede')||{}).value)||'').trim();
  for(let i=0;i<found.length;i++){
   b.textContent='CERTIFICATO '+(i+1)+' / '+found.length;
   const d={...found[i].r.data};if(!d.luogo_visita&&sede)d.luogo_visita=sede;
   api.apply(d);api.popolaCertificato(undefined,false);
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const c=await window.html2canvas(page,{scale:2,useCORS:true,backgroundColor:'#fff',logging:false});
   if(i)pdf.addPage('a4','portrait');pdf.addImage(c.toDataURL('image/jpeg',.94),'JPEG',0,0,210,297,undefined,'FAST');
  }
  const date=String(s.data||new Date().toISOString().slice(0,10)).replace(/-/g,''),name=[s.committente||s.azienda||'SESSIONE',sede||'SEDE',date,found.length+' CERTIFICATI'].map(safe).filter(Boolean).join('_')+'.pdf';
  const blob=pdf.output('blob'),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),300000);
  api.apply(original);cert.style.display=oldDisplay||'none';if(cart&&!cartWasHidden)cart.classList.remove('hidden');
  if(api.setStatus)api.setStatus('PDF PRONTO: '+found.length+' CERTIFICATI. SOLO CERTIFICATI.');
  alert('PDF PRONTO: '+found.length+' CERTIFICATI DI IDONEITÀ.\nNON contiene le cartelle sanitarie.');
 }catch(e){alert('ERRORE PREPARA INVIO CERTIFICATI:\n'+(e?.message||String(e)))}finally{if(b){b.disabled=false;b.textContent='PREPARA INVIO CERTIFICATI'}}
}
function email(){
 const s=sessione();if(!s)return alert('NESSUNA SESSIONE DISPONIBILE.');
 const dest=s.email||((document.getElementById('v9Email')||{}).value)||'';if(!dest)return alert('INSERIRE L’INDIRIZZO EMAIL DEL COMMITTENTE.');
 const n=(s.workers||[]).filter(w=>w&&w.visited).length,sub='Certificati di idoneità - '+(s.azienda||s.committente||'')+' - '+(s.sede||'')+' - '+fmt(s.data),body='Buongiorno,\n\ntrasmetto in allegato i certificati di idoneità relativi ai '+n+' lavoratori visitati il '+fmt(s.data)+'.\n\nCordiali saluti\nDott. Claudio Beltrami';
 location.href='mailto:'+encodeURIComponent(dest)+'?subject='+encodeURIComponent(sub)+'&body='+encodeURIComponent(body);
}
function install(){const a=document.getElementById('v9InvioCertificati'),m=document.getElementById('v9EmailBtn');if(a)a.onclick=prepara;if(m){m.textContent='PREPARA EMAIL CERTIFICATI';m.onclick=email}}
install();addEventListener('load',install);setTimeout(install,500);
})();
