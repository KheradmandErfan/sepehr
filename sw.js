/* سپهر — service worker: app shell + offline poems */
importScripts('config.js');
const V = 'v9', SHELL = 'shell-' + V, API = 'api-cache';
let DATA_HOST = ''; try { DATA_HOST = new URL(self.SEPEHR.BACKEND_URL).hostname; } catch (e) {}
const FILES = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())));
async function trim(name, max) { const c = await caches.open(name), ks = await c.keys(); for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]); }
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (DATA_HOST && u.hostname === DATA_HOST && u.pathname.startsWith('/api/d/')) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(API).then(ca => ca.put(r, c)).then(() => trim(API, 250)); } return res; })
      .catch(() => caches.match(r).then(m => m || Response.error())));
    return;
  }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com' || u.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const c = res.clone(); caches.open('fonts').then(ca => ca.put(r, c)); return res; })));
    return;
  }
  if (u.origin === location.origin) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(SHELL).then(ca => ca.put(r, c)); } return res; })
      .catch(() => caches.match(r).then(m => m || caches.match('index.html'))));
  }
});
