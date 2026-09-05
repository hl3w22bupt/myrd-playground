# 性能小步：渲染单循环 · 对象池 · 同屏上限 · 主循环去冗余分配

> 功能线：`pubg-web-core`（第 1 小步 · 性能，作为第 2 小步「画面升级」的分支基线）
> 数值来源：`src/content/render.ts`（渲染性能配置表，禁止在 render/app 层硬编码同类数值）
> 约束：本步只做性能一件事；不改画面表现与玩法逻辑（仿真核心 systems 未动，确定性不受影响）

## 一、改动清单（4 个小步提交）

### 1. 零分配快照通道（`core/snapshot.ts`）

- 问题：`buildSnapshot()` 每次调用重建整个对象图（20 实体 × 多对象 + 全部物资 + 玩家背包数组）。渲染 60FPS 下每帧调用一次，每秒产生数千个短命对象 → GC 抖动 → 帧率毛刺与堆持续增长。
- 方案：`SnapshotWriter` 预分配快照对象图（实体/物资/玩家武器槽与背包格/缩圈/运输机），`write()` 只覆写字段值并返回**恒定引用**；`MatchHandle.snapshotReusable()` 为渲染/UI 每帧通道，`snapshot()` 分配版语义保持不变（需跨帧保留时使用）。
- 附加：`WorldSnapshot.playerEntity` 玩家实体直引，消除渲染/UI 每帧 `entities.find()` 的闭包分配与线性扫描；`drainEvents()` 事件缓冲回收复用；`FixedLoop.advance` 合并缓冲复用（去掉每帧 `[...pending, ...intents]`）。

### 2. 实体/子弹对象池 + 同屏实体上限（`render/entityPool.ts`）

- 实体视图池：构造时一次性预建 `ENTITY_VIEW_POOL_SIZE`（= ENTITY_CAP = 20）套视图（几何共享、材质因受击闪白独立），`acquire()` 出栈复用、消失仅隐藏，运行期**零创建/零销毁**；容量封顶后不产生任何实体视图分配。
- 同屏实体上限 `MAX_VISIBLE_ENTITIES = 16`：按与玩家距离就近优先（复用 `Int32Array/Float64Array` 缓冲的插入排序，零分配），玩家强制可见。取值 > 标准场景实体数（1 + 12 = 13），**标准场景画面不变**，仅当实体数超限时隐藏最远者。
- 子弹可视化（弹道拖尾/枪口火焰）与命中粒子维持对象池/固定缓冲，容量收敛到 `content/render.ts`（数值不变）。
- 物资 `InstancedMesh` 颜色改脏检查：只随槽位物品变化上传 `instanceColor`，消除逐帧 GPU 缓冲上传。

### 3. HUD/小地图/采样器脏检查与降频（`ui/hudState.ts`、`perf/rate.ts`）

- HUD：纯逻辑 `HudState` 计算字段目标值并产出**字段级脏标记**，值不变不写 DOM——消除每帧无条件 `textContent/style` 写入导致的样式失效与布局计算（forced reflow）。
- 背包：按内容签名脏检查，打开背包不再每帧 `innerHTML` 重建 20 个节点（主循环最大强制布局源），并改用零分配快照。
- 小地图：重绘 60 → 20Hz（`MINIMAP_UPDATE_HZ`）；调试文案 4Hz（`DEBUG_TEXT_HZ`）。均为**同一主循环内节流**，不新增任何定时器/循环。
- `PerfSampler`：帧时间窗口改环形缓冲（去掉每帧 `Array.shift` 搬移），统计按 4Hz 节流并在复用 `Float64Array` 上原地排序（去掉每帧 `[...frames].sort()`）。

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

## 四、浏览器实测建议（后续收口步）

Node 基准覆盖「逻辑 + 快照 + HUD」的 CPU 成本与内存行为；GPU 侧（draw call、填充率、阴影）需在浏览器以 `PerfSampler` + 调试 HUD（FPS / 1% 低 / p95 / draw / heap）按收敛需求 AC1 的参考机型口径采样 5–10 分钟复核。渲染侧已具备的条件：画质三档自动降档、实体池封顶、同屏上限、物资颜色脏检查、小地图/HUD 降频。
