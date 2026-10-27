// a6-td-operation-paths — 操作路径 5 条全部 headless 可达且各带视觉锚断言
// spec acceptance a6：path-place-turret-01 / path-upgrade-turret-01 / path-speed-toggle-01 /
//   path-restart-01 / path-guidance-dismiss-01（步骤与锚以 world.operationPaths 为准）。样本量=5/5。
// 锚口径：sim.fx/ui 的 tick 派生状态字段（确定性视觉状态）+ renderer 绘桩零异常。
import { loadCfg, loadSpec, stubCtx, assert, GAME_ROOT } from '../helpers.mjs';
import { join } from 'node:path';

const { Game } = await import(join(GAME_ROOT, 'src', 'game.ts'));
const { render } = await import(join(GAME_ROOT, 'src', 'render', 'renderer.ts'));
const { FIELD_W, FIELD_H } = await import(join(GAME_ROOT, 'src', 'render', 'theme.ts'));

const cfg = loadCfg();
const spec = loadSpec();
const paths = spec.world.operationPaths;
assert(paths.length === 5, `operationPaths ${paths.length} ≠ 5`);
const pathIds = paths.map((p) => p.id).sort();
assert(JSON.stringify(pathIds) === JSON.stringify([
  'path-guidance-dismiss-01', 'path-place-turret-01', 'path-restart-01', 'path-speed-toggle-01', 'path-upgrade-turret-01',
]), `path id 集合失配: ${pathIds.join(',')}`);

const smokes = [];
function smokeRender(game) {
  const ctx = stubCtx();
  const view = { scale: 1, offX: 0, offY: 0, w: FIELD_W, h: FIELD_H };
  render(ctx, view, game.phase === 'title' ? null : game.sim, game.ui, game.phase, cfg);
  assert(ctx.ops.length > 50, `绘桩操作数 ${ctx.ops.length} 过少（渲染断链）`);
  smokes.push(ctx.ops.length);
}

// —— path-place-turret-01：点选空格 → 菜单确认 → 落位+射程圈 ——
const g1 = new Game({ cfg });
g1.advanceTitle(400);
g1.pointerDown(320, 252);
assert(g1.pointerDown(496, 208) && g1.ui.pendingTile === '15,6', '① 空格点选未进放置菜单');
assert(g1.pointerDown(320, 344), '① 放置菜单确认失败');
assert(g1.sim.turrets.length === 1 && g1.sim.fx.placeTicksLeft > 0, '① 落位弹跳锚缺失（fx.placeTicksLeft=0）');
smokeRender(g1);

// —— path-upgrade-turret-01：点选已建 → 升级 → 等级+1 ——
g1.pointerDown(496, 208);
assert(g1.ui.selectedTurretId === 1, '② 已建炮塔未选中');
g1.sim.gold = Math.max(g1.sim.gold, 80); // 驱动面补足军费（harness 合法面：等价玩家刷钱）
assert(g1.pointerDown(320, 344), '② 升级确认失败');
assert(g1.sim.turrets[0].level === 2 && g1.sim.fx.upgradeTicksLeft > 0, '② 等级星标+1 锚缺失');
smokeRender(g1);

// —— path-speed-toggle-01：加速按钮 ×1↔×2（态色块锚=speed 值翻转）——
assert(g1.pointerDown(FIELD_W - 52, 22), '③ 加速按钮未命中');
assert(g1.sim.speed === 2, '③ ×2 未生效');
assert(g1.pointerDown(FIELD_W - 52, 22) && g1.sim.speed === 1, '③ ×1 回切未生效');
smokeRender(g1);

// —— path-guidance-dismiss-01：hint 展示 → 5s 窗内首操作 → 淡出不再复现 ——
const g2 = new Game({ cfg });
g2.advanceTitle(400);
g2.pointerDown(320, 252); // 首操作=开始（消散）
assert(g2.sim.fx.guidanceHidden && g2.sim.fx.guidanceFadeTicks > 0, '④ 浮层淡出锚缺失');
g2.tick(20);
assert(g2.sim.fx.guidanceHidden, '④ 浮层复现（应不再复现）');
smokeRender(g2);

// —— path-restart-01：战局结束 → 结算页 → 再来一局（restart_clicked+1 → 全复位）——
const g3 = new Game({ cfg });
g3.advanceTitle(200);
g3.pointerDown(320, 252);
let guard = 0;
while (g3.phase === 'running' && guard < 60000) { g3.tick(1); guard += 1; }
assert(g3.phase === 'settled', '⑤ 未进结算页');
const livesBefore = g3.sim.coreLives;
assert(g3.pointerDown(320, 236), '⑤ 再来一局点击未生效');
assert(g3.sim.restartCount === 1 && g3.phase === 'running', '⑤ 重开未全复位');
assert(g3.sim.coreLives === cfg.coreLives && g3.sim.tick === 0, `⑤ 复位失真（lives ${livesBefore}→${g3.sim.coreLives} tick=${g3.sim.tick}）`);
smokeRender(g3);

console.log(`PASS a6-td-operation-paths 5/5 条可达（place/up/speed/guidance/restart 锚全带）· 绘桩 smoke ${smokes.length} 帧零异常`);
