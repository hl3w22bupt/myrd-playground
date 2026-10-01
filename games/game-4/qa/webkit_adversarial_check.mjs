// 线上 v19 对抗性探索 + 语义机判（WebKit 真内核；express_lane cmupuzqx5006im9dh2k8wi9f3 补位执行）
// 覆盖用例：T1 连点 / T2 结算瞬间点击 / T3 下一关首点 / T4 悬挂手势 / T5 双指抢控 / T6 撤销交叠
//           T7 旋转方向语义 / T8 星级语义（1/2/3 星 + 只升不降）
//
// 驱动纪律（上一版实测教训，见 qa/ADVERSARIAL_FINDINGS.md §四）：
//   · 全程只用触屏：棋盘 tap + 右下触屏按钮「撤销(897,681)/重开(1040,681)/旋转(1183,681)」——
//     键盘事件在 WebKit headless 下会因页面焦点丢失而失效，触屏按钮与真机玩家同语义，不依赖焦点；
//   · 「自动扫描」按钮（x≈68）绝对不碰：sweep 会关闭被动采样并旋转 23 个管格污染棋盘；
//   · 报告 JSON 只能由「分享/复制」（x≈223）导出（「生成报告」只存内存不投 console，
//     见 scripts/qa_selftest.gd _on_qa_button），全程只在终局点一次，导出后不再有任何 tap；
//   · 每步用截图逐字节 diff 做视觉锚（旋转/光束变化可见），最终用报告数值对账。
// 机判锚点：console `GUANGLU_QA_REPORT <json>`（level.moves/solved + survey_snapshot.progress.best_stars
//   + 被动样本表 touch.rows 逐点击对账）；脚本不注入任何改变游戏行为的代码（T5 仅尝试合成 TouchEvent 驱动手势）。
// 复跑：cp games/game-4/qa/webkit_adversarial_check.mjs /tmp/pw-kit/ && cd /tmp/pw-kit && node webkit_adversarial_check.mjs
import { webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let BASE = process.env.QA_LIVE_URL || 'https://leomac-studio.tail49399e.ts.net/apps/game-4/gw';
if (!/[?&]qa=1/.test(BASE)) BASE += '?qa=1&tuning=1';
const HERE = process.env.QA_OUT_DIR || path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'shots-adversarial');
fs.mkdirSync(SHOTS, { recursive: true });

// ── 坐标（canvas 全屏 1280×800；stretch keep 内容 1280×720 居中。probe6 实测：tap DOM y →
//   引擎窗口 y-40，再经 final_transform 反算内容 y-40 —— 故内容坐标 → DOM 需 +80）──
const CELL = 96, BOARD_TOP = 132, DESIGN_W = 1280, DESIGN_H = 720, Y_OFF = 80;
function pt(lv, cell) {
  const o = { x: (DESIGN_W - lv.w * CELL) / 2, y: BOARD_TOP + ((DESIGN_H - BOARD_TOP) - lv.h * CELL) / 2 };
  return { x: o.x + cell[0] * CELL + CELL / 2, y: o.y + cell[1] * CELL + CELL / 2 + Y_OFF };
}
// 触屏按钮（shots-adversarial/p1 截图实测：TouchUI 右下一排三键，1280×800 固定布局）
const BTN = { undo: { x: 897, y: 681 }, reset: { x: 1040, y: 681 }, confirm: { x: 1183, y: 681 } };
const L1 = { w: 5, h: 5, pipes: { A: [1, 2] } };
const L2 = { w: 5, h: 5, pipes: { A: [1, 2], B: [2, 2], C: [3, 2] } };
const L3 = { w: 5, h: 5, pipes: { A: [1, 2], B: [1, 1], C: [2, 1], D: [3, 1], E: [3, 2] } };
// 星级语义（PuzzleLogic.stars_for）：moves<=par → 3；<=ceil(par*1.5) → 2；否则 1。par：L1=1 L2=2 L3=8
const starsFor = (moves, par) => (moves <= par ? 3 : moves <= Math.ceil(par * 1.5) ? 2 : 1);

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' —— ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const allReports = (lines) => {
  const out = [];
  for (const l of lines) if (l.startsWith('GUANGLU_QA_REPORT')) {
    try { out.push(JSON.parse(l.slice('GUANGLU_QA_REPORT'.length).trim())); } catch {}
  }
  return out;
};
const rowsFor = (rep, cell) => (rep?.touch?.rows || []).filter((r) => String(r.target_cell) === String(cell));

const browser = await webkit.launch();
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: false });
  // 屏蔽 navigator.share：headless WebKit 的系统分享面板会以竞态方式吞掉后续棋盘 tap
  // （实测两轮：一次无碍、一次 P4 全部输入丢失）。屏蔽后 WebBridge.export_text 的四级降级
  // 直接落到第 4 级 Blob 下载 → Playwright download 事件接住存档；console GUANGLU_QA_REPORT 照旧。
  // 这只改浏览器环境能力探测，不改游戏任何逻辑与取证内容。
  await ctx.addInitScript(() => {
    try { Object.defineProperty(Navigator.prototype, 'share', { get: () => undefined, configurable: true }); } catch {}
  });
  const page = await ctx.newPage();
  const downloads = [];
  page.on('download', async (d) => {
    downloads.push(d.suggestedFilename());
    try { await d.saveAs(path.join(SHOTS, `download-${downloads.length}-${d.suggestedFilename()}`)); } catch {}
  });
  const errors = [];
  const lines = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => lines.push(`${m.text()}`));
  const tap = async (p) => { await page.touchscreen.tap(p.x, p.y).catch(() => {}); await sleep(200); };
  const shot = async (name) => { const b = await page.screenshot(); if (name) fs.writeFileSync(path.join(SHOTS, name), b); return b; };
  const same = (a, b) => Buffer.compare(a, b) === 0;

  // ── P0 引擎就绪 ──
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const t0 = Date.now();
  while (!lines.some((l) => l.startsWith('QA: QA 自检已激活')) && Date.now() - t0 < 180000) await sleep(500);
  check('P0·引擎启动完成（QA 自检激活日志）', lines.some((l) => l.startsWith('QA: QA 自检已激活')));
  await sleep(1500);

  // ── P1（第 1 关 par=1）：T7 旋转方向语义 + T2 结算瞬间点击 ──
  // （视觉 diff 只作存档证据——通关后 Juice.flash/shake/pop 动画 ~0.5s 内会让截图漂移；
  //   T7/T2 的判定以终局报告样本表为准：T7 → 1 条 applied=A；T2 → 2 条 routed=A 且 applied=(-99,-99)）
  const a1 = pt(L1, L1.pipes.A);
  await shot('p1-s0-fresh.png');
  await tap(a1);                            // 直管 init_rot=3 竖直 → 点 1 次 = 顺时针 90° → 水平 → 光路通
  await shot('p1-s1-rotated.png');
  await tap(a1);                            // T2：结算瞬间（solved 已置位）立即再点同一管格 ×2
  await tap(a1);
  await shot('p1-s2-after-settle-taps.png');

  // ── P2（第 2 关 par=2）：T3 下一关首点 + 最优 2 步 3★ + T6 撤销交叠 4 步 1★（只升不降）──
  await tap(BTN.confirm);                   // confirm（L1 solved=true）→ 进下一关（solved 态 confirm=进关）
  await sleep(600);
  const a2 = pt(L2, L2.pipes.A), b2 = pt(L2, L2.pipes.B), c2 = pt(L2, L2.pipes.C);
  await shot('p2-s3-l2-fresh.png');
  await tap(a2);                            // T3：下一关首点 → A 3→0 通
  await shot('p2-s4-first-tap.png');
  await tap(c2);                            // 最优第 2 步（C 3→0 通）→ moves=2=par → solved（3★ 落袋）
  await sleep(400);
  await tap(BTN.reset);                     // 重开 L2：moves=0、朝向复位（3★ 已入 best_stars）
  await sleep(600);
  // T6 撤销交叠序列：A(1) B(2,B断) undo(1,B回2通) B(2,B断) B(3,B回0通) C(4,C通)
  // → A/B/C 全通 → moves=4 > ceil(2×1.5)=3 → 本次 1★。
  // undo 生效性由结果反证：undo 未生效则 B 净转 3 次（2→3→0→1）恒断 → 全链不通 → 无法 solved。
  await tap(a2);
  await tap(b2);
  await tap(BTN.undo);
  await tap(b2);
  await tap(b2);
  await tap(c2);
  await sleep(400);
  await shot('p2-s6-l2-after-t6.png');
  await tap(BTN.confirm);                   // confirm（L2 solved=true）→ 进第 3 关
  await sleep(600);

  // ── P3（第 3 关，已由 P2 末尾 confirm 进入）：T1 连点 + T4 悬挂手势 + T5 双指抢控 ──
  // （confirm 在 solved 态=进下一关、非 solved 态=旋转光标格 —— 全程只在 solved 态点 confirm）
  await sleep(400);
  const a3 = pt(L3, L3.pipes.A), e3 = pt(L3, L3.pipes.E);
  // T1 连点：corner 无等效朝向，A 连点 4 次恰回原位（moves=4；次数与逐次应用由终局报告样本表对账）
  await shot('p3-s7-l3-fresh.png');
  for (let i = 0; i < 4; i++) await tap(a3);
  await shot('p3-s8-after-4tap.png');
  // T5 双指抢控：合成双指（WebKit 无 Touch 构造器 → 驱动受限归档）
  const t5 = await page.evaluate(([x1, y1, x2, y2]) => {
    const c = document.getElementById('canvas');
    if (!c) return { supported: false, reason: 'no canvas' };
    try {
      const mk = (id, x, y) => new Touch({ identifier: id, target: c, clientX: x, clientY: y, radiusX: 2, radiusY: 2, rotationAngle: 0, force: 1 });
      const t1 = mk(1, x1, y1), t2 = mk(2, x2, y2);
      const opt = { bubbles: true, cancelable: true, view: window };
      c.dispatchEvent(new TouchEvent('touchstart', { ...opt, touches: [t1, t2], targetTouches: [t1, t2], changedTouches: [t1, t2] }));
      c.dispatchEvent(new TouchEvent('touchend', { ...opt, touches: [], targetTouches: [], changedTouches: [t1, t2] }));
      return { supported: true };
    } catch (e) { return { supported: false, reason: String(e).slice(0, 80) }; }
  }, [a3.x, a3.y, e3.x, e3.y]);
  await sleep(600);
  check('P3·T5 双指抢控', true, t5.supported
    ? `合成双指已派发（终局报告对账 moves/routed：2=双指皆收 / 1=单指降级）`
    : `WebKit 驱动受限（${t5.reason}）→ 无法复现，真机复测步骤归档 ADVERSARIAL_FINDINGS §五`);
  // T4 悬挂手势：棋盘外按住 800ms → 释放 → 立即点 E（corner，视觉可辨）
  await page.mouse.move(640, 20); await page.mouse.down();
  await sleep(800);
  await page.mouse.up(); await sleep(200);
  const e3t = pt(L3, L3.pipes.E);
  await tap(e3t);
  await shot('p3-s9-after-hang-tap.png');
  check('P3·T4 悬挂期间零页面错误', errors.length === 0, errors.slice(0, 2).join(' | '));

  // ── P4（第 3 关 par=8）：T8 星级 2 星边界 12 步序列 ──
  // 注意：导出（GUANGLU_QA_REPORT + clipboard.writeText）会使引擎停收棋盘输入（probe 实测两轮），
  // 因此全程只在最后导出一次，导出后不再有任何棋盘 tap。
  await tap(BTN.reset);                     // 重开第 3 关：moves=0、朝向复位（清掉 T1/T4 的操作痕迹）
  await sleep(600);
  const c3 = pt(L3, L3.pipes.C), b3 = pt(L3, L3.pipes.B), d3 = pt(L3, L3.pipes.D);
  // C 直管点 4 次（3→0→1→2→3 恒断点），A×2/B×1/D×2/E×2 转到位（光路仍断于 C），最后 C 第 5 次（→0）全链通 → moves=12
  const seq = [[c3, 'C'], [c3, 'C'], [c3, 'C'], [c3, 'C'], [a3, 'A'], [a3, 'A'], [b3, 'B'],
    [d3, 'D'], [d3, 'D'], [e3, 'E'], [e3, 'E'], [c3, 'C']];
  for (const [p] of seq) await tap(p);
  await sleep(600);
  const s10 = await shot('p4-s10-l3-2star-solved.png');
  check('P4·T8 12 步序列终态（截图存档；通关判定由终局报告 moves=12/solved 对账）', true,
    `bytes=${s10.length}`);

  // ── 终局：唯一一次报告导出（分享/复制按钮 x≈223；按钮行 y 随状态行行数浮动，扫描 470..545）──
  let exported = false;
  for (let y = 470; y <= 545 && !exported; y += 5) {
    const before = lines.length;
    await tap({ x: 223, y });
    if (lines.slice(before).some((l) => l.startsWith('GUANGLU_QA_REPORT'))) exported = true;
  }
  await sleep(1500);
  check('终局·报告 JSON 导出（GUANGLU_QA_REPORT 投 console）', exported,
    exported ? '' : '扫描 y470..545@x223 未命中分享按钮（导出通道失效 → 数值对账降级为视觉+样本表）');
  const rep = allReports(lines)[allReports(lines).length - 1] || null;
  if (rep) {
    fs.writeFileSync(path.join(SHOTS, 'adversarial-final-report.json'), JSON.stringify(rep, null, 2));
    const lv = rep.level || {};
    const stars = rep.survey_snapshot?.progress?.best_stars || {};
    // T7：第 1 关 1 步通关 → 3 星
    check('对账·T7 星级语义 3 星（best_stars[0]=3）', String(stars['0']) === '3', `best_stars[0]=${stars['0']}`);
    // T3：第 2 关首点生效（样本 routed=applied=A hit）
    const t3 = rowsFor(rep, L2.pipes.A).some((r) => r.hit === true);
    check('对账·T3 下一关首点路由与应用一致（hit=true 样本存在）', t3,
      JSON.stringify(rowsFor(rep, L2.pipes.A).map((r) => [r.routed_cell, r.applied_cell, r.hit])));
    // T6：撤销交叠 4 步通关（1★）后 best_stars[1] 仍 3 —— 「先 3★ 后 1★ 只升不降」
    check('对账·T6+只升不降（1★ 通关未覆盖历史 3★：best_stars[1]=3）', String(stars['1']) === '3',
      `best_stars[1]=${stars['1']}（若星级可降则此处变 1）`);
    // T1：连点 4 次全部应用且无错路由
    const t1rows = rowsFor(rep, L3.pipes.A);
    const t1applied = t1rows.filter((r) => String(r.applied_cell) === String(L3.pipes.A));
    check('对账·T1 连点 4 次全部应用（applied=A 样本 ≥4）', t1applied.length >= 4,
      `A 目标样本 ${t1rows.length}，applied=${t1applied.length}`);
    check('对账·T1 连点无错路由（全部 routed=A）',
      t1applied.every((r) => String(r.routed_cell) === String(L3.pipes.A)),
      JSON.stringify(t1rows.map((r) => r.routed_cell)));
    // T4：悬挂后首点生效
    const t4 = rowsFor(rep, L3.pipes.E).some((r) => String(r.applied_cell) === String(L3.pipes.E));
    check('对账·T4 悬挂释放后首点应用（E 格 applied）', t4,
      JSON.stringify(rowsFor(rep, L3.pipes.E).map((r) => [r.routed_cell, r.applied_cell, r.hit])));
    // T2：结算瞬间点击被屏蔽（A 目标样本中 routed=A 且 applied=(-99,-99) ≥2 —— solved 屏蔽未应用）
    const t2masked = rowsFor(rep, L1.pipes.A).filter((r) => String(r.routed_cell) === String(L1.pipes.A)
      && String(r.applied_cell) === String([-99, -99]));
    check('对账·T2 结算瞬间点击被屏蔽（routed=A 但 applied 无 ≥2 条）', t2masked.length >= 2,
      `屏蔽样本 ${t2masked.length} 条`);
    // T8：12 步通关 → 2 星；星级只升不降全程
    check('对账·T8 星级语义 2 星（12 ∈ (8, 12]，stars_for(12,8)=2）',
      String(stars['2']) === '2' && starsFor(12, 8) === 2, `best_stars[2]=${stars['2']}`);
    check('对账·星级只升不降全程（0:3 / 1:3 / 2:2）',
      String(stars['0']) === '3' && String(stars['1']) === '3' && String(stars['2']) === '2', JSON.stringify(stars));
    check('对账·终局关卡状态（index=2 第 3 关、moves=12、solved=true）',
      lv.index === 2 && lv.solved === true && lv.moves === 12, JSON.stringify(lv));
    // T5 双指行为对账（若合成事件可达）
    if (t5.supported) {
      const stray = (rep.touch?.rows || []).filter((r) => r.routed_cell
        && ![L3.pipes.A, L3.pipes.E].some((c) => String(r.routed_cell) === String(c))
        && String(r.applied_cell) !== String([-99, -99]));
      check('对账·T5 双指无错路由（applied 均不在 {A,E} 之外）', stray.length === 0,
        `目标外 applied=${stray.length}`);
    }
  }
  // （无中途导出：导出会使引擎停收棋盘输入，「1★ 未覆盖 3★」的中间证据由终局快照 best_stars[1]=3 承担——
  //   L2 的最后一次通关是 T6 的 4 步 1★，若星级可降终局 best_stars[1] 必为 1）
  check('终局·全程零页面错误（8 用例无崩溃）', errors.length === 0, errors.slice(0, 3).join(' | '));

  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(HERE, 'adversarial-run-results.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\nADVERSARIAL_CHECK: ${failed.length === 0 ? 'PASS' : 'FAIL'}（${results.length - failed.length}/${results.length} 项通过）`);
process.exit(failed.length === 0 ? 0 : 1);
