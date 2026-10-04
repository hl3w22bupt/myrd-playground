/**
 * 渲染层（el-01..el-10 落位）。双路径：.grid 资产可用则用之，否则内建占位精灵。
 * 占位色取 manifest.style_lock 调色板（视觉值，非玩法数值；玩法数值单源仍是 constants.js）。
 * 风格卡约定：接地投影由程序绘制（K 色 50% alpha 椭圆）；反向一律水平镜像，禁旋转。
 */
import { PITCH, TEAMS, A06, MATCH_DURATION_S } from '../core/constants.js';
import { TEAM_NAMES } from './input.js';

const PAL = {
  grassLight: '#2E7D46', grassDark: '#256B3A', line: '#F4F1E8', ink: '#1A1626',
  panel: '#1A1626', panelEdge: '#2E2A44', dim: '#C9C4B4', white: '#F4F1E8',
  gold: '#E8B23A', night: '#12101E',
};

/** 水平镜像画布（缓存）。 */
const mirrorCache = new WeakMap();
function mirrored(canvas) {
  let m = mirrorCache.get(canvas);
  if (!m) {
    m = document.createElement('canvas');
    m.width = canvas.width;
    m.height = canvas.height;
    const c = m.getContext('2d');
    c.translate(canvas.width, 0);
    c.scale(-1, 1);
    c.drawImage(canvas, 0, 0);
    mirrorCache.set(canvas, m);
  }
  return m;
}

function shadow(ctx, x, y, rx, ry) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = PAL.ink;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** el-01/el-02：草皮条纹 + 边线 + 中线中点（A01 可用则铺 tile，否则占位平涂）。 */
function renderPitch(ctx, sprites) {
  const { W, H, TILE, INSET } = { W: PITCH.W, H: PITCH.H, TILE: PITCH.TILE, INSET: PITCH.INSET };
  const tiles = sprites && sprites.a01 ? sprites.a01.frames : null;
  for (let cx = 0; cx < W / TILE; cx++) {
    for (let cy = 0; cy < H / TILE; cy++) {
      const px = cx * TILE;
      const py = cy * TILE;
      if (tiles && tiles.length >= 2) {
        ctx.drawImage(tiles[(cx + cy) % 2], px, py); // 亮/暗纹交错
      } else {
        ctx.fillStyle = (cx + cy) % 2 === 0 ? PAL.grassLight : PAL.grassDark;
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }
  // el-01 边线：内缩 6px 白线矩形 (6,6)-(250,154)，1px 暖白
  ctx.fillStyle = PAL.line;
  ctx.fillRect(INSET, INSET, W - INSET * 2, 1);
  ctx.fillRect(INSET, H - INSET - 1, W - INSET * 2, 1);
  ctx.fillRect(INSET, INSET, 1, H - INSET * 2);
  ctx.fillRect(W - INSET - 1, INSET, 1, H - INSET * 2);
  // el-02 中线 + 中点
  ctx.fillRect(W / 2, INSET, 1, H - INSET * 2);
  ctx.fillRect(W / 2 - 2, H / 2 - 2, 5, 5);
  ctx.fillStyle = PAL.grassDark;
  ctx.fillRect(W / 2 - 1, H / 2 - 1, 3, 3);
}

/** el-03/el-04：球门（A05 左门朝右、右门镜像；占位 = 门柱 + 网）。 */
function renderGoals(ctx, sprites) {
  const left = sprites && sprites.a05 ? sprites.a05.frames[0] : null;
  const mouthTop = 80 - 22;
  if (left) {
    ctx.drawImage(left, 6 - 30, 80 - 12);            // 左门：开口贴门线
    ctx.drawImage(mirrored(left), 250 - 2, 80 - 12); // 右门：镜像
  } else {
    // 占位：门柱 1px + 网格
    ctx.fillStyle = PAL.line;
    ctx.fillRect(6, mouthTop, 1, 44);
    ctx.fillRect(249, mouthTop, 1, 44);
    ctx.fillStyle = PAL.dim;
    for (let y = mouthTop; y < mouthTop + 44; y += 3) {
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, y, 6, 1);
      ctx.fillRect(250, y, 6, 1);
    }
    ctx.globalAlpha = 1;
  }
}

/** el-05/06：球员（A02/A03 六帧 + A06 射门九帧；占位 = 队色块 + 朝向白点）。 */
function renderPlayers(ctx, sprites, world, frameTick) {
  world.players.forEach((p) => {
    const moving = p.vx !== 0 || p.vy !== 0;
    shadow(ctx, p.x, p.y + 7, 6, 2);
    const kit = sprites && sprites.a02 ? (p.team === 'red' ? sprites.a02.frames : sprites.a02.swapped) : null;
    const kickSheet = sprites && sprites.a06 ? (p.team === 'red' ? sprites.a06.frames : sprites.a06.swapped) : null;
    let img = null;
    if (p.kickAnimT > 0 && kickSheet) {
      const idx = Math.min(A06.frames - 1, Math.floor((A06.duration_s - p.kickAnimT) * A06.fps));
      img = kickSheet[idx];
    } else if (kit) {
      const idx = moving ? 2 + (Math.floor(frameTick / 5) % 4) : Math.floor(frameTick / 15) % 2;
      img = kit[idx];
    }
    if (img) {
      if (p.facing === -1) ctx.drawImage(mirrored(img), Math.round(p.x) - 8, Math.round(p.y) - 8);
      else ctx.drawImage(img, Math.round(p.x) - 8, Math.round(p.y) - 8);
    } else {
      // 占位精灵：16×16 队色块 + 1px 暗描边 + 朝向白点；踢球时白描边闪烁
      const c = TEAMS[p.team];
      ctx.fillStyle = c.hex;
      ctx.fillRect(Math.round(p.x) - 8, Math.round(p.y) - 8, 16, 16);
      ctx.fillStyle = c.dark;
      ctx.fillRect(Math.round(p.x) - 8, Math.round(p.y) + 6, 16, 2);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(Math.round(p.x) + p.facing * 6 - 1, Math.round(p.y) - 2, 2, 2);
      if (p.kickAnimT > 0 && Math.floor(frameTick / 3) % 2 === 0) {
        ctx.strokeStyle = PAL.white;
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(p.x) - 7.5, Math.round(p.y) - 7.5, 15, 15);
      }
    }
  });
}

/** el-07：球（A04 滚动 4 帧按滚动距离采样；占位 = 白圆 + 暗描边）。 */
function renderBall(ctx, sprites, ball) {
  shadow(ctx, ball.x, ball.y + 3, 3, 1.5);
  const frames = sprites && sprites.a04 ? sprites.a04.frames : null;
  if (frames) {
    const idx = Math.floor(ball.rollDist / 6) % 4;
    ctx.drawImage(frames[idx], Math.round(ball.x) - 4, Math.round(ball.y) - 4);
  } else {
    ctx.fillStyle = PAL.white;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.dim;
    ctx.fillRect(Math.round(ball.x) - 1, Math.round(ball.y) - 1, 2, 2);
  }
}

/** el-08：HUD 记分牌（A07 九宫格；比分 = 系统像素字体；比分 + 剩余时间）。 */
function renderHud(ctx, sprites, match) {
  const px = 104;
  const py = 6;
  const panel = sprites && sprites.a07 ? sprites.a07.frames[0] : null;
  if (panel) ctx.drawImage(panel, px, py);
  else {
    ctx.fillStyle = PAL.panel;
    ctx.fillRect(px, py, 48, 16);
    ctx.strokeStyle = PAL.panelEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, 47, 15);
  }
  ctx.textBaseline = 'top';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  const mid = px + 24;
  ctx.fillStyle = TEAMS.red.hex;
  ctx.fillText(String(match.scores.red), mid - 10, py + 1);
  ctx.fillStyle = PAL.white;
  ctx.fillText(':', mid, py + 1);
  ctx.fillStyle = TEAMS.blue.hex;
  ctx.fillText(String(match.scores.blue), mid + 10, py + 1);
  const left = Math.max(0, MATCH_DURATION_S - match.timeS);
  const mm = Math.floor(left / 60);
  const ss = Math.floor(left % 60);
  ctx.fillStyle = PAL.dim;
  ctx.fillText(`${mm}:${ss < 10 ? '0' : ''}${ss}`, mid, py + 9);
}

/** el-09：onboarding 提示条（首触后淡出由 match.onboardingAlpha 驱动）。 */
function renderOnboarding(ctx, match, text) {
  const alpha = match.onboardingAlpha();
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 12;
  const y = PITCH.H - 12;
  ctx.fillStyle = 'rgba(18,16,30,0.82)';
  ctx.fillRect(128 - w / 2, y - 7, w, 14);
  ctx.strokeStyle = PAL.panelEdge;
  ctx.strokeRect(128 - w / 2 + 0.5, y - 6.5, w - 1, 13);
  ctx.fillStyle = PAL.white;
  ctx.fillText(text, 128, y);
  ctx.restore();
}

/** el-10：进球庆祝层 / 终局面板。 */
function renderOverlays(ctx, match, frameTick) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (match.phase === 'celebration' && match.lastGoal) {
    const c = TEAMS[match.lastGoal.scorer];
    ctx.fillStyle = 'rgba(18,16,30,0.45)';
    ctx.fillRect(0, 40, PITCH.W, 48);
    ctx.font = '16px monospace';
    ctx.fillStyle = c.hex;
    ctx.fillText('GOAL!', 128, 58 + (frameTick % 12 < 6 ? 0 : 1));
    ctx.font = '8px monospace';
    ctx.fillStyle = PAL.white;
    ctx.fillText(`${TEAM_NAMES[c.id]} 得分`, 128, 76);
  }
  if (match.phase === 'fulltime') {
    ctx.fillStyle = 'rgba(18,16,30,0.75)';
    ctx.fillRect(48, 52, 160, 52);
    ctx.strokeStyle = PAL.gold;
    ctx.strokeRect(48.5, 52.5, 159, 51);
    ctx.font = '10px monospace';
    ctx.fillStyle = PAL.gold;
    ctx.fillText('FULL TIME', 128, 62);
    ctx.font = '10px monospace';
    ctx.fillStyle = TEAMS.red.hex;
    ctx.fillText(String(match.scores.red), 106, 80);
    ctx.fillStyle = PAL.white;
    ctx.fillText(':', 128, 80);
    ctx.fillStyle = TEAMS.blue.hex;
    ctx.fillText(String(match.scores.blue), 150, 80);
    ctx.font = '8px monospace';
    ctx.fillStyle = PAL.dim;
    ctx.fillText('按 R 再来一局', 128, 94);
  }
}

/** 总渲染入口。 */
export function render(ctx, match, sprites, opts) {
  const { frameTick, onboardingText, fpsText } = opts;
  ctx.imageSmoothingEnabled = false;
  renderPitch(ctx, sprites);
  renderGoals(ctx, sprites);
  renderBall(ctx, sprites, match.world.ball);
  renderPlayers(ctx, sprites, match.world, frameTick);
  renderHud(ctx, sprites, match);
  renderOnboarding(ctx, match, onboardingText);
  renderOverlays(ctx, match, frameTick);
  if (fpsText) {
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PAL.dim;
    ctx.fillText(fpsText, 3, 3);
  }
}
