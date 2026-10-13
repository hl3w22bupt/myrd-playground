#!/usr/bin/env node
// sessiond.mjs — 交互式浏览器会话守护：常驻 headless Chrome（移动仿真），供试玩 agent
// 「看一步、打一步」（G4 的手脚；G1 先交付机制）。
//
// 形态：node:http 小服务，仅绑 127.0.0.1 随机端口，凭会话令牌鉴权；会话文件（JSON）
// 含 port/token/状态目录路径。step 每步落一张截图（steps/NN-<action>.png，agent 可直接
// Read——image-read-guard 口径 ≤5MB），返回 DOM 摘要 + 输入计数 + 帧差。
// 生命周期：显式 stop / TTL 到期 / SIGINT-SIGTERM —— 三条路都必须把 Chrome 进程杀掉、
// 临时 user-data-dir 与状态目录删干净（G1 验收 4）。
//
// 用法：
//   node sessiond.mjs --url <liveUrl> [--ttl 900] [--viewport mobile|desktop] \
//     [--chrome <路径>] [--session-file <路径>]
// 就绪后 stdout 打印：XH_SESSION_READY <session-file 绝对路径>
// 客户端见 session-step.mjs。

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  assertEnv, env2, resolveChrome, launchChrome, connectCdp, openSession,
  setupEmulation, navigate, sleep, tap, swipe, pressKey, readTouchCounters,
  captureShot, domSummary, diffPoints, MOBILE_VIEWPORT, DESKTOP_VIEWPORT, MOBILE_UA,
} from "./cdp-core.mjs";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

const URL_ARG = flag("--url", "");
const TTL_SEC = Number(flag("--ttl", "900"));
const VIEWPORT_NAME = flag("--viewport", "mobile");
const SESSION_FILE = path.resolve(flag("--session-file", path.join(os.tmpdir(), `xh-session-${process.pid}.json`)));
const CDP_PORT = 9500 + (process.pid % 400);

assertEnv();
if (!URL_ARG) env2("缺少 --url <liveUrl>");

const VIEWPORT = VIEWPORT_NAME === "desktop" ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT;
const UA = VIEWPORT_NAME === "desktop" ? null : MOBILE_UA;

const stateDir = mkdtempSync(path.join(os.tmpdir(), "xh-session-"));
const stepsDir = path.join(stateDir, "steps");
mkdirSync(stepsDir, { recursive: true });

const token = randomBytes(24).toString("hex");
let stepSeq = 0;
let stopping = false;
let chain = Promise.resolve(); // 串行化 step 执行，避免 CDP 命令交错

const { cp, cleanup: cleanupChrome } = launchChrome({ chrome: resolveChrome(flag("--chrome", "")), port: CDP_PORT, viewport: VIEWPORT });

/** 三条回收路径共用：杀 Chrome、删 profile、删状态目录与会话文件 */
let cleaned = false;
function fullCleanup() {
  if (cleaned) return;
  cleaned = true;
  cleanupChrome();
  try { rmSync(stateDir, { recursive: true, force: true }); } catch { /* 尽力而为 */ }
  try { rmSync(SESSION_FILE, { force: true }); } catch { /* 尽力而为 */ }
}
process.on("exit", fullCleanup);
process.on("SIGINT", () => { console.log("XH_SESSION_STOPPED signal=sigint"); process.exit(0); });
process.on("SIGTERM", () => { console.log("XH_SESSION_STOPPED signal=sigterm"); process.exit(0); });

const sumCounters = (c) => (c ? Object.values(c).reduce((x, y) => x + y, 0) : null);

async function main() {
  const session = await openSession(await connectCdp(CDP_PORT));
  await setupEmulation(session, { viewport: VIEWPORT, ua: UA });
  await navigate(session, URL_ARG);

  let prevPoints = null;
  try {
    const first = await captureShot(session);
    prevPoints = first.points ?? null;
  } catch { prevPoints = null; }

  /** 执行单步并留证 —— 与 pack.mjs 同口径：截图 + DOM 摘要 + 输入计数 + 前后帧差 */
  async function doStep(step) {
    const t0 = Date.now();
    const before = await readTouchCounters(session);
    let probeResult, probeError;
    switch (step.action) {
      case "wait": await sleep(Math.min(Number(step.params?.ms) || 0, 30_000)); break;
      case "navigate": await navigate(session, String(step.params?.url || URL_ARG)); prevPoints = null; break;
      case "tap":
        await tap(session, Number(step.params?.x) || 0, Number(step.params?.y) || 0);
        await sleep(Number(step.params?.settleMs) || 600);
        break;
      case "swipe":
      case "drag":
        await swipe(session, step.params?.from || { x: 0, y: 0 }, step.params?.to || { x: 0, y: 0 },
          { moveSteps: Number(step.params?.moveSteps) || 10 });
        await sleep(Number(step.params?.settleMs) || 600);
        break;
      case "pressKey": await pressKey(session, String(step.params?.key || "ArrowUp")); await sleep(300); break;
      case "screenshot": await sleep(200); break;
      case "probe":
        try { probeResult = await session.evaluate(String(step.params?.expr)); }
        catch (e) { probeError = String(e.message || e).slice(0, 300); }
        break;
      default: throw new Error(`未知 action: ${step.action}`);
    }
    const after = await readTouchCounters(session);
    const shot = await captureShot(session);
    const points = shot.points ?? null;
    const frameDiff = diffPoints(prevPoints, points);
    prevPoints = points;
    stepSeq += 1;
    const shotPath = path.join(stepsDir, `${String(stepSeq).padStart(3, "0")}-${step.action}.png`);
    writeFileSync(shotPath, shot.png);
    const inputArrived = before && after ? sumCounters(after) - sumCounters(before) > 0 : null;
    return {
      ok: true, seq: stepSeq, action: step.action,
      durationMs: Date.now() - t0,
      screenshot: shotPath,
      dom: await domSummary(session),
      inputArrived,
      frameDiff,
      responded: frameDiff === null ? null : frameDiff > 0,
      ...(step.action === "probe" ? { probeResult: probeResult ?? null, probeError: probeError ?? null } : {}),
    };
  }

  const server = createServer((req, res) => {    const send = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      const url = new URL(req.url, "http://127.0.0.1");
      let body = {};
      try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf-8")) : {}; }
      catch { return send(400, { ok: false, error: "请求体必须是 JSON" }); }
      const supplied = body.token ?? url.searchParams.get("token") ?? "";
      if (supplied !== token) return send(403, { ok: false, error: "令牌不匹配" });
      if (req.method === "GET" || url.pathname === "/health") {
        return send(200, { ok: true, url: URL_ARG, steps: stepSeq, startedAt, ttlSec: TTL_SEC });
      }
      if (stopping) return send(503, { ok: false, error: "会话正在关闭" });
      if (body.action === "stop") {
        stopping = true;
        send(200, { ok: true, stopped: true, steps: stepSeq });
        setTimeout(() => { console.log("XH_SESSION_STOPPED reason=explicit"); process.exit(0); }, 50);
        return;
      }
      if (body.action === "step") {
        if (!body.step?.action) return send(422, { ok: false, error: "缺少 step.action" });
        // 串行化：同一时刻只跑一步，CDP 命令不交错
        chain = chain.then(async () => {
          try { send(200, await doStep(body.step)); }
          catch (e) { send(500, { ok: false, error: String(e.message || e).slice(0, 300) }); }
        });
        return;
      }
      send(422, { ok: false, error: "未知 action（支持 step / stop）" });
    });
  });

  const startedAt = new Date().toISOString();
  // 端口真随机（listen(0) 回读分配结果）：固定算式端口会撞号（实测 EADDRINUSE 9727），
  // 且必须挂 error 处理——否则撞号直接 unhandled 'error' 崩掉守护
  server.on("error", (e) => {
    console.error(`XH_SESSION_FAIL — HTTP 服务启动失败: ${e.message}`);
    process.exit(1);
  });
  server.listen(0, "127.0.0.1", () => {
    writeFileSync(SESSION_FILE, JSON.stringify({
      version: 1, url: URL_ARG, port: server.address().port, token,
      pid: process.pid, startedAt, ttlSec: TTL_SEC,
      stepsDir, sessionFile: SESSION_FILE,
    }, null, 2));
    console.log(`XH_SESSION_READY ${SESSION_FILE}`);
  });

  // TTL 到期自动回收（G1 验收 4：不留僵尸 Chrome）
  setTimeout(() => {
    console.log("XH_SESSION_STOPPED reason=ttl");
    process.exit(0);
  }, TTL_SEC * 1000).unref();
}

main().catch((e) => {
  console.error(`XH_SESSION_FAIL — ${e.message}`);
  process.exitCode = 1;
  process.exit(1);
});
