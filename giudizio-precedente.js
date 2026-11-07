/* LUMEN — Richiama l'ultimo giudizio di idoneità. Solo lettura dello storico.
 * Nessuna modifica automatica dell'archivio, nessuna firma/data copiata.
 */
(() => {
  'use strict';
  const api = window.lumenBatchCertApi;
  if (!api || typeof api.getCartellaRecord !== 'function' || typeof api.cartellaId !== 'function') return;

  const byId = id => document.getElementById(id);
  const norm = v => String(v ?? '').trim().toLocaleUpperCase('it-IT');
  const cf = v => norm(v).replace(/\s+/g, '');
  const date = v => String(v ?? '').trim().slice(0, 10);
  const visitDate = d => date(d?.data_giudizio || d?.data_cartella);
  const goodDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) && new Date(s + 'T12:00:00Z').toISOString().slice(0,10) === s;

  // Select by clinical VISIT date (not the date a record happened to be saved).
  function previous(archive, before) {
    if (!archive || !goodDate(before)) return null;
    const versions = [
      ...(archive.history || []).filter(h => h?.data).map(h => ({data:h.data, savedAt:h.savedAt || ''})),
      ...(archive.data ? [{data:archive.data, savedAt:archive.updatedAt || ''}] : [])
    ];
    return versions.map(v => ({
      day: visitDate(v.data), savedAt:v.savedAt, giudizio:norm(v.data.giudizio),
      prescrizioni:String(v.data.prescrizioni ?? '').trim()
    })).filter(v => goodDate(v.day) && v.day < before && (v.giudizio || v.prescrizioni))
      .sort((a,b) => b.day.localeCompare(a.day) || b.savedAt.localeCompare(a.savedAt))[0] || null;
  }

  // Check the person against the archived identity; never infer from a name alone.
  function current() {
    return {
      codice_fiscale:cf(byId('codice_fiscale')?.value),
      cognome:norm(byId('cognome')?.value),
      nome:norm(byId('nome')?.value),
      data_nascita:date(byId('data_nascita')?.value),
      data_giudizio:date(byId('data_giudizio')?.value),
      data_cartella:date(byId('data_cartella')?.value)
    };
  }
  function identityKey(d) { return JSON.stringify([d.codice_fiscale,d.cognome,d.nome,d.data_nascita]); }
  function samePerson(rec,d) {
    const v = rec?.data || {};
    const oldCf = cf(rec.cf || v.codice_fiscale);
    const oldCognome = norm(rec.cognome || v.cognome);
    const oldNome = norm(rec.nome || v.nome);
    const oldNascita = date(rec.dataNascita || v.data_nascita);
    if (d.codice_fiscale) {
      if (oldCf !== d.codice_fiscale) return false;
    } else if (oldCf || !d.data_nascita) {
      return false;
    }
    return (!d.cognome || oldCognome === d.cognome) &&
      (!d.nome || oldNome === d.nome) &&
      (!d.data_nascita || oldNascita === d.data_nascita);
  }

  const style = document.createElement('style');
  style.textContent = '#lumenPrevJudgementDialog{width:min(620px,calc(100vw - 24px));max-height:90vh;overflow:auto;border:2px solid #397657;border-radius:10px;padding:18px;background:white;color:#222}#lumenPrevJudgementDialog::backdrop{background:#0009}#lumenPrevJudgementDialog pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:#f5f5f5;padding:12px;border:1px solid #ddd;border-radius:6px}#lumenPrevJudgementDialog .lumen-prev-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end}#lumenPrevJudgementDialog button{min-height:43px}#lumenPrevJudgement{margin:8px 0 12px}';
  document.head.appendChild(style);
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'lumenPrevJudgement';
  button.className = 'secondary';
  button.textContent = 'RICHIAMA GIUDIZIO PRECEDENTE';
  const block = byId('giudizi');
  if (!block) return;
  block.insertAdjacentElement('afterend',button);
  const dialog = document.createElement('dialog');
  dialog.id = 'lumenPrevJudgementDialog';
  dialog.setAttribute('aria-labelledby','lumenPrevJudgementTitle');
  dialog.innerHTML = '<h3 id="lumenPrevJudgementTitle">ULTIMO GIUDIZIO PRECEDENTE</h3><p id="lumenPrevJudgementInfo"></p><strong>Giudizio</strong><pre id="lumenPrevJudgementType"></pre><strong>Prescrizioni / limitazioni</strong><pre id="lumenPrevJudgementNotes"></pre><p>La copia modifica soltanto i campi visibili della visita in corso. Il giudizio precedente rimane invariato. Verificare sempre l’idoneità clinica prima di salvare.</p><div class="lumen-prev-actions"><button type="button" id="lumenPrevCancel" class="secondary">CHIUDI SENZA COPIARE</button><button type="button" id="lumenPrevCopy" class="success">COPIA NELLA VISITA IN CORSO</button></div>';
  document.body.appendChild(dialog);
  let candidate = null;

  function showMessage(s) { if (typeof api.setStatus === 'function') api.setStatus(s); else alert(s); }
  function close() { dialog.close(); candidate = null; }
  byId('lumenPrevCancel').onclick = close;
  dialog.addEventListener('cancel', e => {e.preventDefault();close()});

  button.onclick = async () => {
    if (button.disabled) return;
    candidate = null;
    const d = current(), day = visitDate(d);
    if (!goodDate(day)) return showMessage('INDICA PRIMA LA DATA DELLA NUOVA VISITA.');
    if (!d.codice_fiscale && !(d.cognome && d.nome && goodDate(d.data_nascita)))
      return showMessage('PER RICHIAMARE UN GIUDIZIO SERVONO IL CODICE FISCALE O COGNOME, NOME E DATA DI NASCITA.');
    if (d.codice_fiscale && (!d.cognome || !d.nome))
      return showMessage('COMPLETA COGNOME E NOME PER VERIFICARE L’IDENTITÀ.');
    button.disabled = true;
    try {
      const record = await api.getCartellaRecord(api.cartellaId(d));
      if (!record) return showMessage('NESSUNA CARTELLA PRECEDENTE TROVATA PER QUESTA IDENTITÀ.');
      if (!samePerson(record,d)) return showMessage('IDENTITÀ NON COINCIDENTE CON L’ARCHIVIO. NESSUN GIUDIZIO CARICATO.');
      const found = previous(record,day);
      if (!found) return showMessage('NESSUN GIUDIZIO DI UNA VISITA ANTERIORE ALLA DATA INDICATA.');
      const validTypes = [...document.querySelectorAll('input[name="giudizio"]')].map(e => e.value);
      if (found.giudizio && !validTypes.includes(found.giudizio))
        return showMessage('GIUDIZIO STORICO NON RICONOSCIUTO: CONSULTA LA CARTELLA ORIGINALE.');
      candidate = {...found, identity:identityKey(d), before:day, archiveId:record.id};
      byId('lumenPrevJudgementInfo').textContent = 'Visita precedente: ' + found.day.split('-').reverse().join('/') + ' — ' + d.cognome + ' ' + d.nome;
      byId('lumenPrevJudgementType').textContent = found.giudizio || '(non presente)';
      byId('lumenPrevJudgementNotes').textContent = found.prescrizioni || '(nessuna)';
      dialog.showModal();
    } catch (e) {
      showMessage('LETTURA STORICO NON RIUSCITA: ' + (e.message || String(e)));
    } finally { button.disabled = false; }
  };

  byId('lumenPrevCopy').onclick = async () => {
    if (!candidate) return;
    const d = current(), c = candidate;
    if (identityKey(d) !== c.identity || visitDate(d) !== c.before)
      return showMessage('IDENTITÀ O DATA CAMBIATE: RIAPRI IL GIUDIZIO PRECEDENTE.');
    try {
      // Re-read so a changed archive cannot silently supply a stale judgement.
      const record = await api.getCartellaRecord(c.archiveId);
      if (!samePerson(record,d)) throw Error('IDENTITÀ CAMBIATA NELL’ARCHIVIO.');
      const latest = previous(record,c.before);
      if (!latest || latest.day !== c.day || latest.giudizio !== c.giudizio || latest.prescrizioni !== c.prescrizioni)
        throw Error('LO STORICO È CAMBIATO: RICHIAMARE NUOVAMENTE IL GIUDIZIO.');
      document.querySelectorAll('input[name="giudizio"]').forEach(x => {
        const next = !!c.giudizio && x.value === c.giudizio;
        if (x.checked !== next) { x.checked = next; x.dispatchEvent(new Event('change',{bubbles:true})); }
      });
      const notes = byId('prescrizioni');
      notes.value = c.prescrizioni;
      notes.dispatchEvent(new Event('input',{bubbles:true}));
      notes.dispatchEvent(new Event('change',{bubbles:true}));
      close();
      showMessage('GIUDIZIO PRECEDENTE COPIATO NELLA SCHERMATA. CONTROLLARE E SALVARE LA NUOVA VISITA SE APPROPRIATO.');
    } catch(e) { showMessage(e.message || String(e)); }
  };
  // Read-only, also accessible to isolated synthetic tests.
  window.lumenGiudizioPrecedente = {previous, samePerson};
})();