#!/usr/bin/env node
/**
 * 资产接线门禁（T3 美术线）— 断言 assets/ 实体贴图真实接线且缺项安全降级。复现：
 *   node games/stack-tower/tests/assets-check.mjs
 *   PLAYWRIGHT_MODULE_DIR=<全局 node_modules> node games/stack-tower/tests/assets-check.mjs   # 真实浏览器级
 *
 * 三态输出（与契约 runner 同口径）：
 *   RESULT: PASS (browser)   —— Chromium 打开页面：9 项资产请求全 200 且 console 报「贴图就绪 9/9」，零页面错误
 *   RESULT: PASS (degraded)  —— 无浏览器：9 项资产静态可达（HTTP 200）+ PNG 签名有效
 *   RESULT: FAIL …           —— exit 1
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT ?? 4673 + (process.pid % 500));
const BASE = `http://127.0.0.1:${PORT}`;

const fail = (m) => {
  console.log(`RESULT: FAIL — ${m}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 负面用例：全部资产 404 → 核心循环仍可玩、零代码错误（排除 Chromium 网络层自动 404 记录） */
async function fallbackVerify(pw) {
  const browser = await pw.chromium.launch({ headless: true }).catch(() => null);
  if (!browser) return;
  try {
    const page = await browser.newPage({ viewport: { width: 560, height: 800 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      // 「Failed to load resource」是浏览器对 404 的自动网络记录，非页面代码错误
      if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errs.push(`console.error: ${m.text()}`);
    });
    await page.route('**/assets/**', (r) => r.fulfill({ status: 404, body: 'not found' }));
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForSelector('#stack-tower-canvas', { timeout: 5000 });
    const box = await page.locator('#stack-tower-canvas').boundingBox();
    for (let i = 0; i < 3; i++) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(420);
    }
    const s1 = await page.locator('.st-hud-score').innerText();
    if (!((Number(s1.replace(/[^0-9]/g, '')) || 0) > 0)) fail(`资产 404 降级下核心循环不可玩: "${s1}"`);
    if (errs.length) fail(`资产 404 降级下出现代码错误: ${errs.join(' | ')}`);
    console.log(`  ok    fallback：资产全 404 下核心循环可玩（HUD "${s1}"），零代码错误`);
  } finally {
    await browser.close();
  }
}

// 清单唯一真源 = 源码导出（经 build 产物读取，先 build 再跑本门禁）
const { ASSET_MANIFEST } = await import(`${GAME_DIR}/build/render/assets.js`);
const entries = Object.entries(ASSET_MANIFEST);
if (entries.length !== 9) fail(`清单项数异常: ${entries.length}（应 9：e01–e08 + tileset）`);

const server = spawn(process.execPath, [path.join(GAME_DIR, 'serve.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
try {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/`);
      if (r.ok) break;
    } catch {}
    await sleep(100);
  }

  // —— 基线证据：PNG 签名有效 + 静态可达（degraded 级即可成立）——
  for (const [key, url] of entries) {
    const abs = path.join(GAME_DIR, url);
    const sig = readFileSync(abs).subarray(0, 8).toString('hex');
    if (sig !== '89504e470d0a1a0a') fail(`${key} 非有效 PNG: ${url}`);
    const res = await fetch(`${BASE}/${url}`);
    if (!res.ok) fail(`${key} 静态不可达: ${url} (HTTP ${res.status})`);
    console.log(`  ok    ${key} → ${url} (200)`);
  }

  // —— 浏览器级证据：运行时真加载 + 零错误 ——
  const resolvePw = async () => {
    try {
      return createRequire(path.join(GAME_DIR, 'package.json'))('playwright');
    } catch {
      const dir = process.env.PLAYWRIGHT_MODULE_DIR;
      if (!dir) return null;
      try {
        return createRequire(path.join(dir, 'noop.js'))('playwright');
      } catch {
        return null;
      }
    }
  };
  const pw = await resolvePw();
  const browserOk = await (async () => {
    if (!pw) return false;
    const browser = await pw.chromium.launch({ headless: true }).catch(() => null);
    if (!browser) return false;
    try {
      const page = await browser.newPage({ viewport: { width: 560, height: 800 } });
      const errors = [];
      const statuses = new Map();
      const infos = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
        if (m.type() === 'info') infos.push(m.text());
      });
      page.on('response', (r) => {
        const u = new URL(r.url());
        if (u.pathname.startsWith('/assets/')) statuses.set(u.pathname, r.status());
      });
      await page.goto(`${BASE}/`, { waitUntil: 'load' });
      // 轮询等异步预载完成（Chromium 冷启动时 boot→Image 发起有延迟，固定等待不稳）
      for (let i = 0; i < 30 && statuses.size < entries.length; i++) await sleep(100);

      for (const [, url] of entries) {
        const st = statuses.get(`/${url}`); // 运行时 key = URL pathname（带前导 /），清单为工程相对路径
        if (st !== 200) fail(`运行时资产请求异常: ${url} (HTTP ${st ?? '无请求'})`);
      }
      const ready = infos.find((t) => t.includes('贴图就绪'));
      if (!ready || !ready.includes('9/9')) fail(`贴图就绪信息异常: "${ready ?? '无'}"`);
      if (errors.length) fail(`页面运行期错误: ${errors.join(' | ')}`);
      console.log(`  ok    运行时：9 项资产请求全 200，${ready.trim()}，零页面错误`);
      return true;
    } finally {
      await browser.close();
    }
  })();
  if (browserOk) {
    // —— 负面用例：全部资产 404（引用失败）→ 不得破坏运行（黑板 assets.md 红线） ——
    await fallbackVerify(pw);
    console.log('RESULT: PASS (browser)');
  } else {
    console.log('  warn  Chromium 不可用，降级为静态可达 + PNG 签名级验证');
    console.log('RESULT: PASS (degraded: assets 9/9 静态可达)');
  }
} catch (e) {
  fail(e?.message ?? String(e));
} finally {
  server.kill('SIGTERM');
}
