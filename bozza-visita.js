// Recovery copies are independent from the signed archive and its visit counts.
(() => {
 'use strict';
 const api = window.lumenBatchCertApi;
 const form = document.getElementById('cartellaForm');
 const panel = document.getElementById('bozzeVisita');
 const notice = document.getElementById('statoBozzaVisita');
 const storage = lumenStorage.local;
 const prefix = 'beltrami_bozza_visita_v1_';
 let key = '', previous = '', editing = false, applying = false, busy = false;

 function reset() {
  key = previous = '';
  editing = false;
  notice.textContent = '';
 }
 function persist() {
  if (!editing || applying || busy) return;
  busy = true;
  try {
   const data = api.collect();
   const current = JSON.stringify(data);
   if (previous && JSON.stringify(JSON.parse(previous).data) === current) return;
   // A second tab can have recovered the same draft. Preserve both revisions.
   if (!key || storage.getItem(key) !== previous)
    key = prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
   const value = JSON.stringify({time:Date.now(), data});
   storage.setItem(key, value);
   previous = value;
   notice.textContent = 'Bozza salvata su questo dispositivo alle ' + new Date().toLocaleTimeString('it-IT');
  } catch {
   notice.textContent = 'Bozza non salvata. Mantieni aperta la cartella e usa Salva cartella.';
  } finally { busy = false; }
 }
 function list() {
  panel.replaceChildren();
  try {
   for (let i = 0; i < storage.length; i++) {
    const id = storage.key(i);
    if (!id || !id.startsWith(prefix) || id === key) continue;
    const raw = storage.getItem(id);
    let draft;
    try { draft = JSON.parse(raw); } catch { continue; }
    if (!draft?.data) continue;
    const label = [draft.data.cognome, draft.data.nome].filter(Boolean).join(' ') || 'Cartella senza nominativo';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Riprendi bozza · ' + label + ' · ' + new Date(draft.time).toLocaleString('it-IT');
    button.onclick = () => {
     if (storage.getItem(id) !== raw) { list(); return; }
     persist();
     if (editing && (!previous || JSON.stringify(JSON.parse(previous).data) !== JSON.stringify(api.collect()))) return;
     api.riprendiBozza(draft.data);
     key = id; previous = raw; editing = true;
     notice.textContent = 'Bozza recuperata. Puoi proseguire la visita.';
     list();
    };
    panel.append(button);
   }
  } catch { notice.textContent = 'Impossibile leggere le bozze locali.'; }
  panel.hidden = !panel.childElementCount;
 }
 function changed() {
  if (applying || busy) return;
  editing = true;
  persist();
 }
 window.lumenBozzaVisita = {
  beforeApply() { persist(); applying = true; reset(); },
  afterApply() { applying = false; list(); },
  archived(data) {
   if (!previous || JSON.stringify(JSON.parse(previous).data) !== JSON.stringify(data)) return;
   if (storage.getItem(key) === previous) storage.removeItem(key);
   reset(); list();
  }
 };
 form.addEventListener('input', changed);
 form.addEventListener('change', changed);
 window.addEventListener('beltrami-signature-updated', changed);
 window.addEventListener('pagehide', persist);
 document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
 window.addEventListener('storage', e => { if (!e.key || e.key.includes(prefix)) list(); });
 list();
})();
