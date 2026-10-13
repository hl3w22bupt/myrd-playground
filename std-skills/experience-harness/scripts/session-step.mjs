#!/usr/bin/env node
// session-step.mjs — 交互会话的单步客户端：读会话文件（sessiond 产出），凭令牌向守护
// 发一步指令，打印证据 JSON（截图路径 / DOM 摘要 / 输入计数 / 帧差）。
//
// 试玩 agent 的典型循环：看上一步返回的 screenshot（Read 图片）→ 决定下一步 →
// session-step --tap x,y → 再看返回的 screenshot …… —— 「看一步、打一步」。
//
// 用法（--session 必带；一步一个动作，或 --do '<step JSON>' 全量表达）：
//   node session-step.mjs --session <file> --tap 195,422
//   node session-step.mjs --session <file> --swipe 90,700:170,700
//   node session-step.mjs --session <file> --pressKey ArrowUp
//   node session-step.mjs --session <file> --probe 'window.__gameState ? window.__gameState() : null'
//   node session-step.mjs --session <file> --screenshot
//   node session-step.mjs --session <file> --wait 1500
//   node session-step.mjs --session <file> --status
//   node session-step.mjs --session <file> --stop
// 退出码：0 成功；1 失败（会话不在/令牌错/守护错）。

import { readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const sessionFile = flag("--session");
if (!sessionFile) { console.error("缺少 --session <会话文件>（由 sessiond 的 XH_SESSION_READY 行给出）"); process.exit(1); }

let sess;
try { sess = JSON.parse(readFileSync(path.resolve(sessionFile), "utf-8")); }
catch (e) { console.error(`会话文件读取失败（${sessionFile}）：${e.message}`); process.exit(1); }

const parseXY = (s) => {
  const [x, y] = String(s).split(",").map((v) => Number(v.trim()));
  if (!Number.isFinite(x) || !Number.isFinite(y)) { console.error(`坐标格式应为 x,y（收到 ${s}）`); process.exit(1); }
  return { x, y };
};

function buildStep() {
  if (flag("--do")) { try { return JSON.parse(flag("--do")); } catch (e) { console.error(`--do JSON 解析失败：${e.message}`); process.exit(1); } }
  if (flag("--tap")) { const { x, y } = parseXY(flag("--tap")); return { action: "tap", params: { x, y } }; }
  if (flag("--swipe")) {
    const [from, to] = String(flag("--swipe")).split(":");
    return { action: "swipe", params: { from: parseXY(from), to: parseXY(to) } };
  }
  if (flag("--pressKey")) return { action: "pressKey", params: { key: flag("--pressKey") } };
  if (flag("--probe")) return { action: "probe", params: { expr: flag("--probe") } };
  if (flag("--screenshot") !== null) return { action: "screenshot", params: {} };
  if (flag("--wait")) return { action: "wait", params: { ms: Number(flag("--wait")) || 500 } };
  if (flag("--navigate")) return { action: "navigate", params: { url: flag("--navigate") } };
  return null;
}

const base = `http://127.0.0.1:${sess.port}`;
const headers = { "content-type": "application/json" };

async function main() {
  if (flag("--status") !== null) {
    const r = await fetch(`${base}/health?token=${encodeURIComponent(sess.token)}`);
    console.log(JSON.stringify(await r.json(), null, 2));
    process.exit(r.ok ? 0 : 1);
  }
  if (flag("--stop") !== null) {
    const r = await fetch(base, { method: "POST", headers, body: JSON.stringify({ token: sess.token, action: "stop" }) });
    console.log(JSON.stringify(await r.json(), null, 2));
    process.exit(r.ok ? 0 : 1);
  }
  const step = buildStep();
  if (!step) { console.error("没有可执行的动作（--tap/--swipe/--pressKey/--probe/--screenshot/--wait/--navigate/--do/--status/--stop）"); process.exit(1); }
  const r = await fetch(base, { method: "POST", headers, body: JSON.stringify({ token: sess.token, action: "step", step }) });
  const body = await r.json();
  console.log(JSON.stringify(body, null, 2));
  if (!r.ok || body.ok === false) process.exit(1);
}

main().catch((e) => { console.error(`请求失败（会话守护不在线？）：${e.message}`); process.exit(1); });
