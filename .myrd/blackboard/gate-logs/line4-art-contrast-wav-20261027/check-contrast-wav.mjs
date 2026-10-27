// check-contrast-wav.mjs —— 美术线独立机判（2026-10-27 · 锚 f6b1cce/e97356f）
// ① WCAG 2.x 相对亮度对比度（文本 4.5:1 / 非文本图形 3:1 参考线）
// ② a06 音效 WAV 头独立解析（RIFF/fmt/data 原始字节，非生成器自报值）
// 色值源=风格卡 v1 冻结 8 色板（≡ theme.ts PALETTE，§五 C1 三方全等判例）；零共享生成链实现。
import { readFileSync } from 'node:fs';

const P = {
  ground: '#F2EFE6', gridLine: '#D9D2C5', ink: '#2B2D42', shadow: '#111111',
  target: '#EF4444', carWarm: '#F59E0B', carCool: '#10B981', carAlt: '#3B82F6',
};
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
// HUD 面板合成底：ground@85% alpha 叠其下最暗常见区（障碍/网格 #D9D2C5）——逐通道线性混合
const mix = (h1, h2, a) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(h1.slice(i, i + 2), 16) * a + parseInt(h2.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
const hudPanelWorst = mix(P.ground, P.gridLine, 0.85);

console.log('== ① WCAG 对比度机判（文本≥4.5 / 图形≥3.0 参考线） ==');
const pairs = [
  ['ink-on-ground(T1)', P.ink, P.ground, 4.5, '顶部标签/combo弹字/引导描线 on 地面'],
  ['ink-on-hud-panel-worst(T2)', P.ink, hudPanelWorst, 4.5, `HUD面板=ground@85%叠最暗常见底合成 ${hudPanelWorst}`],
  ['target-vs-ground(G1)', P.target, P.ground, 3.0, '目标车 vs 地面'],
  ['carWarm-vs-ground(G2)', P.carWarm, P.ground, 3.0, '普通车暖档 vs 地面'],
  ['carCool-vs-ground(G3)', P.carCool, P.ground, 3.0, '普通车冷档/出口门常态 vs 地面'],
  ['carAlt-vs-ground(G4)', P.carAlt, P.ground, 3.0, '普通车蓝档/引导件 vs 地面'],
  ['obstacle-vs-ground(G5)', P.gridLine, P.ground, 3.0, '障碍 vs 地面（F1 可读性候选）'],
  ['gateRed-vs-targetCar(G6)', P.target, P.target, 1.0, '红轮出口门 vs 目标车（D-2 量化）'],
  ['gridLine-vs-ground(G7)', P.gridLine, P.ground, 1.0, '网格线 vs 地面（低对比=风格卡「密度不描边」设计）'],
];
for (const [name, f, b, ref, note] of pairs) {
  const r = ratio(f, b);
  const ok = r >= ref ? 'PASS' : 'FINDING';
  console.log(`${ok}  ${name}  ${r.toFixed(2)}:1 (ref ${ref}:1)  ${note}`);
}

console.log('== ② a06 WAV 头独立解析 vs spec 期望 ==');
const spec = JSON.parse(readFileSync('games/line4-unblock-jam/assets/a06-sfx-pack.spec.json', 'utf8'));
for (const t of spec.tiers) {
  const buf = readFileSync(`games/line4-unblock-jam/assets/audio/${t.id}.wav`);
  const riff = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE';
  const fmt = buf.readUInt16LE(20), ch = buf.readUInt16LE(22);
  const hz = buf.readUInt32LE(24), byteRate = buf.readUInt32LE(28), bits = buf.readUInt16LE(34);
  const dataSize = buf.readUInt32LE(40);
  const ms = (dataSize / byteRate) * 1000;
  const durOk = Math.abs(ms - t.durationMs) <= 2;
  console.log(`${riff && durOk ? 'PASS' : 'FINDING'}  ${t.id}.wav  riff=${riff} fmt=${fmt} ch=${ch} ${hz}Hz ${bits}bit  实测${ms.toFixed(1)}ms vs spec ${t.durationMs}ms  bytes=${buf.length}`);
}
