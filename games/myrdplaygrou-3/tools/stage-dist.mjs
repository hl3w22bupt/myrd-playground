// stage-dist.mjs — 部署产物同步：根 index.html → dist/web/index.html + landing.html（AppHost assets_dir）。
// 构建器契约（preflight P1: scripts.build = node tools/build.mjs）不动根产物路径；
// 本脚本只做字节一致搬运 + 校验（防「构建了但部署目录是旧产物」的中间态）。
//
// landing.html（2026-11-11 v3 部署实证）：共享壳 server/src/index.ts 的 GET / 优先伺服资产通道里的
// landing.html，缺文件回落内置 GAME_PAGE_HTML（植物人壳页）—— v3 部署 dist/web 只有 index.html，
// 线上 / 因此回落 16KB 壳页而非 589KB 游戏单文件。wheat-squad 判例（tools/build.mjs:85-90）：
// 落地页文件名 = landing.html。本工程是单文件零外链路线（P7 机判无 src/href 外链），无需改写
// 引用路径，landing.html 与 index.html 逐字节一致即可。
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const src = path.join(root, "index.html");
const outDir = path.join(root, "dist", "web");
const out = path.join(outDir, "index.html");
const landing = path.join(outDir, "landing.html");

let srcBuf;
try {
  srcBuf = readFileSync(src);
} catch {
  console.error("STAGE: FAIL — index.html 不存在（先 node tools/build.mjs）");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
writeFileSync(out, srcBuf);
writeFileSync(landing, srcBuf);
const outBytes = statSync(out).size;
const landingBytes = statSync(landing).size;
if (outBytes !== srcBuf.length || landingBytes !== srcBuf.length) {
  console.error(`STAGE: FAIL — 字节数不一致（源 ${srcBuf.length} / index ${outBytes} / landing ${landingBytes}）`);
  process.exit(1);
}
console.log(`STAGE: PASS — dist/web/index.html = ${outBytes} 字节 + dist/web/landing.html = ${landingBytes} 字节（与根 index.html 逐字节一致）`);
