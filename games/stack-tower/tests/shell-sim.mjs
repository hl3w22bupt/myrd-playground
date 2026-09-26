/**
 * 壳形态模拟门禁（R1③ 防回归）：本地复刻 AppHost 壳语义，跑 SW controller + 断网 reload 可玩。
 *
 * 背景（blockers.md R1/U6）：线上壳形态 = 页面 /apps/<slug>/gw + 相对 <base href="api/public/assets/">
 * + boot 脚本（二进制 base64 还原）+ M1 网关只透传文本。本地 serve.mjs（根路径形态）覆盖不了
 * 该形态 → d1/d2 契约曾全绿而线上 SW 全空转（形态盲区）。本模拟器在部署前即可复现/验证壳形态。
 *
 * 用法：node tests/shell-sim.mjs   （RESULT: PASS / FAIL，exit 0/1）
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright } from './contract/_browser.mjs';

const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT_DIR = path.join(GAME_DIR, 'export', 'web');
const PORT = 4780 + (process.pid % 400);
const APP = `/apps/stack-tower-3`;           // 模拟平台公网前缀（无 /gw 段，与线上一致）
const PAGE = `${APP}/gw`;

const TEXT_CT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};
const BIN_RE = /\.(png|m4a|ogg|wav|mp3|jpg|jpeg|webp)$/i;
const MIME_BIN = { '.png': 'image/png', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' };

// —— 复用壳真源 BOOT_SCRIPT（从 server/src/boot-script.ts 提取常量与模板字面量后求值，非复制粘贴） ——
const bootSrc = readFileSync(path.join(GAME_DIR, '..', '..', 'server', 'src', 'boot-script.ts'), 'utf8');
const mBoot = bootSrc.match(/export const BOOT_SCRIPT = (`[\s\S]*?`);/);
const mBin = bootSrc.match(/const BINARY_EXT_RE = (\/[\s\S]*?\/i);/);
const mMime = bootSrc.match(/const MIME_BY_EXT: Record<string, string> = (\{[\s\S]*?\});/);
if (!mBoot || !mBin || !mMime) { console.error('FAIL 无法从 server/src/boot-script.ts 提取 BOOT_SCRIPT/常量'); process.exit(2); }
const BOOT_SCRIPT = new Function('BINARY_EXT_RE', 'MIME_BY_EXT', `return ${mBoot[1]};`)(
  eval(mBin[1]),
  eval(`(${mMime[1]})`),
);

function rewriteManifest(json) {
  const o = JSON.parse(json);
  o.start_url = '../../../gw';
  o.scope = '../../../';
  return JSON.stringify(o);
}

function serveAsset(name, res) {
  // R1④/⑤：目录形态与 index.html 均回注入版落地页 —— 镜像 server/src/index.ts serveAsset 语义
  if (!name || name.endsWith('/') || name === 'index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(landingHtml());
    return;
  }
  const abs = path.join(EXPORT_DIR, name);
  if (!existsSync(abs) || !abs.startsWith(EXPORT_DIR)) { res.writeHead(404); res.end('not found'); return; }
  const buf = readFileSync(abs);
  const headers = { 'Cache-Control': 'public, max-age=300' };
  if (BIN_RE.test(name)) {
    res.writeHead(200, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(buf.toString('base64'));
    return;
  }
  if (name === 'sw.js') headers['Service-Worker-Allowed'] = '/';   // R1①
  res.writeHead(200, { ...headers, 'Content-Type': TEXT_CT[path.extname(name)] ?? 'application/octet-stream' });
  res.end(name === 'manifest.webmanifest' ? rewriteManifest(buf.toString('utf8')) : buf);
}

const landingHtml = () => readFileSync(path.join(EXPORT_DIR, 'index.html'), 'utf8')
  .replace(/<head[^>]*>/i, (h) => `${h}<base href="api/public/assets/"><script>${BOOT_SCRIPT}</script>`);

// R1②配套镜像：/sw.js 路由回源 sw.js 并把 precache 相对键重写到公开资产路由
// （rewriteSw 语义同 server/src/index.ts）—— 脚本 URL 挂应用根，默认 scope 覆盖页面
const rewriteSw = (t) => t.replace(/(['"])\.\//g, '$1./api/public/assets/');
const swJs = () => rewriteSw(readFileSync(path.join(EXPORT_DIR, 'sw.js'), 'utf8'));

const server = createServer((req, res) => {
  let p = new URL(req.url, 'http://x').pathname;
  // 平台网关 rewrite 复刻：/apps/<slug>/gw/<rest> 与 /apps/<slug>/<rest> 均透传为 /<rest>
  if (p === APP || p === `${APP}/`) p = '/';
  else if (p.startsWith(`${APP}/gw/`)) p = p.slice(APP.length + 3);
  else if (p.startsWith(`${APP}/`)) p = p.slice(APP.length);
  const assetsPrefix = '/api/public/assets/';
  if (p === assetsPrefix.slice(0, -1)) {
    // R1④配套镜像：网关 308 归一化后的目录形态 → 落地页（sw.js precache 首项 "./" 可取）
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(landingHtml());
    return;
  }
  if (p === '/sw.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
    res.end(swJs());
    return;
  }
  if (p.startsWith(assetsPrefix)) return serveAsset(p.slice(assetsPrefix.length), res);
  // 页面：/ 与 /gw → 注入 <base> + boot 的 index.html（serveLanding 语义）
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(landingHtml());
});

const results = [];
const ok = (t) => results.push(['ok', t]);
const fail = (t) => results.push(['FAIL', t]);

const pw = await loadPlaywright();
if (!pw) { console.error('FAIL playwright 不可用'); process.exit(2); }
const browser = await pw.chromium.launch();
const pageErrors = [];

try {
  await new Promise((r) => server.listen(PORT, r));
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (/pwa|error/i.test(m.text()) || m.type() === 'error') console.log(`  [console.${m.type()}] ${m.text()} @${m.location()?.url ?? '?'}`); });

  await page.goto(`http://127.0.0.1:${PORT}${PAGE}`, { waitUntil: 'load', timeout: 15000 });
  await page.waitForSelector('#stack-tower-canvas', { timeout: 10000 });
  ok('壳形态页面加载（/apps/<slug>/gw + <base> + boot 注入）');

  // ① SW 脚本路由（R1②）：脚本挂页面目录（应用根），壳回源并重写 precache 键
  const swRes = await page.evaluate(async () => {
    const script = new URL('sw.js', new URL('./', location.href)).href;
    const r = await fetch(script, { cache: 'no-store' });
    const body = await r.text();
    return {
      script,
      status: r.status,
      ct: r.headers.get('content-type'),
      rewritten: body.includes(`'./api/public/assets/index.html'`) || body.includes(`"./api/public/assets/index.html"`),
    };
  });
  if (swRes.status === 200 && swRes.ct?.startsWith('text/javascript') && swRes.rewritten) {
    ok(`SW 脚本路由 ✓ ${new URL(swRes.script).pathname}（200 JS + precache 键已重写到资产路由）`);
  } else fail(`SW 脚本路由异常: ${JSON.stringify(swRes)}`);

  // ② 显式注册生效：scope 覆盖页面（R1②）
  const swState = await page.evaluate(async () => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const regs = await navigator.serviceWorker.getRegistrations();
      const active = regs.find((r) => r.active);
      if (active && navigator.serviceWorker.controller) return { ok: true, scope: new URL(active.scope).pathname };
      await new Promise((r) => setTimeout(r, 200));
    }
    // 失败路径诊断：手动复跑注册，拿原始报错（定位用，不影响判定）
    let diag = '';
    try {
      const script = new URL('sw.js', document.baseURI).href;
      const scope = new URL('./', location.href).href;
      await navigator.serviceWorker.register(script, { scope });
      diag = `manual register OK（页面内首次注册可能晚于轮询）script=${script} scope=${scope}`;
    } catch (e) { diag = `manual register FAIL: ${e.message}`; }
    return { ok: false, regs: (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope), diag };
  });
  if (swState.ok && swState.scope === `${APP}/`) ok(`SW 控制页面 ✓ scope=${swState.scope}（页面目录形态）`);
  else fail(`SW 未控制页面: ${JSON.stringify(swState)}`);

  // ③ 断网 reload 可玩
  const ctx = page.context();
  await ctx.setOffline(true);
  try {
    await page.reload({ waitUntil: 'load', timeout: 15000 });
    await page.waitForSelector('#stack-tower-canvas', { timeout: 10000 });
    const box = await page.locator('#stack-tower-canvas').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(420);
    const s = await page.locator('.st-hud-score').innerText();
    if ((Number(s.replace(/\D+/g, '')) || 0) > 0) ok(`断网 reload 可玩 ✓（落块 "${s}"，SW precache 供源）`);
    else fail(`断网 reload 后落块无分: "${s}"`);
  } catch (e) {
    const cacheDbg = await page.evaluate(async () => {
      const keys = await caches.keys();
      const name = keys.find((k) => k.startsWith('st-precache-'));
      const cache = name ? await caches.open(name) : null;
      const probe = (p) => cache?.match(new URL(p, document.baseURI).href).then((r) => (r ? String(r.status) : 'MISS'));
      return { caches: keys, count: (await cache?.keys() ?? []).length, mainJs: await probe('build/main.js'), indexHtml: await probe('index.html') };
    });
    fail(`断网 reload 异常: ${e.message}；cache=${JSON.stringify(cacheDbg)}`);
  } finally { await ctx.setOffline(false); }

  // ④ U7 现状记录（不改，只观测）：壳形态 Image 贴图链路
  const img = await page.evaluate(async () => {
    const im = new Image();
    return await new Promise((resolve) => {
      const t = setTimeout(() => resolve('timeout'), 6000);
      im.onload = () => { clearTimeout(t); resolve(im.naturalWidth > 0 ? 'OK' : 'OK-but-0'); };
      im.onerror = () => { clearTimeout(t); resolve('ERROR'); };
      im.src = 'assets/sprites/e01-spawn-first-block.png';
    });
  });
  if (img === 'OK') ok('Image 贴图链路 OK');
  else results.push(['NOTE', `Image 贴图链路现状=${img}（U7 已立案，本轮不修，表现层降级程序化绘制）`]);

  if (pageErrors.length) fail(`页面错误: ${pageErrors.join(' | ')}`);
  else ok('零页面错误');
} catch (e) {
  fail(`脚本异常: ${e.message}`);
} finally {
  await browser.close();
  server.close();
}
for (const [k, t] of results) console.log(`  ${k.padEnd(4)} ${t}`);
const failed = results.some(([k]) => k === 'FAIL');
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS (shell-sim)');
process.exit(failed ? 1 : 0);
