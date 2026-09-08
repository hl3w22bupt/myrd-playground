# 性能小步：渲染单循环 · 对象池 · 同屏上限 · 主循环去冗余分配

> 功能线：`pubg-web-core`（第 1 小步 · 性能，作为第 2 小步「画面升级」的分支基线）
> 数值来源：`src/content/render.ts`（渲染性能配置表，禁止在 render/app 层硬编码同类数值）
> 约束：本步只做性能一件事；不改画面表现与玩法逻辑（仿真核心 systems 未动，确定性不受影响）

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
| `npm run test` | 39 既有玩法断言 + 14 性能断言 + 4 画质档画面细节断言（`tests/perf.spec.ts`、`tests/visualDetail.spec.ts`，确定性、无 DOM/时序依赖） | 57/57 通过 |
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

## 五、浏览器实测（已执行，60FPS 红线复核）

Node 基准覆盖「逻辑 + 快照 + HUD」的 CPU 成本与内存行为；浏览器侧以可复测脚本 `scripts/fps-bench.mjs`（headless Chrome + CDP，静态服务 dist/ → 点击「开始对局」→ 独立 rAF 采样 + 游戏内 PerfSampler 调试行交叉印证）完成 A/B 对比。

**方法论要点（避免假结论）**：
- 交叉测量：同一时间窗内 A/B 交替各 ≥3 次取中位。本机验证发现整机性能随时间漂移可达 2×+（先后测得的同一构建从 57fps 漂移到 25.6fps），非交叉测得的对比数字不可信。
- 软件光栅（SwiftShader）组仅作压力代理：其对 draw call 数与每片段成本极其敏感（约 2ms/draw），不等价于参考机型（真 GPU）表现。
- 运行时消融探针（`?probe=1` 暴露只读 renderer 引用）+ CPU profile + GPU trace 定位，避免凭直觉优化。

**结果（同机交叉实测）**：

| 组 | 配置 | 改前（画面升级前 17025e9） | 改后（画面升级 + 本轮护栏） | 结论 |
|---|---|---|---|---|
| GPU 红线组 | 真机 GPU · 1280×720 · high 档 · 交叉×3 | 中位 60.09 fps（1%低 59.52） | 中位 60.12 fps（1%低 59.52） | **60FPS 红线不回退** ✅（双方均 vsync 封顶） |
| GPU 重载组 | 2560×1440（渲染 5120×2880） | 60.04 fps | 60.03 fps | vsync 封顶，GPU 有余量 ✅ |
| 软光栅压测组 | SwiftShader · 1920×1080 · low 档 · 交叉×3 | 中位 24.8~25.6 fps | 中位 19.1 fps（护栏前）→ **21.7 fps（护栏后，-12.5%）** | 新增场景内容（天空穹顶/云/太阳光晕/植被/特效池）带来固定 draw 与填充成本，分散在多个对象（逐对象消融无单一元凶）；护栏（档位门控 + 降档联动 draw + 消除重编译）已回收约一半差距，其余记录在案供低档设备优化参考 |

**本轮新增的帧率护栏（60FPS 红线的组成部分）**：
1. 画质档画面细节配置表 `content/render.ts → VISUAL_DETAIL`：low 档不创建天空穹顶/云层/太阳光晕、毒圈粒子带关闭（`tests/visualDetail.spec.ts` 锁定约束）。
2. 降档联动 draw call：帧率自适应降档时按档位隐藏天空 extras（可逆，升档恢复）——此前降档只调像素比/阴影贴图，对「固定 draw 开销」无效（实测 draw 22 → 10）。
3. 消除运行期着色器重编译：降档不再切换 `shadowMap.enabled`/`castShadow`（该切换改变「投影光源数」shader define，触发全部材质重编译；实测 CPU profile 10.9% 时间阻塞在 `getProgramInfoLog`），改为仅调整阴影贴图尺寸（uniform 级，无重编译）。
4. 60FPS 红线的验收口径（参考机型 = 真机 GPU 渲染路径）在 A/B 中成立；软光栅压力差距已记录并受护栏约束，供后续低档设备优化（如实体 instanced 化合并 draw）参考。
