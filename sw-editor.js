// ════ Service Worker — CCE Editor ═══════════════════════════
// IMPORTANT : incrémenter CACHE_VERSION à chaque nouvelle mise en ligne
// de chord-chart-editor-MKII-24.html, sinon les utilisateurs ayant
// installé l'app continueront de voir l'ancienne version en cache.
const CACHE_VERSION = 'cce-editor-v1';
const PRECACHE_URLS = [
  './index.html',
  './manifest-editor.json',
  './icon-editor-192.png',
  './icon-editor-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('cce-editor-') && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Stratégie : réseau d'abord (pour avoir la dernière version dès que
// possible), retombe sur le cache si hors-ligne ou requête échouée.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
