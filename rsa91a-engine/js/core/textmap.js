/*
 * RSA91A-Engine: maps a page's extracted text to page geometry.
 *
 * pdf.js returns text as positioned runs ("items"). We join the runs into one
 * searchable string, remember which characters came from which run, and turn a
 * matched character range back into rectangles in PDF user space.
 *
 * Boxes are padded on every side. Over-covering by a fraction of a character
 * is harmless; under-covering leaks. Reviewers see every box before export.
 */
(function (root) {
  'use strict';

  /**
   * items: pdf.js TextItem[] ({ str, transform, width, height, hasEOL, fontName })
   * Returns { text, segments } where segments[i] = { item, start, end }.
   */
  function buildPageText(items) {
    let text = '';
    const segments = [];
    let prev = null;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (typeof it.str !== 'string') continue;
      if (prev && it.str.length) {
        text += separator(prev, it);
      }
      if (it.str.length) {
        segments.push({ item: i, start: text.length, end: text.length + it.str.length });
        text += it.str;
        prev = it;
      }
      if (it.hasEOL) {
        if (!text.endsWith('\n')) text += '\n';
        prev = null;
      }
    }
    return { text, segments };
  }

  function fontSize(it) {
    const t = it.transform;
    return Math.hypot(t[2], t[3]) || it.height || 10;
  }

  function separator(prev, next) {
    const pt = prev.transform;
    const nt = next.transform;
    const size = Math.max(fontSize(prev), fontSize(next));
    // Different baseline -> new line.
    if (Math.abs(pt[5] - nt[5]) > size * 0.5 && Math.abs(pt[4] - nt[4]) > size * 0.5) return '\n';
    if (prev.str.endsWith(' ') || next.str.startsWith(' ')) return '';
    // Horizontal gap between runs on the same line.
    const dirLen = Math.hypot(pt[0], pt[1]) || 1;
    const ux = pt[0] / dirLen;
    const uy = pt[1] / dirLen;
    const endX = pt[4] + ux * prev.width;
    const endY = pt[5] + uy * prev.width;
    const gap = (nt[4] - endX) * ux + (nt[5] - endY) * uy;
    return gap > size * 0.15 ? ' ' : '';
  }

  /**
   * Rectangles (PDF user space, [x0, y0, x1, y1]) covering text[start, end).
   * measure(str, item) returns a relative width for a substring; used to place
   * partial-run boundaries. Falls back to character count when absent.
   */
  function rangeToRects(items, segments, start, end, measure, padRatio) {
    const pad = padRatio === undefined ? 0.18 : padRatio;
    const rects = [];
    for (const seg of segments) {
      if (seg.end <= start || seg.start >= end) continue;
      const it = items[seg.item];
      const s = Math.max(start, seg.start) - seg.start;
      const e = Math.min(end, seg.end) - seg.start;
      rects.push(subRunRect(it, s, e, measure, pad));
    }
    return mergeLineRects(rects);
  }

  function fraction(it, k, measure) {
    const n = it.str.length;
    if (k <= 0) return 0;
    if (k >= n) return 1;
    if (measure) {
      const full = measure(it.str, it);
      if (full > 0) return measure(it.str.slice(0, k), it) / full;
    }
    return k / n;
  }

  function subRunRect(it, s, e, measure, pad) {
    const t = it.transform;
    const size = fontSize(it);
    const dirLen = Math.hypot(t[0], t[1]) || 1;
    const ux = t[0] / dirLen;
    const uy = t[1] / dirLen;
    // Up vector perpendicular to the baseline.
    const vx = -uy;
    const vy = ux;
    const width = it.width || size * it.str.length * 0.5;
    const f0 = fraction(it, s, measure);
    const f1 = fraction(it, e, measure);
    const p = size * pad;
    const a0 = f0 * width - p;
    const a1 = f1 * width + p;
    const d0 = -size * 0.25 - p; // below baseline (descenders)
    const d1 = size * 0.95 + p; // above baseline (ascenders)
    const corners = [
      [a0, d0], [a1, d0], [a0, d1], [a1, d1],
    ].map(([a, d]) => [t[4] + ux * a + vx * d, t[5] + uy * a + vy * d]);
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }

  /** Joins rects that sit on the same line and touch, so one match = one box per line. */
  function mergeLineRects(rects) {
    const out = [];
    for (const r of rects) {
      const last = out[out.length - 1];
      if (last) {
        const sameLine = Math.abs(last[1] - r[1]) < (last[3] - last[1]) * 0.3 &&
          Math.abs(last[3] - r[3]) < (last[3] - last[1]) * 0.3;
        const touching = r[0] <= last[2] + (last[3] - last[1]) * 0.6 && r[2] >= last[0];
        if (sameLine && touching) {
          last[0] = Math.min(last[0], r[0]);
          last[1] = Math.min(last[1], r[1]);
          last[2] = Math.max(last[2], r[2]);
          last[3] = Math.max(last[3], r[3]);
          continue;
        }
      }
      out.push(r.slice());
    }
    return out;
  }

  const api = { buildPageText, rangeToRects, mergeLineRects };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.RSA91A = root.RSA91A || {}; root.RSA91A.textmap = api; }
})(typeof self !== 'undefined' ? self : this);
