/* Browser-shaped regression with synthetic charts only: no patient data. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const historic=require('../storico-cartaceo.js');
const cf='RSSMRA80A01H501U';
const html=`<!doctype html><html><head></head><body>
<form id="cartellaForm">
 <input id="cognome" value="PROVA"><input id="nome" value="ALFA">
 <input id="data_nascita" value="1980-01-01"><input id="codice_fiscale" value="${cf}">
 <input id="data_cartella" value="2026-06-08"><input id="data_giudizio" value="2026-06-08">
 <input id="datore_lavoro" value="AZIENDA DI PROVA"><input id="mansione" value="IMPIEGATO">
 <div class="section-title">GIUDIZIO</div>
 <div id="giudizi"><input type="checkbox" name="giudizio" value="IDONEO">
 <input type="checkbox" name="giudizio" value="IDONEO CON LIMITAZIONI"></div>
 <textarea id="prescrizioni"></textarea>
 <select id="periodicita"><option value=""></option><option value="ANNUALE">ANNUALE</option></select>
 <input id="periodicita_altro">
</form></body></html>`;
const {window}=parseHTML(html),doc=window.document;
const original={
 id:'STORICO_PROVA',kind:'allegato_cartella_v1',hash:'a'.repeat(64),
 workerCf:cf,workerBirth:'1980-01-01',visit:'2025-06-06',
 storicoCartaceo:{tipo:historic.FLAG,identitaVerificata:true,cognome:'PROVA',nome:'ALFA'}
};
const chart={id:'CF_'+cf,cf,cognome:'PROVA',nome:'ALFA',dataNascita:'1980-01-01',
 data:{cognome:'PROVA',nome:'ALFA',data_nascita:'1980-01-01',codice_fiscale:cf,
  data_giudizio:'2026-06-08',giudizio:'IDONEO'},history:[]};
let archive=[chart];const originalJson=JSON.stringify(chart);
window.lumenArchiveVisitsApi={list:async()=>archive};
window.lumenStoricoCartaceo=historic;
window.lumenAllegatiStorage={list:async()=>[original]};
window.confirm=()=>true;window.alert=msg=>{throw Error(msg)};
const context={window,document:doc,Event:window.Event,setTimeout,clearTimeout,console};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','copia-giudizio-precedente.js'),'utf8'),context);
doc.dispatchEvent(new window.Event('DOMContentLoaded'));
const tick=()=>new Promise(r=>setTimeout(r,350));
async function main(){
 await tick();
 const wrap=doc.getElementById('lumenCopiaGiudizio'),button=wrap.querySelector('button'),status=wrap.querySelector('[role="status"]');
 assert(wrap,'Judgment section not created');
 assert(!wrap.hidden,'PDF-only predecessor should be visible as status');
 assert(button.hidden,'PDF-only must NEVER enable copy');
 assert.match(status.textContent,/PDF della visita precedente collegato automaticamente/);
 // Simulate an electronic previous visit added after the current page is open.
 archive=[{...chart,history:[{savedAt:'2026-10-29T08:00:00Z',data:{
  cognome:'PROVA',nome:'ALFA',data_nascita:'1980-01-01',codice_fiscale:cf,
  data_giudizio:'2025-06-06',data_cartella:'2025-06-06',giudizio:'IDONEO CON LIMITAZIONI',
  prescrizioni:'EVITARE CARICHI PESANTI',periodicita:'ANNUALE',mansione:'ADDETTO',
  datore_lavoro:'AZIENDA DI PROVA'
 }}]}];
 doc.dispatchEvent(new window.Event('lumen:precedenti-aggiornati'));await tick();
 assert(!button.hidden,'Structured previous judgment should be available without reopening current chart');
 assert.match(status.textContent,/visita elettronica collegata automaticamente/);
 button.click();await tick();
 assert(doc.querySelector('input[name="giudizio"][value="IDONEO CON LIMITAZIONI"]').checked);
 assert.equal(doc.getElementById('periodicita').value,'ANNUALE');
 assert.equal(doc.getElementById('prescrizioni').value,'EVITARE CARICHI PESANTI');
 assert.equal(doc.getElementById('data_giudizio').value,'2026-06-08');
 assert.equal(JSON.stringify(chart),originalJson,'Clinical archive changed unexpectedly');
 // Identity changes hide stale sources immediately and prevent copying.
 doc.getElementById('nome').value='BETA';doc.getElementById('nome').dispatchEvent(new window.Event('input'));
 assert(button.hidden,'Previous source must hide immediately after worker switch');
 await tick();assert(wrap.hidden,'Precedent of another patient must never appear');
 console.log('PASS: existing PDF auto-linked as read-only, new electronic prior auto-detected, copy requires action, identity changes invalidate, original archive untouched.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
