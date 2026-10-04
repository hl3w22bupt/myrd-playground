// main.ts — 浏览器引导（DOM + Canvas + 输入 + 动画 + PWA 注册）
// J1 闭环：消除结算开始 perf.settleStart() → 反馈动画完成 perf.feedbackDone()（标记名 = spec numeric.perf.j1）
import { createGame,           } from './game.mjs';
import { createAudio } from './audio.mjs';
import { createPerf } from './telemetry/perf.mjs';
import { createFpsRecorder } from './telemetry/fps.mjs';
import { numeric, LEVELS } from './generated/spec-data.mjs';
import { probeSwapCreatesMatch } from './kernel/board.mjs';
import { findAnyMove } from './kernel/deadlock.mjs';
import { computeLayout, drawBackdrop, drawBoard, drawCoolBanner, drawDailyEntry, drawHintBar, drawHud, drawParticles, drawRestartButton,                               } from './render/renderer.mjs';
import { MOTION } from './render/theme.mjs';
import { createFeel } from './render/feel.mjs';
import { createDaily } from './daily.mjs';
import { systemClock } from './platform/clock.mjs';
import { createStorageFacade } from './platform/storage.mjs';
import { DAILY } from './generated/feel-data.mjs';

const canvas = document.getElementById('stage')                     ;
const ctx = canvas.getContext('2d')                            ;

const audio = createAudio(window.localStorage);
const perf = createPerf();

// daily-challenge 最小闭环（V1.2）：存储走门面版本化通道（v1 归一 + v2 daily 初始化；键由归属模块注册）
const storageFacade = createStorageFacade({
  storage: window.localStorage,
  keys: ['muted', 'anonId'],
  fromVersion: 0,
  migrations: [
    { toVersion: 1, describe: 'muted 取值归一（true/on → 1；false/off → 0）；键集零改动', apply: (view) => {
      const muted = view.get('muted');
      if (muted === 'true' || muted === 'on' || muted === '1') view.set('muted', '1');
      else if (muted === 'false' || muted === 'off' || muted === '0') view.set('muted', '0');
    } },
    { toVersion: 2, describe: '注册 daily 存档键（numeric.daily.storageKey）并初始化空记录', apply: (view) => {
      if (view.get(DAILY.storageKey) === null) view.set(DAILY.storageKey, JSON.stringify({ v: 2, lastDone: 0, streak: 0 }));
    } },
  ],
});
storageFacade.migrate();
const daily = createDaily({ clock: systemClock(), facade: storageFacade });

// 关卡入口（spec content.levelCount 面；levelId 只认 spec LEVELS 段声明，未知值回退首关）
const LEVEL_IDS = LEVELS.map((l                ) => l.id);
function levelFromUrl()         {
  const q = new URLSearchParams(location.search).get('level');
  return q && LEVEL_IDS.includes(q) ? q : LEVEL_IDS[0];
}

/** daily 钩子入口：?daily=1 → 以每日种子开局（种子派生面 = numeric.daily 口径） */
function dailyFromUrl()                     {
  const q = new URLSearchParams(location.search).get('daily');
  return q === '1' ? daily.seed() : undefined;
}

let game       = createGame({ levelId: levelFromUrl(), seed: dailyFromUrl(), audio, perf });

const st              = {
  board: game.state.board,
  cols: numeric().grid.cols,
  rows: numeric().grid.rows,
  score: 0,
  chain: 0,
  movesLeft: null,
  goalText: '',
  selected: null,
  hintPair: null,
  popping: [],
  cooled: false,
  time: 0,
  squash: {},
  shake: { x: 0, y: 0 },
  comboTier: 1,
  particles: [],
  daily: { visible: false, done: false, streak: 0 },
};

// 核心手感表现态机（V1.2 · 链 v4）：事件 + 逻辑帧 → 查表导出（零分配热路径）
const feel = createFeel();

let layout         = computeLayout(canvas.width, canvas.height);
let poppingUntil = 0;
let j1Pending = false;
let restartArmedUntil = 0;

function resize()       {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout = computeLayout(w, h);
}
window.addEventListener('resize', resize);
resize();

function logicFrameOf(time        )         {
  return Math.floor(time / numeric().FIXED_STEP_MS);
}

function syncState(time        )       {
  st.board = game.state.board;
  st.score = game.state.score;
  st.chain = game.state.chain;
  st.movesLeft = game.movesLeft();
  st.cooled = game.state.status === 'cooled';
  st.time = time;
  st.goalText = goalShortText();
  const mv = game.hintAvailable() ? game.hint() : null;
  st.hintPair = mv ? [mv.a, mv.b] : null;
  st.selected = st.selected !== null && st.cooled ? null : st.selected;
  st.popping = time < poppingUntil ? st.popping : [];
  // 核心手感查表导出（V1.2）：形变/震屏/粒子逐帧渲染态
  const snap = feel.at(logicFrameOf(time));
  st.squash = snap.squash;
  st.shake = snap.shake;
  st.comboTier = snap.comboTier;
  st.particles = snap.particles;
  st.daily = daily.entryState();
}

let goalCache = '';
function goalShortText()         {
  if (goalCache) return goalCache;
  const lv = LEVELS.find((l                ) => l.id === game.levelId());
  const g = game.goals();
  const parts           = [];
  if (g.firstClearWithinMoves !== null) parts.push(`${g.firstClearWithinMoves} 步内首消`);
  if (g.movesLimit !== null && g.chainTarget !== null) parts.push(`${g.movesLimit} 手内打出 ${g.chainTarget} 连击`);
  goalCache = `${lv ? lv.name : ''}${parts.length ? ' · ' : ''}${parts.join('；') || '凑三连，别让炉子冷'}`;
  return goalCache;
}

/** 关卡切换（玩家入口：键盘 1/2 与 ?level= 参数同源；spec LEVELS 声明面之外拒绝） */
function setLevel(id        )       {
  if (!LEVEL_IDS.includes(id) || id === game.levelId()) return;
  game = createGame({ levelId: id, audio, perf });
  st.selected = null;
  st.popping = [];
  st.hintPair = null;
  poppingUntil = 0;
  goalCache = '';
  j1Pending = false;
  const url = new URL(location.href);
  if (id === LEVEL_IDS[0]) url.searchParams.delete('level');
  else url.searchParams.set('level', id);
  history.replaceState(null, '', url);
}

function cellAt(px        , py        )                {
  const col = Math.floor((px - layout.boardX) / layout.cell);
  const row = Math.floor((py - layout.boardY) / layout.cell);
  if (col < 0 || row < 0 || col >= st.cols || row >= st.rows) return null;
  return row * st.cols + col;
}

function centerOf(idx        )                           {
  return {
    x: layout.boardX + (idx % st.cols) * layout.cell + layout.cell / 2,
    y: layout.boardY + Math.floor(idx / st.cols) * layout.cell + layout.cell / 2,
  };
}

async function attemptSwap(a        , b        )                {
  const willClear = simProbeClear(a, b);
  if (willClear) {
    perf.settleStart(); // J1 起点 = 落定结算开始
    j1Pending = true;
  }
  const r = game.swap(a, b);
  st.selected = null;
  if (!r.ok) return;
  // 手感事件投递（与结算同一调用栈；逻辑帧 = 当前帧）：波次合并面（落差取最大、落定/消除格合并）
  if (r.cleared.length > 0 || r.waves.length > 0) {
    feel.onHand({
      frame: logicFrameOf(performance.now()),
      chain: r.chain,
      waves: r.waves.length > 0 ? [{
        clearedCells: r.cleared,
        maxFallCells: r.waves.reduce((m, w) => Math.max(m, w.maxFallCells), 0),
        landedCells: r.waves.flatMap((w) => w.landedCells),
      }] : [],
    });
  }
  if (r.cleared.length > 0) {
    st.popping = r.cleared.slice();
    poppingUntil = performance.now() + MOTION.clearPopMs;
    scheduleFeedbackDone(performance.now() + MOTION.clearPopMs);
  } else if (j1Pending) {
    j1Pending = false;
    perf.feedbackDone();
  }
  if (r.cool) void 0; // 冷却横幅由渲染态驱动；音效已在 game 内同帧发起
  if (r.cleared.length > 0) daily.markDone(); // daily 打卡（同日幂等；V1.2 最小闭环）
}

/** 无副作用预判：这对相邻交换是否会消除（J1 起点；复用内核探针原语，单源判定） */
function simProbeClear(a        , b        )          {
  try {
    return probeSwapCreatesMatch(
      { cells: game.state.board, cols: st.cols, rows: st.rows },
      a, b,
    );
  } catch {
    return false;
  }
}

function scheduleFeedbackDone(at        )       {
  const check = ()       => {
    if (performance.now() >= at) {
      if (j1Pending) {
        j1Pending = false;
        perf.feedbackDone();
      }
      return;
    }
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}

function restartButtonState()                                  {
  const snap = feel.at(logicFrameOf(performance.now()));
  if (snap.restarting) return 'transition';
  return performance.now() < restartArmedUntil ? 'armed' : 'idle';
}

function inRestartRect(px        , py        )          {
  const r = layout.restartRect;
  return px >= r.x && px <= r.x + r.size && py >= r.y && py <= r.y + r.size;
}

function onTap(px        , py        )       {
  audio.unlock();
  // 重开一键入口（与键盘 R 同源同路径 = doRestart；V1.2）
  if (inRestartRect(px, py)) {
    restartArmedUntil = performance.now() + 160;
    doRestart();
    return;
  }
  if (game.state.status === 'cooled') return;
  const idx = cellAt(px, py);
  if (idx === null) return;
  if (st.selected === null) {
    st.selected = idx;
    return;
  }
  if (st.selected === idx) {
    st.selected = null;
    return;
  }
  const dx = Math.abs((st.selected % st.cols) - (idx % st.cols));
  const dy = Math.abs(Math.floor(st.selected / st.cols) - Math.floor(idx / st.cols));
  if (dx + dy === 1) {
    void attemptSwap(st.selected, idx);
  } else {
    st.selected = idx;
  }
}

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  onTap(e.clientX - rect.left, e.clientY - rect.top);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') doRestart();
  if (e.key === 'm' || e.key === 'M') audio.toggleMute();
  if (e.key === '1' || e.key === '2') setLevel(LEVEL_IDS[Number(e.key) - 1]);
});

function doRestart()       {
  game.restart();
  feel.restart(logicFrameOf(performance.now()));
  st.selected = null;
  st.popping = [];
  goalCache = '';
  j1Pending = false;
  (window                                         ).__G2_RESTARTS = ((window                                         ).__G2_RESTARTS ?? 0) + 1;
}

// 冒烟/契约调试面（与 seededRng 同级的确定性测试钩子；不进玩法路径）
const debug = window                                      ;
debug.__G2_READY = false;
debug.__G2_J1 = null;
debug.__G2_FIND_MOVE = ()                          => game.hint();
debug.__G2_FIND_MOVE_ANY = ()                          => {
  const mv = findAnyMove({ cells: game.state.board, cols: st.cols, rows: st.rows });
  return mv ? [mv.a, mv.b] : null;
};
debug.__G2_TAP = (idx        )       => {
  const c = centerOf(idx);
  onTap(c.x, c.y);
};
debug.__G2_STATE = ()                          => ({
  score: game.state.score,
  chain: game.state.chain,
  movesUsed: game.state.movesUsed,
  cool: game.state.cool,
  status: game.state.status,
  boardLen: game.state.board.length,
  popping: st.popping.length,
  levelId: game.levelId(),
  goalText: goalShortText(),
});
debug.__G2_FEEL = ()                          => {
  const snap = feel.at(logicFrameOf(performance.now()));
  return {
    squashCells: Object.keys(snap.squash).length,
    shake: snap.shake,
    particlesAlive: snap.particlesAlive,
    drawnParticles: drawnThisFrame.count,
    drawnPoints: drawnThisFrame.points,
    comboTier: snap.comboTier,
    sfx: snap.sfx,
    restarting: snap.restarting,
    restartState: restartButtonState(),
    pool: feel.poolStats(),
  };
};
// 布局观测面（V1.2 · D1）：粒子绘制坐标（cell 单位）→ 画布像素换算（冒烟像素断言读取）
debug.__G2_LAYOUT = ()                         => ({ boardX: layout.boardX, boardY: layout.boardY, cell: layout.cell, w: layout.w, h: layout.h });
debug.__G2_DAILY = ()                          => ({ ...daily.state(), entry: daily.entryState() });
debug.__G2_DAILY_SEED = ()         => daily.seed();
debug.__G2_RESTART = doRestart;
debug.__G2_SET_LEVEL = (id        )       => setLevel(id);
// 契约/QA 测试钩子（与 __G2_SET_LEVEL 同级）：注入盘面（炉冷终局帧构造用；不动 chain/score/moves）
debug.__G2_LOAD_BOARD = (cells          )       => game.loadBoard(cells);

// 帧率/帧时间埋点（A 轮 N3-T2）：采集面在产品内，报告由 tools/perf-report.mjs 读取产出。
// 零玩法影响：只记录相邻 rAF 时间差；口径判断（60fps/P95≤16.7ms）在报告层，不在内核断言（红线④）。
const fps = createFpsRecorder(600);
debug.__G2_FPS = {
  snapshot: ()          => fps.snapshot(),
  reset: ()       => fps.reset(),
  samplesAsc: ()           => fps.samplesAsc(),
};

function loop(time        )       {
  fps.frame(time);
  syncState(time);
  const heat = Math.min(1, st.chain / 5);
  drawBackdrop(ctx, layout, heat);
  drawBoard(ctx, layout, st);
  drawnThisFrame = { count: drawParticles(ctx, layout, st), points: st.particles.map((p) => [p.x, p.y]                    ) };
  drawHud(ctx, layout, st);
  drawHintBar(ctx, layout, st);
  drawRestartButton(ctx, layout, restartButtonState());
  drawDailyEntry(ctx, layout, st);
  drawCoolBanner(ctx, layout, st);
  requestAnimationFrame(loop);
}
// 粒子上屏观测面（V1.2 · D1 打回修复）：渲染循环每帧记录 drawParticles 实绘数与绘制坐标
// （cell 单位，冒烟「上屏可观察断言」经 __G2_FEEL 读取；不进玩法路径）
let drawnThisFrame                                                = { count: 0, points: [] };
requestAnimationFrame(loop);

// J1 证据面（冒烟读取）
setInterval(() => {
  const j1 = perf.lastJ1Ms();
  if (j1 !== null) {
    debug.__G2_J1 = { measuredMs: j1, startMark: 'j1_settle_start', doneMark: 'j1_feedback_done' };
  }
}, 100);

// PWA：Service Worker 注册（localhost/https 生效；file:// 静默跳过）
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* SW 失败不阻塞玩法 */ });
}

debug.__G2_READY = true;


//# sourceURL=main.ts