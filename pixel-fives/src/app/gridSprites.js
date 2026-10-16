/**
 * .grid 精灵加载器（程序接线约定：资产真源 = assets/*.grid，动画参数以 manifest 为准）。
 *
 * 策略（占位精灵先行，不等美术）：所有资产异步加载，任何失败（file:// CORS、文件缺失、
 * 未量产）都返回 null，渲染层回退到程序内建占位精灵 —— 游戏不被美术阻塞。
 * 零依赖：fetch + OffscreenCanvas 不可用时退 document.createElement('canvas')。
 */

/** A03/A06 霜蓝版换色映射（manifest.style_lock.team_swap）。 */
const TEAM_SWAP = { r: 'b', R: 'B', x: 'y' };

/** 解析 .grid 文本 → { legend, frames }（frames = 行字符串数组）。 */
export function parseGrid(text) {
  const lines = text.split(/\r?\n/);
  const legend = {};
  const frames = [];
  let section = 'header';
  let cur = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line === 'legend:') { section = 'legend'; continue; }
    if (line === 'grid:') { section = 'grid'; continue; }
    if (section === 'legend') {
      const m = line.match(/^(\S)\s+(#[0-9A-Fa-f]{6})$/);
      if (m) legend[m[1]] = m[2];
    } else if (section === 'grid') {
      if (line === '+') { if (cur.length) frames.push(cur); cur = []; }
      else if (line.length > 0) cur.push(line);
    }
  }
  if (cur.length) frames.push(cur);
  return { legend, frames };
}

/** 单帧 → 离屏 canvas（1x 像素）。swap 可选换色（A03 派生）。 */
export function frameToCanvas(frameRows, legend, swap) {
  const h = frameRows.length;
  const w = frameRows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = frameRows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.' || ch === undefined) continue;
      const key = swap && swap[ch] ? swap[ch] : ch;
      const color = legend[key];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

/**
 * 加载一个 .grid 资产并产出帧数组（canvas[]）。
 * @param {string} url 资产路径（相对 index.html）
 * @param {{swap?:boolean}} opts swap=true 时额外产出换色帧（蓝版）
 * @returns {Promise<{frames:HTMLCanvasElement[], swapped:HTMLCanvasElement[]}|null>} 失败 → null（占位回退）
 */
export async function loadGrid(url, { swap = false } = {}) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    const text = await res.text();
    const { legend, frames } = parseGrid(text);
    if (!frames.length) return null;
    const out = {
      frames: frames.map((f) => frameToCanvas(f, legend, null)),
      swapped: swap ? frames.map((f) => frameToCanvas(f, legend, TEAM_SWAP)) : [],
    };
    return out.frames.every((c) => c.width > 0) ? out : null;
  } catch {
    return null; // file:// CORS 等场景：静默回退占位精灵
  }
}

/**
 * 装载全套精灵（A01–A06；A07 HUD 九宫格；A08 由 main.js 音频层处理）。
 * 全部可失败 —— 返回对象里任何一项都可能是 null，渲染层逐项回退占位。
 */
export async function loadAllSprites() {
  const [a01, a02, a04, a05, a06, a07] = await Promise.all([
    loadGrid('assets/a01-pitch-tileset.grid'),
    loadGrid('assets/a02-player-red.grid', { swap: true }),  // frames=红版, swapped=蓝版(A03)
    loadGrid('assets/a04-ball.grid'),
    loadGrid('assets/a05-goal-net.grid'),
    loadGrid('assets/a06-kick-shot.grid', { swap: true }),   // 射门动画 9 帧
    loadGrid('assets/a07-ui-hud.grid'),
  ]);
  return { a01, a02, a04, a05, a06, a07 };
}
