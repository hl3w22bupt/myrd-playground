# levels.md — 关卡状态（共享黑板）

> 更新时间：2026-09-23（程序节点复验批次 · 游戏程序）
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

## 实跑证据（2026-09-23 程序节点复验回填，原文见 gate-logs/transport-ship-3d/full-suite-20260923-194809.log）

1. **契约门禁**：`node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .` → **71 PASS / 0 FAIL**（spec v3 approved）。
2. **验收测试**：ac-1 单文件 / ac-2 确定性（2441+2700 tick 逐字段一致）/ ac-3 武器数值 / ac-4 波次 / ac-6 QA 审计 —— 全 PASS（exit 0）。
3. **真浏览器冒烟（本次升级为 CDP 门禁工具）**：`node games/transport-ship-3d/tools/smoke.mjs`（headless Chrome + SwiftShader，7 断言全过、exit 0）——
   页面打开出结果 JSON、渲染管线出画（drawCalls=9 / triangles=2700）、内核 time 9.78s→10.90s 增长、快进至阵亡进入 gameover 态、
   重玩钩子落账 localStorage、重开页面标题屏回显「最高 0 · 上次 第 1 波」、**0 个未捕获异常**。
4. **数值曲线**：基线 bot 四种子（1/42/777/20260923）静态站位存活 82–89s 至第 4 波；清波回血/奖励按 spec v3 口径生效。
5. **操作路径复核**：打开即见标题屏（操作说明 10 秒可读）→ 点击开始锁定鼠标 → 波次告示 → 击杀得分/受击红闪/雷达敌点 → 阵亡结算屏 → 一键重开。

### 程序节点复验增量（本批次改动，均为与 spec 对齐，非新设计）

| 改动 | 依据 | 证据 |
|---|---|---|
| 闭合 `spec.content.replayHooks`（high_score / wave_streak / daily_seed）——此前 spec 声明了但工程零落地 | spec.content.replayHooks 三钩子声明；口径对标知识文档「每张图固定随机种子」 | 冒烟断言 ⑤⑥：落账 localStorage + 重载回显（截图 smoke-title-replay-hooks.png） |
| 首局种子由硬编码 `20260923` 改为当日种子 `dailySeed()`；重开局仍用时间随机 | 同上（布景复现性与对局内随机口径不变） | 冒烟两次运行结果随种子变化（29.22s 阵亡 / 37.57s 阵亡 / 30s 存活），确定性由 ac-2 机判保证 |
| `src/numeric.js` 头注 v2 → v3（纯注释，无数值变化） | spec meta.version=3 | qa-audit 数值 41 键双向零偏差复跑 PASS |
| 新增 `tools/smoke.mjs`（CDP 冒烟门禁，零依赖） | 角色规范「冒烟门禁」要求 + 平台反卡死纪律（60s 超时/显式失败退出码） | gate-logs full-suite-20260923-194809.log 第 2 节 |

> 判定口径：以上为「可核对状态」，不是「已完成」——人工试玩验收未做，关卡状态标 ✅ 可玩而非完结。
