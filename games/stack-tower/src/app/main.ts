/**
 * 组装根 — 事件单向流的翻译站：内核事件 → 表现层副作用。
 * 纪律：main 不写玩法逻辑；数值一律取自 kernel/numeric；平台差异一律经 platform/。
 */
import { createSim } from '../kernel/sim.js';
import { NUMERIC } from '../kernel/numeric.js';
import type { KernelEvent } from '../kernel/types.js';
import type { Platform } from '../platform/index.js';
import { Renderer } from '../render/renderer.js';
import { loadGameAssets } from '../render/assets.js';
import { mountHud } from '../ui/hud.js';
import { createSfx } from '../audio/sfx.js';

export interface BootSession {
  /** 全量重开（同 seed；HUD 按钮 / 键盘 R 共用入口） */
  restart(): void;
  /** 解绑输入与帧回调（测试拆装用） */
  dispose(): void;
}

export function boot(platform: Platform, opts?: { seed?: number }): BootSession {
  const sim = createSim({ seed: opts?.seed ?? NUMERIC.DEFAULT_SEED });
  const renderer = new Renderer();
  const sfx = createSfx(platform.audio);
  const hud = mountHud(document.getElementById('hud'));

  // 输入：platform 归一后的意图 → 内核（在下一个 tick 起点生效）
  const offInput = platform.input.onIntent((intent) => {
    pendingIntents.push(intent);
  });
  const pendingIntents: { type: 'drop' }[] = [];

  // 事件翻译：内核 → 表现层（唯一副作用入口）
  const handleEvents = (events: KernelEvent[]): void => {
    for (const e of events) {
      if (e.type === 'tower-ripple') {
        renderer.enqueueRipple(e, platform.clock.now());
        sfx.play('perfect');
      } else if (e.type === 'block-placed') {
        sfx.play('place');
      } else if (e.type === 'game-over') {
        sfx.play('over');
      }
    }
  };

  // 固定步长双循环：rAF 可变渲染 + 16ms 固定逻辑（累加器，dt 钳制 MAX_DT）
  let last = platform.clock.now();
  let acc = 0;
  const offFrame = platform.clock.onNextFrame((now) => {
    acc += Math.min(now - last, NUMERIC.MAX_DT_MS);
    last = now;
    while (acc >= NUMERIC.FIXED_STEP_MS) {
      const intent = pendingIntents.shift();
      handleEvents(sim.tick(intent));
      acc -= NUMERIC.FIXED_STEP_MS;
    }
    const snap = sim.snapshot();
    if (platform.canvas) {
      renderer.draw(platform.canvas.context2d(), snap, platform.clock.now(), {
        width: platform.canvas.logicalWidth,
        height: platform.canvas.logicalHeight,
      });
    }
    hud.update(snap);
  });

  // 重开入口：HUD 按钮 / 键盘 R → 内核全量复位（同 seed，无状态残留）
  const restart = (): void => {
    sim.restart();
    renderer.clearFx();
  };
  hud.onRestart(restart);

  // assets/ 实体贴图预载（异步、非阻塞；失败静默回程序化绘制 —— 引用失败不得破坏运行）
  if (platform.assets) {
    void loadGameAssets((url) => platform.assets!.loadImage(url), (msg) => console.info(msg)).then((assets) => {
      renderer.applyAssets(assets);
      if (assets.restartButton) hud.applyRestartSkin(assets.restartButton.src);
    });
  }
  return {
    restart,
    dispose(): void {
      offInput();
      offFrame();
    },
  };
}
