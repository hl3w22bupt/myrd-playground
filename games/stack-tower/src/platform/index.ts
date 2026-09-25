/**
 * platform/ 适配层 — 平台差异（DOM 事件 / rAF / 时钟 / 音频）在此归一。
 * 红线：内核（kernel/）禁止 import 本层以外的任何平台 API；表现层经本层接口取用。
 * 依赖方向：app/main → platform + kernel + render + ui；kernel 不依赖 platform。
 */

/** 输入源：把平台原始输入归一为 PlayerIntent 流 */
export interface InputSource {
  /** 注册意图回调；返回解绑函数 */
  onIntent(handler: (intent: { type: 'drop' }) => void): () => void;
}

/** 时钟源：帧回调 + 高精度时间 */
export interface ClockSource {
  /** 请求下一帧（浏览器 rAF / 测试用手动泵） */
  onNextFrame(handler: (nowMs: number) => void): () => void;
  now(): number;
}

/** 音频输出：程序化合成（procedural:webaudio），由事件驱动 */
export interface AudioSink {
  play(kind: 'place' | 'perfect' | 'over'): void;
}

/** 画布宿主：提供 2D 上下文与逻辑尺寸（DPR 归一在此完成） */
export interface CanvasHost {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  context2d(): CanvasRenderingContext2D;
}

/** 资产装载宿主：工程内相对路径 → 解码后的图（缺图/失败返回 null，绝不抛错） */
export interface AssetHost {
  loadImage(url: string): Promise<HTMLImageElement | null>;
}

/** 平台装配体：一份实现 = 一个可运行环境（browser / headless-test） */
export interface Platform {
  input: InputSource;
  clock: ClockSource;
  audio: AudioSink;
  canvas: CanvasHost | null; // headless 测试环境可无画布
  assets?: AssetHost; // headless/契约测试不注入 → 表现层走程序化 fallback
}

/** 手动泵时钟（契约测试 / 无头环境）：由测试代码推进帧，零真实时间依赖 */
export function createManualClock(startMs = 0): ClockSource & { advance(ms: number): void; pump(): void } {
  let now = startMs;
  let handler: ((n: number) => void) | null = null;
  return {
    onNextFrame(h) {
      handler = h;
      return () => {
        handler = null;
      };
    },
    now() {
      return now;
    },
    advance(ms: number) {
      now += ms;
    },
    pump() {
      handler?.(now);
    },
  };
}

/** 无声音频（headless / 静音模式） */
export function createSilentAudio(): AudioSink {
  return { play: () => {} };
}

/** 无输入源（headless）：契约测试直接注入 intent，不经输入层 */
export function createNoopInput(): InputSource {
  return { onIntent: () => () => {} };
}
