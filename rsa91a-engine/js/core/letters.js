/*
 * RSA91A-Engine: letter templates.
 *
 * Plain-text drafts the user edits before sending. Templates cite only the
 * provisions in the citation library. Every draft is a starting point, not
 * legal advice; the app says so beside every letter.
 */
(function (root) {
  'use strict';

  const deadlines = (typeof module !== 'undefined' && module.exports)
    ? require('./deadlines.js')
    : root.RSA91A.deadlines;
  const citations = (typeof module !== 'undefined' && module.exports)
    ? require('./citations.js')
    : root.RSA91A.citations;

  function longDate(iso) {
    if (!iso) return '[DATE]';
    const dt = deadlines.parseISO(iso);
    return dt.toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function lines(...parts) {
    return parts.filter((p) => p !== null && p !== undefined && p !== false).join('\n');
  }

  function signature(profile) {
    const p = profile || {};
    return lines(
      p.signerName || '[NAME]',
      p.signerTitle || null,
      p.orgName || null,
      ...(p.address ? p.address.split('\n') : []),
      p.phone || null,
      p.email || null,
    );
  }

  function header(profile, dateISO, toName, toAddress) {
    return lines(
      longDate(dateISO),
      '',
      toName || '[RECIPIENT]',
      ...(toAddress ? toAddress.split('\n') : []),
    );
  }

  const FORMAT_TEXT = {
    electronic: 'Electronic copies, in the standard or common file format in which the records are kept (see RSA 91-A:4, V).',
    paper: 'Paper copies.',
    inspect: 'Inspection in person during regular business hours (RSA 91-A:4, I).',
  };

  function dueFor(req, settings) {
    return deadlines.addBusinessDays(req.receivedDate, 5, settings.holidays, {
      countReceiptDay: !!settings.countReceiptDay,
    });
  }

  /** Requester -> agency: the initial records request. */
  function request(req, settings) {
    const s = settings || {};
    const sent = req.receivedDate || deadlines.todayISO();
    const due = dueFor(Object.assign({}, req, { receivedDate: sent }), s);
    return lines(
      header(s.profile, sent, req.agency, req.agencyAddress),
      '',
      'Re: Right-to-Know request under RSA chapter 91-A',
      '',
      'To the records custodian:',
      '',
      'Under RSA 91-A:4, I, I request the following governmental records:',
      '',
      req.description || '[DESCRIBE THE RECORDS: subject, date range, people or offices involved, record types]',
      '',
      'Format requested: ' + (FORMAT_TEXT[req.format] || FORMAT_TEXT.electronic),
      '',
      'RSA 91-A:4, IV requires that, if these records are not immediately available, within 5 business days of this request you make them available, deny the request in writing with reasons, or acknowledge receipt in writing with a statement of the time reasonably necessary to decide. By my count, that date is ' + longDate(due) + '.',
      '',
      'If any record or part of a record is withheld, please identify the specific exemption relied on for each withholding and explain why it applies, and release all reasonably segregable, non-exempt portions.',
      '',
      'If there will be a charge for copies, please tell me the amount before copies are made. RSA 91-A:4, IV permits only the actual cost of providing a copy, and no fee for inspection or for delivery without copying.',
      '',
      'Thank you.',
      '',
      'Sincerely,',
      '',
      signature(s.profile),
    );
  }

  /** Requester -> agency: the response window has passed with no answer. */
  function followUp(req, settings, opts) {
    const s = settings || {};
    const today = (opts && opts.date) || deadlines.todayISO();
    const due = dueFor(req, s);
    return lines(
      header(s.profile, today, req.agency, req.agencyAddress),
      '',
      'Re: Follow-up on Right-to-Know request' + (req.id ? ' (' + req.id + ')' : '') + ' dated ' + longDate(req.receivedDate),
      '',
      'To the records custodian:',
      '',
      'On ' + longDate(req.receivedDate) + ', I requested the following governmental records under RSA chapter 91-A:',
      '',
      req.description || '[DESCRIPTION]',
      '',
      'Under RSA 91-A:4, IV, a response was due within 5 business days, which by my count was ' + longDate(due) + '. As of today I have not received the records, a written denial with reasons, or a written acknowledgment with a statement of the time reasonably necessary to decide.',
      '',
      'Please respond at your earliest opportunity. If the records are ready in part, I ask that you release what is available now and tell me when to expect the rest.',
      '',
      'Sincerely,',
      '',
      signature(s.profile),
    );
  }

  /** Agency -> requester: written acknowledgment with time estimate. */
  function acknowledgment(req, settings, opts) {
    const s = settings || {};
    const o = opts || {};
    return lines(
      header(s.profile, o.date || deadlines.todayISO(), req.requesterName, req.requesterAddress),
      '',
      'Re: Your Right-to-Know request' + (req.id ? ' (' + req.id + ')' : '') + ' received ' + longDate(req.receivedDate),
      '',
      'Dear ' + (req.requesterName || 'Requester') + ':',
      '',
      'This letter acknowledges receipt of your request under RSA chapter 91-A for the following records:',
      '',
      req.description || '[DESCRIPTION]',
      '',
      'The requested records are not immediately available. Under RSA 91-A:4, IV, we estimate that the time reasonably necessary to determine whether the request will be granted or denied is through ' + longDate(o.estimateDate) + '.',
      '',
      'Reason additional time is needed: ' + (o.reason || '[STATE THE SPECIFIC REASON: e.g., volume of records, retrieval from off-site storage, review for exempt information]'),
      '',
      'We will release records on a rolling basis as they become available where practicable. If there will be a charge for copies, we will tell you the amount before copies are made.',
      '',
      'Sincerely,',
      '',
      signature(s.profile),
    );
  }

  function exemptionLines(entries, userCitations) {
    // entries: [{ citationId, reason, description, pages }]
    const groups = new Map();
    for (const e of entries || []) {
      const key = e.citationId || 'unspecified';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    const out = [];
    for (const [id, items] of groups) {
      const c = citations.byId(id, userCitations);
      out.push((c ? c.cite + ' (' + c.title + ')' : '[CITE THE EXEMPTION]') + ':');
      for (const it of items) {
        const where = it.description || (it.pages ? 'Page(s) ' + it.pages : 'Record');
        out.push('  - ' + where + ': ' + (it.reason || '[STATE THE SPECIFIC REASON THIS EXEMPTION APPLIES]'));
      }
    }
    return out.join('\n');
  }

  /** Agency -> requester: production cover letter, full or with redactions. */
  function production(req, settings, opts) {
    const s = settings || {};
    const o = opts || {};
    const redacted = (o.entries || []).length > 0;
    return lines(
      header(s.profile, o.date || deadlines.todayISO(), req.requesterName, req.requesterAddress),
      '',
      'Re: Response to your Right-to-Know request' + (req.id ? ' (' + req.id + ')' : '') + ' received ' + longDate(req.receivedDate),
      '',
      'Dear ' + (req.requesterName || 'Requester') + ':',
      '',
      'In response to your request under RSA chapter 91-A, we are providing the following records:',
      '',
      o.producedDescription || '[DESCRIBE WHAT IS ENCLOSED: file names, page counts, Bates range]',
      '',
      redacted
        ? 'Portions of these records have been redacted. Each redaction, the exemption relied on, and the reason it applies are listed below. A redaction log is enclosed.\n\n' + exemptionLines(o.entries, s.userCitations)
        : 'No information has been withheld from these records.',
      '',
      o.fee ? 'Copy cost: ' + o.fee + ' (actual cost of providing copies; RSA 91-A:4, IV).' : 'There is no charge for these records.',
      '',
      'Sincerely,',
      '',
      signature(s.profile),
    );
  }

  /** Agency -> requester: denial in writing with reasons. */
  function denial(req, settings, opts) {
    const s = settings || {};
    const o = opts || {};
    return lines(
      header(s.profile, o.date || deadlines.todayISO(), req.requesterName, req.requesterAddress),
      '',
      'Re: Response to your Right-to-Know request' + (req.id ? ' (' + req.id + ')' : '') + ' received ' + longDate(req.receivedDate),
      '',
      'Dear ' + (req.requesterName || 'Requester') + ':',
      '',
      'We have reviewed your request under RSA chapter 91-A for the following records:',
      '',
      req.description || '[DESCRIPTION]',
      '',
      'Under RSA 91-A:4, IV, we deny the request' + (o.partial ? ' in part' : '') + ' for the reasons stated below:',
      '',
      exemptionLines(o.entries, s.userCitations),
      '',
      o.partial ? 'Records or portions not listed above are being released with this letter.' : null,
      o.partial ? '' : null,
      'Sincerely,',
      '',
      signature(s.profile),
    );
  }

  const TEMPLATES = [
    { id: 'request', side: 'requester', label: 'Records request (requester)', fn: request },
    { id: 'followUp', side: 'requester', label: 'Overdue follow-up (requester)', fn: followUp },
    { id: 'acknowledgment', side: 'agency', label: 'Acknowledgment with time estimate (agency)', fn: acknowledgment },
    { id: 'production', side: 'agency', label: 'Production cover letter (agency)', fn: production },
    { id: 'denial', side: 'agency', label: 'Denial with reasons (agency)', fn: denial },
  ];

  const api = { TEMPLATES, request, followUp, acknowledgment, production, denial, longDate, exemptionLines };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.RSA91A = root.RSA91A || {}; root.RSA91A.letters = api; }
})(typeof self !== 'undefined' ? self : this);
