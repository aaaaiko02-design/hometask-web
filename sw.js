const CACHE = 'hometask-v15';
const BASE = self.registration.scope.replace(/\/$/, '');
const FILES = ['/', '/index.html', '/style.css', '/app.js', '/sync.js', '/firebase-config.js', '/manifest.json'].map(f => BASE + f);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r ?? fetch(e.request))
  );
});
