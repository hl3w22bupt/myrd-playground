/**
 * Web build 主入口（M1 核心循环：追球、射门、进球，90s 终局）。
 *
 * 模式（spec meta.modes，M1 三模式齐备，按键 1/2/3 切换）：
 *   1 = 1v1 人类 vs 人类   2 = 1v1 人类 vs bot（默认）   3 = bot vs bot
 *   R = 再来一局           F = FPS 覆盖层开关
 *
 * 固定步长 60Hz（TICK_DT_S），渲染随 rAF；核心循环只走 core/match.js，
 * 与 headless bot-sim 同一套模拟入口。占位精灵先行：.grid 资产加载失败自动回退。
 */
import { Match } from '../core/match.js';
import { TICK_DT_S, ONBOARDING } from '../core/constants.js';
import { BotController } from '../ai/bot.js';
import { KeyboardInput, NO_INTENT } from './input.js';
import { loadAllSprites } from './gridSprites.js';
import { render } from './renderer.js';

const TICK_MS = TICK_DT_S * 1000;
const HUMAN_BOT_SEED = 1;
const SIM_SEED = 42; // bot vs bot 展示种子（QA 门禁走 tools/bot-sim.mjs）

function setupCanvas() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/** A08 进球音效：优先 gen-audio.mjs 产物 WAV，否则 WebAudio 确定性合成兜底。 */
function createGoalSfx() {
  let audioCtx = null;
  let wavUrl = null;
  let wavBuffer = null;
  fetch('assets/out/a08-sfx-goal-hit.wav')
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('no wav'))))
    .then((buf) => { wavBuffer = buf; })
    .catch(() => { /* 合成兜底 */ });
  const ensureCtx = () => {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };
  const synth = () => {
    const ac = ensureCtx();
    if (!ac) return;
    const t0 = ac.currentTime; // 墙钟只用于音频排程（A08 goal_sfx_at_s=0.0 即立即），不进 sim
    // 层1 球闷响：90→60Hz 正弦下扫
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.12);
    og.gain.setValueAtTime(0.5, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    osc.connect(og).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
    // 层2 网摩擦：2400Hz 带通噪声短促
    const len = Math.floor(ac.sampleRate * 0.16);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 5));
    const src = ac.createBufferSource();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 1.2;
    const ng = ac.createGain();
    ng.gain.value = 0.25;
    src.connect(bp).connect(ng).connect(ac.destination);
    src.buffer = buf;
    src.start(t0);
  };
  return {
    unlock: ensureCtx,
    play() {
      const ac = ensureCtx();
      if (!ac) return;
      if (wavBuffer) {
        // WAV 路径：decode + 播放（gen-audio 产物，同 seed 比特一致）
        ac.decodeAudioData(wavBuffer.slice(0))
          .then((d) => { const s = ac.createBufferSource(); s.buffer = d; s.connect(ac.destination); s.start(); })
          .catch(synth);
      } else {
        synth();
      }
    },
  };
}

async function boot() {
  const { canvas, ctx } = setupCanvas();
  const input = new KeyboardInput();
  input.attach();
  const sfx = createGoalSfx();
  input.onAnyKey = () => sfx.unlock();

  const sprites = await loadAllSprites();

  let mode = 'human-vs-bot';
  let match = null;
  let botRed = null;
  let botBlue = null;

  function setup() {
    match = new Match({ seed: SIM_SEED });
    botRed = mode === 'bot-vs-bot' ? new BotController('red', SIM_SEED, match.level) : null;
    botBlue = mode !== 'human-vs-human' ? new BotController('blue', mode === 'bot-vs-bot' ? SIM_SEED : HUMAN_BOT_SEED, match.level) : null;
  }
  setup();

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') { mode = 'human-vs-human'; setup(); }
    if (e.code === 'Digit2') { mode = 'human-vs-bot'; setup(); }
    if (e.code === 'Digit3') { mode = 'bot-vs-bot'; setup(); }
    if (e.code === 'KeyR') setup(); // 再来一局：比分清零（el 终局规则）
    if (e.code === 'KeyF') showFps = !showFps;
  });

  let showFps = true;
  let frameTick = 0;
  let acc = 0;
  let last = performance.now();
  let fpsEma = 60;
  let fpsTextCache = 'FPS --';

  function stepOnce() {
    const iRed = botRed ? botRed.decide(match.world) : (mode !== 'bot-vs-bot' ? input.intent('red') : NO_INTENT);
    const iBlue = botBlue ? botBlue.decide(match.world) : input.intent('blue');
    match.step(TICK_DT_S, iRed, iBlue);
  }

  function frame(now) {
    const dt = Math.min(now - last, 250);
    last = now;
    fpsEma = fpsEma * 0.95 + (1000 / Math.max(dt, 0.01)) * 0.05;
    acc += dt;
    let ticks = 0;
    while (acc >= TICK_MS && ticks < 5) {
      stepOnce();
      acc -= TICK_MS;
      ticks += 1;
    }
    if (ticks === 5 && acc > TICK_MS * 5) acc = 0; // 防死亡螺旋
    // A08：进球音效排程（goal_sfx_at_s=0.0 → 当帧播放）
    if (match.sfxEvents.length > 0) {
      match.sfxEvents.length = 0;
      sfx.play();
    }
    if (frameTick % 10 === 0) {
      fpsTextCache = `FPS ${fpsEma.toFixed(0)} · ${mode} · 1/2/3 切换 · R 重开`;
    }
    render(ctx, match, sprites, {
      frameTick,
      onboardingText: ONBOARDING.TEXT,
      fpsText: showFps ? fpsTextCache : null,
    });
    frameTick += 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
