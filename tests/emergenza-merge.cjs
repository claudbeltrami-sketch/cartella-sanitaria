'use strict';
const assert=require('node:assert/strict');
const {resolve}=require('../emergenza-merge.js');
const DAY='2026-11-12',CF='PRVFNT80A01H501X';
const chart=(day,more={})=>({
 id:'CF_'+CF,cf:CF,cognome:'PROVA',nome:'FANTASMA',dataNascita:'1980-01-01',
 data:{cognome:'PROVA',nome:'FANTASMA',codice_fiscale:CF,data_giudizio:day,...more},
 createdAt:day+'T08:00:00Z',updatedAt:day+'T09:00:00Z',history:[]});
const packet=(...cartelle)=>({tipo:'LUMEN_EMERGENZA_SESSIONE_V1',versione:1,data:DAY,cartelle,originali:[],lumen_prova:true});
const old=chart('2026-10-30');
const signed=chart(DAY,{firma_lavoratore_png:'data:image/png;base64,QUFB'});
const plan=resolve([old],packet(signed));
assert.deepEqual(plan.conflicts,[]);
assert.equal(plan.addedVisits,1);
assert.equal(plan.newWorkers,0);
assert.equal(plan.updates.length,1);
assert.equal(plan.updates[0].history.length,1);
assert.equal(plan.updates[0].data.data_giudizio,DAY);
assert.equal(plan.updates[0].data.firma_lavoratore_png,'data:image/png;base64,QUFB');
assert.equal(resolve(plan.updates,packet(signed)).addedVisits,0,'second import idempotent');
assert.equal(resolve([signed],packet(signed)).updates.length,0);
const conflicting=chart(DAY,{firma_lavoratore_png:'data:image/png;base64,QkJC'});
assert.equal(resolve([conflicting],packet(signed)).conflicts.length,1,'different signature must block');
assert.equal(resolve([old],packet(signed,signed)).conflicts.length,1,'duplicate source records must block');
assert.equal(resolve([old],packet(chart('2026-11-11'))).conflicts.length,1,'wrong visit date must block');
const countersOld={...old,conteggioVisits:{'2026-10-30':{status:'sent',client:'TEST'}}};
const countersNew={...signed,conteggioVisits:{[DAY]:{status:'pending',client:'TEST'}}};
const merged=resolve([countersOld],packet(countersNew));
assert.equal(merged.conflicts.length,0);
assert.deepEqual(Object.keys(merged.updates[0].conteggioVisits).sort(),['2026-10-30',DAY].sort());
const conflictingCounters={...signed,conteggioVisits:{'2026-10-30':{status:'pending',client:'DIFFERENT'}}};
assert.equal(resolve([countersOld],packet(conflictingCounters)).conflicts.length,1,'administrative conflict must block');
const many={...old,history:Array.from({length:26},(_,i)=>({savedAt:DAY+'T07:'+String(i).padStart(2,'0')+':00Z',data:{...old.data,data_giudizio:'2026-09-30',note:String(i)}}))};
assert.equal(resolve([many],packet(signed)).conflicts.length,1,'no implicit history truncation');
assert.throws(()=>resolve([],{}),/non valido/);
console.log('PASS: 10 checks — import, history, signed snapshot, idempotence, conflicts, dates, conteggio, history cap, file validation. Synthetic data only.');
