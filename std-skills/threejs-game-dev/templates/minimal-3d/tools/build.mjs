// build.mjs — 单文件构建器：src/main.js + three 全量内联 → index.html（零外部资源，勿手改产物）。
// 用法：node tools/build.mjs
// 产物自检硬失败：外链 / importmap / CDN 关键字 —— 单文件契约（tests/singlefile.contract.mjs 独立复判）。

import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { productSourceSha, FINGERPRINT_PATHS } from "./src-sha.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

console.log("[build] esbuild 打包 src/main.js（three 全量内联，minify + iife）…");
const res = await build({
  entryPoints: [path.join(root, "src/main.js")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  write: false,
  logLevel: "info",
  legalComments: "none",
});
let js = res.outputFiles[0].text;

const template = readFileSync(path.join(root, "index.template.html"), "utf8");
// 防止 </script> 提前闭合（three 产物内可能出现该串）
js = js.replace(/<\/script>/g, "<\\/script>");
const sha = productSourceSha(root);
const html = template
  .replace("<!--BUNDLE-->", () => js)
  .replace("<!DOCTYPE html>", () => `<!DOCTYPE html>\n<!--SRC_SHA=${sha}-->`);

const outPath = path.join(root, "index.html");
writeFileSync(outPath, html);

// 产物自检（硬失败：外链/外部引用一律不允许）
const externalRefs = [];
for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
  const url = m[1];
  if (!/^#|^data:|^javascript:/i.test(url)) externalRefs.push(url);
}
for (const m of html.matchAll(/\b(?:import|fetch)\s*\(\s*["']https?:/g)) externalRefs.push(m[0]);
if (/importmap|esm\.sh|unpkg\.com|cdn\.jsdelivr|jsdelivr\.net/i.test(html)) externalRefs.push("cdn/importmap 关键字命中");
if (externalRefs.length > 0) {
  console.error("CONTRACT: FAIL 产物含外部资源引用：", externalRefs.slice(0, 5));
  process.exit(1);
}

const bytes = Buffer.byteLength(html);
console.log(`[done] 产物 ${path.relative(root, outPath)} = ${(bytes / 1024).toFixed(0)} KB，零外部资源引用`);
console.log(`[done] SRC_SHA=${sha}（指纹范围：${FINGERPRINT_PATHS.join(" + ")}）`);
