#!/usr/bin/env node
/**
 * 契约测试 m21/acc-d1 — PWA 可安装壳（自动化面；HTTPS 托管地址待主人指认，真机安装挂账不阻塞）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-d1-pwa-shell.spec.mjs
 * 断言：manifest（standalone + 192/512 maskable 图标 + start_url/scope）；apple-touch-180 link；
 *       sw.js 版本化 precache（CACHE 名含 numeric.deploy.PRECACHE_REVISION，清单覆盖 build/assets/sfx）；
 *       入口注册 SW；?fps=1 帧率面板装配。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const GAME_DIR = resolve(import.meta.dirname, '..', '..');

function pngSize(buf) {
  assertEq(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG 签名');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

runContract({
  id: 'acc-d1',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-pwa-shell',
  needs: ['build/kernel/numeric.js', 'build/ui/fps-overlay.js'],
  checks: [
    {
      name: 'manifest.webmanifest：standalone + icons 192/512 purpose maskable + 域内 start_url/scope',
      fn: async () => {
        const manifest = JSON.parse(readFileSync(join(GAME_DIR, 'manifest.webmanifest'), 'utf8'));
        assertEq(manifest.display, 'standalone', 'display standalone');
        assertEq(manifest.start_url, './', 'start_url');
        assertEq(manifest.scope, './', 'scope');
        assert(manifest.name && manifest.short_name, 'name/short_name');
        const icons = manifest.icons;
        assertEq(icons.length, 2, 'icons 192/512 两件');
        for (const icon of icons) {
          assert(icon.purpose.split(' ').includes('maskable'), `icon ${icon.sizes} purpose 含 maskable`);
          const size = Number(icon.sizes.split('x')[0]);
          assert([192, 512].includes(size), `icon 尺寸 ${icon.sizes}`);
          const file = pngSize(readFileSync(join(GAME_DIR, icon.src)));
          assertEq(file.width, size, `icon 文件实际宽度 = ${size}`);
          assertEq(file.height, size, `icon 文件实际高度 = ${size}`);
        }
        const apple = pngSize(readFileSync(join(GAME_DIR, 'assets', 'icons', 'apple-touch-icon-180.png')));
        assertEq(apple.width, 180, 'apple-touch-icon-180 文件实际宽度');
      },
    },
    {
      name: 'index.html：manifest link + apple-touch-icon 180 + theme-color + SW 可注册环境',
      fn: async () => {
        const html = readFileSync(join(GAME_DIR, 'index.html'), 'utf8');
        assert(html.includes('rel="manifest"'), 'manifest link');
        assert(html.includes('apple-touch-icon') && html.includes('apple-touch-icon-180.png'), 'apple-touch-icon 180 link');
        assert(html.includes('theme-color'), 'theme-color meta');
        assert(html.includes('apple-mobile-web-app-capable'), 'iOS standalone meta');
      },
    },
    {
      name: 'sw.js：版本化 CACHE（REVISION = numeric.deploy.PRECACHE_REVISION）+ 全量 precache 清单',
      fn: async ({ 'build/kernel/numeric.js': num }) => {
        const swPath = join(GAME_DIR, 'sw.js');
        assert(existsSync(swPath), 'sw.js 未生成（先 node tools/gen-sw.mjs）');
        const sw = readFileSync(swPath, 'utf8');
        const rev = num.NUMERIC.deploy.PRECACHE_REVISION;
        assert(sw.includes(`st-precache-v${rev}`), `CACHE 名含 PRECACHE_REVISION=${rev}`);
        for (const must of ['./', './index.html', './manifest.webmanifest', './build/main.js', './assets/sfx/sfx-place.m4a', './assets/sfx/sfx-restart.ogg', './assets/icons/icon-512-maskable.png']) {
          assert(sw.includes(JSON.stringify(must)), `precache 缺 ${must}`);
        }
        assert(sw.includes("addEventListener('fetch'"), 'fetch 拦截（离线回源）');
        assert(sw.includes("caches.delete"), 'activate 清旧版本缓存');
      },
    },
    {
      name: '入口装配：SW 注册 + ?fps=1 帧率面板',
      fn: async ({ 'build/ui/fps-overlay.js': fps }) => {
        const entryJs = readFileSync(join(GAME_DIR, 'build', 'main.js'), 'utf8') + readFileSync(join(GAME_DIR, 'build', 'app', 'main.js'), 'utf8');
        assert(entryJs.includes('serviceWorker'), '入口含 SW 注册分支');
        assert(entryJs.includes('fps'), '入口含 ?fps=1 分支');
        assert(typeof fps.frameStats === 'function' && typeof fps.withinFrameBudget === 'function', '帧统计纯函数可复用');
      },
    },
  ],
});
