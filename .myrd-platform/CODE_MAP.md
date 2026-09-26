# 代码导航地图

> 作用域：项目。以下是从代码 SSOT 自动生成的「功能 → 文件」索引。
> 用法：根据问题用 Grep 在对应文件里搜索定位，再 Read 相关源码获取细节。
> 本地图由 MyRD 定时增量更新（记录 commit，只重扫变更）。

共 51 条导航条目。

## 规范文档（51）

- [DOC] README(README.md::README) → `README.md`
- [DOC] 运行(README.md::运行) → `README.md`
- [DOC] 目录与依赖方向(README.md::目录与依赖方向) → `README.md`
- [DOC] 核心玩法系统(README.md::核心玩法系统) → `README.md`
- [DOC] 验收标准 → 自动化测试映射（tests/）(README.md::验收标准 → 自动化测试映射（tests/）) → `README.md`
- [DOC] 操作(README.md::操作) → `README.md`
- [DOC] PERFORMANCE(PERFORMANCE.md::PERFORMANCE) → `docs/PERFORMANCE.md`
- [DOC] 一、改动清单（4 个小步提交 + 审查修复提交）(PERFORMANCE.md::一、改动清单（4 个小步提交 + 审查修复提交）) → `docs/PERFORMANCE.md`
- [DOC] 1. 零分配快照通道（`core/snapshot.ts`）(PERFORMANCE.md::1. 零分配快照通道（`core/snapshot.ts`）) → `docs/PERFORMANCE.md`
- [DOC] 2. 实体/子弹对象池 + 同屏实体上限（`render/entityPool.ts`）(PERFORMANCE.md::2. 实体/子弹对象池 + 同屏实体上限（`render/entityPool.ts`）) → `docs/PERFORMANCE.md`
- [DOC] 3. HUD/小地图/采样器脏检查与降频（`ui/hudState.ts`、`perf/rate.ts`）(PERFORMANCE.md::3. HUD/小地图/采样器脏检查与降频（`ui/hudState.ts`、`perf/rate.ts`）) → `docs/PERFORMANCE.md`
- [DOC] 4. 渲染统一为单循环（`app/frame.ts`）(PERFORMANCE.md::4. 渲染统一为单循环（`app/frame.ts`）) → `docs/PERFORMANCE.md`
- [DOC] 二、本地基准（`npm run bench`）(PERFORMANCE.md::二、本地基准（`npm run bench`）) → `docs/PERFORMANCE.md`
- [DOC] 三、测试与门禁(PERFORMANCE.md::三、测试与门禁) → `docs/PERFORMANCE.md`
- [DOC] 四、代码审查与修复（创建 PR 前完成）(PERFORMANCE.md::四、代码审查与修复（创建 PR 前完成）) → `docs/PERFORMANCE.md`
- [DOC] 五、浏览器实测建议（后续收口步）(PERFORMANCE.md::五、浏览器实测建议（后续收口步）) → `docs/PERFORMANCE.md`
- [DOC] 01-rendering-and-quality(01-rendering-and-quality.md::01-rendering-and-quality) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 1. 渲染引擎选型（ADR-001）(01-rendering-and-quality.md::1. 渲染引擎选型（ADR-001）) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 1.1 候选对比(01-rendering-and-quality.md::1.1 候选对比) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 1.2 决策理由(01-rendering-and-quality.md::1.2 决策理由) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 1.3 边界约定（防止"引擎漂移"）(01-rendering-and-quality.md::1.3 边界约定（防止"引擎漂移"）) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 2. 帧率策略（ADR-003）(01-rendering-and-quality.md::2. 帧率策略（ADR-003）) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 2.1 双循环模型(01-rendering-and-quality.md::2.1 双循环模型) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 2.2 AI 与低成本项的分帧(01-rendering-and-quality.md::2.2 AI 与低成本项的分帧) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 2.3 确定性与可复现（N2，直接支撑 AC2）(01-rendering-and-quality.md::2.3 确定性与可复现（N2，直接支撑 AC2）) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 3. 画质策略（三档 + 自动降档）(01-rendering-and-quality.md::3. 画质策略（三档 + 自动降档）) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 3.1 档位定义(01-rendering-and-quality.md::3.1 档位定义) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 3.2 动态降档（自动画质，实现于 render 层，与仿真无关）(01-rendering-and-quality.md::3.2 动态降档（自动画质，实现于 render 层，与仿真无关）) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 3.3 性能预算（超预算即视为性能缺陷）(01-rendering-and-quality.md::3.3 性能预算（超预算即视为性能缺陷）) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 3.4 兼容矩阵(01-rendering-and-quality.md::3.4 兼容矩阵) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 4. 可观测性（渲染侧）(01-rendering-and-quality.md::4. 可观测性（渲染侧）) → `docs/architecture/01-rendering-and-quality.md`
- [DOC] 02-module-boundaries(02-module-boundaries.md::02-module-boundaries) → `docs/architecture/02-module-boundaries.md`
- [DOC] 1. 目录结构与依赖方向(02-module-boundaries.md::1. 目录结构与依赖方向) → `docs/architecture/02-module-boundaries.md`
- [DOC] 2. 核心契约（TS 草案，实现以此为准）(02-module-boundaries.md::2. 核心契约（TS 草案，实现以此为准）) → `docs/architecture/02-module-boundaries.md`
- [DOC] 快照（渲染层唯一数据源）(02-module-boundaries.md::快照（渲染层唯一数据源）) → `docs/architecture/02-module-boundaries.md`
- [DOC] 3. 系统划分（core/systems，按 tick 执行顺序）(02-module-boundaries.md::3. 系统划分（core/systems，按 tick 执行顺序）) → `docs/architecture/02-module-boundaries.md`
- [DOC] 4. 内容数据表 schema（content/，AC 数值的唯一来源）(02-module-boundaries.md::4. 内容数据表 schema（content/，AC 数值的唯一来源）) → `docs/architecture/02-module-boundaries.md`
- [DOC] 5. 事件协议与回放（可观测性基建，成本极低）(02-module-boundaries.md::5. 事件协议与回放（可观测性基建，成本极低）) → `docs/architecture/02-module-boundaries.md`
- [DOC] 03-milestones-and-acceptance(03-milestones-and-acceptance.md::03-milestones-and-acceptance) → `docs/architecture/03-milestones-and-acceptance.md`
- [DOC] 1. 里程碑总览(03-milestones-and-acceptance.md::1. 里程碑总览) → `docs/architecture/03-milestones-and-acceptance.md`
- [DOC] 2. 测试策略（三层，成本优先）(03-milestones-and-acceptance.md::2. 测试策略（三层，成本优先）) → `docs/architecture/03-milestones-and-acceptance.md`
- [DOC] 3. AC → 测试映射表(03-milestones-and-acceptance.md::3. AC → 测试映射表) → `docs/architecture/03-milestones-and-acceptance.md`
- [DOC] 4. 风险与对策(03-milestones-and-acceptance.md::4. 风险与对策) → `docs/architecture/03-milestones-and-acceptance.md`
- [DOC] 5. 二期演进预留（本期不做，只留边界）(03-milestones-and-acceptance.md::5. 二期演进预留（本期不做，只留边界）) → `docs/architecture/03-milestones-and-acceptance.md`
- [DOC] 6. 待核实事项（实现前确认）(03-milestones-and-acceptance.md::6. 待核实事项（实现前确认）) → `docs/architecture/03-milestones-and-acceptance.md`
- [DOC] README(README.md::README) → `docs/architecture/README.md`
- [DOC] 一、文档索引(README.md::一、文档索引) → `docs/architecture/README.md`
- [DOC] 二、目标与非功能约束（自需求推导）(README.md::二、目标与非功能约束（自需求推导）) → `docs/architecture/README.md`
- [DOC] 三、总体架构(README.md::三、总体架构) → `docs/architecture/README.md`
- [DOC] 四、决策记录（ADR）汇总(README.md::四、决策记录（ADR）汇总) → `docs/architecture/README.md`
- [DOC] 五、如何使用本设计(README.md::五、如何使用本设计) → `docs/architecture/README.md`
