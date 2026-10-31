#!/usr/bin/env node
// singlefile.contract.mjs — 单文件零外链契约（ac 级）：产物存在、three 全量内联、零外部资源引用。
// 构建器（tools/build.mjs）有同款自检 —— 这里独立复判，防产物被手改/替换绕过构建器检查。
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const prodPath = path.join(root, "index.html");

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

ok(existsSync(prodPath), "index.html 存在（先 node tools/build.mjs）");
if (existsSync(prodPath)) {
  const html = readFileSync(prodPath, "utf8");
  const bytes = statSync(prodPath).size;
  ok(bytes > 100 * 1024, `体积 ${(bytes / 1024).toFixed(0)} KB > 100KB（three 全量内联的体积下限）`);
  ok(html.includes("<!--SRC_SHA="), "产物带 SRC_SHA 源码指纹");

  const externals = [];
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    if (!/^#|^data:|^javascript:/i.test(m[1])) externals.push(m[1]);
  }
  for (const m of html.matchAll(/\b(?:import|fetch)\s*\(\s*["']https?:/g)) externals.push(m[0]);
  if (/importmap|esm\.sh|unpkg\.com|cdn\.jsdelivr|jsdelivr\.net/i.test(html)) externals.push("cdn/importmap 关键字命中");
  ok(externals.length === 0, externals.length ? `零外链违例：${externals.slice(0, 3).join(", ")}` : "零外部资源引用（无 src/href 外链、无 importmap、无 CDN 关键字）");

  ok(html.includes("ts-smoke"), "冒烟协议锚点 #ts-smoke 在产物中（browser-smoke 依赖）");
  ok(/smoke/.test(html) && html.includes("SMOKE"), "?smoke= 协议代码在产物中");
}

console.log(failures.length ? `SINGLEFILE-CONTRACT: FAIL（${failures.length}）` : "SINGLEFILE-CONTRACT: PASS");
process.exit(failures.length ? 1 : 0);
