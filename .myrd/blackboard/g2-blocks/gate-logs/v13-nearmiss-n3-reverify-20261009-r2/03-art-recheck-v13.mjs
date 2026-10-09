#!/usr/bin/env node
// 03-art-recheck-v13.mjs — V1.3 首批 N3 美术线复证器（复证不新做 · 判据钉 approved/链 v8 冻结面）
// 用法：node 03-art-recheck-v13.mjs <g2-blocks-v13 工作树路径>
// 判据零改动声明：本件为 N3 复证工具，只读源仓 + 重跑两个确定性生成器比对字节；不写源仓任何文件。
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] || '';
if (!ROOT) { console.error('usage: node 03-art-recheck-v13.mjs <v13-worktree>'); process.exit(2); }
let pass = 0, fail = 0;
const ok = (id, msg) => { pass += 1; console.log(`PASS  ${id} ${msg}`); };
const bad = (id, msg) => { fail += 1; console.log(`FAIL  ${id} ${msg}`); };
const check = (id, cond, msg) => (cond ? ok : bad)(id, msg);
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

process.env.G2_SPEC_PATH = process.env.G2_SPEC_PATH || join(ROOT, '..', 'run-cmv09tbrg003vm9vijx5bdv8j', '.myrd', 'spec', 'g2-blocks', 'design-spec.json');

// ---------- A. a08 near-miss 视听包 ----------
const a08 = JSON.parse(readFileSync(join(ROOT, 'assets/nearmiss/nearmiss-av-pack.json'), 'utf8'));
check('A08/a', a08.id === 'a08-nearmiss-av-pack', `id=${a08.id}`);
check('A08/b', a08.sfxVariant.variantParams.freqFromHz === 880 && a08.sfxVariant.variantParams.freqToHz === 440,
  `下行尾音 ${a08.sfxVariant.variantParams.freqFromHz}→${a08.sfxVariant.variantParams.freqToHz}Hz`);
check('A08/c', a08.sfxVariant.variantParams.durationMs === 80 && a08.sfxVariant.baseParams.durationMs === 160,
  `时长减半 ${a08.sfxVariant.baseParams.durationMs}→${a08.sfxVariant.variantParams.durationMs}ms`);
check('A08/d', a08.sfxVariant.variantRules.tail === 'descending' && a08.sfxVariant.variantRules.durationScale === 0.5 && a08.sfxVariant.variantRules.tier === 2,
  `变参规则 tail/durationScale/tier = ${a08.sfxVariant.variantRules.tail}/${a08.sfxVariant.variantRules.durationScale}/${a08.sfxVariant.variantRules.tier}`);
check('A08/e', a08.visualConstraints.particles === 'none' && a08.visualConstraints.screenShake === 'none' && a08.visualConstraints.edgeHighlight === 'transient-not-latched',
  `硬约束 零粒子/不震屏/不常亮 三声明在包`);

// 边行色派生复算：判据 = theme.ts desaturate 单源 import 现算（零手抄第二份公式 —— 首版自带亮度混合式
// 误报 #d8b8bf 已作废，正确纪律 = 消费源仓单源函数，见 04-first-run-correction.log）
const themeForDesat = await import(join(ROOT, 'src/render/theme.ts'));
const edgeDerived = themeForDesat.desaturate('#E3B5BF', 0.3);
check('A08/f', edgeDerived === a08.colorSource.edge,
  `edge 派生复算（theme.desaturate 现算）${edgeDerived} ≡ pack ${a08.colorSource.edge}（desat(coolBannerText,0.3)）`);

// ---------- B. a09 结算页槽位包 ----------
const a09 = JSON.parse(readFileSync(join(ROOT, 'assets/settlement/settlement-ia-pack.json'), 'utf8'));
const slotIds = a09.slots.map((s) => s.id);
check('A09/a', a09.slots.length === 6, `六槽 = ${a09.slots.length}`);
check('A09/b', slotIds.join(',') === 'result-slot-score,result-slot-chain,result-slot-moves,result-slot-attribution,result-slot-action-restart,result-slot-action-daily',
  `稳定 id 全枚举`);
const layers = [...new Set(a09.slots.map((s) => s.layer))];
check('A09/c', layers.join(',') === 'P0-result,P1-result,P2-result,P3-attribution-action', `三层四段 = ${layers.join('/')}`);
check('A09/d', a09.touchTarget.minPx >= 48, `触达 ≥${a09.touchTarget.minPx}px`);
check('A09/e', a09.shareCard?.id === 'share-card-v13', `分享卡模板 ${a09.shareCard?.id}`);
check('A09/f', Object.keys(a09.copy).length === 6 && Object.keys(a09.nearMissCopy).length === 6,
  `文案枚举 copy ${Object.keys(a09.copy).length} 条 + nearMissCopy ${Object.keys(a09.nearMissCopy).length} 条`);

// ---------- C. 运行时派生复算（import 源仓单源，非手抄） ----------
const themeMod = await import(join(ROOT, 'src/render/theme.ts'));
check('C/a', themeMod.NEARMISS_UI.edge === '#dcbcb5', `theme.NEARMISS_UI.edge = ${themeMod.NEARMISS_UI.edge}（降饱和 30% 单源派生）`);
const nmMod = await import(join(ROOT, 'src/render/nearmiss.ts'));
const sfx = nmMod.nearMissSfxSpec();
check('C/b', sfx.freqFromHz === 880 && sfx.freqToHz === 440 && sfx.durationMs === 80,
  `nearMissSfxSpec 现算 ${sfx.freqFromHz}→${sfx.freqToHz}Hz / ${sfx.durationMs}ms（第二档承值派生）`);
check('C/c', sfx.wave === 'square' && sfx.envelope === 'step-up' && sfx.gainMul === 1.15 && sfx.detuneCents === 35,
  `波形/包络/增益/失谐承第二档原值 ${sfx.wave}/${sfx.envelope}/${sfx.gainMul}/${sfx.detuneCents}`);
const cfg = nmMod.nearMissConfig();
check('C/d', cfg.perRowPerRun === 1 && cfg.globalPerRun === 3, `弱反馈频控 每行 ${cfg.perRowPerRun} 次/局 + 全局 ≤${cfg.globalPerRun} 次/局（链 v8 口径）`);

// ---------- D. a10 六张实机截图 ----------
const man = JSON.parse(readFileSync(join(ROOT, 'assets/release/v13-shots/shot-manifest.json'), 'utf8'));
const states = ['nm-hit', 'settle-nm', 'settle-nomoves'], tiers = ['390x844', '430x932'];
const dims = { '390x844': [780, 1688], '430x932': [860, 1864] };
check('D/a', man.shots.length === 6, `清单 ${man.shots.length} 张`);
check('D/b', typeof man.buildSha256 === 'string' && /^[0-9a-f]{64}$/.test(man.buildSha256), `同批判据 buildSha256=${man.buildSha256.slice(0, 8)}…`);
let namingOk = true, ihdrOk = true, bytesOk = true;
for (const st of states) for (const tier of tiers) {
  const f = `shot-v13-${st}-${tier}.png`;
  const p = join(ROOT, 'assets/release/v13-shots', f);
  let buf;
  try { buf = readFileSync(p); } catch { namingOk = false; bad('D/c', `${f} 缺盘`); continue; }
  const rec = man.shots.find((s) => s.file === f);
  if (!rec || rec.state !== st || rec.tier !== tier) namingOk = false;
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (w !== dims[tier][0] || h !== dims[tier][1]) ihdrOk = false;
  if (buf.length !== rec.bytes) bytesOk = false;
}
check('D/c', namingOk, `三态×两档矩阵 + 命名 shot-v13-<态>-<档>.png 全符（挂稳定 id）`);
check('D/d', ihdrOk, `IHDR 尺寸 @2x 全符（780×1688 / 860×1864）`);
check('D/e', bytesOk, `六张字节量 ≡ shot-manifest 逐张相等（同批复证锚）`);

// ---------- E. 生成器纪律：零裸 hex + 确定性重跑 ----------
for (const g of ['tools/gen-nearmiss-pack.mjs', 'tools/gen-settlement-pack.mjs']) {
  const src = readFileSync(join(ROOT, g), 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const hexes = src.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const rgbas = src.match(/\brgba?\(\s*\d/g) || [];
  check(`E/${g}`, hexes.length === 0 && rgbas.length === 0, `零裸 hex / 零 rgba 字面量（命中 ${hexes.length + rgbas.length}）`);
}
const detTargets = ['assets/nearmiss/nearmiss-av-pack.json', 'assets/settlement/settlement-ia-pack.json'];
const before = Object.fromEntries(detTargets.map((p) => [p, sha(join(ROOT, p))]));
for (const g of ['tools/gen-nearmiss-pack.mjs', 'tools/gen-settlement-pack.mjs']) {
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [join(ROOT, g)], { cwd: ROOT, stdio: 'ignore' });
}
const drift = detTargets.filter((p) => sha(join(ROOT, p)) !== before[p]);
check('E/det', drift.length === 0, `两生成器重跑逐字节一致（漂移 ${drift.length} 件）`);

// ---------- F. 渲染面硬约束文本断言 ----------
const rendererSrc = readFileSync(join(ROOT, 'src/render/renderer.ts'), 'utf8');
const drawNm = rendererSrc.slice(rendererSrc.indexOf('export function drawNearMiss'), rendererSrc.indexOf('export function drawSettlement'));
check('F/a', /now >= nm\.holdUntil\) return/.test(drawNm), `不常亮：驻留窗外零绘制（transient-not-latched 实现面）`);
check('F/b', !/st\.particles\s*[+.]|st\.particles\.push|particles\.push/.test(drawNm) && !/st\.shake\s*=/.test(drawNm),
  `零粒子/不震屏：drawNearMiss 函数体零 particles 写入、零 shake 写入`);
check('F/c', drawNm.includes('NEARMISS_UI.edge'), `边行高亮色源 = NEARMISS_UI.edge 单源（theme 派生 token）`);

console.log(`\nART-RECHECK-V13: ${fail === 0 ? 'PASS' : 'RED'} ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
