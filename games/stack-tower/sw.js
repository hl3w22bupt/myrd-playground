/**
 * Stack Tower SW（生成于 tools/gen-sw.mjs，勿手改）— 版本化 precache。
 * REVISION = 1（spec v3 numeric.deploy.PRECACHE_REVISION）
 */
const CACHE = 'st-precache-v1';
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./build/app/main.js",
  "./build/audio/sfx.js",
  "./build/kernel/block.js",
  "./build/kernel/cut.js",
  "./build/kernel/difficulty.js",
  "./build/kernel/judge.js",
  "./build/kernel/numeric.js",
  "./build/kernel/ripple.js",
  "./build/kernel/rng.js",
  "./build/kernel/sim.js",
  "./build/kernel/tower.js",
  "./build/kernel/types.js",
  "./build/main.js",
  "./build/platform/browser.js",
  "./build/platform/index.js",
  "./build/platform/input.js",
  "./build/render/assets.js",
  "./build/render/backdrop.js",
  "./build/render/palette.js",
  "./build/render/renderer.js",
  "./build/render/textures.js",
  "./build/ui/hud.js",
  "./assets/icons/apple-touch-icon-180.png",
  "./assets/icons/icon-192-maskable.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/sfx/manifest.json",
  "./assets/sfx/sfx-game-over.m4a",
  "./assets/sfx/sfx-game-over.ogg",
  "./assets/sfx/sfx-level-clear.m4a",
  "./assets/sfx/sfx-level-clear.ogg",
  "./assets/sfx/sfx-miss.m4a",
  "./assets/sfx/sfx-miss.ogg",
  "./assets/sfx/sfx-perfect.m4a",
  "./assets/sfx/sfx-perfect.ogg",
  "./assets/sfx/sfx-place.m4a",
  "./assets/sfx/sfx-place.ogg",
  "./assets/sfx/sfx-restart.m4a",
  "./assets/sfx/sfx-restart.ogg",
  "./assets/sprites/e01-spawn-first-block.png",
  "./assets/sprites/e02-swing-motion.png",
  "./assets/sprites/e03-drop-input.png",
  "./assets/sprites/e04-overlap-cut.png",
  "./assets/sprites/e05-perfect-window.png",
  "./assets/sprites/e06-tower-ripple.png",
  "./assets/tileset/blocks-tower.png",
  "./assets/ui/e07-score-hud.png",
  "./assets/ui/e08-fail-recover.png"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});
