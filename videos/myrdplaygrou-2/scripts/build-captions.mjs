#!/usr/bin/env node
// 从 edge-tts 的 SRT 词块 + 场景时间表生成 compositions/captions.html
// 组策略: 按 ,。、—— 切短语, 合并到 ≤9 字; 组窗口按字数比例分配
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PROJ = path.resolve(new URL("..", import.meta.url).pathname);

// 场景时间表 (与 blender SCENES 一致, 秒)
// voAt = 段首帧 ÷ 30fps + 0.4s 入缓冲; 段边界由 assets/vo/*.mp3 ffprobe 实测反推 (SPEC.md §2/§4)
// 实测台账 2026-11-09: s1 6.528 / s2 5.856 / s3 5.784 / s4 6.024 / s5 6.888
//                      s6 6.792 / s7 7.032 / s8 5.256 / s9 5.112 (Σ55.272, 全片 1847f=61.5667s)
const PLAN = [
  { id: "s1", voAt: 0.4 },
  { id: "s2", voAt: 7.633 },
  { id: "s3", voAt: 14.2 },
  { id: "s4", voAt: 20.667 },
  { id: "s5", voAt: 27.4 },
  { id: "s6", voAt: 34.967 },
  { id: "s7", voAt: 42.467 },
  { id: "s8", voAt: 50.2 },
  { id: "s9", voAt: 56.167 },
];

function parseSrt(srt) {
  return srt.trim().split(/\n\n+/).map((block) => {
    const [, win, text] = block.split("\n");
    const [a, b] = win.split(" --> ").map((t) => {
      const [h, m, rest] = t.split(":");
      return (+h) * 3600 + (+m) * 60 + parseFloat(rest.replace(",", "."));
    });
    return { a, b, text: text.trim() };
  });
}

// 切组: 短语 ≤9 字
function splitGroups(text) {
  const parts = text.split(/(?<=[，。、——])/).map((s) => s.trim()).filter(Boolean);
  const groups = [];
  for (const p of parts) {
    const cleanLen = (s) => s.replace(/[，。、——]/g, "").length;
    const last = groups[groups.length - 1];
    if (last && cleanLen(last) + cleanLen(p) <= 9) groups[groups.length - 1] = last + p;
    else groups.push(p);
  }
  return groups;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let html = [];
let tweens = [];
let gi = 0;
for (const scene of PLAN) {
  const srt = parseSrt(await readFile(path.join(PROJ, "assets", "vo", `${scene.id}.srt`), "utf8"));
  const items = []; // {text, a, b} 跨块收集
  for (const blk of srt) {
    const groups = splitGroups(blk.text);
    const weights = groups.map((g) => g.replace(/[，。、——]/g, "").length || 1);
    const wsum = weights.reduce((a, b) => a + b, 0);
    let t = blk.a;
    for (let k = 0; k < groups.length; k++) {
      const dur = (blk.b - blk.a) * (weights[k] / wsum);
      items.push({ text: groups[k], a: scene.voAt + t - 0.12, b: scene.voAt + t + dur + 0.28 });
      t += dur;
    }
  }
  // 端点互斥 (跨块): 上一组 end 钳到下一组 start - 0.04
  for (let k = 0; k < items.length - 1; k++) {
    if (items[k].b > items[k + 1].a - 0.04) items[k].b = items[k + 1].a - 0.04;
  }
  for (const { text, a: start, b: end } of items) {
    if (end - start < 0.3) continue;
    const id = `cap-g${++gi}`;
    html.push(
      `    <div id="${id}" class="clip" data-start="${start.toFixed(2)}" data-duration="${(end - start).toFixed(2)}">` +
      `<span class="cap-text">${esc(text)}</span></div>`);
    tweens.push({ id, start, end });
  }
}

const tweenJs = tweens.map((g) =>
  `  tl.fromTo("#${g.id} .cap-text", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, ${g.start.toFixed(2)});\n` +
  `  tl.to("#${g.id} .cap-text", { opacity: 0, duration: 0.1, ease: "power2.in" }, ${(g.end - 0.12).toFixed(2)});\n` +
  `  tl.set("#${g.id} .cap-text", { visibility: "hidden" }, ${g.end.toFixed(2)});`
).join("\n");

const out = `<!-- 由 scripts/build-captions.mjs 生成; 改时间表后重新生成 -->
<template>
  <link rel="stylesheet" href="assets/fonts/noto-sc.css">
  <style>
    #root { position: absolute; inset: 0; }
    .cap-group-host { position: absolute; inset: 0; }
    .clip {
      position: absolute; left: 18%; right: 18%; bottom: 84px;
      text-align: center; overflow: visible;
    }
    .cap-text {
      display: inline-block;
      font-family: "Noto Sans SC", sans-serif;
      font-weight: 500;
      font-size: 46px;
      line-height: 1.25;
      color: #FFF8EC;
      letter-spacing: 0.04em;
      background: rgba(14, 8, 6, 0.62);
      padding: 10px 26px 12px;
      border-radius: 4px;
    }
  </style>
  <div id="root" data-composition-id="captions" data-width="1920" data-height="1080">
    <div class="cap-group-host" data-layout-allow-caption-zone>
${html.join("\n")}
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
${tweenJs}
    window.__timelines["captions"] = tl;
  </script>
</template>
`;

await writeFile(path.join(PROJ, "compositions", "captions.html"), out);
console.log(`captions.html written: ${gi} groups`);
