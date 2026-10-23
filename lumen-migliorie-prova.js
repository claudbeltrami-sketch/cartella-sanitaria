/* LUMEN: three small, opt-in aids. No clinical data or attachment changes. */
(function(root){
 'use strict';
 const $=id=>root.document?.getElementById(id);
 const has=(data,keys)=>keys.some(key=>String(data?.[key]||'').trim()!=='');
 function promemoria(d){
  if(!d||(!String(d.cognome||'').trim()&&!String(d.nome||'').trim()))return {missing:[],manual:[],empty:true};
  const missing=[],manual=[],planned=Array.isArray(d.protocollo)?d.protocollo:[];
  if(!String(d.giudizio||'').trim())missing.push('Giudizio di idoneità non indicato');
  if(!String(d.firma_lavoratore_png||'').trim())missing.push('Firma del lavoratore non acquisita (verificare eventuale rifiuto)');
  if(planned.includes('AUDIOMETRIA')&&!has(d,['audio_dx_500','audio_sx_500','audio_dx_1000','audio_sx_1000','audio_dx_2000','audio_sx_2000','audio_dx_4000','audio_sx_4000','audiometria_esito']))missing.push('Audiometria prevista: verificare dati o referto');
  if(planned.includes('SPIROMETRIA BASALE')&&!has(d,['spirometria_fvc','spirometria_fev1','spirometria_pef']))missing.push('Spirometria prevista: verificare dati o referto');
  if(planned.includes('VISIOTEST')&&!has(d,['visiotest_esito']))missing.push('Visiotest previsto: verificare esito o referto');
  for(const type of ['ELETTROCARDIOGRAMMA','ESAME FUNZIONALE DEL RACHIDE','ANALISI EMATOCHIMICHE','ESAMI TOSSICOLOGICI'])if(planned.includes(type))manual.push(type);
  return {missing,manual,empty:false};
 }
 function scadenze(rows){
  const valid=(rows||[]).filter(r=>r&&!r.ceased&&!r.issues?.length&&Number.isFinite(r.days));
  return {overdue:valid.filter(r=>r.days<0).length,next30:valid.filter(r=>r.days>=0&&r.days<=30).length,incomplete:(rows||[]).filter(r=>r&&!r.ceased&&r.issues?.length).length};
 }
 function validaBackup(packet){
  const type=packet?.tipo,light=type==='BELTRAMI_BACKUP_LEGGERO_V2';
  if(!['BELTRAMI_BACKUP_LEGGERO_V2','BELTRAMI_BACKUP_COMPLETO_V1'].includes(type)||!packet.creato||!Number.isFinite(Date.parse(packet.creato)))throw Error('Il file non è un backup LUMEN riconosciuto.');
  if(light&&(packet.versione!==2||packet.allegatiSeparati!==true))throw Error('Backup leggero non valido.');
  if(!light&&packet.versione!==1)throw Error('Versione del backup completo non valida.');
  const c=packet.contenuto;
  if(!c||!Array.isArray(c.cartelle)||!Array.isArray(c.originali)||!c.localStorage||typeof c.localStorage!=='object'||Array.isArray(c.localStorage))throw Error('Dati del backup incompleti.');
  if(c.firme_da_trasferire!==undefined&&!Array.isArray(c.firme_da_trasferire))throw Error('Elenco firme non valido.');
  if(c.cartelle.some(r=>!r||typeof r!=='object'||!r.data||typeof r.data!=='object'))throw Error('Almeno una cartella del backup è incompleta.');
  if(c.originali.some(r=>!r||typeof r!=='object'||typeof r.id!=='string'))throw Error('Indice allegati non valido.');
  if(light&&root.lumenExternalAttachments?.validateLightRows)root.lumenExternalAttachments.validateLightRows(c.originali);
  root.lumenStorage?.checkPacket(packet);
  return {mode:light?'leggero':'completo',cartelle:c.cartelle.length,originali:c.originali.length};
 }
 root.lumenMigliorieProva={promemoria,scadenze,validaBackup};
 if(!root.document)return;
 const alertBox=$('lumenMiniControllo'),badge=$('lumenMiniScadenzeText'),refresh=$('lumenMiniScadenzeAggiorna');
 const backupText=$('lumenBackupUltimoVerificato'),backupButton=$('lumenBackupVerificaFile'),backupInput=$('lumenBackupFileDaVerificare'),backupMessage=$('lumenBackupVerificaMessage');
 if(!alertBox||!badge||!refresh||!backupText||!backupButton||!backupInput||!backupMessage)return;
 function showPromemoria(){
  try{
   const info=promemoria(root.lumenBatchCertApi?.collect());
   alertBox.hidden=info.empty||(!info.missing.length&&!info.manual.length);
   if(alertBox.hidden){alertBox.textContent='';return;}
   alertBox.textContent='Promemoria prima di concludere la visita (non blocca il salvataggio): '+
    info.missing.join(' • ')+(info.manual.length?(info.missing.length?' • ':'')+'Esami da controllare manualmente nei referti: '+info.manual.join(', '):'')+
    '. La verifica finale resta del medico.';
  }catch(e){alertBox.hidden=false;alertBox.textContent='Promemoria non disponibile: '+(e.message||String(e))+'. La cartella si salva normalmente.'}
 }
 $('btnSalva')?.addEventListener('click',showPromemoria,true);
 root.document.addEventListener('lumen:cartella-applied',()=>{alertBox.hidden=true;alertBox.textContent=''});
 async function updateScadenze(){
  refresh.disabled=true;badge.textContent='Scadenze: lettura archivio locale…';
  try{
   if(!root.lumenArchiveVisitsApi?.list||!root.lumenScadenzario?.build)throw Error('scadenzario non disponibile');
   const source=await root.lumenArchiveVisitsApi.list();
   const result=root.lumenScadenzario.build(source,undefined,root.lumenScadenzario.localSessions());
   const count=scadenze(result.rows);
   badge.textContent='Scadenze su questo dispositivo: '+count.overdue+' scadute · '+count.next30+' entro 30 giorni · '+count.incomplete+' da completare'+(root.lumenStorage?.isTest?' (archivio PROVA)':'');
  }catch(e){badge.textContent='Scadenze non disponibili: apri SCADENZARIO ('+(e.message||String(e))+')';}
  finally{refresh.disabled=false;}
 }
 refresh.addEventListener('click',updateScadenze);
 root.setTimeout(updateScadenze,0);
 const device=/iPhone|iPad|iPod/i.test(root.navigator?.userAgent||'')?'iPhone':/Macintosh|Mac OS X/i.test(root.navigator?.userAgent||'')?'Mac':'questo dispositivo';
 const key='lumen_ultimo_backup_verificato_su_dispositivo_v1';
 function renderBackup(){
  try{
   const saved=JSON.parse(root.lumenStorage.local.getItem(key)||'null');
   backupText.textContent=saved&&Number.isFinite(Date.parse(saved.verifiedAt))?
    'Ultimo backup verificato qui ('+device+'): '+new Date(saved.verifiedAt).toLocaleString('it-IT')+' · '+saved.mode+' · '+saved.name:
    'Ultimo backup verificato qui ('+device+'): nessuno.';
  }catch(_){backupText.textContent='Ultimo backup verificato su questo dispositivo: dato non disponibile.'}
 }
 renderBackup();
 backupButton.onclick=()=>backupInput.click();
 backupInput.onchange=async()=>{
  const file=backupInput.files?.[0];backupInput.value='';if(!file)return;
  backupButton.disabled=true;backupMessage.textContent='Controllo file in corso… Nessun dato sanitario sarà modificato.';
  try{
   if(file.size>64*1024*1024)throw Error('Il controllo rapido supporta file fino a 64 MB. I backup completi più grandi richiedono una verifica dedicata sul Mac.');
   if(!root.lumenBackupIO?.read)throw Error('Lettore backup non disponibile.');
   const packet=await root.lumenBackupIO.read(file,blob=>blob);
   const info=validaBackup(packet);
   root.lumenStorage.local.setItem(key,JSON.stringify({verifiedAt:new Date().toISOString(),name:file.name,mode:info.mode}));
   renderBackup();
   backupMessage.textContent='File riletto: struttura valida ('+info.cartelle+' cartelle, '+info.originali+' voci allegati). '+(info.mode==='leggero'?'I PDF separati devono restare nella cartella del Mac. ':'')+'Verifica effettuata solo su questo dispositivo.';
  }catch(e){backupMessage.textContent='Backup NON verificato: '+(e.message||String(e))+'. Nessun dato modificato.';}
  finally{backupButton.disabled=false;}
 };
})(typeof window==='undefined'?globalThis:window);
