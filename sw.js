const CACHE = 'ojt-hunter-v11';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/csp.js',
  './js/icons.js',
  './js/logic.js',
  './js/supabase.js',
  './js/db.js',
  './js/auth.js',
  './js/kanban.js',
  './js/vault.js',
  './js/reminders.js',
  './js/app.js',
  './manifest.webmanifest',
  './sw.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    // Cache each asset independently so one missing file (e.g. a fresh clone
    // without config.js) doesn't abort the whole install
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});