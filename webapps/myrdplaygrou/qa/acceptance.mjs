/* 《今日汇率》使用验收 · DOM 向取证脚本（非门禁判定器）
 * 权威机判门禁 = std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs（仓库内，未改动）；
 * 本脚本只做「门禁游戏向判定项的等价 DOM 验证 + 使用验收清单逐项取证」，
 * 输出 acceptance-report.json + 截图到 qa/mobile/。主观体验结论一律留给人工复核。
 *
 * 用法：node qa/acceptance.mjs --url <liveUrl> --out <qa/mobile 目录>
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ""; };
const URL_ARG = arg("--url") || "https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/";
const OUT = arg("--out") || "qa/mobile";
mkdirSync(OUT, { recursive: true });

const MOBILE = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env2 = (msg) => { console.error(`ACCEPTANCE: FAIL(2) — ${msg}`); process.exit(2); };

const CANDIDATES = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium"].filter((c) => c.includes("/") ? existsSync(c) : true);
const chrome = CANDIDATES[0];
if (!chrome) env2("找不到 Chrome");
if (typeof WebSocket === "undefined") env2("需 Node ≥22（内置 WebSocket）");

const PORT = 9333 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(path.join(os.tmpdir(), "fx-qa-"));
let cp = null;
const startChrome = async (extraFlags = []) => {
  cp = spawn(chrome, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run",
    "--no-default-browser-check", `--user-data-dir=${profile}`, `--window-size=${MOBILE.width},${MOBILE.height}`,
    "--hide-scrollbars", ...extraFlags, "about:blank"], { stdio: "ignore" });
};
const stopChrome = async () => {
  try { ws && ws.close(); } catch { /* */ }
  try { cp.kill(); } catch { /* */ }
  await sleep(700);
};
process.on("exit", () => { try { cp && cp.kill(); } catch { /* */ } });

async function connectCdp() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
    await sleep(200);
  }
  throw new Error("CDP 连接超时");
}

let ws = null;

let msgId = 0; const pending = new Map(); const events = [];
const connect = async () => {
  ws = new WebSocket(await connectCdp());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  msgId = 0; pending.clear(); events.length = 0;
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    events.push(m);
  };
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", MOBILE);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setUserAgentOverride", { userAgent: UA });
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(`页面侧异常: ${r.result.exceptionDetails.exception?.description || "?"}`);
  return r.result?.result?.value;
};
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, "base64"));
  return name;
};
const waitFor = (method, ms) => new Promise((res) => {
  const hit = events.find((m) => m.method === method);
  if (hit) return res(hit);
  const t0 = Date.now();
  const iv = setInterval(() => {
    const i = events.findIndex((m) => m.method === method);
    if (i >= 0) { clearInterval(iv); res(events[i]); }
    else if (Date.now() - t0 > ms) { clearInterval(iv); res(null); }
  }, 100);
});
const consoleErrors = [];
setInterval(() => {
  for (const m of events) {
    if (m.method === "Runtime.exceptionThrown") consoleErrors.push(`未捕获: ${m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text}`);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors.push(`console.error: ${m.params.args?.map((a) => a.value ?? a.description).join(" ").slice(0, 300)}`);
  }
  for (let i = events.length - 1; i >= 0; i--) if (events[i].method?.startsWith("Runtime.")) events.splice(i, 1);
}, 150).unref();

await startChrome();
await connect();

const nav = async (url) => {
  // 清掉历史 load 事件，避免 waitFor 命中旧导航的 loadEventFired
  for (let i = events.length - 1; i >= 0; i--) if (events[i].method === "Page.loadEventFired") events.splice(i, 1);
  const loaded = waitFor("Page.loadEventFired", 20000);
  await send("Page.navigate", { url });
  await loaded; await sleep(2500); // 等 API 拉取与渲染
};
await nav(URL_ARG);

/* —— 页面侧检查项（同快照复算：rates 取自应用自己写入 localStorage 的快照）—— */
const results = [];
const add = (id, pass, evidence) => { results.push({ id, pass, evidence }); console.log(`  ${pass ? "PASS" : "FAIL"}  ${id} — ${evidence}`); };

/* 1. 中文界面 */
{
  const r = await evaluate(`({lang: document.documentElement.lang, title: document.title,
    hasZh: ["今日汇率","换算结果","近 7 天","金额"].every(t => document.body.textContent.includes(t))})`);
  add("zh-interface", r.lang === "zh-CN" && r.hasZh, `lang=${r.lang} title=${r.title} 关键中文文案齐全=${r.hasZh}`);
}

/* 2. 换算正确性：页面结果 vs 同快照本地复算（误差 ≤ 0.01%） */
let snapRates = null;
{
  const r = await evaluate(`(() => {
    const l = JSON.parse(localStorage.getItem("fx-latest-v1") || "null");
    const out = document.getElementById("resultValue").textContent.trim();
    return { base: l && l.base, usd: l && l.rates && l.rates.USD, out, amount: document.getElementById("amount").value,
             from: document.getElementById("fromCurrency").value, to: document.getElementById("toCurrency").value,
             rate: document.getElementById("resultRate").textContent.trim() };
  })()`);
  snapRates = r;
  if (r.base && r.usd && r.from === "CNY" && r.to === "USD") {
    const expect = 100 * r.usd; // 100 CNY → USD（base=CNY 时 rates.USD 即 1 CNY 兑 USD）
    const m = r.out.replace(/[^\d.]/g, "");
    const got = parseFloat(m);
    const err = Math.abs(got - expect) / expect;
    add("convert-cny-usd", isFinite(got) && err <= 0.0001,
      `页面 ${r.out} vs 同快照复算 ${expect.toFixed(4)} 误差 ${(err * 100).toFixed(5)}%（rates.USD=${r.usd}）`);
  } else add("convert-cny-usd", false, `快照未就绪或币种不符: ${JSON.stringify(r)}`);
}

/* 3. 双向换算 USD→CNY + 交换按钮 */
{
  await evaluate(`(() => {
    const f = document.getElementById("fromCurrency"); f.value = "USD"; f.dispatchEvent(new Event("change"));
    const t = document.getElementById("toCurrency"); t.value = "CNY"; t.dispatchEvent(new Event("change"));
  })()`);
  await sleep(3000); // 等 refreshLatest（base=USD 重拉 + 渲染）
  const r = await evaluate(`(() => {
    const l = JSON.parse(localStorage.getItem("fx-latest-v1") || "null");
    return { base: l && l.base, cny: l && l.rates && l.rates.CNY, out: document.getElementById("resultValue").textContent.trim(),
             rate: document.getElementById("resultRate").textContent.trim() };
  })()`);
  const expect = 100 * r.cny; // base=USD 时 rates.CNY = 1 USD 兑 CNY，100 USD = 100 × rates.CNY
  const got = parseFloat(r.out.replace(/[^\d.]/g, ""));
  const err = Math.abs(got - expect) / expect;
  add("convert-usd-cny", isFinite(got) && err <= 0.0001,
    `USD→CNY 页面 ${r.out} vs 复算 ${expect.toFixed(2)} 误差 ${(err * 100).toFixed(5)}%（rates.CNY=${r.cny}）`);
  await shot("qa-03-usd-to-cny.png");

  const s = await evaluate(`(() => {
    const before = [document.getElementById("fromCurrency").value, document.getElementById("toCurrency").value];
    document.getElementById("swapBtn").click();
    const after = [document.getElementById("fromCurrency").value, document.getElementById("toCurrency").value];
    return { before, after };
  })()`);
  add("swap-button", s.before[0] === s.after[1] && s.before[1] === s.after[0] && s.before[0] !== s.after[0],
    `交换前 ${s.before.join("→")} / 交换后 ${s.after.join("→")}`);
  await sleep(2500);
}

/* 4. 趋势 7 天 / 30 天切换 */
{
  const t7 = await evaluate(`(() => {
    const pts = document.querySelectorAll("#trendChart circle").length;
    const line = Boolean(document.querySelector("#trendChart polyline"));
    return { pts, line, change: document.getElementById("trendChange").textContent.trim(),
             cls: document.getElementById("trendChange").className };
  })()`);
  add("trend-7d", t7.line && t7.pts >= 5 && /[▲▼]/.test(t7.change) && /%/.test(t7.change),
    `7 天: 折线=${t7.line} 数据点=${t7.pts} 涨跌标注="${t7.change}"(${t7.cls})`);
  await shot("qa-04-trend-7d.png");

  await evaluate(`document.querySelector('.range-tab[data-range="30"]').click()`);
  await sleep(2500);
  const t30 = await evaluate(`(() => ({
    pts: document.querySelectorAll("#trendChart circle").length,
    change: document.getElementById("trendChange").textContent.trim(),
    active: document.querySelector(".range-tab.is-active").dataset.range }))()`);
  add("trend-30d", t30.pts > t7.pts && t30.active === "30" && /%/.test(t30.change),
    `30 天: 数据点=${t30.pts}(>7天的${t7.pts}) 涨跌标注="${t30.change}"`);
  await shot("qa-05-trend-30d.png");
  await evaluate(`document.querySelector('.range-tab[data-range="7"]').click()`);
  await sleep(1200);
}

/* 5. 视觉层级：结果字号显著大于正文 + 主色存在 */
{
  const v = await evaluate(`(() => {
    const gs = (el) => parseFloat(getComputedStyle(el).fontSize);
    const res = gs(document.getElementById("resultValue"));
    const body = gs(document.querySelector(".rate-list li") || document.body);
    const bg = getComputedStyle(document.body).backgroundColor;
    const cs = getComputedStyle(document.documentElement);
    return { res, body, ratio: res / body, bg, primary: cs.getPropertyValue("--primary").trim() };
  })()`);
  add("visual-hierarchy", v.ratio >= 2.5 && v.primary === "#14b8a6",
    `结果字号 ${v.res}px ÷ 正文 ${v.body}px = ${v.ratio.toFixed(1)}×（要求 ≥2.5×）；主色 ${v.primary}；底色 ${v.bg}`);
}

/* 6. 无阻断弹窗 + 无 console 错误（在线阶段） */
{
  const dlg = await evaluate(`({dialog: document.querySelector("dialog") !== null, errs: ${JSON.stringify(consoleErrors)}})`);
  add("no-blocking-modal", !dlg.dialog, `页面无 dialog 阻断`);
  add("console-clean-online", consoleErrors.length === 0, consoleErrors.length ? consoleErrors.join(" | ").slice(0, 300) : "在线使用全程 console 零 error 零未捕获异常");
}

/* 7. 移动端无横向溢出 + 截图 */
{
  const o = await evaluate(`({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})`);
  add("responsive-mobile-no-overflow", o.sw <= o.cw + 1, `390×844 视口 scrollWidth=${o.sw} ≤ clientWidth=${o.cw}`);
  await shot("qa-07-mobile-390.png");
}

/* 8. localStorage 留存：改偏好 → reload → 恢复 */
{
  await evaluate(`(() => { const a = document.getElementById("amount");
    a.value = "234.5"; a.dispatchEvent(new Event("input"));
    const f = document.getElementById("fromCurrency"); f.value = "JPY"; f.dispatchEvent(new Event("change")); })()`);
  await sleep(2500);
  await nav(URL_ARG); // reload
  const p = await evaluate(`({amount: document.getElementById("amount").value,
    from: document.getElementById("fromCurrency").value, to: document.getElementById("toCurrency").value})`);
  add("localStorage-persist", p.amount === "234.5" && p.from === "JPY",
    `reload 后恢复: 金额=${p.amount}(期望 234.5) 源币种=${p.from}(期望 JPY) 目标=${p.to}`);
  await shot("qa-08-persist-reload.png");
}

/* 9. 离线降级：重启 Chrome 并把两个汇率域映射到不可达地址（浏览器级模拟「汇率 API 不可用」），
 *    user-data-dir 复用 → localStorage 缓存保留 → 验证降级渲染 + 滞后提示 + 不白屏 */
{
  await stopChrome();
  await startChrome(["--host-resolver-rules=MAP open.er-api.com ~NOTFOUND, MAP api.frankfurter.dev ~NOTFOUND"]);
  await connect();
  await send("Network.clearBrowserCache"); // 关键：清 HTTP 缓存，否则 er-api 的缓存响应会让 fetch 假成功
  await nav(URL_ARG);
  await nav(URL_ARG);
  const o = await evaluate(`(() => {
    const l = JSON.parse(localStorage.getItem("fx-latest-v1") || "null");
    return { bannerVisible: !document.getElementById("staleBanner").hidden,
      bannerText: document.getElementById("staleBanner").textContent.trim(),
      result: document.getElementById("resultValue").textContent.trim(),
      freshness: document.getElementById("dataFreshness").textContent.trim(),
      bodyChars: document.body.textContent.length,
      vals: document.querySelectorAll(".rate-list li").length,
      trendPts: document.querySelectorAll("#trendChart circle").length };
  })()`);
  const shotName = await shot("qa-09-offline-fallback.png");
  const nonBlank = o.bodyChars > 200 && o.vals >= 6 && /\d/.test(o.result);
  add("offline-fallback", nonBlank && o.bannerVisible && o.trendPts >= 5,
    `断网渲染: 结果="${o.result}" 明细行=${o.vals} 趋势点=${o.trendPts} 滞后提示可见=${o.bannerVisible}("${o.bannerText}") 新鲜度="${o.freshness}"`);
  add("no-blank-screen", nonBlank, `正文 ${o.bodyChars} 字符（>200），截图 ${shotName} 非白屏`);
  add("console-clean-offline", consoleErrors.length === 0, consoleErrors.length ? `断网后有: ${consoleErrors.join(" | ").slice(0, 240)}` : "断网降级全程零未捕获异常（预期内的资源加载失败不算 error）");
  // 恢复正常 Chrome（无域名映射），供桌面视口步骤在线使用
  await stopChrome();
  await startChrome();
  await connect();
}

/* 10. 桌面视口 1440×900：双列布局 */
{
  await send("Emulation.setDeviceMetricsOverride", DESKTOP);
  await nav(URL_ARG);
  const d = await evaluate(`(() => {
    const page = getComputedStyle(document.querySelector(".page"));
    const cols = page.gridTemplateColumns.split(" ").filter(Boolean).length;
    const cards = [...document.querySelectorAll(".card")].map((c) => Math.round(c.getBoundingClientRect().x));
    return { cols, distinctX: new Set(cards).size, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  })()`);
  add("responsive-desktop-two-col", d.cols === 2 && d.distinctX >= 2 && d.sw <= d.cw + 1,
    `1440×900: grid 列数=${d.cols}，卡片横向分布 ${d.distinctX} 个不同 x 位（≥2 即并排），无溢出 ${d.sw}≤${d.cw}`);
  await shot("qa-10-desktop-1440.png");
}

/* —— 汇总 —— */
const passed = results.filter((r) => r.pass).length;
const summary = {
  url: URL_ARG, at: new Date().toISOString(), viewportMobile: MOBILE, viewportDesktop: DESKTOP,
  snapshotRates: snapRates, total: results.length, passed, failed: results.filter((r) => !r.pass),
  consoleErrors, results,
  note: "本报告为 DOM 向使用验收取证（机器可验证项）。主观体验（清新明亮观感、留白舒适度等）的结论权在人工复核，见 EXEMPTION.md 与验收报告。",
};
writeFileSync(path.join(OUT, "acceptance-report.json"), JSON.stringify(summary, null, 2));
console.log(`\nACCEPTANCE: ${passed}/${results.length} 项通过 → ${path.join(OUT, "acceptance-report.json")}`);
process.exit(results.some((r) => !r.pass) ? 1 : 0);
