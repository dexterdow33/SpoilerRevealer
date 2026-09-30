const test = require('node:test');
const assert = require('node:assert');
const d = require('../../js/core/deadlines.js');

test('5 business days from a Monday lands on the next Monday', () => {
  assert.strictEqual(d.addBusinessDays('2026-09-28', 5, []), '2026-10-05');
});

test('receipt on Friday skips the weekend', () => {
  assert.strictEqual(d.addBusinessDays('2026-10-02', 5, []), '2026-10-09');
});

test('receipt on Saturday counts from Monday', () => {
  assert.strictEqual(d.addBusinessDays('2026-10-03', 5, []), '2026-10-09');
});

test('holidays are skipped', () => {
  // Columbus Day 2026 is Monday, Oct 12.
  assert.strictEqual(d.addBusinessDays('2026-10-09', 5, ['2026-10-12']), '2026-10-19');
});

test('countReceiptDay option counts the receipt day as day 1', () => {
  assert.strictEqual(d.addBusinessDays('2026-09-28', 5, [], { countReceiptDay: true }), '2026-10-02');
});

test('rejects impossible dates', () => {
  assert.throws(() => d.parseISO('2026-02-30'));
  assert.throws(() => d.parseISO('09/28/2026'));
});

test('businessDaysBetween is signed', () => {
  assert.strictEqual(d.businessDaysBetween('2026-09-28', '2026-10-05', []), 5);
  assert.strictEqual(d.businessDaysBetween('2026-10-05', '2026-09-28', []), -5);
  assert.strictEqual(d.businessDaysBetween('2026-10-05', '2026-10-05', []), 0);
});

test('federal holidays for 2026 fall on the expected dates', () => {
  const h = Object.fromEntries(d.federalHolidays(2026).map((x) => [x.name, x.date]));
  assert.strictEqual(h['Independence Day'], '2026-07-03'); // July 4, 2026 is a Saturday
  assert.strictEqual(h['Thanksgiving Day'], '2026-11-26');
  assert.strictEqual(h['Memorial Day'], '2026-05-25');
  assert.strictEqual(h['Birthday of Martin Luther King, Jr.'], '2026-01-19');
  assert.strictEqual(h['Labor Day'], '2026-09-07');
});

test('responseStatus flags overdue and late answers', () => {
  const req = { receivedDate: '2026-09-28' };
  assert.strictEqual(d.responseStatus(req, '2026-10-06', {}).state, 'overdue');
  assert.strictEqual(d.responseStatus(req, '2026-10-05', {}).state, 'due-today');
  const open = d.responseStatus(req, '2026-09-30', {});
  assert.strictEqual(open.state, 'open');
  assert.strictEqual(open.businessDaysLeft, 3);
  assert.strictEqual(d.responseStatus({ ...req, firstResponseDate: '2026-10-07' }, '2026-10-08', {}).state, 'answered-late');
  assert.strictEqual(d.responseStatus({ ...req, firstResponseDate: '2026-10-05' }, '2026-10-08', {}).state, 'answered');
});
