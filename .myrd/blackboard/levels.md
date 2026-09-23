# levels.md — 关卡状态（共享黑板）

> 更新时间：2026-09-23（门禁侧补跑批次 · 游戏程序）
> 负责人：主策划（写「可核对状态」：哪关能玩、操作路径、门禁证据；不写「已完成」）
> 下一步：实现后回填「实跑证据」区；人工验收未拍板前不标完成

---

## 关卡清单（spec.levels 一一对应）

| 关卡 id | 名称 | 落点 | 状态 |
|---|---|---|---|
| lvl-01-deck | 运输船甲板 · 波次生存 | `games/transport-ship-3d/src/levels/level-01-deck.js` | ✅ 可玩（机判全绿；待主人人工验收） |

### lvl-01-deck 元素编号表（元素编号 = `<level.id>/<element.id>`，稳定唯一）

| 编号 | 元素 | 期望 |
|---|---|---|
| lvl-01-deck/player-start | 玩家出生点 | 甲板中部，面向舰桥 |
| lvl-01-deck/bridge | 舰桥（层叠舱室） | 掩体 + 天际线锚点 |
| lvl-01-deck/container-a | 集装箱群 A（军绿） | 可绕行掩体，出生点视线遮挡 |
| lvl-01-deck/container-b | 集装箱群 B（土黄） | 与 A 错位形成通道 |
| lvl-01-deck/helipad | 尾部停机坪 | 圆形地标（H 标线 Canvas 贴图） |
| lvl-01-deck/crane | 舷侧吊臂 | 竖直构图锚点 |
| lvl-01-deck/railing | 甲板围栏 | 边界（阻挡玩家出界） |
| lvl-01-deck/sea | 海面 + 天空穹顶 | 渐变穹顶跟随相机 + 海雾 |
| lvl-01-deck/spawn-north | 敌兵出生点 N | 舰桥方向 |
| lvl-01-deck/spawn-east | 敌兵出生点 E | 右舷集装箱后 |
| lvl-01-deck/spawn-west | 敌兵出生点 W | 左舷吊臂后 |

## 操作路径（点开即玩的引导线）

1. 打开 `games/transport-ship-3d/index.html`（或任意静态服务器）→ 标题屏 10 秒内可读「WASD 移动 / 鼠标射击 / R 换弹 / 目标：活过波次拿高分」。
2. 点击画面锁定指针 → 进入 playing；Esc 暂停/释放。
3. 敌兵从 N/E/W 三点按波次进入 → 击杀得分、波次清空拿奖励 → 下一波更强。
4. 血量归零 → 结算屏（得分/波次/击杀/用时）→ 一键重开。

## 实跑证据（2026-09-23 门禁侧补跑批次回填，锚定游戏工程提交 `c083db7`，原文见 gate-logs/transport-ship-3d/full-suite-224134-head-c083db7.log）

1. **契约门禁**：`node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .` → **71 PASS / 0 FAIL**（spec v3 approved）。
2. **验收测试**：ac-1 单文件 / ac-2 确定性（2441+2700 tick 逐字段一致）/ ac-3 武器数值 / ac-4 波次 / ac-6 QA 审计 —— 全 PASS（exit 0）；qa-audit ④ stamp=`8c562f1d…` ↔ 指纹匹配（覆盖美术批 assets/ 与模板）。
3. **真浏览器冒烟（CDP 门禁工具，8 断言全过、exit 0）**：页面打开出结果 JSON、渲染管线出画（drawCalls=9 / triangles=2700）、
   内核 time 9.00s→10.20s 增长、**开火链路机判（?fire=3 → shotsFired=17 / shotsHit=0）**、快进至阵亡进入 gameover 态、
   重玩钩子落账 localStorage、重开页面标题屏回显「最高 0 · 上次 第 1 波」、**0 个未捕获异常**。
4. **数值曲线**：基线 bot 四种子（1/42/777/20260923）静态站位存活 82–89s 至第 4 波；清波回血/奖励按 spec v3 口径生效。
5. **操作路径复核**：打开即见标题屏（操作说明 10 秒可读）→ 点击开始锁定鼠标 → 波次告示 → 击杀得分/受击红闪/雷达敌点 → 阵亡结算屏 → 一键重开。

### 门禁侧补跑批次增量（驳回修复，均与 spec 对齐）

| 驳回点 | 修复 | 证据 |
|---|---|---|
| ① 门禁证据滞后于 HEAD（美术批 1e61157 后无全量日志） | 对当前 HEAD 全量重跑 contract-check + ac-1~ac-4 + ac-6 + tools/smoke.mjs，日志落盘 | `full-suite-221805-head-043e8ab.log` |
| ② 目录内最新日志实为 Godot 糖果线 | 本批次日志明确锚定 transport-ship-3d spec 与 HEAD hash | 同上（文件名含 head hash） |
| ③ SRC_SHA 指纹只盖 src/，未盖产物实际内联的 assets/*.mjs 与 index.template.html | 算法收口到新模块 `tools/src-sha.mjs`（构建器与 qa-audit ④ 共用同一实现），指纹范围扩为 **src + assets + index.template.html + tools/build.mjs + tools/src-sha.mjs** | 日志第 0 节 SRC_SHA=2a98f7be…；qa-audit PASS 行内打印指纹范围 |
| ④ 实现私加 spec 未声明编号 container-a-2 / container-b-2（13 vs 11） | 实现收敛：同一 spec 元素多体块时后续体块改带 `group` 指回元素编号（几何零变化，内核不读 id）；qa-audit ⑤ 增加 **code→spec 双向集合相等**断言 | 日志第 4 节负向验证：1e61157 会 FAIL（私加 2 个），当前 11↔11 PASS；游戏内截图确认贴图按 group 正常分派 |
| ⑤ 黑板互查基线表未更新至 HEAD | qa-crosscheck.md「二、互查基线」重写为 @043e8ab 实跑结果；blockers.md B-5 门禁措辞同步更正 | qa-crosscheck.md 二 |

> 判定口径：以上为「可核对状态」，不是「已完成」——人工试玩验收未做，关卡状态标 ✅ 可玩而非完结。
