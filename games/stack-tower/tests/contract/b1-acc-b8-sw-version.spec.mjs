#!/usr/bin/env node
/**
 * 契约测试 acc-b8 — SW 版本递增 + index network-first（spec v1.4 sw-cache-bump）。
 * 复现：node games/stack-tower/tests/contract/b1-acc-b8-sw-version.spec.mjs
 * 断言：
 *  ① CACHE = st-precache-v2（PRECACHE_REVISION 1 + META_CACHE_EPOCH 1；numeric 冻结不动——
 *     numeric.deploy.PRECACHE_REVISION 仍为 1，契约 acc-d1 兼容性同时复核）；
 *  ② index.html network-first（navigate 分支：fetch 优先 + 失败回退缓存）；
 *  ③ precache 清单含 B1 新增产物（build/meta/*、build/telemetry/meta.js、assets/meta/*）；
 *  ④ activate 清理旧版本缓存（filter k !== CACHE）；
 *  ⑤ gen-sw.mjs 真源：META_CACHE_EPOCH=1 在案（工具侧递增，不回填 numeric）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runContract, assert, assertEq, loadBuildModule, GAME_DIR } from './_runner.mjs';

const NUM = 'build/kernel/numeric.js';

runContract({
  id: 'acc-b8',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-sw-cache-bump',
  needs: [NUM],
  checks: [
    {
      name: 'CACHE=st-precache-v2；PRECACHE_REVISION 冻结为 1；acc-d1 子串兼容',
      fn: async () => {
        const num = (await loadBuildModule(NUM)).mod;
        assertEq(num.NUMERIC.deploy.PRECACHE_REVISION, 1, 'numeric 冻结不动');
        const sw = readFileSync(join(GAME_DIR, 'sw.js'), 'utf8');
        assert(sw.includes("const CACHE = 'st-precache-v2'"), 'CACHE 名 = st-precache-v2');
        assert(sw.includes('st-precache-v1'), 'acc-d1 兼容：上一版 v1 缓存名在清理注释在案');
        assert(/META_CACHE_EPOCH = 1/.test(sw), 'EPOCH=1 登记在 SW 头注释');
      },
    },
    {
      name: 'index.html network-first：navigate 分支 fetch 优先 + 缓存回退',
      fn: async () => {
        const sw = readFileSync(join(GAME_DIR, 'sw.js'), 'utf8');
        assert(/req\.mode === 'navigate'/.test(sw), 'navigate 分支在案');
        const navBlock = sw.slice(sw.indexOf("req.mode === 'navigate'"), sw.indexOf("event.respondWith(\n    caches.match(req"));
        assert(navBlock.includes('fetch(req)'), 'navigate 先走网络');
        assert(navBlock.includes('caches.match(NAV_PRELOAD'), '失败回退缓存副本');
        assert(navBlock.indexOf('fetch(req)') < navBlock.indexOf('caches.match(NAV_PRELOAD'), '网络优先于缓存');
      },
    },
    {
      name: 'precache 清单含 B1 新增产物（meta 模块 + meta 资产）',
      fn: async () => {
        const sw = readFileSync(join(GAME_DIR, 'sw.js'), 'utf8');
        for (const must of ['./build/meta/seed.js', './build/meta/save.js', './build/meta/daily.js', './build/meta/streak.js', './build/meta/claim.js', './build/telemetry/meta.js', './build/ui/meta-badge.js', './assets/meta/manifest.json']) {
          assert(sw.includes(`"${must}"`), `precache 含 ${must}`);
        }
      },
    },
    {
      name: 'activate 清理旧版本缓存 + gen-sw 真源 EPOCH 在案',
      fn: async () => {
        const sw = readFileSync(join(GAME_DIR, 'sw.js'), 'utf8');
        assert(sw.includes('keys.filter((k) => k !== CACHE)'), 'activate 清理非当前版本');
        const gen = readFileSync(join(GAME_DIR, 'tools', 'gen-sw.mjs'), 'utf8');
        assert(/const META_CACHE_EPOCH = 1;/.test(gen), 'gen-sw 工具侧 EPOCH=1（版本递增不回填 numeric）');
      },
    },
  ],
});
