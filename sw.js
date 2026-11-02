// Offline cache for the installed app. Bump CACHE when files change.
const CACHE = 'ages-of-exploration-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/main.js', 'js/data/earth.js',
  'js/game/data.js', 'js/game/rng.js', 'js/game/world.js', 'js/game/path.js', 'js/game/game.js',
  'js/game/civs.js', 'js/game/expedition.js', 'js/game/turn.js',
  'js/render/map.js', 'js/render/sprites.js', 'js/render/portrait.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Network first so updates arrive promptly; fall back to cache offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
