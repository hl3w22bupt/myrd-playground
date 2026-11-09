#!/usr/bin/env node
// 把 Blender PNG 序列合封为 assets/blender/<场景id>.mp4 (index.html footage-sN 的 src)
// 帧区间从 blender/build_scene.py 的 SCENES 表读取 (单一事实源, preflight 同源);
// 每段输出半开区间 [f0, f1) = f1-f0 帧 = (f1-f0)/30 秒, 与 index.html data-duration 严格一致
// (gotchas #G2: use_empty 下无 FFMPEG 枚举 → PNG 序列 + 外部 ffmpeg 合封; #G6: 边界帧共享)
// 用法:
//   node scripts/merge-scenes.mjs --tag _draft --crf 20   # 草稿档 (renders/s1_draft/...)
//   node scripts/merge-scenes.mjs --tag ""     --crf 17   # 终稿档 (renders/s1/...)
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const PROJ = path.resolve(new URL("..", import.meta.url).pathname);
// 兼容 --tag=_draft 与 --tag _draft 两种传参; 空串 = 终稿目录 (renders/s1/)
const argv = process.argv.slice(2);
const readOpt = (name, dflt) => {
  const i = argv.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i < 0) return dflt;
  if (argv[i].includes("=")) return argv[i].slice(name.length + 1).trim();
  return argv[i + 1] !== undefined ? argv[i + 1].trim() : dflt;
};
const tag = readOpt("--tag", "");
const crf = readOpt("--crf", "20");

const py = readFileSync(path.join(PROJ, "blender", "build_scene.py"), "utf8");
const block = py.match(/SCENES = \[([^\]]+)\]/);
if (!block) throw new Error("SCENES 表未找到 (blender/build_scene.py)");
const scenes = [...block[1].matchAll(/\("(\w+)",\s*(\d+),\s*(\d+)\)/g)].map(
  (r) => ({ id: r[1], f0: +r[2], f1: +r[3] })
);
if (!scenes.length) throw new Error("SCENES 表解析为空");

for (const { id, f0, f1 } of scenes) {
  const dir = path.join(PROJ, "blender", "renders", `${id}${tag}`);
  const first = path.join(dir, `frame${String(f0).padStart(4, "0")}.png`);
  const last = path.join(dir, `frame${String(f1 - 1).padStart(4, "0")}.png`);
  for (const f of [first, last]) {
    statSync(f); // 缺帧直接抛错, 不静默截短
  }
  const n = f1 - f0;
  const out = path.join(PROJ, "assets", "blender", `${id}.mp4`);
  execFileSync(
    "ffmpeg",
    ["-y", "-framerate", "30", "-start_number", String(f0),
     "-i", path.join(dir, "frame%04d.png"),
     "-frames:v", String(n), "-c:v", "libx264", "-crf", crf,
     "-pix_fmt", "yuv420p", out],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  console.log(`${id}.mp4  frames=${n}  (${(n / 30).toFixed(3)}s)  crf=${crf}`);
}
console.log(`merged ${scenes.length} scenes -> assets/blender/`);
