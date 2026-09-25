function getAudioContext() {
    const g = globalThis;
    const Ctx = g.AudioContext ?? g.webkitAudioContext;
    if (!Ctx)
        return null;
    try {
        return new Ctx();
    }
    catch {
        return null;
    }
}
let ctx = null;
const SFX_TABLE = {
    place: { freqs: [120], durationMs: 90, type: 'sine', gain: 0.35 },
    perfect: { freqs: [880, 1320], durationMs: 180, type: 'triangle', gain: 0.22 },
    over: { freqs: [220, 165], durationMs: 320, type: 'sawtooth', gain: 0.18 },
};
function tone(voice) {
    if (!ctx)
        return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < voice.freqs.length; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const freq = voice.freqs[i];
        osc.type = voice.type;
        osc.frequency.value = freq;
        const start = t0 + i * 0.06; // 双音错开 60ms（叮的上扬感）
        gain.gain.setValueAtTime(voice.gain, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + voice.durationMs / 1000);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + voice.durationMs / 1000 + 0.02);
    }
}
/** WebAudio 输出（浏览器平台装配用；无 AudioContext 环境为静音） */
export function createWebAudioSink() {
    return {
        play(kind) {
            if (!ctx)
                ctx = getAudioContext();
            tone(SFX_TABLE[kind]);
        },
    };
}
/** 事件消费门面（app/main 用）：静音开关 + 主音量 */
export function createSfx(sink) {
    let muted = false;
    return {
        play(kind) {
            if (!muted)
                sink.play(kind);
        },
        toggleMute() {
            muted = !muted;
            return muted;
        },
    };
}
