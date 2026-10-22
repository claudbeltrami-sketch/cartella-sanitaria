/* Collapsing a section changes presentation only: every field stays in the form. */
(function () {
  'use strict';
  const groups = [...document.querySelectorAll('.lumen-exam')];
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
  css.textContent = '.lumen-exam-toggle{width:100%;justify-content:space-between;gap:12px;margin:8px 0;min-height:38px;background:#eef3f7;color:#173f61;border:1px solid #aabecd;text-align:left}.lumen-exam-toggle span{font-size:12px}.lumen-exam-fields[hidden]{display:none}@media print{.lumen-exam-toggle{display:none!important}.lumen-exam:not(.lumen-exam-filled){display:none!important}.lumen-exam-filled>.lumen-exam-fields[hidden]{display:block!important}}';
  document.head.append(css);
  refresh(true);
})();
