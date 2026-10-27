const __L4_BUILD__ = { gitSha: "1b101a45e49c02d60d67e4be11c693a0dc37ae12", specAnchor: "cmvlrc0ma001tm94ialxeykjn@v2:approved" };
// main.ts — web 可玩面装配入口（line4-unblock-jam · 表现层，审查通过版落地 2026-10-26）
//
// 装配面：DOM 骨架（canvas + HUD）→ 关卡谱系链（level-1 教学 → level-2 红轮首现 → level-proc-gen
// 日种子谱系）→ rAF 固定步循环（内核 fixed-step 16ms；时钟源=performance.now，F4 定死口径）。
// 判据面：g-01 三步（首次拖动→首次驶出→通关，60s 窗口=numeric.firstGuideWindowSec）；
// 埋点只走 telemetry hub 单一出口（acc-07）；三通道反馈预算按 assets.md §四（render.ts 执行）。
import { NUMERIC, SPEC_ANCHOR } from './generated/spec-data.mjs';
import { PALETTE } from './platform/theme.mjs'; // 色值单源（spec world.styleDerivation：渲染层只读 token，acc-05 断言⑤）
import { createTelemetryHub } from './telemetry/telemetry.mjs';
import { createHudModel, pushFrame, renderHud } from './dev/hud.mjs';
import { createSession, start, step } from './kernel/loop.mjs';
import { pendingDrag, cancelPending } from './kernel/session.mjs';
import { createGame, applyDrag, counters, resolveRedRound, shouldEnterRed,           } from './web/game.mjs';
import { createFx, draw, spawnBurst, spawnPop, resetLevelFx,           } from './web/render.mjs';
import { createDrag, pickCar, dragDelta, releaseDrag } from './web/input.mjs';
import { createSfx } from './web/sfx.mjs';

                                                                   

// —— 会话层日种子（level-proc-gen/el-daily-seed：DEFAULT_SEED ⊕ UTC 日期数；内核零时钟纪律不破） ——
const dailySeed = ()         => NUMERIC.DEFAULT_SEED ^ Math.floor(Date.now() / 86_400_000);

                                                                              
const roundAt = (k        )        => {
  if (k === 0) return { seed: NUMERIC.DEFAULT_SEED, levelId: 'level-1', name: '首挪（教学关）', red: false };
  if (k === 1) return { seed: NUMERIC.DEFAULT_SEED + 2, levelId: 'level-2', name: '标准局 + 红轮首现', red: false };
  return { seed: dailySeed() + k, levelId: 'level-proc-gen', name: `谱系关 · 第 ${k - 1} 局`, red: false };
};

function boot()       {
  const canvas = document.createElement('canvas');
  const hudEl = document.createElement('pre');
  const topEl = document.createElement('div');
  document.body.append(canvas, topEl, hudEl);
  const style = document.createElement('style');
  style.textContent = `html,body{margin:0;height:100%;background:${PALETTE.ground};overflow:hidden;touch-action:none}
canvas{display:block}#l4-top{position:fixed;top:8px;left:12px;font:600 15px system-ui;color:${PALETTE.ink}}
#l4-hud{position:fixed;right:8px;bottom:8px;margin:0;font:11px/1.5 ui-monospace,monospace;color:${PALETTE.ink};
opacity:.85;background:${PALETTE.ground}cc;padding:6px 8px;border-radius:6px;white-space:pre;text-align:left}`;
  document.head.append(style);
  canvas.id = 'l4-stage'; topEl.id = 'l4-top'; hudEl.id = 'l4-hud';

  const hub = createTelemetryHub({ track: (_id, _p) => { /* web 宿主 sink：缓冲判读为主（headless 冒烟面） */ } });
  const hud = createHudModel();
  const sfx = createSfx();
  const fx = createFx();
  const drag = createDrag();
  let view       = { ox: 0, oy: 0, scale: 1 };
  let ctx = canvas.getContext('2d')                            ;
  let frameStart = performance.now();

  // —— 关卡谱系链状态 ——
  let roundIdx = 0;
  let failStreak = 0;
  let game = spawnRound(roundAt(0), false);
  let g01 = { startElapsed: 0, drag: false, exit: false, complete: false, closed: false };
  let lastExitLatencies           = [];

  function spawnRound(r       , red         )       {
    const budget = red ? NUMERIC.redRoundStepBudget : 0;
    const name = red ? `${r.name} · 红轮` : r.name;
    const g = createGame(r.seed, r.levelId, name, red, budget);
    resetLevelFx(fx);
    if (red) g01 = { ...g01 }; // 红轮不重置 g-01 窗口（判据只挂首关）
    return g;
  }

  function layout()       {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx = canvas.getContext('2d')                            ;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = 48;
    const size = game.lot.size * s;
    const scale = Math.min((window.innerWidth - 48) / size, (window.innerHeight - 140) / size, 1.6);
    view = { scale, ox: (window.innerWidth - game.lot.size * s * scale) / 2, oy: (window.innerHeight - game.lot.size * s * scale) / 2 + 16 };
  }
  window.addEventListener('resize', layout);
  layout();

  // —— 内核会话（elapsedMs=fixed-step 累计，零 Date.now 进内核） ——
  let kernel = start(createSession(game.seed));

  function nextRound(prevMoves        )       {
    if (game.red) {
      const v = resolveRedRound(game, failStreak, NUMERIC.redRoundFailDowngrade);
      if (v.verdict === 'clear') { failStreak = 0; roundIdx += 1; game = spawnRound(roundAt(roundIdx), false); }
      else if (v.shouldDowngrade) { failStreak = 0; game = spawnRound(roundAt(roundIdx), false); } // 降级回标准轮
      else { failStreak = v.nextStreak; game = spawnRound(roundAt(roundIdx), true); } // 红轮再试
    } else if (shouldEnterRed(prevMoves, game.par)) {
      game = spawnRound(roundAt(roundIdx), true); // el-red-entry：前关 ≤par 才入红轮
    } else {
      roundIdx += 1; failStreak = 0; game = spawnRound(roundAt(roundIdx), false);
    }
    kernel = start(createSession(game.seed));
    layout();
  }

  function onSettled(events                                        , ok         )       {
    const now = performance.now();
    for (const ev of events) {
      if (ev === 'car.drag_end' && !g01.drag) g01.drag = true;
      if (ev === 'car.exit') {
        g01.exit = true;
        sfx.play('exit');
        spawnBurst(fx, view.ox + (game.lot.size + 0.5) * 48 * view.scale, view.oy + (game.lot.exit.row + 1) * 48 * view.scale, now);
        lastExitLatencies.push(performance.now() - frameStart);
        if (counters(game).comboCount > 1) {
          spawnPop(fx, game.lot.size - 1.5, game.lot.exit.row, `连击 ×${counters(game).comboCount}`, now);
          sfx.play('drag');
        }
      }
      if (ev === 'level.complete') {
        sfx.play('clear');
        if (!g01.complete) g01.complete = true;
        if (game.levelId === 'level-1' && !g01.closed) {
          g01.closed = true;
          const within = kernel.elapsedMs <= NUMERIC.firstGuideWindowSec * 1000;
          hub.record('first60s_guide_done_rate', g01.drag && g01.exit && g01.complete && within ? 1 : 0);
        }
        hub.record('combo_pending_violations', 0);
        setTimeout(() => nextRound(counters(game).moveCount), 650);
      }
      if (ev === 'level.fail') {
        hub.record('combo_pending_violations', 0);
        setTimeout(() => nextRound(counters(game).moveCount), 650);
      }
    }
    if (!ok) sfx.play('drag');
  }

  // —— 输入（指针 + 键盘 R 重开） ——
  const toCanvas = (e              )                           => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    sfx.unlock();
    const p = toCanvas(e);
    if (pickCar(drag, game.lot, p.x, p.y, view)) game.session = pendingDrag(game.session); // pending：零计数语义
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = toCanvas(e);
    dragDelta(drag, game.lot, p.x, p.y, view);
  });
  canvas.addEventListener('pointerup', (e) => {
    const p = toCanvas(e);
    const rel = releaseDrag(drag, game.lot, view.scale);
    if (!rel) { game.session = cancelPending(game.session); return; } // 回弹：pending 撤销零计数
    frameStart = performance.now();
    const res = applyDrag(game, rel.carId, rel.dCells);
    onSettled(res.events, res.ok);
    layout();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') { game = spawnRound(roundAt(roundIdx), game.red); kernel = start(createSession(game.seed)); layout(); }
  });

  // —— 主循环（fixed-step 累计 + HUD F4 帧采样） ——
  let last = performance.now();
  let acc = 0;
  let drainCounter = 0;
  const tick = (now        )       => {
    frameStart = now;
    const dt = Math.min(now - last, 100);
    last = now;
    acc += dt;
    while (acc >= NUMERIC.FIXED_STEP_MS) { kernel = step(kernel, NUMERIC.FIXED_STEP_MS, { advance: true }); acc -= NUMERIC.FIXED_STEP_MS; }
    pushFrame(hud, dt);
    if (game.phase === 'playing') {
      const remain = Math.max(0, NUMERIC.firstGuideWindowSec - kernel.elapsedMs / 1000);
      hud.f1 = { ...hud.f1, g01Steps: { drag: g01.drag, exit: g01.exit, complete: g01.complete }, first60sRemainSec: Math.ceil(remain), carExitCount: counters(game).comboCount };
      hud.f2 = { ...hud.f2, phase: game.red ? `红轮(${game.budgetUsed}/${game.budget})` : game.phase, moveCount: counters(game).moveCount, comboCount: counters(game).comboCount, pendingActive: counters(game).pendingActive };
      hud.f3 = { ...hud.f3, runIndex: roundIdx + 1, seed: game.seed };
    }
    draw(ctx, game, view, fx, now, game.levelId === 'level-1' && !g01.drag && game.phase === 'playing');
    const c = counters(game);
    topEl.textContent = `${game.levelName}｜步数 ${c.moveCount}｜连击 ${c.comboCount}${game.red ? `｜红轮预算 ${game.budgetUsed}/${game.budget}` : ''}｜R 重开`;
    hudEl.textContent = `${renderHud(hud)}\n锚: ${SPEC_ANCHOR.id}@v${SPEC_ANCHOR.version} · build ${__L4_BUILD__.gitSha.slice(0, 8)}`;
    if (lastExitLatencies.length > 0) {
      const sorted = [...lastExitLatencies].sort((a, b) => a - b);
      hub.record('car_exit_latency_ms_p95', sorted[Math.floor(sorted.length * 0.95)]);
      lastExitLatencies = [];
    }
    hub.record('frame_time_p95_ms', hud.f4.frameTimeP95Ms);
    hub.record('fps_min', hud.f4.fpsMin);
    if ((drainCounter += 1) % 120 === 0) hub.drain(); // 内存缓冲定期清（web 宿主无离线导出面）
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// DOM 就绪即装配（landing/index 壳均以 module 载入本文件）
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
