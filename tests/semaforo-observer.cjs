const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf(' function updateSemaforo(');
const source=html.slice(start,html.indexOf(' function addControls(){',start));
for(const state of ['green','yellow','red','white'])for(const alcohol of [false,true]){
 let mutations=0;
 const element=()=>{let text='';return {get textContent(){return text},set textContent(value){text=value;mutations++},dataset:{},setAttribute(){}}};
 const badge=element(),reason=element();
 const context={semaforoEsami:()=>({state,text:state==='yellow'?'DA VERIFICARE':'COMPLETI',detail:'Dettaglio'}),navigator:{userAgent:'Mac'},localRefertiById:new Map(),verificationFlagsById:new Map()};
 vm.createContext(context);vm.runInContext(source,context);
 const row={querySelector:selector=>selector==='.archive-semaforo'?badge:reason};
 const record={id:'synthetic'},flags={alcoholOnlyNotice:alcohol};
 const before=JSON.stringify(record);
 let pending=true,passes=0;
 // Every textContent assignment produces a child-list mutation, even for identical text.
 while(pending&&passes<10){const count=mutations;context.updateSemaforo(record,row,flags);pending=mutations>count;passes++}
 assert.equal(pending,false,`${state}, alcohol=${alcohol}: observer must settle`);
 assert.ok(passes<=2);
 assert.equal(badge.dataset.light,alcohol?'yellow':state);
 if(alcohol){assert.equal(badge.textContent,'Esami: DA VERIFICARE');assert.match(reason.textContent,/etanolo urinario/)}
 assert.equal(JSON.stringify(record),before);
}
console.log('PASS: observer settles for all lights with/without alcohol notice; warning retained; clinical record unchanged.');
