/* LUMEN hotfix 08/09/2026 - pulsanti certificati V3 Mac */
(function(){
'use strict';
var S='beltrami_v9_sessione_attiva',W='beltrami_workers_v8',E='beltrami_v9_esiti',L='beltrami_worker_lists_v1',A='beltrami_worker_list_active_v1';
function read(k,d){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(_){return d}}
function norm(v){return String(v||'').trim().toUpperCase()}
function fmt(d){var a=String(d||'').split('-');return a.length===3?a[2]+'/'+a[1]+'/'+a[0]:String(d||'')}
function safe(v){return norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')}
function sessione(){
 var s=read(S,null),d=read(W,{workers:[]});
 if(!s){var ls=read(L,[]),id=localStorage.getItem(A)||'',r=Array.isArray(ls)?ls.find(function(x){return x&&x.id===id}):null;if(r&&r.session)s=Object.assign({},r.session,{workers:r.workers||[],esiti:r.esiti||{}})}
 if(!s)return null;
 if(!Array.isArray(s.workers))s=Object.assign({},s,{workers:Array.isArray(d.workers)?d.workers:[]});
 if(!s.esiti)s=Object.assign({},s,{esiti:read(E,{})});
 return s;
}
function key(w,i){return String((w&&w.id)||(w&&w.codice_fiscale)||i)}
async function prepara(){
 var b=document.getElementById('v9InvioCertificati');
 if(b){b.disabled=false;b.textContent='CONTROLLO CARTELLE...'}
 var st=document.getElementById('status');if(st)st.textContent='CONTROLLO CARTELLE PER PDF CERTIFICATI...';
 try{
  var s=sessione();if(!s)return alert('NESSUNA SESSIONE DISPONIBILE.');
  var api=window.lumenBatchCertApi;if(!api)return alert('ARCHIVIO CARTELLE NON DISPONIBILE. RICARICARE LUMEN.');
  if(!window.html2canvas||!window.jspdf||!window.jspdf.jsPDF)return alert('MODULO PDF NON DISPONIBILE. RICARICARE LUMEN.');
  var es=s.esiti||{},ws=s.workers||[];
  var vis=ws.filter(function(w,i){return w&&w.visited&&norm(es[key(w,i)])!=='ASSENTE'});
  if(!vis.length)vis=ws.filter(function(w,i){return w&&norm(es[key(w,i)])&&norm(es[key(w,i)])!=='ASSENTE'});
  if(!vis.length){
   /* Se i flag della sessione non sono aggiornati, prova le cartelle realmente salvate. */
   for(var q=0;q<ws.length;q++){
    var wr=ws[q];if(!wr)continue;
    try{var rr=await api.getCartellaRecord(api.cartellaId(wr));if(rr&&rr.data)vis.push(wr)}catch(_){ }
   }
  }
  if(!vis.length)return alert('NON RISULTANO CARTELLE SALVATE DEI LAVORATORI VISITATI.');
  if(b)b.disabled=true;
  var found=[],missing=[];
  for(var j=0;j<vis.length;j++){
   var w=vis[j],r=await api.getCartellaRecord(api.cartellaId(w));
   if(r&&r.data)found.push({w:w,r:r});else missing.push(((w.cognome||'')+' '+(w.nome||'')).trim());
  }
  if(!found.length)return alert('NESSUN CERTIFICATO RECUPERABILE DALLE CARTELLE SALVATE.');
  if(missing.length&&found.length){if(!confirm('HO TROVATO '+found.length+' CARTELLE.\nMANCANO:\n\n• '+missing.join('\n• ')+'\n\nPREPARO COMUNQUE IL PDF CON QUELLE TROVATE?'))return}
  var cert=document.getElementById('certificate'),page=cert&&cert.querySelector('.page'),cart=document.querySelector('.cartella');
  if(!page)return alert('PAGINA CERTIFICATO NON TROVATA.');
  var original=api.collect(),oldDisplay=cert.style.display,cartWasHidden=cart&&cart.classList.contains('hidden');
  cert.style.display='block';if(cart)cart.classList.add('hidden');
  var pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  var sede=(s.sede||((document.getElementById('v9Sede')||{}).value)||'').trim();
  for(var i=0;i<found.length;i++){
   if(b)b.textContent='CERTIFICATO '+(i+1)+' / '+found.length;
   if(st)st.textContent='CREAZIONE CERTIFICATO '+(i+1)+' DI '+found.length+'...';
   var data=Object.assign({},found[i].r.data);if(!data.luogo_visita&&sede)data.luogo_visita=sede;
   api.apply(data);api.popolaCertificato(undefined,false);
   await new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve)})});
   var c=await window.html2canvas(page,{scale:2,useCORS:true,backgroundColor:'#fff',logging:false});
   if(i)pdf.addPage('a4','portrait');pdf.addImage(c.toDataURL('image/jpeg',.94),'JPEG',0,0,210,297,undefined,'FAST');
  }
  var date=String(s.data||new Date().toISOString().slice(0,10)).replace(/-/g,''),name=[s.committente||s.azienda||'SESSIONE',sede||'SEDE',date,found.length+' CERTIFICATI'].map(safe).filter(Boolean).join('_')+'.pdf';
  var blob=pdf.output('blob'),u=URL.createObjectURL(blob);window.lumenUltimoPdfCertificati={url:u,fileName:name,count:found.length,created:Date.now()};var box=document.createElement('div');box.id='lumenPdfReadyBox';box.style.cssText='position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:999999;background:#fff;border:4px solid #287a46;border-radius:14px;padding:18px;width:min(92vw,620px);box-shadow:0 12px 35px #0008;text-align:center';box.innerHTML='<div style="font-size:20px;font-weight:800;margin-bottom:8px">PDF PRONTO: '+found.length+' CERTIFICATI DI IDONEITÀ</div><div style="font-size:16px;line-height:1.35;margin-bottom:14px">NON contiene le cartelle sanitarie.</div>';var op=document.createElement('button');op.type='button';op.textContent='APRI / SCARICA PDF CUMULATIVO';op.style.cssText='display:block;width:100%;min-height:54px;background:#287a46;color:#fff;border:0;border-radius:9px;font-size:17px;font-weight:800;margin-bottom:10px';op.onclick=function(){var w=window.open(u,'_blank');if(!w){var a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove()}};var dl=document.createElement('button');dl.type='button';dl.textContent='SCARICA PDF';dl.style.cssText='display:block;width:100%;min-height:48px;background:#1f5f99;color:#fff;border:0;border-radius:9px;font-size:16px;font-weight:800;margin-bottom:10px';dl.onclick=function(){var a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove()};var cl=document.createElement('button');cl.type='button';cl.textContent='CHIUDI';cl.style.cssText='display:block;width:100%;min-height:44px;background:#666;color:#fff;border:0;border-radius:9px;font-size:15px;font-weight:700';cl.onclick=function(){box.remove()};box.appendChild(op);box.appendChild(dl);box.appendChild(cl);var prev=document.getElementById('lumenPdfReadyBox');if(prev)prev.remove();document.body.appendChild(box);
  api.apply(original);cert.style.display=oldDisplay||'none';if(cart&&!cartWasHidden)cart.classList.remove('hidden');
  if(api.setStatus)api.setStatus('PDF PRONTO: '+found.length+' CERTIFICATI. SOLO CERTIFICATI.');
  
 }catch(e){alert('ERRORE PREPARA INVIO CERTIFICATI:\n'+((e&&e.message)||String(e)))}finally{if(b){b.disabled=false;b.textContent='PREPARA INVIO CERTIFICATI'}}
}
function email(){
 var s=sessione();if(!s)return alert('NESSUNA SESSIONE DISPONIBILE.');
 var dest=s.email||((document.getElementById('v9Email')||{}).value)||'';if(!dest)return alert('INSERIRE L’INDIRIZZO EMAIL DEL COMMITTENTE.');
 var n=(s.workers||[]).filter(function(w){return w&&w.visited}).length,sub='Certificati di idoneità - '+(s.azienda||s.committente||'')+' - '+(s.sede||'')+' - '+fmt(s.data),body='Buongiorno,\n\ntrasmetto in allegato i certificati di idoneità relativi ai '+n+' lavoratori visitati il '+fmt(s.data)+'.\n\nCordiali saluti\nDott. Claudio Beltrami';
 location.href='mailto:'+encodeURIComponent(dest)+'?subject='+encodeURIComponent(sub)+'&body='+encodeURIComponent(body);
}
function install(){
 var a=document.getElementById('v9InvioCertificati'),m=document.getElementById('v9EmailBtn');
 if(a){a.disabled=false;a.textContent='PREPARA INVIO CERTIFICATI';a.title='HOTFIX CERTIFICATI V2';a.onclick=prepara}
 if(m){m.disabled=false;m.textContent='PREPARA EMAIL CERTIFICATI';m.onclick=email}
}
document.addEventListener('click',function(ev){var t=ev.target&&ev.target.closest?ev.target.closest('#v9InvioCertificati,#v9EmailBtn'):null;if(!t)return;ev.preventDefault();ev.stopImmediatePropagation();if(t.id==='v9InvioCertificati')prepara();else email()},true);
install();addEventListener('load',install);addEventListener('pageshow',install);setTimeout(install,250);setTimeout(install,1000);
})();
