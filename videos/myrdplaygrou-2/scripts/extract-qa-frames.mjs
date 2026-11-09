#!/usr/bin/env node
// 门禁 e (亲自抽帧看成片): 从成片 mp4 提取 SPEC §7 QA 锚点 4 帧 + 均匀 12 帧 (风格覆盖核验)
// 输出 qa/final-frames/, 供逐帧目测对照; 帧时刻与 SPEC §7 锚点表同源
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const master = process.argv[2];
if (!master) {
  console.error("用法: node scripts/extract-qa-frames.mjs <master.mp4>");
  process.exit(1);
}
const PROJ = path.resolve(new URL("..", import.meta.url).pathname);
const OUT = path.join(PROJ, "qa", "final-frames");
mkdirSync(OUT, { recursive: true });

// SPEC §7: 帧 = 30 × t; f30→1.0s, f500→16.667s, f950→31.667s, f1840→61.333s
const ANCHORS = { "anchor-f30-t1.000s": 1.0, "anchor-f500-t16.667s": 16.667, "anchor-f950-t31.667s": 31.667, "anchor-f1840-t61.333s": 61.333 };
for (const [name, t] of Object.entries(ANCHORS)) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(t), "-i", master, "-frames:v", "1", path.join(OUT, `${name}.png`)]);
  console.log(`${name}.png`);
}
// 均匀 12 帧 (每 5s, +0.5s 偏移避开切点): 风格覆盖 ≥80% 核验样本
for (let k = 0; k < 12; k++) {
  const t = 0.5 + k * 5;
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", t.toFixed(3), "-i", master, "-frames:v", "1", path.join(OUT, `grid-t${t.toFixed(1)}s.png`)]);
}
console.log(`grid x12 (t=0.5..55.5 step 5s) -> qa/final-frames/`);
