// ════════════════════════════════════════════════════════════════
// Service Worker — CCE Editor
// Objectif : que l'app se charge et fonctionne entièrement hors ligne,
// une fois ouverte au moins une fois avec une connexion.
//
// Stratégie : "cache d'abord" pour tout ce qui compose l'app elle-même
// (jamais d'attente réseau, jamais d'échec si la connexion manque), et
// mise en cache "à la volée" pour les polices Google Fonts chargées à
// distance (mises en cache dès le premier chargement en ligne, puis
// servies du cache ensuite).
//
// Pour forcer tout le monde à récupérer une nouvelle version : changer
// CACHE_VERSION ci-dessous. Les anciens caches sont supprimés
// automatiquement à l'activation.
// ════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'cce-editor-v18';

// Chemins RELATIFS au dossier de ce fichier (important pour GitHub Pages,
// où le site est souvent servi sous un sous-dossier, pas à la racine).
// scope = dossier dans lequel se trouve sw-editor.js, résolu automatiquement
// par le navigateur au moment de l'enregistrement (register('sw-editor.js')
// sans "/" au début, donc le scope suit naturellement le sous-dossier réel).
const APP_SHELL = [
  './',
  './index.html',
  './manifest-editor.json',
  './icon-editor-180.png',
  './icon-editor-192.png',
  './icon-editor-512.png',
];

// Domaines externes dont les réponses sont mises en cache dès qu'elles
// passent par ce service worker (polices Google Fonts : la feuille de
// style ET les fichiers .woff2 qu'elle référence, découverts au fil de
// l'utilisation — impossible de les précharger à l'avance puisque leurs
// URLs exactes ne sont connues qu'après lecture de la feuille de style).
const RUNTIME_CACHE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // { cache: 'reload' } pour éviter de piocher une version déjà
      // périmée depuis le cache HTTP normal du navigateur au moment de
      // constituer le cache applicatif.
      const requests = APP_SHELL.map(url => new Request(url, { cache: 'reload' }));
      return cache.addAll(requests);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // ne jamais intercepter POST/PUT/etc.

  const url = new URL(req.url);
  const isRuntimeHost = RUNTIME_CACHE_HOSTS.includes(url.hostname);
  const isSameOrigin = url.origin === self.location.origin;

  // Navigation directe (ex: ouverture de l'app, ou retour depuis un signet) :
  // toujours servir la coquille applicative en cache en priorité, pour un
  // chargement instantané et fiable même sans réseau.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cached => cached || fetch(req))
    );
    return;
  }

  if (isSameOrigin || isRuntimeHost) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          // Ne met en cache que les réponses valides (pas les erreurs, pas
          // les réponses opaques imprévisibles d'une requête cross-origin
          // sans CORS correctement configuré).
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
          }
          return res;
        }).catch(() => cached); // hors ligne et pas encore en cache : échec propre
      })
    );
  }
  // Toute autre requête (autres domaines non listés) : comportement par
  // défaut du navigateur, non interceptée.
});
