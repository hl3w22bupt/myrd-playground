#!/usr/bin/env node
// 下载 Google Fonts 中文字体 (unicode-range 子集) 到 assets/fonts/
// 用法: node scripts/fetch-fonts.mjs
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

const exists = async (p) => access(p).then(() => true, () => false);

const PROJ = path.resolve(new URL("..", import.meta.url).pathname);
const OUT = path.join(PROJ, "assets", "fonts");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@900&family=Noto+Sans+SC:wght@400;500;700&display=swap";

await mkdir(OUT, { recursive: true });
const cssRes = await fetch(CSS_URL, { headers: { "User-Agent": UA } });
if (!cssRes.ok) throw new Error(`css fetch failed: ${cssRes.status}`);
const css = await cssRes.text();

// 解析 @font-face 块
const blocks = [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => m[0]);
console.log(`@font-face blocks: ${blocks.length}`);

let i = 0;
const out = [];
for (const block of blocks) {
  const urlMatch = block.match(/url\((https:[^)]+\.woff2)\)/);
  if (!urlMatch) continue;
  const url = urlMatch[1];
  const family = block.match(/font-family:\s*'([^']+)'/)?.[1] ?? "font";
  const weight = block.match(/font-weight:\s*(\d+)/)?.[1] ?? "400";
  const name = `${family.replace(/\s+/g, "")}-${weight}-${String(i++).padStart(3, "0")}.woff2`;
  const dest = path.join(OUT, name);
  if (!(await exists(dest))) {
    const bin = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
    await writeFile(dest, bin);
  }
  // css 内 url 相对 CSS 文件自身位置 → 裸文件名
  out.push(block.replace(url, name));
  process.stdout.write(`\rdownloaded ${i}/${blocks.length}`);
}
console.log(`\nwriting assets/fonts/noto-sc.css`);
await writeFile(path.join(OUT, "noto-sc.css"), out.join("\n") + "\n");
console.log("done");
