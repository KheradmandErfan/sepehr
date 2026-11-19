/* سپهر — service worker: app shell + offline poems
   شعرها و فهرست‌ها: «ابتدا کش، سپس به‌روزرسانی در پس‌زمینه» ⇒ بازشدن آنی
   شعر تصادفی: همیشه از شبکه (هرگز کهنه نمی‌شود)، کش فقط برای حالت آفلاین */
importScripts('config.js');
const V = 'v14', SHELL = 'shell-' + V, API = 'api-cache';
const host = u => { try { return new URL(u).hostname; } catch (e) { return ''; } };
const WORKER_HOST = host(self.SEPEHR.BACKEND_URL), DATA_HOST = host(self.SEPEHR.DATA_API);
const FILES = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())));
async function trim(name, max) { const c = await caches.open(name), ks = await c.keys(); for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]); }

const isRandom = u => /\/poem\/random\/?$/.test(u.pathname);
const isData = u => (WORKER_HOST && u.hostname === WORKER_HOST && (u.pathname.startsWith('/api/d/') || u.pathname === '/api/ext/page')) ||
  (DATA_HOST && u.hostname === DATA_HOST);

/* شعرهای ذخیره‌شدهٔ برون‌خط ممکن است با نشانی Worker ثبت شده باشند؛ نشانی هم‌ارز را هم بجوی */
function alts(u) {
  const out = [];
  try {
    const q = u.search;
    if (DATA_HOST && u.hostname === DATA_HOST) {
      const base = new URL(self.SEPEHR.DATA_API).pathname.replace(/\/$/, '');
      const rest = u.pathname.slice(base.length);
      if (WORKER_HOST) out.push(new URL(self.SEPEHR.BACKEND_URL).origin + '/api/d' + rest + q);
    } else if (WORKER_HOST && u.hostname === WORKER_HOST && u.pathname.startsWith('/api/d/') && DATA_HOST) {
      out.push(self.SEPEHR.DATA_API.replace(/\/$/, '') + u.pathname.slice(6) + q);
    }
  } catch (e) {}
  return out;
}
async function fromCache(r, u) {
  let m = await caches.match(r, { ignoreVary: true });
  if (m) return m;
  for (const a of alts(u)) { m = await caches.match(a, { ignoreVary: true }); if (m) return m; }
  return null;
}
function store(name, r, res, max) {
  if (!res || !res.ok) return;
  const c = res.clone();
  caches.open(name).then(ca => ca.put(r, c)).then(() => trim(name, max)).catch(() => {});
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  // تصویرها را مرورگر خودش کش می‌کند
  if (r.destination === 'image' && u.origin !== location.origin) return;

  if (isData(u)) {
    // شعر تصادفی: همیشه تازه از شبکه
    if (isRandom(u)) {
      e.respondWith(fetch(r).then(res => { store(API, r, res, 250); return res; })
        .catch(() => fromCache(r, u).then(m => m || Response.error())));
      return;
    }
    // بقیه: اگر در کش بود همان لحظه بده و در پس‌زمینه تازه کن
    e.respondWith(fromCache(r, u).then(hit => {
      const net = fetch(r).then(res => { store(API, r, res, 250); return res; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net.catch(() => Response.error());
    }));
    return;
  }

  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com' || u.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const c = res.clone(); caches.open('fonts').then(ca => ca.put(r, c)); return res; })));
    return;
  }

  if (u.origin === location.origin) {
    // config.js همیشه تازه (تغییر تنظیمات باید فوری اعمال شود)
    if (u.pathname.endsWith('/config.js')) {
      e.respondWith(fetch(r).then(res => { store(SHELL, r, res, 1e3); return res; })
        .catch(() => caches.match(r).then(m => m || Response.error())));
      return;
    }
    // پوسته: ابتدا کش، سپس تازه‌سازی در پس‌زمینه
    e.respondWith(caches.match(r).then(hit => {
      const net = fetch(r).then(res => { store(SHELL, r, res, 1e3); return res; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net.catch(() => caches.match('index.html'));
    }));
  }
});
