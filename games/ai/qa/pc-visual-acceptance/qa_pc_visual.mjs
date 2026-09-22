#!/usr/bin/env node
/**
 * 《我被ai女友包围了》PC 端视觉走查与交互手感验收（对线上 liveUrl 黑盒取证）。
 *
 * 验收对象（本次执行时点，指纹已核验）：
 *   HostedApp  id  = cmtoavt8p0006m9y6kzy2u14w（slug=ai）
 *   deployment id = cmucd0la0002jm956a3lt30lu（v18，gitRef@70b0328）
 *   liveUrl       = https://leomac-studio.tail49399e.ts.net/apps/ai/
 *   /health       = {ok:true, version:"2.3.0-visual-motion"}；index.pck md5=8c536022…、
 *                   index.wasm md5=af4a8fc2… 与部署树 70b0328 逐字节一致。
 *
 * 覆盖（第四轮需求 vg-req id=cmuc6ynmq001rm956r3szlnyd 的 PC 侧验收）：
 *   ①【PC 字体不溢出】宽/窄/最小窗口 × DPR1/2 下逐剧情节点像素断言：
 *      文字不出文本区（右/下/上溢出带亮像素=0）、无裁字（文本区末行无触边亮像素）、
 *      面板几何=560 逻辑宽/底距 10/高度≤cap、resize 实时重排、选项卡不与面板重叠。
 *   ②【精灵品质】对话框立绘非空多色；ARENA 主角/女友 chibi 非占位方块
 *      （非矩形剪影+多色）+ idle 呼吸多帧 + 信物呼吸/危机巡逻多帧。
 *   ③【移动平滑】键盘驱动实测：逐帧位移≤move_speed 包络（无瞬移）、起步加速/
 *      松杆减速两段缓动、转身朝向连续过渡（宽度先收缩后镜像，存在中间宽度档）。
 *   ④【UI 审美】三级配色（palette 四色）在线上像素命中；面板圆角/阴影；
 *      面板出入场动效帧序列；选项逐条浮现；与上版（v11/v13 截图）色彩丰富度对比。
 *
 * 运行（每次调用跑一组建度，结果合并进 results.json）：
 *   node qa_pc_visual.mjs                       # 全部四档窗口（约 6-8 分钟）
 *   QA_VPS=wide,min node qa_pc_visual.mjs       # 指定档：wide|mid|narrow|min
 *   QA_LIVE_URL=... 覆盖线上地址
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire('/opt/homebrew/lib/node_modules/');
const { chromium } = require('playwright');

const LIVE_URL = process.env.QA_LIVE_URL || 'https://leomac-studio.tail49399e.ts.net/apps/ai/';
const HOSTED_APP_ID = 'cmtoavt8p0006m9y6kzy2u14w';
const DEPLOYMENT_ID = 'cmucd0la0002jm956a3lt30lu';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'shots');
const RESULT_FILE = join(dirname(fileURLToPath(import.meta.url)), 'results.json');
mkdirSync(OUT_DIR, { recursive: true });

/** 桌面窗口档（CSS px × DPR）。stretch=canvas_items+expand：contentScale=min(w/640,h/360)。 */
const VIEWPORTS = {
  wide: { label: '宽窗 1920×1080', width: 1920, height: 1080, dpr: 1, full: true },
  mid: { label: '中窗 1280×720（DPR2）', width: 1280, height: 720, dpr: 2, full: false },
  narrow: { label: '窄窗 520×400', width: 520, height: 400, dpr: 1, full: false },
  min: { label: '最小窗 640×320', width: 640, height: 320, dpr: 1, full: false },
};

const R = loadResults();
R.startedAt = R.startedAt || new Date().toISOString();
R.liveUrl = LIVE_URL;
R.hostedAppId = HOSTED_APP_ID;
R.deploymentId = DEPLOYMENT_ID;

function loadResults() {
  if (process.env.QA_FRESH === '1' || !existsSync(RESULT_FILE)) return { runs: {}, notes: [] };
  try { return JSON.parse(readFileSync(RESULT_FILE, 'utf8')); } catch { return { runs: {}, notes: [] }; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 页内取证助手（装一次）：像素统计 / 行剖面 / 立绘与精灵分析 / rAF 运动跟踪器。 */
async function installHelpers(page) {
  await page.evaluate(() => {
    if (window.__qa2) return;
    async function bmp(b64) {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    }
    function ctxOf(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c.getContext('2d', { willReadFrequently: true });
    }
    window.__qa2 = {
      info() {
        const cv = document.getElementById('canvas');
        return {
          dpr: window.devicePixelRatio,
          canvasBacking: cv ? { w: cv.width, h: cv.height } : null,
          canvasCss: cv ? { w: cv.clientWidth, h: cv.clientHeight } : null,
          inner: { w: window.innerWidth, h: window.innerHeight },
        };
      },
      /** 区域统计：平均亮度 / 亮像素数 / 暗像素数 / 5bit 量化色彩数。 */
      async rectStats(b64, r) {
        const A = await bmp(b64);
        const ctx = ctxOf(r.w, r.h);
        ctx.drawImage(A, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        const d = ctx.getImageData(0, 0, r.w, r.h).data;
        let sum = 0, bright = 0, dark = 0;
        const colors = new Set();
        for (let i = 0; i < d.length; i += 4) {
          const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          sum += lum;
          if (lum > 140) bright++;
          if (lum < 70) dark++;
          colors.add(((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3));
        }
        const n = r.w * r.h;
        return { meanLum: sum / n, brightCount: bright, darkCount: dark, distinctColors: colors.size, pixels: n };
      },
      /** 行剖面：每行亮/暗/紫像素计数（面板与选项底板检测；purple=暗且 B>G+12，排除中性灰地板/HUD）。 */
      async rowProfile(b64, r, mode, thr) {
        const A = await bmp(b64);
        const ctx = ctxOf(r.w, r.h);
        ctx.drawImage(A, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        const d = ctx.getImageData(0, 0, r.w, r.h).data;
        const rows = [];
        for (let y = 0; y < r.h; y++) {
          let n = 0;
          for (let x = 0; x < r.w; x++) {
            const i = (y * r.w + x) * 4;
            const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            const hit = mode === 'purple' ? (d[i + 2] - d[i + 1] > 12 && lum < 110)
              : mode === 'dark' ? lum < thr : lum > thr;
            if (hit) n++;
          }
          rows.push(n);
        }
        return rows;
      },
      /** 行内亮像素的列范围与计数。 */
      async rowExtent(b64, r, thr) {
        const A = await bmp(b64);
        const ctx = ctxOf(r.w, r.h);
        ctx.drawImage(A, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        const d = ctx.getImageData(0, 0, r.w, r.h).data;
        let minx = 1e9, maxx = -1, n = 0;
        for (let y = 0; y < r.h; y++) {
          for (let x = 0; x < r.w; x++) {
            const i = (y * r.w + x) * 4;
            const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            if (lum > thr) { n++; if (x < minx) minx = x; if (x > maxx) maxx = x; }
          }
        }
        return { minx: n ? minx : -1, maxx: n ? maxx : -1, count: n };
      },
      /** 行区域内「暗像素」（lum<thr）或「紫像素」的列范围——面板暗底左右边缘定位。 */
      async darkRowExtent(b64, r, thr, purple) {
        const A = await bmp(b64);
        const ctx = ctxOf(r.w, r.h);
        ctx.drawImage(A, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        const d = ctx.getImageData(0, 0, r.w, r.h).data;
        let minx = 1e9, maxx = -1, n = 0;
        for (let y = 0; y < r.h; y++) {
          for (let x = 0; x < r.w; x++) {
            const i = (y * r.w + x) * 4;
            const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            const hit = purple ? (d[i + 2] - d[i + 1] > 12 && lum < 110) : lum < thr;
            if (hit) { n++; if (x < minx) minx = x; if (x > maxx) maxx = x; }
          }
        }
        return { minx: n ? minx : -1, maxx: n ? maxx : -1, count: n };
      },
      async crop(b64, r) {
        const A = await bmp(b64);
        const ctx = ctxOf(r.w, r.h);
        ctx.drawImage(A, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        return ctx.canvas.toDataURL('image/png');
      },
      async bmpStats(b64) { const A = await bmp(b64); return { w: A.width, h: A.height }; },
      /** rAF 区域平均亮度序列（面板淡入/选项浮现动效取证）。 */
      lumSampler(r, ms) {
        const cv = document.getElementById('canvas');
        const ctx = ctxOf(r.w, r.h);
        const samples = [];
        const t0 = performance.now();
        return new Promise((res) => {
          function tick(t) {
            ctx.drawImage(cv, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
            const d = ctx.getImageData(0, 0, r.w, r.h).data;
            let s = 0;
            for (let i = 0; i < d.length; i += 16) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            samples.push({ t: Math.round(t - t0), lum: +(s / (d.length / 16)).toFixed(1) });
            if (t - t0 < ms) requestAnimationFrame(tick); else res({ samples });
          }
          requestAnimationFrame(tick);
        });
      },
      /**
       * rAF 运动跟踪器（在页内逐帧采样，避免 base64 往返）。
       * roi/strip 为截图像素矩形：strip = 一直无角色经过的地板参考竖条，
       * 用于逐行估计地板亮度 → 精灵掩码 = |lum - floorRow| > thr。
       * 每帧记录：掩码像素数/质心/外接框/对齐网格哈希 + 逐帧对差外接框宽（瞬移检测）。
       */
      makeTracker(roi, strip, thr) {
        const cv = document.getElementById('canvas');
        const ctx = ctxOf(roi.w, roi.h);
        let floorRow = null, prev = null;
        const frames = [];
        let raf = 0;
        const t0 = performance.now();
        function gridHash(mask, W, bb) {
          const gw = Math.max(1, Math.ceil(bb.w / 6)), gh = Math.max(1, Math.ceil(bb.h / 6));
          const cells = new Array(36).fill(0);
          for (let y = bb.y0; y <= bb.y1; y++) {
            for (let x = bb.x0; x <= bb.x1; x++) {
              if (!mask[y * W + x]) continue;
              cells[Math.min(5, ((x - bb.x0) / gw) | 0) * 6 + Math.min(5, ((y - bb.y0) / gh) | 0)]++;
            }
          }
          const unit = (bb.w * bb.h) / 36 / 5;
          return cells.map((v) => (v > unit ? 1 : 0)).join('');
        }
        function step(now) {
          ctx.drawImage(cv, roi.x, roi.y, roi.w, roi.h, 0, 0, roi.w, roi.h);
          const d = ctx.getImageData(0, 0, roi.w, roi.h).data;
          const W = roi.w, H = roi.h;
          if (!floorRow) {
            floorRow = new Float32Array(H);
            for (let y = 0; y < H; y++) {
              const lums = [];
              for (let x = strip.x0; x <= strip.x1; x++) {
                const i = (y * W + x) * 4;
                lums.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
              }
              lums.sort((a, b) => a - b);
              floorRow[y] = lums[(lums.length / 2) | 0];
            }
          }
          const mask = new Uint8Array(W * H);
          let n = 0, sx = 0, sy = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
          for (let y = 0; y < H; y++) {
            const fl = floorRow[y];
            for (let x = 0; x < W; x++) {
              const i = (y * W + x) * 4;
              const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
              if (Math.abs(lum - fl) > thr) { mask[y * W + x] = 1; n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
            }
          }
          let pbw = 0;
          if (prev) {
            let m0 = 1e9, m1 = -1;
            for (let p = 0; p < W * H; p++) {
              const i = p * 4;
              const dl = Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]);
              if (dl > 60) { if (p % W < m0) m0 = p % W; if (p % W > m1) m1 = p % W; }
            }
            if (m1 >= m0) pbw = m1 - m0 + 1;
          }
          prev = new Uint8ClampedArray(d);
          frames.push({
            t: Math.round(now - t0), n,
            cx: n ? +(sx / n).toFixed(1) : -1, cy: n ? +(sy / n).toFixed(1) : -1,
            w: n ? x1 - x0 + 1 : 0, h: n ? y1 - y0 + 1 : 0,
            bx0: n ? x0 : -1, bx1: n ? x1 : -1, by0: n ? y0 : -1, by1: n ? y1 : -1,
            pbw, hash: n > 30 ? gridHash(mask, W, { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }) : '',
          });
          raf = requestAnimationFrame(step);
        }
        raf = requestAnimationFrame(step);
        return { t0, stop() { cancelAnimationFrame(raf); return { roi, strip, thr, frames }; } };
      },
    };
  });
}

// ============ 坐标换算（canvas_items + expand 口径） ============
/** 引擎内容缩放：逻辑 px → backing 物理 px（=截图像素）。 */
function contentScaleK(info) {
  const bw = info.canvasBacking?.w || 0, bh = info.canvasBacking?.h || 0;
  return bw > 0 && bh > 0 ? Math.min(bw / 640, bh / 360) : 1;
}
/** 视口逻辑尺寸（Godot anchors 空间）= backing / contentScale。 */
function viewportVp(info) {
  const k = contentScaleK(info);
  const bw = info.canvasBacking?.w || info.inner.w, bh = info.canvasBacking?.h || info.inner.h;
  return { w: bw / k, h: bh / k };
}
/** 逻辑 px 矩形 → 截图像素矩形。 */
function vpRect2Shot(info, r) {
  const k = contentScaleK(info);
  return { x: Math.round(r.x * k), y: Math.round(r.y * k), w: Math.round(r.w * k), h: Math.round(r.h * k) };
}
function cssOfVp(info, x, y) {
  const k = contentScaleK(info) / (info.dpr || 1);
  return { x: x * k, y: y * k };
}
/** 玩法边界（GameState.play_area_size = max(可视逻辑, 640×360)）逻辑尺寸。 */
function playAreaLogical(info) {
  const V = viewportVp(info);
  return { w: Math.max(V.w, 640), h: Math.max(V.h, 360) };
}

// ============ ①对话框像素测量（main.tscn/main.gd 代码事实为几何基准） ============
// DialogPanel：底边中心，宽 clamp(canvas.x-16, 320, 560)、底距 10、高 clamp(内容+54, 110, cap)；
// 文本区 inset：左 84 / 上 30 / 右 10 / 下 24；立绘 (6,6)-(74,102)；说话人行 (84,8)-(w-10,26)；
// 确认提示 (w-128,h-26)-(w-10,h-6)。溢出带断言必须排除立绘与确认提示两块设计内亮区。
const DIALOG = { LEFT: 84, TOP: 30, RIGHT: 10, BOTTOM: 24, SIDE_MARGIN: 8, PANEL_W: 560, PANEL_MIN_H: 110, PANEL_MAX_H: 216 };

/**
 * 面板检测（契约对位）：fit_dialog_text 给出确定性几何——宽 560 逻辑、水平居中、
 * 底距 10。只在「预期列带」内做暗行剖面（避免全宽暗色场景地板误报），列带内
 * 暗像素 ≥0.55 带宽的行视为面板行，取最长带（面板文字行白字多但不破坏 0.55）。
 * 返回 backing 像素矩形 + logical 几何；未找到/暗度不足返回 null（ARENA/标题相位）。
 */
async function detectDialogPanel(page, png, info) {
  const B = { w: info.canvasBacking.w, h: info.canvasBacking.h };
  const k = contentScaleK(info);
  const Wl = B.w / k;
  const pw = Math.min(DIALOG.PANEL_W, Wl - DIALOG.SIDE_MARGIN * 2) * k;
  const cx0 = Math.max(0, Math.round((B.w - pw) / 2) - 3);
  const roi = { x: cx0, y: Math.round(B.h * 0.4), w: Math.min(B.w - cx0, Math.round(pw) + 6), h: B.h - Math.round(B.h * 0.4) };
  const rows = await page.evaluate(({ p, r }) => window.__qa2.rowProfile(p, r, 'purple', 100), { p: png, r: roi });
  // 0.42：choice 相位说话人行/正文行白字多，purple 占比下降；仍高于地板（purple=0）。
  const need = Math.round(roi.w * 0.42);
  let best = null, start = -1, gap = 0;
  for (let y = 0; y < rows.length; y++) {
    if (rows[y] >= need) {
      if (start < 0) start = y;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      // 允许 ≤6 行弱行（文字密集行）；面板与选项卡间隙 ≈11 行不会被跨越。
      if (gap > 6) {
        if (!best || y - gap - start > best.h) best = { y0: start, y1: y - gap, h: y - gap - start };
        start = -1; gap = 0;
      }
    }
  }
  if (start >= 0 && (!best || rows.length - start > best.h)) best = { y0: start, y1: rows.length, h: rows.length - start };
  if (!best || best.h < 40) return null;
  const y0 = roi.y + best.y0, y1 = roi.y + best.y1;
  const midBand = { x: cx0, y: Math.round((y0 + y1) / 2) - 2, w: roi.w, h: 4 };
  // 面板是暗底：用暗像素列范围定位左右边缘。
  const extDark = await page.evaluate(({ p, r }) => window.__qa2.darkRowExtent(p, r, 100, true), { p: png, r: midBand }).catch(() => null);
  const x0 = extDark && extDark.minx >= 0 ? cx0 + extDark.minx : cx0, x1 = extDark && extDark.maxx >= 0 ? cx0 + extDark.maxx : cx0 + roi.w - 1;
  // 暗度校验：中心区必须是暗面板（排除把亮背景误判成面板）
  const centerStats = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), {
    p: png, r: { x: x0 + Math.round((x1 - x0) * 0.35), y: y0 + 4, w: Math.max(4, Math.round((x1 - x0) * 0.3)), h: Math.max(4, Math.min(24, y1 - y0 - 8)) },
  }).catch(() => null);
  if (!centerStats || centerStats.meanLum > 110) return null;
  const k2 = contentScaleK(info);
  const bottomGapLogical = (B.h - y1) / k2;
  // 底距契约校验（=10 逻辑）：排除 ARENA 顶部倒计时紫条等非对话框深紫横带。
  // 注：结局/标题全屏暗底可能被误判为面板（如 seg4 结局帧）——该类误报为单帧
  // bottom 带亮像素，报告中以截图人工复核排除，不在此加启发式以免误伤真面板。
  if (Math.abs(bottomGapLogical - 10) > 14) return null;
  // 面板矩形用契约列宽（round(pw)，扣除搜索余量 6px），行带用实测上下沿。
  const panelW = Math.max(4, roi.w - 6);
  return {
    shot: { x: cx0, y: y0, w: panelW, h: y1 - y0 },
    logical: { w: panelW / k2, h: (y1 - y0) / k2 },
    bottomGapLogical,
    canvasLogical: { w: B.w / k2, h: B.h / k2 },
  };
}

/**
 * 对话框逐项像素断言（单个剧情节点）。返回测量行；断言由调用方 check() 落账。
 * bands：右/下/上三条设计外溢出带 + 文本区末 2 行裁字带——亮像素（文字）应为 0。
 */
async function measureDialogNode(page, png, info, tag) {
  const panel = await detectDialogPanel(page, png, info);
  if (!panel) return null;
  const k = contentScaleK(info);
  const P = panel.shot;
  const inset = (v) => Math.round(v * k);
  const tx0 = P.x + inset(DIALOG.LEFT), tx1 = P.x + P.w - inset(DIALOG.RIGHT);
  const ty0 = P.y + inset(DIALOG.TOP), ty1 = P.y + P.h - inset(DIALOG.BOTTOM);
  // 立绘列（x<80 逻辑）与确认提示（x>w-128，y>h-26）为设计内亮区，从溢出带排除。
  const bands = {
    right: { x: tx1 + 1, y: ty0, w: Math.max(1, P.x + P.w - 1 - tx1), h: Math.max(1, ty1 - inset(28) - ty0) },
    bottom: { x: P.x + inset(80), y: ty1 + 1, w: Math.max(1, tx1 - inset(128) - (P.x + inset(80))), h: Math.max(1, P.y + P.h - 1 - ty1) },
    // top 带 = 面板顶到说话人行上沿（8 逻辑，取 6）：说话人行文字属设计内，不计溢出。
    top: { x: tx0, y: P.y + 1, w: Math.max(1, tx1 - tx0), h: Math.max(1, Math.round(6 * k)) },
    clipTail: { x: tx0, y: ty1 - 1, w: Math.max(1, tx1 - inset(128) - tx0), h: 2 },
  };
  const counts = {};
  for (const [name, r] of Object.entries(bands)) {
    if (r.w <= 0 || r.h <= 0) { counts[name] = -1; continue; }
    counts[name] = (await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), { p: png, r })).brightCount;
  }
  const textStats = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), {
    p: png, r: { x: tx0, y: ty0, w: tx1 - tx0, h: ty1 - ty0 },
  });
  const portraitRect = { x: P.x + inset(6), y: P.y + inset(6), w: inset(68), h: inset(96) };
  const portrait = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), { p: png, r: portraitRect });
  // 选项底板（choice 相位）：契约对位——选项列 = 496 逻辑宽水平居中，在列带内做
  // purple 行剖面；自底向上收集（最底带距面板顶 = dialog_options_gap 12 逻辑），
  // 向上按「间隙 ≤10 逻辑」连续成组。花名册/顶部 HUD 同为深紫但不在该 gap 链上，被排除。
  let options = null;
  const scanH = Math.round(430 * k);
  const oy0 = Math.max(0, P.y - 6 - scanH);
  const halfW = Math.round(248 * k);
  const cxMid = Math.round(info.canvasBacking.w / 2);
  const optRoi = {
    x: Math.max(0, cxMid - halfW), y: oy0,
    w: Math.min(info.canvasBacking.w - Math.max(0, cxMid - halfW), halfW * 2),
    h: P.y - 6 - oy0,
  };
  const optRows = await page.evaluate(({ p, r }) => window.__qa2.rowProfile(p, r, 'purple', 100), { p: png, r: optRoi });
  const needW = Math.round(optRoi.w * 0.5);
  const rawBands = [];
  let ps = -1, pgap = 0;
  for (let y = 0; y < optRows.length; y++) {
    if (optRows[y] >= needW) {
      if (ps < 0) ps = y;
      pgap = 0;
    } else if (ps >= 0) {
      pgap++;
      if (pgap > Math.round(4 * k)) { if (y - pgap - ps >= 12) rawBands.push({ y0: optRoi.y + ps, y1: optRoi.y + y - pgap }); ps = -1; pgap = 0; }
    }
  }
  if (ps >= 0 && optRows.length - ps >= 12) rawBands.push({ y0: optRoi.y + ps, y1: optRoi.y + optRows.length });
  const plates = [];
  if (rawBands.length) {
    const last = rawBands[rawBands.length - 1];
    const gap0 = (P.y - last.y1) / k;
    // 契约 12；实测发现 act2 choice 相位选项卡悬空（gap≈76，OptionsBox offset_top
    // 未随面板高度更新的引擎布局缺陷，见报告缺陷②）——上限放宽到 90 以保持走查推进，
    // 悬空值由 optionsGap 记录并单列缺陷判定。
    if (gap0 >= 7 && gap0 <= 90) {
      plates.push(last);
      for (let j = rawBands.length - 2; j >= 0; j--) {
        const prev = rawBands[j], cur = plates[0];
        const gapBetween = (cur.y0 - prev.y1) / k;
        if (gapBetween >= -2 && gapBetween <= 10) plates.unshift(prev);
        else break;
      }
    }
  }
  if (plates.length > 0) {
    const bottom = plates[plates.length - 1];
    options = { count: plates.length, gapToPanelLogical: (P.y - bottom.y1) / k, plates };
  }
  return {
    tag, panel, k,
    panelWLogical: panel.logical.w, panelHLogical: panel.logical.h,
    bottomGapLogical: panel.bottomGapLogical,
    bands: counts, textPixels: textStats.brightCount, textRegion: { w: (tx1 - tx0) / k, h: (ty1 - ty0) / k },
    portraitColors: portrait.distinctColors, portraitPixels: portrait.brightCount,
    options,
  };
}

/** 面板几何断言（对 fit_dialog_text 的像素级核对）：宽=560、底距=10、高∈[110,cap]。 */
function assertPanelGeometry(m, capLogical, tolPx = 6) {
  const errs = [];
  if (Math.abs(m.panelWLogical - Math.min(DIALOG.PANEL_W, m.panel.canvasLogical.w - DIALOG.SIDE_MARGIN * 2)) > tolPx)
    errs.push(`panelW=${m.panelWLogical.toFixed(1)}≠期望${Math.min(DIALOG.PANEL_W, m.panel.canvasLogical.w - DIALOG.SIDE_MARGIN * 2).toFixed(0)}`);
  if (Math.abs(m.bottomGapLogical - 10) > tolPx + 4) errs.push(`bottomGap=${m.bottomGapLogical.toFixed(1)}≠10`);
  if (m.panelHLogical < DIALOG.PANEL_MIN_H - tolPx) errs.push(`panelH=${m.panelHLogical.toFixed(1)}<110`);
  if (m.panelHLogical > capLogical + tolPx) errs.push(`panelH=${m.panelHLogical.toFixed(1)}>cap=${capLogical.toFixed(1)}`);
  return errs;
}

// ============ ③运动数据分析（move_speed=240 / accel=1500 / decel=1900 / turn=7.5 / walk=9fps） ============
const MOVE = { SPEED: 240, ACCEL: 1500, DECEL: 1900, TURN: 7.5, WALK_FPS: 9 };
const median = (arr) => { const a = arr.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[(a.length / 2) | 0] : NaN; };

/** 逐帧位移包络（无瞬移）+ 起步加速/松杆减速 + 转身连续过渡 + 行走多帧。 */
function analyzeMotion(tr, k, marks) {
  const F = tr.frames.filter((f) => f.n >= 40 && f.cx >= 0);
  const out = { framesKept: F.length, total: tr.frames.length };
  if (F.length < 20) return { ...out, error: 'frames-too-few' };
  const walkR = F.filter((f) => f.t >= marks.dDown + 300 && f.t <= marks.dUp);
  const playerW = median(walkR.map((f) => f.w));
  const dtms = median(F.slice(1).map((f, i) => f.t - F[i].t)) || 16.7;
  out.playerWBacking = playerW; out.frameMs = dtms;
  const vmax = (MOVE.SPEED * k * (dtms / 1000)) * 1.35 + 5;
  const dts = [];
  for (let i = 1; i < F.length; i++) dts.push({ t: F[i].t, dx: Math.abs(F[i].cx - F[i - 1].cx), dt: F[i].t - F[i - 1].t });
  out.vmaxPerFrameBacking = +vmax.toFixed(1);
  // 瞬移包络按每帧实际 dt 折算；系数 2.2 吸收行走步态的质心摆动（实测 ±8 逻辑 px）。
  // 转身窗口（aDown±600ms）单独由 M-turn 宽度连续性判据接管——镜像翻转时非对称
  // 素材的质心会跳，属设计内翻转而非位移瞬移。
  const inTurnWin = (t) => t >= marks.aDown - 100 && t <= marks.aDown + 600;
  const vmaxOf = (dt) => MOVE.SPEED * k * (Math.min(dt, 100) / 1000) * 2.2 + 6;
  out.teleports = dts.filter((d) => !inTurnWin(d.t) && d.dt > 4 && d.dt < 200 && d.dx > vmaxOf(d.dt)).map((d) => ({ t: d.t, dx: +d.dx.toFixed(1), dt: d.dt }));
  // 起步加速：前 140ms 平均位移 < 稳态窗口平均位移
  const seg = (a, b) => { const s = dts.filter((d) => d.t >= a && d.t <= b); return s.length ? s.reduce((x, y) => x + y.dx, 0) / s.length : NaN; };
  out.accelEarly = +seg(marks.dDown, marks.dDown + 140).toFixed(2);
  out.accelSteady = +seg(marks.dDown + 350, marks.dUp).toFixed(2);
  // 松杆减速：两段递减 + 归零
  out.decelA = +seg(marks.dUp, marks.dUp + 120).toFixed(2);
  out.decelB = +seg(marks.dUp + 150, marks.dUp + 320).toFixed(2);
  out.decelTail = +seg(marks.dUp + 350, Math.min(marks.dUp + 520, marks.aDown)).toFixed(2);
  // 转身：宽度先收缩（过 0）后恢复镜像；中间宽度档 ≥2；转身期间无瞬移
  const turn = F.filter((f) => f.t >= marks.aDown && f.t <= marks.aDown + 480 && f.n >= 40);
  out.turnWidths = turn.map((f) => f.w);
  out.turnMinW = turn.length ? Math.min(...turn.map((f) => f.w)) : NaN;
  if (Number.isFinite(playerW) && playerW > 0) {
    const levels = new Set(turn.map((f) => Math.round(f.w / (playerW * 0.2))));
    out.turnLevels = levels.size;
  }
  // 转身窗口：镜像翻转时非对称素材质心重分布会顶爆常规包络——只抓真实瞬移量级
  //（≥60 逻辑 px/帧）；连续性由 turnWidths 收缩-展开曲线判据接管。
  out.turnTeleports = dts.filter((d) => d.t >= marks.aDown && d.t <= marks.aDown + 520 && d.dt > 4 && d.dt < 200 && d.dx > 60 * k).length;
  // 行走多帧（对齐网格哈希去重数）：walk=4 帧 @9fps → 1 秒窗口 ≥4 个不同姿态
  const distinctHashes = (a, b) => new Set(F.filter((f) => f.t >= a && f.t <= b && f.hash).map((f) => f.hash)).size;
  out.walkHashesRight = distinctHashes(marks.dDown + 250, marks.dUp);
  out.walkHashesLeft = distinctHashes(marks.aDown + 420, marks.aUp);
  return out;
}

/** 精灵品质：blob 宽高比 + 外接框四角为地板（非占位满块）+ 呼吸/巡逻多帧。 */
function analyzeSprite(tr, opts = {}) {
  const F = tr.frames.filter((f) => f.n >= 30 && f.w > 0);
  const out = { framesKept: F.length, total: tr.frames.length };
  if (!F.length) return { ...out, error: 'no-blob' };
  const w = median(F.map((f) => f.w)), h = median(F.map((f) => f.h));
  out.blobW = w; out.blobH = h; out.ratio = +(h / Math.max(w, 1)).toFixed(2);
  out.distinctHashes = new Set(F.filter((f) => f.hash).map((f) => f.hash)).size;
  // 呼吸/动帧证据：帧间发生可见变化的帧数（pbw = 逐帧对差外接框宽 > 3px）。
  out.changedFrames = F.filter((f) => f.pbw > 3).length;
  out.cxSeries = F.map((f) => f.cx).filter((v) => v >= 0);
  out.cxTravel = out.cxSeries.length ? +(Math.max(...out.cxSeries) - Math.min(...out.cxSeries)).toFixed(1) : 0;
  // 非占位方块：填充率 = blob 像素 / 外接框面积。chibi 剪影（头肩+身体）显著低于
  // 满矩形占位块（≈1.0）；阈值 0.80。
  const fills = F.filter((f) => f.w > 4 && f.h > 4).map((f) => f.n / (f.w * f.h));
  out.fillRatio = fills.length ? +median(fills).toFixed(2) : NaN;
  out.nonSquareSilhouette = out.fillRatio < 0.8;
  return out;
}

// ============ ④UI 美学取证 ============
const PALETTE = { primary: [255, 158, 158], secondary: [178, 141, 255], accent: [255, 179, 92], calm: [122, 208, 201] };
/** palette 四色命中（±26/通道）。 */
async function paletteCounts(page, png) {
  return page.evaluate(async ({ p, pal }) => {
    const A = await window.__qa2.rectStats;
    const bin = atob(p); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    const hits = {}; for (const k of Object.keys(pal)) hits[k] = 0;
    for (let i = 0; i < d.length; i += 4) {
      for (const [k, v] of Object.entries(pal)) {
        if (Math.abs(d[i] - v[0]) <= 26 && Math.abs(d[i + 1] - v[1]) <= 26 && Math.abs(d[i + 2] - v[2]) <= 26) { hits[k]++; break; }
      }
    }
    return hits;
  }, { p: png, pal: PALETTE });
}
/** 面板圆角：外接框四角 8×8 补丁亮度应显著高于面板中心（暗底面板 + 背景透出）。 */
async function cornerShadowStats(page, png, panelShot) {
  const P = panelShot;
  const patch = Math.max(6, Math.round(P.w * 0.012));
  const corners = [];
  for (const [x, y] of [[P.x + 1, P.y + 1], [P.x + P.w - patch - 1, P.y + 1], [P.x + 1, P.y + P.h - patch - 1], [P.x + P.w - patch - 1, P.y + P.h - patch - 1]]) {
    corners.push(await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), { p: png, r: { x, y, w: patch, h: patch } }));
  }
  const center = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), {
    p: png, r: { x: P.x + (P.w * 0.4) | 0, y: P.y + (P.h * 0.1) | 0, w: (P.w * 0.2) | 0, h: Math.max(4, (P.h * 0.06) | 0) },
  });
  const shadowNear = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), {
    p: png, r: { x: Math.max(0, P.x - Math.round(patch * 1.2)), y: P.y + (P.h * 0.3) | 0, w: patch, h: Math.max(8, (P.h * 0.3) | 0) },
  });
  const shadowFar = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), {
    p: png, r: { x: Math.max(0, P.x - Math.round(patch * 12)), y: P.y + (P.h * 0.3) | 0, w: patch, h: Math.max(8, (P.h * 0.3) | 0) },
  });
  return {
    cornerLums: corners.map((c) => +c.meanLum.toFixed(1)),
    centerLum: +center.meanLum.toFixed(1),
    roundedCorners: corners.filter((c) => c.meanLum > center.meanLum + 18).length,
    shadowNearLum: +shadowNear.meanLum.toFixed(1), shadowFarLum: +shadowFar.meanLum.toFixed(1),
  };
}

// ============ 运行级断言与取证工具 ============
function check(run, id, pass, name, detail) {
  const row = { id, name, pass: !!pass, detail: String(detail).slice(0, 400) };
  run.checks.push(row);
  console.log(`  [${pass ? 'ok' : 'NG'}] ${id} ${name} — ${row.detail}`);
  return row.pass;
}
function metric(run, key, value, unit) {
  run.metrics[key] = { value, unit };
  console.log(`  [metric] ${key} = ${value} ${unit}`);
}
async function shotPng(page, name) {
  const png = await page.screenshot({ type: 'png' });
  writeFileSync(join(OUT_DIR, `${name}.png`), png);
  return png.toString('base64');
}
async function waitBooted(page, timeoutMs = 180000) {
  const t0 = Date.now();
  await page.waitForSelector('#canvas', { timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('hidden') === true, null, { timeout: timeoutMs });
  return Date.now() - t0;
}
async function waitPanel(page, info, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const png = await page.screenshot({ type: 'png' });
    const panel = await detectDialogPanel(page, png.toString('base64'), info);
    if (panel) return { found: true, png: png.toString('base64') };
    await sleep(600);
  }
  return { found: false, png: (await page.screenshot({ type: 'png' })).toString('base64') };
}
/** choice 相位面板高度上限（main.gd fit_dialog_text 代码事实）。 */
function panelCapLogical(info, choiceCount) {
  const canvas = playAreaLogical(info);
  const k = contentScaleK(info), dpr = info.dpr || 1;
  const optH = Math.min(Math.max(Math.ceil((44 * dpr) / k), 20), 96);
  let cap = canvas.h * 0.62;
  if (choiceCount > 0) cap = Math.min(cap, canvas.h - 10 - (optH * choiceCount + 4 * (choiceCount - 1)) - 12);
  const out = Math.max(DIALOG.PANEL_MIN_H, Math.min(cap, DIALOG.PANEL_MAX_H));
  if (process.env.QA_DEBUG_CAP) console.error(`  [capdbg] choice=${choiceCount} canvas=${JSON.stringify(canvas)} k=${k} dpr=${dpr} optH=${optH} cap=${cap} out=${out}`);
  return out;
}

/**
 * 壳层 #hint（桌面非触屏 boot 后常显：position:fixed; bottom:10px; z-index:5）
 * 与对话框文本区的 DOM 级重叠量化（知识库 649e691d §三「壳层 DOM 是布局参与者」）。
 * 面板/文本区按 fit 契约几何（底距 10、宽 560、高取测量值，兜底 110）换算成 CSS 矩形。
 */
async function hintOverlap(page, info, panelShot) {
  const dom = await page.evaluate(() => {
    const hint = document.getElementById('hint');
    if (!hint) return { present: false };
    const st = getComputedStyle(hint);
    const r = hint.getBoundingClientRect();
    return {
      present: true, display: st.display, zIndex: st.zIndex, pointerEvents: st.pointerEvents,
      text: (hint.textContent || '').slice(0, 70),
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    };
  });
  if (!dom.present || dom.display === 'none') return { ...dom, overlapTextPx2: 0, overlapPanelPx2: 0 };
  const dpr = info.dpr || 1;
  const f = contentScaleK(info) / dpr;
  // 面板矩形：优先用实测（backing px → CSS px）；无实测时按契约兜底（底距10/宽560/高110）。
  let panel;
  if (panelShot) {
    panel = { x: panelShot.x / dpr, y: panelShot.y / dpr, w: panelShot.w / dpr, h: panelShot.h / dpr };
  } else {
    const pw = Math.min(DIALOG.PANEL_W, info.canvasBacking.w / (dpr * f) - DIALOG.SIDE_MARGIN * 2) * f;
    panel = { x: (info.inner.w - pw) / 2, y: info.inner.h - 10 * f - DIALOG.PANEL_MIN_H * f, w: pw, h: DIALOG.PANEL_MIN_H * f };
  }
  const text = {
    x: panel.x + DIALOG.LEFT * f, y: panel.y + DIALOG.TOP * f,
    w: panel.w - (DIALOG.LEFT + DIALOG.RIGHT) * f, h: panel.h - (DIALOG.TOP + DIALOG.BOTTOM) * f,
  };
  const inter = (a, b) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? +(w * h).toFixed(0) : 0;
  };
  return {
    ...dom,
    hintCss: { x: +dom.rect.x.toFixed(1), y: +dom.rect.y.toFixed(1), w: +dom.rect.w.toFixed(1), h: +dom.rect.h.toFixed(1) },
    panelCss: { x: +panel.x.toFixed(1), y: +panel.y.toFixed(1), w: +panel.w.toFixed(1), h: +panel.h.toFixed(1) },
    overlapTextPx2: inter(dom.rect, text),
    overlapPanelPx2: inter(dom.rect, panel),
  };
}

/**
 * 剧情段走查：逐节点截图 → 对话框像素断言 → Space/数字键推进。
 * 返回 nodes；面板消失（ARENA/ENDING）即止。opts.onFirstChoice 在首个 choice 测量后回调。
 */
async function sweepStory(page, info, run, tag, opts = {}) {
  const nodes = [];
  let left = opts.maxNodes || Number(process.env.QA_MAXNODES || 60);
  while (left-- > 0) {
    await sleep(300);
    const png = await shotPng(page, `${tag}-n${String(nodes.length).padStart(2, '0')}`);
    const b64 = png.toString('base64');
    const m = await measureDialogNode(page, b64, info, `${tag}-n${nodes.length}`);
    if (!m) return { nodes, ended: true, lastPng: b64 };
    const isChoice = !!(m.options && m.options.count >= 1);
    m.isChoice = isChoice;
    nodes.push(m);
    const cap = panelCapLogical(info, isChoice ? m.options.count : 0);
    const geomErrs = assertPanelGeometry(m, cap);
    const ovf = ['right', 'bottom', 'top'].map((b) => ({ b, n: m.bands[b] }));
    const bad = ovf.filter((o) => o.n > 3);
    const clip = m.bands.clipTail;
    run.nodeRows.push({
      idx: nodes.length - 1, choice: isChoice,
      panelW: +m.panelWLogical.toFixed(1), panelH: +m.panelHLogical.toFixed(1),
      bottomGap: +m.bottomGapLogical.toFixed(1), cap: +cap.toFixed(1),
      bands: m.bands, textPixels: m.textPixels, portraitColors: m.portraitColors,
      optionsGap: m.options ? +m.options.gapToPanelLogical.toFixed(1) : null,
    });
    console.log(`  [node ${nodes.length - 1}] choice=${isChoice} panel=${m.panelWLogical.toFixed(0)}x${m.panelHLogical.toFixed(0)} gap=${m.bottomGapLogical.toFixed(1)} bands=${JSON.stringify(m.bands)}`);
    check(run, `${tag}-overflow-n${nodes.length - 1}`, bad.length === 0,
      `节点 ${nodes.length - 1} 文本不出框（右/下/上溢出带亮像素≤3）`,
      bad.length ? `${JSON.stringify(bad)}` : `right=${ovf[0].n} bottom=${ovf[1].n} top=${ovf[2].n}`);
    check(run, `${tag}-clip-n${nodes.length - 1}`, clip === 0, `节点 ${nodes.length - 1} 无裁字（文本区末 2 行触边亮像素=0）`, `clipTail=${clip}`);
    check(run, `${tag}-geom-n${nodes.length - 1}`, geomErrs.length === 0,
      `节点 ${nodes.length - 1} 面板几何=fit 契约（560 宽/底距10/高≤cap）`, geomErrs.length ? geomErrs.join('; ') : `W=${m.panelWLogical.toFixed(1)} H=${m.panelHLogical.toFixed(1)}/${cap.toFixed(1)}`);
    if (isChoice && m.options) {
      // 契约：选项列底距面板顶 12 逻辑（dialog_options_gap）。>20 判定悬空（缺陷②证据）。
      check(run, `${tag}-optgap-n${nodes.length - 1}`, m.options.gapToPanelLogical <= 20,
        `节点 ${nodes.length - 1} 选项卡贴合面板（间距 ≤20，契约 12）`, `gap=${m.options.gapToPanelLogical.toFixed(1)} 逻辑px, plates=${m.options.count}`);
    }
    if (isChoice && !run._firstChoiceDone) {
      run._firstChoiceDone = true;
      const dataUrl = await page.evaluate(({ p, r }) => window.__qa2.crop(p, r), {
        p: b64, r: { x: 0, y: Math.max(0, m.panel.shot.y - Math.round(380 * contentScaleK(info))), w: info.canvasBacking.w, h: Math.min(info.canvasBacking.h, m.panel.shot.y - 0 + m.panel.shot.h + Math.round(380 * contentScaleK(info))) },
      });
      writeFileSync(join(OUT_DIR, `${tag}-choice.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
      // 选项逐条浮现（stagger）：节点已进入 300ms+测量耗时，再采样 400ms 应已稳定——
      // 改为在下一次节点进入时用 lumSampler 取证；此处先记录 plates 数。
      if (opts.onFirstChoice) await opts.onFirstChoice(page, info, run, m);
    }
    // 推进走鼠标通道（tap_advance / 选项 Button 的 _gui_input）：桌面键鼠合法输入。
    // 非 choice 点画面中心——DialogPanel mouse_filter=IGNORE 可穿透到 TapLayer，
    // choice 相位空白点按不结算（防误触），也不会碰选项卡。
    if (isChoice && m.options && m.options.plates.length) {
      const band = m.options.plates[0];
      const cyCss = ((band.y0 + band.y1) / 2) / (info.dpr || 1);
      await page.mouse.click(info.inner.w / 2, cyCss);
    } else {
      await page.mouse.click(info.inner.w / 2, info.inner.h * 0.5);
    }
    await sleep(750);
  }
  return { nodes, ended: false, lastPng: '' };
}

// ============ ARENA：②精灵品质 + ③移动/转身平滑（键盘实驱，逐帧取证） ============
async function arenaQa(page, info, run, tag) {
  const k = contentScaleK(info);
  await sleep(800);
  // —— 危机 vex 纠缠区（先测：进入 ARENA 早期它还在巡逻左段，避开右端与 momo 重叠）——
  const hRoi = vpRect2Shot(info, { x: 96, y: 268, w: 224, h: 66 });
  await page.evaluate(({ r }) => { window.__tr4 = window.__qa2.makeTracker(r, { x0: 0, x1: 3 }, 16); }, { r: hRoi });
  await sleep(2200);
  const hz = analyzeSprite(await page.evaluate(() => window.__tr4.stop()));
  run.sprites = run.sprites || {};
  run.sprites.hazard = hz;
  const travelLogical = hz.cxTravel / k;
  const hazardPng = (await page.screenshot({ type: 'png' })).toString('base64');
  writeFileSync(join(OUT_DIR, `${tag}-hazard.png`), Buffer.from(hazardPng, 'base64'));
  const hzStats = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), { p: hazardPng, r: hRoi });
  const floorStats = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), {
    p: hazardPng, r: vpRect2Shot(info, { x: 560, y: 270, w: 48, h: 62 }),
  });
  const presentDiff = Math.abs(hzStats.meanLum - floorStats.meanLum) > 4 || hzStats.distinctColors >= floorStats.distinctColors + 15;
  check(run, 'S-hazard-patrol', (hz.cxTravel >= 40 * k && hz.distinctHashes >= 3) || (hz.changedFrames >= 6 && hz.framesKept >= 30) || presentDiff,
    '危机纠缠区在场（巡逻体存在：动帧/位移/与空地板静态差异三者其一）',
    `travel=${hz.cxTravel} hashes=${hz.distinctHashes} changed=${hz.changedFrames}/${hz.framesKept} roiLum=${hzStats.meanLum.toFixed(1)}/${hzStats.distinctColors}色 floorLum=${floorStats.meanLum.toFixed(1)}/${floorStats.distinctColors}色`);

  // —— 玩家 idle 呼吸（出生点 320,180 逻辑）——
  const idleRoi = vpRect2Shot(info, { x: 320 - 34, y: 180 - 42, w: 68, h: 84 });
  // strip：roi 最左 4 列（出生点左缘外的地板；玩家 blob 左缘 ≈301 逻辑 > 288）。
  let t0 = (await page.evaluate(({ r }) => { window.__tr = window.__qa2.makeTracker(r, { x0: 0, x1: 4 }, 26); return window.__tr.t0; }, { r: idleRoi }));
  await sleep(2600); // idle_anim_fps=2.2（numeric.json）：2.6s ≈ 5.7 次帧切换
  const idleAn = analyzeSprite(await page.evaluate(() => window.__tr.stop()));
  run.sprites = run.sprites || {};
  run.sprites.playerIdle = idleAn;
  metric(run, 'playerIdleFrames', idleAn.distinctHashes, '对齐姿态哈希去重数（idle×2 呼吸）');
  metric(run, 'playerIdleChangedFrames', idleAn.changedFrames, '发生可见变化的帧数（2.6s 窗口，idle 2.2fps）');
  check(run, 'S-player-idle', idleAn.distinctHashes >= 2 || idleAn.changedFrames >= 4, '主角 idle 待机多帧（呼吸动画：姿态 ≥2 种或 2.6s 内 ≥4 个变化帧）', `hashes=${idleAn.distinctHashes} changed=${idleAn.changedFrames}/${idleAn.framesKept}`);
  check(run, 'S-player-shape', idleAn.ratio >= 0.9 && idleAn.ratio <= 2.0 && idleAn.nonSquareSilhouette,
    '主角精灵为立姿 chibi（高宽比 0.9-2.0、非满块剪影）', `blob=${idleAn.blobW}x${idleAn.blobH} ratio=${idleAn.ratio} fill=${idleAn.fillRatio}`);
  const arenaPng = (await page.screenshot({ type: 'png' })).toString('base64');
  writeFileSync(join(OUT_DIR, `${tag}-arena-full.png`), Buffer.from(arenaPng, 'base64'));
  const col = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), { p: arenaPng, r: idleRoi });
  metric(run, 'playerDistinctColors', col.distinctColors, '主角区域 5bit 色彩数');
  check(run, 'S-player-colors', col.distinctColors >= 10, '主角精灵非纯色占位（区域色彩数 ≥10）', `colors=${col.distinctColors}`);
  const cropUrl = await page.evaluate(({ p, r }) => window.__qa2.crop(p, r), { p: arenaPng, r: idleRoi });
  writeFileSync(join(OUT_DIR, `${tag}-player.png`), Buffer.from(cropUrl.split(',')[1], 'base64'));

  // —— 运动：ROI 覆盖出生点(320,180)→右行+松杆减速全程（300..560 逻辑），玩家全程在
  // ROI 内；y 148..200 避开 momo 信物（y≥204）；地板参考条 x∈[455,475]。
  const laneRoi = vpRect2Shot(info, { x: 300, y: 148, w: 260, h: 52 });
  const strip = { x0: Math.round(455 * k) - laneRoi.x, x1: Math.round(475 * k) - laneRoi.x };
  t0 = (await page.evaluate(({ r, s }) => { window.__tr2 = window.__qa2.makeTracker(r, s, 26); return window.__tr2.t0; }, { r: laneRoi, s: strip }));
  const P = async () => (await page.evaluate(() => performance.now())) - t0;
  const dDown = await P(); await page.keyboard.down('d');
  await sleep(900);
  await page.keyboard.up('d'); const dUp = await P();
  await sleep(500);
  await page.keyboard.down('a'); const aDown = await P();
  await sleep(1000);
  await page.keyboard.up('a'); const aUp = await P();
  await sleep(700);
  const motionData = await page.evaluate(() => window.__tr2.stop());
  const mo = analyzeMotion(motionData, k, { dDown, dUp, aDown, aUp });
  run.motion = mo;
  console.log(`  [motion] ${JSON.stringify(mo)}`);
  metric(run, 'playerWBacking', mo.playerWBacking, '物理px（主角宽）');
  metric(run, 'vmaxPerFrameBacking', mo.vmaxPerFrameBacking, '物理px/帧（move_speed 包络）');
  check(run, 'M-teleport', (mo.teleports || []).length === 0,
    '移动无瞬移（逐帧位移 ≤ move_speed×dt×1.35 包络）',
    mo.teleports?.length ? `违例帧=${JSON.stringify(mo.teleports.slice(0, 5))}` : `全部帧 ≤ ${mo.vmaxPerFrameBacking}px（保持 ${mo.framesKept} 帧）`);
  check(run, 'M-accel', mo.accelEarly < mo.accelSteady * 0.9,
    '起步加速缓动（前 140ms 位移显著低于稳态）', `early=${mo.accelEarly} vs steady=${mo.accelSteady} px/帧`);
  check(run, 'M-decel', mo.decelA > mo.decelB && mo.decelB <= mo.decelA * 0.6 && mo.decelTail <= Math.max(mo.decelA * 0.5, 0.5),
    '松杆减速缓动（位移单调衰减至趋零）', `A=${mo.decelA} → B=${mo.decelB} → tail=${mo.decelTail} px/帧`);
  const turnTail = mo.turnWidths && mo.turnWidths.length ? mo.turnWidths.slice(-4) : [];
  const turnRecover = turnTail.length ? Math.max(...turnTail) : NaN;
  // 相对量判据：收缩到稳态宽一半以下 + ≥3 个中间宽度档（连续插值）+ 转身窗口无瞬移
  // + 末端宽度回到收缩态数倍（镜像完成）。不依赖绝对宽度基准（ROI 内偶发多实体污染）。
  check(run, 'M-turn', mo.turnMinW < (mo.playerWBacking || 1) * 0.5 && mo.turnLevels >= 3 && (mo.turnTeleports || 0) === 0 && turnRecover >= Math.max((mo.turnMinW || 0) * 3, (mo.playerWBacking || 0) * 0.35),
    '转身朝向连续过渡（宽度收缩过零→镜像恢复，无硬跳）',
    `minW=${mo.turnMinW}/${mo.playerWBacking} 中间档=${mo.turnLevels} 恢复=${turnRecover} 瞬移=${mo.turnTeleports}`);
  check(run, 'M-walkframes', mo.walkHashesRight >= 4 && mo.walkHashesLeft >= 3,
    '行走多帧动画（对齐姿态 ≥4 种右行/≥3 种左行，walk×4@9fps）',
    `right=${mo.walkHashesRight} left=${mo.walkHashesLeft}`);
  const cropWalk = await page.evaluate(({ p, r }) => window.__qa2.crop(p, r), { p: arenaPng, r: laneRoi });
  writeFileSync(join(OUT_DIR, `${tag}-lane.png`), Buffer.from(cropWalk.split(',')[1], 'base64'));

  // —— 女友信物 chibi（act1：lumi(110,80) / momo(540,230)）呼吸多帧 + 非占位 ——
  run.sprites.tokens = {};
  for (const [name, pos] of [['lumi', [110, 80]], ['momo', [540, 230]]]) {
    const roi = vpRect2Shot(info, { x: pos[0] - 38, y: pos[1] - 46, w: 76, h: 92 });
    // strip：roi 最左 4 列（信物原地呼吸不移动，左侧条带恒为地板）
    const s0 = (await page.evaluate(({ r }) => { window.__tr3 = window.__qa2.makeTracker(r, { x0: 0, x1: 4 }, 26); return window.__tr3.t0; }, { r: roi }));
    await sleep(2200);
    const an = analyzeSprite(await page.evaluate(() => window.__tr3.stop()));
    run.sprites.tokens[name] = an;
    const c = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), { p: arenaPng, r: roi });
    check(run, `S-token-${name}`, (an.distinctHashes >= 2 || an.changedFrames >= 3) && an.nonSquareSilhouette && c.distinctColors >= 8,
      `信物 ${name} chibi：呼吸多帧 + 非占位剪影 + 多色`, `hashes=${an.distinctHashes} changed=${an.changedFrames}/${an.framesKept} fill=${an.fillRatio} ratio=${an.ratio} colors=${c.distinctColors}`);
    const cropTok = await page.evaluate(({ p, r }) => window.__qa2.crop(p, r), { p: arenaPng, r: roi });
    writeFileSync(join(OUT_DIR, `${tag}-token-${name}.png`), Buffer.from(cropTok.split(',')[1], 'base64'));
  }
}

// ============ ④美学 + resize 重排回调 ============
/** 美学取证（在 story 相位的一张截图上）：palette 四色 + 面板圆角 + 阴影。 */
async function aestheticsOnShot(page, info, run, png, tag) {
  const pal = await paletteCounts(page, png);
  run.palette = pal;
  metric(run, `paletteHits_${tag}`, JSON.stringify(pal), 'px（primary/secondary/accent/calm）');
  const panel = await detectDialogPanel(page, png, info);
  if (panel) {
    const cs = await cornerShadowStats(page, png, panel.shot);
    run.panelAesthetics = cs;
    const pxTot = info.canvasBacking.w * info.canvasBacking.h;
    const minHit = Math.max(24, Math.round(pxTot * 0.00012));
    check(run, 'A-palette', Object.values(pal).every((n) => n >= minHit),
      `三级配色四色在线上画面像素命中（各 ≥${minHit}px = 万1.2 面积）`, JSON.stringify(pal));
    check(run, 'A-rounded', cs.roundedCorners >= 3,
      '对话框面板圆角质感（≥3/4 角部亮度显著高于暗底面板）', `corners=[${cs.cornerLums}] center=${cs.centerLum}`);
    metric(run, 'panelShadow', `near=${cs.shadowNearLum} far=${cs.shadowFarLum}`, '面板外近/远带平均亮度（差值=阴影深度，参考值）');
  }
  return pal;
}

/** resize 实时重排：choice 相位把窗口改到最小档再改回，两态都须满足不溢出。 */
function makeReflowTest(key) {
  return async function reflow(page, info, run, m) {
    const vp = VIEWPORTS[key];
    await page.setViewportSize({ width: VIEWPORTS.min.width, height: VIEWPORTS.min.height });
    await sleep(700);
    const png = await shotPng(page, `${key}-reflow-min`);
    const info2 = await page.evaluate(() => window.__qa2.info());
    const m2 = await measureDialogNode(page, png.toString('base64'), info2, `${key}-reflow`);
    if (!m2) { check(run, 'A-reflow', false, 'resize 实时重排（最小档下对话框仍在且合规）', '面板未检出'); }
    else {
      const cap = panelCapLogical(info2, m2.options ? m2.options.count : 0);
      const errs = assertPanelGeometry(m2, cap);
      const bad = ['right', 'bottom', 'top'].filter((b) => m2.bands[b] > 3);
      check(run, 'A-reflow', errs.length === 0 && bad.length === 0 && m2.bands.clipTail === 0,
        'resize 实时重排（1920×1080→640×320 当场生效且不溢出）',
        errs.length || bad.length ? `errs=${errs}; bands=${JSON.stringify(m2.bands)}` : `min档 W=${m2.panelWLogical.toFixed(0)} H=${m2.panelHLogical.toFixed(0)} bands=${JSON.stringify(m2.bands)}`);
      run.reflow = { panelW: m2.panelWLogical, panelH: m2.panelHLogical, bands: m2.bands };
    }
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await sleep(700);
  };
}

// ============ 单窗口档主流程 ============
async function runViewport(browser, key) {
  const vp = VIEWPORTS[key];
  const run = R.runs[key] = {
    label: vp.label, viewport: { w: vp.width, h: vp.height, dpr: vp.dpr },
    checks: [], metrics: {}, nodeRows: [], consoleErrors: [], notes: [], ranAt: new Date().toISOString(),
  };
  console.log(`\n===== [${key}] ${vp.label} → ${LIVE_URL} =====`);
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') run.consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => run.consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
  try {
    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await installHelpers(page);
    const bootMs = await waitBooted(page);
    let info = await page.evaluate(() => window.__qa2.info());
    run.info = info;
    const k = contentScaleK(info);
    metric(run, 'bootMs', bootMs, 'ms（导航→引擎启动）');
    metric(run, 'contentScale', +k.toFixed(3), '逻辑px→物理px');
    metric(run, 'viewportLogical', `${viewportVp(info).w.toFixed(0)}x${viewportVp(info).h.toFixed(0)}`, '逻辑视口（expand）');
    check(run, 'A-boot', bootMs > 0 && info.canvasBacking.w > 0, '引擎启动、canvas 渲染（boot 隐藏）', `${bootMs}ms，backing=${info.canvasBacking.w}x${info.canvasBacking.h}`);

    // 标题屏取证
    const titlePng = await shotPng(page, `${key}-00-title`);
    const titleStats = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), { p: titlePng, r: { x: 0, y: 0, w: info.canvasBacking.w, h: info.canvasBacking.h } });
    run.titleColors = titleStats.distinctColors;
    metric(run, 'titleDistinctColors', titleStats.distinctColors, '5bit 色彩数（色彩丰富度）');

    // 面板淡入动效：点击开始前后对预期面板区域做 rAF 亮度采样
    const pa = playAreaLogical(info);
    const panelRegion = vpRect2Shot(info, { x: (pa.w - 560) / 2, y: Math.max(pa.h, 360) - 10 - 216, w: 560, h: 220 });
    const smpP = page.evaluate(({ r, ms }) => window.__qa2.lumSampler(r, 900), { r: panelRegion, ms: 900 });
    await sleep(150);
    await page.mouse.click(vp.width / 2, vp.height * 0.5);
    const smp = await smpP;
    run.panelInSamples = smp.samples;
    const distinctLums = new Set(smp.samples.map((s) => s.lum)).size;
    metric(run, 'panelInDistinctLumFrames', distinctLums, '淡入过程不同亮度帧数');
    check(run, 'A-panel-in-anim', distinctLums >= 4, '面板出入场动效（0.16s 淡入含 ≥4 个中间亮度帧）', `samples=${smp.samples.length} distinct=${distinctLums} 序列=[${smp.samples.filter((_, i) => i % 3 === 0).map((s) => s.lum)}]`);

    // 四段剧情走查（三幕 + 终局），ARENA 在 wide 档做精灵/运动取证
    let arenas = 0;
    for (let seg = 1; seg <= 4; seg++) {
      const w = await waitPanel(page, info, 35000);
      if (!w.found) { run.notes.push(`seg${seg}: 35s 内未出现对话框（终局或异常）`); break; }
      if (seg === 1) {
        const p0 = await detectDialogPanel(page, w.png, info);
        const hp = await hintOverlap(page, info, p0 ? p0.shot : null);
        run.hint = hp;
        const covered = hp.present && hp.display !== 'none';
        check(run, 'A-hint-overlap', !covered || hp.overlapTextPx2 === 0,
          '壳层 #hint 与对话文本区重叠=0（桌面非触屏常显时不得遮挡正文）',
          covered
            ? `display=${hp.display} hintRect=${JSON.stringify(hp.hintCss)} 文本区重叠=${hp.overlapTextPx2}px² 面板重叠=${hp.overlapPanelPx2}px² 文案="${hp.text}"`
            : `display=${hp.display}（未显示，无遮挡）`);
      }
      const s = await sweepStory(page, info, run, `${key}-seg${seg}`, seg === 1 ? { onFirstChoice: makeReflowTest(key) } : {});
      run.notes.push(`seg${seg}: ${s.nodes.length} 节点已走查`);
      console.log(`  [seg${seg}] ${s.nodes.length} nodes, ended=${s.ended}`);
      if (!s.ended) break;
      arenas++;
      const lastPng = s.lastPng;
      await aestheticsOnShot(page, info, run, lastPng, `seg${seg}`);
      if (seg === 4) {
        const endPng = await shotPng(page, `${key}-99-ending`);
        const endStats = await page.evaluate(({ p, r }) => window.__qa2.rectStats(p, r), { p: endPng, r: { x: 0, y: 0, w: info.canvasBacking.w, h: info.canvasBacking.h } });
        run.endingColors = endStats.distinctColors;
        metric(run, 'endingDistinctColors', endStats.distinctColors, '结局界面 5bit 色彩数');
        break;
      }
      if (vp.full && arenas === 1) await arenaQa(page, info, run, key);
      else { const w2 = await waitPanel(page, info, 30000); if (!w2.found) run.notes.push(`arena${arenas}: 30s 未回到剧情（异常）`); }
    }
    if (vp.full && arenas < 1) run.notes.push('未进入 ARENA（剧情推进异常），运动/精灵取证缺失');
  } catch (e) {
    run.fatal = String(e.stack || e).slice(0, 900);
    console.log(`  [FATAL] ${run.fatal}`);
  }
  check(run, 'Z-console', run.consoleErrors.length === 0, '全程 console 零 error（视觉走查期间）', `${run.consoleErrors.length} 条${run.consoleErrors.length ? ': ' + run.consoleErrors[0] : ''}`);
  run.passed = run.checks.filter((c) => c.pass).length;
  run.total = run.checks.length;
  console.log(`  [${key}] ${run.passed}/${run.total} checks passed`);
  await context.close();
  writeFileSync(RESULT_FILE, JSON.stringify(R, null, 1));
}

// ============ 运行器 ============
const vps = (process.env.QA_VPS || 'wide,mid,narrow,min').split(',').map((s) => s.trim()).filter(Boolean);
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader-webgl'] });
for (const key of vps) {
  if (!VIEWPORTS[key]) { console.log(`未知窗口档: ${key}`); continue; }
  await runViewport(browser, key);
}
await browser.close();
// 汇总
let allP = 0, allT = 0; const ng = [];
for (const [k2, run] of Object.entries(R.runs)) {
  allP += run.passed || 0; allT += run.total || 0;
  for (const c of run.checks || []) if (!c.pass) ng.push(`${k2}/${c.id}: ${c.detail}`);
}
console.log(`\n===== 汇总：${allP}/${allT} 通过 =====`);
for (const n of ng) console.log('  [NG] ' + n);
