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
/** 浏览器共享 AudioContext（AudioManager 装配用；无 AudioContext 环境返回 null） */
export function sharedAudioContext() {
    if (!ctx)
        ctx = getAudioContext();
    return ctx;
}
/** 程序化合成单音色（多频按 60ms 错开；rate 用于连击升调）。返回结束时刻（ctx 时钟，秒） */
export function scheduleProceduralVoice(audioCtx, bus, voice, rate, mkOsc, mkGain) {
    const t0 = audioCtx.currentTime;
    let last = 0;
    for (let i = 0; i < voice.freqs.length; i++) {
        const osc = mkOsc();
        const gain = mkGain();
        osc.type = voice.type;
        osc.frequency.value = voice.freqs[i] * rate;
        const start = t0 + i * 0.06; // 双音错开 60ms（叮的上扬感）
        const dur = voice.durationMs / 1000 / rate;
        if (gain.gain.setValueAtTime)
            gain.gain.setValueAtTime(voice.gain, start);
        else
            gain.gain.value = voice.gain;
        osc.connect(gain);
        gain.connect(bus);
        osc.start(start);
        osc.stop(start + dur + 0.02);
        last = Math.max(last, start + dur);
    }
    return last;
}
