#!/usr/bin/env node
/** 启动失败定位：抓取全部 console / pageerror / boot-msg 文本 / 引擎特性检测。 */
import { createRequire } from 'node:module';
const require = createRequire('/opt/homebrew/lib/node_modules/');
const { chromium, devices } = require('playwright');

const LIVE_URL = 'https://leomac-studio.tail49399e.ts.net/apps/ai/';
const dev = process.env.QA_DEV || 'iPhone 13';

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices[dev], isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('console', (m) => console.log(`[console.${m.type()}] ${m.text().slice(0, 500)}`));
page.on('pageerror', (e) => console.log(`[pageerror] ${String(e).slice(0, 800)}`));
page.on('requestfailed', (r) => console.log(`[reqfail] ${r.url()} :: ${r.failure()?.errorText}`));
await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

for (let i = 0; i < 12; i++) {
  await new Promise((r) => setTimeout(r, 10000));
  const st = await page.evaluate(() => ({
    bar: document.getElementById('bar')?.style.width,
    msg: document.getElementById('boot-msg')?.textContent,
    hidden: document.getElementById('boot')?.classList.contains('hidden'),
    canvasW: document.getElementById('canvas')?.width,
  })).catch((e) => ({ err: String(e) }));
  console.log(`t+${(i + 1) * 10}s`, JSON.stringify(st));
  if (st.hidden || st.msg?.includes('失败')) break;
}
await browser.close();
