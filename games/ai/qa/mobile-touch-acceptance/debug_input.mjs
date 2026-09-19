#!/usr/bin/env node
/** 输入探针：确认 CDP 触摸事件是否以 DOM 事件形式到达页面、命中目标是哪个元素。 */
import { createRequire } from 'node:module';
const require = createRequire('/opt/homebrew/lib/node_modules/');
const { chromium, devices } = require('playwright');

const LIVE_URL = 'https://leomac-studio.tail49399e.ts.net/apps/ai/';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ ...devices['iPhone 13'], isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.addInitScript(() => {
  window.__ev = [];
  for (const type of ['touchstart', 'touchend', 'touchmove', 'pointerdown', 'pointerup', 'mousedown', 'click']) {
    window.addEventListener(type, (e) => {
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      window.__ev.push({
        type,
        x: Math.round(t.clientX ?? -1),
        y: Math.round(t.clientY ?? -1),
        target: e.target?.id || e.target?.tagName,
        defaultPrevented: e.defaultPrevented,
      });
    }, { capture: true, passive: true });
  }
});
await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('hidden'), null, { timeout: 60000 });
console.log('booted; maxTouchPoints=', await page.evaluate(() => navigator.maxTouchPoints),
  'hitTarget=', await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight * 0.55);
    return el ? el.id || el.tagName : 'none';
  }));

const cdp = await context.newCDPSession(page);
const W = 390, H = 664;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: W / 2, y: H * 0.55, id: 1 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(600);
console.log('after CDP touch:', JSON.stringify(await page.evaluate(() => window.__ev)));

await page.touchscreen.tap(W / 2, H * 0.55).catch((e) => console.log('playwright tap err:', String(e).slice(0, 120)));
await page.waitForTimeout(600);
console.log('after playwright tap:', JSON.stringify(await page.evaluate(() => window.__ev)));
console.log('canvas size now:', JSON.stringify(await page.evaluate(() => ({ w: document.getElementById('canvas').width, h: document.getElementById('canvas').height }))));
await browser.close();
