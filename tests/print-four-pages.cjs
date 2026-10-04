const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/quattro-pagine');fs.mkdirSync(out,{recursive:true});
const fixture=vm.runInNewContext('('+fs.readFileSync(path.join(__dirname,'print-layout.cjs'),'utf8').match(/const fixture=(\{[\s\S]*?\n\});/)[1]+')');
Object.assign(fixture,{nome:'FANTASMA',codice_fiscale:'',data_nascita:'',lumen_prova:true,accertamenti_integrativi:'NESSUN ULTERIORE ACCERTAMENTO. TESTO FITTIZIO.',valutazioni_conclusive:'VALUTAZIONE FITTIZIA PER COLLAUDO.'});
const server=require('./local-server.cjs')(root);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1100,height:900}});
 page.on('dialog',d=>d.dismiss());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin='http://127.0.0.1:'+server.address().port;
 await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await page.goto(origin+'/?prova=fantasma');
 await page.waitForFunction(()=>window.lumenBatchCertApi&&document.getElementById('nome').value==='FANTASMA');
 const signature=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=160;const x=c.getContext('2d');x.font='italic 44px sans-serif';x.fillText('FIRMA DI PROVA',25,100);return c.toDataURL()});
 fixture.firma_lavoratore_png=signature;
 async function pdf(name,data,expected){
  await page.evaluate(d=>window.lumenBatchCertApi.apply(d),data);
  const before=await page.evaluate(()=>JSON.stringify({data:window.lumenBatchCertApi.collect(),storage:{...localStorage}}));
  await page.setViewportSize({width:703,height:1100});await page.emulateMedia({media:'print'});
  await page.evaluate(()=>{document.body.className='print-cartella';window.dispatchEvent(new Event('beforeprint'))});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#cartellaForm img[src]')].map(i=>i.decode()))});
  const metrics=await page.locator('#cartellaForm>.page').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));console.log(name,metrics);
  const file=path.join(out,name+'.pdf');await page.pdf({path:file,preferCSSPageSize:true,printBackground:true});
  execFileSync('python',['-c',[
   'import fitz,sys',
   'p=fitz.open(sys.argv[1]); expected=int(sys.argv[2]); t="\\n".join(x.get_text() for x in p)',
   'print(sys.argv[1], "pages", len(p), flush=True)',
   'assert expected==0 or len(p)==expected,(len(p),expected)',
   'assert all(s in t for s in ["1. ANAMNESI LAVORATIVA","4. PROGRAMMA DI SORVEGLIANZA","5. ESAME CLINICO","8. GIUDIZIO DI IDONEITÀ","9. TRASMISSIONE"])',
   'if expected==4: assert "8. GIUDIZIO DI IDONEITÀ" in p[3].get_text() and "9. TRASMISSIONE" in p[3].get_text()',
   'if expected==0: assert all(f"NOTA LUNGA {i:03d}" in t for i in range(1,61))',
   'for n,x in enumerate(p): x.get_pixmap(matrix=fitz.Matrix(1.3,1.3)).save(sys.argv[1].replace(".pdf",f"-{n+1}.png"))',
  ].join('\n'),file,String(expected)],{stdio:'inherit'});
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});
  assert.equal(await page.locator('.lumen-print-value,.lumen-print-source').count(),0);
  assert.equal(await page.evaluate(()=>JSON.stringify({data:window.lumenBatchCertApi.collect(),storage:{...localStorage}})),before);
 }
 await pdf('PROVA_FANTASMA_4_PAGINE',{cognome:'PROVA',nome:'FANTASMA',lumen_prova:true,firma_lavoratore_png:signature,data_cartella:'2026-09-29',data_dichiarazione:'2026-09-29',data_giudizio:'2026-09-29'},4);
 await pdf('PROVA_COMPILATA_4_PAGINE',fixture,4);
 await page.evaluate(async()=>{await window.lumenBatchCertApi.saveToLocalArchive()});
 await page.reload();await page.waitForFunction(()=>document.getElementById('nome').value==='FANTASMA'&&document.getElementById('torace').value==='NDR');
 assert.equal(await page.locator('#cartellaFinaleWorkerSignature').getAttribute('src'),signature);
 await pdf('PROVA_NOTE_LUNGHE',{...fixture,altri_rilievi:Array.from({length:60},(_,i)=>'NOTA LUNGA '+String(i+1).padStart(3,'0')+': TESTO FITTIZIO DA CONSERVARE.').join('\n')},0);
 await page.goto(origin);await page.waitForFunction(()=>window.lumenBatchCertApi);
 await pdf('ORDINARIA_INVARIATA',{...fixture,lumen_prova:false,nome:'COLLAUDO',codice_fiscale:'TSTPRV80A01H501X',data_nascita:'1980-01-01'},5);
 assert.deepEqual(errors,[]);
 console.log('PASS: quattro pagine, contenuti, firme, salvataggio/riapertura, nessuna modifica ai dati durante stampa, note lunghe e versione ordinaria invariata.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
