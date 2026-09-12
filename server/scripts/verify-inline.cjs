/**
 * 内联资产完整性自检（模拟浏览器侧解码路径）：
 * 从 src/generated/assets.generated.ts 取 base64 → gunzip → wasm 校验 / pck 魔数校验，
 * 并确认游戏数据 JSON 确实打进 pck（人设卡/剧情幕/数值表缺一不可，否则 Web 版读不到数据）。
 * 用法：node scripts/verify-inline.cjs
 */
const fs = require("node:fs");
const zlib = require("node:zlib");

const src = fs.readFileSync(__dirname + "/../src/generated/assets.generated.ts", "utf8");

function extract(name) {
  const idx = src.indexOf('"' + name + '"');
  if (idx < 0) throw new Error("missing asset " + name);
  const enc = src.slice(idx).match(/encoding: '(\w+)'/)[1];
  const start = src.indexOf('data: "', idx) + 7;
  const end = src.indexOf('" }', start);
  return { encoding: enc, data: src.slice(start, end) };
}

const js = extract("index.js");
console.log("index.js  encoding=%s bytes=%d head=%s", js.encoding, js.data.length, JSON.stringify(js.data.slice(0, 40)));

const wasm = extract("index.wasm.gz.b64");
const w = zlib.gunzipSync(Buffer.from(wasm.data, "base64"));
const valid = WebAssembly.validate(w);
const mod = new WebAssembly.Module(w);
console.log("wasm      gunzip=%dB validate=%s compileImports=%d compileExports=%d", w.length, valid, WebAssembly.Module.imports(mod).length, WebAssembly.Module.exports(mod).length);
if (!valid) throw new Error("wasm invalid");

const pck = extract("index.pck.gz.b64");
const p = zlib.gunzipSync(Buffer.from(pck.data, "base64"));
console.log("pck       gunzip=%dB magic=%s", p.length, JSON.stringify(p.subarray(0, 4).toString("ascii")));
if (p.subarray(0, 4).toString("ascii") !== "GDPC") throw new Error("pck magic mismatch");

// 游戏数据契约：剧情生存游戏的三类数据必须进 pck（include_filter="*.json" 的效果验证）
const pckText = p.toString("latin1");
const requiredInPck = [
  "data/personas/persona-lumi.json",
  "data/personas/persona-vex.json",
  "data/story/act1.json",
  "data/story/act3.json",
  "data/spec/numeric.json",
];
for (const f of requiredInPck) {
  if (!pckText.includes(f)) throw new Error("pck 缺少游戏数据: " + f);
}
console.log("pck data  %d 条数据路径全部命中（人设卡/剧情幕/数值表）", requiredInPck.length);

console.log("VERIFY-INLINE: PASS");
