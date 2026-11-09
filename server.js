// Paper Plate Store - tiny server, no npm packages needed (Node 16+)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const PASS = process.env.ADMIN_PASSWORD || 'admin123';   // change this!
const DATA = path.join(__dirname, 'data'), UP = path.join(__dirname, 'uploads'), PUB = path.join(__dirname, 'public');
[DATA, UP].forEach(d => fs.mkdirSync(d, { recursive: true }));
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { return d; } };
const wr = (f, v) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(v, null, 2));
const tokens = new Set();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const authed = req => tokens.has(req.headers['x-token']);
const clean = (s, n) => String(s || '').trim().slice(0, n);
function body(req) {
  return new Promise((ok, no) => {
    const b = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > 15e6) { no(new Error('Too large')); req.destroy(); } else b.push(c); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(b).toString() || '{}')); } catch (e) { no(e); } });
  });
}
function saveImage(u) {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(u || '');
  if (!m) return null;
  const name = crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UP, name), Buffer.from(m[2], 'base64'));
  return '/uploads/' + name;
}
const rmImage = u => { if (u && u.startsWith('/uploads/')) fs.unlink(path.join(UP, path.basename(u)), () => {}); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname, id = p.split('/')[3];
  try {
    if (p === '/api/items' && req.method === 'GET') return send(res, 200, rd('items.json', []));
    if (p === '/api/login' && req.method === 'POST') {
      const b = await body(req);
      if (b.password !== PASS) return send(res, 401, { error: 'Wrong password' });
      const t = crypto.randomBytes(16).toString('hex'); tokens.add(t); return send(res, 200, { token: t });
    }
    if (p === '/api/enquiry' && req.method === 'POST') {
      const b = await body(req);
      const e = { id: Date.now().toString(36), item: clean(b.item, 120), name: clean(b.name, 80), phone: clean(b.phone, 20), at: Date.now() };
      if (!e.item || !e.name || e.phone.replace(/\D/g, '').length < 7) return send(res, 400, { error: 'Invalid' });
      const q = rd('enquiries.json', []); q.unshift(e); wr('enquiries.json', q.slice(0, 1000)); return send(res, 200, { ok: true });
    }
    if (p === '/api/batch-enquiry' && req.method === 'POST') {
      const b = await body(req);
      const items = Array.isArray(b.items) ? b.items : [];
      const e = { id: Date.now().toString(36), items: items.map(it => clean(it, 120)), name: clean(b.name, 80), phone: clean(b.phone, 20), at: Date.now() };
      if (!items.length || !e.name || e.phone.replace(/\D/g, '').length < 7) return send(res, 400, { error: 'Invalid' });
      const q = rd('enquiries.json', []); q.unshift(e); wr('enquiries.json', q.slice(0, 1000)); return send(res, 200, { ok: true });
    }
    if (p.startsWith('/api/') && !authed(req)) return send(res, 401, { error: 'Login required' });
    if (p === '/api/items' && req.method === 'POST') {
      const b = await body(req), img = saveImage(b.image);
      if (!clean(b.name, 120) || b.price === '' || !img) return send(res, 400, { error: 'Name, price and photo are required' });
      const items = rd('items.json', []);
      items.push({ id: Date.now().toString(36), name: clean(b.name, 120), price: clean(b.price, 20), unit: clean(b.unit, 40), img });
      wr('items.json', items); return send(res, 200, { ok: true });
    }
    if (p.startsWith('/api/items/') && req.method === 'PUT') {
      const b = await body(req), items = rd('items.json', []), it = items.find(x => x.id === id);
      if (!it) return send(res, 404, { error: 'Not found' });
      if (b.image) { const img = saveImage(b.image); if (img) { rmImage(it.img); it.img = img; } }
      if (clean(b.name, 120)) it.name = clean(b.name, 120);
      if (b.price !== '' && b.price != null) it.price = clean(b.price, 20);
      it.unit = clean(b.unit, 40); wr('items.json', items); return send(res, 200, { ok: true });
    }
    if (p.startsWith('/api/items/') && req.method === 'DELETE') {
      const items = rd('items.json', []); rmImage((items.find(x => x.id === id) || {}).img);
      wr('items.json', items.filter(x => x.id !== id)); return send(res, 200, { ok: true });
    }
    if (p === '/api/enquiries' && req.method === 'GET') return send(res, 200, rd('enquiries.json', []));
    if (p.startsWith('/api/enquiries/') && req.method === 'DELETE') {
      wr('enquiries.json', rd('enquiries.json', []).filter(x => x.id !== id)); return send(res, 200, { ok: true });
    }
    // static files
    let f = p === '/' ? '/index.html' : p === '/admin' ? '/admin.html' : p;
    const base = f.startsWith('/uploads/') ? UP : PUB;
    const file = path.join(base, path.basename(f));
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) { send(res, 400, { error: e.message }); }
}).listen(PORT, () => console.log('Paper Plate Store running: http://localhost:' + PORT + '  (admin: /admin)'));
