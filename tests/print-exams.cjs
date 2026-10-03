const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/print-exams');
fs.mkdirSync(out,{recursive:true});
const fixture=vm.runInNewContext('('+fs.readFileSync(path.join(__dirname,'print-layout.cjs'),'utf8').match(/const fixture=(\{[\s\S]*?\n\});/)[1]+')');
Object.assign(fixture,{nome:'FANTASMA',codice_fiscale:'',data_nascita:'',lumen_prova:true,
 audio_dx_500:'20',audio_dx_1000:'30',audio_dx_2000:'45',audio_dx_4000:'30',
 audio_sx_500:'25',audio_sx_1000:'35',audio_sx_2000:'55',audio_sx_4000:'35',
 spirometria_fvc:'4,75',spirometria_fvc_percentuale:'85',spirometria_fev1:'3,52',spirometria_fev1_percentuale:'80',
 spirometria_pef:'2,3',spirometria_pef_percentuale:'20'});
const server=require('./local-server.cjs')(root);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:3});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const origin=`http://127.0.0.1:${server.address().port}`;
   await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
   await page.goto(origin+'/?prova=fantasma');
   await page.waitForFunction(()=>window.lumenBatchCertApi&&document.getElementById('nome').value==='FANTASMA');
   await page.evaluate(d=>window.lumenBatchCertApi.apply(d),fixture);
   for(const value of ['4,,75','4,75abc','4.7.5','0','-4']){
    await page.locator('#spirometria_fvc').fill(value);
    assert.equal(await page.locator('#spirometria_fvc').inputValue(),value,'Never silently correct the entered measurement');
    assert.equal(await page.locator('#spirometria_rapporto').inputValue(),'');
    assert.equal(await page.locator('#spirometria_interpretazione').inputValue(),'');
    assert.equal(await page.locator('#spirometryCharts').isVisible(),false);
    assert.equal(await page.locator('#spirometria_fvc').getAttribute('aria-invalid'),'true');
    assert.match(await page.locator('#spirometryGraphStatus').textContent(),/CONTROLLARE FVC/);
   }
   for(const value of ['4.75','4,75']){
    await page.locator('#spirometria_fvc').fill(value);
    assert.equal(await page.locator('#spirometria_rapporto').inputValue(),'74.1');
    assert.match(await page.locator('#spirometryGraphSummary').textContent(),/FVC 4.75 L/);
    assert.equal(await page.locator('#spirometria_fvc').getAttribute('aria-invalid'),null);
   }
   for(const scale of [1,1.25]){
    const before=await page.evaluate(()=>JSON.stringify({data:window.lumenBatchCertApi.collect(),storage:{...localStorage}}));
    await page.setViewportSize({width:Math.floor(186*96/25.4/scale),height:1100});
    await page.emulateMedia({media:'print'});
    await page.evaluate(()=>{document.body.className='print-cartella';window.dispatchEvent(new Event('beforeprint'))});
    const metrics=await page.locator('#cartellaForm>.page').nth(2).evaluate(el=>({height:el.getBoundingClientRect().height,
     children:[...el.children].filter(e=>e.getBoundingClientRect().height).map(e=>({id:e.id,cls:e.className,height:e.getBoundingClientRect().height}))}));
    console.log(name,scale,'exam height:',metrics.height);
    if(!process.env.BASELINE)assert.ok(metrics.height<277*96/25.4/scale,`${name}: full exams must fit at ${scale*100}%`);
    if(name==='chromium'){
     const pdf=path.join(out,`exams-${scale}.pdf`);
     await page.pdf({path:pdf,preferCSSPageSize:true,printBackground:true,scale});
     execFileSync('python',['-c',`import fitz,sys
p=fitz.open(sys.argv[1]);t=p[2].get_text()
print('PDF pages:',len(p))
p[2].get_pixmap(matrix=fitz.Matrix(1.4,1.4)).save(sys.argv[2])
if not int(sys.argv[3]):
 assert len(p)==5,len(p)
 for s in ['AUDIOGRAMMA INDICATIVO','CURVA VOLUME','CURVA FLUSSO','FVC 4.75 L','74.1','Visiotest','Periodicità protocollo']:
  assert s in t,s
 assert '5. ESAME CLINICO GENERALE' in p[3].get_text()
`,pdf,path.join(out,`exams-${scale}.png`),process.env.BASELINE?'1':'0'],{stdio:'inherit'});
    }
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({media:'screen'});
    assert.equal(await page.evaluate(()=>JSON.stringify({data:window.lumenBatchCertApi.collect(),storage:{...localStorage}})),before);
   }
   // A fresh browser context contains only synthetic data. Fantasma deliberately has no birth date.
   await page.goto(origin);await page.waitForFunction(()=>window.lumenBatchCertApi&&window.lumenSpirometriaPercentuali);
   await page.evaluate(d=>window.lumenBatchCertApi.apply(d),{...fixture,lumen_prova:false,sesso:'M',altezza:'175',data_nascita:'1951-01-01',data_giudizio:'2026-10-03',spirometria_fvc_percentuale:'',spirometria_fev1_percentuale:'',spirometria_pef_percentuale:''});
   await page.setViewportSize({width:Math.floor(186*96/25.4/1.25),height:1100});
   await page.emulateMedia({media:'print'});
   await page.evaluate(()=>{document.body.className='print-cartella';window.dispatchEvent(new Event('beforeprint'))});
   const autoHeight=await page.locator('#cartellaForm>.page').nth(2).evaluate(el=>el.getBoundingClientRect().height);
   console.log(name,'auto125',autoHeight);
   assert.ok(autoHeight<277*96/25.4/1.25,'Automatic reference note must fit at 125%');
   if(name==='chromium')await page.pdf({path:path.join(out,'exams-auto.pdf'),preferCSSPageSize:true,printBackground:true,scale:1.25});
   await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   await page.emulateMedia({media:'screen'});
   await page.goto(origin+'/?prova=fantasma');await page.waitForFunction(()=>window.lumenBatchCertApi&&document.getElementById('nome').value==='FANTASMA');
   await page.evaluate(d=>window.lumenBatchCertApi.apply(d),fixture);
   // Compaction may not crop a longer clinician-edited interpretation.
   if(name==='chromium'){
    await page.locator('#audiometria_interpretazione').fill(Array.from({length:65},(_,i)=>`NOTA AUDIO ${String(i+1).padStart(3,'0')}: TESTO FITTIZIO DA CONSERVARE IN STAMPA.`).join('\n'));
    await page.setViewportSize({width:703,height:1100});
    await page.emulateMedia({media:'print'});
    await page.evaluate(()=>{document.body.className='print-cartella';window.dispatchEvent(new Event('beforeprint'))});
    const pdf=path.join(out,'exams-long.pdf');
    await page.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
    execFileSync('python',['-c',`import fitz,sys
p=fitz.open(sys.argv[1]);t=chr(10).join(x.get_text() for x in p)
for i in range(1,66): assert f'NOTA AUDIO {i:03d}:' in t,i
for s in ['FVC 4.75 L','Periodicità protocollo','5. ESAME CLINICO GENERALE']: assert s in t,s
`,pdf]);
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
   }
   assert.deepEqual(errors,[]);
   console.log('PASS',name);
  }finally{await browser.close()}
 }}finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
