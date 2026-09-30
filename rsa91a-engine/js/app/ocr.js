/*
 * RSA91A-Engine: offline OCR for scanned pages.
 *
 * Runs Tesseract (WebAssembly) on the main thread. The app opens from file://
 * with no server, which blocks web workers and fetch, so the core and the
 * English model are vendored as plain scripts and loaded on first use. The
 * engine itself is the same one tesseract.js drives; this file replaces its
 * worker plumbing with direct calls.
 *
 * Output is a list of words with pixel boxes in the image that was recognized.
 * OCR is imperfect; every word carries a confidence and the studio marks
 * OCR-derived text so reviewers know to look harder.
 */
(function (root) {
  'use strict';
  const NS = root.RSA91A = root.RSA91A || {};

  const VENDOR = 'js/vendor/';
  let modulePromise = null;
  let api = null;
  let TessModule = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function pickCore() {
    try {
      if (!root.wasmFeatureDetect) await loadScript(VENDOR + 'wasm-feature-detect.js');
      if (await root.wasmFeatureDetect.simd()) return 'tesseract-core-simd-lstm.wasm.js';
    } catch (e) { /* fall through */ }
    return 'tesseract-core-lstm.wasm.js';
  }

  /** Loads the engine and model once. Resolves when recognize() can be called. */
  function ready(onStatus) {
    if (modulePromise) return modulePromise;
    const status = onStatus || (() => {});
    modulePromise = (async () => {
      status('Loading OCR engine (first use only)...');
      const core = await pickCore();
      await loadScript(VENDOR + core);
      if (typeof root.TesseractCore !== 'function') throw new Error('OCR core did not load.');
      if (!root.Zlib || !root.Zlib.Gunzip) await loadScript(VENDOR + 'gunzip.min.js');
      if (!root.RSA91A_TESSDATA || !root.RSA91A_TESSDATA.eng) await loadScript(VENDOR + 'eng.traineddata.js');

      status('Starting OCR engine...');
      TessModule = await root.TesseractCore({});

      status('Loading English model...');
      const gz = base64ToBytes(root.RSA91A_TESSDATA.eng);
      const data = new root.Zlib.Gunzip(gz).decompress();
      TessModule.FS.writeFile('/eng.traineddata', data);

      api = new TessModule.TessBaseAPI();
      const rc = api.Init(null, 'eng', 1 /* OEM LSTM_ONLY */);
      if (rc === -1) throw new Error('OCR engine failed to initialize.');
      api.SetVariable('tessedit_pageseg_mode', '3'); // fully automatic page segmentation
      api.SetVariable('preserve_interword_spaces', '1');
      status('');
      return true;
    })();
    modulePromise.catch(() => { modulePromise = null; });
    return modulePromise;
  }

  function canvasToPng(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('Could not encode page for OCR.'));
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, 'image/png');
    });
  }

  /**
   * Recognizes the text in a canvas.
   * Returns { words: [{ text, conf, x0, y0, x1, y1, line }], meanConf } with
   * pixel coordinates in the canvas. `line` is a running line id for grouping.
   */
  async function recognize(canvas, dpi, onStatus) {
    await ready(onStatus);
    const png = await canvasToPng(canvas);
    // Tesseract guesses the resolution badly from a rendered page; tell it.
    api.SetVariable('user_defined_dpi', String(Math.round(dpi || 300)));
    TessModule.FS.writeFile('/input', png);
    const rc = api.SetImageFile(1, 0);
    if (rc === 1) throw new Error('OCR could not read the page image.');
    api.Recognize(null);
    const tsv = api.GetTSVText();
    const meanConf = api.MeanTextConf();
    try { TessModule.FS.unlink('/input'); } catch (e) { /* ignore */ }

    const words = [];
    for (const row of tsv.split('\n')) {
      const c = row.split('\t');
      if (c.length < 12 || c[0] !== '5') continue; // level 5 = word
      const text = c.slice(11).join('\t').trim();
      if (!text) continue;
      const left = Number(c[6]); const top = Number(c[7]); const w = Number(c[8]); const h = Number(c[9]);
      words.push({
        text, conf: Number(c[10]),
        x0: left, y0: top, x1: left + w, y1: top + h,
        line: c[2] + '.' + c[3] + '.' + c[4],
      });
    }
    return { words, meanConf };
  }

  NS.ocr = { ready, recognize, get loaded() { return !!api; } };
})(typeof self !== 'undefined' ? self : this);
