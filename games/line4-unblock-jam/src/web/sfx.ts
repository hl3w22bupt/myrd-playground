// web/sfx.ts — 三档音效（line4-unblock-jam · 表现层）
//
// 参数单源 = assets/a06-sfx-pack.spec.json（tools/gen-audio 同谱系：拖动/驶出/通关三档，
// 波形/时长/增益逐值同账——重生成 hash 由 check-assets 门禁锚定，改值须先改生成器）。
// 宿主面：AudioContext 惰性创建（首手势解锁）；能力缺失=静默降级（零报错零阻塞）。
export interface SfxTier { id: 'drag' | 'exit' | 'clear'; waveform: 'square' | 'sine'; freqHz: number; durationMs: number; gain: number; }

// 镜像账面：assets/manifest.json → a06-sfx-pack.tiers（单源对账见 assets 门禁 31 断言）
export const SFX_TIERS: readonly SfxTier[] = [
  { id: 'drag', waveform: 'square', freqHz: 320, durationMs: 60, gain: 0.25 },
  { id: 'exit', waveform: 'sine', freqHz: 660, durationMs: 140, gain: 0.5 },
  { id: 'clear', waveform: 'sine', freqHz: 880, durationMs: 220, gain: 0.6 },
];

export function createSfx() {
  let ctx: AudioContext | null = null;
  const unlock = (): void => {
    if (ctx) return;
    const AC = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (AC) ctx = new AC();
  };
  const play = (id: SfxTier['id']): void => {
    if (!ctx) return;
    const tier = SFX_TIERS.find((t) => t.id === id);
    if (!tier) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tier.waveform;
    osc.frequency.value = tier.freqHz;
    gain.gain.setValueAtTime(tier.gain, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + tier.durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + tier.durationMs / 1000);
  };
  return { unlock, play };
}
