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
  function compactGroups() {
    const groups = [...panel.querySelectorAll('.tool-group')];
    const target = selector => panel.querySelector(selector + ' .tool-buttons');
    const keep = ['btnSalva','btnArchivioCartelle','btnCert','btnStampa','btnFirmaLavoratore','btnAltriComandi'];
    const primary = toolbar.querySelector('.toolbar-primary');
    const cert = document.getElementById('btnCert');
    if (cert) primary.append(cert);
    [...primary.children].forEach(function (el) {
      if (keep.includes(el.id)) return;
      const handoff = el.classList.contains('signature-command');
      const destination = target(handoff ? '.handoff-tools' : '.archive-tools');
      if (destination) destination.append(el);
    });
    keep.forEach(id => {const el = document.getElementById(id); if (el) primary.append(el);});
    groups.forEach(function (group, index) {
      const title = group.querySelector('.tool-group-title');
      const buttons = group.querySelector('.tool-buttons');
      if (!title || !buttons) return;
      buttons.id = buttons.id || 'lumen-command-group-' + index;
      buttons.hidden = true;
      const heading = document.createElement('button');
      heading.type = 'button';
      heading.className = 'lumen-group-toggle';
      heading.textContent = title.textContent;
      heading.setAttribute('aria-controls', buttons.id);
      heading.setAttribute('aria-expanded','false');
      title.replaceChildren(heading);
      heading.addEventListener('click', function () {
        const open = buttons.hidden;
        groups.forEach(function (other) {
          const list = other.querySelector('.tool-buttons'), control = other.querySelector('.lumen-group-toggle');
          if (list) list.hidden = true;
          if (control) control.setAttribute('aria-expanded','false');
        });
        buttons.hidden = !open;
        heading.setAttribute('aria-expanded',String(open));
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () {setTimeout(compactGroups,0);});
  else setTimeout(compactGroups,0);
  toggle.addEventListener('click', function () { setOpen(panel.hidden); });
  toolbar.addEventListener('click', function (event) {
    const button = event.target.closest('button');
    if (button && button !== toggle && !button.classList.contains('lumen-group-toggle')) setOpen(false);
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

/* Keep backup controls beside the count status without recreating their handlers. */
(function () {
  'use strict';
  function install() {
    const count = document.getElementById('conteggioAutoPanel');
    const backup = document.getElementById('lumenBackupOverlay');
    const details = document.getElementById('lumenBackupDetails');
    if (!count || !backup || !details || document.getElementById('btnBackupArchivio')) return false;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'btnBackupArchivio';
    button.textContent = 'BACKUP E ARCHIVIO PDF';
    button.setAttribute('aria-controls', backup.id);
    count.append(button);
    count.after(backup);
    const summary = details.querySelector('summary');
    if (summary) summary.hidden = true;
    function sync() {
      backup.hidden = !details.open;
      button.setAttribute('aria-expanded', String(details.open));
    }
    button.addEventListener('click', function () {
      details.open = !details.open;
      sync();
    });
    details.addEventListener('toggle', sync);
    const style = document.createElement('style');
    style.textContent = '#lumenBackupOverlay[hidden]{display:none!important}#lumenBackupDetails>summary[hidden]{display:none!important}@media screen{#conteggioAutoPanel #btnBackupArchivio{margin-left:auto;min-height:38px;padding:8px 12px;font-size:12px;background:#287a46}#conteggioAutoPanel>p{flex:1 1 160px}#lumenBackupOverlay{padding-top:12px!important}}';
    document.head.append(style);
    sync();
    return true;
  }
  if (!install()) {
    const observer = new MutationObserver(function () { if (install()) observer.disconnect(); });
    observer.observe(document.body, {childList:true,subtree:true});
    window.addEventListener('load', function () {install();observer.disconnect();}, {once:true});
  }
})();
