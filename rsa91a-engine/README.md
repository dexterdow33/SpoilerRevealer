# RSA91A-Engine

Software for New Hampshire Right-to-Know requests under RSA chapter 91-A. It tracks requests, drafts letters and redacts PDFs securely. It runs entirely offline in a web browser: no install, no server, no account, and no data leaves the computer.

Sold by Ninth State Software (NinthStateSoftware.com).

## What it does

**Request tracker**
- Logs every request, whether you are sending it or answering it.
- Counts the 5-business-day response window under RSA 91-A:4, IV. Weekends and a holiday list you edit are skipped.
- Dashboard of open requests, requests due within 2 business days, and requests past the window with no response.
- CSV export, plus a JSON backup and restore.

**Redaction Studio (secure redaction engine)**
- Opens PDF, PNG and JPEG files.
- Automatic detection of:
  - SSNs and ITINs
  - payment cards (Luhn-checked)
  - bank routing numbers (ABA-checked)
  - account numbers
  - phone numbers and email addresses
  - dates of birth
  - street addresses, IP addresses and any numeric date (these three are opt-in)
- Custom name and term lists, and custom regular-expression patterns.
- Every detection is a proposal. A reviewer accepts or rejects each one and can draw boxes by hand.
- Each redaction carries an exemption citation and a stated reason.
- You can withhold an entire page; it is replaced with a slip sheet that shows the exemption.
- Bates numbering, and optional exemption labels printed on each box.
- **True removal.** Every page is rendered to an image, the boxes are burned into the image, and a new PDF is built from the images alone. None of the following survives from the original: text, fonts, hidden or white text, form fields, comments, attachments, scripts, bookmarks, layers or metadata.
- **Self-verification.** After export, the engine re-opens its own output and checks:
  - page count
  - text layer (only Bates stamps allowed)
  - every redacted string
  - annotations, attachments, scripts and bookmarks
  - metadata

  A file that fails any check is not saved.
- Warns when a page has no text layer (a likely scan) so the reviewer checks it by eye.
- **Public redaction log (PDF).** A Vaughn-style index listing each redaction's page or Bates number, scope, exemption and reason. It never reproduces the withheld content.
- **Internal audit log (CSV).** Includes the covered text, the detector used, and SHA-256 hashes of the source and output files for chain of custody.
- Save and reload a review session.

**Letters**
- Requester side: the initial request, and a follow-up when the window has passed.
- Agency side: acknowledgment with a time estimate, a production cover letter, and a denial with reasons.
- Production and denial letters pull exemptions and reasons from the last redacted production.
- Output as editable text, .txt or PDF.
- "Log as sent" marks the request as answered on the tracker.

**Citation library**
- The built-in entries are limited to provisions checked against New Hampshire Supreme Court opinions (see below).
- Users can add their own citations. These are marked "user-added" everywhere they appear.

## Running it

Unzip and open `index.html` in Chrome, Edge or Firefox. That's it.

## Legal content and its sources

The built-in citations cover RSA 91-A:4, I, I-a, IV and V, and RSA 91-A:5, IV and XII. Each was checked against the statutory text quoted or discussed in these opinions:

- *Taylor v. School Administrative Unit #55*, No. 2016-0702 (N.H. Sept. 21, 2017), which quotes RSA 91-A:4, I, IV and V (Supp. 2016).
- *Keene Publishing Corp. v. Fall Mountain Regional School District*, 2025 N.H. 35 (Aug. 12, 2025), on RSA 91-A:4, I and I-a, RSA 91-A:5, IV (the three-step privacy balancing test) and RSA 91-A:5, XII (attorney-client privilege and work product, added by Laws 2021, 163:2).

Statutes change. The app tells users to confirm current text at gc.nh.gov before relying on any citation. **RSA91A-Engine is a drafting and redaction tool, not legal advice.**

The statute says "within 5 business days of request" and does not define how to count. By default the day after receipt is business day 1; users can change this in Settings. The built-in holiday helper adds U.S. federal holidays only. New Hampshire state and municipal calendars differ, and the app says so.

## Development

```
npm install          # dev dependencies only (pdf.js, pdf-lib, Playwright for tests)
npm run vendor       # copy browser builds into js/vendor (already committed)
npm test             # unit tests: deadlines, detectors, text geometry, letters
npm run test:e2e     # headless Chromium: scan, redact, export, independent leak check
npm run build        # dist/RSA91A-Engine-<version>.zip for sale/download
```

Layout:

```
index.html            app shell
css/app.css           styles (light and dark)
js/core/              pure logic, also loaded by Node tests
  deadlines.js        business-day math, federal holiday helper
  detectors.js        sensitive-data detectors
  citations.js        citation library with sources
  letters.js          letter templates
  textmap.js          maps text matches to page rectangles
js/app/               browser UI
  redaction-engine.js rasterize, burn in, rebuild, verify, log PDF
  studio.js           Redaction Studio
  tracker.js          request tracker
  letters-ui.js       letter drafting
  settings-ui.js      settings, citations, guide
js/vendor/            pdf.js 3.11.174 (Apache-2.0), pdf-lib 1.17.1 (MIT)
```

## Known limits

- The redacted output is not text-searchable, because every page is an image. That is the price of guaranteed removal. OCR is not included.
- Automatic detection needs a text layer. Scanned pages must be reviewed by eye.
- Data is stored in the browser's local storage. Users should download backups; the app reminds them weekly.
- Password-protected PDFs must be unlocked before opening.
