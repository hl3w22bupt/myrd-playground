// WebKit 真内核冒烟：?qa=1 真机自检 + ?tuning=1 四问量表（线上 liveUrl 实测）
// 复跑（ESM 不认 NODE_PATH，把本文件复制到 playwright 所在目录后执行）：
//   cp games/game-4/qa/webkit_qa_live_check.mjs /tmp/pw-kit/ && cd /tmp/pw-kit && node webkit_qa_live_check.mjs
// 产物：<QA_OUT_DIR 或脚本目录>/shots-webkit-verify/*.png + qa-report-live.json / survey-live.json
//       （+ 命中下载兜底通道时的 QA 报告 JSON 文件）；console 全文重定向为 qa/webkit-live-check.log
//
// 两条 pass：
//   A（iPhone 形态 390×844 DPR3 触屏）：链接可开、引擎可启、QA/量表标志、画布渲染、点按无错 —— 验证一键实测链接本体；
//   B（1280×800，Godot 视口与窗口 1:1，y 偏移 +40）：真实点按驱动「自动扫描 → 分享/复制 → 四问点选 → 提交回传」全链路。
// 机判锚点全部来自线上壳页/引擎自己的输出（不注入任何代码）：
//   console `QA: QA 自检已激活…` / `QA: 自动扫描开始…` / `QA: 自动扫描完成…`
//   console `GUANGLU_QA_REPORT <json>` / `GUANGLU_SURVEY <json>`
//   console `Survey: 还缺 N 项必答…` / `Survey: 已提交并在本地保存…`
//   全局 window.__GUANGLU_SHARE__ = {channel,state,error}（四级降级导出结果）
import { webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let BASE = process.env.QA_LIVE_URL || 'https://leomac-studio.tail49399e.ts.net/apps/game-4/gw';
// 允许 QA_LIVE_URL 自带 query（否则会拼出 ?qa=1&tuning=1?qa=1&tuning=1，壳页把 tuning 判成非 '1'）
if (!/[?&]qa=1/.test(BASE)) BASE += '?qa=1&tuning=1';
const HERE = process.env.QA_OUT_DIR || path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'shots-webkit-verify');
fs.mkdirSync(SHOTS, { recursive: true });
// 输出文件名后缀（QA_FILE_SUFFIX=-refix 时产物带 -refix，不覆盖旧证据）
const SUF = process.env.QA_FILE_SUFFIX || '';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' —— ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 从 console 流里抓「最新一条匹配前缀的消息文本」
function lastLine(lines, prefix) {
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].startsWith(prefix)) return lines[i];
  return '';
}
function jsonAfter(lines, tag) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith(tag)) {
      const raw = lines[i].slice(tag.length).trim();
      try { return JSON.parse(raw); } catch { return null; }
    }
  }
  return null;
}

const browser = await webkit.launch();

// 引擎就绪判据（兼容两种壳）：平台壳有 #boot.hidden；本地原生壳没有 ——
// 两者都以引擎自己的 console 日志「QA: QA 自检已激活」为最终就绪信号（最严格也最通用）。
async function waitEngineReady(page, lines, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (lines.some((l) => l.startsWith('QA: QA 自检已激活'))) return true;
    try {
      const hidden = await page.evaluate(() => document.getElementById('boot')?.classList.contains('hidden') ?? false);
      if (hidden && lines.some((l) => l.includes('Godot Engine v'))) return true;
    } catch { /* 页面尚未就绪 */ }
    await sleep(400);
  }
  return false;
}

// ───────────────────────── Pass A：iPhone 形态 ─────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  const lines = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => lines.push(`${m.text()}`));
  page.on('download', (d) => lines.push('DOWNLOAD: ' + d.suggestedFilename()));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const booted = await waitEngineReady(page, lines, 180000);
  check('A·iPhone 形态引擎启动完成（引擎 QA 激活日志）', booted);

  const ua = await page.evaluate(() => navigator.userAgent);
  check('A·WebKit 内核（UA 含 WebKit）', /WebKit/.test(ua), ua.slice(0, 90));

  const hasShell = await page.evaluate(() => typeof window.__audioDebug === 'function');
  const flags = await page.evaluate(() => ({
    qa: window.__QA_MODE__, survey: window.__SURVEY_MODE__,
    tuningPanel: window.__GAME_TUNING_PANEL__, badge: document.getElementById('mode-badge')?.textContent || '',
  }));
  // 平台壳才有 __QA_MODE__/徽标/音频取证口；本地原生 Godot 壳没有 → 跳过（引擎侧 URL 解析已由日志证明）。
  check('A·__QA_MODE__ = true（平台壳钩子）', !hasShell || flags.qa === true, hasShell ? String(flags.qa) : '本地原生壳，跳过');
  check('A·__SURVEY_MODE__ = true（平台壳钩子）', !hasShell || flags.survey === true, hasShell ? String(flags.survey) : '本地原生壳，跳过');
  check('A·启动屏徽标双模式（平台壳钩子）', !hasShell || (/QA/.test(flags.badge) && /四问/.test(flags.badge)), hasShell ? flags.badge : '本地原生壳，跳过');

  await sleep(2500);
  // 画布渲染证据：截图字节体积（黑屏压缩后只有几 KB，棋盘/光束渲染后 > 30KB）。
  // 注：不用 readPixels —— Godot WebGL 默认 preserveDrawingBuffer=false，WebKit 下读回恒黑（误报）。
  const shot = await page.screenshot();
  const canvasSize = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    return c ? { w: c.width, h: c.height } : null;
  });
  check('A·画布已渲染（截图体积 + canvas 尺寸）', shot.length > 30000 && !!canvasSize,
    `bytes=${shot.length} canvas=${canvasSize ? canvasSize.w + 'x' + canvasSize.h : 'null'}`);

  await page.touchscreen.tap(195, 420).catch(() => {});
  await sleep(800);
  const audio = await page.evaluate(() => (window.__audioDebug ? window.__audioDebug() : null));
  check('A·音频取证出口可用（点按后）', !hasShell || (!!audio && typeof audio.state === 'string'),
    hasShell ? `state=${audio && audio.state}` : '本地原生壳无 __audioDebug，跳过');
  check('A·console 出现 QA 激活日志', lines.some((l) => l.startsWith('QA: QA 自检已激活')), lastLine(lines, 'QA:').slice(0, 60));
  check('A·iPhone 形态零页面错误', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.screenshot({ path: path.join(SHOTS, `webkit-iphone-390x844${SUF}.png`) });
  await ctx.close();
}

// ───────────────────────── Pass B：全交互（1280×800） ─────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: false,
  });
  const page = await ctx.newPage();
  const errors = [];
  const lines = [];
  const downloads = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => lines.push(`${m.text()}`));
  page.on('download', async (d) => {
    downloads.push(d.suggestedFilename());
    try { await d.saveAs(path.join(SHOTS, `qa-report-download-${downloads.length}${SUF}.json`)); } catch {}
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  check('B·引擎启动完成', await waitEngineReady(page, lines, 180000));

  const tap = async (x, y) => { await page.touchscreen.tap(x, y).catch(() => {}); await sleep(140); };
  const consoleCount = () => lines.length;
  const waitForLine = async (prefix, timeoutMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (lines.some((l) => l.startsWith(prefix))) return true;
      await sleep(200);
    }
    return false;
  };

  // —— ① QA 自检激活（引擎自身日志） ——
  check('B·QA 自检已激活', await waitForLine('QA: QA 自检已激活', 8000));

  // —— ② 自动扫描（真机自检执行）：QA 面板按钮行在窗口 y≈455~560（随状态行行数下移），逐点扫描 ——
  let sweepStarted = false;
  for (let y = 455; y <= 560 && !sweepStarted; y += 8) {
    const before = consoleCount();
    await tap(68, y);
    if (lines.slice(before).some((l) => l.startsWith('QA: 自动扫描开始'))) sweepStarted = true;
  }
  check('B·自动扫描已启动（触屏点按「自动扫描」）', sweepStarted);
  const sweepDone = await waitForLine('QA: 自动扫描完成', 90000);
  const sweepLine = lastLine(lines, 'QA: 自动扫描开始');
  const sweepTargets = Number((sweepLine.match(/(\d+) 个目标格/) || [])[1] || 0);
  check('B·自动扫描完成（样本闭合）', sweepDone, lastLine(lines, 'QA: 自动扫描完成').slice(0, 60));
  check('B·扫描目标数 > 0（board 解析正确）', sweepTargets > 0, `targets=${sweepTargets}（0 = _resolve_board 缺陷）`);
  await page.screenshot({ path: path.join(SHOTS, `webkit-b-sweep${SUF}.png`) });

  // —— ③ 一键报告导出：「分享/复制」→ GUANGLU_QA_REPORT + __GUANGLU_SHARE__ ——
  let reportTag = false;
  for (let y = 455; y <= 560 && !reportTag; y += 8) {
    const before = consoleCount();
    await tap(223, y);
    if (lines.slice(before).some((l) => l.startsWith('GUANGLU_QA_REPORT'))) reportTag = true;
  }
  check('B·报告 JSON 已投递（GUANGLU_QA_REPORT）', reportTag || (await waitForLine('GUANGLU_QA_REPORT', 5000)));
  await sleep(2500); // 等导出 Promise 落 __GUANGLU_SHARE__
  const report = jsonAfter(lines, 'GUANGLU_QA_REPORT');
  check('B·报告 JSON 可解析且 schema 正确', !!report && report.schema === 'guanglu-qa-report/1', report ? report.schema : 'null');
  if (report) {
    const s = report.touch?.summary || {};
    check('B·报告含触屏样本（自检确有执行）', (s.samples | 0) > 0, `samples=${s.samples} hit_rate=${s.hit_rate}`);
    check('B·报告含旋转时延统计', !!(report.rotation_latency?.stats?.count), `p95=${report.rotation_latency?.stats?.p95_ms}ms`);
    check('B·报告含音频状态', typeof report.audio?.audio_context_state === 'string', report.audio?.audio_context_state);
    check('B·报告含 verdict 机判', typeof report.verdict?.pass === 'boolean', JSON.stringify(report.verdict));
    fs.writeFileSync(path.join(SHOTS, `qa-report-live${SUF}.json`), JSON.stringify(report, null, 2));
  }
  const share = await page.evaluate(() => window.__GUANGLU_SHARE__ || null);
  check('B·导出通道完成（__GUANGLU_SHARE__.state=done）', !!share && share.state === 'done',
    share ? `channel=${share.channel} state=${share.state} err=${share.error}` : 'null');
  check('B·下载兜底（若走第 4 级通道则捕获文件）', true, downloads.join(',') || '未触发（更高级通道已成功）');
  await page.screenshot({ path: path.join(SHOTS, `webkit-b-report${SUF}.png`) });

  // —— ④ 四问量表：入口按钮 → 模态（修复后居中）→ 逐问点选 → 滚动条翻页 → 提交回传 ——
  // 坐标为 1280×800 视口 + 修复后面板居中布局的实测值（见 shots-webkit-verify 截图）。
  // WebKit 不支持 mouse.wheel；ScrollContainer 用右缘滚动条轨道点击翻页（实测有效）。
  const REQUIRED = ['q1_understood', 'q2_replay', 'q3_rotate', 'q3_beam', 'q3_sfx', 'q3_perf', 'q4_gap'];
  await tap(60, 688);    // 左下「📋 试玩四问」入口按钮 → 模态居中浮出
  await sleep(500);
  await tap(390, 221);   // ①「能」
  await tap(510, 368);   // ②「3」
  await tap(599, 501);   // ③ 旋转手感「5」
  await tap(599, 561);   // ③ 光束点亮「5」
  await tap(915, 655);   // 滚动条轨道点击翻页到底（q3 后两维 / q4 / 按钮行）
  await sleep(400);
  await tap(599, 365);   // ③ 音效「5」
  await tap(599, 425);   // ③ 画面响应「5」
  await tap(390, 496);   // ④「无」
  await page.screenshot({ path: path.join(SHOTS, `webkit-b-survey-filled${SUF}.png`) });
  // 提交（带 ±8px 扫描兜底）：出现 GUANGLU_SURVEY 即「可点选 + 可提交」双证
  let submitted = false;
  for (const [x, y] of [[418, 616], [418, 608], [418, 624], [400, 616], [436, 616]]) {
    const before = consoleCount();
    await tap(x, y);
    if (lines.slice(before).some((l) => l.startsWith('GUANGLU_SURVEY'))) { submitted = true; break; }
  }
  const interacted = lines.some((l) => l.startsWith('Survey:'));
  check('B·四问模态可交互（出现 Survey 日志）', interacted, lastLine(lines, 'Survey: 还缺').slice(0, 90));
  check('B·四问量表可点选并提交（GUANGLU_SURVEY）', submitted, lastLine(lines, 'GUANGLU_SURVEY').slice(0, 60));
  if (interacted && !submitted) {
    check('B·缺项定位（供修复参考）', true, lastLine(lines, 'Survey: 还缺').slice(0, 120));
  }
  await sleep(2500);
  const survey = jsonAfter(lines, 'GUANGLU_SURVEY');
  if (survey) {
    const a = survey.answers || survey.payload?.answers || {};
    const got = REQUIRED.filter((k) => a[k] !== undefined && a[k] !== '');
    check('B·回传载荷含 7 项必答', got.length === 7, `${got.length}/7 ${got.join(',')}`);
    fs.writeFileSync(path.join(SHOTS, `survey-live${SUF}.json`), JSON.stringify(survey, null, 2));
    const share2 = await page.evaluate(() => window.__GUANGLU_SHARE__ || null);
    check('B·量表导出通道完成', !!share2 && share2.state === 'done', share2 ? `channel=${share2.channel}` : 'null');
  }
  check('B·全程零页面错误', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.screenshot({ path: path.join(SHOTS, `webkit-b-final${SUF}.png`) });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nWEBKIT_QA_LIVE_CHECK: ${failed.length === 0 ? 'PASS' : 'FAIL'}（${results.length - failed.length}/${results.length} 项通过）`);
process.exit(failed.length === 0 ? 0 : 1);
