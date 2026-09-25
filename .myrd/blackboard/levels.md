# 关卡状态黑板 — stack-tower（M2 首卡）

> 更新时间：2026-09-25（**M2.1「有声可装」收口**：lvl-01 维持 green（冻结 8 条零改动回归 PASS）+ M2.1 契约族 14 条全绿；契约总盘 22/22 PASS + 冒烟 PASS + 资产门禁 PASS）
> 负责人：主策划（整合人）· 全团队共用，改前先读，改后写更新时间
> 下一步：主人试玩终裁「好不好玩」（代持 approved 候选版的最后一道人工闸）

## 状态图例
`spec-only`（仅策划案定义）→ `scaffold`（契约骨架已落盘，not-runnable）→ `implemented`（实现落盘，契约可跑）→ `green`（契约 pass）→ `accepted`（主人试玩拍板）

## 关卡状态表

| level_id | 状态 | 数值来源 | 契约测试 | 备注 |
|---|---|---|---|---|
| lvl-01-stack-tower | **green**（spec **v3 approved** + 契约总盘 **22/22 PASS**（冻结 8 + M2.1 增量 14）+ 浏览器冒烟 PASS + 资产门禁 PASS） | spec v3 numeric（frozen 四组写死零改动 + 新增 audio/mobile/deploy 三组；内核 `kernel/numeric.ts` 为 SSOT，e07 数值总闸键序无关深比通过） | tests/contract/ 全量：`PLAYWRIGHT_MODULE_DIR=<全局> node games/stack-tower/tests/contract/run-all.mjs` → `PASS 22 / FAIL 0 / not-runnable 0` | 首关；M2.1 新增音频/触控/横屏/PWA 五实体（audio-manager / touch-input-layer / sfx-pack-v1 / pwa-shell / rotate-overlay），玩法数值零改动 |
| lvl-02…lvl-12 | 未定义 | 难度曲线参数化生成（spec v2 content.formulas；总 228 层，单关 8~30 层，护栏 180s/关） | 复用 lvl-01 契约族（内核已按公式实现 levelTuning/levelId，level≥2 无需改内核） | M2 只交付首关 + 曲线，其余关卡按曲线解锁 |

## 首关逐元素核对（spec ↔ 实现 ↔ 契约）

| element_id | 实现落点（spec 实体表对号） | 契约结果 |
|---|---|---|
| e01-spawn-first-block | kernel/tower.ts（createBaseBlock：x=240/width=120/静止） | PASS 4/4 |
| e02-swing-motion | kernel/block.ts（线性往返 ±240，速度取 swingSpeed(1)=160） | PASS 4/4（含解析解 2.56px/tick 与双跑全等） |
| e03-drop-input | kernel/sim.ts tick(intent)（同 tick 落块+生成新摆块）+ platform/input.ts（去抖/多点归一） | PASS 4/4 |
| e04-overlap-cut | kernel/cut.ts（keepWidth=width−\|offset\|，碎块初始姿态） | PASS 3/3 |
| e05-perfect-window | kernel/judge.ts + numeric.ts（140ms→22.4px；中轴入画保证前 3 次输入内可命中） | PASS 4/4 |
| e06-tower-ripple | kernel/ripple.ts（载荷恰四字段，duration=300）+ render/renderer.ts（唯一表现消费点） | PASS 4/4 |
| e07-score-hud | kernel/sim.ts（+10 / bonus 25+min(5·(combo−1),75)）+ ui/hud.ts formatHud | PASS 4/4（含数值总闸） |
| e08-fail-recover | kernel/cut.ts（keepWidth<36 → width-floor）+ kernel/sim.ts restart() | PASS 4/4 |

## 冒烟门禁（Web 原型口径）
- `cd games/stack-tower && npm run smoke` → **RESULT: PASS (browser)**
- 证据链：HTTP / 200 → 18 个 build 模块相对导入全部可解析 → 无头核心循环 3 连落块 score=120 →
  Chromium 打开页面（画布 480×720）→ 3 次点击 HUD「分数 45」（perfect 35 + place 10）→ R 键重开回「分数 0」→ 零 pageerror/console.error。

## 约定
- 关卡/元素 id 一旦进入 approved spec 即冻结，改名 = spec 升版。
- contract 文件名 = `<level_id>_<element_id>.spec.mjs`，与 acceptance[].check 逐字对齐。
- 改 src 后必须 `cd games/stack-tower && npm run build` 再跑契约（build/ 已入库，`node scripts/contract-check.mjs` B 段实跑防陈旧）。
