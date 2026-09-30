/* RSA91A-Engine: Redaction Studio view. */
(function (root) {
  'use strict';
  const NS = root.RSA91A;
  const { h, $, clear, toast, download, readFile, pickFile, confirmDialog, csv } = NS.ui;
  const { store, detectors, citations, deadlines, engine } = NS;

  const S = {
    doc: null,
    page: 0,
    zoom: 1,
    viewport: null,
    marks: [],
    withheld: new Map(),
    selected: null,
    nextId: 1,
    requestId: '',
    defaultCitation: '91-A:5,IV',
    defaultReason: '',
    detectorIds: new Set(detectors.DETECTORS.filter((d) => d.defaultOn).map((d) => d.id)),
    terms: '',
    regex: '',
    textless: [],
    busy: false,
    preview: false,
    lastExport: null,
    renderToken: 0,
  };

  const exemptionOptions = () => citations.exemptions(store.state.userCitations);
  const citeOf = (id) => {
    const c = citations.byId(id, store.state.userCitations);
    return c ? c.cite : '';
  };

  // ---------- document ----------

  async function open(file) {
    if (!file) return;
    const mime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(mime)) {
      toast('Open a PDF, PNG, or JPEG file.', 'error');
      return;
    }
    if (S.marks.length && !await confirmDialog('Close the current document? Unsaved redaction marks will be lost unless you saved the session.', 'Open new file')) return;
    setBusy('Opening ' + file.name + '...');
    try {
      const bytes = await readFile(file);
      if (S.doc) S.doc.destroy();
      S.doc = await engine.SourceDocument.open(bytes, file.name, mime);
      S.page = 0;
      S.marks = [];
      S.withheld = new Map();
      S.selected = null;
      S.lastExport = null;
      S.textless = [];
      S.annotated = [];
      for (let i = 0; i < S.doc.numPages; i++) {
        if (!await S.doc.hasText(i)) S.textless.push(i + 1);
        if ((await S.doc.annotations(i)).length) S.annotated.push(i + 1);
      }
      await fitWidth();
      renderSidebar();
      toast('Opened ' + file.name + ' (' + S.doc.numPages + ' page' + (S.doc.numPages === 1 ? '' : 's') + ')', 'ok');
    } catch (e) {
      console.error(e);
      toast('Could not open file: ' + e.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  function setBusy(msg) {
    S.busy = !!msg;
    const el = $('#studio-busy');
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  // ---------- page rendering ----------

  async function renderPage() {
    const wrap = $('#page-wrap');
    if (!wrap || !S.doc) return;
    const token = ++S.renderToken;
    const canvas = $('#page-canvas');
    const dpr = window.devicePixelRatio || 1;
    const page = await S.doc.page(S.page);
    const vp = page.getViewport({ scale: S.zoom });
    const tmp = document.createElement('canvas');
    await S.doc.render(S.page, tmp, S.zoom * dpr);
    if (token !== S.renderToken) return;
    canvas.width = tmp.width;
    canvas.height = tmp.height;
    canvas.getContext('2d').drawImage(tmp, 0, 0);
    canvas.style.width = vp.width + 'px';
    canvas.style.height = vp.height + 'px';
    wrap.style.width = vp.width + 'px';
    wrap.style.height = vp.height + 'px';
    S.viewport = vp;
    drawOverlay();
    updatePager();
  }

  function drawOverlay() {
    const ov = $('#page-overlay');
    if (!ov || !S.viewport) return;
    clear(ov);
    if (S.withheld.has(S.page)) {
      const w = S.withheld.get(S.page);
      ov.appendChild(h('div', { class: 'withheld-cover' }, h('strong', {}, 'PAGE WITHHELD IN FULL'), h('span', {}, citeOf(w.citationId)), h('span', {}, w.reason || '')));
    }
    for (const m of S.marks) {
      if (m.page !== S.page || m.status === 'rejected') continue;
      for (const r of m.rects) {
        const [x0, y0, x1, y1] = engine.toViewportRect(S.viewport, r);
        const el = h('div', {
          class: 'mark ' + m.status + (S.selected === m.id ? ' selected' : '') + (S.preview ? ' preview' : ''),
          style: `left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px`,
          title: (m.label || 'Manual box') + (m.text ? ': ' + m.text : '') + ' [' + (citeOf(m.citationId) || 'no exemption') + ']',
          dataset: { id: String(m.id) },
        });
        el.addEventListener('mousedown', (e) => { e.stopPropagation(); select(m.id); });
        el.addEventListener('dblclick', (e) => { e.stopPropagation(); toggle(m); });
        ov.appendChild(el);
      }
    }
  }

  function updatePager() {
    const p = $('#pager-label');
    if (p && S.doc) p.textContent = 'Page ' + (S.page + 1) + ' of ' + S.doc.numPages;
    const z = $('#zoom-label');
    if (z) z.textContent = Math.round(S.zoom * 100) + '%';
  }

  async function goPage(i) {
    if (!S.doc) return;
    S.page = Math.max(0, Math.min(S.doc.numPages - 1, i));
    await renderPage();
    renderMarkList();
    renderPageTools();
  }

  async function fitWidth() {
    if (!S.doc) return;
    const page = await S.doc.page(S.page);
    const vp = page.getViewport({ scale: 1 });
    const avail = ($('#viewer') ? $('#viewer').clientWidth : 900) - 48;
    S.zoom = Math.max(0.3, Math.min(3, avail / vp.width));
    await renderPage();
  }

  // ---------- drawing manual boxes ----------

  function attachDrawing() {
    const ov = $('#page-overlay');
    let start = null;
    let rubber = null;
    const pos = (e) => {
      const b = ov.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };
    ov.addEventListener('mousedown', (e) => {
      if (!S.doc || e.button !== 0) return;
      start = pos(e);
      rubber = h('div', { class: 'rubber' });
      ov.appendChild(rubber);
      select(null);
    });
    window.addEventListener('mousemove', (e) => {
      if (!start) return;
      const [x, y] = pos(e);
      Object.assign(rubber.style, {
        left: Math.min(x, start[0]) + 'px', top: Math.min(y, start[1]) + 'px',
        width: Math.abs(x - start[0]) + 'px', height: Math.abs(y - start[1]) + 'px',
      });
    });
    window.addEventListener('mouseup', async (e) => {
      if (!start) return;
      const [x, y] = pos(e);
      const s = start;
      start = null;
      rubber.remove();
      if (Math.abs(x - s[0]) < 4 || Math.abs(y - s[1]) < 4) return;
      const p0 = S.viewport.convertToPdfPoint(s[0], s[1]);
      const p1 = S.viewport.convertToPdfPoint(x, y);
      const rect = engine.normRect([p0[0], p0[1], p1[0], p1[1]]);
      const text = await S.doc.textUnder(S.page, rect);
      addMarks([{ page: S.page, rects: [rect], text, type: 'manual', label: 'Manual box' }], 'accepted', 'manual');
    });
  }

  // ---------- marks ----------

  function addMarks(list, status, source) {
    let added = 0;
    for (const m of list) {
      const dup = S.marks.find((x) => x.page === m.page && x.status !== 'rejected' &&
        JSON.stringify(x.rects) === JSON.stringify(m.rects));
      if (dup) continue;
      S.marks.push(Object.assign({
        id: S.nextId++, status, source, citationId: S.defaultCitation, reason: S.defaultReason, created: new Date().toISOString(),
      }, m));
      added++;
    }
    drawOverlay();
    renderMarkList();
    return added;
  }

  function select(id) {
    S.selected = id;
    drawOverlay();
    renderMarkList();
    if (id !== null) {
      const row = document.querySelector('.mark-row[data-id="' + id + '"]');
      if (row) row.scrollIntoView({ block: 'nearest' });
    }
  }

  function toggle(m) {
    m.status = m.status === 'accepted' ? 'proposed' : 'accepted';
    drawOverlay();
    renderMarkList();
  }

  function removeMark(id) {
    S.marks = S.marks.filter((m) => m.id !== id);
    if (S.selected === id) S.selected = null;
    drawOverlay();
    renderMarkList();
  }

  function bulk(status, pageOnly) {
    for (const m of S.marks) {
      if (m.status !== 'proposed') continue;
      if (pageOnly && m.page !== S.page) continue;
      m.status = status;
    }
    drawOverlay();
    renderMarkList();
  }

  async function scan() {
    if (!S.doc) return toast('Open a document first.', 'error');
    const regexes = [];
    if (S.regex.trim()) {
      try { new RegExp(S.regex); } catch (e) { return toast('Custom pattern is not a valid regular expression: ' + e.message, 'error'); }
      regexes.push({ source: S.regex.trim(), flags: 'gi' });
    }
    setBusy('Scanning...');
    try {
      const found = await S.doc.scan({
        detectorIds: Array.from(S.detectorIds),
        terms: S.terms.split('\n').map((t) => t.trim()).filter(Boolean),
        regexes,
      }, (i, n) => setBusy('Scanning page ' + i + ' of ' + n + '...'));
      const added = addMarks(found, 'proposed', 'auto');
      toast(added + ' new proposed redaction' + (added === 1 ? '' : 's') + ' found. Review each one before export.', added ? 'ok' : 'info');
      if (S.textless.length) toast(S.textless.length + ' page(s) have no text layer. Check them by eye and draw boxes by hand.', 'warn');
    } catch (e) {
      console.error(e);
      toast('Scan failed: ' + e.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  // ---------- sidebar ----------

  function citationSelect(value, onchange) {
    return h('select', { onchange: (e) => onchange(e.target.value) },
      exemptionOptions().map((c) => h('option', { value: c.id, selected: c.id === value ? true : null }, c.cite + (c.userSupplied ? ' (user-added)' : ''))));
  }

  function renderSidebar() {
    const sb = $('#studio-sidebar');
    if (!sb) return;
    clear(sb);
    const reqs = store.state.requests;

    sb.appendChild(h('section', {},
      h('h3', {}, '1. Document'),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: async () => open(await pickFile('application/pdf,image/png,image/jpeg')) }, S.doc ? 'Open another file' : 'Open PDF or image')),
      S.doc ? h('dl', { class: 'meta' },
        h('dt', {}, 'File'), h('dd', {}, S.doc.fileName),
        h('dt', {}, 'Pages'), h('dd', {}, String(S.doc.numPages)),
        h('dt', {}, 'SHA-256'), h('dd', { class: 'mono small', title: S.doc.sha256 }, S.doc.sha256.slice(0, 16) + '...')) : h('p', { class: 'help' }, 'Or drag a file onto the page area.'),
      (S.annotated || []).length ? h('p', { class: 'alert warn' }, 'Form fields or comments on page(s) ' + S.annotated.join(', ') + '. Their visible content is printed into the output; the scan checks their values, but review them by eye.') : null,
      S.textless.length ? h('p', { class: 'alert warn' }, 'No text layer on page(s) ' + S.textless.join(', ') + '. These are likely scans. Automatic detection cannot read them; review by eye and draw boxes.') : null,
      h('label', {}, h('span', {}, 'Linked request'),
        h('select', { onchange: (e) => { S.requestId = e.target.value; } },
          h('option', { value: '' }, 'None'),
          reqs.map((r) => h('option', { value: r.id, selected: r.id === S.requestId ? true : null }, r.id + ' - ' + (r.requesterName || r.agency || '')))))));

    const detList = h('div', { class: 'checks' }, detectors.DETECTORS.map((d) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: S.detectorIds.has(d.id), onchange: (e) => { if (e.target.checked) S.detectorIds.add(d.id); else S.detectorIds.delete(d.id); } }),
      ' ' + d.label)));
    const terms = h('textarea', { rows: 4, placeholder: 'One per line: names, case numbers, addresses...' });
    terms.value = S.terms;
    terms.addEventListener('input', (e) => { S.terms = e.target.value; });
    sb.appendChild(h('section', {},
      h('h3', {}, '2. Find sensitive information'),
      detList,
      h('label', {}, h('span', {}, 'Names and terms'), terms),
      h('label', {}, h('span', {}, 'Custom pattern (regular expression)'),
        h('input', { type: 'text', value: S.regex, placeholder: 'e.g. \\d{3}-\\d{4}-CV-\\d{5}', oninput: (e) => { S.regex = e.target.value; } })),
      h('button', { class: 'primary', disabled: !S.doc, onclick: scan }, 'Scan document'),
      h('p', { class: 'help' }, 'Detectors propose. Nothing is redacted until you accept it. Draw a box on the page to redact anything by hand.')));

    const reason = h('textarea', { rows: 2, placeholder: 'Why the exemption applies (required in a written denial)' });
    reason.value = S.defaultReason;
    reason.addEventListener('input', (e) => { S.defaultReason = e.target.value; });
    const cite = citations.byId(S.defaultCitation, store.state.userCitations);
    sb.appendChild(h('section', {},
      h('h3', {}, '3. Default exemption for new marks'),
      citationSelect(S.defaultCitation, (v) => { S.defaultCitation = v; renderSidebar(); }),
      cite ? h('p', { class: 'help' }, cite.summary) : null,
      cite && cite.balancing ? h('p', { class: 'help strong' }, 'Balancing test applies. For each redaction, record the privacy interest, the public interest in disclosure, and why nondisclosure outweighs it.') : null,
      reason,
      h('button', { class: 'ghost small', onclick: () => {
        let n = 0;
        for (const m of S.marks) if (m.status !== 'rejected') { m.citationId = S.defaultCitation; m.reason = S.defaultReason; n++; }
        renderMarkList(); drawOverlay(); toast('Applied to ' + n + ' marks.');
      } }, 'Apply to all current marks')));

    sb.appendChild(h('section', {}, h('h3', {}, '4. Review marks'), h('div', { id: 'mark-list' })));
    sb.appendChild(h('section', {}, h('h3', {}, '5. This page'), h('div', { id: 'page-tools' })));
    sb.appendChild(exportSection());
    renderMarkList();
    renderPageTools();
  }

  function renderMarkList() {
    const host = $('#mark-list');
    if (!host) return;
    clear(host);
    const counts = { proposed: 0, accepted: 0, rejected: 0 };
    for (const m of S.marks) counts[m.status]++;
    host.appendChild(h('p', { class: 'counts' },
      h('span', { class: 'pill proposed' }, counts.proposed + ' to review'),
      h('span', { class: 'pill accepted' }, counts.accepted + ' accepted'),
      h('span', { class: 'pill rejected' }, counts.rejected + ' rejected'),
      h('span', { class: 'pill' }, S.withheld.size + ' pages withheld')));
    host.appendChild(h('div', { class: 'row wrap' },
      h('button', { class: 'small', onclick: () => bulk('accepted', true) }, 'Accept page'),
      h('button', { class: 'small', onclick: () => bulk('accepted', false) }, 'Accept all'),
      h('button', { class: 'small ghost', onclick: () => bulk('rejected', true) }, 'Reject page'),
      h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: S.preview, onchange: (e) => { S.preview = e.target.checked; drawOverlay(); } }), ' Preview as final')));

    const list = h('div', { class: 'mark-list' });
    const pageMarks = S.marks.filter((m) => m.page === S.page);
    const others = S.marks.length - pageMarks.length;
    if (!pageMarks.length) list.appendChild(h('p', { class: 'help' }, 'No marks on this page.'));
    for (const m of pageMarks) {
      const reason = h('input', { type: 'text', value: m.reason || '', placeholder: 'Reason', oninput: (e) => { m.reason = e.target.value; } });
      list.appendChild(h('div', { class: 'mark-row ' + m.status + (S.selected === m.id ? ' selected' : ''), dataset: { id: String(m.id) }, onclick: () => { if (S.selected !== m.id) select(m.id); } },
        h('div', { class: 'row' },
          h('span', { class: 'tag' }, m.label || 'Manual box'),
          h('div', { class: 'spacer' }),
          m.status !== 'accepted' ? h('button', { class: 'small', onclick: (e) => { e.stopPropagation(); m.status = 'accepted'; drawOverlay(); renderMarkList(); } }, 'Accept') : null,
          m.status !== 'rejected' ? h('button', { class: 'small ghost', onclick: (e) => { e.stopPropagation(); m.status = 'rejected'; drawOverlay(); renderMarkList(); } }, 'Reject') : null,
          h('button', { class: 'small danger', title: 'Delete mark', onclick: (e) => { e.stopPropagation(); removeMark(m.id); } }, 'x')),
        m.text ? h('div', { class: 'excerpt mono' }, m.text) : null,
        citationSelect(m.citationId, (v) => { m.citationId = v; drawOverlay(); }),
        reason));
    }
    host.appendChild(list);
    if (others) host.appendChild(h('p', { class: 'help' }, others + ' mark(s) on other pages. ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); nextProposed(); } }, 'Jump to next page with marks to review')));
  }

  function nextProposed() {
    const pages = [...new Set(S.marks.filter((m) => m.status === 'proposed').map((m) => m.page))].sort((a, b) => a - b);
    if (!pages.length) return toast('No proposed marks left to review.', 'ok');
    const next = pages.find((p) => p > S.page);
    goPage(next === undefined ? pages[0] : next);
  }

  function renderPageTools() {
    const host = $('#page-tools');
    if (!host) return;
    clear(host);
    if (!S.doc) return host.appendChild(h('p', { class: 'help' }, 'Open a document.'));
    if (S.withheld.has(S.page)) {
      const w = S.withheld.get(S.page);
      const reason = h('input', { type: 'text', value: w.reason || '', placeholder: 'Reason', oninput: (e) => { w.reason = e.target.value; } });
      host.appendChild(h('div', {},
        h('p', {}, 'This page will be replaced with a "withheld" slip sheet.'),
        citationSelect(w.citationId, (v) => { w.citationId = v; drawOverlay(); }), reason,
        h('button', { class: 'small', onclick: () => { S.withheld.delete(S.page); drawOverlay(); renderPageTools(); renderMarkList(); } }, 'Release this page')));
    } else {
      host.appendChild(h('button', { class: 'small', onclick: () => {
        S.withheld.set(S.page, { citationId: S.defaultCitation, reason: S.defaultReason });
        drawOverlay(); renderPageTools(); renderMarkList();
      } }, 'Withhold this entire page'));
    }
  }

  // ---------- export ----------

  function exportSection() {
    const r = store.state.settings.redaction;
    const saveR = () => store.save();
    return h('section', {},
      h('h3', {}, '6. Export'),
      h('div', { class: 'grid2' },
        h('label', {}, h('span', {}, 'Resolution'), h('select', { onchange: (e) => { r.dpi = Number(e.target.value); saveR(); } },
          [150, 200, 300].map((d) => h('option', { value: d, selected: r.dpi === d ? true : null }, d + ' dpi')))),
        h('label', {}, h('span', {}, 'Image format'), h('select', { onchange: (e) => { r.format = e.target.value; saveR(); } },
          h('option', { value: 'jpeg', selected: r.format === 'jpeg' ? true : null }, 'JPEG (smaller)'),
          h('option', { value: 'png', selected: r.format === 'png' ? true : null }, 'PNG (lossless)'))),
        h('label', {}, h('span', {}, 'Bates prefix'), h('input', { type: 'text', value: r.batesPrefix, placeholder: 'e.g. TOWN-', oninput: (e) => { r.batesPrefix = e.target.value; saveR(); } })),
        h('label', {}, h('span', {}, 'Bates start'), h('input', { type: 'number', min: 1, value: r.batesStart || 1, oninput: (e) => { r.batesStart = Math.max(1, Number(e.target.value) || 1); saveR(); } }))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.bates !== false, onchange: (e) => { r.bates = e.target.checked; saveR(); } }), ' Stamp Bates numbers'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.labels, onchange: (e) => { r.labels = e.target.checked; saveR(); } }), ' Print exemption on each box'),
      h('button', { class: 'primary block', disabled: !S.doc, onclick: doExport }, 'Export redacted PDF'),
      h('div', { id: 'verify-report' }, S.lastExport ? reportView(S.lastExport.report) : null),
      h('div', { class: 'row wrap' },
        h('button', { class: 'small', disabled: !S.lastExport, onclick: exportPublicLog }, 'Redaction log (PDF)'),
        h('button', { class: 'small', disabled: !S.lastExport, onclick: exportInternalLog }, 'Internal audit log (CSV)')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'small ghost', disabled: !S.doc, onclick: saveSession }, 'Save session'),
        h('button', { class: 'small ghost', disabled: !S.doc, onclick: loadSession }, 'Load session')),
      h('p', { class: 'help' }, 'Every page of the output is an image; text under the boxes no longer exists in the file. The output is not text-searchable.'));
  }

  function reportView(rep) {
    return h('div', { class: 'report ' + (rep.pass ? 'pass' : 'fail') },
      h('strong', {}, rep.pass ? 'Verification passed' : 'VERIFICATION FAILED - do not release'),
      h('ul', {}, rep.checks.map((c) => h('li', { class: c.ok ? 'ok' : 'bad' }, (c.ok ? 'PASS ' : 'FAIL ') + c.name + ' - ' + c.detail))));
  }

  function batesFor(i) {
    const r = store.state.settings.redaction;
    if (r.bates === false) return null;
    return engine.batesLabel(r.batesPrefix, (r.batesStart || 1) + i, r.batesDigits || 6);
  }

  function pageRef(i) {
    const b = batesFor(i);
    return b ? b + ' (p. ' + (i + 1) + ')' : 'p. ' + (i + 1);
  }

  async function doExport() {
    if (!S.doc || S.busy) return;
    const accepted = S.marks.filter((m) => m.status === 'accepted' && !S.withheld.has(m.page));
    const proposed = S.marks.filter((m) => m.status === 'proposed');
    if (proposed.length && !await confirmDialog(proposed.length + ' proposed mark(s) have not been reviewed. They will NOT be redacted. Export anyway?', 'Export anyway')) return;
    const missing = accepted.filter((m) => !m.citationId || !String(m.reason || '').trim()).length +
      [...S.withheld.values()].filter((w) => !w.citationId || !String(w.reason || '').trim()).length;
    if (missing && !await confirmDialog(missing + ' redaction(s) have no stated reason. A written denial must give reasons (RSA 91-A:4, IV). Export anyway?', 'Export anyway')) return;
    if (!accepted.length && !S.withheld.size && !await confirmDialog('No redactions are accepted. Export a clean flattened copy anyway?', 'Export')) return;

    const r = store.state.settings.redaction;
    setBusy('Rendering...');
    try {
      const withheld = new Map([...S.withheld].map(([p, w]) => [p, { cite: citeOf(w.citationId), reason: w.reason }]));
      const { bytes, stamps } = await engine.exportRedacted(S.doc,
        accepted.map((m) => ({ page: m.page, rects: m.rects, citation: citeOf(m.citationId) })),
        withheld,
        {
          dpi: r.dpi, format: r.format, labels: r.labels, color: r.color,
          bates: r.bates === false ? null : { prefix: r.batesPrefix, start: r.batesStart || 1, digits: r.batesDigits || 6 },
          title: 'Redacted - ' + S.doc.fileName.replace(/\.[^.]+$/, ''),
        },
        (i, n) => setBusy('Rendering page ' + i + ' of ' + n + '...'));
      setBusy('Verifying output...');
      const sensitive = S.marks.filter((m) => m.status === 'accepted' && m.text).map((m) => m.text);
      const report = await engine.verify(bytes, S.doc.numPages, sensitive, stamps);
      const outName = S.doc.fileName.replace(/\.[^.]+$/, '') + '_REDACTED_' + deadlines.todayISO() + '.pdf';
      S.lastExport = { bytes, report, outName, at: new Date().toISOString(), accepted, withheld: new Map(S.withheld) };
      renderSidebar();
      if (!report.pass) {
        toast('Verification failed. The file was not saved. See the report.', 'error');
        return;
      }
      download(bytes, outName, 'application/pdf');
      recordProduction(outName, report);
      toast('Exported and verified: ' + outName, 'ok');
    } catch (e) {
      console.error(e);
      toast('Export failed: ' + e.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  function logRows() {
    const rows = [];
    const e = S.lastExport;
    const items = [];
    for (const m of e.accepted) items.push({ page: m.page, scope: 'Partial redaction', citationId: m.citationId, reason: m.reason, mark: m });
    for (const [p, w] of e.withheld) items.push({ page: p, scope: 'Page withheld', citationId: w.citationId, reason: w.reason });
    items.sort((a, b) => a.page - b.page);
    items.forEach((it, k) => rows.push(Object.assign({ n: k + 1, pageRef: pageRef(it.page), cite: citeOf(it.citationId) }, it)));
    return rows;
  }

  function recordProduction(outName, report) {
    if (!S.requestId) return;
    const req = store.getRequest(S.requestId);
    if (!req) return;
    const groups = new Map();
    for (const r of logRows()) {
      const key = r.citationId + '|' + (r.reason || '');
      if (!groups.has(key)) groups.set(key, { citationId: r.citationId, reason: r.reason, pages: [] });
      const g = groups.get(key);
      const ref = batesFor(r.page) || String(r.page + 1);
      if (!g.pages.includes(ref)) g.pages.push(ref);
    }
    req.productions = req.productions || [];
    req.productions.push({
      date: deadlines.todayISO(), file: outName, sourceFile: S.doc.fileName, sourceSha256: S.doc.sha256, outputSha256: report.sha256,
      pages: S.doc.numPages, batesFirst: batesFor(0), batesLast: batesFor(S.doc.numPages - 1),
      entries: [...groups.values()].map((g) => ({ citationId: g.citationId, reason: g.reason, pages: g.pages.join(', ') })),
    });
    req.history = req.history || [];
    req.history.push({ at: new Date().toISOString(), event: 'Redacted production ' + outName });
    store.upsertRequest(req);
  }

  async function exportPublicLog() {
    const e = S.lastExport;
    const p = store.state.settings.profile;
    const meta = [
      ['Request', S.requestId || 'Not linked'],
      ['Source document', S.doc.fileName + ' (' + S.doc.numPages + ' pages)'],
      ['Produced file', e.outName],
      ['Bates range', batesFor(0) ? batesFor(0) + ' - ' + batesFor(S.doc.numPages - 1) : 'None'],
      ['Prepared by', [p.signerName, p.signerTitle, p.orgName].filter(Boolean).join(', ') || '-'],
      ['Date', deadlines.todayISO()],
    ];
    const rows = logRows().map((r) => ({ n: r.n, page: r.pageRef, scope: r.scope, cite: r.cite || '-', reason: r.reason || '-' }));
    const bytes = await engine.buildLogPdf(meta, rows);
    download(bytes, e.outName.replace(/\.pdf$/, '_LOG.pdf'), 'application/pdf');
  }

  function exportInternalLog() {
    const e = S.lastExport;
    const rows = [['#', 'Page', 'Bates', 'Scope', 'Source', 'Detector', 'Covered text (INTERNAL - do not release)', 'Exemption', 'Reason', 'Reviewed at', 'Source file', 'Source SHA-256', 'Output file', 'Output SHA-256', 'Verification']];
    for (const r of logRows()) {
      rows.push([r.n, r.page + 1, batesFor(r.page) || '', r.scope, r.mark ? r.mark.source : 'page', r.mark ? r.mark.label : '', r.mark ? r.mark.text : '',
        r.cite, r.reason, e.at, S.doc.fileName, S.doc.sha256, e.outName, e.report.sha256, e.report.pass ? 'PASS' : 'FAIL']);
    }
    download(csv(rows), e.outName.replace(/\.pdf$/, '_INTERNAL_AUDIT.csv'), 'text/csv');
  }

  function saveSession() {
    const data = {
      app: 'RSA91A-Engine', type: 'redaction-session', saved: new Date().toISOString(),
      sourceFile: S.doc.fileName, sourceSha256: S.doc.sha256, requestId: S.requestId,
      marks: S.marks, withheld: [...S.withheld], defaultCitation: S.defaultCitation, defaultReason: S.defaultReason,
    };
    download(JSON.stringify(data, null, 2), S.doc.fileName.replace(/\.[^.]+$/, '') + '_session.json', 'application/json');
  }

  async function loadSession() {
    const f = await pickFile('application/json,.json');
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'RSA91A-Engine' || data.type !== 'redaction-session') throw new Error('Not a redaction session file.');
      if (data.sourceSha256 !== S.doc.sha256 && !await confirmDialog('This session was saved for a different file (' + data.sourceFile + '). Marks may not line up. Load anyway?', 'Load anyway')) return;
      S.marks = data.marks || [];
      S.withheld = new Map(data.withheld || []);
      S.requestId = data.requestId || '';
      S.defaultCitation = data.defaultCitation || S.defaultCitation;
      S.defaultReason = data.defaultReason || '';
      S.nextId = S.marks.reduce((a, m) => Math.max(a, m.id), 0) + 1;
      renderSidebar();
      drawOverlay();
      toast('Session loaded: ' + S.marks.length + ' marks.', 'ok');
    } catch (e) {
      toast('Could not load session: ' + e.message, 'error');
    }
  }

  // ---------- view ----------

  function render(params) {
    const host = $('#view-studio');
    if (params && params.requestId) S.requestId = params.requestId;
    if (host.dataset.built) {
      renderSidebar();
      drawOverlay();
      return;
    }
    host.dataset.built = '1';
    host.appendChild(h('div', { class: 'studio' },
      h('aside', { id: 'studio-sidebar', class: 'sidebar' }),
      h('div', { class: 'viewer-col' },
        h('div', { class: 'toolbar viewer-tools' },
          h('button', { class: 'small', title: 'Previous page (PgUp)', onclick: () => goPage(S.page - 1) }, 'Prev'),
          h('span', { id: 'pager-label' }, 'No document'),
          h('button', { class: 'small', title: 'Next page (PgDn)', onclick: () => goPage(S.page + 1) }, 'Next'),
          h('span', { class: 'sep' }),
          h('button', { class: 'small', title: 'Zoom out', onclick: () => { S.zoom = Math.max(0.3, S.zoom / 1.2); renderPage(); } }, '-'),
          h('span', { id: 'zoom-label' }, '100%'),
          h('button', { class: 'small', title: 'Zoom in', onclick: () => { S.zoom = Math.min(4, S.zoom * 1.2); renderPage(); } }, '+'),
          h('button', { class: 'small', onclick: fitWidth }, 'Fit width'),
          h('span', { class: 'sep' }),
          h('button', { class: 'small', onclick: nextProposed }, 'Next to review'),
          h('div', { class: 'spacer' }),
          h('span', { class: 'help' }, 'Drag to draw a box. Double-click a box to toggle. Del removes the selected box.')),
        h('div', { id: 'viewer', class: 'viewer' },
          h('div', { id: 'studio-busy', class: 'busy', hidden: true }),
          h('div', { id: 'page-wrap', class: 'page-wrap' },
            h('canvas', { id: 'page-canvas' }),
            h('div', { id: 'page-overlay', class: 'overlay' }))))));
    attachDrawing();
    const viewer = $('#viewer');
    viewer.addEventListener('dragover', (e) => { e.preventDefault(); viewer.classList.add('drop'); });
    viewer.addEventListener('dragleave', () => viewer.classList.remove('drop'));
    viewer.addEventListener('drop', (e) => {
      e.preventDefault();
      viewer.classList.remove('drop');
      if (e.dataTransfer.files[0]) open(e.dataTransfer.files[0]);
    });
    document.addEventListener('keydown', (e) => {
      if ($('#view-studio').hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.key === 'PageDown') { e.preventDefault(); goPage(S.page + 1); }
      if (e.key === 'PageUp') { e.preventDefault(); goPage(S.page - 1); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && S.selected !== null) { e.preventDefault(); removeMark(S.selected); }
      if (e.key === 'a' && S.selected !== null) { const m = S.marks.find((x) => x.id === S.selected); if (m) { m.status = 'accepted'; drawOverlay(); renderMarkList(); } }
      if (e.key === 'r' && S.selected !== null) { const m = S.marks.find((x) => x.id === S.selected); if (m) { m.status = 'rejected'; drawOverlay(); renderMarkList(); } }
    });
    renderSidebar();
  }

  NS.studio = { render, open, state: S, scan, doExport };
})(typeof self !== 'undefined' ? self : this);
