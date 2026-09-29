/*
 * RSA91A-Engine: citation library.
 *
 * Every built-in entry names the primary source it was checked against. The
 * app tells the user to confirm current statutory text at gc.nh.gov before
 * relying on any entry; statutes change. Users may add their own entries
 * (other statutes, local rules); those are marked user-supplied.
 *
 * Sources used for the built-in entries:
 *  [T] Taylor v. School Administrative Unit #55, No. 2016-0702 (N.H. Sept. 21, 2017),
 *      quoting RSA 91-A:4, I, IV and V (Supp. 2016).
 *  [K] Keene Publishing Corp. v. Fall Mountain Regional School District,
 *      2025 N.H. 35 (Aug. 12, 2025), discussing RSA 91-A:4, I and I-a and
 *      RSA 91-A:5, IV and XII (2023).
 */
(function (root) {
  'use strict';

  const SOURCES = {
    T: 'Taylor v. Sch. Admin. Unit #55, No. 2016-0702 (N.H. 2017) (quoting RSA 91-A:4 (Supp. 2016))',
    K: 'Keene Publ\'g Corp. v. Fall Mountain Reg\'l Sch. Dist., 2025 N.H. 35',
  };

  const CITATIONS = [
    {
      id: '91-A:4,I',
      cite: 'RSA 91-A:4, I',
      kind: 'access',
      title: 'Right to inspect and copy governmental records',
      summary: 'Right to inspect governmental records in the possession, custody, or control of public bodies or agencies, and to copy them, except as otherwise provided by statute or RSA 91-A:5.',
      source: 'T, K',
    },
    {
      id: '91-A:4,I-a',
      cite: 'RSA 91-A:4, I-a',
      kind: 'access',
      title: 'Separation payments',
      summary: 'Records of any payment made to an employee upon resignation, discharge, or retirement, in addition to regular salary and accrued leave, shall immediately be made available without alteration for public inspection. The Supreme Court held a narrative summary does not satisfy this; the original payment records are required (confidential information may be redacted).',
      source: 'K',
    },
    {
      id: '91-A:4,IV',
      cite: 'RSA 91-A:4, IV',
      kind: 'timing',
      title: 'Five-business-day response; copy costs',
      summary: 'If a record is not immediately available, within 5 business days of request the body or agency must make it available, deny the request in writing with reasons, or furnish written acknowledgment of receipt and a statement of the time reasonably necessary to decide. The requester may be charged the actual cost of providing a copy. No fee may be charged for inspection or delivery, without copying, of governmental records.',
      source: 'T',
    },
    {
      id: '91-A:4,V',
      cite: 'RSA 91-A:4, V',
      kind: 'format',
      title: 'Electronic records',
      summary: 'A body or agency that keeps records electronically may copy them to electronic media using standard or common file formats in a manner that does not reveal information that is confidential under this chapter or other law.',
      source: 'T',
    },
    {
      id: '91-A:5,IV',
      cite: 'RSA 91-A:5, IV',
      kind: 'exemption',
      title: 'Confidential, commercial, or financial information; personnel files; invasion of privacy',
      summary: 'Exempts, among other things, confidential, commercial, or financial information and personnel files whose disclosure would constitute an invasion of privacy. Courts apply a three-step balancing test: (1) is there a privacy interest; (2) what is the public interest in disclosure; (3) balance the public interest against the government\'s and the individual\'s interests in nondisclosure. Exemptions are construed restrictively; the withholding entity bears a heavy burden.',
      balancing: true,
      source: 'K',
    },
    {
      id: '91-A:5,XII',
      cite: 'RSA 91-A:5, XII',
      kind: 'exemption',
      title: 'Attorney-client privilege and attorney work product',
      summary: 'Exempts records protected under the attorney-client privilege or the attorney work product doctrine (added by Laws 2021, 163:2). No privacy balancing test applies; the established privilege doctrines govern.',
      balancing: false,
      source: 'K',
    },
  ];

  /** Merge built-ins with user-supplied entries. User entries never overwrite built-ins. */
  function all(userEntries) {
    const ids = new Set(CITATIONS.map((c) => c.id));
    const extra = (userEntries || [])
      .filter((c) => c && c.id && c.cite && !ids.has(c.id))
      .map((c) => Object.assign({ kind: 'exemption', source: 'user', userSupplied: true }, c));
    return CITATIONS.concat(extra);
  }

  function exemptions(userEntries) {
    return all(userEntries).filter((c) => c.kind === 'exemption');
  }

  function byId(id, userEntries) {
    return all(userEntries).find((c) => c.id === id) || null;
  }

  const api = { SOURCES, CITATIONS, all, exemptions, byId,
    VERIFY_NOTE: 'Confirm the current text of every cited provision at gc.nh.gov before sending. This software drafts documents; it does not give legal advice.' };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.RSA91A = root.RSA91A || {}; root.RSA91A.citations = api; }
})(typeof self !== 'undefined' ? self : this);
