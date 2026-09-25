#!/usr/bin/env node
/**
 * Service Worker 生成器（M2.1 acc-d1/d2，复现）：
 *   node games/stack-tower/tools/gen-sw.mjs
 * 版本化 precache：CACHE 名含 numeric.deploy.PRECACHE_REVISION（改值即整体换缓存）；
 * install 全量预缓存核心资源；activate 清理旧版本缓存；fetch 走 cache-first + 网络回填。
 * 清单 = 目录真实扫描（build/ 全模块 + assets/ + sfx/ + icons/ + manifest），确定性产出。
 */
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(GAME, '..', '..');

// REVISION 唯一真源 = spec/numeric（否则双写漂移）；读不到时显式失败
const specPath = join(REPO, '.myrd', 'spec', 'stack-tower-spec.json');
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const REVISION = spec?.spec?.numeric?.deploy?.PRECACHE_REVISION;
if (!Number.isInteger(REVISION)) {
  console.error(`FAIL PRECACHE_REVISION 不可读（${specPath}）——禁止私设版本号`);
  process.exit(1);
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, acc);
    else acc.push(relative(GAME, abs).split('\\').join('/'));
  }
  return acc;
}
const inBuild = walk(join(GAME, 'build')).map((f) => `./${f}`);
const inAssets = walk(join(GAME, 'assets')).map((f) => `./${f}`);
const PRECACHE = ['./', './index.html', './manifest.webmanifest', ...inBuild, ...inAssets];

const sw = `/**
 * Stack Tower SW（生成于 tools/gen-sw.mjs，勿手改）— 版本化 precache。
 * REVISION = ${REVISION}（spec v3 numeric.deploy.PRECACHE_REVISION）
 */
const CACHE = 'st-precache-v${REVISION}';
const PRECACHE = ${JSON.stringify(PRECACHE, null, 2)};

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
`;
writeFileSync(join(GAME, 'sw.js'), sw);
console.log(`  ok    precache 清单 ${PRECACHE.length} 项（REVISION=${REVISION}，CACHE=st-precache-v${REVISION}）`);
console.log('RESULT: PASS (sw.js generated)');
