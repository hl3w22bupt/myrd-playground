#!/usr/bin/env node
// singlefile.contract.mjs — ac-1：构建产物必须是零外部资源的单文件。
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "index.html");
const failures = [];
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => failures.push(m);

if (!existsSync(htmlPath)) {
  console.error("CONTRACT: FAIL 缺少构建产物 index.html（先运行 node tools/build.mjs）");
  process.exit(1);
}
const html = readFileSync(htmlPath, "utf8");
pass(`产物存在: ${path.relative(root, htmlPath)}（${(Buffer.byteLength(html) / 1024).toFixed(0)} KB）`);

// ① 不允许 src/href 形式的外部引用（data:/锚点除外）
const refs = [];
for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
  if (!/^#|^data:|^javascript:/i.test(m[1])) refs.push(m[1]);
}
if (refs.length === 0) pass("无 src/href 外部引用（零图片/脚本/样式外链）");
else fail(`存在外部引用: ${refs.slice(0, 5).join(", ")}`);

// ② 不允许 CDN / importmap / 动态远程 import
const cdnHits = html.match(/importmap|esm\.sh|unpkg\.com|cdn\.jsdelivr|jsdelivr\.net|cdnjs\.cloudflare/i);
if (!cdnHits) pass("无 importmap / CDN 域名命中");
else fail(`命中 CDN/importmap 关键字: ${cdnHits[0]}`);

// ③ three 与游戏本体必须内联（<script> 至少一大段）
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1].length);
if (scripts.length >= 1 && Math.max(...scripts) > 300000) pass(`内联脚本就绪（最大块 ${(Math.max(...scripts) / 1024).toFixed(0)} KB，three+游戏本体）`);
else fail("未检出内联大脚本块（three 未内联？）");

// ④ 关键 DOM 骨架在产物里（canvas + ui + HUD 风格卡）
for (const marker of ['id="gl"', 'id="ui"', "clip-path", "--font-num"]) {
  if (html.includes(marker)) pass(`产物包含 ${marker}`);
  else fail(`产物缺少 ${marker}`);
}

if (failures.length) { console.error("—— 合计 FAIL ——"); for (const f of failures) console.error(`  FAIL  ${f}`); process.exit(1); }
console.log("CONTRACT: PASS 单文件零外部资源约束成立");
