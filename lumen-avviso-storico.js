(() => {
  'use strict';

  const bar = document.getElementById('lumenWorkerIdentity');
  if (!bar) return;

  // Keep the private index outside the clinical storage and backup namespace.
  const storageKey = 'private-lumen-visit-index-v1';
  const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '')
    .toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
  let index = new Map();
  let currentKey = '';

  function buildIndex(payload) {
    if (payload?.tipo !== 'lumen-indice-storico-v1' || !Array.isArray(payload.visite)) {
      throw new Error('Seleziona un indice storico LUMEN in formato JSON.');
    }
    const result = new Map();
    for (const row of payload.visite) {
      if (!['nominativo', 'data', 'committente', 'datore', 'sede', 'nota'].every(
        field => typeof row?.[field] === 'string'
      ) || !normalize(row.nominativo) || (row.data && !/^\d{4}-\d{2}-\d{2}$/.test(row.data))) {
        throw new Error('Il file contiene una riga non valida.');
      }
      const key = normalize(row.nominativo);
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(row);
    }
    for (const rows of result.values()) rows.sort((a, b) => b.data.localeCompare(a.data));
    return result;
  }

  const badge = document.createElement('button');
  badge.type = 'button';
  badge.hidden = true;
  badge.setAttribute('aria-haspopup', 'dialog');
  bar.append(badge);

  const dialog = document.createElement('dialog');
  dialog.id = 'lumenHistoryDialog';
  dialog.setAttribute('aria-label', 'Storico visite');
  dialog.innerHTML = '<h2>Storico visite</h2><p data-summary></p><ul></ul>'
    + '<p data-status role="status"></p><button type="button" data-import>Carica indice storico</button> '
    + '<button type="button" data-close>Chiudi</button>';
  document.body.append(dialog);
  const summary = dialog.querySelector('[data-summary]');
  const status = dialog.querySelector('[data-status]');
  const list = dialog.querySelector('ul');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.hidden = true;
  dialog.append(input);

  function refresh() {
    const surname = document.getElementById('cognome').value.trim();
    const givenName = document.getElementById('nome').value.trim();
    const key = surname && givenName ? normalize(surname + givenName) : '';
    if (key !== currentKey && dialog.open) dialog.close();
    currentKey = key;
    const matches = index.get(key) ?? [];
    badge.hidden = index.size > 0 && matches.length === 0;
    badge.textContent = index.size ? `Storico · ${matches.length} riscontri` : 'Carica indice storico';
  }

  function showMatches() {
    const matches = index.get(currentKey) ?? [];
    summary.textContent = index.size
      ? 'Possibili visite precedenti · Identità da verificare'
      : 'Carica il file JSON dell’indice storico su questo dispositivo.';
    list.replaceChildren();
    for (const row of matches) {
      const item = document.createElement('li');
      const date = row.data ? row.data.split('-').reverse().join('/') : 'Data da verificare';
      item.textContent = [date, row.committente, row.datore, row.sede, row.nota].filter(Boolean).join(' · ');
      list.append(item);
    }
  }

  badge.addEventListener('click', () => {
    status.textContent = '';
    showMatches();
    dialog.showModal();
  });
  dialog.querySelector('[data-import]').addEventListener('click', () => input.click());
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const replacement = buildIndex(payload);
      localStorage.setItem(storageKey, JSON.stringify(payload));
      index = replacement;
      refresh();
      showMatches();
      status.textContent = 'Indice caricato su questo dispositivo.';
    } catch (error) {
      status.textContent = 'Caricamento non riuscito. ' + error.message;
    } finally {
      input.value = '';
    }
  });

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) index = buildIndex(JSON.parse(saved));
  } catch {
    // An unavailable or invalid local index can be loaded again from the dialog.
  }
  bar.addEventListener('lumen:worker-name', refresh);
  refresh();
})();
