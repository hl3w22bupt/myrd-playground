#!/usr/bin/env node
/**
 * 冒烟门禁（stack-tower，Web 原型口径：浏览器可打开 + 核心循环可玩）
 *
 * 复现：
 *   node games/stack-tower/tests/smoke.mjs
 *   SMOKE_BROWSER=0 node games/stack-tower/tests/smoke.mjs   # 跳过真实浏览器（降级：HTTP+模块图+无头内核循环）
 *
 * 三态输出（与契约 runner 同口径）：
 *   RESULT: PASS (browser)                    —— 真实 Chromium 打开页面，点击落块、计分、重开全部生效
 *   RESULT: PASS (degraded: no browser …)     —— 浏览器不可用，退化为 HTTP + 静态模块图 + 无头核心循环
 *   RESULT: FAIL …                            —— exit 1
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadPlaywright } from './contract/_browser.mjs';

const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT ?? 4173 + (process.pid % 500));
const BASE = `http://127.0.0.1:${PORT}`;

function fail(msg) {
  console.log(`RESULT: FAIL — ${msg}`);
  process.exit(1);
}

// ---------- 1) 起静态服务 ----------
const server = spawn(process.execPath, [path.join(GAME_DIR, 'serve.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return res;
    } catch {}
    await sleep(100);
  }
  fail(`静态服务未就绪: ${BASE}`);
}

async function httpSmoke() {
  const page = await fetch(`${BASE}/`);
  const html = await page.text();
  if (!page.ok || !html.includes('./build/main.js')) fail('index.html 未引用 ./build/main.js');
  const main = await fetch(`${BASE}/build/main.js`);
  if (!main.ok) fail('build/main.js 不可达（先 npm run build）');
  console.log('  ok    HTTP：/ 200 且引用 build/main.js；/build/main.js 200');
}

/** 静态模块图：从 build/main.js 出发，相对导入必须全部存在（bundle 可加载的代理断言） */
async function moduleGraphSmoke() {
  const seen = new Set();
  const queue = ['build/main.js'];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const abs = path.join(GAME_DIR, rel);
    if (!existsSync(abs)) fail(`模块图断裂: ${rel}`);
    const src = await (await fetch(`${BASE}/${rel}`)).text();
    for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      queue.push(path.normalize(path.join(path.dirname(rel), m[1])));
    }
  }
  console.log(`  ok    模块图：${seen.size} 个 build 模块相对导入全部可解析`);
}

/** 无头核心循环：内核直接跑「等窗口→落块」×3（契约之外的最短可玩路径） */
async function headlessLoopSmoke() {
  const sim = await import(`${path.join(GAME_DIR, 'build/kernel/sim.js')}`);
  const h = sim.createSim({ seed: 20260925 });
  let placed = 0;
  for (let n = 0; n < 3; n++) {
    for (let i = 0; i < 400; i++) {
      h.fastForward(1);
      const s = h.snapshot();
      if (Math.abs(s.moving.x - s.tower[s.tower.length - 1].x) <= 22.4) break;
    }
    const events = h.tick({ type: 'drop' });
    if (events.some((e) => e.type === 'block-placed')) placed++;
  }
  if (placed !== 3) fail(`无头核心循环 3 次落块仅 ${placed} 次成功`);
  console.log('  ok    无头核心循环：seed=20260925 连续 3 次落块成功，score=' + h.snapshot().score);
}

// ---------- 2) 真实浏览器冒烟 ----------
// playwright 装载统一走 contract/_browser.mjs（本包 → PLAYWRIGHT_MODULE_DIR → npm 全局根自动发现）。

async function browserSmoke() {
  const pw = await loadPlaywright();
  if (!pw || process.env.SMOKE_BROWSER === '0') return false;
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });
  } catch (e) {
    console.log(`  warn  Chromium 启动失败（${e.message.split('\n')[0]}），降级为非浏览器冒烟`);
    return false;
  }
  try {
    const page = await browser.newPage({ viewport: { width: 560, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    });

    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForSelector('#stack-tower-canvas', { timeout: 5000 });
    const box = await page.locator('#stack-tower-canvas').boundingBox();
    if (!box || box.width < 100) fail('画布尺寸异常（逻辑宽应为 480）');
    console.log(`  ok    浏览器：页面打开，画布 ${Math.round(box.width)}×${Math.round(box.height)} 就绪`);

    const scoreText = () => page.locator('.st-hud-score').innerText();
    const s0 = await scoreText();
    if (!s0.includes('0')) fail(`初始 HUD 异常: "${s0}"`);

    // 点击落块 ×3：开局面块自中轴入画，第一次点击必命中（perfect，+35）
    for (let i = 0; i < 3; i++) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(420); // > 输入去抖 300ms
    }
    const s1 = await scoreText();
    const score1 = Number(s1.replace(/\D+/g, '')) || 0;
    if (score1 <= 0) fail(`点击后分数未变化: "${s1}"`);
    console.log(`  ok    核心循环：3 次点击落块生效，HUD "${s1}"`);

    // R 重开 → 全量复位
    await page.keyboard.press('r');
    await page.waitForTimeout(120);
    const s2 = await scoreText();
    if (!s2.includes('0') || s2 === s1) fail(`重开未复位: "${s1}" → "${s2}"`);
    console.log(`  ok    重开：R 键后 HUD "${s2}"（分数/连击清零）`);

    if (errors.length) fail(`页面运行期错误: ${errors.join(' | ')}`);
    console.log('  ok    零页面错误（pageerror / console.error 均无）');
    return true;
  } finally {
    await browser.close();
  }
}

// ---------- 主流程 ----------
try {
  await waitServer();
  await httpSmoke();
  await moduleGraphSmoke();
  await headlessLoopSmoke();
  const browserOk = await browserSmoke();
  console.log(browserOk ? 'RESULT: PASS (browser)' : 'RESULT: PASS (degraded: no browser — HTTP+模块图+无头核心循环)');
  process.exitCode = 0;
} catch (e) {
  fail(e?.message ?? String(e));
} finally {
  server.kill('SIGTERM');
}
