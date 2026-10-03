// Synthetic identities; isolated local storage and IndexedDB.
const assert=require('node:assert/strict');
const {app}=require('./allegati-dom.cjs');
(async()=>{
 const p=await app();
 const edit=(id,value)=>{p.$(id).value=value;p.$(id).dispatchEvent(new p.w.Event('input',{bubbles:true}))};
 try{
  p.api.apply({cognome:'ROSSI',nome:'MARIO',data_nascita:'1980-01-01',sesso:'M',luogo_nascita:'ROMA',codice_fiscale:''});
  assert.equal(p.$('codice_fiscale').value,'','Opening alone must not change legacy identity');
  edit('nome','MARIO');assert.equal(p.$('codice_fiscale').value,'RSSMRA80A01H501U');
  edit('nome','LUCA');assert.notEqual(p.$('codice_fiscale').value,'RSSMRA80A01H501U');
  edit('luogo_nascita','LOCALITÀ SCONOSCIUTA');assert.equal(p.$('codice_fiscale').value,'');assert.equal(p.$('cf_codice_catastale').value,'');
  edit('cf_codice_catastale','Z100');assert.match(p.$('codice_fiscale').value,/Z100[A-Z]$/);
  edit('data_nascita','');assert.equal(p.$('codice_fiscale').value,'');
  edit('data_nascita','2999-01-01');assert.equal(p.$('codice_fiscale').value,'');
  edit('data_nascita','1980-01-01');edit('luogo_nascita','CASTRO');assert.equal(p.$('codice_fiscale').value,'','Ambiguous birthplace cannot be guessed');
  edit('luogo_nascita','ROMA');edit('codice_fiscale','RSSMRA80A01H501U');edit('nome','ALTRO');
  assert.equal(p.$('codice_fiscale').value,'RSSMRA80A01H501U','Manually supplied CF must survive edits');
  p.$('btnCalcolaCF').click();assert.equal(p.$('codice_fiscale').value,'RSSMRA80A01H501U');
  p.api.apply({cognome:'ROSSI',nome:'MARIO',data_nascita:'1980-01-01',sesso:'M',luogo_nascita:'ROMA'});
  edit('nome','MARIO');await p.api.saveToLocalArchive();edit('nome','LUCA');
  assert.equal(p.$('codice_fiscale').value,'RSSMRA80A01H501U','Saving fixes the established identity; subsequent edits cannot silently change it');
  const calc=p.w.lumenImportCartelleStorage.calculateCF;
  assert.equal(calc({cognome:'ROSSI',nome:'MARIO',data_nascita:'1980-02-30',sesso:'M',luogo_nascita:'ROMA'}),null);
  assert.equal(calc({cognome:'ROSSI',nome:'MARIO',data_nascita:'1980-01-01',sesso:'M',luogo_nascita:'ROMA'}).cf,'RSSMRA80A01H501U');
  console.log('PASS automatic CF, edits, existing CF protection, unknown/ambiguous places, invalid dates, import calculation');
  edit('peso','87');edit('altezza','243.8');assert.equal(p.$('bmi').value,'');assert.equal(p.$('bmi_classificazione').value,'');assert.equal(p.$('altezza_avviso').hidden,false);assert.equal(p.$('altezza').value,'243.8');
  edit('altezza','175');assert.equal(p.$('bmi').value,'28,4');assert.equal(p.$('altezza_avviso').hidden,true);
  edit('altezza','119.9');assert.equal(p.$('bmi').value,'');edit('altezza','120');assert.notEqual(p.$('bmi').value,'');edit('altezza','220');assert.notEqual(p.$('bmi').value,'');edit('altezza','220.1');assert.equal(p.$('bmi').value,'');
  edit('altezza_feet','5');edit('altezza_inches','9');assert.equal(p.$('altezza').value,'175.3');assert.notEqual(p.$('bmi').value,'');
  const d={cognome:'COLLAUDO',nome:'SINTETICO',codice_fiscale:'CF-SINTETICO',data_nascita:'1980-01-01',data_giudizio:'2026-10-02',temperatura:'36,7',spo2:'98',polso:'70',altezza:'243.8',peso:'87',bmi:'14,6',firma_lavoratore_png:'FIRMA-SINTETICA'};
  await p.api.saveToLocalArchive(d);const before=JSON.stringify(await p.t.cartelle());p.api.apply(d);
  assert.equal(p.$('bmi').value,'');assert.equal(p.$('altezza_avviso').hidden,false);assert.equal(JSON.stringify(await p.t.cartelle()),before,'Opening must not rewrite stored data');
  const collected=p.api.collect();assert.equal(collected.temperatura,'36,7');assert.equal(collected.spo2,'98');assert.equal(collected.polso,'70');assert.equal(collected.firma_lavoratore_png,d.firma_lavoratore_png);
  await p.api.saveToLocalArchive(collected);const saved=await p.api.getCartellaRecord(p.api.cartellaId(d));p.api.apply(saved.data);assert.equal(p.$('temperatura').value,'36,7');assert.equal(p.$('spo2').value,'98');
  p.api.apply({cognome:'ALTRO',nome:'SINTETICO'});assert.equal(p.$('temperatura').value,'');assert.equal(p.$('spo2').value,'');assert.equal(p.$('altezza_avviso').hidden,true);
  assert.deepEqual(p.errors,[]);console.log('PASS BMI bounds and feet conversion; optional vitals save/reopen/reset; archive and signatures preserved');
 }finally{p.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
