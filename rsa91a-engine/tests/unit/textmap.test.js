const test = require('node:test');
const assert = require('node:assert');
const tm = require('../../js/core/textmap.js');

const item = (str, x, y, width, size = 10, hasEOL = false) => ({ str, transform: [size, 0, 0, size, x, y], width, height: size, hasEOL });

test('joins runs, inserting spaces only for real gaps', () => {
  const items = [item('SSN: 123-45-', 72, 700, 60), item('6789', 132, 700, 20), item('Next', 200, 700, 20, 10, true), item('line two', 72, 680, 40)];
  const { text } = tm.buildPageText(items);
  assert.strictEqual(text, 'SSN: 123-45-6789 Next\nline two');
});

test('a match split across runs becomes one padded box covering both', () => {
  const items = [item('SSN: 123-45-', 72, 700, 60), item('6789', 132, 700, 20)];
  const { text, segments } = tm.buildPageText(items);
  const start = text.indexOf('123');
  const rects = tm.rangeToRects(items, segments, start, start + 11);
  assert.strictEqual(rects.length, 1);
  const [x0, y0, x1, y1] = rects[0];
  assert.ok(x0 < 72 + 60 * (5 / 12), 'starts at or before the first digit');
  assert.ok(x1 >= 152, 'ends at or after the last digit');
  assert.ok(y0 < 700 && y1 > 709, 'covers the glyph height');
});

test('rotated text yields a box around the rotated run', () => {
  const it = { str: 'SECRET', transform: [0, 10, -10, 0, 300, 300], width: 40, height: 10, hasEOL: false };
  const { segments } = tm.buildPageText([it]);
  const [r] = tm.rangeToRects([it], segments, 0, 6);
  assert.ok(r[1] < 300 && r[3] > 340, 'runs up the page');
  assert.ok(r[0] < 290 && r[2] > 300, 'covers glyph height leftward');
});
