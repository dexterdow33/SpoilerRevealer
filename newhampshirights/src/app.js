const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');

const { SECTIONS, COUNTIES, DOC_TYPES, loadConfig } = require('./config');
const { openDb } = require('./db');
const auth = require('./auth');
const v = require('./views');

// Magic-byte check so a renamed file cannot pose as an image or PDF.
function sniffMime(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(8);
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  return null;
}

// Synchronous on purpose: ID images must be gone before we answer the request.
const removeFiles = (paths) => paths.forEach((p) => fs.rmSync(p, { force: true }));

function createApp(overrides = {}) {
  const config = loadConfig(overrides);
  const db = openDb(config);
  const app = express();
  app.set('trust proxy', config.production ? 1 : false);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    next();
  });
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(auth.sessionMiddleware(db, config));

  const render = (req, res, title, body, opts) => res.send(v.layout(req, config, title, body, opts));
  const notFound = (req, res) => res.status(404).send(v.layout(req, config, 'Not found', '<section class="card"><h1>Not found</h1></section>'));

  // CSRF on every urlencoded POST. The multipart verify route checks after parsing.
  app.use((req, res, next) => {
    if (req.method !== 'POST' || req.is('multipart/form-data')) return next();
    if (!auth.csrfValid(req)) return res.status(403).send('Form expired. Go back, reload the page, and try again.');
    next();
  });

  const requireLogin = (req, res, next) => (req.user ? next() : res.redirect('/login'));
  const requireMember = (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.role === 'admin' || req.user.status === 'verified') return next();
    return res.redirect('/verify');
  };
  const requireAdmin = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : notFound(req, res));

  const POST_SELECT = `
    SELECT p.*, u.display_name, u.town,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.removed = 0) AS comment_count
    FROM posts p JOIN users u ON u.id = p.user_id`;

  // ---------- public ----------
  app.get('/', (req, res) => {
    if (!req.user) return render(req, res, 'New Hampshire residents only', v.landing());
    if (req.user.role !== 'admin' && req.user.status !== 'verified') return res.redirect('/verify');
    const county = COUNTIES.includes(req.query.county) ? req.query.county : '';
    const posts = db.prepare(`${POST_SELECT} WHERE p.removed = 0 ${county ? 'AND p.county = ?' : ''} ORDER BY p.id DESC LIMIT 50`)
      .all(...(county ? [county] : []));
    render(req, res, 'Latest', v.feed(req, { posts, heading: 'Latest from around the state', county }));
  });

  for (const page of Object.keys(v.staticPages)) {
    app.get(`/${page}`, (req, res) => render(req, res, page[0].toUpperCase() + page.slice(1), v.staticPages[page](config)));
  }
  app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));

  // ---------- accounts ----------
  const limiter = auth.rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

  app.get('/signup', (req, res) => render(req, res, 'Join', v.authForm(req, 'signup')));
  app.post('/signup', limiter, (req, res) => {
    const b = req.body;
    const values = {
      email: String(b.email || '').trim().toLowerCase(),
      display_name: String(b.display_name || '').trim(),
      town: String(b.town || '').trim(),
      county: String(b.county || ''),
    };
    let error = '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) error = 'Enter a valid email.';
    else if (String(b.password || '').length < 10) error = 'Password must be at least 10 characters.';
    else if (!values.display_name || values.display_name.length > 60) error = 'Enter a display name up to 60 characters.';
    else if (!values.town || values.town.length > 60) error = 'Enter your town or city.';
    else if (!COUNTIES.includes(values.county)) error = 'Choose your county.';
    else if (b.adult !== '1' || b.rules !== '1') error = 'You must confirm you are an adult NH resident and accept the rules.';
    else if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(values.email)) error = 'That email already has an account.';
    if (error) return res.status(400).send(v.layout(req, config, 'Join', v.authForm(req, 'signup', values, error)));

    const { lastInsertRowid } = db.prepare(
      'INSERT INTO users (email, pass_hash, display_name, town, county) VALUES (?, ?, ?, ?, ?)',
    ).run(values.email, auth.hashPassword(b.password), values.display_name, values.town, values.county);
    auth.createSession(db, config, res, Number(lastInsertRowid));
    res.redirect('/verify');
  });

  app.get('/login', (req, res) => render(req, res, 'Log in', v.authForm(req, 'login')));
  app.post('/login', limiter, (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !auth.verifyPassword(String(req.body.password || ''), user.pass_hash)) {
      return res.status(401).send(v.layout(req, config, 'Log in', v.authForm(req, 'login', { email }, 'Email or password is wrong.')));
    }
    auth.createSession(db, config, res, user.id);
    res.redirect('/');
  });

  app.post('/logout', (req, res) => {
    auth.destroySession(db, req, res);
    res.redirect('/');
  });

  // ---------- verification ----------
  const latestVerification = (userId) =>
    db.prepare('SELECT * FROM verifications WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);

  app.get('/verify', requireLogin, (req, res) => {
    if (req.user.status === 'verified' || req.user.role === 'admin') return res.redirect('/');
    render(req, res, 'Verify', v.verifyPage(req, latestVerification(req.user.id)));
  });

  const upload = multer({
    storage: multer.diskStorage({
      destination: config.privateUploadDir,
      filename: (req, file, cb) => cb(null, crypto.randomBytes(18).toString('hex')),
    }),
    limits: { fileSize: config.maxUploadBytes, files: 4, fields: 10 },
    fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype)),
  }).fields([
    { name: 'id_front', maxCount: 1 }, { name: 'id_back', maxCount: 1 },
    { name: 'selfie', maxCount: 1 }, { name: 'address_proof', maxCount: 1 },
  ]);

  app.post('/verify', requireLogin, (req, res) => {
    const u = req.user;
    if (!['unverified', 'rejected'].includes(u.status)) return res.redirect('/verify');
    upload(req, res, (err) => {
      const files = Object.entries(req.files || {}).flatMap(([field, list]) => list.map((f) => ({ field, path: f.path })));
      const fail = (status, message) => {
        removeFiles(files.map((f) => f.path));
        res.status(status).send(v.layout(req, config, 'Verify', v.verifyPage(req, latestVerification(u.id), message)));
      };
      if (err) return fail(400, err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 8 MB or smaller.' : 'Upload failed. Try again.');
      if (!auth.csrfValid(req)) return fail(403, 'Form expired. Reload the page and try again.');

      const doc = DOC_TYPES.find((d) => d.value === req.body.doc_type);
      const has = (field) => files.some((f) => f.field === field);
      if (!doc) return fail(400, 'Choose a document type.');
      if (!has('id_front') || !has('selfie')) return fail(400, 'Upload the front of your ID and a selfie holding it (JPG, PNG, or PDF).');
      if (doc.needsAddressProof && !has('address_proof')) return fail(400, 'A passport has no address on it. Add a proof of NH address.');
      for (const f of files) {
        f.mime = sniffMime(f.path);
        if (!f.mime || (f.field === 'selfie' && f.mime === 'application/pdf')) return fail(400, 'One of the files is not a valid JPG, PNG, or PDF.');
      }

      db.prepare('INSERT INTO verifications (user_id, doc_type, files) VALUES (?, ?, ?)').run(u.id, doc.value, JSON.stringify(files));
      db.prepare("UPDATE users SET status = 'pending' WHERE id = ?").run(u.id);
      res.redirect('/verify');
    });
  });

  // ---------- members ----------
  app.get('/s/:section', requireMember, (req, res) => {
    const section = SECTIONS.find((s) => s.slug === req.params.section);
    if (!section) return notFound(req, res);
    const county = COUNTIES.includes(req.query.county) ? req.query.county : '';
    const posts = db.prepare(`${POST_SELECT} WHERE p.removed = 0 AND p.section = ? ${county ? 'AND p.county = ?' : ''} ORDER BY p.id DESC LIMIT 100`)
      .all(section.slug, ...(county ? [county] : []));
    render(req, res, section.name, v.feed(req, { posts, heading: section.name, blurb: section.blurb, section: section.slug, county }));
  });

  app.get('/search', requireMember, (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const county = COUNTIES.includes(req.query.county) ? req.query.county : '';
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const posts = q ? db.prepare(`${POST_SELECT} WHERE p.removed = 0 AND (p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\') ${county ? 'AND p.county = ?' : ''} ORDER BY p.id DESC LIMIT 100`)
      .all(like, like, ...(county ? [county] : [])) : [];
    render(req, res, 'Search', v.feed(req, { posts, heading: q ? `Results for “${q}”` : 'Search', county, q }));
  });

  app.get('/new', requireMember, (req, res) => render(req, res, 'New post', v.newPostForm(req, { section: req.query.section })));

  app.post('/posts', requireMember, (req, res) => {
    const b = req.body;
    const values = {
      section: String(b.section || ''), county: String(b.county || ''),
      title: String(b.title || '').trim(), body: String(b.body || '').trim(),
      price: String(b.price || '').trim(), link: String(b.link || '').trim(),
    };
    let error = '';
    let priceCents = null;
    if (!SECTIONS.some((s) => s.slug === values.section)) error = 'Choose a section.';
    else if (!COUNTIES.includes(values.county)) error = 'Choose a county.';
    else if (!values.title || values.title.length > 140) error = 'Title is required, 140 characters max.';
    else if (!values.body || values.body.length > 10000) error = 'Post text is required, 10,000 characters max.';
    else if (values.link && !/^https:\/\/[^\s]+$/i.test(values.link)) error = 'Links must start with https://';
    else if (values.price) {
      if (values.section !== 'marketplace') error = 'Prices only go on Marketplace posts.';
      else if (!/^\d{1,7}(\.\d{1,2})?$/.test(values.price)) error = 'Enter a price like 25 or 25.00.';
      else priceCents = Math.round(Number(values.price) * 100);
    }
    if (error) return res.status(400).send(v.layout(req, config, 'New post', v.newPostForm(req, values, error)));
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO posts (user_id, section, county, title, body, price_cents, link) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(req.user.id, values.section, values.county, values.title, values.body, priceCents, values.link || null);
    res.redirect(`/p/${lastInsertRowid}`);
  });

  const findPost = (id) => db.prepare(`${POST_SELECT} WHERE p.id = ? AND p.removed = 0`).get(Number(id) || 0);

  app.get('/p/:id', requireMember, (req, res) => {
    const post = findPost(req.params.id);
    if (!post) return notFound(req, res);
    const comments = db.prepare(`
      SELECT c.*, u.display_name, u.town FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ? AND c.removed = 0 ORDER BY c.id`).all(post.id);
    render(req, res, post.title, v.postPage(req, post, comments));
  });

  app.post('/p/:id/comments', requireMember, (req, res) => {
    const post = findPost(req.params.id);
    if (!post) return notFound(req, res);
    const body = String(req.body.body || '').trim();
    if (body && body.length <= 4000) db.prepare('INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)').run(post.id, req.user.id, body);
    res.redirect(`/p/${post.id}`);
  });

  app.post('/p/:id/report', requireMember, (req, res) => {
    const post = findPost(req.params.id);
    if (!post) return notFound(req, res);
    const reason = String(req.body.reason || '').trim().slice(0, 300);
    if (reason) db.prepare('INSERT INTO reports (post_id, reporter_id, reason) VALUES (?, ?, ?)').run(post.id, req.user.id, reason);
    res.send(v.layout(req, config, 'Reported', '', { flash: 'Thanks. A moderator will look at it.' }));
  });

  app.post('/p/:id/delete', requireMember, (req, res) => {
    const post = findPost(req.params.id);
    if (!post) return notFound(req, res);
    if (post.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).send('Not allowed.');
    db.prepare('UPDATE posts SET removed = 1 WHERE id = ?').run(post.id);
    res.redirect(`/s/${post.section}`);
  });

  app.get('/u/:id', requireMember, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id) || 0);
    if (!user) return notFound(req, res);
    const posts = db.prepare(`${POST_SELECT} WHERE p.removed = 0 AND p.user_id = ? ORDER BY p.id DESC LIMIT 50`).all(user.id);
    render(req, res, user.display_name, v.profilePage(req, user, posts));
  });

  app.post('/profile', requireMember, (req, res) => {
    db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(String(req.body.bio || '').trim().slice(0, 500), req.user.id);
    res.redirect(`/u/${req.user.id}`);
  });

  // ---------- admin ----------
  app.get('/admin', requireAdmin, (req, res) => {
    const pending = db.prepare(`
      SELECT v.id, v.doc_type, v.submitted_at, u.display_name, u.email, u.town, u.county
      FROM verifications v JOIN users u ON u.id = v.user_id WHERE v.status = 'pending' ORDER BY v.id`).all();
    const reports = db.prepare(`
      SELECT r.*, p.title, u.display_name AS reporter FROM reports r
      JOIN posts p ON p.id = r.post_id JOIN users u ON u.id = r.reporter_id
      WHERE r.resolved = 0 AND p.removed = 0 ORDER BY r.id`).all();
    render(req, res, 'Admin', v.adminHome(req, pending, reports));
  });

  const pendingVerification = (id) => db.prepare(`
    SELECT v.*, u.display_name, u.email, u.town, u.county FROM verifications v
    JOIN users u ON u.id = v.user_id WHERE v.id = ? AND v.status = 'pending'`).get(Number(id) || 0);

  app.get('/admin/verifications/:id', requireAdmin, (req, res) => {
    const ver = pendingVerification(req.params.id);
    if (!ver) return notFound(req, res);
    res.set('Cache-Control', 'no-store');
    render(req, res, 'Review', v.adminVerification(req, ver, JSON.parse(ver.files)));
  });

  app.get('/admin/verifications/:id/file/:idx', requireAdmin, (req, res) => {
    const ver = pendingVerification(req.params.id);
    const file = ver && JSON.parse(ver.files)[Number(req.params.idx)];
    if (!file || path.dirname(file.path) !== path.resolve(config.privateUploadDir)) return notFound(req, res);
    res.set({ 'Cache-Control': 'no-store', 'Content-Type': file.mime, 'Content-Disposition': 'inline' });
    res.sendFile(file.path);
  });

  app.post('/admin/verifications/:id', requireAdmin, (req, res) => {
    const ver = pendingVerification(req.params.id);
    if (!ver) return notFound(req, res);
    const approve = req.body.decision === 'approve';
    removeFiles(JSON.parse(ver.files).map((f) => f.path));
    db.prepare(`UPDATE verifications SET status = ?, note = ?, files = '[]', reviewed_at = datetime('now'), reviewer_id = ? WHERE id = ?`)
      .run(approve ? 'approved' : 'rejected', String(req.body.note || '').slice(0, 300), req.user.id, ver.id);
    db.prepare(`UPDATE users SET status = ?, verified_at = CASE WHEN ? THEN datetime('now') ELSE verified_at END WHERE id = ?`)
      .run(approve ? 'verified' : 'rejected', approve ? 1 : 0, ver.user_id);
    res.redirect('/admin');
  });

  app.post('/admin/reports/:id/resolve', requireAdmin, (req, res) => {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(Number(req.params.id) || 0);
    if (!report) return notFound(req, res);
    if (req.body.action === 'remove') db.prepare('UPDATE posts SET removed = 1 WHERE id = ?').run(report.post_id);
    db.prepare('UPDATE reports SET resolved = 1 WHERE post_id = ?').run(report.post_id);
    res.redirect('/admin');
  });

  app.post('/admin/users/:id/:action(suspend|reinstate)', requireAdmin, (req, res) => {
    const id = Number(req.params.id) || 0;
    if (id === req.user.id) return res.status(400).send('You cannot suspend yourself.');
    if (req.params.action === 'suspend') {
      db.prepare("UPDATE users SET status = 'suspended' WHERE id = ? AND role != 'admin'").run(id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    } else {
      db.prepare("UPDATE users SET status = CASE WHEN verified_at IS NULL THEN 'unverified' ELSE 'verified' END WHERE id = ? AND status = 'suspended'").run(id);
    }
    res.redirect(`/u/${id}`);
  });

  app.use(notFound);
  return { app, db, config };
}

module.exports = { createApp };
