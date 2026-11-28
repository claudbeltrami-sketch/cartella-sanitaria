/* Manuale digitale: non legge alcun dato sanitario e non invoca comandi clinici. */
(function(){
'use strict';
const links={btnSalva:'cartella',btnFirmaLavoratore:'firma',btnCert:'certificati',btnElencoVisiteArchivio:'archivio',btnAllegatiCartella:'allegati',btnStoricoCartaceo:'storico',btnArchivioPdfMac:'backup',btnScadenzario:'scadenzario',lumenBackupVerificaFile:'backup'};
function help(chapter,label){const a=document.createElement('a');a.href='manuale-lumen.html#'+chapter;a.target='_blank';a.rel='noopener noreferrer';a.className='lumen-manuale-help no-print';a.setAttribute('data-html2canvas-ignore','true');a.textContent='?';a.title='Istruzioni: '+label;a.setAttribute('aria-label',a.title);return a}
function install(){
 const bar=document.getElementById('mainToolbar');if(!bar)return;
 if(!document.getElementById('lumenManualeHome')){
  const home=document.createElement('div');home.id='lumenManualeHome';home.className='no-print';home.setAttribute('data-html2canvas-ignore','true');
  const a=help('inizio','Manuale operativo');a.textContent='MANUALE';a.classList.add('lumen-manuale-main');a.href='manuale-lumen.html';home.append(a);bar.before(home);
 }
 for(const [id,chapter] of Object.entries(links)){const el=document.getElementById(id);if(!el||document.getElementById('manuale-help-'+id))continue;const a=help(chapter,el.textContent.trim());a.id='manuale-help-'+id;el.after(a)}
}
const style=document.createElement('style');style.textContent='#lumenManualeHome{max-width:980px;margin:6px auto;display:flex;justify-content:flex-end}.lumen-manuale-help{display:inline-flex!important;align-items:center;justify-content:center;min-height:36px;min-width:36px;padding:4px 10px;margin:3px;border:1px solid #6c8495;border-radius:7px;background:#fff;color:#245d38!important;text-decoration:none;font:700 15px system-ui;vertical-align:middle;flex:0 0 auto}.lumen-manuale-main{padding:9px 18px;font-size:16px;background:#245d38;color:#fff!important}@media print{#lumenManualeHome,.lumen-manuale-help{display:none!important}}';document.head.append(style);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
window.addEventListener('load',install,{once:true});
})();