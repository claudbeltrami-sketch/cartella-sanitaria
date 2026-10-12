/* LUMEN: protocol suggestions only; no clinical record is modified automatically. */
(function(root){
 'use strict';
 const norm=x=>String(x||'').trim().toLocaleUpperCase('it-IT').replace(/\s+/g,' ');
 const profiles=[
  {match:/MAGAZZIN/,role:'magazziniere',risks:['MOVIMENTAZIONE MANUALE DEI CARICHI','POSTURA','IMPEGNO ARTI SUP - MOV. RIP.'],exams:['VISITA MEDICA','ESAME FUNZIONALE DEL RACHIDE']},
  {match:/IMPIEGAT|VIDEOTERMINAL|UFFICIO/,role:'impiegato',risks:['VIDEOTERMINALE','POSTURA'],exams:['VISITA MEDICA','VISIOTEST']},
  {match:/AUTIST|CONDUCEN/,role:'autista',risks:['POSTURA','VIBRAZIONI'],exams:['VISITA MEDICA']},
  {match:/PULIZI|ADDETT.*IGIEN/,role:'pulizie',risks:['MOVIMENTAZIONE MANUALE DEI CARICHI','POSTURA','IMPEGNO ARTI SUP - MOV. RIP.'],exams:['VISITA MEDICA','ESAME FUNZIONALE DEL RACHIDE']},
  {match:/OPERAI/,role:'operaio',risks:['MOVIMENTAZIONE MANUALE DEI CARICHI','POSTURA','IMPEGNO ARTI SUP - MOV. RIP.'],exams:['VISITA MEDICA','ESAME FUNZIONALE DEL RACHIDE']}
 ];
 function proposed(mansione){const p=profiles.find(x=>x.match.test(norm(mansione)));return p?{source:'STANDARD DA VERIFICARE',role:p.role,rischi:[...p.risks],protocollo:[...p.exams]}:null}
 function resolve({mansione,committente,datore,aziendali=[]}={}){
  const m=norm(mansione),c=norm(committente),d=norm(datore);
  if(!m)return null;
  const candidates=aziendali.filter(p=>p&&norm(p.mansione)===m&&norm(p.datore)===d&&d);
  if(candidates.length>1)return{source:'AMBIGUO',requiresReview:true};
  if(candidates.length===1){
   const p=candidates[0];
   if(p.committente&&norm(p.committente)!==c)return{source:'AZIENDALE NON CONFERMATO',requiresReview:true};
   return{source:'AZIENDALE',requiresReview:true,rischi:[...(p.rischi||[])],protocollo:[...(p.protocollo||[])],periodicita:p.periodicita||''};
  }
  const p=proposed(m);
  return p?{...p,requiresReview:true}:null;
 }
 root.lumenProtocolSuggestions={proposed,resolve};
})(typeof window!=='undefined'?window:globalThis);
