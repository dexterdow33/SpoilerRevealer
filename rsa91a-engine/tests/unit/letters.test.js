const test = require('node:test');
const assert = require('node:assert');
const L = require('../../js/core/letters.js');
const C = require('../../js/core/citations.js');

const settings = { holidays: [], profile: { signerName: 'Pat Example', orgName: 'Example Org', phone: '555-0100' } };
const req = { id: 'RTK-2026-0001', agency: 'Town of Example', receivedDate: '2026-09-28', description: 'All invoices from Vendor X, 2025.', requesterName: 'Pat Example' };

test('request letter states the 5-business-day date and cites only library provisions', () => {
  const t = L.request(req, settings);
  assert.match(t, /October 5, 2026/);
  assert.match(t, /RSA 91-A:4, IV/);
  const cited = new Set((t.match(/RSA 91-A:\d+, [IVXL]+(?:-a)?/g) || []));
  const known = new Set(C.CITATIONS.map((c) => c.cite));
  for (const c of cited) assert.ok(known.has(c), 'unknown citation in template: ' + c);
});

test('no template invents a media-requester category', () => {
  for (const tpl of L.TEMPLATES) {
    const t = tpl.fn(req, settings, { entries: [{ citationId: '91-A:5,IV', reason: 'r' }] });
    assert.doesNotMatch(t, /media requ/i);
  }
});

test('denial lists each exemption with its reason', () => {
  const t = L.denial(req, settings, { entries: [
    { citationId: '91-A:5,XII', description: 'Memo from town counsel, 3/2/2025', reason: 'Legal advice to the select board.' },
    { citationId: '91-A:5,IV', pages: '4-5', reason: 'Employee home address.' },
  ] });
  assert.match(t, /RSA 91-A:5, XII \(Attorney-client/);
  assert.match(t, /Memo from town counsel, 3\/2\/2025: Legal advice/);
  assert.match(t, /Page\(s\) 4-5: Employee home address/);
});

test('user citations cannot overwrite built-ins', () => {
  const all = C.all([{ id: '91-A:5,IV', cite: 'FAKE' }, { id: 'local-1', cite: 'Local Rule 1' }]);
  assert.strictEqual(all.find((c) => c.id === '91-A:5,IV').cite, 'RSA 91-A:5, IV');
  assert.ok(all.find((c) => c.id === 'local-1').userSupplied);
});
