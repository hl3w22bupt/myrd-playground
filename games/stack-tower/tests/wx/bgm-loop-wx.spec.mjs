#!/usr/bin/env node
/**
 * bgm-loop wx 冒烟（B0 · N3 wx devtools 轨判据之一：「bgm-loop 无 wx 结果」拒绝线的正面闭环）。
 *
 * 被测对象 = wx 包编译产物（export/wx/build-wx/audio/bgm.js 的 createBgmLoop——与真机同一份代码），
 * 调度连续性以手动泵确定性推进（验收口径原文：BGM onShow/onHide / 静音键 / 首触解锁）。
 * 另断言 wx 侧接线（InnerAudioContext loop/obeyMuteSwitch/src）与素材环长同值。
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUNDLE = path.join(GAME, 'export/wx/build-wx/audio/bgm.js');
const WX_BUNDLE = path.join(GAME, 'export/wx/build-wx/platform/wx.js');
const BGM_MANIFEST = JSON.parse(readFileSync(path.join(GAME, 'assets/bgm/manifest.json'), 'utf8'));

// 游戏包 type:module → 以 .cjs 副本装载 CJS 产物
const tmp = path.join(GAME, 'export/wx/.tmp-bgm.cjs');
readFileSync(BUNDLE);
const { writeFileSync, rmSync } = await import('node:fs');
writeFileSync(tmp, readFileSync(BUNDLE));
const { createBgmLoop, LOOP_MS, GAP_BUDGET_MS, LOOKAHEAD_MS } = createRequire(import.meta.url)(tmp);
rmSync(tmp);

const failures = [];
const check = (name, cond) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures.push(name); console.log(`  FAIL  ${name}`); }
};

// 手动泵 sink：记录 start/stop；可听性按 mutedProvider 实时计算（与 wx 真件 volume=0 语义对齐）
function pumpSink(mutedProvider = () => false) {
  const sink = { starts: 0, stops: 0 };
  return {
    sink,
    start() { sink.starts += 1; },
    stop() { sink.stops += 1; },
    isAudible() { return !mutedProvider(); },
  };
}

// ① 首触解锁口径：start() 先于 unlock → 入队不启；unlock() 补启（不吞不延首次出声）
{
  const p = pumpSink();
  let now = 0;
  const bgm = createBgmLoop({ sink: p, now: () => now, mutedProvider: () => false });
  bgm.start();
  check('start() 未解锁不启动（入队挂起）', p.sink.starts === 0 && bgm.stats().started === true);
  bgm.unlock();
  check('unlock() 补启挂起的 start（首触解锁口径）', p.sink.starts === 1);
}
// ② 调度连续性：预约点与圈界缝隙
{
  const p = pumpSink();
  let now = 0;
  const bgm = createBgmLoop({ sink: p, now: () => now, mutedProvider: () => false });
  bgm.unlock();
  bgm.start();
  bgm.tick(0);
  check(`圈长常量 LOOP_MS=${LOOP_MS} 与素材 manifest 一致`, LOOP_MS === BGM_MANIFEST.durationMs);
  bgm.tick(LOOP_MS - LOOKAHEAD_MS);
  check('距圈尾 LOOKAHEAD_MS 预约下一圈', bgm.stats().loopsScheduled === 2);
  bgm.tick(LOOP_MS); // 恰在圈界换圈
  check('圈界换圈缝隙=0（连续）', bgm.stats().lastGapMs === 0 && bgm.stats().gapViolations === 0);
  now = 0; // 重置一环再测违例
  const p2 = pumpSink();
  const bgm2 = createBgmLoop({ sink: p2, now: () => now, mutedProvider: () => false });
  bgm2.unlock();
  bgm2.start();
  bgm2.tick(0);
  now = LOOP_MS + GAP_BUDGET_MS + 1;
  bgm2.tick(now);
  check(`缝隙 > ${GAP_BUDGET_MS}ms 记违例`, bgm2.stats().gapViolations === 1 && bgm2.stats().lastGapMs === GAP_BUDGET_MS + 1);
}
// ③ onShow/onHide（验收口径原文）
{
  const p = pumpSink();
  let now = 0;
  const bgm = createBgmLoop({ sink: p, now: () => now, mutedProvider: () => false });
  bgm.unlock();
  bgm.start();
  bgm.pause(); // wx.onHide
  check('onHide → 暂停（sink stop，环态 paused）', p.sink.stops === 1 && bgm.stats().paused === true);
  bgm.resume(); // wx.onShow
  check('onShow → 恢复出声（重新 start）', p.sink.starts === 2 && bgm.stats().paused === false);
  bgm.resume();
  check('resume 幂等', p.sink.starts === 2);
}
// ④ 静音键同源（st.settings.muted → mutedProvider）
{
  let muted = false;
  const p = pumpSink(() => muted);
  let now = 0;
  const bgm = createBgmLoop({ sink: p, now: () => now, mutedProvider: () => muted });
  bgm.unlock();
  bgm.start();
  muted = true;
  bgm.tick(10); // syncMuted → 静音槽互换（重启槽）
  check('静音态：环静音（isAudible=false）且零输出槽生效', bgm.stats().muted === true && p.isAudible() === false);
  muted = false;
  bgm.tick(20);
  check('解除静音：环恢复可听', bgm.stats().muted === false && p.isAudible() === true);
}
// ⑤ wx 侧接线断言（编译产物文本面：真机同一份）
{
  const wxSrc = readFileSync(WX_BUNDLE, 'utf8');
  check('InnerAudioContext loop=true（wx 环出口）', /loop\s*=\s*true/.test(wxSrc));
  check('obeyMuteSwitch=true（跟随系统静音键）', /obeyMuteSwitch\s*=\s*true/.test(wxSrc));
  check('BGM 素材接线 assets/bgm/neon-loop.m4a', wxSrc.includes('assets/bgm/neon-loop.m4a'));
  check('onShow resume / onHide pause 接线', /onShow\(/.test(wxSrc) && /onHide\(/.test(wxSrc) && /bgm\.resume\(\)/.test(wxSrc) && /bgm\.pause\(\)/.test(wxSrc));
  check('首触解锁：onTouchStart 内 unlock（BGM 补启）', /onTouchStart/.test(wxSrc) && /bgm\.unlock\(\)/.test(wxSrc));
}

const total = 14;
if (failures.length) {
  console.log(`RESULT: FAIL (${total - failures.length}/${total})`);
  process.exit(1);
}
console.log(`RESULT: PASS  — bgm-loop wx 结果就绪（${total} 断言，被测=export/wx/build-wx 同一份代码）`);
