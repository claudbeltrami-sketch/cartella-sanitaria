// Real rendering checks. All records and the worker signature are synthetic.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/print-layout');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=new URL(req.url,'http://localhost').pathname;
  if(!['/','/index.html','/cambia-lista.js'].includes(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');
  res.end(fs.readFileSync(path.join(root,file==='/'?'index.html':file.slice(1))));
});
const fixture={
 cognome:'PROVA',nome:'COLLAUDO',luogo_nascita:'ROMA',data_nascita:'1980-01-01',sesso:'M',
 codice_fiscale:'TSTPRV80A01H501X',domicilio:'INDIRIZZO FITTIZIO PER COLLAUDO',telefono:'0000000000',
 stato_civile:'CELIBE/NUBILE',medico_curante:'MEDICO DI PROVA',via_medico:'INDIRIZZO DI PROVA',telefono_medico:'0000000000',
 datore_lavoro:'AZIENDA FITTIZIA DI COLLAUDO',attivita_azienda:'COMMERCIALE',data_assunzione:'2026-01-01',
 sede_lavoro:'SEDE DI PROVA',prima_istituzione:true,mansione:'COMMESSO QUALIFICATO',tempo_esposizione:'220',
 data_cartella:'2026-09-12',data_dichiarazione:'2026-09-12',data_giudizio:'2026-09-12',luogo_visita:'ROMA',
 rischi:['MOVIMENTAZIONE MANUALE DEI CARICHI','IMPEGNO ARTI SUP - MOV. RIP.'],
 protocollo:['VISITA MEDICA','AUDIOMETRIA','SPIROMETRIA BASALE','VISIOTEST'],
 anamnesi_lavorativa:'ATTIVITÀ COMMERCIALE. MOVIMENTAZIONE DI MERCI E SERVIZIO ALLA CLIENTELA.',
 anamnesi_familiare:'INFORMAZIONI FITTIZIE PER LA SOLA VERIFICA DI IMPAGINAZIONE.',
 anamnesi_patologica:'TESTO DI PROVA. NESSUN DATO SANITARIO REALE.',
 non_fumatore:true,farmaci:'NESSUNO',infortuni:'NESSUNO',invalidita_stato:'NO',altre_notizie:'DATI DI COLLAUDO.',
 altezza:'175',peso:'70',pas:'120',pad:'80',polso:'70',cute:'NDR',torace:'NDR',cuore:'NDR',addome:'NDR',
 organi_ipocondriaci:'NDR',genito_urinario:'NDR',rachide:'NDR',arti:'NDR',sistema_nervoso:'NDR',
 altri_rilievi:'DATI DI COLLAUDO SENZA VALORE CLINICO.',giudizio:'IDONEO',periodicita:'ANNUALE',periodicita_protocollo:'ANNUALE',
 prescrizioni:'TESTO DI PROVA PER LA VERIFICA DELLE FIRME.',data_trasmissione:'2026-09-12',mezzo_trasmissione:'CONSEGNA',
 audio_dx_500:'15',audio_dx_1000:'15',audio_dx_2000:'20',audio_dx_4000:'20',
 audio_sx_500:'15',audio_sx_1000:'20',audio_sx_2000:'20',audio_sx_4000:'20',
 spirometria_fvc:'4.0',spirometria_fvc_percentuale:'100',spirometria_fev1:'3.2',spirometria_fev1_percentuale:'98',
 spirometria_pef:'480',spirometria_pef_percentuale:'95',visiotest_esito:'NORMALE CON CORREZIONE',visiotest_note:'OCCHIALI',
 altri_accertamenti:'NESSUNO'
};
async function snapshot(page){return page.evaluate(async()=>({
 data:window.lumenBatchCertApi.collect(),
 storage:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])),
 archive:await listCartelleArchive(),
 signatures:[...document.querySelectorAll('#cartellaForm img')].map(x=>x.getAttribute('src')),
 fields:document.querySelectorAll('#cartellaForm input,#cartellaForm select,#cartellaForm textarea').length
}));}
async function readyImages(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#cartellaForm img[src]')].map(i=>i.decode()));});}
async function prepare(page){
 // Match the A4 content area for DOM measurements; PDF pagination uses @page.
 await page.setViewportSize({width:Math.round(186*96/25.4),height:1100});
 await page.emulateMedia({media:'print'});
 await page.evaluate(()=>{document.body.className='print-cartella';window.dispatchEvent(new Event('beforeprint'));});
 await readyImages(page);
}
async function cleanup(page){
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await page.emulateMedia({media:'screen'});
 assert.equal(await page.locator('.lumen-print-value,.lumen-print-source').count(),0,'Temporary print nodes must be removed');
}
async function metrics(page){return page.evaluate(()=>{
 const pages=[...document.querySelectorAll('#cartellaForm>.page')];
 return pages.map((p,index)=>{
  const r=p.getBoundingClientRect();
  const overflow=[...p.querySelectorAll('.lumen-print-value,label,.check,.signature-grid,svg')].filter(el=>{
   const b=el.getBoundingClientRect();return b.width>0&&b.height>0&&(b.left<r.left-1||b.right>r.right+1);
  }).map(el=>({tag:el.tagName,text:el.textContent.slice(0,90)}));
  return {page:index+1,height:r.height,width:r.width,overflow};
 });
});}
async function run(engine,name,viewport){
 const browser=await engine.launch({headless:true});
 try{
 const context=await browser.newContext({viewport});
 const page=await context.newPage();
 page.setDefaultTimeout(15000);
 page.on('dialog',dialog=>dialog.accept());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin=`http://127.0.0.1:${server.address().port}`;
 await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await page.goto(origin,{waitUntil:'load'});
 await page.waitForFunction(()=>!!window.lumenBatchCertApi);
 console.log(`${name}: application loaded`);
 await page.evaluate(async d=>{
  const c=document.createElement('canvas');c.width=600;c.height=160;
  const ctx=c.getContext('2d');ctx.font='italic 44px sans-serif';ctx.fillText('FIRMA DI PROVA',25,100);
  d.firma_lavoratore_png=c.toDataURL('image/png');
  window.lumenBatchCertApi.apply(d);
  await saveToLocalArchive();
  const id=window.lumenBatchCertApi.cartellaId(d);
  window.lumenBatchCertApi.apply({});
  await openArchiveRecord(id);
 },fixture);
 await readyImages(page);
 console.log(`${name}: saved record reopened`);
 assert.equal(await page.locator('#cognome').inputValue(),'PROVA');
 assert.ok(await page.locator('#cartellaFinaleWorkerSignature').getAttribute('src'),'Reopened worker signature');
 const before=await snapshot(page);
 await prepare(page);
 const layout=await metrics(page);
 fs.writeFileSync(path.join(out,`${name}-metrics.json`),JSON.stringify(layout,null,2));
 for(let i=0;i<5;i++)await page.locator('#cartellaForm>.page').nth(i).screenshot({path:path.join(out,`${name}-section-${i+1}.png`)});
 if(name.startsWith('chromium'))await page.pdf({path:path.join(out,`${name}-standard.pdf`),preferCSSPageSize:true,printBackground:true});
 await cleanup(page);
 assert.deepEqual(await snapshot(page),before,'Printing must not modify records, stored signatures, fields or archive history');
 assert.ok(layout.every(p=>p.overflow.length===0),`${name}: horizontal overflow: ${JSON.stringify(layout)}`);
 // Cancel a native print, then edit and repeat: no old text or duplicate print fields.
 await page.locator('#altri_rilievi').fill('AGGIORNAMENTO DI PROVA');
 await page.emulateMedia({media:'print'});
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 assert.equal(await page.locator('#altri_rilievi + .lumen-print-value').textContent(),'AGGIORNAMENTO DI PROVA');
 const count=await page.locator('.lumen-print-value').count();
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 assert.equal(await page.locator('.lumen-print-value').count(),count);
 await cleanup(page);
 if(name==='chromium-desktop'){
  // Empty exam values must never cause a graph or an interpretation to appear.
  await page.evaluate(()=>window.lumenBatchCertApi.apply({cognome:'PROVA',nome:'SENZA ESAMI'}));
  await prepare(page);
  assert.equal(await page.locator('#audiogrammaBox').isVisible(),false);
  assert.equal(await page.locator('#spirometryCharts').isVisible(),false);
  await page.pdf({path:path.join(out,'senza-esami.pdf'),preferCSSPageSize:true,printBackground:true});
  await cleanup(page);
  // More than one full page of prose must remain complete and readable.
  await page.evaluate(d=>{
   window.lumenBatchCertApi.apply(d);
   document.getElementById('anamnesi_lavorativa').value=Array.from({length:130},(_,i)=>`RIGA ${String(i+1).padStart(3,'0')}: NOTA DI COLLAUDO PER VERIFICARE IL TESTO COMPLETO SENZA TAGLI.`).join('\n');
   document.getElementById('altri_rilievi').value='ULTIMA NOTA CLINICA DI COLLAUDO';
   document.getElementById('prescrizioni').value='FINE PRESCRIZIONI DI COLLAUDO';
  },fixture);
  const longBefore=await snapshot(page);
  await prepare(page);
  await page.pdf({path:path.join(out,'testi-lunghi.pdf'),preferCSSPageSize:true,printBackground:true});
  await cleanup(page);
  assert.deepEqual(await snapshot(page),longBefore);
 }
 assert.deepEqual(errors,[],`${name}: JavaScript errors`);
 console.log(`PASS ${name}: print rendering, archive reopen, signatures, cancellation and repeated printing`);
 }finally{await browser.close();}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  await run(chromium,'chromium-desktop',{width:1440,height:1000});
  await run(chromium,'chromium-mobile',{width:390,height:844});
  await run(webkit,'webkit',{width:390,height:844});
 }finally{server.close();}
})().catch(e=>{fs.writeFileSync(path.join(out,'browser-error.txt'),String(e.stack||e));console.error(e);process.exitCode=1;});
