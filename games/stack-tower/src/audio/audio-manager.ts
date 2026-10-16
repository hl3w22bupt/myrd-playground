/**
 * 音频管理器（实体 e-audio-manager，M2.1）— 事件驱动，不通晓玩法。
 * 职责（spec v3 content.sfxPack / numeric.audio）：
 *  - iOS 首手势解锁：unlock() 在首个 pointerdown 内 resume AudioContext；解锁前播放请求入队挂起，解锁后补放；
 *  - 8 音池：非 critical 满 8 丢弃；critical（miss/game-over/restart）满载抢占最老非 critical，永不挤占；
 *  - 连击升调：playbackRate = 2^(semitones/12)，semitones = min(combo, 12)，miss 后由 combo=0 归零；
 *  - sfx_bus_gain 0.9 总线；静音持久 localStorage `st.settings.muted`，静音态零输出节点；
 *  - 三级降级：sfx-pack 文件 buffer → 程序化合成（voices.ts 同表）→ 静音占位 buffer；任何失败不抛错。
 * Node 可测：ctx/storage/loadBuffer/now 全部依赖注入，零 DOM。
 */
import { NUMERIC } from '../kernel/numeric.js';
import { SFX_VOICES, type SfxEventId, type SfxVoice } from './voices.js';
import { scheduleProceduralVoice } from './sfx.js';

// ---------- 最小 WebAudio 结构接口（浏览器 AudioContext 天然满足；测试用假件实现） ----------
export interface AudioBufferLike {
  duration: number;
}
export interface GainNodeLike {
  gain: { value: number; setValueAtTime?(value: number, startTime: number): void };
  connect(dest: unknown): void;
}
export interface BufferSourceLike {
  playbackRate: { value: number };
  onended: (() => void) | null;
  connect(dest: unknown): void;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface OscillatorLike {
  type: 'sine' | 'triangle' | 'sawtooth' | 'square';
  frequency: { value: number };
  connect(dest: unknown): void;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface AudioContextLike {
  state: 'running' | 'suspended' | 'closed';
  currentTime: number;
  destination: unknown;
  resume(): Promise<void>;
  createGain(): GainNodeLike;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): BufferSourceLike;
  createOscillator(): OscillatorLike;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike>;
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const MUTED_STORAGE_KEY = 'st.settings.muted';
const PENDING_CAP = 16;

/** 连击 → 升调半音数：min(combo, CAP)；miss（combo=0）归零 */
export function semitonesForCombo(combo: number): number {
  return Math.max(0, Math.min(combo, NUMERIC.audio.COMBO_PITCH_CAP_SEMITONES));
}
/** 半音 → playbackRate：2^(n/12) */
export function playbackRateFor(semitones: number): number {
  return 2 ** (semitones / 12);
}

interface ActiveVoice {
  id: number;
  critical: boolean;
  /** 结束时刻（manager 时钟，ms）——满载判定与过期回收用 */
  endsAt: number;
  steal: (() => void) | null; // 抢占回调（stop 底层 source）
}

export interface PlayReport {
  eventId: SfxEventId;
  played: boolean;
  reason: 'ok' | 'muted' | 'locked' | 'pool-full' | 'no-ctx';
  semitones: number;
  tier: 'buffer' | 'procedural' | 'silent';
}

export interface AudioManager {
  /** iOS 手势解锁：首个 pointerdown 内调用；解锁后补放挂起队列 */
  unlock(): Promise<void>;
  setMuted(muted: boolean): void;
  toggleMute(): boolean;
  isMuted(): boolean;
  /** 事件出声（semitones 由调用方按内核 combo 传入） */
  play(eventId: SfxEventId, semitones?: number): PlayReport;
  /** 当前活跃 voice 数（契约 a5a 断言点） */
  activeVoiceCount(): number;
  /** 解锁前挂起队列长度（契约 a2 断言点） */
  pendingCount(): number;
  dispose(): void;
}

export interface AudioManagerDeps {
  ctx: AudioContextLike | null;
  storage: StorageLike | null;
  /** sfx-pack 文件解码（失败/缺失返回 null → 程序化合成） */
  loadBuffer(eventId: SfxEventId): Promise<AudioBufferLike | null>;
  /** manager 时钟（ms）；测试注入手动钟 */
  now(): number;
}

export function createAudioManager(deps: AudioManagerDeps): AudioManager {
  const { ctx, storage, loadBuffer, now } = deps;
  const busGain = NUMERIC.audio.SFX_BUS_GAIN;
  const poolSize = NUMERIC.audio.VOICE_POOL_SIZE;

  let muted = storage?.getItem(MUTED_STORAGE_KEY) === '1';
  let unlocked = false;
  let bus: GainNodeLike | null = null;
  let voiceSeq = 0;
  const pending: { eventId: SfxEventId; semitones: number }[] = [];
  const voices: ActiveVoice[] = [];
  const buffers = new Map<SfxEventId, AudioBufferLike | null>();

  function ensureBus(): GainNodeLike | null {
    if (!ctx) return null;
    if (!bus) {
      bus = ctx.createGain();
      bus.gain.value = busGain; // numeric.audio.SFX_BUS_GAIN
      bus.connect(ctx.destination);
    }
    return bus;
  }

  function silentBuffer(): AudioBufferLike {
    // 静音占位 buffer：保调度路径先行（无音频文件/无输出设备时测试仍可先行）
    return ctx!.createBuffer(1, 1, NUMERIC.audio.SAMPLE_RATE_HZ);
  }

  async function preload(): Promise<void> {
    await Promise.allSettled(
      (Object.keys(SFX_VOICES) as SfxEventId[]).map(async (id) => {
        if (buffers.has(id)) return;
        try {
          buffers.set(id, await loadBuffer(id));
        } catch {
          buffers.set(id, null); // 降级：程序化合成
        }
      }),
    );
  }

  function prune(): void {
    const t = now();
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i]!.endsAt <= t) voices.splice(i, 1);
  }

  function stealOldestNonCritical(): ActiveVoice | null {
    for (let i = 0; i < voices.length; i++) {
      if (!voices[i]!.critical) return voices.splice(i, 1)[0]!;
    }
    return null;
  }

  /** 程序化合成（voices.ts 同表；文件缺失/解码失败降级路径，实现复用 audio/sfx.ts） */
  function scheduleProcedural(voice: SfxVoice, rate: number): { endsAt: number; stop: () => void } | null {
    if (!ctx || !bus) return null;
    const t0 = ctx.currentTime;
    const end = scheduleProceduralVoice(
      ctx,
      bus,
      voice,
      rate,
      () => ctx.createOscillator(),
      () => ctx.createGain(),
    );
    return { endsAt: now() + (end - t0) * 1000, stop: () => {} };
  }

  function dispatch(eventId: SfxEventId, semitones: number): PlayReport {
    prune();
    const voice = SFX_VOICES[eventId];
    const rate = playbackRateFor(semitones);
    const durationMs = voice.durationMs / rate;

    if (voices.length >= poolSize) {
      if (!voice.critical) return { eventId, played: false, reason: 'pool-full', semitones, tier: 'silent' };
      const victim = stealOldestNonCritical(); // critical 永不挤占：抢占最老非 critical
      victim?.steal?.();
    }

    const b = buffers.get(eventId);
    let endsAt = now() + durationMs;
    let tier: PlayReport['tier'] = 'buffer';
    let steal: (() => void) | null = null;
    if (b) {
      const src = ctx!.createBufferSource();
      src.playbackRate.value = rate;
      src.onended = () => {};
      src.connect(ensureBus()!);
      src.start();
      steal = () => src.stop();
    } else {
      const proc = scheduleProcedural(voice, rate);
      if (proc) {
        endsAt = proc.endsAt;
        tier = 'procedural';
        steal = proc.stop;
      } else {
        ctx!.createBufferSource(); // 占位：保持调度语义（静音占位 buffer 场景）
        ctx!.createBuffer(1, 1, NUMERIC.audio.SAMPLE_RATE_HZ);
        tier = 'silent';
      }
    }
    voices.push({ id: ++voiceSeq, critical: voice.critical, endsAt, steal });
    return { eventId, played: true, reason: 'ok', semitones, tier };
  }

  return {
    unlock() {
      return (async () => {
        if (unlocked) return;
        try {
          await ctx?.resume();
        } catch {
          /* 解锁失败不抛错：下个手势再试 */
        }
        unlocked = (ctx?.state ?? 'suspended') === 'running';
        if (unlocked) {
          ensureBus();
          await preload(); // 先装载 sfx-pack buffer，再补放挂起队列（保证 buffer 层优先）
          while (pending.length) {
            const p = pending.shift()!;
            dispatch(p.eventId, p.semitones);
          }
        }
      })();
    },
    setMuted(m: boolean) {
      muted = m;
      try {
        storage?.setItem(MUTED_STORAGE_KEY, m ? '1' : '0');
      } catch {
        /* 存储不可用（隐私模式）：仅会话内生效，不抛错 */
      }
    },
    toggleMute() {
      this.setMuted(!muted);
      return muted;
    },
    isMuted: () => muted,
    play(eventId, semitones = 0) {
      if (muted) return { eventId, played: false, reason: 'muted', semitones, tier: 'silent' };
      if (!ctx) return { eventId, played: false, reason: 'no-ctx', semitones, tier: 'silent' };
      if (!unlocked) {
        if (pending.length < PENDING_CAP) pending.push({ eventId, semitones });
        return { eventId, played: false, reason: 'locked', semitones, tier: 'silent' };
      }
      return dispatch(eventId, semitones);
    },
    activeVoiceCount: () => {
      prune();
      return voices.length;
    },
    pendingCount: () => pending.length,
    dispose() {
      pending.length = 0;
      voices.length = 0;
    },
  };
}
