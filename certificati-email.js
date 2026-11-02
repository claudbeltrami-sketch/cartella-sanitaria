/* Local certificate correspondence. No network requests and no sending API. */
(function(root){
 'use strict';
 const VERSION='20261102-email-1';
 const clean=v=>String(v??'').trim();
 const header=v=>{const s=clean(v);if(/[\r\n\x00-\x1f\x7f]/.test(s))throw Error('Il campo contiene caratteri non ammessi.');return s;};
 function email(v){
  const s=header(v);
  if(!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(s)||s.length>254||s.split('@')[0].length>64||s.includes('..'))throw Error('Inserisci un solo indirizzo email valido.');
  return s;
 }
 function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return root.btoa(s);}
 function encodedWords(v){
  const words=[];let chunk='';const encoder=new TextEncoder();
  for(const c of header(v)){if(encoder.encode(chunk+c).length>30){words.push('=?UTF-8?B?'+base64(encoder.encode(chunk))+'?=');chunk='';}chunk+=c;}
  if(chunk)words.push('=?UTF-8?B?'+base64(encoder.encode(chunk))+'?=');return words.join('\r\n ');
 }
 const folded=v=>(v.match(/.{1,76}/g)||['']).join('\r\n');
 const filename=v=>header(v).replace(/[^A-Za-z0-9._-]/g,'_').slice(0,150)||'CERTIFICATO.pdf';
 async function createMessage({to,subject,body,blob,fileName}){
  to=email(to);subject=header(subject);if(!subject)throw Error('Completa l’oggetto.');if(!clean(body))throw Error('Completa il testo dell’email.');
  if(!blob||blob.type!=='application/pdf'||!blob.size)throw Error('PDF non disponibile: rigenera i certificati.');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('L’allegato non è un PDF valido.');
  const boundary='lumen_'+Array.from(root.crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  const lines=['X-Unsent: 1','To: '+to,'Subject: '+encodedWords(subject),'MIME-Version: 1.0','Content-Type: multipart/mixed; boundary="'+boundary+'"','','--'+boundary,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',folded(base64(new TextEncoder().encode(String(body).replace(/\r?\n/g,'\r\n')))),'','--'+boundary,'Content-Type: application/pdf; name="'+filename(fileName)+'"','Content-Disposition: attachment; filename="'+filename(fileName)+'"','Content-Transfer-Encoding: base64','',folded(base64(bytes)),'','--'+boundary+'--',''];
  return new Blob([lines.join('\r\n')],{type:'message/rfc822'});
 }
 const fmt=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):clean(v);
 const norm=v=>clean(v).toLocaleUpperCase('it-IT');
 function template(info,ref=''){
  const single=info.kind==='worker',date=fmt(info.date),name=clean(info.workerName);
  return {subject:single?'Certificato di idoneità - '+name+' - '+date:'Certificati di idoneità - '+clean(info.client)+' - '+date,
   body:'Buongiorno'+(clean(ref)?' '+clean(ref):'')+',\n\n'+(single?'trasmetto in allegato il Suo certificato di idoneità relativo alla visita del '+date+'.':'trasmetto in allegato i certificati di idoneità dei '+info.count+' lavoratori visitati il '+date+(info.place?' presso '+info.place:'')+'.')+'\n\nCordiali saluti\nDott. Claudio Beltrami'};
 }
 const api={version:VERSION,createMessage,validateEmail:email,template};root.lumenCertificateMail=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root.document)return;
 const document=root.document,$=id=>document.getElementById(id);
 let dialog,current=null,busy=false,pdfUrl='',mailUrl='',revision=0;
 function status(text){$('certMailStatus').textContent=text;}
 function readClients(){return root.lumenCertificateMailSettings?.readClients()||[];}
 function selectedClient(){return readClients().find(c=>norm(c.nome)===norm($('certMailClient').value));}
 function revoke(){for(const url of [pdfUrl,mailUrl])if(url)URL.revokeObjectURL(url);pdfUrl=mailUrl='';$('certMailReady').replaceChildren();}
 function invalidate(){revision++;if(mailUrl)URL.revokeObjectURL(mailUrl);mailUrl='';$('certMailReady').replaceChildren();status('Controlla destinatario, testo e PDF prima di preparare l’email.');}
 function setBusy(value){busy=value;dialog.querySelectorAll('button,input,textarea,select').forEach(e=>e.disabled=value);}
 function fillClient(){
  const c=selectedClient();$('certMailTo').value=c?.email||'';$('certMailRef').value=c?.referente||'';
  const defaults=template(current,$('certMailRef').value);$('certMailSubject').value=defaults.subject;$('certMailBody').value=defaults.body;invalidate();
 }
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),300000);}
 function readyLink(url,name,label){const a=document.createElement('a');a.href=url;a.download=name;a.textContent=label;a.className='cert-mail-link';$('certMailReady').append(a);return a;}
 function buildUi(){
  if(dialog)return;
  const css=document.createElement('style');css.textContent=`#certMailDialog{box-sizing:border-box;width:min(760px,calc(100vw - 20px));max-height:92vh;overflow:auto;padding:20px;border:2px solid #287a46;border-radius:12px;background:#fff;color:#111}#certMailDialog::backdrop{background:#0009}#certMailDialog h2{font-size:20px;font-style:normal;margin:0 0 10px}#certMailDialog label{display:block;font-weight:700;margin:12px 0}#certMailDialog input,#certMailDialog textarea{display:block;width:100%;box-sizing:border-box;font:16px Arial;padding:9px;border:1px solid #888;border-radius:5px;margin-top:5px;text-transform:none}#certMailDialog textarea{min-height:160px;line-height:1.4}#certMailDialog .cert-mail-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}#certMailDialog .cert-mail-link{display:inline-block;margin:8px 12px 8px 0;color:#174d7b;font-weight:bold}#certMailStatus{white-space:pre-line;font-weight:700}#certMailSummary{white-space:pre-line;padding:10px;background:#eef5f0;border-radius:6px}#certMailDialog .cert-mail-note{font-size:13px;line-height:1.4}#certMailDialog [hidden]{display:none!important}@media print{#certMailDialog{display:none!important}}`;document.head.append(css);
  dialog=document.createElement('dialog');dialog.id='certMailDialog';dialog.setAttribute('aria-labelledby','certMailTitle');dialog.innerHTML=`<h2 id="certMailTitle">PREPARA EMAIL CERTIFICATI</h2><p id="certMailSummary"></p><div id="certMailClientBox"><label>Committente / rubrica<input id="certMailClient" list="certMailClients" autocomplete="off"></label><datalist id="certMailClients"></datalist><button type="button" id="certMailRecall" class="secondary">RICHIAMA CONTATTO</button></div><label>Destinatario email<input type="email" id="certMailTo" autocomplete="off" autocapitalize="none" spellcheck="false"></label><label>Referente / saluto<input id="certMailRef" autocomplete="off"></label><div class="cert-mail-actions"><button type="button" id="certMailSave" class="secondary">SALVA CONTATTO DEL COMMITTENTE</button><button type="button" id="certMailText" class="secondary">AGGIORNA TESTO DAL REFERENTE</button></div><label>Oggetto<input id="certMailSubject"></label><label>Testo email<textarea id="certMailBody"></textarea></label><p id="certMailAttachment"></p><a id="certMailPreview" target="_blank" rel="noopener">CONTROLLA PDF ALLEGATO</a><p class="cert-mail-note">EMAIL CON PDF scarica un file .eml con destinatario, testo e PDF già incluso. Sul Mac aprilo con Mail; se compare in lettura, scegli Messaggio → Invia di nuovo. Controlla il messaggio e premi Invia in Mail.</p><div class="cert-mail-actions"><button type="button" id="certMailCreate" class="success">PREPARA EMAIL CON PDF</button><button type="button" id="certMailSimple" class="secondary">APRI EMAIL · ALLEGA PDF A MANO</button><button type="button" id="certMailClose" class="secondary">CHIUDI</button></div><p class="cert-mail-note">Con APRI EMAIL il PDF viene scaricato separatamente: va aggiunto al messaggio. Nessuna email viene inviata da LUMEN.</p><div id="certMailReady"></div><p id="certMailStatus" role="status" aria-live="polite"></p>`;document.body.append(dialog);
  ['certMailTo','certMailRef','certMailClient','certMailSubject','certMailBody'].forEach(id=>$(id).addEventListener('input',invalidate));
  $('certMailClient').addEventListener('change',fillClient);$('certMailRecall').onclick=fillClient;
  $('certMailText').onclick=()=>{if(!confirm('Sostituire oggetto e testo con il modello aggiornato?'))return;const d=template(current,$('certMailRef').value);$('certMailSubject').value=d.subject;$('certMailBody').value=d.body;invalidate();};
  $('certMailSave').onclick=()=>{try{
   const name=header($('certMailClient').value),to=email($('certMailTo').value),ref=header($('certMailRef').value);if(!name)throw Error('Indica il committente.');
   root.lumenCertificateMailSettings.saveClient({nome:name,email:to,referente:ref});status('Contatto del committente salvato. Indirizzo e referente restano modificabili.');
  }catch(e){status(e.message)}};
  $('certMailCreate').onclick=async()=>{
   const expected=revision;
   try{
    const data=messageData();setBusy(true);status('Preparazione email con PDF allegato…');
    const blob=await createMessage(data);if(expected!==revision)return;
    if(mailUrl)URL.revokeObjectURL(mailUrl);mailUrl=URL.createObjectURL(blob);$('certMailReady').replaceChildren();
    const name=filename(current.fileName).replace(/\.pdf$/i,'')+'.eml';readyLink(mailUrl,name,'SCARICA DI NUOVO EMAIL CON PDF');
    download(blob,name);status('EMAIL PREPARATA CON PDF ALLEGATO.\nApri il file .eml con Mail. Se è in lettura: Messaggio → Invia di nuovo. Verifica destinatario e allegato, poi premi Invia in Mail.');
   }catch(e){status('Email non preparata: '+e.message)}finally{setBusy(false)}
  };
  $('certMailSimple').onclick=()=>{try{
   const d=messageData(),url='mailto:'+encodeURIComponent(d.to)+'?subject='+encodeURIComponent(d.subject)+'&body='+encodeURIComponent(d.body);
   if(url.length>7000)throw Error('Testo troppo lungo per APRI EMAIL: usa PREPARA EMAIL CON PDF.');
   download(current.blob,current.fileName);root.location.href=url;status('Email aperta. Aggiungi il PDF appena scaricato prima di inviare: '+current.fileName);
  }catch(e){status(e.message)}};
  function close(){if(!busy){dialog.close();revoke();current=null;}}
  $('certMailClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 }
 function messageData(){if(!current)throw Error('Rigenera i certificati.');return {to:email($('certMailTo').value),subject:header($('certMailSubject').value),body:$('certMailBody').value,blob:current.blob,fileName:current.fileName};}
 function open(info){
  buildUi();if(busy)throw Error('Attendi il completamento dell’email.');
  if(!info?.blob?.size||info.blob.type!=='application/pdf')throw Error('PDF non disponibile.');
  revoke();current={...info};revision++;
  const worker=info.kind==='worker';$('certMailTitle').textContent=worker?'EMAIL AL LAVORATORE':'EMAIL CERTIFICATI AL COMMITTENTE';
  $('certMailClientBox').hidden=worker;$('certMailSave').hidden=worker;
  $('certMailClient').value=info.client||'';$('certMailClients').replaceChildren();
  for(const c of readClients()){const option=document.createElement('option');option.value=c.nome;$('certMailClients').append(option);}
  const c=worker?null:selectedClient();
  // Prefer the current saved address to a historic session address.
  $('certMailTo').value=worker?(info.to||''):(c?.email??info.to??'');$('certMailRef').value=worker?'':(c?.referente??info.referente??'');
  const defaults=template(info,$('certMailRef').value);$('certMailSubject').value=defaults.subject;$('certMailBody').value=defaults.body;
  $('certMailSummary').textContent=worker?'Lavoratore: '+info.workerName+'\nVisita: '+fmt(info.date):'Committente: '+info.client+'\nVisita: '+fmt(info.date)+' · '+info.count+' certificati inclusi'+(info.people?.length?'\n'+info.people.join(' · '):'');
  $('certMailAttachment').textContent='PDF allegato: '+info.fileName+' ('+Math.ceil(info.blob.size/1024)+' KB)';
  pdfUrl=URL.createObjectURL(info.blob);$('certMailPreview').href=pdfUrl;
  status('Controlla destinatario, testo e PDF prima di preparare l’email.');if(!dialog.open)dialog.showModal();$('certMailTo').focus();
 }
 async function single(){
  const batch=root.lumenBatchCertApi,button=$('btnEmailCert');if(!batch||!root.lumenCertificatePdf)return;
  try{
   if(!batch.verificaPrimaDelPdf('CERTIFICATO')||!batch.completaLuogoCertificato())return;
   const data=batch.collect(),identity=JSON.stringify(data),selection=batch.selectionVersion();button.disabled=true;button.textContent='PREPARAZIONE PDF…';
   batch.popolaCertificato(undefined,false);const blob=await root.lumenCertificatePdf.current();
   if(selection!==batch.selectionVersion()||identity!==JSON.stringify(batch.collect()))throw Error('Cartella modificata durante la preparazione: riprova.');
   const workerName=[data.cognome,data.nome].filter(Boolean).join(' '),date=data.data_giudizio||data.data_cartella;
   open({kind:'worker',blob,fileName:filename('CERTIFICATO_'+workerName+'_'+date+'.pdf'),workerName,date,to:data.email_lavoratore||'',count:1});
  }catch(e){root.alert('Email non preparata: '+e.message)}finally{button.disabled=false;button.textContent='PREPARA EMAIL AL LAVORATORE';}
 }
 api.open=open;api.single=single;
 function boot(){const toolbar=$('certificate')?.querySelector('.toolbar');if(!toolbar||$('btnEmailCert'))return;const b=document.createElement('button');b.id='btnEmailCert';b.type='button';b.className='success';b.textContent='PREPARA EMAIL AL LAVORATORE';b.onclick=single;toolbar.insertBefore(b,$('btnTorna'));}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(typeof window!=='undefined'?window:globalThis);
