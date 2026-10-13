#!/usr/bin/env node
// asset-query.mjs — CC0 资产库语义查询：按关键词（中文子串 / 英文分词）查可用资产，
// 输出路径 + 接入提示（usage）。零依赖；agent 在 scaffold/implement 节点用它选资产。
//
// 用法：
//   node asset-query.mjs --need "收集反馈 粒子"          # 关键词查询（多词 OR，命中标签/文件名）
//   node asset-query.mjs --need "collect spark" --json   # 机器可读输出
//   node asset-query.mjs --list                          # 全库清单
// 退出码：0 = 有命中；1 = 无命中（换词或提工单扩库）；2 = 用法/库损坏。

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, "..", "assets", "cc0");

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

if (!existsSync(path.join(LIB, "tags.json"))) {
  console.error(`ASSET_QUERY: FAIL(2) — 资产字典缺失（${LIB}/tags.json）——库未就位，属环境问题`);
  process.exit(2);
}
const tags = JSON.parse(readFileSync(path.join(LIB, "tags.json"), "utf-8"));

if (args.includes("--list")) {
  for (const e of tags.entries) console.log(`${e.file}\n    ${e.zh.join("/")} | ${e.en.join("/")}\n    ${e.usage}`);
  process.exit(0);
}

const need = flag("--need");
if (!need) { console.error("用法: node asset-query.mjs --need \"关键词\" [--json] | --list"); process.exit(2); }
const words = need.toLowerCase().split(/[\s,，、/]+/).filter(Boolean);

const hits = [];
for (const e of tags.entries) {
  const haystack = [e.file, ...e.zh, ...e.en].join(" ").toLowerCase();
  if (words.some((w) => haystack.includes(w))) {
    const abs = path.join(LIB, e.file);
    hits.push({
      file: e.file, absolute: abs, exists: existsSync(abs),
      zh: e.zh, en: e.en, usage: e.usage,
    });
  }
}

if (args.includes("--json")) {
  console.log(JSON.stringify({ need, hits }, null, 2));
} else if (hits.length === 0) {
  console.log(`ASSET_QUERY: 无命中（${need}）——换词重试，或按 LICENSES.md 登记新 CC0 素材扩库`);
} else {
  console.log(`ASSET_QUERY: ${hits.length} 项命中（${need}）`);
  for (const h of hits) {
    console.log(`  ${h.exists ? "✔" : "✘文件缺失"} ${h.file}`);
    console.log(`      ${h.zh.join("/")} | ${h.en.join("/")}`);
    console.log(`      ${h.usage}`);
  }
}
process.exit(hits.length > 0 ? 0 : 1);
