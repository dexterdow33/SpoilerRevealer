/*
 * RSA91A-Engine: local data store.
 *
 * Everything stays on this computer, in the browser's storage for this app.
 * Browser storage can be cleared by the user or the browser, so the app nags
 * for a backup file and can restore from one.
 */
(function (root) {
  'use strict';
  const NS = root.RSA91A = root.RSA91A || {};
  const KEY = 'rsa91a-engine.v1';

  function defaults() {
    return {
      version: 1,
      settings: {
        profile: { orgName: '', address: '', phone: '', email: '', signerName: '', signerTitle: '' },
        holidays: [],
        countReceiptDay: false,
        idPrefix: 'RTK',
        redaction: { dpi: 200, format: 'jpeg', labels: true, color: '#000000', batesPrefix: '', batesDigits: 6 },
      },
      userCitations: [],
      requests: [],
      counters: {},
      lastBackup: null,
    };
  }

  let state = defaults();
  let storageOk = true;
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = migrate(JSON.parse(raw));
    } catch (e) {
      storageOk = false;
    }
    return state;
  }

  function migrate(s) {
    const d = defaults();
    const out = Object.assign(d, s);
    out.settings = Object.assign(defaults().settings, s.settings || {});
    out.settings.profile = Object.assign(defaults().settings.profile, (s.settings || {}).profile || {});
    out.settings.redaction = Object.assign(defaults().settings.redaction, (s.settings || {}).redaction || {});
    out.requests = Array.isArray(s.requests) ? s.requests : [];
    out.userCitations = Array.isArray(s.userCitations) ? s.userCitations : [];
    return out;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
    for (const fn of listeners) fn(state);
  }

  function nextId() {
    const year = new Date().getFullYear();
    const prefix = (state.settings.idPrefix || 'RTK').replace(/[^A-Za-z0-9-]/g, '');
    const key = prefix + '-' + year;
    let n = state.counters[key] || 0;
    let id;
    do {
      n++;
      id = key + '-' + String(n).padStart(4, '0');
    } while (state.requests.some((r) => r.id === id));
    state.counters[key] = n;
    return id;
  }

  function upsertRequest(req) {
    const i = state.requests.findIndex((r) => r.id === req.id);
    if (i >= 0) state.requests[i] = req;
    else state.requests.unshift(req);
    save();
  }

  function removeRequest(id) {
    state.requests = state.requests.filter((r) => r.id !== id);
    save();
  }

  function getRequest(id) {
    return state.requests.find((r) => r.id === id) || null;
  }

  function exportJSON() {
    state.lastBackup = new Date().toISOString();
    save();
    return JSON.stringify({ app: 'RSA91A-Engine', exported: state.lastBackup, data: state }, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.app !== 'RSA91A-Engine' || !parsed.data) throw new Error('This is not an RSA91A-Engine backup file.');
    state = migrate(parsed.data);
    save();
  }

  NS.store = {
    load, save, nextId, upsertRequest, removeRequest, getRequest, exportJSON, importJSON,
    get state() { return state; },
    get storageOk() { return storageOk; },
    onChange(fn) { listeners.add(fn); },
  };
})(typeof self !== 'undefined' ? self : this);
