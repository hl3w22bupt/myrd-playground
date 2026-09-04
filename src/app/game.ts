/**
 * app/game —— 组装根：创建 match + render + input + ui 并接线。
 * 逐帧工作统一交给 FrameDriver（渲染单循环）；本文件只负责装配与生命周期。
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
import { FrameDriver } from './frame';
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

  // 5) 渲染单循环：rAF 可变渲染 + 50Hz 固定逻辑，全部逐帧工作收敛到 FrameDriver
  const loop = new FixedLoop((intents) => match.tick(intents));
  const sampler = new PerfSampler();
  const pendingIntents: PlayerIntent[] = [];
  const driver = new FrameDriver({
    match,
    loop,
    sampler,
    input: {
      consume: () => {
        const out = input.consume();
        if (pendingIntents.length > 0) {
          for (let i = 0; i < pendingIntents.length; i++) out.push(pendingIntents[i]);
          pendingIntents.length = 0;
        }
        return out;
      },
    },
    hud,
    minimap,
    inventory,
    view,
    onEnded: (m) => {
      input.exitPointerLock();
      const result = m.result();
      if (result) resultScreen.show(result);
    },
    raf: (cb) => requestAnimationFrame(cb),
    caf: (id) => cancelAnimationFrame(id),
  });
  driver.start();

  const onResize = () => view?.resize();
  window.addEventListener('resize', onResize);

  const handle: GameHandle = {
    dispose(): void {
      driver.stop();
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
