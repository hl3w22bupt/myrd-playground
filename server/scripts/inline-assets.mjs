/**
 * 构建期内联脚本（postinstall 触发）：
 * 把 games/ai/export/web 的 Web 导出产物转成 TypeScript 字符串常量模块，
 * 供 esbuild 在部署管线步骤 3 打进自包含 bundle（运行实例无文件系统，只能内联）。
 *
 * 二进制产物（.wasm / .pck）：gzip 压缩后再 base64 —— M1 网关只透传文本响应，
 *   gzip 让 36MB 的 wasm 变成 ~9MB（base64 后 ~12.5MB），落在 bundle 25MB 上限内；
 *   浏览器侧 base64 → Uint8Array → DecompressionStream('gzip') 还原。
 * 文本产物（.js / worklet）：JSON.stringify 后原样内联，以 text/javascript 伺服。
 *
 * 产物：src/generated/assets.generated.ts（已 gitignore，tsc --noEmit 前生成）。
 */
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..");
const exportDir = resolve(serverDir, "..", "games", "ai", "export", "web");
const outFile = resolve(serverDir, "src", "generated", "assets.generated.ts");

/** 内联资产清单：name = 伺服路径名，file = 导出目录内文件名 */
const RAW_TEXT_ASSETS = [
  { name: "index.js", file: "index.js", contentType: "text/javascript; charset=utf-8" },
  { name: "index.audio.worklet.js", file: "index.audio.worklet.js", contentType: "text/javascript; charset=utf-8" },
  {
    name: "index.audio.position.worklet.js",
    file: "index.audio.position.worklet.js",
    contentType: "text/javascript; charset=utf-8",
  },
];
const GZIP_ASSETS = [
  { name: "index.wasm.gz.b64", file: "index.wasm" },
  { name: "index.pck.gz.b64", file: "index.pck" },
];

if (!existsSync(exportDir)) {
  console.error(
    `[inline-assets] FAIL 找不到 Web 导出目录 ${exportDir}；请先在 games/ai 执行 ` +
      `godot --headless --export-release "Web" export/web/index.html`,
  );
  process.exit(1);
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;
const lines = [
  "/**",
  " * 自动生成 —— 由 scripts/inline-assets.mjs（postinstall）产出，禁止手改。",
  ` * 来源：games/ai/export/web（Godot Web 导出产物，gzip+base64 内联以适配 M1 文本网关）。`,
  " */",
  "",
  "export interface InlineAsset {",
  "  /** 伺服名（/api/public/assets/<name>） */",
  "  name: string;",
  "  /** raw = 文本原样；gzipB64 = gzip 压缩后 base64 的 ASCII 文本 */",
  "  encoding: 'raw' | 'gzipB64';",
  "  contentType: string;",
  "  data: string;",
  "}",
  "",
  "export const INLINE_ASSETS: InlineAsset[] = [",
];

for (const { name, file, contentType } of RAW_TEXT_ASSETS) {
  const p = join(exportDir, file);
  if (!existsSync(p)) {
    console.error(`[inline-assets] FAIL 导出产物缺失：${p}`);
    process.exit(1);
  }
  const text = readFileSync(p, "utf8");
  lines.push(
    `  { name: ${JSON.stringify(name)}, encoding: 'raw', contentType: ${JSON.stringify(contentType)}, data: ${JSON.stringify(text)} },`,
  );
  console.log(`[inline-assets] raw  ${name.padEnd(32)} ${mb(statSync(p).size)}`);
}

for (const { name, file } of GZIP_ASSETS) {
  const p = join(exportDir, file);
  if (!existsSync(p)) {
    console.error(`[inline-assets] FAIL 导出产物缺失：${p}`);
    process.exit(1);
  }
  const gz = gzipSync(readFileSync(p), { level: 9 });
  const b64 = gz.toString("base64");
  lines.push(
    `  { name: ${JSON.stringify(name)}, encoding: 'gzipB64', contentType: 'text/plain; charset=utf-8', data: ${JSON.stringify(b64)} },`,
  );
  console.log(`[inline-assets] gzip ${name.padEnd(32)} ${mb(statSync(p).size)} -> ${mb(gz.length)} -> ${mb(b64.length)} b64`);
}

lines.push("];", "");
lines.push("export const ASSET_MAP: Readonly<Record<string, InlineAsset>> = Object.fromEntries(");
lines.push("  INLINE_ASSETS.map((a) => [a.name, a]),");
lines.push(");");
lines.push("");

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, lines.join("\n"), "utf8");
console.log(`[inline-assets] OK 生成 ${outFile}（共 ${INLINE_COUNT(lines)} 条资产）`);

function INLINE_COUNT(l) {
  return l.filter((x) => x.startsWith("  { name:")).length;
}
