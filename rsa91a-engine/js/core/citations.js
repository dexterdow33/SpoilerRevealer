/*
 * RSA91A-Engine: citation library.
 *
 * Every built-in entry names the primary source it was checked against and
 * the statute edition that source cites. The app tells the user to confirm
 * current text at gc.nh.gov before relying on any entry; statutes change.
 * Users may add their own entries; those are marked user-supplied.
 *
 * Sources for the built-in entries (New Hampshire Supreme Court):
 *  [UL24] Union Leader Corp. v. N.H. Dep't of Safety, 2024 N.H. 35 (July 3, 2024),
 *         quoting RSA 91-A:4, I (2023).
 *  [CQ]   Colquhoun v. City of Nashua, No. 2021-0253 (Oct. 26, 2022), quoting
 *         RSA 91-A:4, IV(a) (Supp. 2021).
 *  [BR]   Brandano v. Superintendent of SAU 16, No. 2022-0084 (order, Nov. 3, 2023),
 *         quoting RSA 91-A:4, IV(b) and RSA 91-A:8, I (2023).
 *  [ST]   Stone v. City of Claremont, 2024 N.H. 11 (Mar. 20, 2024), quoting
 *         RSA 91-A:4, VI (2023) and citing RSA 91-A:4, IV(a)-(c) (2023).
 *  [MI]   Michaud v. Town of Campton Police Dep't, 2024 N.H. 19 (Apr. 18, 2024),
 *         on RSA 91-A:5, IV and XII (2023).
 *  [K]    Keene Publ'g Corp. v. Fall Mountain Reg'l Sch. Dist., 2025 N.H. 35
 *         (Aug. 12, 2025), on RSA 91-A:4, I-a and RSA 91-A:5, IV, XII (2023).
 *  [T]    Taylor v. Sch. Admin. Unit #55, No. 2016-0702 (Sept. 21, 2017), quoting
 *         RSA 91-A:4, IV and V (Supp. 2016). Paragraph IV was restructured into
 *         lettered subparagraphs after this; entries resting on [T] alone are
 *         marked as such.
 */
(function (root) {
  'use strict';

  const SOURCES = {
    UL24: 'Union Leader Corp. v. N.H. Dep\'t of Safety, 2024 N.H. 35 (RSA 91-A:4, I (2023))',
    CQ: 'Colquhoun v. City of Nashua, No. 2021-0253 (N.H. Oct. 26, 2022) (RSA 91-A:4, IV(a) (Supp. 2021))',
    BR: 'Brandano v. Superintendent of SAU 16, No. 2022-0084 (N.H. Nov. 3, 2023) (RSA 91-A:4, IV(b); RSA 91-A:8, I (2023))',
    ST: 'Stone v. City of Claremont, 2024 N.H. 11 (RSA 91-A:4, VI (2023))',
    MI: 'Michaud v. Town of Campton Police Dep\'t, 2024 N.H. 19 (RSA 91-A:5, IV, XII (2023))',
    K: 'Keene Publ\'g Corp. v. Fall Mountain Reg\'l Sch. Dist., 2025 N.H. 35 (RSA 91-A:4, I-a; 91-A:5, IV, XII (2023))',
    T: 'Taylor v. Sch. Admin. Unit #55, No. 2016-0702 (N.H. Sept. 21, 2017) (RSA 91-A:4, IV, V (Supp. 2016))',
  };

  const CITATIONS = [
    {
      id: '91-A:4,I',
      cite: 'RSA 91-A:4, I',
      kind: 'access',
      title: 'Right to inspect and copy governmental records',
      summary: '"Every citizen during the regular or business hours of all public bodies or agencies, and on the regular business premises of such public bodies or agencies, has the right to inspect all governmental records in the possession, custody, or control of such public bodies or agencies, including minutes of meetings of the public bodies, and to copy and make memoranda or abstracts of the records or minutes so inspected, except as otherwise prohibited by statute or RSA 91-A:5." (2023 edition, as quoted by the court.)',
      source: 'UL24, MI',
    },
    {
      id: '91-A:4,I-a',
      cite: 'RSA 91-A:4, I-a',
      kind: 'access',
      title: 'Separation payments',
      summary: 'Records of any payment made to an employee upon resignation, discharge, or retirement, in addition to regular salary and accrued leave, shall immediately be made available without alteration for public inspection. The court held a narrative summary does not satisfy this; the original payment records are required (confidential information may be redacted).',
      source: 'K',
    },
    {
      id: '91-A:4,IV(a)',
      cite: 'RSA 91-A:4, IV(a)',
      kind: 'timing',
      title: 'Records immediately available',
      summary: '"Each public body or agency shall, upon request for any governmental record reasonably described, make available for inspection and copying any such governmental record within its files when such records are immediately available for such release." (Supp. 2021, as quoted by the court.)',
      source: 'CQ',
    },
    {
      id: '91-A:4,IV(b)',
      cite: 'RSA 91-A:4, IV(b)',
      kind: 'timing',
      title: 'Five-business-day response',
      summary: 'If the body or agency cannot make the record immediately available, it shall, within 5 business days of the request: "(1) make such record available; (2) deny the request; or (3) provide a written statement of the time reasonably necessary to determine whether the request shall be granted or denied and the reason for the delay." (2023 edition, as quoted by the court.) The court has said the response period is absolute, and that a body that gives itself a deadline must answer follow-up inquiries when it misses it.',
      source: 'BR',
    },
    {
      id: '91-A:4,IV',
      cite: 'RSA 91-A:4, IV',
      kind: 'fees',
      title: 'Copy costs (subparagraph not confirmed)',
      summary: 'As quoted in 2017 from the 2016 supplement: a requester "may be charged the actual cost of providing the copy," and "No fee shall be charged for the inspection or delivery, without copying, of governmental records, whether in paper, electronic, or other form." Paragraph IV has since been divided into subparagraphs (a) through at least (c); which subparagraph now carries these sentences has not been confirmed from a source opened by this software. Cite the paragraph, and check the current text before relying on it.',
      source: 'T, ST',
      unconfirmed: true,
    },
    {
      id: '91-A:4,V',
      cite: 'RSA 91-A:4, V',
      kind: 'format',
      title: 'Electronic records (2016 text)',
      summary: 'As quoted in 2017 from the 2016 supplement: a body or agency that keeps records electronically may copy them to electronic media using standard or common file formats in a manner that does not reveal information that is confidential under this chapter or other law. Not re-checked against a post-2021 edition; confirm current text.',
      source: 'T',
      unconfirmed: true,
    },
    {
      id: '91-A:4,VI',
      cite: 'RSA 91-A:4, VI',
      kind: 'access',
      title: 'Settlement agreements on file',
      summary: '"Every agreement to settle a lawsuit against a governmental unit, threatened lawsuit, or other claim, entered into by any political subdivision or its insurer, shall be kept on file at the municipal clerk\'s office and made available for public inspection for a period of no less than 10 years from the date of settlement." (2023 edition, as quoted by the court.)',
      source: 'ST',
    },
    {
      id: '91-A:5,IV',
      cite: 'RSA 91-A:5, IV',
      kind: 'exemption',
      title: 'Confidential, commercial, or financial information; personnel files; invasion of privacy',
      summary: 'Exempts, among other things, records pertaining to "confidential, commercial, or financial information" and personnel files whose disclosure would constitute an invasion of privacy. Courts apply a three-step balancing test: (1) is there a privacy interest; (2) what is the public interest in disclosure; (3) balance the public interest against the government\'s and the individual\'s interests in nondisclosure. Exemptions are construed restrictively; the withholding entity bears a heavy burden. Redaction of names and identifying details is preferred over withholding a whole record when it protects the privacy interest.',
      balancing: true,
      source: 'K, MI',
    },
    {
      id: '91-A:5,XII',
      cite: 'RSA 91-A:5, XII',
      kind: 'exemption',
      title: 'Attorney-client privilege and attorney work product',
      summary: 'Exempts "[r]ecords protected under the attorney-client privilege or the attorney work product doctrine" (added by Laws 2021, 163:2). No privacy balancing test applies; the established privilege doctrines govern.',
      balancing: false,
      source: 'K, MI',
    },
    {
      id: '91-A:8,I',
      cite: 'RSA 91-A:8, I',
      kind: 'remedy',
      title: 'Attorney\'s fees and costs',
      summary: '"If any public body or public agency or officer, employee, or other official thereof, violates any provisions of this chapter, such public body or public agency shall be liable for reasonable attorney\'s fees and costs incurred in a lawsuit under this chapter, provided that the court finds that such lawsuit was necessary in order to enforce compliance with the provisions of this chapter or to address a purposeful violation of this chapter. Fees shall not be awarded unless the court finds that the public body, public agency, or person knew or should have known that the conduct engaged in was in violation of this chapter or if the parties, by agreement, provide that no such fees shall be paid." (2023 edition, as quoted by the court.)',
      source: 'BR',
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
    VERIFY_NOTE: 'Confirm the current text of every cited provision at gc.nh.gov before sending. Built-in entries were checked against New Hampshire Supreme Court quotations of the 2023 edition where marked; two are marked not confirmed. This software drafts documents; it does not give legal advice.' };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.RSA91A = root.RSA91A || {}; root.RSA91A.citations = api; }
})(typeof self !== 'undefined' ? self : this);
