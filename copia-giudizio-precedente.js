/* LUMEN · Copia il giudizio da una visita precedente, senza salvare automaticamente. */
(function (root) {
  'use strict';
  const api = root.lumenBatchCertApi;
  const archive = root.lumenArchiveVisitsApi;
  const form = document.getElementById('cartellaForm');
  const anchor = document.getElementById('giudizi');
  if (!api || !archive || !form || !anchor) return;

  function norm(value) {
    return String(value || '').trim().toUpperCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  }
  function cf(value) { return norm(value).replace(/\s/g, ''); }
  function iso(value) {
    const v = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
  }
  function dateLabel(value) { return iso(value).split('-').reverse().join('/'); }
  function identityMatches(a, b) {
    if (!norm(a.cognome) || !norm(a.nome) ||
        norm(a.cognome) !== norm(b.cognome) || norm(a.nome) !== norm(b.nome)) return false;
    const acf = cf(a.codice_fiscale), bcf = cf(b.codice_fiscale);
    const ab = iso(a.data_nascita), bb = iso(b.data_nascita);
    if (acf && bcf && acf !== bcf) return false;
    if (ab && bb && ab !== bb) return false;
    return (acf && bcf && acf === bcf) || (ab && bb && ab === bb);
  }
  function candidates(current, records, allowedJudgements) {
    const visitNow = iso(current.data_giudizio || current.data_cartella);
    if (!visitNow || !norm(current.cognome) || !norm(current.nome)) return [];
    const out = [];
    for (const rec of records || []) {
      if (!rec) continue;
      const versions = [
        ...(Array.isArray(rec.history) ? rec.history.map(h => h && h.data).filter(Boolean) : []),
        rec.data
      ].filter(Boolean);
      for (const data of versions) {
        const src = {
          ...data,
          cognome: data.cognome || rec.cognome,
          nome: data.nome || rec.nome,
          codice_fiscale: data.codice_fiscale || rec.cf,
          data_nascita: data.data_nascita || rec.dataNascita
        };
        if (!identityMatches(current, src)) continue;
        const visit = iso(src.data_giudizio || src.data_cartella);
        const judgement = norm(src.giudizio);
        if (!visit || visit >= visitNow || !allowedJudgements.includes(judgement)) continue;
        out.push({ ...src, _visit: visit, giudizio: judgement });
      }
    }
    // Without a CF, reject ambiguous identities even if name and date of birth agree.
    if (!cf(current.codice_fiscale)) {
      const codes = new Set(out.map(c => cf(c.codice_fiscale)).filter(Boolean));
      if (codes.size > 1) return [];
    }
    return out.sort((a, b) => b._visit.localeCompare(a._visit));
  }

  const row = document.createElement('div');
  row.id = 'lumenCopiaGiudizioBox';
  row.hidden = true;
  row.style.cssText = 'margin:12px 0 16px;padding:12px;border:1px solid #96b9a0;border-radius:8px;background:#f2f8f3';
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'btnCopiaGiudizioPrecedente';
  button.className = 'success';
  button.textContent = 'COPIA GIUDIZIO PRECEDENTE';
  const description = document.createElement('div');
  description.style.cssText = 'font-size:13px;line-height:1.4;margin-top:7px;color:#29573b';
  row.append(button, description);
  anchor.parentNode.insertBefore(row, anchor);

  const allowed = [...document.querySelectorAll('input[name="giudizio"]')].map(x => x.value);
  let selected = null, currentKey = '', request = 0, timer = null;
  function key(data) {
    return JSON.stringify([norm(data.cognome), norm(data.nome), cf(data.codice_fiscale),
      iso(data.data_nascita), iso(data.data_giudizio || data.data_cartella),
      api.selectionVersion()]);
  }
  function hide() { selected = null; row.hidden = true; currentKey = ''; }
  async function refresh() {
    const ticket = ++request;
    const current = api.collect(), stamp = key(current);
    hide();
    if (!iso(current.data_giudizio || current.data_cartella) ||
        !norm(current.cognome) || !norm(current.nome) ||
        (!cf(current.codice_fiscale) && !iso(current.data_nascita))) return;
    try {
      const records = await archive.list('');
      if (ticket !== request || key(api.collect()) !== stamp) return;
      const list = candidates(current, records, allowed);
      if (!list.length) return;
      selected = list[0];
      currentKey = stamp;
      description.textContent = 'Visita del ' + dateLabel(selected._visit) + ' · ' +
        selected.giudizio + '. Verifica e modifica il giudizio prima di confermare.';
      row.hidden = false;
    } catch (err) {
      if (ticket === request) hide(); // Nessun dato copiato se l'archivio non è leggibile.
    }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 220); }
  form.addEventListener('input', e => {
    if (['cognome', 'nome', 'codice_fiscale', 'data_nascita', 'data_giudizio', 'data_cartella'].includes(e.target.id)) schedule();
  });
  form.addEventListener('change', e => {
    if (['cognome', 'nome', 'codice_fiscale', 'data_nascita', 'data_giudizio', 'data_cartella'].includes(e.target.id)) schedule();
  });
  document.addEventListener('lumen:cartella-applied', schedule);
  button.addEventListener('click', () => {
    if (!selected || key(api.collect()) !== currentKey) { schedule(); return; }
    const previous = selected;
    const fields = ['prescrizioni', 'periodicita', 'periodicita_altro'];
    const existing = [...document.querySelectorAll('input[name="giudizio"]:checked')].length > 0 ||
      fields.some(id => String(document.getElementById(id)?.value || '').trim());
    if (existing && !root.confirm('Sostituire il giudizio e i campi collegati già compilati con quelli della visita del ' +
      dateLabel(previous._visit) + '?\nLe modifiche non saranno salvate automaticamente.')) return;
    const judgement = [...document.querySelectorAll('input[name="giudizio"]')]
      .find(input => input.value === previous.giudizio);
    if (!judgement) return;
    document.querySelectorAll('input[name="giudizio"]').forEach(input => { input.checked = input === judgement; });
    judgement.dispatchEvent(new Event('change', { bubbles: true }));
    for (const id of fields) {
      const el = document.getElementById(id);
      if (!el) continue;
      let value = String(previous[id] || '');
      if (id === 'periodicita' && ![...el.options].some(opt => opt.value === value)) value = '';
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    api.setStatus('GIUDIZIO DEL ' + dateLabel(previous._visit) +
      ' RIPORTATO COME BOZZA. RIVALUTA IDONEITÀ, PRESCRIZIONI E PERIODICITÀ; POI SALVA LA VISITA CORRENTE.');
    description.textContent = 'Giudizio precedente copiato come bozza: controlla i campi prima di salvare.';
  });
  root.lumenCopiaGiudizioCore = { identityMatches, candidates }; // Solo logica pura, per i test.
  schedule();
})(window);
