#!/usr/bin/env node
// mobile_smoke_selftest.mjs — mobile-web-smoke.mjs 的判定力自测（负例验证：门禁必须能抓住坏页）。
// 本地 http 伺服 3 个 fixture 页面：好页（动画 + 触摸响应 + 音频契约全齐）、坏页 A（未捕获异常 +
// 纯色静止画面）、坏页 B（关键资源 404）。断言退出码 0 / 1 / 1。
// 用法：node mobile_smoke_selftest.mjs [--chrome <path>]；退出码 0 = 自测通过。
// 与 preflight_selftest.py / gate-selftest.sh 同属「判定器自身的负例验证」纪律。

import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const SCRIPT = path.join(import.meta.dirname, "mobile-web-smoke.mjs");
const CHROME_ARG = flag("--chrome", "");

// —— 好页：rAF 动画（帧差>0）、touchstart 后画面变化（触摸有响应）、__audioDebug、viewport meta ——
const GOOD_PAGE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;overflow:hidden}canvas{display:block}</style></head><body>
<canvas id="c" width="390" height="844"></canvas>
<script>
window.__audioDebug = function () { return { state: "running" }; };
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
let t = 0, flash = 0;
document.addEventListener("touchstart", () => { flash = 30; }, { passive: true });
(function draw() {
  t += 0.05;
  ctx.fillStyle = flash > 0 ? "#802020" : "#101820"; flash -= 1;
  ctx.fillRect(0, 0, 390, 844);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = "hsl(" + ((i * 45 + t * 20) % 360) + ",70%,55%)";
    ctx.fillRect(40 + i * 42, 380 + Math.sin(t + i) * 60, 30, 30);
  }
  requestAnimationFrame(draw);
})();
</script></body></html>`;

// —— 坏页 A：加载即未捕获异常 + 全屏纯色静止画面（无动画、触摸无响应、无音频契约）——
const BAD_CONSOLE_PAGE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;overflow:hidden}canvas{display:block}</style></head><body>
<canvas id="c" width="390" height="844"></canvas>
<script>
const ctx = document.getElementById("c").getContext("2d");
ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 390, 844);
throw new Error("boom: engine boot failed");
</script></body></html>`;

// —— 坏页 B：关键资源（.js）404 —— 网络检查必须拦下 ——
const BAD_NETWORK_PAGE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;overflow:hidden}canvas{display:block}</style></head><body>
<canvas id="c" width="390" height="844"></canvas>
<script src="engine-missing.js"></script>
</body></html>`;

const fixtures = mkdtempSync(path.join(os.tmpdir(), "ms-selftest-"));
for (const [dir, html] of [["good", GOOD_PAGE], ["bad-console", BAD_CONSOLE_PAGE], ["bad-network", BAD_NETWORK_PAGE]]) {
  mkdirSync(path.join(fixtures, dir));
  writeFileSync(path.join(fixtures, dir, "index.html"), html);
}

const MIME = { ".html": "text/html", ".js": "text/javascript" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname.replace(/^\/+/, ""));
  const abs = path.join(fixtures, rel === "" ? "good/index.html" : rel);
  if (!abs.startsWith(fixtures) || rel.includes("..") || !rel.endsWith(".html")) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": MIME[".html"] }).end(abs.endsWith("bad-network/index.html") ? BAD_NETWORK_PAGE : abs.endsWith("bad-console/index.html") ? BAD_CONSOLE_PAGE : GOOD_PAGE);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const run = (url, out) => new Promise((resolve) => {
  const cliArgs = [SCRIPT, "--url", url, "--out", out];
  if (CHROME_ARG) cliArgs.push("--chrome", CHROME_ARG);
  const child = spawn("node", cliArgs, { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.on("data", (c) => { stdout += c; });
  child.stderr.on("data", (c) => { stdout += c; });
  child.on("close", (code) => resolve({ code, stdout }));
});

let failed = 0;
// want=0 好页须全绿；want=1 坏页须退出码 1 **且** 汇总行里能看到预期失败的检查项 id
// （只看退出码会放过「脚本自身崩溃也退出 1」的假通过——负例验证必须核对失败原因）
const expect = async (name, url, want, expectIds = []) => {
  const out = path.join(fixtures, `${name}-evidence`);
  const { code, stdout } = await run(url, out);
  let ok = code === want;
  if (ok && want === 1) {
    const summary = stdout.split("\n").find((l) => l.startsWith("MOBILE_SMOKE: FAIL")) || "";
    for (const id of expectIds) if (!summary.includes(id)) ok = false;
  }
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}：期望退出码 ${want}${expectIds.length ? `、失败项含 ${expectIds.join("/")}` : ""}，实际 ${code}`);
  if (!ok) { failed += 1; console.log(stdout.split("\n").filter((l) => l.trim()).slice(0, 14).join("\n")); }
  return ok;
};

console.log("===== mobile_smoke_selftest（判定力负例验证）=====");
await expect("好页（动画+触摸响应+音频契约）", `${base}/good/index.html`, 0);
await expect("坏页 A（未捕获异常+纯色静止）", `${base}/bad-console/index.html`, 1, ["console", "render", "animate"]);
await expect("坏页 B（关键资源 404）", `${base}/bad-network/index.html`, 1, ["network"]);

server.close();
try { rmSync(fixtures, { recursive: true, force: true }); } catch { /* 临时目录清理失败不影响判定 */ }
console.log(failed === 0 ? "SELFTEST: PASS mobile-web-smoke 判定力自测全过" : `SELFTEST: FAIL（${failed} 个用例不符）`);
process.exit(failed === 0 ? 0 : 1);
