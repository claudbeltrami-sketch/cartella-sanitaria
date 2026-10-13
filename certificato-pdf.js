/* One device-independent A4 certificate. No viewport, canvas or system fonts.
   Read an immutable snapshot of the populated certificate; never write records. */
(function () {
 'use strict';
 const VERSION='20261013-a4-1', MM=72/25.4, WIDTH=210*MM, HEIGHT=297*MM;
 const MARGIN=10*MM, CONTENT=WIDTH-2*MARGIN;
 const fields=['lavoratore','sesso','luogo','data_nascita','codice_fiscale','azienda','mansione',
  'data_visita','periodicita','prossima_visita','luogo_visita','rischi','giudizio','prescrizioni','luogo_data'];
 function snapshot() {
  const root=document.getElementById('certificate');
  if(!root)throw Error('Certificato non disponibile.');
  const data={};
  for(const key of fields)data[key]=root.querySelector('#c_'+key)?.textContent||'';
  const doctor=root.querySelector('.doctor');
  data.doctor=[...doctor.childNodes].map(n=>n.nodeName==='BR'?'\n':n.textContent).join('');
  data.doctorImage=root.querySelector('.firma-timbro-incorporata img')?.getAttribute('src')||'';
  const worker=root.querySelector('#certWorkerSignature');
  data.workerImage=worker?.classList.contains('has-signature')?worker.getAttribute('src')||'':'';
  data.test=!!window.lumenStorage?.isTest;
  const svg=root.querySelector('#c_cf_barcode');
  const viewBox=svg.getAttribute('viewBox').split(/\s+/).map(Number);
  data.barcode={width:viewBox[2],height:viewBox[3],
   text:svg.querySelector('text')?.textContent||'',
   bars:[...svg.querySelectorAll('rect')].map(r=>Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(r.getAttribute(k))])))};
  return data;
 }
 async function create() {
  const lib=window.PDFLib;
  if(!lib)throw Error('Modulo PDF non disponibile. Ricaricare LUMEN e riprovare.');
  // No automatic timestamps or random identifiers: identical snapshots produce
  // identical bytes, including repeated downloads and different browser engines.
  const pdf=await lib.PDFDocument.create({updateMetadata:false});
  pdf.setProducer('LUMEN - Certificato A4 '+VERSION);
  pdf.setCreator('LUMEN');pdf.setTitle('CERTIFICATO DI IDONEITÀ ALLA MANSIONE');
  const regular=await pdf.embedFont(lib.StandardFonts.Helvetica);
  const bold=await pdf.embedFont(lib.StandardFonts.HelveticaBold);
  const italic=await pdf.embedFont(lib.StandardFonts.HelveticaOblique);
  const images=new Map(),ink=lib.rgb(0,0,0),rule=lib.rgb(.35,.35,.35);
  function clean(value) {return String(value||'').normalize('NFC').replace(/\r\n?/g,'\n').replace(/[\t\u00a0]/g,' ');}
  function wrap(value,font,size,width,label) {
   const text=clean(value),lines=[];
   try{font.encodeText(text.replace(/\n/g,''));}
   catch(_){throw Error('Il campo «'+label+'» contiene un carattere non supportato dal PDF. Correggere il carattere e riprovare: nessun testo è stato omesso.');}
   for(const paragraph of text.split('\n')){
    let line='';
    for(const word of paragraph.split(/ +/).filter(Boolean)){
     const candidate=line?line+' '+word:word;
     if(font.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}
     if(line){lines.push(line);line='';}
     for(const character of word){
      if(line&&font.widthOfTextAtSize(line+character,size)>width){lines.push(line);line='';}
      line+=character;
     }
    }
    lines.push(line);
   }
   return lines.length?lines:[''];
  }
  async function embedImage(src,label) {
   if(!src)return null;
   if(images.has(src))return images.get(src);
   if(!/^data:image\/(png|jpe?g);base64,/i.test(src))throw Error(label+': formato immagine non supportato.');
   try{
    const image=/^data:image\/png/i.test(src)?await pdf.embedPng(src):await pdf.embedJpg(src);
    images.set(src,image);return image;
   }catch(_){throw Error(label+' non leggibile: PDF non creato.');}
  }
  async function addCertificate(data) {
   // All layout is measured in PDF points using the same built-in font metrics.
   const gap=10,pad=6,inner=CONTENT-2*pad,column=(inner-gap)/2;
   const field=(label,value,width,size=10.5,min=1)=>{
    const lines=wrap(value,bold,size,width-4,label);
    return {label,lines,width,size,height:12+Math.max(min,lines.length)*12+2};
   };
   const row=(...cells)=>({cells,height:Math.max(...cells.map(c=>c.height))});
   const group=(title,rows)=>({title,rows,height:pad+16+rows.reduce((n,r)=>n+r.height,0)+(rows.length-1)*4+pad});
   const bc=data.barcode;
   if(data.codice_fiscale&&(!bc?.bars?.length||bc.text!==data.codice_fiscale))
    throw Error('Barcode non corrispondente al codice fiscale: rigenerare il certificato.');
   const barcode={barcode:bc,width:195,height:52};
   const worker=group('DATI DEL LAVORATORE',[
    row(field('Cognome e nome',data.lavoratore,column),field('Sesso',data.sesso,column)),
    row(field('Luogo di nascita',data.luogo,column),field('Data di nascita',data.data_nascita,column)),
    row(field('Codice fiscale',data.codice_fiscale,inner-gap-barcode.width),barcode),
    row(field('Azienda',data.azienda,inner)),row(field('Mansione',data.mansione,inner))]);
   const visit=group('VISITA MEDICA',[
    row(field('Data visita',data.data_visita,column),field('Periodicità',data.periodicita,column)),
    ...(data.prossima_visita?[row(field('Prossima visita',data.prossima_visita,inner))]:[]),
    row(field('Luogo di visita',data.luogo_visita,inner)),row(field('Rischi lavorativi',data.rischi,inner))]);
   const judgement=group('GIUDIZIO DI IDONEITÀ',[
    {cells:[{...field('',data.giudizio,inner,12),height:18}],height:18},
    row(field('Prescrizioni / limitazioni',data.prescrizioni,inner,10.5,2))]);
   // A multi-line judgement must also reserve its full measured height.
   judgement.rows[0].height=Math.max(18,judgement.rows[0].cells[0].lines.length*15+3);
   judgement.height=pad+16+judgement.rows[0].height+4+judgement.rows[1].height+pad;
   const doctor=wrap(data.doctor,regular,9.5,CONTENT-12,'Intestazione medico');
   const notice=wrap('Il presente giudizio viene rilasciato al lavoratore e al datore di lavoro nei termini previsti dalla normativa vigente.',regular,10,CONTENT,'Nota');
   const place=wrap(data.luogo_data,bold,10.5,column-4,'Luogo e data');
   const start=18+(data.test?24:0),headerHeight=39+doctor.length*12+12;
   const noticeHeight=notice.length*13;
   const signatureHeight=Math.max(80,17+place.length*12);
   const end=start+headerHeight+worker.height+visit.height+judgement.height+18+noticeHeight+10+signatureHeight+73;
   if(end>HEIGHT-18)throw Error('Il contenuto del certificato supera lo spazio del modello A4 ('+data.lavoratore+'). PDF non creato: nessun campo o firma è stato tagliato.');
   if(!data.doctorImage)throw Error('Firma e timbro del medico mancanti: PDF non creato.');
   const doctorImage=await embedImage(data.doctorImage,'Firma e timbro del medico');
   const workerImage=await embedImage(data.workerImage,'Firma del lavoratore');
   const page=pdf.addPage([WIDTH,HEIGHT]);
   function text(value,x,top,font=regular,size=10){if(value)page.drawText(value,{x,y:HEIGHT-top-size,font,size,color:ink});}
   function line(x,top,width){page.drawLine({start:{x,y:HEIGHT-top},end:{x:x+width,y:HEIGHT-top},thickness:.45,color:rule});}
   function rect(x,top,width,height){page.drawRectangle({x,y:HEIGHT-top-height,width,height,borderWidth:.6,borderColor:rule});}
   function centered(value,x,top,width,font=bold,size=11){text(value,x+(width-font.widthOfTextAtSize(value,size))/2,top,font,size);}
   function drawImage(image,x,top,width,height){
    if(!image)return;
    const scale=Math.min(width/image.width,height/image.height),w=image.width*scale,h=image.height*scale;
    page.drawImage(image,{x:x+(width-w)/2,y:HEIGHT-top-h,width:w,height:h});
   }
   function drawBarcode(cell,x,top){
    rect(x,top,cell.width,cell.height);centered('BARCODE CF',x,top+3,cell.width,bold,7);
    const code=cell.barcode;
    if(!code?.bars.length)return;
    // Quiet zones of at least ten narrow modules are part of the PDF geometry.
    const quiet=20,sx=(cell.width-10)/(code.width+quiet*2),barTop=top+14;
    for(const bar of code.bars)page.drawRectangle({x:x+5+(quiet+bar.x)*sx,y:HEIGHT-barTop-29,width:bar.width*sx,height:29,color:ink});
    centered(code.text,x,top+44,cell.width,regular,6);
   }
   function drawGroup(block,top){
    rect(MARGIN,top,CONTENT,block.height);text(block.title,MARGIN+pad,top+pad,bold,11.5);
    let y=top+pad+16;
    for(const r of block.rows){
     let x=MARGIN+pad;
     for(const cell of r.cells){
      if(cell.barcode){drawBarcode(cell,x,y);x+=cell.width+gap;continue;}
      if(cell.label)text(cell.label,x,y,regular,10);
      const valueTop=y+(cell.label?12:0),leading=cell.size===12?15:12;
      cell.lines.forEach((s,i)=>text(s,x+2,valueTop+i*leading,bold,cell.size));
      line(x,y+r.height-1,cell.width);x+=cell.width+gap;
     }
     y+=r.height+4;
    }
   }
   if(data.test){rect(MARGIN,18,CONTENT,19);centered('PROVA FANTASMA - DOCUMENTO DI PROVA',MARGIN,21,CONTENT,bold,10);}
   let y=start;
   centered('CERTIFICATO DI IDONEITÀ ALLA MANSIONE',MARGIN,y,CONTENT,bold,14);
   centered('ai sensi del D.Lgs. 81/2008 e s.m.i.',MARGIN,y+19,CONTENT,italic,10);
   y+=39;rect(MARGIN,y,CONTENT,doctor.length*12+12);
   doctor.forEach((s,i)=>text(s,MARGIN+6,y+6+i*12,regular,9.5));y+=doctor.length*12+12;
   for(const block of [worker,visit,judgement]){y+=6;drawGroup(block,y);y+=block.height;}
   notice.forEach((s,i)=>text(s,MARGIN,y+6+i*13,regular,10));y+=6+noticeHeight+10;
   centered('Luogo e data',MARGIN,y,column,bold,11);
   place.forEach((s,i)=>centered(s,MARGIN,y+17+i*12,column,bold,10.5));
   line(MARGIN,y+17+place.length*12+2,column);
   const right=WIDTH-MARGIN-column;
   centered('Firma e timbro del Medico Competente',right,y,column,bold,10.5);
   drawImage(doctorImage,right+5,y+17,column-10,57);line(right,y+78,column);
   y+=signatureHeight;
   centered('Firma del lavoratore per ricevuta',MARGIN,y,column,bold,10.5);
   drawImage(workerImage,MARGIN+5,y+18,column-10,45);line(MARGIN,y+66,column);
  }
  async function toBlob(){
   if(!pdf.getPageCount())throw Error('Nessun certificato da esportare.');
   return new Blob([await pdf.save({useObjectStreams:false})],{type:'application/pdf'});
  }
  return {addCertificate,toBlob};
 }
 async function current(){const data=snapshot(),pdf=await create();await pdf.addCertificate(data);return pdf.toBlob();}
 window.lumenCertificatePdf=Object.freeze({version:VERSION,snapshot,create,current});
})();
