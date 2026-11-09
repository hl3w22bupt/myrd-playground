#!/usr/bin/env node
// 从终稿母带派生 ≥2 个差异化变体成片 (共享同一工程目录与素材基底 = 母带 + assets/vo + 三契约表)
// 差异化轴 (需求硬约束: 节奏/镜头顺序/配色至少一处差异化; 差异点取自 STORYLINES.md 选型决议素材池):
//   v2-tempo-cut   节奏轴: 每个段界前删 8 帧 (0.267s 段间静音), 1847f -> 1775f = 59.167s,
//                  视频与音频同表切割 => 音画同步按构造保持; 台匾硬摘与段切点重合处由硬切吸收
//   v3-dusk-grade  配色轴: 暮色蓝调 (冷阴影/冷中间调 + 微暖高光), colorbalance + eq, 单代重编码
// 用法: node scripts/make-variants.mjs <master.mp4>
// 帧精确切表见 qa/stage4-gates.md §变体; 全部输出再经 ffprobe + 抽帧回读验证
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const master = process.argv[2];
if (!master || !master.endsWith(".mp4")) {
  console.error("用法: node scripts/make-variants.mjs <master.mp4>");
  process.exit(1);
}
const PROJ = path.resolve(new URL("..", import.meta.url).pathname);
const OUT = path.join(PROJ, "variants");
mkdirSync(OUT, { recursive: true });
mkdirSync(path.join(PROJ, "qa", "variants"), { recursive: true });

// ---- v2 节奏变体: 半开区间 [a, b) 帧, 8 帧每切, 9 段 (qa/stage4-gates.md 切表同源)
const SEGS = [
  [0, 209], [217, 406], [414, 600], [608, 802], [810, 1029],
  [1037, 1254], [1262, 1486], [1494, 1665], [1673, 1839],
];
const n = SEGS.length;
const v = SEGS.map(([a, b], i) =>
  `[0:v]trim=start=${(a / 30).toFixed(5)}:end=${(b / 30).toFixed(5)},setpts=PTS-STARTPTS[v${i}]`).join(";");
const a = SEGS.map(([a, b], i) =>
  `[0:a]atrim=start=${(a / 30).toFixed(5)}:end=${(b / 30).toFixed(5)},asetpts=PTS-STARTPTS[a${i}]`).join(";");
const fc = `${v};${a};` +
  // ffmpeg 8 concat 输入按段交错: [v0][a0][v1][a1]... (实测 8.0.1, 先 v 后 a 的旧序会报 pad 类型错配)
  SEGS.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${n}:v=1:a=1[v][a]`;
const v2 = path.join(OUT, "v2-tempo-cut.mp4");
execFileSync("ffmpeg", ["-y", "-i", master, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", v2],
  { stdio: ["ignore", "ignore", "inherit"] });
console.log(`v2-tempo-cut.mp4  kept=${SEGS.reduce((s, [x, y]) => s + y - x, 0)}f  (${(SEGS.reduce((s, [x, y]) => s + y - x, 0) / 30).toFixed(3)}s)`);

// ---- v3 配色变体: 暮色蓝调 (草稿片上预验证参数, 见 qa/variants/ 对照帧)
const GRADE = "colorbalance=rs=-0.28:bs=0.38:rm=-0.16:bm=0.22:rh=-0.04:gh=0.02:bh=0.06," +
  "eq=saturation=0.92:contrast=1.06:brightness=-0.045";
const v3 = path.join(OUT, "v3-dusk-grade.mp4");
execFileSync("ffmpeg", ["-y", "-i", master, "-vf", GRADE,
  "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "copy", v3],
  { stdio: ["ignore", "ignore", "inherit"] });
console.log(`v3-dusk-grade.mp4  grade=${GRADE}`);

// ---- 台账: 派生出处与差异轴 (审计可溯)
writeFileSync(path.join(OUT, "DERIVATION.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  master: path.relative(PROJ, master),
  sharedBase: ["assets/blender/s1-s9.mp4 (终稿合封 crf17)", "assets/vo/*.mp3 (loudnorm -16/TP-1.5)",
    "compositions/overlay.html + captions.html (母带烘焙)", "SPEC 三契约表 SCENES/KEYS/PLAN"],
  v2: { file: "variants/v2-tempo-cut.mp4", axis: "节奏", method: "ffmpeg trim+concat 帧精确切表 (9 段, 每段界前删 8 帧)", keptFrames: SEGS.reduce((s, [x, y]) => s + y - x, 0) },
  v3: { file: "variants/v3-dusk-grade.mp4", axis: "配色", method: "ffmpeg colorbalance+eq 暮色蓝调 (参数预验证于草稿片)" },
}, null, 2));
console.log("DERIVATION.json written");
