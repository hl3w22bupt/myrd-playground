// main.ts — 浏览器引导（DOM + Canvas + 输入 + 动画 + PWA 注册）
// J1 闭环：消除结算开始 perf.settleStart() → 反馈动画完成 perf.feedbackDone()（标记名 = spec numeric.perf.j1）
import { createGame,           } from './game.mjs';
import { createAudio } from './audio.mjs';
import { createPerf } from './telemetry/perf.mjs';
import { createFpsRecorder } from './telemetry/fps.mjs';
import { createAnalytics, autoSink,              } from './telemetry/analytics.mjs';
import { createNearMissTelemetry, internalPlayerFlag, NM_EVENT_IDS } from './telemetry/nearmiss-telemetry.mjs';
import { numeric, LEVELS } from './generated/spec-data.mjs';
import { probeSwapCreatesMatch } from './kernel/board.mjs';
import { findAnyMove } from './kernel/deadlock.mjs';
import { computeLayout, drawBackdrop, drawBoard, drawCoolBanner, drawDailyEntry, drawHintBar, drawHud, drawNearMiss, drawParticles, drawRestartButton, drawSettlement,                               } from './render/renderer.mjs';
import { MOTION } from './render/theme.mjs';
import { createFeel } from './render/feel.mjs';
import { createNearMissRun, oneAwayRows, planShow, applyShow, observeMove, settlementRule, personalBestCopyKind, nearMissNumeric,                       } from './render/nearmiss.mjs';
import { computeSettlementView, settlementRects, settlementHit, settlementNumeric } from './render/settlement.mjs';
import { NEARMISS_TEXT } from './render/theme.mjs';
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
  keys: ['muted', 'anonId', 'bestScore'], // v1.3 首批：个人最佳键（e-personal-best · 键级最小集 +1，注册键制）
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
    { toVersion: 3, describe: '注册个人最佳键（bestScore · e-personal-best 边界条款数据源）并初始化 0', apply: (view) => {
      if (view.get('bestScore') === null) view.set('bestScore', '0');
    } },
  ],
});
storageFacade.migrate();
const daily = createDaily({ clock: systemClock(), facade: storageFacade });

// 产品埋点（封版冲刺 N4 · ac-29 九事件表）：sink 平台自动路由（wx/dy 原生上报 / web 缓冲+sendBeacon）；
// 零玩法耦合：fire-and-forget，异常不外溢（模块内 try/catch），锚点 once 语义在模块内部
const analyticsSink = autoSink();
const analytics = createAnalytics(analyticsSink);
// near-miss 遥测（v1.3 首批 · 内测工具面）：web 只缓冲不外发（同 ac-29 披露口径）；?internal=1 显式标记内部玩家
const nmTele = createNearMissTelemetry(analyticsSink, { sessionId: analytics.sessionId, internal: internalPlayerFlag(window.location.search) });

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

const initialDailySeed = dailyFromUrl();
let runSeed = initialDailySeed ?? numeric().DEFAULT_SEED; // 局级 seed（埋点字段 + near-miss 可复现追溯；内测面）
let game       = createGame({ levelId: levelFromUrl(), seed: initialDailySeed, audio, perf });
analytics.runStart({ levelId: game.levelId(), seed: runSeed }); // 局起点（N4 ac-29：首局；v1.3 增补局级 seed 字段）

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
  nearMiss: null, // v1.3 首批：惜败弱反馈（transient 不常亮）
  settlement: null, // v1.3 首批：结算页三层 IA（仅 cooled）
  settlementBornAt: 0,
};

// 核心手感表现态机（V1.2 · 链 v4）：事件 + 逻辑帧 → 查表导出（零分配热路径）
const feel = createFeel();

// near-miss 判定器状态机（v1.3 首批 · ac-31 链 v8 冻结面）：纯表现层，零内核改动
const nmCfg = (() => { const wf = nearMissNumeric().weakFeedback; return { perRowPerRun: wf.perRowPerRun, globalPerRun: wf.globalPerRun }; })(); // 频控（真源 = 链 v8 numeric.nearMiss，零手抄第二份）
let nmRun                   = createNearMissRun({ runSeq: 1, seed: runSeed });
let nmCappedTotal = 0; // 内测统计面：被频控拦截的命中数（__G2_NM 机读）
let coolAt                = null; // 炉冷时刻（showDelayMs 出现延迟基准）
let prevCooled = false;
let settlementShown = false;

/** 个人最佳（e-personal-best）：读/写（注册键制 bestScore） */
function personalBest()         {
  try { return Number(storageFacade.get('bestScore') ?? '0') || 0; } catch { return 0; }
}
function updatePersonalBest(score        )       {
  try {
    if (score > personalBest()) storageFacade.set('bestScore', String(score));
  } catch { /* 存储异常不外溢（零玩法影响） */ }
}

/** 结算页三层 IA 视图构建（cooled + showDelayMs 后一次性；ac-32） */
function buildSettlement()       {
  if (settlementShown) return;
  const goals = game.goals();
  const rule = settlementRule(nmRun, { chainTarget: goals.chainTarget, firstClearWithinMoves: goals.firstClearWithinMoves }, game.movesLeft());
  const best = personalBest();
  const kind = personalBestCopyKind({ personalBest: best, score: game.state.score });
  const view = computeSettlementView({
    score: game.state.score,
    chain: game.state.chain,
    movesUsed: game.state.movesUsed,
    rule,
    personalBest: best,
    dailyVisible: daily.entryState().visible,
    movesEnded: game.movesLeft() !== null && (game.movesLeft() ?? 0) <= 0,
    bestGap: kind === 'gap' ? { best, gap: best - game.state.score } : null,
  });
  st.settlement = view;
  st.settlementBornAt = performance.now();
  settlementShown = true;
  if (rule) {
    nmTele.triggered({ runSeq: nmRun.runSeq, seed: nmRun.seed, phase: 'cool', rule, rows: [], chain: game.state.chain, handsLeft: game.movesLeft(), score: game.state.score });
  }
}

function resetNearMissRun()       {
  nmRun = createNearMissRun({ runSeq: nmRun.runSeq + 1, seed: runSeed });
  st.nearMiss = null;
  st.settlement = null;
  settlementShown = false;
  coolAt = null;
  prevCooled = false;
}

let layout         = computeLayout(canvas.width, canvas.height);
let poppingUntil = 0;
let j1Pending = false;
let restartArmedUntil = 0;
let firstScreenSent = false; // 引导锚点①本地面（once 语义兜底；N4 ac-29）

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
  if (game.state.status === 'cooled') analytics.runEnd({ levelId: game.levelId(), score: game.state.score, chain: game.state.chain, movesUsed: game.state.movesUsed, seed: runSeed }); // 局终点（每局至多一次，N4 ac-29；v1.3 增补局级 seed）
  if (st.cooled && !prevCooled) {
    coolAt = time;
    updatePersonalBest(game.state.score); // e-personal-best：炉冷即记账（个人最佳）
  }
  prevCooled = st.cooled;
  if (st.cooled && !settlementShown && coolAt !== null && time - coolAt >= settlementNumeric().showDelayMs) {
    buildSettlement(); // 出现延迟 showDelayMs（链 v8 冻结；零新时序源）
  }
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
  analytics.runStart({ levelId: id }); // 切关 = 新局起点（N4 ac-29）
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
  analytics.firstDrag({ a, b, levelId: game.levelId() }); // 引导锚点②首次拖拽（once/会话，N4 ac-29）
  const willClear = simProbeClear(a, b);
  if (willClear) {
    perf.settleStart(); // J1 起点 = 落定结算开始
    j1Pending = true;
  }
  const r = game.swap(a, b);
  st.selected = null;
  if (!r.ok) return;
  analytics.firstPlace({ a, b, chain: r.chain, levelId: game.levelId() }); // 引导锚点③首次成功放置（once/会话，N4 ac-29）
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
  // near-miss 局中评估（v1.3 首批 · ac-31）：消除结算后同逻辑帧末态（swap 返回 = 末态，同一调用栈）
  observeMove(nmRun, { cleared: r.cleared.length > 0, chain: r.chain, handsLeft: game.movesLeft() });
  if (r.ok && game.state.status === 'playing') {
    const rows = oneAwayRows({ cells: game.state.board, cols: st.cols, rows: st.rows });
    const plan = planShow(nmRun, rows, nmCfg);
    if (plan.show.length > 0) {
      applyShow(nmRun, plan.show);
      const nowMs = performance.now();
      st.nearMiss = {
        rows: plan.show,
        text: NEARMISS_TEXT['nm-copy-inplay-oneaway'],
        bornAt: nowMs,
        pulseUntil: nowMs + nearMissNumeric().weakFeedback.pulseMs, // 弱脉冲一次（链 v8 冻结直读，零手抄）
        holdUntil: nowMs + nearMissNumeric().weakFeedback.bannerHoldMs, // 驻留窗（同上）
      };
      audio.nearMiss(); // 第二档变体（下行尾音·时长减半 · e-sfx-usage）；与反馈展示同帧发起（ac-15 语义沿用）
      nmTele.triggered({ runSeq: nmRun.runSeq, seed: nmRun.seed, phase: 'per-move', rule: 'one-away-row', rows: plan.show, chain: r.chain, handsLeft: game.movesLeft(), score: game.state.score });
    }
    for (const c of plan.capped) {
      nmTele.capped({ runSeq: nmRun.runSeq, seed: nmRun.seed, phase: 'per-move', rule: 'one-away-row', rows: c.rows, capType: c.capType });
    }
    nmCappedTotal += plan.capped.reduce((m, c) => m + c.rows.length, 0);
  }
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
  if (game.state.status === 'cooled') {
    // 结算行动层命中（v1.3 首批 · ac-32）：主按钮 doRestart 同源；次按钮 daily 同源；其余触点吞掉（封印）
    if (st.settlement) {
      const hit = settlementHit(settlementRects(layout, { dailyVisible: daily.entryState().visible }), px, py, { dailyVisible: daily.entryState().visible });
      if (hit === 'restart') doRestart();
      else if (hit === 'daily') doDailyRestart();
    }
    return;
  }
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

/** 每日挑战开局（结算行动层次按钮；与 ?daily=1 同源 = daily.seed() 派生面，零新玩法语义） */
function doDailyRestart()       {
  runSeed = daily.seed();
  game = createGame({ levelId: game.levelId(), seed: runSeed, audio, perf });
  analytics.runStart({ levelId: game.levelId(), seed: runSeed });
  st.selected = null;
  st.popping = [];
  st.hintPair = null;
  poppingUntil = 0;
  goalCache = '';
  j1Pending = false;
  resetNearMissRun();
}

function doRestart()       {
  analytics.restartClicked({ levelId: game.levelId(), movesUsed: game.state.movesUsed }); // 重开点击（N4 ac-29）
  game.restart();
  analytics.runStart({ levelId: game.levelId(), seed: runSeed }); // 重开 = 新局起点（N4 ac-29；v1.3 增补局级 seed）
  resetNearMissRun(); // v1.3：near-miss 频控/结算态随局重置（每行 1 次/局 口径）
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
// 结算页观测口（v1.3 首批 · smoke/截图按 element id 断言读取；不进玩法路径）
debug.__G2_SETTLEMENT = ()                          => {
  const rects = settlementRects(layout, { dailyVisible: daily.entryState().visible });
  return {
    visible: st.cooled && st.settlement !== null,
    inputSeal: st.settlement?.inputSeal ?? null,
    showDelayMs: st.settlement?.showDelayMs ?? settlementNumeric().showDelayMs,
    enterAnimMs: st.settlement?.enterAnimMs ?? settlementNumeric().enterAnimMs,
    slots: st.settlement?.slots ?? null,
    touchTargetMinPx: settlementNumeric().touchTargetMinPx,
    rects,
  };
};
// near-miss 观测口（v1.3 首批 · 内测统计面）
debug.__G2_NM = ()                          => ({
  runSeq: nmRun.runSeq,
  seed: nmRun.seed,
  shownRows: nmRun.shownRows,
  shownCount: nmRun.shownCount,
  runMaxChain: nmRun.runMaxChain,
  firstClearAt: nmRun.firstClearAt,
  cappedTotal: nmCappedTotal,
  bannerActive: st.nearMiss !== null && performance.now() < st.nearMiss.holdUntil,
  personalBest: personalBest(),
  internal: internalPlayerFlag(window.location.search),
  eventIds: NM_EVENT_IDS,
});
// 内测聚合数据出口（tools/ 下内测聚合器读此件；tools/ 不进 build 树 = 提审面零渗漏）
debug.__G2_NM_LOG = ()                                 => nmTele.log();
// near-miss 状态注入（与 __G2_LOAD_BOARD 同级测试面；结算归因态截图/smoke 构造用，零玩法路径）
debug.__G2_NM_STATE = (patch                                 )       => {
  Object.assign(nmRun, patch || {});
};
// near-miss 构造钩子（与 __G2_LOAD_BOARD 同级测试面；smoke/截图证据构造用，零玩法路径）
debug.__G2_NM_FORCE = (rows          )       => {
  const nowMs = performance.now();
  st.nearMiss = { rows, text: NEARMISS_TEXT['nm-copy-inplay-oneaway'], bornAt: nowMs, pulseUntil: nowMs + 600, holdUntil: nowMs + 2400 };
};

// 帧率/帧时间埋点（A 轮 N3-T2）：采集面在产品内，报告由 tools/perf-report.mjs 读取产出。
// 零玩法影响：只记录相邻 rAF 时间差；口径判断（60fps/P95≤16.7ms）在报告层，不在内核断言（红线④）。
const fps = createFpsRecorder(600);
debug.__G2_FPS = {
  snapshot: ()          => fps.snapshot(),
  reset: ()       => fps.reset(),
  samplesAsc: ()           => fps.samplesAsc(),
};

function loop(time        )       {
  if (!firstScreenSent) { firstScreenSent = true; analytics.firstScreen({ levelId: game.levelId() }); } // 引导锚点①首屏（首个渲染帧，N4 ac-29）
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
  drawNearMiss(ctx, layout, st, time);
  drawSettlement(ctx, layout, st, time, st.cooled && st.settlement ? settlementRects(layout, { dailyVisible: daily.entryState().visible }) : null);
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

// 会话埋点收尾（封版冲刺 N4 · ac-29）：session_start 一次性 + 隐藏/离页 flush 兜底（web 面）
analytics.sessionStart({ levelId: game.levelId(), sink: analytics.sinkKind });
window.addEventListener('pagehide', () => { analytics.flush(); nmTele.flush(); }); // v1.3：nm 面同窗兜底
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    analytics.sessionEnd({ levelId: game.levelId() }); // once/会话：首个 hidden 视为会话终点（口径见 ac-29 表）
    analytics.flush();
  }
});
// 埋点观测面（QA 冒烟机读）：sink 类型 + 会话事件序列 + web 缓冲快照
debug.__G2_ANALYTICS = ()                          => ({
  sink: analytics.sinkKind,
  sent: analytics.sentEventIds(),
  buffered: analyticsSink.kind === 'web' ? (analyticsSink           ).log() : null,
});


//# sourceURL=main.ts