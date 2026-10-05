// sw.js — GENERATED（tools/build.mjs）；cache-first 版本化缓存
const CACHE = 'g2-2-1791190236978';
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./audio.mjs",
  "./game.mjs",
  "./generated/spec-data.mjs",
  "./kernel/board.mjs",
  "./kernel/combo.mjs",
  "./kernel/datetime.mjs",
  "./kernel/deadlock.mjs",
  "./kernel/rng.mjs",
  "./kernel/sim.mjs",
  "./kernel/spec-source.mjs",
  "./main.mjs",
  "./persistence.mjs",
  "./platform/audio.mjs",
  "./platform/clock.mjs",
  "./platform/storage.mjs",
  "./platform/wx/adapter.mjs",
  "./platform/wx/boot-wx.mjs",
  "./platform/wx/privacy.mjs",
  "./platform/wx/runtime.mjs",
  "./platform/wx/share.mjs",
  "./platform/wx/wx-env.mjs",
  "./render/renderer.mjs",
  "./render/theme.mjs",
  "./telemetry/fps.mjs",
  "./telemetry/perf.mjs"
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS))
    .then(() => self.skipWaiting())
    .catch((err) => caches.open('sw-install-error').then((c) =>
      c.put('/__sw_install_error', new Response(String((err && err.stack) || err), { headers: { 'content-type': 'text/plain' } })))
      .then(() => Promise.reject(err))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match('./index.html'))));
});
