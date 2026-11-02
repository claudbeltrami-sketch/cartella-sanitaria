/* MIME round-trip and real certificate PDF geometry, synthetic data only. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {PDFDocument}=require('pdf-lib'),mail=require('../certificati-email.js');
const html=fs.readFileSync('index.html','utf8');
const doctorImage=html.match(/class="firma-timbro-incorporata"[^>]*><img src="([^"]+)"/)[1];
const window={PDFLib:require('pdf-lib')};new Function('window','Blob',fs.readFileSync('certificato-pdf.js','utf8'))(window,Blob);
const base={lavoratore:'COLLAUDO EMAIL',sesso:'M',luogo:'ROMA',data_nascita:'01/01/1980',codice_fiscale:'',azienda:'AZIENDA FITTIZIA SPA',mansione:'ADDETTO ALLE PULIZIE',data_visita:'02/11/2026',periodicita:'ANNUALE',prossima_visita:'',luogo_visita:'SERMONETA',rischi:'MOVIMENTAZIONE MANUALE DEI CARICHI, IMPEGNO ARTI SUP - MOV. RIP., ALCOL/DRUG TEST',giudizio:'IDONEO',prescrizioni:'',luogo_data:'SERMONETA, 02/11/2026',doctor:'Dott. Claudio Beltrami - Medico Competente n. 22294 - Ordine dei Medici di Latina n. 982\nSpecialista in Igiene e Medicina Preventiva',doctorImage,workerImage:doctorImage,barcode:{bars:[],text:''},test:false};
(async()=>{
 fs.mkdirSync('tmp/email-qa',{recursive:true});
 for(const [name,rows] of [['singolo',[base]],['lista',[base,{...base,lavoratore:'COLLAUDO SECONDO',prescrizioni:'Prescrizioni di prova. Verificare la presenza integrale nel PDF.'}]]]){
  const pdf=await window.lumenCertificatePdf.create();for(const data of rows)await pdf.addCertificate(data);const blob=await pdf.toBlob(),bytes=Buffer.from(await blob.arrayBuffer());
  const parsed=await PDFDocument.load(bytes);assert.equal(parsed.getPageCount(),rows.length);
  for(const p of parsed.getPages()){assert.ok(Math.abs(p.getWidth()-595.2756)<.01);assert.ok(Math.abs(p.getHeight()-841.8898)<.01);}
  fs.writeFileSync('tmp/email-qa/'+name+'.pdf',bytes);
  const subject='Certificati di idoneità – '+('verifica àèìòù '.repeat(12));
  const result=await mail.createMessage({to:'destinatario@example.test',subject,body:'Buongiorno Ilario,\n\nCertificati già allegati.\nCordiali saluti',blob,fileName:name+'.pdf'});
  fs.writeFileSync('tmp/email-qa/'+name+'.eml',Buffer.from(await result.arrayBuffer()));
 }
 for(const bad of ['a@example.test\r\nBcc: other@example.test','a@example.test,b@example.test','a@example.test?subject=bad','not-an-email'])assert.throws(()=>mail.validateEmail(bad));
 await assert.rejects(mail.createMessage({to:'ok@example.test',subject:'ok\r\nBcc: x',body:'text',blob:new Blob(['%PDF-test'],{type:'application/pdf'}),fileName:'x.pdf'}));
 await assert.rejects(mail.createMessage({to:'ok@example.test',subject:'ok',body:'text',blob:new Blob(['not pdf'],{type:'application/pdf'}),fileName:'x.pdf'}));
 const pdf=await window.lumenCertificatePdf.create();await assert.rejects(pdf.addCertificate({...base,prescrizioni:'Testo lungo '.repeat(2000)}));
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];for(const m of scripts)new Function(m[1]);
 console.log('OK: MIME generation, single-recipient validation, no header injection, A4 PDF with one page per worker; overflow rejected; inline syntax.');
})().catch(e=>{console.error(e);process.exitCode=1});
