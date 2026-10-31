/* Firmo – Service Worker (offline-first) */
const V = 'firmo-v2';
const CORE = ['./', './index.html', './about.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png',
  './icons/logo.webp', './icons/logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // Page navigations: serve the cached app instantly, refresh it in the background
  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(V);
      const hit = await c.match('./index.html');
      const net = fetch(r).then(res => { if (res && res.ok) c.put('./index.html', res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    })());
    return;
  }
  // Same-origin files: cache first, then network (and remember)
  if (u.origin === self.location.origin) {
    e.respondWith(
      caches.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r).then(res => {
        if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
        return res;
      }))
    );
  }
});
