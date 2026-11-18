/* Firmo service worker – offline-first. عند رفع نسخة جديدة غيّر VERSION هنا وفي index.html */
const VERSION = 'firmo-v6-2026-11-17';
const SHARED = 'firmo-shared';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './icons/favicon-32.png', './icons/favicon-64.png', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-192.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== SHARED) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  /* استقبال الملفات المشاركة إلى التطبيق (Web Share Target) */
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData(), c = await caches.open(SHARED);
        let i = 0;
        for (const f of fd.getAll('files')) {
          if (!(f instanceof File)) continue;
          await c.put('./shared/' + (i++), new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name) } }));
        }
      } catch (err) {}
      return Response.redirect('./index.html?shared=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  /* التنقل: أعطِ index.html من الكاش دائمًا (يعمل دون إنترنت) ثم حدّثه في الخلفية */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const cached = await c.match('./index.html');
      const net = fetch('./index.html', { cache: 'no-cache' }).then(r => { if (r && r.ok) c.put('./index.html', r.clone()); return r; }).catch(() => null);
      if (cached) { e.waitUntil(net); return cached; }
      return (await net) || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
    })());
    return;
  }
  /* باقي الملفات: من الكاش أولًا ثم الشبكة مع التخزين */
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r && r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
