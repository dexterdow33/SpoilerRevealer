/* RSA91A-Engine: app shell and navigation. */
(function (root) {
  'use strict';
  const NS = root.RSA91A;
  const { $, $$ } = NS.ui;

  const VIEWS = {
    requests: () => NS.tracker.render(),
    studio: (p) => NS.studio.render(p),
    letters: (p) => NS.lettersUi.render(p),
    citations: () => NS.settingsUi.renderCitations(),
    settings: () => NS.settingsUi.renderSettings(),
    help: () => NS.settingsUi.renderHelp(),
  };
  let current = 'requests';

  function go(view, params) {
    if (!VIEWS[view]) view = 'requests';
    current = view;
    for (const el of $$('.view')) el.hidden = el.id !== 'view-' + view;
    for (const b of $$('nav [data-view]')) b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
    VIEWS[view](params || {});
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* file:// in some browsers */ }
  }

  function backupNag() {
    const s = NS.store.state;
    const el = $('#backup-nag');
    const days = s.lastBackup ? (Date.now() - Date.parse(s.lastBackup)) / 86400000 : Infinity;
    el.hidden = !(s.requests.length && days > 7);
  }

  function start() {
    NS.store.load();
    for (const b of $$('nav [data-view]')) b.addEventListener('click', () => go(b.dataset.view));
    $('#backup-nag button').addEventListener('click', () => go('settings'));
    NS.store.onChange(() => {
      backupNag();
      if (current === 'requests') NS.tracker.render();
    });
    backupNag();
    go((location.hash || '#requests').slice(1));
  }

  NS.app = { go, start };
  document.addEventListener('DOMContentLoaded', start);
})(typeof self !== 'undefined' ? self : this);
