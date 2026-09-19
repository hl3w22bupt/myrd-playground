#!/usr/bin/env node
/**
 * 《我被ai女友包围了》移动端触屏仿真验收（对线上 liveUrl 执行）。
 *
 * 验收对象（本次执行时点）：
 *   HostedApp  id  = cmtoavt8p0006m9y6kzy2u14w（slug=ai）
 *   deployment id = cmu836iw00027m9x5uv3snds0（v11, 2.2.0-touch-viewport）
 *   liveUrl       = https://leomac-studio.tail49399e.ts.net/apps/ai/
 *
 * 覆盖：摇杆拖动 / 点按推进 / 选项点选 / 无缩放·滚动冲突 / 长按菜单 /
 *       横竖屏切换 / 帧率 / 音频解锁 / console 无手势相关 error。
 * 运行：NODE_PATH 无用（ESM），脚本内 createRequire 指向全局 playwright。
 *   node qa_mobile_touch.mjs            # 全量验收（iPhone 13 主流程 + Pixel 7 冒烟）
 *   QA_FAST=1 node qa_mobile_touch.mjs  # 只跑 iPhone 主流程
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire('/opt/homebrew/lib/node_modules/');
const { chromium } = require('playwright');

const LIVE_URL = process.env.QA_LIVE_URL || 'https://leomac-studio.tail49399e.ts.net/apps/ai/';
const HOSTED_APP_ID = 'cmtoavt8p0006m9y6kzy2u14w';
const DEPLOYMENT_ID = 'cmu836iw00027m9x5uv3snds0';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(OUT_DIR, { recursive: true });

/** @param {string} id @param {boolean} pass @param {string} name @param {string} detail */
function check(id, pass, name, detail) {
  const row = { id, name, pass: !!pass, detail };
  R.checks.push(row);
  console.log(`[${pass ? 'ok' : 'NG'}] ${id} ${name} — ${detail}`);
  return row.pass;
}
function metric(key, value, unit) {
  R.metrics[key] = { value, unit };
  console.log(`[metric] ${key} = ${value} ${unit}`);
}

const R = {
  startedAt: new Date().toISOString(),
  liveUrl: LIVE_URL,
  hostedAppId: HOSTED_APP_ID,
  deploymentId: DEPLOYMENT_ID,
  checks: [],
  metrics: {},
  consoleErrors: [],
  consoleAutoplaySuspects: [],
  notes: [],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 注入页内的图像 diff / 帧采样 / 视口信息工具（页面加载后 install 一次）。 */
async function installHelpers(page) {
  await page.evaluate(() => {
    if (window.__qa) return;
    async function bmp(b64) {
      // 不走 fetch：线上壳对 window.fetch 打了 wasm/pck 拦截补丁，data:URL 会被干扰；
      // atob → Blob → createImageBitmap 纯本地解码，绕开任何网络栈。
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    }
    window.__qa = {
      async info() {
        const cv = document.getElementById('canvas');
        return {
          dpr: window.devicePixelRatio,
          canvasBacking: cv ? { w: cv.width, h: cv.height } : null,
          canvasCss: cv ? { w: cv.clientWidth, h: cv.clientHeight } : null,
          inner: { w: window.innerWidth, h: window.innerHeight },
          vvScale: window.visualViewport ? window.visualViewport.scale : null,
          scrollY: window.scrollY,
          scrollH: document.documentElement.scrollHeight,
          bodyOverflow: getComputedStyle(document.body).overflow,
          bodyTouchAction: getComputedStyle(document.body).touchAction,
          canvasTouchAction: cv ? getComputedStyle(cv).touchAction : null,
          metaViewport: document.querySelector('meta[name="viewport"]')?.content || '',
          selection: String(window.getSelection()),
        };
      },
      async diff(aB64, bB64, r) {
        const A = await bmp(aB64);
        const B = await bmp(bB64);
        const c = document.createElement('canvas');
        c.width = r.w;
        c.height = r.h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(A, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        const da = ctx.getImageData(0, 0, r.w, r.h).data;
        ctx.clearRect(0, 0, r.w, r.h);
        ctx.drawImage(B, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        const db = ctx.getImageData(0, 0, r.w, r.h).data;
        let n = 0;
        for (let i = 0; i < da.length; i += 4) {
          if (Math.abs(da[i] - db[i]) > 28 || Math.abs(da[i + 1] - db[i + 1]) > 28 || Math.abs(da[i + 2] - db[i + 2]) > 28) n++;
        }
        return n / (da.length / 4);
      },
      /** 逐帧记录区域哈希：返回 {t0, frames:[[t,hash]...]}，用于点按响应与帧率测量。 */
      sampler(r, ms) {
        const cv = document.getElementById('canvas');
        const c = document.createElement('canvas');
        c.width = r.w;
        c.height = r.h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        const frames = [];
        const t0 = performance.now();
        return new Promise((res) => {
          function tick(t) {
            try {
              ctx.drawImage(cv, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
              const d = ctx.getImageData(0, 0, r.w, r.h).data;
              let h = 0;
              for (let i = 0; i < d.length; i += 64) h = (Math.imul(h, 31) + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0;
              frames.push([t, h]);
            } catch (e) {
              frames.push([t, 'E:' + e.message]);
            }
            if (t - t0 < ms) requestAnimationFrame(tick);
            else res({ t0, frames });
          }
          requestAnimationFrame(tick);
        });
      },
      /** 行热区探测：区域内按行统计亮像素（文字/描边/摇杆环），返回每行亮度计数。 */
      async rowProfile(b64, r, lumThreshold = 150) {
        const A = await bmp(b64);
        const c = document.createElement('canvas');
        c.width = r.w;
        c.height = r.h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(A, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        const d = ctx.getImageData(0, 0, r.w, r.h).data;
        const rows = [];
        for (let y = 0; y < r.h; y++) {
          let n = 0;
          for (let x = 0; x < r.w; x++) {
            const i = (y * r.w + x) * 4;
            const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            if (lum > lumThreshold) n++;
          }
          rows.push(n);
        }
        return rows;
      },
      /** 同 rowProfile，但统计暗像素（按钮底板比页面灰底暗），用于测量底板渲染高度。 */
      async rowProfileDark(b64, r, lumThreshold = 60) {
        const A = await bmp(b64);
        const c = document.createElement('canvas');
        c.width = r.w;
        c.height = r.h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(A, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        const d = ctx.getImageData(0, 0, r.w, r.h).data;
        const rows = [];
        for (let y = 0; y < r.h; y++) {
          let n = 0;
          for (let x = 0; x < r.w; x++) {
            const i = (y * r.w + x) * 4;
            const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            if (lum < lumThreshold) n++;
          }
          rows.push(n);
        }
        return rows;
      },
      /** 区域裁剪导出（dataURL png），用于归档放大查看小尺寸 UI。 */
      async crop(b64, r) {
        const A = await bmp(b64);
        const c = document.createElement('canvas');
        c.width = r.w;
        c.height = r.h;
        const ctx = c.getContext('2d');
        ctx.drawImage(A, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        return c.toDataURL('image/png');
      },
    };
  });
}

/** CDP 原生触摸：点按 / 拖拽 / 长按（比 page.tap 更贴近真机事件管线）。 */
async function touchTap(cdp, x, y) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 6, radiusY: 6 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function touchDrag(cdp, x0, y0, x1, y1, steps = 8, holdMs = 0) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1, radiusX: 6, radiusY: 6 }] });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, id: 1, radiusX: 6, radiusY: 6 }],
    });
    await sleep(16);
  }
  if (holdMs > 0) await sleep(holdMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function touchLongPress(cdp, x, y, ms = 900) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 6, radiusY: 6 }] });
  await sleep(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** 等引擎启动完成（#boot 隐藏），返回首屏耗时 ms；超时返回 -1。 */
async function waitBooted(page, timeoutMs = 150000) {
  const t0 = Date.now();
  try {
    await page.waitForSelector('#canvas', { timeout: 15000 });
    await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('hidden') === true, { timeout: timeoutMs });
    return await page.evaluate(() => Math.round(performance.now()));
  } catch {
    R.notes.push(`boot 未在 ${timeoutMs}ms 内完成（等待了 ${Date.now() - t0}ms）`);
    return -1;
  }
}

/** 截图证据：page.screenshot 返回 Buffer；归档落盘 + 返回 base64 供页内 diff。 */
async function shot(page, name) {
  const png = await page.screenshot({ type: 'png' });
  writeFileSync(join(OUT_DIR, `${name}.png`), png);
  return png.toString('base64');
}

// ============ 主流程 ============
async function runDevice(browser, deviceName, opts) {
  const full = opts.full === true;
  const dev = require('playwright').devices[deviceName];
  const context = await browser.newContext({ ...dev, isMobile: true, hasTouch: true });
  // 音频解锁探针：包装 AudioContext，记录创建 / resume / 状态迁移。
  await context.addInitScript(() => {
    window.__qaAudio = { created: 0, states: [], resumed: 0, errors: [] };
    const Orig = window.AudioContext;
    if (!Orig) return;
    window.AudioContext = class extends Orig {
      constructor(...a) {
        super(...a);
        window.__qaAudio.created++;
        const c = this;
        const rec = () => window.__qaAudio.states.push({ at: Math.round(performance.now()), state: c.state });
        rec();
        try { c.addEventListener('statechange', rec); } catch {}
        const r = c.resume.bind(c);
        c.resume = (...x) => { window.__qaAudio.resumed++; return r(...x); };
        c.onstateerror = () => window.__qaAudio.errors.push('stateerror');
      }
    };
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  R._contextMenuFired = 0;
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error') R.consoleErrors.push(m.text().slice(0, 300));
    if (t === 'warning' && /autoplay|not allowed|user gesture/i.test(m.text())) R.consoleAutoplaySuspects.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => R.consoleErrors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('contextmenu', () => { R._contextMenuFired++; });

  const tag = full ? 'iphone' : 'pixel';
  console.log(`\n===== ${deviceName} (${tag}) → ${LIVE_URL} =====`);
  const navStart = Date.now();
  await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await installHelpers(page);
  const loadMs = await waitBooted(page);
  if (loadMs >= 0) metric(`firstScreenMs_${tag}`, loadMs, 'ms（导航→引擎启动完成，仿真环境实测）');
  const info = await page.evaluate(() => window.__qa.info());
  console.log('viewport info:', JSON.stringify(info));

  if (full) {
    check('A1-boot', loadMs >= 0, '移动端 UA 可加载且引擎启动（canvas 出现、boot 隐藏）', `firstScreen=${loadMs}ms`);
    check('A2-viewport', /user-scalable=no/i.test(info.metaViewport), 'viewport meta 禁用缩放', info.metaViewport);
    check('A3-overflow', info.bodyOverflow === 'hidden', 'body overflow hidden（无页面滚动）', `overflow=${info.bodyOverflow}`);
    check('A4-touch-action', info.bodyTouchAction === 'none', '页面 touch-action:none（禁浏览器手势接管画布交互）', `body=${info.bodyTouchAction}, canvas=${info.canvasTouchAction}${info.canvasTouchAction !== 'none' ? '（canvas 未显式声明，靠祖先链 none 生效；建议补 #canvas{touch-action:none}）' : ''}`);
    check('A5-no-scrollable', info.scrollH <= info.inner.h + 1, '文档高度不超过视口（无滚动/回弹空间）', `scrollH=${info.scrollH} innerH=${info.inner.h}`);
    const res = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /assets\//.test(e.name)).map((e) => ({ n: e.name.split('/').pop(), kb: Math.round(e.transferSize / 102.4) / 10 })));
    metric('assetTransferKB_' + tag, res.reduce((s, e) => s + e.kb, 0), `KB（${res.map((e) => `${e.n}:${e.kb}KB`).join(', ')}）`);

    // 浏览器行为：编程滚动不得产生页面滚动（触摸拖拽滚动项移到 ARENA 相位做 ——
    // 标题/剧情相位任何 touchStart 都会被 TapLayer 当作「推进」，会污染后续相位时序）。
    await page.evaluate(() => window.scrollTo(0, 400));
    await sleep(200);
    const s1 = await page.evaluate(() => ({ y: window.scrollY, x: window.scrollX }));
    check('B1-no-scroll-programmatic', s1.y === 0 && s1.x === 0, '编程滚动无页面滚动（文档不可滚动）', `scrollTo→y=${s1.y}, x=${s1.x}`);
  }

  const audioBefore = await page.evaluate(() => window.__qaAudio);
  console.log('audio before touch:', JSON.stringify(audioBefore));
  if (full) {
    check('C1-no-autoplay-error-before-touch', R.consoleErrors.length === 0 && audioBefore.errors.length === 0, '首次触摸前无自动播放相关报错', `consoleErrors=${R.consoleErrors.length}, audioErrors=${audioBefore.errors.length}`);
  }
  return { context, page, cdp, info, tag, full };
}

// ---- 坐标/区域工具：设计视口 px（Godot 逻辑坐标）→ CSS px → 截图 px ----
// 拉伸事实（project.godot：canvas_items + aspect=expand）：引擎把内容按
// contentScale = min(backingW/640, backingH/360) 放大绘制，视口逻辑尺寸 =
// backing/contentScale（宽贴满基准 640，长边扩展）。旧「逻辑=物理」口径只对
// stretch=disabled 成立——DPR 热区缺陷（P1-1）的根因即该口径，坐标工具随之升级。
function scaleK(info) {
  return info.canvasBacking && info.canvasCss && info.canvasCss.w > 0 ? info.canvasBacking.w / info.canvasCss.w : 1;
}
/** 引擎内容缩放（逻辑 px → backing 物理 px）：canvas_items+expand 口径。 */
function contentScaleK(info) {
  const bw = info.canvasBacking?.w, bh = info.canvasBacking?.h;
  return bw > 0 && bh > 0 ? Math.min(bw / 640, bh / 360) : 1;
}
/** 视口逻辑尺寸（Godot anchors 空间）。 */
function viewportVp(info) {
  const k = contentScaleK(info);
  const bw = info.canvasBacking?.w || info.inner.w, bh = info.canvasBacking?.h || info.inner.h;
  return { w: bw / k, h: bh / k };
}
function dprOf(info) {
  return info.dpr || 1;
}
/** 视口逻辑 px 矩形 → 截图像素矩形（截图 = canvas backing 物理 px：×contentScale）。 */
function vpRect2Shot(info, r) {
  const k = contentScaleK(info);
  return { x: Math.round(r.x * k), y: Math.round(r.y * k), w: Math.round(r.w * k), h: Math.round(r.h * k) };
}
function cssOfVp(info, x, y) {
  const k = contentScaleK(info) / dprOf(info);
  return { x: x * k, y: y * k };
}
function shotRectFull(info) {
  const dpr = dprOf(info);
  return { x: 0, y: 0, w: Math.round(info.inner.w * dpr), h: Math.round(info.inner.h * dpr) };
}
function dialogZoneShot(info) {
  return vpRect2Shot(info, dialogPanelVp(info));
}
/** 对话面板（main.tscn DialogPanel：底边中心 320×110，底距 10，逻辑坐标）—— 剧情文本变化判定区。
 * 左边界右移到摇杆拖拽包络之外：joystick 锚左距24+锚宽160（中心104）+底环半径56+钮半径26
 * = 右缘 186 逻辑 px，+4px 余量 → 190。否则 ARENA 拖拽时钮右缘扫进裁剪框，E3b「拖拽不误触
 * 推进」把摇杆自己的动画误报成对话推进（正例误报，canvas_items 设计空间缩小 3× 后暴露）。 */
function dialogPanelVp(info) {
  const V = viewportVp(info);
  const left = Math.max(V.w / 2 - 160, 24 + 80 + 56 + 26 + 4);
  return { x: left, y: V.h - 120, w: V.w / 2 + 160 - left, h: 110 };
}
/** 选项区扫描框（OptionsBox 底边中心 496×114，底距 130，逻辑坐标）—— 严格限制在对话框面板上沿之上，
 * 避免面板暗色底混入底板测量。 */
function optionsZoneVp(info) {
  const V = viewportVp(info);
  return { x: V.w / 2 - 248, y: V.h - 244, w: 496, h: 116 };
}
/** 选项按钮 i 的中心（CSS 坐标）：VBox 自 OptionsBox 顶(Yv-244)逐个下排，节距 = 逻辑高 + separation(4)。 */
function optionButtonCenterCss(info, i) {
  const V = viewportVp(info);
  return cssOfVp(info, V.w / 2, V.h - 244 + 22 + i * (optionLogicHeight(info) + 4));
}
/** 选项按钮逻辑高（main.gd _min_option_height 代码事实：
 * clamp(ceil(min_touch_px(44 CSS pt) × dpr / contentScale), 20, option_button_max_height(96))）。 */
function optionLogicHeight(info) {
  const k = contentScaleK(info), dpr = dprOf(info);
  return Math.min(Math.max(Math.ceil((44 * dpr) / k), 20), 96);
}
/** 摇杆（JoystickAnchor：左下 160×160，左距 24，底距 24，逻辑坐标）。 */
function joystickZoneVp(info) {
  const V = viewportVp(info);
  return { x: 16, y: V.h - 200, w: 200, h: 184 };
}
function joystickCenterCss(info) {
  const V = viewportVp(info);
  return cssOfVp(info, 24 + 80, V.h - 184 + 80);
}
async function diffRect(page, a, b, rect) {
  return page.evaluate(({ a, b, r }) => window.__qa.diff(a, b, r), { a, b, r: rect });
}
/** 证据裁剪：把截图像素区域放大导出成独立 png（供报告归档查看小尺寸 UI）。 */
async function saveCrop(page, png, rect, name) {
  const dataUrl = await page.evaluate(({ p, r }) => window.__qa.crop(p, r), { p: png, r: rect });
  writeFileSync(join(OUT_DIR, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
}

// ---- 剧情交互：点按推进直至选择节点（以对话面板文本变化判定推进）。 ----
async function tapUntilChoice(page, cdp, info, maxTaps = 14, longPressAt = -1) {
  const zone = dialogZoneShot(info);
  let prev = await shot(page, 'step');
  let taps = 0;
  for (let i = 0; i < maxTaps; i++) {
    taps++;
    if (i === longPressAt) {
      await touchLongPress(cdp, info.inner.w / 2, info.inner.h * 0.5, 900);
      R.notes.push(`第 ${taps} 次推进使用长按 900ms（验证无 contextmenu/选中）`);
    } else {
      await touchTap(cdp, info.inner.w / 2, info.inner.h * 0.5);
    }
    await sleep(700);
    const cur = await shot(page, 'step');
    const d = await diffRect(page, prev, cur, zone);
    prev = cur;
    console.log(`  advance#${i + 1} dialogPanelDiff=${d.toFixed(4)}`);
    if (d < 0.005) return { choice: true, taps, lastShot: cur };
  }
  return { choice: false, taps, lastShot: prev };
}

/** 选项区暗色按钮底板行带（option-button.svg 底板比灰底暗）：按钮铺满 496 视口px 宽，
 * 行内暗像素 ≥85% 才算底板行（排除对话框面板的 320 宽暗底）。返回各按钮渲染几何（CSS px）。 */
async function detectOptionPlates(page, png, info) {
  const rect = vpRect2Shot(info, optionsZoneVp(info));
  const rows = await page.evaluate(({ p, r }) => window.__qa.rowProfileDark(p, r, 60), { p: png, r: rect });
  const minCount = Math.round(rect.w * 0.85);
  const bands = [];
  let start = -1;
  for (let y = 0; y < rows.length; y++) {
    if (rows[y] >= minCount) {
      if (start < 0) start = y;
    } else if (start >= 0) {
      if (y - start >= 6) bands.push({ y0: start, y1: y });
      start = -1;
    }
  }
  if (start >= 0 && rows.length - start >= 6) bands.push({ y0: start, y1: rows.length });
  const dpr = dprOf(info);
  return bands.map((b) => ({
    cssY: (rect.y + (b.y0 + b.y1) / 2) / dpr,
    heightCss: (b.y1 - b.y0) / dpr,
    widthShotPx: rect.w,
  }));
}

/** iPhone 主流程：点按启动 → 推进 → 选项×2 → 行动段摇杆 → 帧率 → 横竖屏 → 音频。 */
async function iphoneFlow(ctx) {
  const { page, cdp, info } = ctx;
  const W = info.inner.w, H = info.inner.h;

  // 1) 标题 → 画面内点按启动（此前不得有任何画布触摸，保证时序干净）
  const title = await shot(page, 's00_title');
  await touchTap(cdp, W / 2, H * 0.5);
  await sleep(900);
  const story0 = await shot(page, 's01_story_start');
  const startDiff = await diffRect(page, title, story0, shotRectFull(info));
  check('D1-tap-start', startDiff > 0.02, '画面内点按可从标题启动一局', `diff=${startDiff.toFixed(3)}`);

  // 2) 点按推进响应时延：rAF 采样对话面板区域，点按后首个变化帧即生效
  const V = viewportVp(info);
  const respZone = vpRect2Shot(info, { x: V.w / 2 - 120, y: V.h - 100, w: 240, h: 70 });
  const smpP = page.evaluate(({ r, ms }) => window.__qa.sampler(r, ms), { r: respZone, ms: 2200 });
  await sleep(400);
  const tapAt = await page.evaluate(() => performance.now());
  await touchTap(cdp, W / 2, H * 0.5);
  const smp = await smpP;
  let latency = -1;
  for (const [t, h] of smp.frames) {
    if (typeof h !== 'number' || t <= tapAt) continue;
    latency = Math.round(t - tapAt);
    break;
  }
  metric('tapAdvanceLatencyMs', latency, 'ms（点按→对话面板首个变化帧，rAF 帧级精度）');
  check('D2-tap-response', latency >= 0 && latency <= 120, '点按推进响应 ≤100ms（帧级实测，允许 1 帧量化误差）', `${latency}ms`);

  // 3) 点按推进至选择节点 1（其中一次用长按验证无 contextmenu/文字选中）
  const r1 = await tapUntilChoice(page, cdp, info, 10, 1);
  check('D3-tap-advance', r1.choice, `点按可推进剧情（至首个选择节点，共 ${r1.taps} 次点按）`, `choice=${r1.choice}`);
  const lpInfo = await page.evaluate(() => ({ sel: String(window.getSelection()) }));
  check('B2-longpress', R._contextMenuFired === 0 && !lpInfo.sel, '长按无系统菜单、无文字选中', `contextmenu=${R._contextMenuFired}, selection="${lpInfo.sel}"`);

  // 4) 选择节点 1：空白点按不结算；量化选项热区；点选选项推进
  const beforeChoice1 = r1.lastShot;
  await saveCrop(page, beforeChoice1, vpRect2Shot(info, { x: 0, y: V.h - 320, w: V.w, h: 320 }), 's02_choice_bottom_crop');
  await touchTap(cdp, W / 2, H * 0.15); // 选项区外的空白点按
  await sleep(700);
  const afterBlank = await shot(page, 's02_choice_blank_tap');
  const blankDiff = await diffRect(page, beforeChoice1, afterBlank, dialogZoneShot(info));
  check('D4-choice-blank-noop', blankDiff < 0.01, '选择节点空白点按不误触结算', `diff=${blankDiff.toFixed(4)}`);
  const plates = await detectOptionPlates(page, afterBlank, info);
  console.log('  option plates(choice1):', JSON.stringify(plates));
  const uiScale = 1 / scaleK(info);
  metric('uiScaleCssPerDesignPx', Math.round(uiScale * 1000) / 1000, 'CSS px / 设计视口 px（DPR 换算比）');
  // 热区判定（知识库 649e691d §2.3 权威口径）：热区物理 px ≥ 44 × DPR（等价 ≥44 CSS pt）。
  // 推算按 main.gd 代码事实：逻辑高 = clamp(ceil(44×DPR/contentScale), 20, 96)，物理 = 逻辑×contentScale。
  // 模型前提 = 本断言面向修复版构建（canvas_items 拉伸 + DPR 感知换算）复核；旧 disabled
  // 构建的像素法实测见 optionPlateHeightCssMeasured（受提示条遮挡干扰，仅供参考）。
  const dpr = dprOf(info);
  const k = contentScaleK(info);
  const hotzoneLogic = optionLogicHeight(info);
  const hotzonePhysical = hotzoneLogic * k;
  const hotzoneCss = hotzonePhysical / dpr;
  metric('optionHotzoneLogicPx', hotzoneLogic, '逻辑 px（main.gd _min_option_height 代码事实推算）');
  metric('optionHotzoneCssComputed', Math.round(hotzoneCss * 10) / 10, 'CSS pt（热区物理/DPR，Apple HIG 口径要求 ≥44）');
  if (plates.length > 0) {
    metric('optionPlateHeightCssMeasured', Math.round(Math.min(...plates.map((p) => p.heightCss)) * 10) / 10, 'CSS px（像素法实测，受提示条遮挡干扰仅供参考）');
  }
  const needPhysical = 44 * dpr;
  check('A6-hotzone44', hotzonePhysical >= needPhysical, '选项触控热区 ≥44×44 CSS pt（Apple HIG 点距口径）', `${hotzoneLogic} 逻辑px × contentScale${k.toFixed(3)} = ${Math.round(hotzonePhysical)} 物理px，需 ≥ 44×DPR${dpr.toFixed(0)}=${Math.round(needPhysical)}（=${hotzoneCss.toFixed(1)} CSS pt）`);
  await touchTap(cdp, W / 2, optionButtonCenterCss(info, 0).y);
  await sleep(800);
  const afterOpt = await shot(page, 's03_after_option1');
  const optDiff = await diffRect(page, afterBlank, afterOpt, dialogZoneShot(info));
  check('D5-option-tap', optDiff > 0.01, '点选选项 1 可结算并推进到下一节点', `diff=${optDiff.toFixed(4)}`);

  // 5) 推进至选择节点 2 → 点选 → 行动段（ARENA，摇杆出现）
  const r2 = await tapUntilChoice(page, cdp, info, 8);
  if (r2.choice) {
    await saveCrop(page, r2.lastShot, vpRect2Shot(info, { x: 0, y: V.h - 320, w: V.w, h: 320 }), 's03b_choice2_bottom_crop');
    await touchTap(cdp, W / 2, optionButtonCenterCss(info, 0).y);
  } else {
    await touchTap(cdp, W / 2, H * 0.5);
  }
  await sleep(800);
  await touchTap(cdp, W / 2, H * 0.5); // n08 → ARENA
  await sleep(1200);
  const arenaShot = await shot(page, 's04_arena');
  const joyRect = vpRect2Shot(info, joystickZoneVp(info));
  const joyRows = await page.evaluate(({ p, r }) => window.__qa.rowProfile(p, r, 90), { p: arenaShot, r: joyRect });
  const joyRing = joyRows.reduce((s, n) => s + n, 0);
  await saveCrop(page, arenaShot, joyRect, 's04b_joystick_crop');
  check('E1-joystick-visible', joyRing > 150, '行动段虚拟摇杆出现（左下角半透明圆环）', `ringPx(lum>90)=${joyRing}`);
  // 摇杆竖向包络 → 渲染直径（CSS px）：从环亮行带的首末位置估算
  const ringRows = joyRows.map((n, i) => (n > 8 ? i : -1)).filter((i) => i >= 0);
  if (ringRows.length > 1) {
    const dCss = (ringRows.at(-1) - ringRows[0]) / dprOf(info);
    metric('joystickDiameterCss', Math.round(dCss * 10) / 10, 'CSS px（摇杆底环渲染直径，摇杆设计 112 视口 px 内环）');
  }
  metric('playfieldExtent', Math.round((640 / V.w) * 1000) / 1000 + 'x' + Math.round((360 / V.h) * 1000) / 1000, '行动段 640×360 世界占逻辑视口比例（宽x高；canvas_items 下基准贴满、长边扩展）');

  // 6) 摇杆拖动：knob 跟手 + 玩家实际位移（A/B 对照）+ 不误触推进 + 不引发页面滚动。
  //    玩法实体（玩家/信物/危机）渲染在左上角 640×360 世界坐标内（约占竖屏顶部 18%）。
  //    玩家位移判定用 A/B：静置 1.4s 的区域变化（环境动画基线） vs 拖拽 1.4s 的区域变化。
  const jc = joystickCenterCss(info);
  const reach = (56 * 0.95) * contentScaleK(info) / dprOf(info); // 摇杆半径 56 逻辑 px → 物理 → CSS
  const playZone = { x: Math.round(W * 0.05 * info.dpr), y: Math.round(H * 0.03 * info.dpr), w: Math.round(W * 0.8 * info.dpr), h: Math.round(H * 0.2 * info.dpr) };
  const ctlA = await shot(page, 'e3_ctl_before');
  await sleep(1400);
  const ctlB = await shot(page, 'e3_ctl_after');
  const controlDiff = await diffRect(page, ctlA, ctlB, playZone);
  const dragP = page.evaluate(({ r, ms }) => window.__qa.sampler(r, ms), { r: joyRect, ms: 3000 });
  const dlgP = page.evaluate(({ r, ms }) => window.__qa.sampler(r, ms), { r: dialogZoneShot(info), ms: 3000 });
  await sleep(200);
  const dragStart = await page.evaluate(() => performance.now());
  const beforeDrag = await shot(page, 'e3_drag_before');
  await touchDrag(cdp, jc.x, jc.y, jc.x + reach, jc.y, 10, 1400);
  const scrollY1 = await page.evaluate(() => window.scrollY);
  const afterDrag = await shot(page, 'e3_drag_after');
  await sleep(200);
  const joy = await dragP;
  const dlg = await dlgP;
  const dragDiff = await diffRect(page, beforeDrag, afterDrag, playZone);
  const changed = (frames, t0, t1) => {
    let total = 0, ch = 0, first = null;
    for (const [t, h] of frames) {
      if (typeof h !== 'number') continue;
      if (first === null) first = h;
      if (t < t0 || t > t1) continue;
      total++;
      if (h !== first) ch++;
    }
    return total > 0 ? ch / total : 0;
  };
  const knobRatio = changed(joy.frames, dragStart, dragStart + 2500);
  const dlgDragRatio = changed(dlg.frames, dragStart, dragStart + 2500);
  console.log(`  knobChange=${knobRatio.toFixed(2)} dragDiff=${dragDiff.toFixed(4)} controlDiff=${controlDiff.toFixed(4)} dlgDrag=${dlgDragRatio.toFixed(2)} scrollY=${scrollY1}`);
  metric('joystickKnobChangeRatio', Math.round(knobRatio * 100) / 100, '拖拽期间摇杆区域帧变化占比');
  metric('playerMoveDragVsControl', `${dragDiff.toFixed(3)} vs ${controlDiff.toFixed(3)}`, '拖拽期 vs 静置期的玩法区变化占比（A/B）');
  check('E2-joystick-drag', knobRatio > 0.5, '摇杆可拖动（触摸被摇杆接管，knob 跟手）', `knobChangeRatio=${knobRatio.toFixed(2)}`);
  check('E3-drag-moves-player', dragDiff > controlDiff + 0.005, '拖动摇杆驱动玩家实际位移（拖拽期玩法区变化高于静置基线；截图前后对照见 e3crop_*.png）', `drag=${dragDiff.toFixed(3)} vs control=${controlDiff.toFixed(3)}`);
  check('E3b-drag-no-advance', dlgDragRatio < 0.2, '拖拽中不误触推进（对话面板无推进变化）', `dlgChangeRatio=${dlgDragRatio.toFixed(2)}`);
  check('E4-drag-no-page-scroll', scrollY1 === 0, '拖拽手势不引发页面滚动', `scrollY=${scrollY1}`);

  // 7) 双击不缩放（ARENA 相位空白点按无副作用，可安全触发）
  await touchTap(cdp, W / 2, H / 2);
  await sleep(120);
  await touchTap(cdp, W / 2, H / 2);
  await sleep(600);
  const z = await page.evaluate(() => window.__qa.info());
  check('B3-no-doubletap-zoom', z.vvScale === 1 && z.inner.w === W && z.scrollY === 0, '双击不触发页面缩放/滚动', `vvScale=${z.vvScale}, innerW=${z.inner.w}, scrollY=${z.scrollY}`);

  // 8) 行动段帧率采样
  const fpsRes = await page.evaluate(({ r, ms }) => window.__qa.sampler(r, ms), { r: playZone, ms: 4000 });
  const durS = fpsRes.frames.length > 1 ? (fpsRes.frames.at(-1)[0] - fpsRes.frames[0][0]) / 1000 : 0;
  const fps = durS > 0 ? Math.round((fpsRes.frames.length / durS) * 10) / 10 : 0;
  metric('fps_' + ctx.tag, fps, 'fps（rAF 采样，SwiftShader 软渲染仿真环境）');
  check('F1-fps', fps >= 30, '帧率 ≥30fps（仿真环境实测）', `${fps}fps over ${durS.toFixed(1)}s`);
  return { page, cdp, info };
}

/** 横竖屏切换 + 提示条遮挡 + 音频解锁收尾。 */
async function orientationAndAudio(ctx) {
  const { page, info } = ctx;
  const W = info.inner.w, H = info.inner.h;

  // DOM 提示条（#hint，pointer-events:none）与游戏对话面板的重叠检测：遮挡即关键 UI 被盖
  // 对话面板为 Godot 画布内 UI，按 main.tscn 锚点（底边中心 320×110，底距 10，逻辑坐标）
  // 经「逻辑视口 → CSS」换算后传入页面上下文（evaluate 内访问不到 Node 侧工具函数）。
  const Vp = viewportVp(info);
  const kk = contentScaleK(info) / dprOf(info);
  const panelCss = { pl: (Vp.w / 2 - 160) * kk, pr: (Vp.w / 2 + 160) * kk, pt: (Vp.h - 120) * kk, pb: (Vp.h - 10) * kk };
  const overlap = await page.evaluate(({ pl, pr, pt, pb }) => {
    const hint = document.getElementById('hint');
    if (!hint || hint.style.display === 'none') return { hidden: true };
    const hr = hint.getBoundingClientRect();
    const ox = Math.max(0, Math.min(pr, hr.right) - Math.max(pl, hr.left));
    const oy = Math.max(0, Math.min(pb, hr.bottom) - Math.max(pt, hr.top));
    return { hidden: false, hint: { w: Math.round(hr.width), h: Math.round(hr.height), bottom: Math.round(hr.bottom) }, overlapPx: Math.round(ox * oy) };
  }, panelCss);
  console.log('hint overlap:', JSON.stringify(overlap));
  if (!overlap.hidden) {
    metric('hintOverlapDialogPx', overlap.overlapPx, 'px²（DOM 提示条与对话面板重叠面积）');
    check('G3-hint-overlap', overlap.overlapPx === 0, 'DOM 提示条不遮挡对话面板', `hint=${overlap.hint.w}x${overlap.hint.h}@bottom${overlap.hint.bottom}, overlap=${overlap.overlapPx}px²`);
  } else {
    check('G3-hint-overlap', true, 'DOM 提示条不遮挡对话面板', '提示条未显示');
  }

  // 横屏
  await page.setViewportSize({ width: H, height: W });
  await sleep(1000);
  const land = await page.evaluate(() => window.__qa.info());
  const landShot = await shot(page, 's05_landscape');
  const landJoy = vpRect2Shot(land, joystickZoneVp(land));
  const landJoyRows = await page.evaluate(({ p, r }) => window.__qa.rowProfile(p, r, 90), { p: landShot, r: landJoy });
  const landJoyBright = landJoyRows.reduce((s, n) => s + n, 0);
  check('G1-landscape', Math.abs(land.canvasCss.w - H) <= 2 && land.scrollY === 0 && landJoyBright > 150, '横屏后画布铺满、无滚动、摇杆仍锚定左下角', `canvas=${land.canvasCss.w}x${land.canvasCss.h}, scrollY=${land.scrollY}, joyRingPx=${landJoyBright}`);

  // 回竖屏
  await page.setViewportSize({ width: W, height: H });
  await sleep(1000);
  const port = await page.evaluate(() => window.__qa.info());
  await shot(page, 's06_portrait_back');
  check('G2-portrait-restore', Math.abs(port.canvasCss.w - W) <= 2 && port.scrollY === 0, '回竖屏后画布恢复且无滚动', `canvas=${port.canvasCss.w}x${port.canvasCss.h}, scrollY=${port.scrollY}`);

  // 音频解锁（首次触摸早已发生）
  const audio = await page.evaluate(() => window.__qaAudio);
  console.log('audio after touch:', JSON.stringify(audio));
  const lastState = audio.states.length ? audio.states.at(-1).state : 'none';
  check('C2-audio-unlock', audio.created >= 1 && lastState === 'running' && R.consoleAutoplaySuspects.length === 0, '首次触摸后音频上下文解锁为 running、无自动播放报错', `created=${audio.created}, finalState=${lastState}, autoplayWarn=${R.consoleAutoplaySuspects.length}`);

  check('H1-console-clean', R.consoleErrors.length === 0, '全程 console 无 error', `errors=${JSON.stringify(R.consoleErrors).slice(0, 400)}`);
}

/** Pixel 7 冒烟：可加载、点按推进、console 干净、音频上下文创建。 */
async function pixelSmoke(browser) {
  const ctx = await runDevice(browser, 'Pixel 7', { full: false });
  const { page, cdp, info } = ctx;
  const W = info.inner.w, H = info.inner.h;
  await touchTap(cdp, W / 2, H * 0.55);
  await sleep(900);
  const s0 = await shot(page, 'p01_start');
  await touchTap(cdp, W / 2, H * 0.55);
  await sleep(700);
  const s1 = await shot(page, 'p02_advance');
  const d = await diffRect(page, s0, s1, dialogZoneShot(info));
  check('P1-android-smoke', d > 0.005, 'Android Chrome(UA+触屏仿真) 可启动并点按推进', `diff=${d.toFixed(3)}`);
  const audio = await page.evaluate(() => window.__qaAudio);
  check('P2-android-console', R.consoleErrors.length === 0, 'Android 冒烟 console 无 error', `errors=${R.consoleErrors.length}, audioCreated=${audio.created}`);
  await ctx.context.close();
}

async function main() {
  // SwiftShader 软件 WebGL2：headless Chromium 无 GPU，需显式放行（否则引擎门禁报缺 WebGL2）。
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  try {
    const ctx = await runDevice(browser, 'iPhone 13', { full: true });
    const flow = await iphoneFlow(ctx);
    await orientationAndAudio(flow);
    await ctx.context.close();
    if (!process.env.QA_FAST) await pixelSmoke(browser);
  } finally {
    await browser.close();
  }
  const fails = R.checks.filter((c) => !c.pass);
  R.finishedAt = new Date().toISOString();
  R.summary = { total: R.checks.length, failed: fails.length, failedIds: fails.map((f) => f.id) };
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'results.json'), JSON.stringify(R, null, 2));
  console.log(`\n===== 结果：${R.checks.length - fails.length}/${R.checks.length} 通过 =====`);
  if (fails.length) console.log('失败项:', fails.map((f) => `${f.id}(${f.detail})`).join(' | '));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error('QA 脚本异常终止:', e);
  R.notes.push('脚本异常: ' + String(e).slice(0, 500));
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'results.json'), JSON.stringify(R, null, 2));
  process.exit(2);
});
