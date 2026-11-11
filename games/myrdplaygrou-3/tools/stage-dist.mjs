// stage-dist.mjs — 部署产物同步：根 index.html → dist/web/index.html（AppHost assets_dir）。
// 构建器契约（preflight P1: scripts.build = node tools/build.mjs）不动根产物路径；
// 本脚本只做字节一致搬运 + 校验（防「构建了但部署目录是旧产物」的中间态）。
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const src = path.join(root, "index.html");
const outDir = path.join(root, "dist", "web");
const out = path.join(outDir, "index.html");

let srcBuf;
try {
  srcBuf = readFileSync(src);
} catch {
  console.error("STAGE: FAIL — index.html 不存在（先 node tools/build.mjs）");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
writeFileSync(out, srcBuf);
const outBytes = statSync(out).size;
if (outBytes !== srcBuf.length) {
  console.error(`STAGE: FAIL — 字节数不一致（${srcBuf.length} vs ${outBytes}）`);
  process.exit(1);
}
console.log(`STAGE: PASS — dist/web/index.html = ${outBytes} 字节（与根 index.html 逐字节一致）`);
