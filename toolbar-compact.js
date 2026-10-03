/* The menu changes visibility only; existing buttons keep their handlers. */
(function () {
  'use strict';
  const toolbar = document.getElementById('mainToolbar');
  const toggle = document.getElementById('btnAltriComandi');
  const panel = document.getElementById('toolbarExtra');
  if (!toolbar || !toggle || !panel) return;
  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'CHIUDI COMANDI' : 'ALTRI COMANDI';
  }
  toggle.addEventListener('click', function () { setOpen(panel.hidden); });
  toolbar.addEventListener('click', function (event) {
    const button = event.target.closest('button');
    if (button && button !== toggle) setOpen(false);
  });
  toolbar.addEventListener('change', function (event) {
    if (event.target.matches('input[type="file"]') && event.target.files.length) setOpen(false);
  });
  document.addEventListener('pointerdown', function (event) {
    if (!panel.hidden && !toolbar.contains(event.target)) setOpen(false);
  });
  document.addEventListener('focusin', function (event) {
    if (!panel.hidden && !toolbar.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      setOpen(false);
      toggle.focus();
    }
  });
})();
