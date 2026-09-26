/**
 * 组装根 — 事件单向流的翻译站：内核事件 → 表现层副作用。
 * 纪律：main 不写玩法逻辑；数值一律取自 kernel/numeric；平台差异一律经 platform/。
 * M2.1 新增：AudioManager（解锁/音池/静音持久/连击升调）、横屏遮罩暂停、?fps=1 帧率面板、SW 注册。
 */
import { createSim } from '../kernel/sim.js';
import { NUMERIC } from '../kernel/numeric.js';
import type { KernelEvent } from '../kernel/types.js';
import type { Platform } from '../platform/index.js';
import type { AudioManager } from '../audio/audio-manager.js';
import { createAudioManager } from '../audio/audio-manager.js';
import { semitonesForCombo } from '../audio/audio-manager.js';
import { Renderer } from '../render/renderer.js';
import { loadGameAssets } from '../render/assets.js';
import { mountHud } from '../ui/hud.js';
import { createRotateOverlay } from '../ui/rotate-overlay.js';
import { createFpsOverlay } from '../ui/fps-overlay.js';

export interface BootSession {
  /** 全量重开（同 seed；HUD 按钮 / 键盘 R 共用入口，source 区分契约载荷） */
  restart(source?: 'button' | 'keyboard'): void;
  /** 视口尺寸驱动横屏遮罩（宽高比 > ROTATE_ASPECT_RATIO 激活 → 暂停）；返回是否激活 */
  setViewport(width: number, height: number): boolean;
  /** 解绑输入与帧回调（测试拆装用） */
  dispose(): void;
}

/** headless 兜底音频管理器（ctx=null → play 一律 no-ctx 静音，不抛错） */
export function createSilentAudioManager(): AudioManager {
  return createAudioManager({ ctx: null, storage: null, now: () => 0, loadBuffer: async () => null });
}

export function boot(platform: Platform, opts?: { seed?: number }): BootSession {
  const sim = createSim({ seed: opts?.seed ?? NUMERIC.DEFAULT_SEED });
  const renderer = new Renderer();
  const audio = platform.audioManager ?? createSilentAudioManager();
  const hud = mountHud(document.getElementById('hud'));
  hud.setMutedVisual(audio.isMuted());

  // —— M2.1：横屏遮罩（激活即暂停）+ ?fps=1 帧率面板 ——
  const rotate = createRotateOverlay(NUMERIC.mobile.ROTATE_ASPECT_RATIO);
  rotate.mount(document.getElementById('stage'));
  let paused = false;
  rotate.onChange((active) => {
    paused = active;
  });

  const fpsEnabled = new URLSearchParams(location.search).has('fps');
  const fps = createFpsOverlay();
  if (fpsEnabled) fps.mount(document.body);

  // 输入：platform 归一后的意图 → 内核（在下一个 tick 起点生效）；遮罩激活期间忽略
  const pendingIntents: { type: 'drop' }[] = [];
  const offInput = platform.input.onIntent((intent) => {
    if (!paused) pendingIntents.push(intent);
  });

  // —— 事件翻译：内核 → 表现层（唯一副作用入口）。连击升调取自内核快照 combo ——
  let lastStatus = sim.snapshot().status;
  const handleEvents = (events: KernelEvent[], combo: number, status: string): void => {
    const semis = semitonesForCombo(combo);
    for (const e of events) {
      if (e.type === 'tower-ripple') {
        renderer.enqueueRipple(e, platform.clock.now());
        audio.play('perfect', semis);
      } else if (e.type === 'block-placed') {
        // 落块闷响按连击逐块升调（+1 半音/块，cap +12；miss 后 combo=0 归零）
        audio.play('place', semis);
      } else if (e.type === 'game-over') {
        // critical：完全脱靶=miss，切损触底=game-over（满载不挤占）
        audio.play(e.reason === 'total-miss' ? 'miss' : 'game-over', 0);
      } else if (e.type === 'restart') {
        audio.play('restart', 0);
      }
    }
    if (status === 'level-clear' && lastStatus !== 'level-clear') audio.play('level-clear', 0);
    lastStatus = status as typeof lastStatus;
  };

  // 固定步长双循环：rAF 可变渲染 + 16ms 固定逻辑（累加器，dt 钳制 MAX_DT）
  let last = platform.clock.now();
  let acc = 0;
  let frameStart = platform.clock.now();
  const offFrame = platform.clock.onNextFrame((now) => {
    if (fpsEnabled) fps.sample(now - frameStart);
    frameStart = now;
    acc += Math.min(now - last, NUMERIC.MAX_DT_MS);
    last = now;
    if (paused) {
      acc = 0; // 遮罩激活即暂停：不推进内核（摆块冻结）、丢弃时间片防累积追帧
    } else {
      while (acc >= NUMERIC.FIXED_STEP_MS) {
        const events = sim.tick(pendingIntents.shift());
        const snap = sim.snapshot();
        handleEvents(events, snap.combo, snap.status);
        acc -= NUMERIC.FIXED_STEP_MS;
      }
    }
    const snapshot = sim.snapshot();
    if (platform.canvas) {
      renderer.draw(platform.canvas.context2d(), snapshot, platform.clock.now(), {
        width: platform.canvas.logicalWidth,
        height: platform.canvas.logicalHeight,
      });
    }
    hud.update(snapshot);
  });

  // 重开入口：HUD 按钮（source=button）/ 键盘 R（source=keyboard）→ 契约级 restart 事件
  const restart = (source: 'button' | 'keyboard' = 'button'): void => {
    const events = sim.restart(source);
    handleEvents(events, sim.snapshot().combo, sim.snapshot().status);
    renderer.clearFx();
  };
  hud.onRestart(() => restart('button'));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') restart('keyboard');
  });

  // —— M2.1：静音开关（localStorage st.settings.muted 持久）+ 首手势解锁 ——
  hud.onToggleMute(() => {
    const muted = audio.toggleMute();
    hud.setMutedVisual(muted);
  });

  // assets/ 实体贴图预载（异步、非阻塞；失败静默回程序化绘制 —— 引用失败不得破坏运行）
  if (platform.assets) {
    void loadGameAssets((url) => platform.assets!.loadImage(url), (msg) => console.info(msg)).then((assets) => {
      renderer.applyAssets(assets);
      if (assets.restartButton) hud.applyRestartSkin(assets.restartButton.src);
    });
  }

  // M2.1：Service Worker 注册（PWA 可安装壳；失败不抛错）
  // R1②（U6 修复）：显式 script + scope，不再依赖文档 base URL 隐式推导——
  //  - script 仍按 <base> 解析：壳形态落在 api/public/assets/sw.js（与 sw.js 内
  //    precache 的相对键同源）；本地/静态形态落在页面目录下。
  //  - scope 取页面所在目录（new URL('./', location.href)）：壳形态 = /apps/<slug>/，
  //    本地根形态 = /。默认 max scope（脚本目录）覆盖不了页面 → 由壳对 sw.js 响应
  //    的 Service-Worker-Allowed 头放宽（serve.mjs 根路径形态本就允许，无需头）。
  if ('serviceWorker' in navigator) {
    const script = new URL('sw.js', document.baseURI).href;
    const scope = new URL('./', location.href).href;
    navigator.serviceWorker
      .register(script, { scope })
      .catch(() => console.info('[pwa] SW 注册失败（离线 precache 不可用）'));
  }

  return {
    restart,
    setViewport: (width: number, height: number): boolean => rotate.setViewport(width, height),
    dispose(): void {
      offInput();
      offFrame();
      rotate.dispose();
      fps.dispose();
      audio.dispose();
    },
  };
}
