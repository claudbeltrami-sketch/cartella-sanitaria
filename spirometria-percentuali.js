/* ERS/ECSC 1993, Quanjer et al., table 6.
 * https://doi.org/10.1183/09041950.005s1693
 * Height in metres; age in completed years (18–25 uses 25).
 * These published equations are not a certified reproduction of SP10 firmware.
 */
(function(root){
'use strict';
const MODEL='ERS-ECSC-1993-v1', keys=['fvc','fev1','pef'];
function number(value){const s=String(value??'').trim();return /^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(s)?Number(s.replace(',','.')):NaN;}
function date(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;
 const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?d:null;
}
function predict(sex,height,birth,exam){
 const b=date(birth),e=date(exam);
 if(!b||!e||e<b)return {error:'CONTROLLARE DATA DI NASCITA E DATA DELLA VISITA.'};
 const age=e.getUTCFullYear()-b.getUTCFullYear()-(exam.slice(5)<birth.slice(5)?1:0);
 return predictAge(sex,height,age,exam);
}
function predictAge(sex,height,age,exam){
 const h=number(height)/100;
 if(!['M','F'].includes(sex)||!Number.isFinite(h)||h<1.2||h>2.2)return {error:'SERVONO SESSO E ALTEZZA VALIDI.'};
 if(!Number.isInteger(age)||age<18||age>100)return {error:'CALCOLO ERS ADULTI NON DISPONIBILE PER QUESTA ETÀ; INSERIRE LE % DELLO STRUMENTO.'};
 const a=Math.max(25,age),m=sex==='M';
 const predicted=m?{fvc:5.76*h-0.026*a-4.34,fev1:4.30*h-0.029*a-2.49,pef:6.14*h-0.043*a+0.15}:
  {fvc:4.43*h-0.026*a-2.89,fev1:3.95*h-0.025*a-2.60,pef:5.50*h-0.030*a-1.11};
 if(keys.some(k=>predicted[k]<=0))return {error:'VALORI TEORICI NON VALIDI; INSERIRE LE % DELLO STRUMENTO.'};
 const extrapolated=age>70||h<(m?1.55:1.45)||h>(m?1.95:1.80);
 return {model:MODEL,age,ageUsed:a,heightCm:h*100,sex,exam,predicted,extrapolated};
}
if(typeof module==='object'&&module.exports)module.exports={predict,number};
if(!root.document)return;
const $=id=>root.document.getElementById(id),value=id=>$(id)?.value||'';
const isTest=root.lumenStorage?.isTest===true;
if($('spirometria_prova_controls'))$('spirometria_prova_controls').hidden=!isTest;
let requested=false;
function reference(){
 const sex=value('sesso'),height=value('altezza'),birth=value('data_nascita'),exam=value('data_giudizio')||value('data_cartella');
 const missing=[];
 if(!['M','F'].includes(sex))missing.push('SESSO (M/F)');
 if(!Number.isFinite(number(height))||number(height)<120||number(height)>220)missing.push('ALTEZZA IN CM (120–220)');
 if(!date(exam))missing.push('DATA DELLA VISITA');
 if(isTest){
  const age=number(value('spirometria_eta_prova'));
  if(!Number.isInteger(age)||age<18||age>100)missing.push('ETÀ DI PROVA (18–100 ANNI INTERI)');
  if(missing.length)return {error:'COMPILARE O CORREGGERE: '+missing.join(', ')+'.'};
  return {...predictAge(sex,height,age,exam),simulation:true};
 }
 if(!date(birth))missing.push('DATA DI NASCITA');
 if(missing.length)return {error:'COMPILARE O CORREGGERE: '+missing.join(', ')+'.'};
 return predict(sex,height,birth,exam);
}
function read(){try{const m=JSON.parse(value('spirometria_calcolo'));return m&&m.model===MODEL&&m.fields&&typeof m.fields==='object'?m:{model:MODEL,fields:{}};}catch(_){return {model:MODEL,fields:{}};}}
function write(m){$('spirometria_calcolo').value=JSON.stringify(m);}
function pefLs(pef){return value('spirometria_pef_unita')==='L/min'?pef/60:pef;}
function update(){
 if(!$('spirometria_calcolo'))return;
 const m=read(),p=reference();
 if(!value('spirometria_pef_unita'))$('spirometria_pef_unita').value=number(value('spirometria_pef'))>25?'L/min':'L/s';
 const any=keys.some(k=>value('spirometria_'+k)||value('spirometria_'+k+'_percentuale'));
 const labels=[];
 keys.forEach(k=>{
  const el=$('spirometria_'+k+'_percentuale'),current=el.value;
  let f=m.fields[k];
  if(!f||!['auto','manual'].includes(f.mode))f={mode:current?'manual':'auto',last:current};
  if(f.mode==='auto'&&current!==f.last)f={mode:'manual',last:current};
  let measured=number(value('spirometria_'+k));if(k==='pef')measured=pefLs(measured);
  if(f.mode==='auto'){
   el.value=!p.error&&Number.isFinite(measured)&&measured>0?String(Math.round(measured/p.predicted[k]*100)):'';
   f.last=el.value;
  }
  el.dataset.percentOrigin=f.mode;
  el.title=f.mode==='auto'?'Percentuale calcolata con ERS/ECSC 1993; modificabile':'Percentuale inserita o conservata: non ricalcolata';
  labels.push(k.toUpperCase()+': '+(f.mode==='auto'?'AUTO':'INSERITA'));
  m.fields[k]=f;
 });
 m.reference=p;m.pefUnit=value('spirometria_pef_unita');write(m);
 const hasAuto=keys.some(k=>m.fields[k].mode==='auto'&&value('spirometria_'+k));
 const note=$('spirometria_calcolo_nota'),blocked=!!p.error&&(hasAuto||requested);note.hidden=!(any||requested);
 note.dataset.state=blocked?'warning':'ready';
 note.textContent=blocked?'CALCOLO NON ESEGUITO — '+p.error:
  any?labels.join(' · ')+(hasAuto?' — '+(p.simulation?'SIMULAZIONE, ETÀ DI PROVA '+p.age+' ANNI. ':'')+'ERS/ECSC 1993, '+p.age+' ANNI.'+(p.age<25?' ETÀ DI CALCOLO: 25.':'')+(p.extrapolated?' ESTRAPOLAZIONE FUORI INTERVALLO DI RIFERIMENTO: VERIFICARE LE % DELLO STRUMENTO.':''):''):
  requested?'INSERIRE I VALORI MISURATI DI FVC, FEV1 E PEF.':'';
 $('spirometria_pef_unita_stampa').textContent=' ('+value('spirometria_pef_unita')+')';
}
keys.forEach(k=>{
 const el=$('spirometria_'+k+'_percentuale');
 for(const event of ['input','change'])el.addEventListener(event,function(){const m=read();m.fields[k]={mode:'manual',last:el.value};write(m);});
});
for(const id of ['sesso','altezza','data_nascita','data_giudizio','data_cartella','spirometria_pef_unita','spirometria_eta_prova']){
 for(const event of ['input','change'])$(id)?.addEventListener(event,()=>root.aggiornaSpirometriaAuto?.());
}
$('spirometria_ricalcola').addEventListener('click',()=>{
 const m=read();keys.forEach(k=>{m.fields[k]={mode:'auto',last:value('spirometria_'+k+'_percentuale')};});write(m);
 requested=true;try{if(root.aggiornaSpirometriaAuto)root.aggiornaSpirometriaAuto();else update();}finally{requested=false;}
});
root.lumenSpirometriaPercentuali={update,predict,pefLs};
})(typeof window==='undefined'?globalThis:window);
