// live-smoke-g2.mjs — 线上 LIVE-SMOKE（对齐 tools/smoke.mjs 关键断言，直指 AppHost 部署 URL）
// 用法：node /tmp/live-smoke-g2.mjs <liveGwUrl>
import { rmSync } from 'node:fs';
import { findChromeOrDie, launchChromeWithPage, Cdp, teardown } from '/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks-wx/tools/cdp.mjs';

const LIVE = process.argv[2];
if (!LIVE) { console.error('usage: node live-smoke-g2.mjs <liveGwUrl>'); process.exit(2); }
const die = (m) => { console.error(`LIVE-SMOKE FAIL: ${m}`); process.exitCode = 1; throw new Error(m); };
const say = (m) => console.log(`[live-smoke] ${m}`);

const chromeBin = findChromeOrDie(die);
const { proc, wsUrl, userDir } = await launchChromeWithPage(chromeBin, die);
try {
  const cdp = new Cdp(wsUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  say(`目标 ${LIVE} · viewport=390x844 throttle=4x`);

  const loaded = new Promise((resolve) => {
    const onMsg = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.method === 'Page.loadEventFired') { cdp.ws.removeEventListener('message', onMsg); resolve(); }
    };
    cdp.ws.addEventListener('message', onMsg);
  });
  await cdp.send('Page.navigate', { url: LIVE });
  await loaded;
  say('浏览器可开：页面加载完成');

  await cdp.eval('new Promise((r) => { const t = setInterval(() => { if (window.__G2_READY === true) { clearInterval(t); r(true); } }, 50); })');
  say('游戏就绪 __G2_READY=true');

  const st = await cdp.eval('window.__G2_STATE()');
  if (st.boardLen !== 64) die(`盘面 ${st.boardLen} ≠ 64`);
  say(`盘面 ${st.boardLen} 格满员`);

  async function hand(label) {
    const move = await cdp.eval('window.__G2_FIND_MOVE_ANY()');
    if (!move) die(`${label}: 找不到可行手`);
    const before = await cdp.eval('window.__G2_STATE()');
    await cdp.eval(`window.__G2_TAP(${move[0]})`);
    await cdp.eval(`window.__G2_TAP(${move[1]})`);
    await cdp.eval('new Promise((r) => setTimeout(r, 800))');
    const after = await cdp.eval('window.__G2_STATE()');
    if (!(after.score > before.score)) die(`${label}: 交换后未得分（${before.score} → ${after.score}）`);
    const j1v = await cdp.eval('window.__G2_J1');
    say(`${label}: score ${before.score} → ${after.score}（chain ${after.chain}）${j1v ? ` J1=${j1v.measuredMs}ms` : ''}`);
    return after.score;
  }
  const s1 = await hand('手1（首消）');
  const s2 = await hand('手2（连击路径）');
  if (s2 <= s1) die('第二手未继续得分');

  await cdp.eval('window.__G2_RESTART()');
  await cdp.eval('new Promise((r) => setTimeout(r, 500))');
  const st3 = await cdp.eval('window.__G2_STATE()');
  if (st3.score !== 0 || st3.status !== 'playing') die(`重开未复位: ${JSON.stringify(st3)}`);
  say(`重开全复位 ✓（score=${st3.score} status=${st3.status}）`);

  const errs = cdp.consoleErrors || [];
  if (errs.length) die(`控制台错误 ${errs.length} 条: ${errs[0]}`);
  say('控制台零错误 ✓');
  say('LIVE-SMOKE: PASS 线上可开 + 核心循环可玩 + 重开复位 + 零控制台错误');
} finally {
  await teardown(proc, userDir, { rmSync });
}
