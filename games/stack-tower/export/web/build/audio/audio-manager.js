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
import { SFX_VOICES } from './voices.js';
import { scheduleProceduralVoice } from './sfx.js';
export const MUTED_STORAGE_KEY = 'st.settings.muted';
const PENDING_CAP = 16;
/** 连击 → 升调半音数：min(combo, CAP)；miss（combo=0）归零 */
export function semitonesForCombo(combo) {
    return Math.max(0, Math.min(combo, NUMERIC.audio.COMBO_PITCH_CAP_SEMITONES));
}
/** 半音 → playbackRate：2^(n/12) */
export function playbackRateFor(semitones) {
    return 2 ** (semitones / 12);
}
export function createAudioManager(deps) {
    const { ctx, storage, loadBuffer, now } = deps;
    const busGain = NUMERIC.audio.SFX_BUS_GAIN;
    const poolSize = NUMERIC.audio.VOICE_POOL_SIZE;
    let muted = storage?.getItem(MUTED_STORAGE_KEY) === '1';
    let unlocked = false;
    let bus = null;
    let voiceSeq = 0;
    const pending = [];
    const voices = [];
    const buffers = new Map();
    function ensureBus() {
        if (!ctx)
            return null;
        if (!bus) {
            bus = ctx.createGain();
            bus.gain.value = busGain; // numeric.audio.SFX_BUS_GAIN
            bus.connect(ctx.destination);
        }
        return bus;
    }
    function silentBuffer() {
        // 静音占位 buffer：保调度路径先行（无音频文件/无输出设备时测试仍可先行）
        return ctx.createBuffer(1, 1, NUMERIC.audio.SAMPLE_RATE_HZ);
    }
    async function preload() {
        await Promise.allSettled(Object.keys(SFX_VOICES).map(async (id) => {
            if (buffers.has(id))
                return;
            try {
                buffers.set(id, await loadBuffer(id));
            }
            catch {
                buffers.set(id, null); // 降级：程序化合成
            }
        }));
    }
    function prune() {
        const t = now();
        for (let i = voices.length - 1; i >= 0; i--)
            if (voices[i].endsAt <= t)
                voices.splice(i, 1);
    }
    function stealOldestNonCritical() {
        for (let i = 0; i < voices.length; i++) {
            if (!voices[i].critical)
                return voices.splice(i, 1)[0];
        }
        return null;
    }
    /** 程序化合成（voices.ts 同表；文件缺失/解码失败降级路径，实现复用 audio/sfx.ts） */
    function scheduleProcedural(voice, rate) {
        if (!ctx || !bus)
            return null;
        const t0 = ctx.currentTime;
        const end = scheduleProceduralVoice(ctx, bus, voice, rate, () => ctx.createOscillator(), () => ctx.createGain());
        return { endsAt: now() + (end - t0) * 1000, stop: () => { } };
    }
    function dispatch(eventId, semitones) {
        prune();
        const voice = SFX_VOICES[eventId];
        const rate = playbackRateFor(semitones);
        const durationMs = voice.durationMs / rate;
        if (voices.length >= poolSize) {
            if (!voice.critical)
                return { eventId, played: false, reason: 'pool-full', semitones, tier: 'silent' };
            const victim = stealOldestNonCritical(); // critical 永不挤占：抢占最老非 critical
            victim?.steal?.();
        }
        const b = buffers.get(eventId);
        let endsAt = now() + durationMs;
        let tier = 'buffer';
        let steal = null;
        if (b) {
            const src = ctx.createBufferSource();
            src.playbackRate.value = rate;
            src.onended = () => { };
            src.connect(ensureBus());
            src.start();
            steal = () => src.stop();
        }
        else {
            const proc = scheduleProcedural(voice, rate);
            if (proc) {
                endsAt = proc.endsAt;
                tier = 'procedural';
                steal = proc.stop;
            }
            else {
                ctx.createBufferSource(); // 占位：保持调度语义（静音占位 buffer 场景）
                ctx.createBuffer(1, 1, NUMERIC.audio.SAMPLE_RATE_HZ);
                tier = 'silent';
            }
        }
        voices.push({ id: ++voiceSeq, critical: voice.critical, endsAt, steal });
        return { eventId, played: true, reason: 'ok', semitones, tier };
    }
    return {
        unlock() {
            return (async () => {
                if (unlocked)
                    return;
                try {
                    await ctx?.resume();
                }
                catch {
                    /* 解锁失败不抛错：下个手势再试 */
                }
                unlocked = (ctx?.state ?? 'suspended') === 'running';
                if (unlocked) {
                    ensureBus();
                    await preload(); // 先装载 sfx-pack buffer，再补放挂起队列（保证 buffer 层优先）
                    while (pending.length) {
                        const p = pending.shift();
                        dispatch(p.eventId, p.semitones);
                    }
                }
            })();
        },
        setMuted(m) {
            muted = m;
            try {
                storage?.setItem(MUTED_STORAGE_KEY, m ? '1' : '0');
            }
            catch {
                /* 存储不可用（隐私模式）：仅会话内生效，不抛错 */
            }
        },
        toggleMute() {
            this.setMuted(!muted);
            return muted;
        },
        isMuted: () => muted,
        play(eventId, semitones = 0) {
            if (muted)
                return { eventId, played: false, reason: 'muted', semitones, tier: 'silent' };
            if (!ctx)
                return { eventId, played: false, reason: 'no-ctx', semitones, tier: 'silent' };
            if (!unlocked) {
                if (pending.length < PENDING_CAP)
                    pending.push({ eventId, semitones });
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
