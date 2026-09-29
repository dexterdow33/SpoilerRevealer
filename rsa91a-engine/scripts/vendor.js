// Copies the third-party browser builds into js/vendor so the app runs offline
// with no install step. Run after `npm install`.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'js', 'vendor');
fs.mkdirSync(out, { recursive: true });

const files = [
  ['node_modules/pdfjs-dist/build/pdf.min.js', 'pdf.min.js'],
  ['node_modules/pdfjs-dist/build/pdf.worker.min.js', 'pdf.worker.min.js'],
  ['node_modules/pdfjs-dist/LICENSE', 'LICENSE-pdfjs.txt'],
  ['node_modules/pdf-lib/dist/pdf-lib.min.js', 'pdf-lib.min.js'],
  ['node_modules/pdf-lib/LICENSE.md', 'LICENSE-pdf-lib.txt'],
];

for (const [src, dest] of files) {
  fs.copyFileSync(path.join(root, src), path.join(out, dest));
  console.log('vendored', dest);
}
