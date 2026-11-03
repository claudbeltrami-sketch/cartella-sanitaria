/* Collapsing a section changes presentation only: every field stays in the form. */
(function () {
  'use strict';
  const groups = [...document.querySelectorAll('.lumen-exam')];
  const spirometry = groups.find(group => group.dataset.exam === 'spiro');
  const afterVitals = document.getElementById('lumenSpiroAfterVitals');
  if (spirometry && afterVitals) {
    const printPosition = document.createComment('Posizione di stampa della spirometria');
    spirometry.before(printPosition);
    afterVitals.replaceWith(spirometry);
    const nextClinicalField = spirometry.nextElementSibling;
    window.addEventListener('beforeprint', () => printPosition.after(spirometry));
    window.addEventListener('afterprint', () => nextClinicalField.before(spirometry));
  }
  const result = document.getElementById('visiotest_esito');
  const editor = document.getElementById('visiotest_editor');
  if (result && editor) {
    const unplanned = document.getElementById('visiotest_non_previsto');
    const add = document.getElementById('visiotest_aggiungi');
    const protocol = document.getElementById('protocollo');
    const planned = protocol.querySelector('input[value="VISIOTEST"]');
    const notes = document.getElementById('visiotest_note');
    const preset = document.getElementById('visiotest_nota_predefinita');
    preset.addEventListener('click', event => {
      const option = event.target.closest('button');
      if (!option) return;
      const phrase = option.textContent.trim();
      const existing = notes.value.trim();
      if (!existing.toUpperCase().includes(phrase)) {
        notes.value = [existing, phrase].filter(Boolean).join(' · ');
        notes.dispatchEvent(new Event('input', {bubbles:true}));
      }
      preset.open = false;
      preset.querySelector('summary').focus();
    });
    let adding = false;
    function refreshVisibility() {
      editor.hidden = !(planned.checked || result.value || notes.value.trim() || adding);
      unplanned.hidden = !editor.hidden;
    }
    const choice = document.getElementById('visiotest_scelta');
    const target = document.getElementById('visiotest_per');
    const targetLabel = document.getElementById('visiotest_per_label');
    const confirm = document.getElementById('visiotest_conferma');
    const clear = document.getElementById('visiotest_cancella');
    const status = document.getElementById('visiotest_registrato');
    const corrected = 'NORMALE CON CORREZIONE';
    const prefix = corrected + ' PER ';
    function refreshChoice() {
      targetLabel.hidden = choice.value !== corrected;
      confirm.disabled = !targetLabel.hidden && !target.value;
    }
    function showResult() {
      const value = result.value;
      choice.value = value.startsWith(prefix) ? corrected : value || choice.options[0].value;
      target.value = value.startsWith(prefix) ? value.slice(prefix.length) : '';
      clear.hidden = !value;
      status.textContent = value ? 'Registrato: ' + value : 'Esito da confermare';
      refreshChoice();
      refreshVisibility();
    }
    function saveResult(value) {
      result.value = value;
      result.dispatchEvent(new Event('change', {bubbles:true}));
      showResult();
    }
    choice.addEventListener('change', refreshChoice);
    target.addEventListener('change', refreshChoice);
    confirm.onclick = () => saveResult(choice.value === corrected ? prefix + target.value : choice.value);
    clear.onclick = () => { adding = false; saveResult(''); };
    add.onclick = () => { adding = true; refreshVisibility(); choice.focus(); };
    protocol.addEventListener('change', refreshVisibility);
    notes.addEventListener('input', refreshVisibility);
    function restoreEditor() { adding = false; preset.open = false; showResult(); }
    document.addEventListener('lumen:cartella-applied', restoreEditor);
    result.form.addEventListener('reset', () => setTimeout(restoreEditor, 0));
    result.classList.add('visiotest-print-result');
    showResult();
  }
  const ids = {
    audio: ['audio_dx_500','audio_dx_1000','audio_dx_2000','audio_dx_4000','audio_sx_500','audio_sx_1000','audio_sx_2000','audio_sx_4000','audiometria_esito','audiometria_difetto','audiometria_interpretazione'],
    spiro: ['spirometria_fvc','spirometria_fvc_percentuale','spirometria_fev1','spirometria_fev1_percentuale','spirometria_pef','spirometria_pef_percentuale']
  };
  function refresh(reset) {
    groups.forEach(group => {
      const fields = group.querySelector('.lumen-exam-fields');
      const button = group.querySelector('button.lumen-exam-toggle');
      const filled = ids[group.dataset.exam].some(id => (document.getElementById(id)?.value || '').trim());
      const planned = [...document.querySelectorAll('#protocollo input:checked')].some(el => el.value === group.dataset.protocol);
      group.classList.toggle('lumen-exam-filled',filled);
      button.querySelector('span').textContent = filled ? 'Dati presenti' : planned ? 'Da eseguire' : 'Non compilata';
      if (reset) fields.hidden = !filled;
      button.setAttribute('aria-expanded',String(!fields.hidden));
    });
  }
  groups.forEach(group => {
    group.querySelector('button.lumen-exam-toggle').onclick = () => {
      const fields = group.querySelector('.lumen-exam-fields');
      fields.hidden = !fields.hidden;
      refresh(false);
    };
  });
  const form = document.getElementById('cartellaForm');
  form.addEventListener('input',() => refresh(false));
  form.addEventListener('change',() => refresh(false));
  form.addEventListener('reset',() => setTimeout(() => refresh(true),0));
  document.addEventListener('lumen:cartella-applied',() => refresh(true));
  window.addEventListener('beforeprint',() => refresh(false));
  const css = document.createElement('style');
  css.textContent = '@media screen{.visiotest-print-result{display:none}}@media print{#visiotest_editor,#visiotest_non_previsto{display:none!important}}.lumen-exam-toggle{width:100%;justify-content:space-between;gap:12px;margin:8px 0;min-height:38px;background:#eef3f7;color:#173f61;border:1px solid #aabecd;text-align:left}.lumen-exam-toggle span{font-size:12px}.lumen-exam-fields[hidden]{display:none}@media print{.lumen-exam-toggle{display:none!important}.lumen-exam:not(.lumen-exam-filled){display:none!important}.lumen-exam-filled>.lumen-exam-fields[hidden]{display:block!important}}';
  document.head.append(css);
  refresh(true);
})();
