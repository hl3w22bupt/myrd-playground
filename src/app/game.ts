/**
 * app/game —— 组装根：创建 match + render + input + ui 并接线（双循环 rAF 驱动）。
 */

import { createMatch } from '../core/match';
import type { PlayerIntent } from '../core/types';
import { DEFAULT_CONTENT_PACK } from '../content';
import { FixedLoop } from '../core/loop';
import { GameView } from '../render/view';
import type { QualityLevel } from '../render/quality';
import { InputManager } from '../input/input';
import { Hud } from '../ui/hud';
import { Minimap } from '../ui/minimap';
import { InventoryPanel, ResultScreen } from '../ui/panels';
import { PerfSampler } from '../perf/sampler';
import type { StartOptions } from '../ui/panels';

export interface GameHandle {
  dispose(): void;
}

export function startGame(container: HTMLElement, opts: StartOptions): GameHandle {
  const pack = DEFAULT_CONTENT_PACK;

  // 1) 仿真对局（唯一状态源）
  const match = createMatch({
    seed: opts.seed >>> 0,
    contentPack: pack,
    playerCount: 1,
    aiCount: opts.aiCount,
  });

  // 2) 表现层：WebGL 不可用时整体降级（渲染失败不阻断仿真，架构决策 2.1 推论 2）
  let view: GameView | null = null;
  try {
    view = new GameView(container, match, pack, opts.quality as QualityLevel);
  } catch (err) {
    const warn = document.createElement('div');
    warn.className = 'overlay';
    warn.innerHTML =
      '<div class="panel"><h2>当前环境不支持 WebGL</h2><p class="sub">已降级为无渲染模式：仿真与 HUD 仍在运行。请在常规浏览器中打开以获得完整画面。</p></div>';
    container.appendChild(warn);
    void err;
  }

  // 3) 输入
  const input = new InputManager(container, {
    onToggleInventory: () => inventory.toggle(),
  });
  // 点击画面锁定鼠标（Pointer Lock；嵌入式 iframe 被禁时降级为鼠标移动=视野）
  if (view) view.renderer.domElement.addEventListener('click', () => input.requestPointerLock());

  // 4) UI
  const hud = new Hud(container);
  const minimap = new Minimap(container, pack, match.world.buildings);
  const inventory = new InventoryPanel(container);
  inventory.bind(match);
  inventory.onDropAction((slot) => {
    pendingIntents.push({ kind: 'drop', slot });
  });
  const resultScreen = new ResultScreen(container, () => {
    // 重建对局（同页面刷新整体状态）
    handle.dispose();
    startGame(container, opts);
  });

  // 5) 双循环：rAF 可变渲染 + 50Hz 固定逻辑
  const loop = new FixedLoop((intents: PlayerIntent[]) => match.tick(intents));
  const sampler = new PerfSampler();
  let pendingIntents: PlayerIntent[] = [];
  let lastT = performance.now();
  let rafId = 0;
  let ended = false;

  const frame = (t: number): void => {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(100, t - lastT);
    lastT = t;
    sampler.frame(t);

    // 输入 → 意图
    const frameIntents = [...pendingIntents, ...input.consume()];
    pendingIntents = [];

    // 固定步进推进仿真（意图只在第一个逻辑 tick 消费）
    const alpha = loop.advance(dt, frameIntents);

    // 事件：UI 与特效各取一份
    const events = match.drainEvents();

    // 渲染（快照只读；view 为 null 时仅降级为 HUD）
    const snap = match.snapshot();
    if (view) view.render(snap, events, alpha, dt / 1000);
    hud.update(snap, t);
    hud.consumeEvents(events, match);
    minimap.update(snap);
    if (inventory.visible) inventory.render();

    // 性能采样 + 画质自适应
    const sample = sampler.sample();
    if (view) {
      const changed = view.autoTune(sample.fps, t);
      if (changed) hud.setDebug(`画质自动调整为 ${changed}`);
      hud.setDebug(
        `FPS ${sample.fps.toFixed(0)} · 1%低 ${sample.low1Fps.toFixed(0)} · p95 ${sample.p95FrameMs.toFixed(1)}ms · ` +
        `draw ${view.drawCalls} · 画质 ${view.qualityLevel}` +
        (sample.heapMb !== null ? ` · heap ${sample.heapMb.toFixed(0)}MB` : '') +
        (loop.dropped > 0 ? ` · 丢帧tick ${loop.dropped}` : ''),
      );
    }

    // 结算
    if (!ended && match.status() === 'ended') {
      ended = true;
      input.exitPointerLock();
      const result = match.result();
      if (result) resultScreen.show(result);
    }
  };
  rafId = requestAnimationFrame(frame);

  const onResize = () => view?.resize();
  window.addEventListener('resize', onResize);

  const handle: GameHandle = {
    dispose(): void {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      input.dispose();
      hud.dispose();
      minimap.dispose();
      inventory.dispose();
      resultScreen.dispose();
      view?.dispose();
    },
  };
  return handle;
}
