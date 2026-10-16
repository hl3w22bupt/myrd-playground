#!/usr/bin/env node
// webapp_smoke_selftest.mjs — webapp-smoke.mjs 的判定力自测（负例验证：门禁必须能抓住坏页）。
// 本地 http 伺服 3 个 fixture 页面：好页（内容 + 交互 + viewport meta 全齐）、坏页 A（未捕获异常 +
// 空白 body）、坏页 B（关键资源 404）。断言退出码 0 / 1 / 1。
// 用法：node webapp_smoke_selftest.mjs [--chrome <path>]；退出码 0 = 自测通过。
// 与 mobile_smoke_selftest.mjs 同属「判定器自身的负例验证」纪律。

import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";

const say = (m) => console.log(m);
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const SCRIPT = path.join(import.meta.dirname, "webapp-smoke.mjs");
const CHROME_ARG = flag("--chrome", "");

// —— 好页：真实内容（文本 + 卡片 + 按钮）、点击有响应（tapDiff>0）、viewport meta ——
const GOOD_PAGE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;font-family:sans-serif;background:#f7fafc;color:#111}
.card{margin:16px;padding:24px;background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
button{padding:12px 24px;background:#2563eb;color:#fff;border:0;border-radius:8px;font-size:16px}
#out{margin-top:12px;font-weight:600;color:#16a34a}</style></head><body>
<div class="card"><h1>单位换算</h1><p>输入数值，即时换算常用单位。</p>
<button id="go">换算一次</button><div id="out"></div></div>
<script>
document.getElementById("go").addEventListener("click", () => {
  document.getElementById("out").textContent = "已换算：1 km = 1000 m";
});
</script></body></html>`;

// —— 坏页 A：加载即未捕获异常 + 空 body（白屏：render/content 双挂）——
const BAD_BLANK_PAGE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;background:#fff}</style></head><body>
<script>throw new Error("boom: app boot failed");</script></body></html>`;

// —— 坏页 B：关键资源 404（app.js 拉不到 → 页面功能必挂）——
const BAD_404_PAGE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;font-family:sans-serif;background:#eef2ff;color:#312e81}h1{padding:24px}</style></head><body>
<h1>看板</h1><script src="/missing/app.js"></script></body></html>`;

// ============ 本地 http 伺服（3 个 fixture + 404 兜底） ============
const tmp = mkdtempSync(path.join(os.tmpdir(), "wa-selftest-"));
mkdirSync(path.join(tmp, "good"), { recursive: true });
writeFileSync(path.join(tmp, "good", "index.html"), GOOD_PAGE);
mkdirSync(path.join(tmp, "blank"), { recursive: true });
writeFileSync(path.join(tmp, "blank", "index.html"), BAD_BLANK_PAGE);
mkdirSync(path.join(tmp, "404"), { recursive: true });
writeFileSync(path.join(tmp, "404", "index.html"), BAD_404_PAGE);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const file = path.join(tmp, url.pathname === "/" ? "good/index.html" : url.pathname);
  if (url.pathname.startsWith("/missing/")) { res.writeHead(404); res.end("not found"); return; }
  if (file.startsWith(tmp) && file.endsWith(".html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(file));
    return;
  }
  res.writeHead(404); res.end("not found");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const page = (p) => `http://127.0.0.1:${port}/${p}`;

// ============ 跑被测脚本 ============
const run = (url) => new Promise((resolve) => {
  const out = [];
  const cp = spawn("node", [SCRIPT, "--url", url, "--out", path.join(tmp, "qa"), ...(CHROME_ARG ? ["--chrome", CHROME_ARG] : [])], { stdio: ["ignore", "pipe", "pipe"] });
  cp.stdout.on("data", (d) => out.push(String(d)));
  cp.stderr.on("data", (d) => out.push(String(d)));
  cp.on("exit", (code) => resolve({ code, output: out.join("") }));
});

const cases = [
  { label: "好页（内容+交互+viewport meta）", url: page("good/index.html"), expectCode: 0, expectFails: [] },
  { label: "坏页 A（未捕获异常+空白 body）", url: page("blank/index.html"), expectCode: 1, expectFails: ["console", "content"] },
  { label: "坏页 B（关键资源 404）", url: page("404/index.html"), expectCode: 1, expectFails: ["network"] },
];

say(`\n===== webapp_smoke_selftest（判定力负例验证）=====`);
let allPass = true;
for (const c of cases) {
  const r = await run(c.url);
  const codeOk = r.code === c.expectCode;
  // 汇总行的未过项列表是权威信号：`WEBAPP_SMOKE: FAIL（N 项未过：a、b）`；好页则要求 PASS 行
  const listed = (r.output.match(/FAIL（\d+ 项未过：([^）]*)）/)?.[1] ?? "");
  const failsOk = c.expectFails.length === 0
    ? r.output.includes("WEBAPP_SMOKE: PASS")
    : c.expectFails.every((id) => listed.split("、").includes(id));
  const ok = codeOk && failsOk;
  allPass = allPass && ok;
  say(`  ${ok ? "PASS" : "FAIL"}  ${c.label}：期望退出码 ${c.expectCode}${c.expectFails.length ? `、失败项含 ${c.expectFails.join("/")}` : ""}，实际 ${r.code}${listed ? `（未过项：${listed}）` : ""}${ok ? "" : `\n      输出片段：${r.output.slice(-400)}`}`);
}

server.close();
try { rmSync(tmp, { recursive: true, force: true }); } catch { /* 临时目录残留无害 */ }
if (!allPass) { console.error("SELFTEST: FAIL webapp-smoke 判定力自测未全过（修门禁，不要修用例）"); process.exit(1); }
say("SELFTEST: PASS webapp-smoke 判定力自测全过");
