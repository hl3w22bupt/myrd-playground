// main.ts — 浏览器装配入口（wheat-squad）
//
// 纪律：内核零平台感知；本件只做 canvas/输入/rAF 装配 + debug 机读面（冒烟/契约消费）。
import { createGame, offerIfNeeded, pickUpgradeHost, upgradePickerHit, type Game } from './game.ts';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

async function boot(): Promise<void> {
  // spec 装载（浏览器面）：window.__G2WS_SPEC 由 index.html 内联注入（构建期生成）
  const g = globalThis as unknown as { __G2WS_SPEC?: unknown };
  if (!g.__G2WS_SPEC) {
    const res = await fetch('spec.json');
    g.__G2WS_SPEC = await res.json();
  }
  const game: Game = createGame(g.__G2WS_SPEC as never, canvas.width, canvas.height);

  // 输入：单指拖动（pointer 目标点）+ 点选三选一/重开
  const toLocal = (e: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = toLocal(e);
    if (game.state.choices) { upgradePickerHit(game, p.x, p.y); return; }
    if (game.state.phase === 'ended') { game.restart(); return; }
    game.pointer = p;
  });
  canvas.addEventListener('pointermove', (e) => { if (game.pointer) game.pointer = toLocal(e); });
  canvas.addEventListener('pointerup', () => { game.pointer = null; });

  // 主循环（rAF；dt 上限防螺旋——fixed-step 累计在 sim 侧）
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(100, now - last);
    last = now;
    offerIfNeeded(game);
    game.step(dt);
    game.render(ctx);
    (globalThis as unknown as { __G2WS_TICK?: number }).__G2WS_TICK = game.state.tick;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // debug 机读面（冒烟/契约消费——沿 g2-blocks __G2_READY 判例）
  const dbg = globalThis as unknown as Record<string, unknown>;
  dbg.__G2WS_READY = true;
  dbg.__G2WS_STATE = () => ({
    phase: game.state.phase,
    kills: game.state.kills,
    tick: game.state.tick,
    choices: game.state.choices,
    elapsedSec: (game.state.tick * game.state.cfg.stepMs) / 1000,
    firstKillTick: game.state.firstKillTick,
    firstUpgradeTick: game.state.firstUpgradeTick,
  });
  dbg.__G2WS_GAME = game;
  dbg.__G2WS_PICK = (i: number): boolean => {
    if (!game.state.choices) return false;
    pickUpgradeHost(game, i); // 真实选择路径（同源 game.ts#upgradePicker 面，非旁路改状态）
    return true;
  };
}

void boot();
