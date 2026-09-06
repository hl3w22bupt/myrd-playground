# 性能小步：渲染单循环 · 对象池 · 同屏上限 · 主循环去冗余分配

> 功能线：`pubg-web-core`（第 1 小步 · 性能，作为第 2 小步「画面升级」的分支基线）
> 数值来源：`src/content/render.ts`（渲染性能配置表，禁止在 render/app 层硬编码同类数值）
> 约束：本步只做性能一件事；不改画面表现与玩法逻辑（仿真核心 systems 未动，确定性不受影响）

## 〇、第二轮：主循环残余分配清理（本文档新增，2026-09-06）

第一轮已消除「每帧对象图重建」级别的大头；本轮针对**交火/移动/AI 决策热路径上的残余逐帧分配**做系统清理，全部为等价重构（数值、RNG 消费次序、判定语义不变），不动画面与玩法。

### 改动清单（7 个小步提交）

| 提交 | 位置 | 消除的分配 |
|---|---|---|
| `perf(geom)` | `core/geom.ts` | `rayAABB` 每次调用的轴元组嵌套数组（4 个/次）；`rayVerticalBox` 的临时 AABB 对象。调用点 = 每发子弹 × 48 栋建筑 + AI 视线 × 每候选 × 48 建筑，是全库最大分配源 |
| `perf(movement)` | `core/mapgen.ts`、`systems/movement.ts` | `resolveBuildingCollision` 每次返回新 `{x,z}`（每实体每 tick 2 次），改 out 复用缓冲 |
| `perf(combat)` | `systems/combat.ts` | `castShot` 中间命中逐次分配 HitResult+命中点（每发最多 ~10 对 → 恒定 2 对）；`eliminate` 的 reduce/find 闭包 |
| `perf(ai)` | `systems/ai.ts`、`combat.ts` | `hasLineOfSight` 每候选 eye/tgt+方向向量（改标量入参+scratch）；`findNearbyLoot` 结果包装对象（改直引 LootItem）；`decide` 每决策新建意图数组（改原地复用 `pendingIntents`） |
| `perf(ai)` | `core/world.ts`、`match.ts`、`ai.ts` | AI 意图对象池：`IntentSlot` 自由列表（上限派生自 `ENTITY_CAP × 3`），决策重写时回收（`beginIntents`），决策热路径意图对象零分配 |
| `perf(zone)` | `systems/zone.ts` | 毒圈伤害对已持有引用实体再 `find` 的闭包查找 + reduce 计数 |
| `perf(ui/render/input)` | `minimap.ts`、`view.ts`、`input.ts`、`panels.ts` | 小地图 `find` 闭包（改 `playerEntity` 直引）；淘汰事件定位新对象（改复用缓冲）；输入意图每帧新数组（改双缓冲轮换）；背包打开期间每帧签名字符串（改 FNV-1a 数值哈希）——此项即第一轮审查记录在案的「本步不修」余项 |

### 确定性与行为守恒

- 所有数值公式与 RNG 消费次序逐一保持（`putAimIntent` 与旧 `aimIntent` 完全一致）；
- **AI 意图通道语义保持「粘性」**：意图缓冲每 tick 全量应用、应用后保留，直至该 AI 下一次决策整体重写时才回收复用槽位（`pendingIntents` 字段契约即如此约定）。⚠️ 本轮中途曾误改为「应用一次即清空」——审查以 main/HEAD 双包对局比对证伪了当时的等价性声明（9/9 对局分歧，首分歧点 seed=991 tick 5872，pitch 差恰为 `recoil×0.006`；`interact`/`reload` 应用次数降为 1/4），已恢复粘性语义。恢复后与 main **逐 tick 逐位一致**（seed 991/20260831/7 × 6000 tick 实测）；
- 对象池回收时机因此从「应用后」改为「决策重写前」（`ai.ts beginIntents`），零分配收益不变；
- 新增回归断言：`tests/perf.spec.ts` 槽位复用恒等、粘性应用语义、长跑后意图缓冲合法状态与无跨实体槽位别名；`tests/determinism.spec.ts` 同 seed 同意图序列逐 200 tick 状态完全一致（此前仅跳伞段有逐 tick 复现断言）。

### 本轮实测（Node v26 / 2026-09-06，`npm run bench`）

```
[bench] 帧 JS 成本：avg 0.044ms · p95 0.076ms · max 0.207ms（预算 16.67ms）
[bench] capableFps = 22883
[bench] 活堆：基线 12.9MB → 末 13.1MB · 增长 0.2MB（1.4%）· 窗口单调递增 false
[bench] 纯仿真 tick 成本 0.0632ms（50Hz 预算 20ms；改造前 0.0638ms）
```

结论：标准场景 600s 逻辑时长活堆增长 1.4%（≤5% 红线）且窗口不单调递增，**无内存持续增长**；帧 JS 成本约为 60FPS 帧预算的 0.26%，**≥60FPS 能力余量约 380 倍**。本轮收益主要体现在**垃圾产生率下降**（交火稳态估算：rayAABB 数组 ~数万 obj/s + 碰撞 ~1300 obj/s + AI 感知/决策 ~1500 obj/s + 意图 ~500 obj/s → 接近 0），对应真实浏览器中 minor-GC 触发频率与 GC 停顿概率下降（Node 强制 GC 基准口径无法直接呈现该收益，故以解析估算列示）。

## 一、改动清单（4 个小步提交 + 审查修复提交）

### 1. 零分配快照通道（`core/snapshot.ts`）

- 问题：`buildSnapshot()` 每次调用重建整个对象图（20 实体 × 多对象 + 全部物资 + 玩家背包数组）。渲染 60FPS 下每帧调用一次，每秒产生数千个短命对象 → GC 抖动 → 帧率毛刺与堆持续增长。
- 方案：`SnapshotWriter` 预分配快照对象图（实体/物资/玩家武器槽与背包格/缩圈/运输机），`write()` 只覆写字段值并返回**恒定引用**；`MatchHandle.snapshotReusable()` 为渲染/UI 每帧通道，`snapshot()` 分配版语义保持不变（需跨帧保留时使用）。
- 附加：`WorldSnapshot.playerEntity` 玩家实体直引，消除渲染/UI 每帧 `entities.find()` 的闭包分配与线性扫描；`drainEvents()` 事件缓冲回收复用；`FixedLoop.advance` 合并缓冲复用（去掉每帧 `[...pending, ...intents]`）。

### 2. 实体/子弹对象池 + 同屏实体上限（`render/entityPool.ts`）

- 实体视图池：构造时一次性预建 `ENTITY_VIEW_POOL_SIZE`（= ENTITY_CAP = 20）套视图（几何共享、材质因受击闪白独立），`acquire()` 出栈复用、消失仅隐藏，运行期**零创建/零销毁**；容量封顶后不产生任何实体视图分配。
- 同屏实体上限 `MAX_VISIBLE_ENTITIES = 20`（= 实体上限 ENTITY_CAP = 玩家 1 + aiCount 最大可选 19）：按与玩家距离就近优先（复用 `Int32Array/Float64Array` 缓冲的原地数值排序，零分配），玩家强制可见。上限覆盖开始画面 aiCount 全可选区间（[10, 19]），**任何用户可选配置下都不隐藏实体、画面不变**；裁剪机制保留，仅当未来实体上限扩大时自动生效。
- 子弹可视化（弹道拖尾/枪口火焰）与命中粒子维持对象池/固定缓冲，容量收敛到 `content/render.ts`（数值不变）。
- 物资 `InstancedMesh` 颜色改脏检查：只随槽位物品变化上传 `instanceColor`，消除逐帧 GPU 缓冲上传。

### 3. HUD/小地图/采样器脏检查与降频（`ui/hudState.ts`、`perf/rate.ts`）

- HUD：纯逻辑 `HudState` 计算字段目标值并产出**字段级脏标记**，值不变不写 DOM——消除每帧无条件 `textContent/style` 写入导致的样式失效与布局计算（forced reflow）。
- 背包：按内容签名脏检查，打开背包不再每帧 `innerHTML` 重建 20 个节点（主循环最大强制布局源），并改用零分配快照。
- 小地图：重绘 60 → 20Hz（`MINIMAP_UPDATE_HZ`）；调试文案 4Hz（`DEBUG_TEXT_HZ`）。均为**同一主循环内节流**，不新增任何定时器/循环。
- `PerfSampler`：帧时间窗口改环形缓冲（去掉每帧 `Array.shift` 搬移），统计按 4Hz 节流并在复用 `Float64Array` 上以 `subarray(0, n).sort()` 原地数值排序（无比较器 = 数值升序、零分配，去掉每帧 `[...frames].sort()`）。

### 4. 渲染统一为单循环（`app/frame.ts`）

- `FrameDriver` 是**唯一的 rAF 驱动器**，固定顺序：输入 → 50Hz 固定逻辑 → 零分配快照 → 3D 渲染 → HUD → 小地图 → 背包 → 性能采样/画质自适应 → 结算；低频模块只做节流，不另起定时器/循环。
- 每帧恰好注册一次 rAF（`frameCount === rafSubscriptionCount - 1`，测试断言）；`raf/caf` 可注入，Node 中即可驱动真实帧路径（测试与基准的根基）。
- 驱动器自身零逐帧分配；app 层不 `import three`（引擎边界），视图走结构化接口。

## 二、本地基准（`npm run bench`）

**口径**：`tests/bench/standard.bench.ts`。固定 seed=20260831，玩家 1 + AI 12（13 实体），物资全量、缩圈全程、AI FSM 全开；玩家控制器跳伞落地后持续移动 + 开火（覆盖射击/命中/淘汰事件路径）；**存活实体跌破 8 即重开对局**（标准负载保底，避免对局后期「空场」造成虚假低成本）；时间步进 = 60FPS 帧间隔 16.667ms；预热 6000 帧后测量 30000 帧（≈600s 逻辑时长）。

**指标**：
- `frameMs` = 帧内 JS 成本（FixedLoop 仿真 tick + drainEvents + 零分配快照 + HUD 纯逻辑计算）。Three.js 的 GPU 提交无法在 Node 计量，因此以「帧 JS 成本 ≪ 16.667ms 帧预算」作为 ≥60FPS 能力判据：`capableFps = 1000 / avgFrameMs`。
- 活堆：预热后取基线，每 1000 帧强制 GC（`--expose-gc`，经 `vitest.bench.config.ts` 的 `poolOptions.forks.execArgv` 注入）后采样 `heapUsed`，把「未回收垃圾」与「真实泄漏」区分开。

**本机实测（Node v26 / 2026-09）**：

```
[bench] 标准场景 seed=20260831 实体=1+12 测量帧=30000（累计逻辑 600s，负载重开 3 次，最低存活 8）
[bench] 帧 JS 成本：avg 0.044ms · p95 0.077ms · max 0.217ms（预算 16.67ms）
[bench] capableFps = 22674（1000 / avgFrameMs，仿真+快照+HUD 的 JS 成本）
[bench] 活堆（GC已启用）：基线 12.9MB → 末 13.0MB · 增长 0.2MB（1.3%）· 窗口数 30
[bench] 堆窗口单调递增：false · 快照恒等（零分配）：true · 实体上限：true
[bench] 纯仿真 tick 成本 0.0638ms（50Hz 预算 20ms）
```

结论：帧 JS 成本约占 60FPS 帧预算的 **0.26%**（约 380 倍余量），逻辑与快照通道不再是瓶颈；600s 逻辑时长内活堆增长 1.3% 且窗口不单调递增，**无内存持续增长**。

## 三、测试与门禁

| 命令 | 内容 | 结果 |
|---|---|---|
| `npm run lint` | eslint（含依赖方向/确定性红线） | 通过 |
| `npm run test` | 39 既有玩法断言 + 14 新增性能断言（`tests/perf.spec.ts`，确定性、无 DOM/时序依赖） | 53/53 通过 |
| `npm run build` | `tsc --noEmit && vite build` | 通过 |
| `npm run bench` | 标准场景基准（`tests/bench/`，独立 vitest 配置 + `--expose-gc`） | 通过 |

`tests/perf.spec.ts` 覆盖（全部确定性）：零分配快照恒等与字段正确性、FrameDriver 单循环（rAF 注册次数/每帧一次/快照恒定/onEnded 去抖）、实体视图池封顶与复用恒等、HUD 字段级脏标记、节流器与采样器有界性、FixedLoop 意图单次消费语义、性能配置表约束。

## 四、代码审查与修复（创建 PR 前完成）

本步增量（`17025e9..HEAD`）经独立代码审查，结论：无 blocking，2 项 major、7 项 minor、5 项 nit。已修复：

| 级别 | 问题 | 修复 |
|---|---|---|
| M1 | 同屏上限 16 < aiCount 最大可选 19（实体最多 20）：aiCount ≥ 16 时最远敌人被隐藏（仿真仍在跑）→ 画面回归风险 | `MAX_VISIBLE_ENTITIES` 提至 `ENTITY_CAP`（20），覆盖 aiCount 全可选区间，任何配置下画面不变；配置约束测试同步收紧为 `toBe(ENTITY_CAP)` |
| M2 | `drainEvents()` 所有权契约收紧（返回数组下一帧被回收复用）但公共类型未注明 | `MatchHandle.drainEvents` JSDoc 补「帧内有效、不得跨帧持有」契约说明 |
| minor | 采样器插入排序 O(n²) 且「增量有序」理由不成立 | 改 `Float64Array.subarray(0, n).sort()`（数值升序、原地、零分配） |
| minor | `acquire()` 未重置 emissive，重置职责分裂 | emissive 清零并入 `acquire()`（取用侧自洽） |
| minor | `HudState.compute` 无玩家分支返回上一帧残留脏标记 | 改返回全 false 常量 `NO_DIRTY_FLAGS` |
| minor | 丢帧（积压 tick）观测在 FrameDriver 重写中丢失 | 调试行恢复 `· 丢帧tick N`（仅丢帧时追加，字符串保持稳定） |
| minor | 快照武器槽硬编码 2 槽，槽数变化时与分配版通道分叉 | 槽位数随 `p.weapons.length` 原地扩缩（恒定引用不变、槽对象池复用） |
| nit | 快照恒等测试存在空断言（tick 后读同对象） | tick 前先取值再比较（`elapsedMs` 改断言严格增大） |
| nit | `onFrame` 无条件续帧，onEnded 内同步 stop 会遗留一帧空转 rAF | 加 `if (this.running)` 守卫，保持单注册不变量 |

记录在案、本步不修（避免超出性能单目标范围）：`InventoryPanel.render()` 重复取快照与逐帧签名字符串（拟随第 2 小步画面升级一并处理）；`lootSnaps` 截断导致物资数回落再回升时重分配；实体数收缩防御路径归还视图；`hurtT` 死特性清理。

## 五、浏览器实测建议（后续收口步）

Node 基准覆盖「逻辑 + 快照 + HUD」的 CPU 成本与内存行为；GPU 侧（draw call、填充率、阴影）需在浏览器以 `PerfSampler` + 调试 HUD（FPS / 1% 低 / p95 / draw / heap）按收敛需求 AC1 的参考机型口径采样 5–10 分钟复核。渲染侧已具备的条件：画质三档自动降档、实体池封顶、同屏上限、物资颜色脏检查、小地图/HUD 降频。
