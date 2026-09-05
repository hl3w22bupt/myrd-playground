# 产品上下文

# 测试电商中台

测试


## 关联项目

### 心伴

项目名: 心伴
描述: ai 情绪陪伴
类型: mobile
GitHub: https://github.com/hl3w22bupt/odbo
工作流类型: cmqc71gii0005m9uni8nwb6j3

### MyRD Playground [mobile]

项目名: MyRD Playground
描述: MyRD 功能测试和沙盒环境
类型: web-app
GitHub: https://github.com/hl3w22bupt/myrd-playground.git
工作流类型: cmqc5q1ne0005m98t740g0eh9


---


## 产品关联知识

## 项目开发规范

# 项目开发规范

## 代码风格
- 使用 TypeScript
- - 遵循 ESLint 规范
- 提交前运行 lint 检查

## Git 提交规范
- 使用 Conventional Commits 格式
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新

## Agent 执行轨迹（agent_execution_trajectories）孤儿 running 记录：诊断、根因与自愈处置手册

# Agent 执行轨迹（agent_execution_trajectories）孤儿 running 记录：诊断、根因与自愈处置手册

## 背景
平台中所有 Agent 执行（channel 频道消息、express_lane 直通车、workflow 内 agent 节点、exploration、secretary、onboarding 等）都会写入一条 agentExecutionTrajectory 轨迹记录，采用 create-then-finalize 生命周期：

- 创建时（createAgentTrajectory）写入 `status='running'`；
- Agent 执行正常结束时（final 事件 / 流自然结束），pipeline 返回路径将 status 置为 `completed`；
- 异常被 catch 时置为 `failed`，并回填 outputPreview / error / durationMs / completedAt。

Claude 子进程层存在 10 分钟默认超时（SIGTERM → 10s 后 SIGKILL）。

`agent_execution_trajectories` 表是所有 Agent 执行的基础数据源，也是进化分析（evidence mining）的关键证据来源，轨迹数据质量直接影响进化证据统计与状态判定。平台 Worker 启动时运行一整套自愈（auto-heal）机制，但当前对轨迹记录存在覆盖盲区。

## 现象
增量时间窗内观测到 7 条轨迹全部停留 `status='running'`，且错误为空、输出摘要为空，覆盖执行类型与角色：

- **channel**：PD-Agent、Architect-Agent、开发者；
- **workflow**：「把 HTML 原型转成生产级 React Native 前端（先发 Android）」frontend 节点、「创建 PR（基于实际变更）」create-pr 节点；
- **express_lane**：Express Agent ×2。

共同特征：记录创建后从未被 finalize，既无 error，也无任何中间输出（outputPreview=NULL），从数据上完全看不出是否还在推进。

影响：
- 轨迹表被孤儿记录污染，进化分析（evidence mining）统计失真（running 状态混入失败/完成判定）；
- 轨迹模型没有 timeout / expiration 字段，理论上可无限 running；
- 与「真正仍在运行但尚无输出」的合法长任务无法从数据上区分。

## 根因
1. **轨迹完结依赖进程内 pipeline 的返回路径**。超时/取消逻辑全部在 Worker 进程内存中（startTimer + activePipelines 注册表）。Worker 被重启（挂起检测触发自动重启、OOM、部署）时，内存定时器与注册表一并丢失，正在执行的轨迹失去 finalize 触发点，永远不会被置为终态。
2. **自愈覆盖盲区**。平台启动自愈覆盖了 workflowRun（autoHealStaleRuns→paused）、expressLaneRun（→failed，error='执行中断（Worker 重启）'）、channel_messages 的 streaming 占位消息（>10 分钟清理 streaming 标记）、agent busy 状态（→idle）、goal 执行（resumeStuckGoalExecutions）、vibe workspace（小时级清理），但**不覆盖 agentExecutionTrajectory 本身**（代码中 grep 零引用），轨迹成为永久孤儿。
3. **自愈仅在启动时执行一次**，运行期没有周期性僵死检测。
4. **finalize 无重试**。finalizeAgentTrajectory 内部 try-catch 仅记录日志：若 finalize 本身失败，轨迹不会再次尝试落终态。
5. **长任务与死执行不可区分**。长时间无任何输出的运行（git/gh 等待交互输入、依赖安装卡住、构建/推送阻塞、模型侧无响应）也不会产生 outputPreview，与死执行在数据上表现完全一致，无法仅靠「有无输出」判定。

## 处置
### 1. 定位滞留轨迹
```sql
SELECT id, agent_type, agent_name, status, created_at,
       (now() - created_at) AS age, output_length, error
FROM agent_execution_trajectories
WHERE status = 'running' AND created_at < now() - interval '30 minutes'
ORDER BY created_at;
```
也可按更新时间检索并补充更多诊断字段：
```sql
SELECT id, agent_type, status, "createdAt", "updatedAt", output_preview, error, metadata
FROM agent_execution_trajectories
WHERE status = 'running' AND "updatedAt" < now() - interval '30 minutes'
ORDER BY "updatedAt";
```
重点看 output_length IS NULL/0 的记录——无输出即无进展。

### 2. 区分「假 running」与「真僵尸」
- 检查对应 Worker / 子进程是否存活；
- 观察 updatedAt 是否仍在刷新；
- 若不再变化且无输出，判定为孤儿。

### 3. 按类型处置
- **workflow 节点**：查关联 workflow_run 的 status。若 run 也卡住，启动自愈会将其置为 paused（节点重置为 pending），可手动 resume；轨迹需同步标记 failed 并注明原因。
- **express_lane**：expressLaneRun 启动自愈已标记 failed（error='执行中断（Worker 重启）'）；确认轨迹同步标记 failed。worktree 现场保留在 `$WORKSPACE_ROOT/<projectId>/run-express-<taskId>`，可手动补收尾后「续跑」。
- **channel**：启动自愈会清理 streaming=true 且超过 10 分钟的 channel_messages 占位消息（content 置为「(Agent 异常中断 — Worker 重启)」）；轨迹需同步标记 failed。

### 4. 检查僵尸子进程
```bash
ps aux | grep -E 'claude (-p |--print)' | grep -v grep
```
对照轨迹的 worktree / session_id / prompt_preview 定位残留进程，确认无活动输出后 kill（SIGTERM → 10 秒后 SIGKILL）。

### 5. 清理孤立 worktree
确认无活动执行引用后，用 `git worktree remove --force` 删除 `$WORKSPACE_ROOT/<projectId>/run-*` 下对应目录。

### 6. 批量修复（谨慎）
先人工确认无关联的活动中执行，避免误杀：
```sql
UPDATE agent_execution_trajectories
SET status = 'failed',
    error = '执行中断（僵死自愈：无进展超时）',
    completed_at = now()
WHERE status = 'running' AND created_at < now() - interval '30 minutes';
```
保留 inputs / metadata 以便复盘，避免误判为进行中或计入成功统计。

### 7. 复盘
把轨迹 id 关联到 workflow run / express lane / channel 会话，判断是「提示词缺执行纪律」还是「编排层 finalize 缺失」。

## 预防
- **轨迹有界生命周期 + 僵死自愈**：轨迹必须有硬上界与回收任务（启动时 + 每小时周期检测）。
- **所有执行路径必须输出中间进度**，避免「运行中但零输出」。
- **新增执行环节（新 agentType）时**，必须补齐完结路径与自愈覆盖，并把 agentExecutionTrajectory 纳入与 workflowRun / expressLaneRun 同级的启动自愈清单。
- **Agent 提示词层**：要求有界执行（见《Workflow Agent 节点执行纪律规范》），确保任何路径都能 finalize。
- **记录层**：为轨迹增加 timeout / expiration 字段与「心跳刷新」机制，长期无心跳即可判定可回收；监控 running 超过阈值（如 30 分钟）的记录。
- **Worker 重启流程**中补充 trajectory 清理步骤。

## 情绪陪伴 App 产品调研框架

## 情绪陪伴 App 产品调研分析框架

### 背景
MyRD Admin 提出设计一款以"情绪价值"为核心的陪伴类 App，并引入游戏化交互机制。PD-Agent 就此进行了系统性调研分析。

### 市场与竞品分析
- **现有格局**：冥想类（Headspace、Calm）、日记记录类（Daylio）、虚拟陪伴类（Replika、Character.AI）App 已在市场存在，但多数偏"工具属性"，缺乏有深度的互动体验
- **差异化机会**：游戏化交互是关键的破局点，将情绪调节转化为"养成类 RPG"或"模拟经营"式体验

### 用户需求画像
- **目标人群**：Z 世代及年轻职场人，面临孤独感或高压，排斥传统说教式心理咨询
- **核心诉求**："被理解"、"被陪伴"以及"低压力的情绪宣泄口"，而非"治疗"

### 游戏化交互机制（核心差异化）
- **情绪映射**：将用户抽象情绪（文字、语音、表情）转化为游戏内数值或视觉反馈
  - 示例：用户开心时虚拟家园天气变晴；用户焦虑时出现需要安抚的小怪兽
- **正向反馈循环**：通过"情绪打卡"或"互助任务"解锁装扮、剧情或虚拟互动
- **方向待定**：AI 虚拟伴侣养成 vs 个人情绪花园经营

### 技术可行性
- 涉及 NLP 自然语言处理进行情绪识别
- 高保真游戏化 UI/UX 设计
- 通用技术选型方向待进一步确定

### 伦理与合规风险
- 需明确界定"陪伴"与"心理咨询"的边界
- 避免用户过度依赖及潜在法律风险

### 商业模式探讨
- 订阅制 / 内购制 / 广告变现 待评估

### 后续调研方向
1. 竞品深度拆解：挑选 2-3 款 AI 聊天+游戏元素的应用进行分析
2. MVP 核心功能定义
3. 商业模式确定

## MyRD 平台真实仓库结构地图、文档/技能入口与常见路径陷阱

# MyRD 平台真实仓库结构地图、文档/技能入口与常见路径陷阱

## 背景
agent 在涉及 MyRD 平台的任务中反复出现两类高成本问题：

1. **文档/技能入口定位失败**：任务开始时多次通过 glob 搜索 `**/myrd*/**/SKILL.md`、`**/myrd-platform-skill*` 等模式均返回 0 命中，误判平台「为云端平台、本地无文档」（#18283），或技能未在预期目录找到（#18123），随后不得不多轮读取源码与文档才定位入口（#18282-18293）。myrd-platform-skill 是 agent 理解平台的标准入口（最近 14 天调用 4 次），但 agent 本地环境无法直接命中其正文，造成重复勘察，agent 花费约十余次观测重复勘察结构。
2. **引用不存在的文件路径**：多会话（#18282-18293、#18596-18617）反复手工翻查源码才能定位平台结构，且 #18616/#18617 实证发现提案引用了不存在的 `frontend/lib/services/*` 与 `myagent-client.ts` 路径，导致提案被驳回、评审周期浪费。

根因在于「文档与实际源码结构不一致」——仓库（典型根目录 `/Users/leo/workspace/myrd`）存在源码与编译产物并存、文档过时等问题。本文档给出经源码核实的真实入口、真实结构地图及高频错误路径，供涉及 MyRD 内部实现的任务直接使用，消除重复探索并防止错误路径再次出现，显著降低后续任务冷启动成本。

## 关键入口（权威文档与技能）
- **平台使用说明书（权威）**：`/Users/leo/workspace/myrd/docs/myrd-platform-skill.md`。注意：位于源码仓库 `docs/` 下，而非 `~/.claude/skills/`。内容覆盖：服务地址、JWT 认证、全部 API 分类、典型示例、数据模型、边界情况，并含平台进化系统架构说明。
- **快速开始**：`/Users/leo/workspace/myrd/docs/guides/quick-start.md`（环境搭建 → 服务启动 → 注册 → 建项目 → 跑工作流）。
- **工作流集成/部署状态**：`/Users/leo/workspace/myrd/WORKFLOW_INTEGRATION.md`、`/Users/leo/workspace/myrd/MYRD_SETUP_STATUS.md`。
- **数据库 schema**：`/Users/leo/workspace/myrd/prisma/schema.prisma`（含 `AgentExecutionTrajectory` 模型，表名 `agent_execution_trajectories`）。

## 真实结构（经源码核实）
- **入口与自愈**：`src/index.ts`（worker 启动时执行 auto-heal，覆盖 WorkflowRun / ExpressLaneRun / channel_messages / agent status / goals / vibe workspace，**不含** agentExecutionTrajectory）。
- **工作流引擎**：`src/services/workflow/engine.ts`（约 2626 行；含 `resume()` 约 443 行、`iterateFrom()` 约 784 行、`rerunFrom()`、`rollbackToCheckpoint()`、`sharedSetupProjectWorkspace()`；支持 DAG 执行 / 自愈 / 重试 / git checkpoint）。
- **Coding-agent 实现**：`src/services/coding-agent/{claude-code-agent.ts, local-claude-agent.ts, remote-agent.ts, types.ts}`（其中 `claude-code-agent.ts` 含 10 分钟默认超时与进程清理逻辑）。
- **进化系统服务**：`src/services/evolution/`（analyzer 等模块；支撑证据系统三类数据源、证据挖掘策略）。
- **路由**：`src/routes/workflows.ts` 等。
- **前端真实源码**：`frontend/` 目录存在，含 `app/` 与 `components/` 源码，如 `frontend/app/(dashboard)/projects/new/page.tsx`、`frontend/components/projects/run-workflow-button.tsx`。
- **编译产物（非源码）**：`src/dist/`——仅含编译后声明/产物（如 `src/dist/lib/myagent-client.d.ts`、`src/dist/services/coding-agent/myagent-agent.d.ts`），**不是源码**。

## 服务端口
前端 :3001、后端 API :3111、streaming :4112、MyAgent :3000、数据库 :5432。

## 高频错误路径（不存在，务必避免）
| 常见错误引用 | 真实对应 |
|---|---|
| `frontend/lib/services/workflow/engine.ts` | `src/services/workflow/engine.ts` |
| `frontend/lib/services/coding-agent/claude-code-agent.ts` | `src/services/coding-agent/claude-code-agent.ts` |
| `myagent-client.ts`（作为源码） | 无此源码；仅有编译声明 `src/dist/lib/myagent-client.d.ts` |
| 认为前端目录含业务服务代码 | `frontend/` 主要被 `node_modules` 占据；业务服务在 `src/services/` |

## 根因
1. 文档（含 `docs/guides/quick-start.md`）描述的结构与实际仓库不一致或已过时；
2. agent 凭记忆/推测引用路径，未做存在性核实；
3. `src/` 与 `src/dist/` 并存，把编译产物误当源码。

## 处置（核实方法）
- 引用任何路径前，先用 glob/grep 在仓库根目录确认文件存在；
- 区分 `src/`（源码）与 `src/dist/`（编译产物），引用源码一律指向 `src/`；
- 工作流引擎、coding-agent、evolution 等业务服务一律在 `src/services/` 下，不在 `frontend/lib/` 下；
- 「文件不存在」的判断以 glob 返回空为唯一依据，不要依据记忆或文档；
- 分析轨迹/进化数据时，直接读 `agent_execution_trajectories` 表与 `prisma/schema.prisma` 的 `AgentExecutionTrajectory` 模型，不要靠源码 glob 反推。

## 预防
- 涉及 MyRD 内部实现的提案/文档，落笔前对每个文件路径做一次 glob 核实；
- 平台是本地源码 + 多 run 工作区（`/Users/leo/.myrd/workspaces/proj-myrd/run-*`）并存；run 工作区可能包含主干尚未合入的功能（如 express-lane、轨迹追踪迁移），分析时以对应 run 工作区为准；
- 本文档随仓库结构变更应同步更新。

## 架构设计文档

# 架构设计

## 技术栈
- 前端：Next.js + React + TypeScript
- 后端：Motia (iii 引擎)
- 数据库：PostgreSQL + Prisma

## 模块划分
- 项目管理模块
- 任务管理模块
- 知识库模块

## 需求池功能说明

# 需求池功能

## 功能说明
需求池用于管理产品需求、Bug 修复、功能改进等任务。

## 状态流转
- backlog: 待办需求
- todo: 已计划
- in-progress: 进行中
- review: 评审中
- done: 已完成
- archived: 已归档

## 沉淀Web大逃杀技术方案与性能红线

# 沉淀Web大逃杀技术方案与性能红线

> 来源：《和平精英Web版》架构Agent技术方案（PR #8，产物 id=cmos298dg0001m9mxandnum2z，repo hl3w22bupt/myrd-playground）
> 需求基线：《「和平精英Web版」核心玩法需求（跳伞/拾取/射击/缩圈/AI 对抗）》（id=cmtfyd7uc000im9hapib6ann3）
> 用途：**开发节点（M0~M7）执行对齐的唯一技术基准**。本文所有数值均为架构评审结论，实现时落入 `content/` 配置表由测试断言，禁止硬编码、禁止擅自更改。

---

## 一、引擎选型结论（ADR-001/002/007/008）

**最终选型：Three.js r185 + Vite 7 + TypeScript 5.9.x + 零后端静态部署。**

### 1.1 为什么是 Three.js（候选对比结论）

| 维度 | Three.js r185 ✅ | Babylon.js | PlayCanvas | Unity WebGL |
|---|---|---|---|---|
| 核心体积（gz 约量级） | ~170KB | ~1MB+ | ~1MB | 10~40MB（含 wasm 堆） |
| 首屏可交互（红线 ≤5s） | 最优 | 良好 | 良好 | 难达标 |
| TS 类型 | 官方自带 | 官方维护 | 部分 | 生成式，质量一般 |
| 玩法逻辑自由度 | 最高 | 高 | 受编辑器约束 | C# 工具链负担 |

落选核心逻辑：本项目的核心工作量在**玩法仿真**（跳伞四阶段/弹道结算/缩圈几何/AI 行为），不在渲染管线。引擎越"全"（内置物理/GUI/场景序列化），越容易把逻辑写进引擎回调，破坏"仿真与表现分离"主决策；Unity WebGL 的 10~40MB 加载直接违反首屏 ≤5s 红线。Three.js 生态与问题检索量最大，上手成本最低。

### 1.2 配套选型（配套 ADR）

| 决策 | 结论 | 一句话理由 |
|---|---|---|
| ADR-002 物理碰撞 | **自研**（高度场采样 + AABB + 射线检测，约 300 行） | 本期碰撞仅三类需求；零 wasm 加载复杂度；完全确定性。不支持刚体堆叠，二期载具预留接口 |
| ADR-003 时间步进 | **fixed timestep 50Hz + rAF 可变渲染 + 插值** | AC2 落点可复现的硬前提；可变 dt 无法保证 |
| ADR-004 实体组织 | **ECS-lite**（轻量结构化实体 + 系统函数） | 实体上限 20，bitecs 等重型 ECS 无收益 |
| ADR-005 UI 方案 | React 19（低频菜单/背包/结算）+ 原生 DOM/Canvas2D 直写（高频 HUD/小地图） | React 重渲染不适合每帧更新 |
| ADR-006 AI 决策 | **有限状态机 FSM + 分帧更新**，不做行为树/GOAP | 需求仅 5 类行为，FSM 足够 |
| ADR-007 TS 版本 | 锁 **5.9.x**，不上 TS 7（native preview） | npm 最新 7.0.2 为 Go 原生移植，工具链未稳 |
| ADR-008 构建 | Vite（锁 7 稳定线）+ 零后端静态部署 | 纯前端无服务端依赖 |

### 1.3 引擎边界（防"引擎漂移"，CI lint 强制）

- 渲染层**只允许** import `three`；`render/` 目录之外出现 three import 即 lint error。
- 需自建渲染基建（每项 <150 行）：场景对象池、LOD 管理、阴影相机跟随、毒圈/弹道特效材质、调试 HUD 覆盖层。

---

## 二、场景设计结论（仿真与表现分离 + 确定性架构）

### 2.1 总体架构（最重要的一条决策）

玩法逻辑全部运行在**无 DOM 依赖的确定性仿真核心**中，Three.js 只做「快照 → 场景对象」映射，UI 只读事件流。分层自下而上：

```
UI 层（React 低频） + HUD/小地图（DOM/Canvas2D 高频直写）
        ↑ GameEvent 事件流
表现层 render/（Three.js r185）：场景·资源·LOD·相机·特效·对象池
        ↑ 每 rAF 只读 WorldSnapshot
仿真核心 core/（纯 TS，零 DOM 依赖，Node 可直接运行）
        fixed tick 50Hz · seeded RNG · ECS-lite
        ↑ PlayerIntent 指令流
输入层 input/ ＋ 内容层 content/（配置表 JSON）
```

三条关键推论：
1. **仿真核心不 import Three.js** → AC2/AC3/AC4/AC5 可在 Node + Vitest 中直接跑满局自动化断言（这是整个测试策略成立的前提）。
2. 渲染层崩溃/加载失败不推进仿真状态；渲染层可整体降级为占位几何。
3. UI 只消费事件，不回写仿真状态，杜绝 UI 驱动逻辑。

### 2.2 目录结构与依赖方向（CI 强制，违反即 lint error）

| 模块 | 可依赖 | 禁止依赖 |
|---|---|---|
| `core/`（loop/rng/world/events/systems） | `content` | `render` `ui` `input` `three` `react` |
| `content/`（weapons/loot/zone/map/constants） | — | 其他所有模块 |
| `render/` | `core` 类型、`three`、`content` | `ui` |
| `input/` | `core` 类型 | `render` `ui` |
| `ui/` | `core` 类型与事件 | `core` 内部实现细节 |

### 2.3 双循环确定性模型（性能与可复现的骨架）

```
rAF 渲染循环（可变，浏览器驱动）
 ├─ 累积器 accumulator += dt
 ├─ while (accumulator >= 20ms && catchUp < 3) core.tick()   // 固定 50Hz
 ├─ catchUp ≥ 3 → 丢弃积压并告警（防死亡螺旋，宁降速不雪崩）
 ├─ renderer.render(scene, camera)
 └─ 渲染层用 alpha = accumulator/TICK_MS 做位置插值（消除 50Hz 抖动）
```

- 逻辑 tick **50Hz（20ms）**：射击/掉血精度足够（AC4/AC5 按秒结算），比 60Hz 省 17% 逻辑开销。
- 插值只做渲染层位置/朝向 lerp，**不插值逻辑状态**，保证回放与断言用纯逻辑状态。
- 确定性铁律：所有随机数来自 **seeded RNG**（xoshiro128\*\* 或 mulberry32），`Math.random()` 与 `tick()` 内 `Date.now()`、DOM 访问全部禁止（lint 层面强制，破坏禁令的 PR 直接打回）。
- 随机流隔离：跳伞气流/AI 行为/物资生成由同一 rng 流的不同**子流**驱动（`rng.fork('loot')` / `rng.fork('ai')`），避免行为改动影响物资分布。
- 回放协议免费获得：录制 `{seed, contentPackVersion, intents[]}` 落 JSON，同 seed 同意图序列必然逐帧一致——bug 复现与 AC2 断言共用此机制。

### 2.4 场景与对局规模参数

| 项 | 数值 | 说明 |
|---|---|---|
| 地图尺度 | **1.6km × 1.6km** | AC2 落点容差 5% = 80m |
| 地形 | 程序化高度场 + 区域划分（城区/野区） | 无真实地形资产 |
| 建筑 | AABB 占位体 | 配合分离轴碰撞（先 X 后 Z + 速度钳制） |
| 对局规模 | 玩家 1 + AI 10~19，实体上限 20 | N5 |
| 单局时长 | < 10 分钟自然结束（AC1） | 缩圈 6 阶段总时长约束保证 |
| 美术 | 程序化几何 + 免费低模占位 | 范围裁剪：不做骨骼动画/联网/账号，AC 全部为数值/流程验收 |

### 2.5 仿真系统与 tick 执行顺序（core/systems）

| 顺序 | System | 职责 |
|---|---|---|
| 1 | lifecycle | 对局状态机 lobby→parachuting→playing→ended；胜负判定（仅剩 1 存活） |
| 2 | parachute | 运输机航线、四阶段（自由落体→开伞→滑翔→落地）物理 |
| 3 | movement | 地面移动、高度采样、AABB 碰撞 |
| 4 | combat | 射击节流、弹道射线、命中判定（包围盒+部位+距离衰减）、换弹/切枪 |
| 5 | loot | 按区域密度生成、拾取判定、背包容量/丢弃、护甲减伤/医疗回血 |
| 6 | zone | 缩圈阶段表、圈心/半径插值收缩、圈外按秒掉血 |
| 7 | ai | FSM（patrol/loot/seek/fire/fleeZone/dead）+ 轮转分帧决策 |

**AI 与玩家共用同一套 PlayerIntent 与同一套 systems，AI 不走特权通道**——这条约束使"AI 也会被淘汰/也会避毒"天然成立，也让 AC4 命中率可用 AI 对 AI 对局复现验证。

核心契约（`MatchHandle`）：`tick(intents[])` 推进 / `snapshot()` 只读快照（渲染唯一数据源）/ `drainEvents()` 事件消费 / `status()` / `result()`（排名/淘汰数/用时）。

---

## 三、武器系统设计结论（AC3/AC4 数值基准）

### 3.1 WeaponDef schema（content/weapons.ts）

```ts
interface WeaponDef {
  id: WeaponId; category: 'ar' | 'smg';
  damage: number;        // 基础伤害
  rpm: number;           // 射速（发/分）
  magazine: number;      // 弹匣容量
  reloadMs: number;      // 换弹时间
  recoil: number;        // 后坐力系数 0..1
  effectiveRange: number;// 有效射程 m，超出伤害线性衰减至 50%
  spread: number;        // 散布 rad
  projectileSpeed: number; // 弹速 m/s（射线扫描命中判定）
}
```

### 3.2 双武器初始数值（彼此可区分是 AC4 验收点）

| 参数 | 步枪 `ar_m4` | 冲锋枪 `smg_ump` |
|---|---|---|
| damage | 26 | 18 |
| rpm | 620 | 850 |
| magazine | 30 | 25 |
| reloadMs | 2200 | 1800 |
| effectiveRange | 350m | 120m |
| recoil | 0.45 | 0.30 |

### 3.3 命中与伤害结算规则

- **部位倍率**：头 2.5 / 躯干 1.0 / 四肢 0.75；生命值归零即淘汰（cause: shot | zone）。
- **距离衰减**：超出 effectiveRange 后伤害线性衰减至 50%。
- **命中判定**：弹道射线扫描（projectileSpeed）+ 目标包围盒，静止目标有效射程内命中率 ≥90%（蒙特卡洛 1000 发自动化断言）。

### 3.4 物资与防具医疗数值（AC3 基准）

| 项 | 数值 |
|---|---|
| 护甲（躯干减伤） | 0.35 |
| 头盔（爆头减伤） | 0.5 |
| 医疗包 | +60 HP，使用 3000ms |
| 物资种类 | 武器/弹药/护甲/头盔/医疗包/投掷物，均带 gridCost 背包格占用 |
| 生成规则 | 按 zone 分区密度 + 权重池（LootTableDef），生成数量/种类必须与表断言一致 |
| 生效时机 | 拾取即生效：装备武器立即可射击、穿甲减伤、医疗回血 |

### 3.5 缩圈配置（AC5 基准，ZoneConfig）

- 首圈半径 **600m**，每阶段半径乘数 **0.65**，圈心随机偏移比例 0.4。
- 6 阶段圈外 dps：`[0.4, 0.8, 1.5, 2.5, 4, 6]`（逐阶段递增，验收断言点）。
- 等待/收缩秒：`[60/40, 50/35, 40/30, 35/25, 30/20, 25/15]`（合计 < 10 分钟，反推满足 AC1）。
- HUD 实时显示当前圈、下一圈轮廓与阶段倒计时。

---

## 四、60FPS 性能红线（超预算即视为性能缺陷）

### 4.1 硬红线指标（N1/N4 推导，验收工具：调试 HUD）

| 预算项 | 目标值 | 硬上限 | 红线含义 |
|---|---|---|---|
| 帧率 | 桌面 **60 FPS**；移动 ≥30 FPS | — | N4，M0 DoD 即要求空对局 60FPS 稳定 |
| 单帧 draw calls | < 120 | **150** | 超 150 判性能缺陷 |
| 单帧三角形 | < 400k | **800k** | — |
| 逻辑 tick 单帧耗时 | < 3ms | **8ms**（超限告警） | tick 超时会挤压渲染预算 |
| 首包 JS（gz） | < 800KB | **1.2MB** | 支撑 N1 首屏可交互 ≤5s |
| 纹理内存 | < 200MB | **400MB** | — |
| 首屏可交互 | ≤ 5s（桌面宽带） | — | N1，免安装定位的底线 |

### 4.2 画质三档定义（Medium 为默认）

| 参数 | Low | Medium（默认） | High |
|---|---|---|---|
| 像素比 | min(dpr,1)×0.75 | min(dpr,1) | min(dpr,2) |
| 阴影 | 关闭 | 1 级跟随相机 1024 | 2048 + 更远投影 |
| 视距/雾 | 300m 雾浓 | 600m | 1200m |
| LOD 切换距离 | 收紧 50% | 基准 | 放宽 30% |
| 植被/物资实例化密度 | 40% | 100% | 100% |
| 反锯齿 | 关 | 关（像素比补偿） | MSAA×4（WebGL2） |

默认档位：`navigator.userAgent` 粗分（移动→Low，桌面→Medium）；High 仅手动或设备探测通过后开启。

### 4.3 动态降档规则（render 层实现，与仿真无关）

- 采样窗口：每 **2 秒**计算平均 FPS 与 p95 帧时间。
- **降档**：连续 2 窗口 `FPS < 45` → 降一档（High→Medium→Low）；Low 后改为降分辨率 25%。
- **升档**：连续 5 窗口 `FPS > 58` → 升一档，每分钟至多一次（防抖动）。
- 每次档位变化写入调试 HUD 与 console，便于定位。

### 4.4 分帧与达标手段

- **AI 分帧**：决策每 tick 只更新 **1/4 实体**（轮转分片），感知与决策同频，移动每 tick 执行；单 tick 决策耗时预算 <3ms（M6 验收）。
- **毒圈掉血**：按秒结算（AC5 语义），tick 内累计时间再结算，不逐 tick 扣血。
- 渲染达标手段：地形/植被用 `InstancedMesh`；物资与建筑静态合批；阴影只投影主光；远处实体只更新朝向不更新动画。
- 兼容矩阵：桌面 Chrome/Edge/Safari/Firefox 完整；Android 中端机（≥4GB）Low/Medium ≥30FPS；iOS Safari Low/Medium（全屏/指针锁定需用户手势）；WebGL2 不可用直接降级提示页（不承诺 WebGL1）。
- 指针锁定（Pointer Lock）用于瞄准；Esc 退出后 UI 需提供"点击继续"重进。

### 4.5 可观测性（性能验收的测量工具）

内置调试 HUD（`?debug=1`，Release 默认关闭），M0 交付时必须可用：FPS/平均与 p95 帧时间/tick 耗时与漂移/draw calls/triangles/纹理内存/实体数/AI 状态分布/当前画质档与最近切换原因；支持 `?seed=123&replay=xxx` 固定种子与回放。

---

## 五、里程碑与执行对齐（开发节点照此排期）

```
M0 地基(0.5w) → M1 跳伞(1w) → M2 移动+地图(1w) → M3 物资(1w)
→ M4 射击(1w) → M5 缩圈(0.5w) → M6 AI(1w) → M7 闭环+调优(1w)   合计 ≈ 7 周
```

| 里程碑 | 关键交付 | 硬验收（DoD） | AC |
|---|---|---|---|
| M0 地基 | 50Hz 确定性循环、seeded RNG、事件总线、调试 HUD、CI + 依赖方向 lint | 空对局 60FPS；core 内 Math.random/Date.now 被 lint 禁止；HUD 可见 | — |
| M1 跳伞 | 四阶段跳伞、落点控制 | 同 seed 同输入落地坐标逐 tick 一致；落地 1s 内 state=ground；偏差 ≤80m | AC2 |
| M2 移动+地图 | 高度场、城区/野区、AABB 碰撞、第三人称相机 | 60FPS；不穿墙不穿地；draw calls<120 | — |
| M3 物资 | 密度生成、拾取、背包、防具医疗生效 | 生成符合权重表；数值与配置一致 | AC3 |
| M4 射击 | 武器表、弹道命中、部位/距离衰减 | 静止目标命中率 ≥90%（1000 发）；武器参数可区分 | AC4 |
| M5 缩圈 | 阶段表、插值收缩、按秒掉血、HUD 圈轮廓 | 各阶段参数与表一致且 dps 递增 | AC5 前半 |
| M6 AI | FSM 六状态、感知索敌、分帧 | AI ≥10；完成落地→拾取→交火→避毒路径；决策 <3ms | AC5 对抗 |
| M7 闭环 | 胜负结算、录制回放、降档、回归 | 10 局采样 100% 自然结束 ≤10min；性能预算全达标 | AC1 + AC5 胜负 |

依赖：M1→M2→M3→M4 串行；M5 仅依赖 M2 可与 M4 并行；M6 依赖 M3/M4/M5；M7 收口。每个里程碑必须以"可运行 + 可验收"结束，禁止跨里程碑堆叠未验证功能。

测试策略三层：**Node 仿真断言为主**（core 零 DOM → 无需浏览器、可进 CI、覆盖 AC2/3/4/5 全部数值）；Playwright 性能冒烟仅 M0/M2/M7 各一次（读 HUD 断言预算，不逐帧比对画面）；人工体验走查仅 M7。

---

## 六、风险红线与待核实事项（实现前必须确认）

| 风险 | 触发条件 | 对策 |
|---|---|---|
| 跳伞手感调不平（AC2） | M1 连续 3 天不收敛 | 空气阻力模型参数化（content 暴露 drag/glide）+ 落点预览圈 UI |
| AI 交火强弱失衡 → 单局时长失控 | M6 采样 >12min 或 <4min | AI 反应延迟/命中率/搜索半径进配置表，M7 十局采样调参 |
| 移动端帧率不达标 | 中端机 Medium <30FPS | 自动降档兜底；Low 档为硬底线（关阴影+降分辨率） |
| 自研碰撞穿墙/卡墙 | M2 冒烟出现 | 先 X 后 Z 分离轴 + 速度钳制；缺陷用回放文件复现 |

**M0 前必须核实的 3 项**（本文数值以官方文档/公开资料为据，非实测）：
1. Three.js 核心 gz 体积与真实首屏时间——用实际 `vite build` 产物复核并回填 4.1 的首包红线。
2. iOS Safari WebGL2 在目标最低机型上的表现——不达标则 iOS 锁 Low 档。
3. Pointer Lock 在平台预览 iframe 中的可用性——若被禁，降级"鼠标移动=视野"方案并记录。

## 七、二期演进预留（本期不做，只留边界）

- **多人联机**：`tick(intents)` 已解耦输入与状态，二期将本地输入替换为远端指令流（客户端预测 + 服务器权威），core 无需重写——这是确定性设计免费换来的关键预留；二期联机选状态同步，不依赖 lockstep（跨设备浮点一致性本期不承诺）。
- **载具/复杂物理**：movement system 内部可替换为 Rapier，对外仍走 PlayerIntent。
- **内容扩量**：content 配置表即内容管线，新增武器/物资/地图不改代码。
- **存档/战绩**：结构化 MatchResult 直接对接后端传输层。

---

*版本 v1.0 ｜ 2026-08-30 ｜ 依据 PR #8（commit ec48f16）架构方案固化；术语与规范以《「和平精英Web版」核心玩法需求》与本方案原文为准。*

## 沉淀知识：和平精英Web版两次开发失败复盘与pubg-web-core串行开发规范

# 沉淀知识：和平精英Web版两次开发失败复盘与pubg-web-core串行开发规范

> **适用功能线**：branchKey=`pubg-web-core`（和平精英Web版核心玩法）
> **版本**：v3（2026-08-31。演进：v1《小步串行开发与防超时规范》→ v2《串行小步开发规范与两轮失败复盘》→ v3 并入第三轮「换流程外壳仍失败」的实证与 Agent 兜底成功案例，固化**串行开发、禁止并行分支**红线）
> **权威技术基准**：《Web大逃杀技术方案与性能红线》（知识 id=6439fc3e-9217-4004-b091-aa79a6f9bcab）＋ 架构方案 PR #8（产物 id=cmos298dg0001m9mxandnum2z，repo hl3w22bupt/myrd-playground，Three.js r185 + Vite 7 + TS 5.9.x + 50Hz 确定性仿真核心 + seeded RNG）
> **需求基线（唯一需求来源）**：《和平精英Web版（pubg-web-core）收敛总需求：稳定60FPS+画面够看+核心玩法完整闭环》（id=cmtg6bxv6003ym9hav1sxej1e，branchKey=pubg-web-core）
> **用途**：约束本功能线所有开发节点的立项方式、分支策略、步长与门禁分级，固化三轮失败根因与已验证的补救路径，供后续迭代直接复用，防止同类失败重演。本规范管「怎么不掉链子」，技术基准文档管「怎么做对」。

---

## 一、三轮失败全景（开发类运行 9 次：7 败 2 成）

### 1.1 第一轮：全量口径（规范产生前）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 1 | 实现核心玩法（跳伞/拾取/射击/缩圈/AI 全量） | ❌ failed | cmtfz3zu70016m9ha4wldebwo | **单次任务过重**：5 大玩法模块塞进一个节点；且无独立需求基线 |
| 2 | 优化画面与流畅度 | ❌ failed | cmtfz6s9k001dm9hatl10qx9b | **目标混合**：画面表现 + 性能红线两类验收口径同节点，失败无法归因 |
| 3 | 实现最小可玩闭环（需求 id=cmtg05te2001zm9hamye40r6u） | ✅ completed | 见功能线运行记录 | 先立项收敛需求、边界明确、验收口径单一（正面样本） |

### 1.2 第二轮：小步口径（v1 规范执行后，3 步全败）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 4 | 第1小步·性能修复（稳定60FPS） | ❌ failed | cmtg2wvet002tm9hagm2awqhj | **空仓库起步** + **完整E2E门禁过重** |
| 5 | 第2小步·画面升级（材质光照雾效粒子+HUD） | ❌ failed | cmtg3pefz0034m9hahhlpy86p | 小步体量 × 全量门禁，单次运行预算失衡 |
| 6 | 第3小步·玩法补齐与缺陷修复（最终E2E+PR） | ❌ failed | cmtg5bzsp003jm9ha5876khnw | 同上，且前两步无合入成果可叠加，修复失去基线 |

（第 5、6 步之间插入一次成功的「代码审查」Agent 联合审查：审查前两步变更并输出缺陷清单，产物 id=cmst009ls000am9jmyk8ylfil —— 「轻实现 + 专项审查」组合是可行的补充通道。）

### 1.3 第三轮：换流程外壳（v2 规范执行后，仍败）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 7 | pubg-web-core 分支叠加「画质与60FPS性能优化」 | ❌ failed | cmtg8kgc3004zm9hawlb9kvxo | 双目标（性能+画面）混合 + 「实现+完整E2E门禁」整链仍压在单次运行 |
| 8 | 第1小步·性能修复（流程变体：开发测试→审查→人工确认→创建PR） | ❌ failed | cmtg6jkbc004am9hauxsfe20k | **流程外壳变了，预算约束没变**：仍要求单次运行装下 实现+全量门禁，且未先拉取既有实现 |

**第三轮结论（v3 新增）**：失败与「流程里有没有审查 / 人工确认环节」无关，与「单次运行预算能否装下 实现 + 门禁」有关。给同一摊子加环节只会更重，不会更稳。有效解法只有四个：收敛范围、拆小步、门禁分级、换执行通道（Agent 兜底）。

### 1.4 根因归纳（跨三轮稳定复现的 3 + 1 条）

1. **空仓库起步**：开发工作流未先 `git fetch origin pull/<PR号>/head:pr-<PR号>` 拉取既有实现（PR #8 架构 + 已合入的最小可玩闭环 + PR #9 补齐成果），在空仓库上从零重复搭地基，把宝贵的单次运行时长消耗在与本步目标无关的工作上。
2. **单次任务过重**：第一轮是「节点肥」（多模块/多口径混装）；第二、三轮节点已瘦，但「实现 + 全量门禁」整条链仍压在同一个单次运行里，链条总重没降。
3. **完整E2E门禁过重**：小步场景下「lint + 全量单测 + Node 全流程自动化断言 + 构建 + 冒烟」成本占比畸高，直接挤爆单次运行时间窗，是二、三轮连败的直接放大器。v2 已修订为门禁分级（见第三节规则 3）。
4. **只换流程外壳无效（v3 新增）**：第三轮改用含「审查 + 人工确认」的流程变体（run cmtg6jkbc004am9hauxsfe20k）依旧失败。诊断失败时先看三件事——仓库基线是否为空、单次运行装了哪些活、门禁多重——而不是流程叫什么名字。

---

## 二、补救路径（逐条标注验证状态）

| # | 动作 | 验证状态 | 证据 |
|---|---|---|---|
| 1 | **需求固化**：失败动作立为正式需求基线，目标不悬空 | ✅ 已验证 | 收敛总需求 id=cmtg6bxv6003ym9hav1sxej1e（branchKey=pubg-web-core，统一修正 `pubb-web-core` 笔误） |
| 2 | **收敛范围**：把大目标收敛为边界单一的最小可玩闭环 | ✅ 已验证 | 需求 id=cmtg05te2001zm9hamye40r6u → 对应 run completed（9 次开发运行中 2 次成功之一） |
| 3 | **同 branchKey 串行叠加**：后一步基于前一步已合入成果 | 📌 已固化为红线 | 第三节规则 1；本功能线后续节点一律复用 branchKey=pubg-web-core 串行执行 |
| 4 | **Agent 兜底**：工作流连续失败后由 @开发Agent 直接接管 | ✅ 已实证 | 「开发与测试Agent」检查分支产物、补齐缺失玩法与性能缺口并提 PR → completed，PR #9（产物 id=cmst009lq0009m9jmg3e4zh9l） |
| 5 | **审查前置**：先联合审查既有变更，输出缺陷清单再修 | ✅ 已实证 | 代码审查Agent 缺陷清单（产物 id=cmst009ls000am9jmyk8ylfil），修复步以其为输入，禁止盲修 |
| 6 | 仅更换流程外壳（增加审查/人工确认环节） | ❌ 已证伪 | 第三轮 run cmtg6jkbc004am9hauxsfe20k 含上述环节仍 failed |

---

## 三、硬性规则（v3 红线，违反即打回）

### 规则 1：branchKey 复用 + 单分支串行，严禁并行分支

- `pubg-web-core` 功能线的**所有开发节点必须复用 branchKey=pubg-web-core**，按需求 id 复核绑定后串行执行（检索绑定时注意历史需求存在 `pubb-web-core` 拼写笔误，一律以需求 id 为准）。
- **同一时间窗内本功能线只允许一个进行中的开发节点；严禁并行新开分支改同一批文件。**「pubg-web-core 必须串行开发、禁止并行分支」是本功能线的强制约定，不是建议。
- 后一节点必须基于前一节点**已合入**的成果（N-1 的 merge commit 是 N 的基线）；前一步未合入，后一步不得开工。
- 理由：并行分支 ① 同一批文件互相覆盖、合并冲突；② 没有已合入基线可叠加（第二轮第 3 小步失败的直接诱因之一）；③ 诱发空仓库起步，重复搭地基浪费单次运行预算。

### 规则 2：小步提交，每步只做一件事

- 每步目标在 **性能（performance）/ 画面（visual）/ 玩法（gameplay）** 三类中**三选一**，禁止混合；单步改动规模以「一次运行内能完成 实现 + 轻门禁」为上限。
- **开工前必须先考古**：`git fetch origin pull/<PR号>/head:pr-<PR号>` 核实既有实现（当前可复用：PR #8 架构、最小可玩闭环、PR #9 补齐成果），能复用就复用，**禁止空仓库起步**。
- 术语与数值只认权威技术基准（知识 id=6439fc3e-…），新数值落 `content/` 配置表并配测试断言，禁止硬编码。

### 规则 3：门禁分级（修订 v1 规则 3）

- **小步（实现步）→ 轻门禁**：lint + 本次改动相关单测 + 冒烟；不跑全量 Node 自动化断言。
- **收口步 → 完整 E2E 门禁（重门禁）**：lint + 全量单测 + Node 全流程自动化断言 + 构建 + 冒烟 + PR。
- **门禁预算前置**：开工前估算「实现 + 门禁」总耗时；预估超出单次运行预算就先拆步，不指望运行中途省时间。

### 规则 4：失败必须固化

- 任何 run_workflow 失败后，要么固化为需求基线（如收敛总需求 cmtg6bxv6003ym9hav1sxej1e），要么沉淀/更新为知识规范（即本文档）；不允许目标悬空后无人认领。

### 规则 5：连续失败切换执行通道（兜底阈值，v3 新增）

- **同一小步的 run_workflow 连续失败 ≥2 次 → 停止重试工作流**，改由 @开发Agent 直接接管该小步（考古既有实现 + 实现 + 轻门禁 + 提交/PR）；工作流通道留给收口与验证。
- 依据：第二轮 3 连败、第三轮 2 败期间，Agent 通道已实际交付 PR #9——兜底通道不是理论，是被验证过的交付路径。

---

## 四、推荐节点拆分（v3：拆分与门禁级别沿用 v2）

| 顺序 | 节点 | 目标类型 | 门禁级别 |
|---|---|---|---|
| P0 | 仿真核心骨架与确定性底座（50Hz fixed timestep + seeded RNG + ECS-lite + MatchHandle + 依赖方向 lint） | 玩法 | 轻门禁 |
| P1 | 3D 地图与移动碰撞（1.6km² 高度场、城区/野区、AABB 建筑） | 玩法 | 轻门禁 |
| P2 | 跳伞落地四阶段（航线 + 自由落体→开伞→滑翔→落地，落点可复现） | 玩法 | 轻门禁 |
| P3 | 物资拾取与背包（区域密度、容量/丢弃、护甲减伤/医疗回血） | 玩法 | 轻门禁 |
| P4 | 武器射击命中（ar_m4 / smg_ump、弹道射线 + 包围盒、部位/距离衰减） | 玩法 | 轻门禁 |
| P5 | 缩圈毒圈（≥3 阶段收缩、圈外按秒递增掉血、HUD 倒计时） | 玩法 | 轻门禁 |
| P6 | AI 敌人与胜负结算（≥10 AI FSM、共用 PlayerIntent、唯一存活者结算） | 玩法 | 轻门禁 |
| P7 | 性能优化（稳定60FPS、1% 最低帧、内存不泄漏） | **性能** | 轻门禁 |
| P8 | 画面表现提升（材质/光照/雾效/粒子/HUD） | **画面** | 轻门禁 |
| 收口 | 最终 E2E + PR（AC1–AC4 全量断言） | 混合验收 | **完整 E2E 门禁** |

排序原则：先玩法闭环（P0→P6 串行补齐），再性能（P7），再画面（P8），最后收口跑重门禁。任何节点失败只影响该节点，已合入成果不回退；P0–P8 期间禁止顺手做别的类型的事。

---

## 五、关联产物索引

| 类型 | id / 标识 | 说明 |
|---|---|---|
| 需求（第一轮基线） | cmtfyd7uc000im9hapib6ann3 | 「和平精英Web版」核心玩法需求（跳伞/拾取/射击/缩圈/AI 对抗） |
| 架构方案 | PR #8，产物 cmos298dg0001m9mxandnum2z | 技术选型与目录/依赖方向约定（repo hl3w22bupt/myrd-playground） |
| 知识（技术基准） | 6439fc3e-9217-4004-b091-aa79a6f9bcab | Web大逃杀技术方案与性能红线（数值唯一依据） |
| 需求（最小可玩闭环） | cmtg05te2001zm9hamye40r6u | branchKey 登记 `pubb-web-core`（笔误，绑定一律以需求 id 复核）；对应 run 成功 |
| 需求（收敛总需求，当前唯一来源） | cmtg6bxv6003ym9hav1sxej1e | 稳定60FPS + 画面够看 + 玩法完整闭环，branchKey=pubg-web-core |
| 失败 run（第一轮·全量口径） | cmtfz3zu70016m9ha4wldebwo / cmtfz6s9k001dm9hatl10qx9b | 单次任务过重 + 目标混合 |
| 失败 run（第二轮·小步口径） | cmtg2wvet002tm9hagm2awqhj / cmtg3pefz0034m9hahhlpy86p / cmtg5bzsp003jm9ha5876khnw | 空仓库起步 + 完整E2E门禁过重 |
| 失败 run（第三轮·换流程外壳） | cmtg8kgc3004zm9hawlb9kvxo / cmtg6jkbc004am9hauxsfe20k | 双目标混合 / 外壳变了预算没变 |
| Agent 兜底成果 | PR #9，产物 cmst009lq0009m9jmg3e4zh9l | 开发与测试Agent 补齐缺失玩法与性能缺口并提 PR（兜底通道实证） |
| 审查产物 | cmst009ls000am9jmyk8ylfil | 前两步变更联合审查缺陷清单（修复步输入，禁止盲修） |
| 知识（流程规范·本文档） | b44145e4-6dda-4f92-8741-e0c8bf3dc6b6 | v3：串行开发禁并行分支 + 三轮失败复盘 + 已验证补救路径 |

---

## 六、适用边界

- 本规范**强制适用于** `pubg-web-core` 功能线及其全部后续开发节点；新增玩法/优化项按第四节模式继续追加串行小步。
- 其他项目/功能线可参照**方法论**：branchKey 复用串行、单步单目标（性能/画面/玩法三选一）、门禁分级（小步轻、收口重）、开工先考古禁空仓库起步、审查前置、连续失败即切 Agent 兜底、失败即固化；节点拆分与 AC 划分按各自需求基线重划，不照抄 P0–P8 清单。
- 本规范与《Web大逃杀技术方案与性能红线》（6439fc3e-…）互补：那份管「怎么做对」，这份管「怎么不掉链子」。


## Agent 与 Agent 驱动游戏研发调研报告：Mobius 仓库 × 三篇文章设计对比与可借鉴点

> 沉淀自目标 DAG「mobius 调研 → 沉淀知识 → 方案设计 → 需求 → 开发」（goal `cmtmvs3u0000ejqjst3gc2cmf`）。本文对应调研节点产物 `cmsk2tgmn0000m9rrqdhia5nl`（产品及商业化军师产出），由目标管理大师于 2026-09-04 固化入库，供后续「方案设计 / 需求 / 开发」节点直接检索引用。

# Agent 与 Agent 驱动游戏研发调研报告：Mobius 仓库 × 三篇文章设计对比与可借鉴点

## 0. TL;DR（30 秒版）

- **Mobius 根本不是游戏项目**——它是通用「自进化 Agent OS」。它解决了「怎么组织多个 agent」，但对「游戏研发」这个领域零结构：整个仓库没有任何引擎、关卡、美术管线、玩法验证的痕迹。
- 三篇文章恰好补上领域那一半：网易证明「**知识先于生成**」；腾讯云给出「**结构化策划案 → 可玩原型 → 资产 → 引擎**」的领域管线；触乐证明「**开发不再是瓶颈，判断/验收才是**」。
- 第一结论：**通用组织能力（Mobius 已验证可行）+ 领域结构（三篇文章证明是价值所在）= 我们该做的东西。只抄任何一半都会死。**
- v1 最小闭环：结构化策划案 schema → 带 QA 互查的 Web 原型生成 → 可玩链接 + 人工验收 checklist；组织上用 1 首席 + 策划/程序/QA/美术四职能 + 共享黑板；知识层从三级 Skill/Memory 起步。引擎移植、自进化、数据回流全部留给后续版本。

## 1. 调研来源与范围

| 来源 | 类型 | 读完的部分 |
|---|---|---|
| mobius-system/mobius | 开源仓库 | README、文档总览、研究团队教程、技能/记忆机制教程 |
| 文章A：网易《游戏研发中的 AI 转型：多 Agent 系统与知识工程实践》（林香鑫，AICon 演讲） | 大厂中台视角 | InfoQ/公众号全文 |
| 文章B：腾讯云林哲《基于 AI Agent 的小游戏开发实践》 | 云厂商产品视角 | GameLook 专稿全文 |
| 文章C：触乐《当 AI 开始重写小游戏生产流程》 | 独立开发者+行业视角 | 36氪转载全文 |

**范围偏差声明（重要，后续节点必读）**：军师执行时未拿到目标描述中的 3 个 mp.weixin 原始链接，按「Agent 游戏研发」主题自选了上述三篇替代文章。目标原始链接之一经秘书预判为 **Claude of Tanks**（agent 驱动游戏研发标杆案例，要点：126 辆战车一份规格数据喂给所有消费端的单一数据源、确定性种子模拟、客户端提交输入/服务器裁定事实的权威仲裁架构、Tank Gallery/Scene Studio 内容检查工具、契约测试门槛）。后续「方案设计」节点若需覆盖原始链接来源，需对 Claude of Tanks 补研；本报告三大主线结论（组织 × 领域 × 验收）不受影响。

## 2. 四个研究对象的设计拆解

### 2.1 Mobius（mobius-system/mobius）

- **定位**：首个开源自进化 Agent OS。把模型、agent、项目、设备、算力连进一个工作网络，会随使用改写自身代码/UI/插件，每次改动可追溯（部署时建议 fork，自进化后可提交回自己仓库）。
- **组织模型（两层）**：
  1. `@` 跨会话连接——事后补建，点对点，可选「只读引用」或「双向交流」；
  2. 智能体群——事前预设，多 agent 共享「群黑板」自主分工。研究团队形态：1 首席（不可删，负责拆解+整合）+ 最多 12 助理，逐成员配模型/职责/Skill 与 Memory 范围。
- **知识层**：Skill/Memory 三级作用域（内置/用户级/项目级），会话创建时勾选、中途可追加——本质是**提示词级注入**，没有代码级知识图谱。
- **管控层**：巡检/鞭策防 agent 偷懒、模型调用限频（token proxy）、危险操作人工审批与无人值守 agent 分开——「拆成多个 agent 各守边界，别把两套要求塞进一个上下文」是它的核心论点。
- **架构**：tmux 会话为底座，编码 agent（Claude Code/Codex/GLM harness）被 OS 编排，Node/TS 后端 + SQLite + Web/Electron/TUI 三端。模型完全解耦。

### 2.2 文章A：网易《游戏研发中的 AI 转型：多 Agent 系统与知识工程实践》

- **核心洞察**：内部大规模调研发现，游戏研发最大时间成本不是写代码，而是**理解代码**（千万行仓库、20% 时间花在问人）。所以先做知识，再做生成。
- **设计**：显性知识（文档/工单/仓库归集 → agentic RAG）+ 隐性知识（AST + 调用流 → 代码知识图谱，工单↔提交记录打通）；「研发空间」把团队隐性规范显性化（SDK 版本、引擎代码、编码风格）；Core Agent 协调一批「项目风格化」子 Agent。
- **金句级论断**：「Agent 架构最后的差异不会太大，真正重要的是你给 Agent 提供了什么上下文。」
- **AI Review 演进**：prompt 工程（1000 个问题只有 10 个有效）→ 静态分析+大模型双引擎 → multi-agent 过滤分级 → 注入知识工程 → 少而精。「白天人写代码，晚上 AI 审查」。
- **数据**：团队工具月产 500 万行代码、覆盖几十个项目；新人熟悉 4 万行代码从 2 周 → 1-2 天。

### 2.3 文章B：腾讯云林哲《基于 AI Agent 的小游戏开发实践》

- **核心洞察**：
  1. 玩法验证有沉没成本，MVP 验证前参与人数要最少；
  2. **WebGame 技术栈对 LLM 最友好**（20 年成熟度、模型知识充分、代码即资产、浏览器即预览）。
- **流水线**：专家中心（岗位化 Skill+知识库）→ 与专家对话迭代出结构化策划案 → 专家团（工程师生成 + QA 审核互查）一句话出可玩原型 → AI 生成**关卡可视化编辑页**（元素编号化，让自然语言修改有明确落点）→ 上下文贯穿：美术无需逐图写提示词，一句话替换全套资产 → 导出（策划案/数值/关卡/美术/源码）给 CodeBuddy → 引擎 MCP（Unity/Cocos/UE 已支持）+ Skill 划定 MCP 操作边界 → 图生视频抽帧解决序列帧动画。全程 2 天出 Cocos 版。

### 2.4 文章C：触乐《当 AI 开始重写小游戏生产流程》

- **事实**：个人开发者 1200 元 + 2 个月业余做出上线微信小游戏（Claude Code 写码、GPT/Gemini/豆包出图）；AI 广告素材成本不到传统 1/10，买量侧比研发侧落地更快；Sekai 上已有 1500 万个迷你应用，游戏正在变成 UGC 社交内容。
- **核心论断**：**开发不再是瓶颈，判断成了新门槛**。「AI 帮不了你的 4 件事」：产品决策（好不好玩）、新手引导设计（AI 不知道玩家为何困惑，90% 测试者看不懂的教训）、美术风格统一、平台合规审核。小游戏规模恰好规避了 AI 的上下文丢失问题（代码量小、平台单一）。

## 3. 设计对比（一张表）

| 维度 | Mobius | 网易 | 腾讯云 WorkBuddy | 行业/个人实践（文章C） |
|---|---|---|---|---|
| 定位 | 通用自进化 Agent OS | 企业内代码智能中台 | 垂直游戏原型流水线 | 单人工具链 + 平台生态 |
| 组织模型 | @点对点 + 群黑板，首席制 | Core Agent 协调风格化子 Agent | 专家团两两互查（工程+QA） | 无（单人+多工具） |
| 知识/上下文 | Skill/Memory 三级，提示词级 | **代码图谱+研发空间（最深）** | 会话上下文贯穿全流程 | 靠小游戏规模天然规避 |
| 领域结构 | **无（游戏零结构）** | 通用代码级 | **有（策划案→关卡→资产→引擎）** | 有（全流程+平台合规） |
| 验证/质量 | 巡检防偷懒（治意愿不治结果） | AI Review 少而精 | QA agent 互查 | **人工验收是硬瓶颈** |
| 商业形态 | 开源+自托管 | 内部效能（数据回流成壁垒） | 云产品（150+ 客户） | 平台抽成+流量分配 |

**空档清晰可见**：Mobius 有组织没领域，网易有知识没游戏管线，腾讯云有管线但绑定腾讯生态且只到小游戏原型。**「游戏领域的知识工程 + 开放的多 agent 组织」目前没人做全。**

## 4. 可借鉴点清单（按优先级，直接指导实现）

### P0 —— 决定产品形态

1. **上下文贯穿的单一事实源**：把策划案做成**机器可读的结构化工件**（世界观/关卡/数值/UI 的 schema），原型、美术、配表全部从它派生——这是腾讯云流程里最值钱的一步，也直接回应文章C「AI 不知道玩家为何困惑」：结构化设计文档就是人的产品决策的载体。
2. **知识先于生成**：v1 就要有项目知识层——目录结构语义化、引擎版本与 API、编码风格、命名表（网易「研发空间」+ Mobius 三级 Skill/Memory 作用域的合体）。没有这层，多 agent 就是并行的平庸。
3. **验收回路是一等公民**：生成 agent 与 QA agent 对抗互查（腾讯云）+ 可运行冒烟测试 + 人工 checklist。Mobius 的巡检只解决「偷不偷懒」，不解决「对不对」；三篇文章在这一点上完全一致：最终验收必须是人，产品要给验收者好用的工具而非更多产出。

### P1 —— 组织与执行

4. 双层协作照抄 Mobius：主策划 agent 与职能 agent 点对点单聊 + 共享黑板放关卡状态/资产清单/阻塞项。
5. **「让 AI 给 AI 造工具」**：AI 生成关卡可视化编辑页、元素编号化，把模糊的自然语言修改变成精确指令——这是文章B里最聪明的单个设计，成本低收益大。
6. Web-first 原型 + 引擎移植分段：v1 只做 Web 原型闭环（LLM 知识最充分、浏览器即预览），引擎移植（MCP+Skill 划边界）放 v2。
7. 管控照抄 Mobius：危险操作人工审批与无人值守 agent 分开、token 限频、按 agent 划边界——别把两套要求塞进一个上下文。

### P2 —— 长期壁垒

8. 数据回流：纠错数据、审查标记、验收结论沉淀回知识库（网易的闭环），配合 Mobius 式「每次改动可追溯」。这是唯一随时间复利的资产。
9. 把文章C列出的「AI 做不到的 4 件事」直接做成产品功能：新手引导工作流、风格参考卡库、合规材料 checklist——**人的新瓶颈就是你的收费点**。

## 5. 反面清单（不要做的）

- **不要先造通用 Agent OS 等游戏场景长出来**——Mobius 本身就是反例，通用平台对游戏零领域结构，网易也证明了价值全在领域上下文里。
- **不要拿「一句话自动出游戏」当核心卖点**——三篇文章一致证明验收/好玩靠人，宣传过头用户第一次用就失望。
- Mobius 的「自进化改自己源码」在多租户商业场景是安全与合规噩梦；**借鉴其审计与可追溯，不要借鉴「改自己」**。
- 别把「生成更多」当差异点：小游戏月提交已超 1 万款、审核排队 3 天起步——同质化和合规才是死穴，能帮「过审与验收」比能「生成」稀缺得多。

## 6. 给下一步实现的一句话指令

**v1 最小闭环 = 结构化策划案 schema → 带 QA 互查的 Web 原型生成 → 可玩链接 + 人工验收 checklist，组织上用 1 首席 + 策划/程序/QA/美术四职能 + 共享黑板，知识层从三级 Skill/Memory 起步。引擎移植、自进化、数据回流全部留给后续版本。**

## 7. 溯源与关联

- **目标**：`cmtmvs3u0000ejqjst3gc2cmf`（调研 → 沉淀知识 → 方案设计 → 录需求 → 开发工作流）
- **调研产物**：artifact `cmsk2tgmn0000m9rrqdhia5nl`（产品及商业化军师，2026-09-04）；完整报告原文存于该目标的 goal session 消息中
- **本文与验收标准的对应**：验收项「调研报告已沉淀为知识库文档，可通过『调研 / agent / mobius』相关标签检索到」由本文满足
- **相关知识文档**：《沉淀Web大逃杀技术方案与性能红线》《和平精英Web版两次开发复盘与串行开发规范》——文章B「WebGame 技术栈对 LLM 最友好」的判断与 MyRD 已有的和平精英 Web 实践相互印证
- **待补研**：目标描述中 3 个 mp.weixin 原始链接（其中之一为 Claude of Tanks，要点见第 1 节范围偏差声明）

## Sources

- [mobius-system/mobius](https://github.com/mobius-system/mobius)
- [网易多 Agent 与知识工程实践（InfoQ）](https://www.infoq.cn/article/psxyteixpjvwal89fmue)
- [腾讯云林哲：怎么用 AI Agent 开发小游戏（GameLook）](http://www.gamelook.com.cn/2026/06/595411/)
- [当 AI 开始重写小游戏生产流程（触乐/36氪）](https://m.36kr.com/p/3919432566779528)


## 沉淀AI女友剧情生存玩法设计基线

# 沉淀AI女友剧情生存玩法设计基线

> **依据**：需求《我被AI女友包围了》剧情生存挑战游戏需求（id=cmtob3m0p000pm9y6yl6yi1uq）＋ 游戏策划产物（id=cmtn5fhk20008jqck1thxilil）＋ 平台既有 Godot 工程约定（`games/godot-coin-rush`：六段式 GameDesignSpec / contract-check / verify.sh）＋ Godot 官方 Web 导出文档。
> **用途**：实现节点（开发/测试/部署）执行对齐的唯一设计基准。
> **冲突裁决规则**：需求硬约束 > 策划案原文（design-spec.md / design-spec.json）> 本文；发现偏差须回填本文（版本 +1）。
> **两条硬约束**：① godot headless 门禁 0 error 方可合并；② 构建产物必须在平台 AppHost 部署可启动、健康检查通过，禁止仅本地可跑的交付形态。

---

## 一、玩法定位与核心循环（AC1 落点）

**定位**：剧情驱动的生存挑战游戏。玩家扮演被多位 AI 女友包围的主角，通过对话抉择与状态管理在剧情推进中求生并走向多分支结局。

**核心循环（全项目唯一的循环定义，文案/实现/测试均以此表述为准）**：

```
剧情节点选择 → 好感度/威胁度/生存状态变化 → 触发后续剧情与结局分支 →（回到节点选择）
```

三条由循环直接推出的架构推论（策划案已确认，实现不得违背）：

1. **数据驱动**：人设卡、剧情节点、数值全部是 content JSON；逻辑只认 schema 与 `spec.numeric` 键名，不认具体角色与具体数值。
2. **可追溯**：每次结算写 trace，任何 AI 行为输出都能回放定位到 `persona_id` + 状态前后值。
3. **可验证**：验收一律落成契约测试断言（spec/persona/story/ending 四类 + smoke），不靠人工体感。

## 二、单一事实源：六段式 GameDesignSpec（平台既有工程约定）

- 落点 `.myrd/spec/design-spec.json`，六段：**meta / world / entities / levels / numeric / acceptance**。
- `entities[].script/scene`、`levels[].story_data`、`acceptance[].check` **声明的路径必须真实建出**，契约测试校验落点存在性。
- 数值只认 `spec.numeric`，键名与未来 `game_state.gd` 字段一一对应——改数值=改表，不改码。
- 策划案已交付内容（9 个内容 JSON + 2 份文档）：schema 契约 1 份 + 5 张人设卡 + 3 幕剧情（= 9 个 JSON），另有六段式 `design-spec.json` 与人读版 `design-spec.md`（含数值表、两条链路逐步演算、美术基线）。**策划阶段未产 Godot 代码，实现节点按 spec 施工。**

## 三、AI女友人设卡基线（AC2 落点）

- **schema 契约**：`games/ai-girlfriend-siege/data/schema/persona.schema.json`，**9 个必填字段**，覆盖并超出需求的 5 字段（姓名 / 性格标签 / 说话风格 / 好感度规则 / 威胁·危机行为模式）。
- **5 张基线人设卡**（`data/personas/persona-{lumi,vex,ada,momo,sera}.json`）：治愈 / 病娇 / 冷静 / 活泼 / 神秘 五型；字段含主题色、口头禅、`favor_rules`、`threat_rules`、`portrait_prompt`。
- **美术单一事实源**：立绘/形象资产只从 `portrait_prompt` 派生，禁止另行脑补设定——防止多 agent 并行产出美术与文案漂移。
- **解耦铁律**：`persona_loader` 只认 schema 不认具体角色 → **改人设卡免改码**。验收手段 = swap 测试（替换某张卡 JSON、零代码改动，门禁仍过且行为变化）。
- **可追溯格式**：`story_engine` 每次结算写 trace：`node_id / option_id / persona_id / favor·threat 前值与后值`，回放可定位到具体人设与状态。

## 四、剧情幕结构与结局分支（AC3 落点）

- **三幕骨架「包围 → 裂痕 → 倒计时」**：`data/story/act{1,2,3}.json`，共 **18 个节点**，节点图闭合无死链。
- 节点 / 选项 / 数值效果**全部显式声明**；effects 用声明式键值（Δfavor/Δthreat/flag/goto），**禁止节点内嵌脚本逻辑**——嵌逻辑即破坏可追溯与换卡免改码。
- **4 个结局**；其中 **2 条已逐步演算、可复现的可玩链路**（满足"至少 2 个不同结局"验收）：
  - **链路 A → 独活结局**：全程威胁累积 Σthreat 控制在幕级上限（<300）内，终局选逃跑；
  - **链路 B → 带走 Lumi 结局**：Lumi favor 终值 96 ≥ 70，且 threat 30 ≤ 60。
- 结局判定阈值基线（策划案演算使用值）：**favor 结局门槛 ≥70；单人 threat 结局门槛 ≤60；幕级 Σthreat 上限 300**。
- 结局判定由 `ending_contract.gd` 断言（对应 acceptance acc-5/acc-6）；冒烟测试用脚本驱动固定选择序列，跑出 ≥2 个不同结局即 AC3 达成。

## 五、生存循环与数值规则

- 状态三轴：**favor（好感度）/ threat（威胁度）/ 生存状态**；具体生存轴与衰减公式以 `spec.numeric` 为准，键名与 `game_state.gd` 一一对应。
- 每次选择的标准结算链：选项 effects 声明 Δ 值 → story_engine 结算 → trace 落账 → 门控判断下一节点/结局。
- 数值调优只改 `spec.numeric` 与人设卡 `favor_rules/threat_rules`，**任何数值调优不允许以改代码的方式实现**。

## 六、godot 门禁与 CI（AC4 落点）

**门禁三件套（全部 headless，0 error 才可合并；CI 拒绝含错误代码的提交）**：

1. **preflight**：环境与引擎版本预检；
2. **`godot --headless --import`**：资源导入完整性（坏资源/坏路径在此暴露）；
3. **smoke**：headless 跑冒烟 + 契约测试（spec / persona / story / ending 四件，先例即 `games/godot-coin-rush` 的 `contract-check.mjs` + `verify.sh` 模式）。

附加门禁规则：spec 中声明的落点（entities script/scene、levels story_data、acceptance check）必须真实存在；persona/story JSON 过 schema 校验，坏配置 = 门禁失败（让 AC2 的"≥5 字段结构化"变成机器可验证，而不是评审口径）。

## 七、Web 导出与 AppHost 部署规范（AC5 落点）

**引擎事实（Godot 官方文档，已核实）**：
- Godot 4.3 起，**单线程 Web 导出是官方默认推荐路线**：无需跨域隔离响应头、兼容性最好；
- 开启线程支持（SharedArrayBuffer）则硬性要求：HTTPS 安全上下文 + `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`。

**项目裁决规则**：
1. **默认锁单线程导出**；仅当 AppHost 可注入自定义响应头且走 HTTPS 时，才允许评估线程模式。
2. `.wasm` 必须 `application/wasm` MIME；index.html / wasm / pck 同源部署。
3. 体积与首屏预算：剧情游戏静态资源大头是**中文字体与立绘**——中文字体必须子集化；具体体积/首屏红线由实现节点导出实测后回填本文（不在无实测数据时空定数值）。
4. **健康检查**：交付包内置静态 `/healthz`（200 + `{status:"ok",version}`）；部署后 AppHost 探活通过 + 浏览器冒烟（canvas 出现、console 无 error）。
5. PWA service worker 可官方模拟 COOP/COEP，但增加缓存失效复杂度，AppHost 场景**默认不启用**。
6. 禁止 desktop-only / 仅本地可跑形态；未过健康检查的构建不得标记完成。

## 八、目录结构与依赖方向（CI 强制）

```
games/ai-girlfriend-siege/
  data/schema/persona.schema.json      # 契约：人设卡字段
  data/personas/persona-{lumi,vex,ada,momo,sera}.json
  data/story/act{1,2,3}.json           # 三幕节点图
  design/design-spec.md                # 人读版：数值表+链路演算+美术基线
.myrd/spec/design-spec.json            # 六段式单一事实源
```

依赖方向：`persona_loader` 只依赖 schema；`story_engine` 只依赖 `spec.numeric` 键名与 act JSON；UI 只读状态与事件流；**任何 .gd 禁止硬编码角色名或数值**（出现即 lint/评审打回）。

## 九、验收标准映射（AC → 基线落点）

| AC | 验收点 | 基线落点 | 自动化手段 |
|---|---|---|---|
| AC1 | 玩法定位+核心循环经评审确认 | §一 循环唯一表述 | spec 契约测试 |
| AC2 | 人设卡 ≥5 字段、改卡免改码 | §三 schema 9 必填字段 + swap 测试 | persona 契约测试 |
| AC3 | ≥1 条链路复现 ≥2 结局 | §四 4 结局 + 2 条已演算链路 | ending 契约 + smoke |
| AC4 | godot 门禁 CI 生效、错误提交被拒 | §六 三件套 0 error | CI 拒绝合并验证 |
| AC5 | AppHost 部署可启动 + 健康检查通过 | §七 单线程导出 + /healthz + 冒烟 | 部署核对（策划案 acc-12 同为人工核对项）|

策划案共 12 条 acceptance，其中 10 条已配可执行检查（spec/persona/story/ending 四契约 + smoke）；实现节点不得降低已配检查的覆盖面。

## 十、执行经验与 DO NOT（本次目标执行沉淀）

**有效的做法**：
- 策划阶段就把验收配成可执行检查（12 条中 10 条可自动断言）——这是实现节点不返工的关键，印证调研结论「验收回路是一等公民」「知识先于生成」。
- 文案、美术、数值全部从单一事实源派生（portrait_prompt / spec.numeric），多 agent 并行也不漂移。
- 自检抓到链路演算中的「带问号模糊值」并修正为精确终值——**数值表述必须可判定，禁止"约/大概/左右"**。

**DO NOT（违反即打回）**：
- 禁止把人设写进 .gd 代码或节点属性（AC2 直接失败）；
- 禁止节点 effects 内嵌脚本/表达式求值逻辑（破坏可追溯与换卡免改码）；
- 禁止绕过 godot headless 门禁合入主干；
- 禁止交付 desktop-only / 仅本地可跑形态；
- 禁止在策划与配置文档中使用不可判定的数值表述。

## 十一、待核实与回填项（实现节点开工前处理）

1. **数值终值比对**：链路终值在策划执行过程播报中出现过一次修订（如链路 A Σthreat 曾出现 225/210/220 等中间口径），**以 design-spec.md 演算表终值为准**；工作区产物未推送远端分支，实现节点重建文件时须逐值核对并回填本文。
2. **AppHost 能力核实**：是否支持自定义响应头与 HTTPS —— 决定线程模式可行性；不支持则永久锁单线程导出。
3. **实测回填**：Web 导出体积（wasm/pck）与首屏加载时间，导出后实测回填 §七。
4. **生存轴定义**：体力/理智类生存状态的具体轴与衰减公式以 `spec.numeric` 为准，本文不预设定。

---

*版本 v1.0 ｜ 2026-09-05 ｜ 目标管理大师固化。依据：需求 id=cmtob3m0p000pm9y6yl6yi1uq、策划案产物 id=cmtn5fhk20008jqck1thxilil、平台 Godot 工程约定（games/godot-coin-rush）、Godot 官方导出文档。*



---

# 配图验证产品

测试配图和 landing 渲染


## 关联项目

### 心伴 [frontend / backend]

项目名: 心伴
描述: ai 情绪陪伴
类型: mobile
GitHub: https://github.com/hl3w22bupt/odbo
工作流类型: cmqc71gii0005m9uni8nwb6j3

### MyRD Playground [mobile]

项目名: MyRD Playground
描述: MyRD 功能测试和沙盒环境
类型: web-app
GitHub: https://github.com/hl3w22bupt/myrd-playground.git
工作流类型: cmqc5q1ne0005m98t740g0eh9


---


## 产品关联知识

## 项目开发规范

# 项目开发规范

## 代码风格
- 使用 TypeScript
- - 遵循 ESLint 规范
- 提交前运行 lint 检查

## Git 提交规范
- 使用 Conventional Commits 格式
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新

## Agent 执行轨迹（agent_execution_trajectories）孤儿 running 记录：诊断、根因与自愈处置手册

# Agent 执行轨迹（agent_execution_trajectories）孤儿 running 记录：诊断、根因与自愈处置手册

## 背景
平台中所有 Agent 执行（channel 频道消息、express_lane 直通车、workflow 内 agent 节点、exploration、secretary、onboarding 等）都会写入一条 agentExecutionTrajectory 轨迹记录，采用 create-then-finalize 生命周期：

- 创建时（createAgentTrajectory）写入 `status='running'`；
- Agent 执行正常结束时（final 事件 / 流自然结束），pipeline 返回路径将 status 置为 `completed`；
- 异常被 catch 时置为 `failed`，并回填 outputPreview / error / durationMs / completedAt。

Claude 子进程层存在 10 分钟默认超时（SIGTERM → 10s 后 SIGKILL）。

`agent_execution_trajectories` 表是所有 Agent 执行的基础数据源，也是进化分析（evidence mining）的关键证据来源，轨迹数据质量直接影响进化证据统计与状态判定。平台 Worker 启动时运行一整套自愈（auto-heal）机制，但当前对轨迹记录存在覆盖盲区。

## 现象
增量时间窗内观测到 7 条轨迹全部停留 `status='running'`，且错误为空、输出摘要为空，覆盖执行类型与角色：

- **channel**：PD-Agent、Architect-Agent、开发者；
- **workflow**：「把 HTML 原型转成生产级 React Native 前端（先发 Android）」frontend 节点、「创建 PR（基于实际变更）」create-pr 节点；
- **express_lane**：Express Agent ×2。

共同特征：记录创建后从未被 finalize，既无 error，也无任何中间输出（outputPreview=NULL），从数据上完全看不出是否还在推进。

影响：
- 轨迹表被孤儿记录污染，进化分析（evidence mining）统计失真（running 状态混入失败/完成判定）；
- 轨迹模型没有 timeout / expiration 字段，理论上可无限 running；
- 与「真正仍在运行但尚无输出」的合法长任务无法从数据上区分。

## 根因
1. **轨迹完结依赖进程内 pipeline 的返回路径**。超时/取消逻辑全部在 Worker 进程内存中（startTimer + activePipelines 注册表）。Worker 被重启（挂起检测触发自动重启、OOM、部署）时，内存定时器与注册表一并丢失，正在执行的轨迹失去 finalize 触发点，永远不会被置为终态。
2. **自愈覆盖盲区**。平台启动自愈覆盖了 workflowRun（autoHealStaleRuns→paused）、expressLaneRun（→failed，error='执行中断（Worker 重启）'）、channel_messages 的 streaming 占位消息（>10 分钟清理 streaming 标记）、agent busy 状态（→idle）、goal 执行（resumeStuckGoalExecutions）、vibe workspace（小时级清理），但**不覆盖 agentExecutionTrajectory 本身**（代码中 grep 零引用），轨迹成为永久孤儿。
3. **自愈仅在启动时执行一次**，运行期没有周期性僵死检测。
4. **finalize 无重试**。finalizeAgentTrajectory 内部 try-catch 仅记录日志：若 finalize 本身失败，轨迹不会再次尝试落终态。
5. **长任务与死执行不可区分**。长时间无任何输出的运行（git/gh 等待交互输入、依赖安装卡住、构建/推送阻塞、模型侧无响应）也不会产生 outputPreview，与死执行在数据上表现完全一致，无法仅靠「有无输出」判定。

## 处置
### 1. 定位滞留轨迹
```sql
SELECT id, agent_type, agent_name, status, created_at,
       (now() - created_at) AS age, output_length, error
FROM agent_execution_trajectories
WHERE status = 'running' AND created_at < now() - interval '30 minutes'
ORDER BY created_at;
```
也可按更新时间检索并补充更多诊断字段：
```sql
SELECT id, agent_type, status, "createdAt", "updatedAt", output_preview, error, metadata
FROM agent_execution_trajectories
WHERE status = 'running' AND "updatedAt" < now() - interval '30 minutes'
ORDER BY "updatedAt";
```
重点看 output_length IS NULL/0 的记录——无输出即无进展。

### 2. 区分「假 running」与「真僵尸」
- 检查对应 Worker / 子进程是否存活；
- 观察 updatedAt 是否仍在刷新；
- 若不再变化且无输出，判定为孤儿。

### 3. 按类型处置
- **workflow 节点**：查关联 workflow_run 的 status。若 run 也卡住，启动自愈会将其置为 paused（节点重置为 pending），可手动 resume；轨迹需同步标记 failed 并注明原因。
- **express_lane**：expressLaneRun 启动自愈已标记 failed（error='执行中断（Worker 重启）'）；确认轨迹同步标记 failed。worktree 现场保留在 `$WORKSPACE_ROOT/<projectId>/run-express-<taskId>`，可手动补收尾后「续跑」。
- **channel**：启动自愈会清理 streaming=true 且超过 10 分钟的 channel_messages 占位消息（content 置为「(Agent 异常中断 — Worker 重启)」）；轨迹需同步标记 failed。

### 4. 检查僵尸子进程
```bash
ps aux | grep -E 'claude (-p |--print)' | grep -v grep
```
对照轨迹的 worktree / session_id / prompt_preview 定位残留进程，确认无活动输出后 kill（SIGTERM → 10 秒后 SIGKILL）。

### 5. 清理孤立 worktree
确认无活动执行引用后，用 `git worktree remove --force` 删除 `$WORKSPACE_ROOT/<projectId>/run-*` 下对应目录。

### 6. 批量修复（谨慎）
先人工确认无关联的活动中执行，避免误杀：
```sql
UPDATE agent_execution_trajectories
SET status = 'failed',
    error = '执行中断（僵死自愈：无进展超时）',
    completed_at = now()
WHERE status = 'running' AND created_at < now() - interval '30 minutes';
```
保留 inputs / metadata 以便复盘，避免误判为进行中或计入成功统计。

### 7. 复盘
把轨迹 id 关联到 workflow run / express lane / channel 会话，判断是「提示词缺执行纪律」还是「编排层 finalize 缺失」。

## 预防
- **轨迹有界生命周期 + 僵死自愈**：轨迹必须有硬上界与回收任务（启动时 + 每小时周期检测）。
- **所有执行路径必须输出中间进度**，避免「运行中但零输出」。
- **新增执行环节（新 agentType）时**，必须补齐完结路径与自愈覆盖，并把 agentExecutionTrajectory 纳入与 workflowRun / expressLaneRun 同级的启动自愈清单。
- **Agent 提示词层**：要求有界执行（见《Workflow Agent 节点执行纪律规范》），确保任何路径都能 finalize。
- **记录层**：为轨迹增加 timeout / expiration 字段与「心跳刷新」机制，长期无心跳即可判定可回收；监控 running 超过阈值（如 30 分钟）的记录。
- **Worker 重启流程**中补充 trajectory 清理步骤。

## 情绪陪伴 App 产品调研框架

## 情绪陪伴 App 产品调研分析框架

### 背景
MyRD Admin 提出设计一款以"情绪价值"为核心的陪伴类 App，并引入游戏化交互机制。PD-Agent 就此进行了系统性调研分析。

### 市场与竞品分析
- **现有格局**：冥想类（Headspace、Calm）、日记记录类（Daylio）、虚拟陪伴类（Replika、Character.AI）App 已在市场存在，但多数偏"工具属性"，缺乏有深度的互动体验
- **差异化机会**：游戏化交互是关键的破局点，将情绪调节转化为"养成类 RPG"或"模拟经营"式体验

### 用户需求画像
- **目标人群**：Z 世代及年轻职场人，面临孤独感或高压，排斥传统说教式心理咨询
- **核心诉求**："被理解"、"被陪伴"以及"低压力的情绪宣泄口"，而非"治疗"

### 游戏化交互机制（核心差异化）
- **情绪映射**：将用户抽象情绪（文字、语音、表情）转化为游戏内数值或视觉反馈
  - 示例：用户开心时虚拟家园天气变晴；用户焦虑时出现需要安抚的小怪兽
- **正向反馈循环**：通过"情绪打卡"或"互助任务"解锁装扮、剧情或虚拟互动
- **方向待定**：AI 虚拟伴侣养成 vs 个人情绪花园经营

### 技术可行性
- 涉及 NLP 自然语言处理进行情绪识别
- 高保真游戏化 UI/UX 设计
- 通用技术选型方向待进一步确定

### 伦理与合规风险
- 需明确界定"陪伴"与"心理咨询"的边界
- 避免用户过度依赖及潜在法律风险

### 商业模式探讨
- 订阅制 / 内购制 / 广告变现 待评估

### 后续调研方向
1. 竞品深度拆解：挑选 2-3 款 AI 聊天+游戏元素的应用进行分析
2. MVP 核心功能定义
3. 商业模式确定

## MyRD 平台真实仓库结构地图、文档/技能入口与常见路径陷阱

# MyRD 平台真实仓库结构地图、文档/技能入口与常见路径陷阱

## 背景
agent 在涉及 MyRD 平台的任务中反复出现两类高成本问题：

1. **文档/技能入口定位失败**：任务开始时多次通过 glob 搜索 `**/myrd*/**/SKILL.md`、`**/myrd-platform-skill*` 等模式均返回 0 命中，误判平台「为云端平台、本地无文档」（#18283），或技能未在预期目录找到（#18123），随后不得不多轮读取源码与文档才定位入口（#18282-18293）。myrd-platform-skill 是 agent 理解平台的标准入口（最近 14 天调用 4 次），但 agent 本地环境无法直接命中其正文，造成重复勘察，agent 花费约十余次观测重复勘察结构。
2. **引用不存在的文件路径**：多会话（#18282-18293、#18596-18617）反复手工翻查源码才能定位平台结构，且 #18616/#18617 实证发现提案引用了不存在的 `frontend/lib/services/*` 与 `myagent-client.ts` 路径，导致提案被驳回、评审周期浪费。

根因在于「文档与实际源码结构不一致」——仓库（典型根目录 `/Users/leo/workspace/myrd`）存在源码与编译产物并存、文档过时等问题。本文档给出经源码核实的真实入口、真实结构地图及高频错误路径，供涉及 MyRD 内部实现的任务直接使用，消除重复探索并防止错误路径再次出现，显著降低后续任务冷启动成本。

## 关键入口（权威文档与技能）
- **平台使用说明书（权威）**：`/Users/leo/workspace/myrd/docs/myrd-platform-skill.md`。注意：位于源码仓库 `docs/` 下，而非 `~/.claude/skills/`。内容覆盖：服务地址、JWT 认证、全部 API 分类、典型示例、数据模型、边界情况，并含平台进化系统架构说明。
- **快速开始**：`/Users/leo/workspace/myrd/docs/guides/quick-start.md`（环境搭建 → 服务启动 → 注册 → 建项目 → 跑工作流）。
- **工作流集成/部署状态**：`/Users/leo/workspace/myrd/WORKFLOW_INTEGRATION.md`、`/Users/leo/workspace/myrd/MYRD_SETUP_STATUS.md`。
- **数据库 schema**：`/Users/leo/workspace/myrd/prisma/schema.prisma`（含 `AgentExecutionTrajectory` 模型，表名 `agent_execution_trajectories`）。

## 真实结构（经源码核实）
- **入口与自愈**：`src/index.ts`（worker 启动时执行 auto-heal，覆盖 WorkflowRun / ExpressLaneRun / channel_messages / agent status / goals / vibe workspace，**不含** agentExecutionTrajectory）。
- **工作流引擎**：`src/services/workflow/engine.ts`（约 2626 行；含 `resume()` 约 443 行、`iterateFrom()` 约 784 行、`rerunFrom()`、`rollbackToCheckpoint()`、`sharedSetupProjectWorkspace()`；支持 DAG 执行 / 自愈 / 重试 / git checkpoint）。
- **Coding-agent 实现**：`src/services/coding-agent/{claude-code-agent.ts, local-claude-agent.ts, remote-agent.ts, types.ts}`（其中 `claude-code-agent.ts` 含 10 分钟默认超时与进程清理逻辑）。
- **进化系统服务**：`src/services/evolution/`（analyzer 等模块；支撑证据系统三类数据源、证据挖掘策略）。
- **路由**：`src/routes/workflows.ts` 等。
- **前端真实源码**：`frontend/` 目录存在，含 `app/` 与 `components/` 源码，如 `frontend/app/(dashboard)/projects/new/page.tsx`、`frontend/components/projects/run-workflow-button.tsx`。
- **编译产物（非源码）**：`src/dist/`——仅含编译后声明/产物（如 `src/dist/lib/myagent-client.d.ts`、`src/dist/services/coding-agent/myagent-agent.d.ts`），**不是源码**。

## 服务端口
前端 :3001、后端 API :3111、streaming :4112、MyAgent :3000、数据库 :5432。

## 高频错误路径（不存在，务必避免）
| 常见错误引用 | 真实对应 |
|---|---|
| `frontend/lib/services/workflow/engine.ts` | `src/services/workflow/engine.ts` |
| `frontend/lib/services/coding-agent/claude-code-agent.ts` | `src/services/coding-agent/claude-code-agent.ts` |
| `myagent-client.ts`（作为源码） | 无此源码；仅有编译声明 `src/dist/lib/myagent-client.d.ts` |
| 认为前端目录含业务服务代码 | `frontend/` 主要被 `node_modules` 占据；业务服务在 `src/services/` |

## 根因
1. 文档（含 `docs/guides/quick-start.md`）描述的结构与实际仓库不一致或已过时；
2. agent 凭记忆/推测引用路径，未做存在性核实；
3. `src/` 与 `src/dist/` 并存，把编译产物误当源码。

## 处置（核实方法）
- 引用任何路径前，先用 glob/grep 在仓库根目录确认文件存在；
- 区分 `src/`（源码）与 `src/dist/`（编译产物），引用源码一律指向 `src/`；
- 工作流引擎、coding-agent、evolution 等业务服务一律在 `src/services/` 下，不在 `frontend/lib/` 下；
- 「文件不存在」的判断以 glob 返回空为唯一依据，不要依据记忆或文档；
- 分析轨迹/进化数据时，直接读 `agent_execution_trajectories` 表与 `prisma/schema.prisma` 的 `AgentExecutionTrajectory` 模型，不要靠源码 glob 反推。

## 预防
- 涉及 MyRD 内部实现的提案/文档，落笔前对每个文件路径做一次 glob 核实；
- 平台是本地源码 + 多 run 工作区（`/Users/leo/.myrd/workspaces/proj-myrd/run-*`）并存；run 工作区可能包含主干尚未合入的功能（如 express-lane、轨迹追踪迁移），分析时以对应 run 工作区为准；
- 本文档随仓库结构变更应同步更新。

## 架构设计文档

# 架构设计

## 技术栈
- 前端：Next.js + React + TypeScript
- 后端：Motia (iii 引擎)
- 数据库：PostgreSQL + Prisma

## 模块划分
- 项目管理模块
- 任务管理模块
- 知识库模块

## 需求池功能说明

# 需求池功能

## 功能说明
需求池用于管理产品需求、Bug 修复、功能改进等任务。

## 状态流转
- backlog: 待办需求
- todo: 已计划
- in-progress: 进行中
- review: 评审中
- done: 已完成
- archived: 已归档

## 沉淀Web大逃杀技术方案与性能红线

# 沉淀Web大逃杀技术方案与性能红线

> 来源：《和平精英Web版》架构Agent技术方案（PR #8，产物 id=cmos298dg0001m9mxandnum2z，repo hl3w22bupt/myrd-playground）
> 需求基线：《「和平精英Web版」核心玩法需求（跳伞/拾取/射击/缩圈/AI 对抗）》（id=cmtfyd7uc000im9hapib6ann3）
> 用途：**开发节点（M0~M7）执行对齐的唯一技术基准**。本文所有数值均为架构评审结论，实现时落入 `content/` 配置表由测试断言，禁止硬编码、禁止擅自更改。

---

## 一、引擎选型结论（ADR-001/002/007/008）

**最终选型：Three.js r185 + Vite 7 + TypeScript 5.9.x + 零后端静态部署。**

### 1.1 为什么是 Three.js（候选对比结论）

| 维度 | Three.js r185 ✅ | Babylon.js | PlayCanvas | Unity WebGL |
|---|---|---|---|---|
| 核心体积（gz 约量级） | ~170KB | ~1MB+ | ~1MB | 10~40MB（含 wasm 堆） |
| 首屏可交互（红线 ≤5s） | 最优 | 良好 | 良好 | 难达标 |
| TS 类型 | 官方自带 | 官方维护 | 部分 | 生成式，质量一般 |
| 玩法逻辑自由度 | 最高 | 高 | 受编辑器约束 | C# 工具链负担 |

落选核心逻辑：本项目的核心工作量在**玩法仿真**（跳伞四阶段/弹道结算/缩圈几何/AI 行为），不在渲染管线。引擎越"全"（内置物理/GUI/场景序列化），越容易把逻辑写进引擎回调，破坏"仿真与表现分离"主决策；Unity WebGL 的 10~40MB 加载直接违反首屏 ≤5s 红线。Three.js 生态与问题检索量最大，上手成本最低。

### 1.2 配套选型（配套 ADR）

| 决策 | 结论 | 一句话理由 |
|---|---|---|
| ADR-002 物理碰撞 | **自研**（高度场采样 + AABB + 射线检测，约 300 行） | 本期碰撞仅三类需求；零 wasm 加载复杂度；完全确定性。不支持刚体堆叠，二期载具预留接口 |
| ADR-003 时间步进 | **fixed timestep 50Hz + rAF 可变渲染 + 插值** | AC2 落点可复现的硬前提；可变 dt 无法保证 |
| ADR-004 实体组织 | **ECS-lite**（轻量结构化实体 + 系统函数） | 实体上限 20，bitecs 等重型 ECS 无收益 |
| ADR-005 UI 方案 | React 19（低频菜单/背包/结算）+ 原生 DOM/Canvas2D 直写（高频 HUD/小地图） | React 重渲染不适合每帧更新 |
| ADR-006 AI 决策 | **有限状态机 FSM + 分帧更新**，不做行为树/GOAP | 需求仅 5 类行为，FSM 足够 |
| ADR-007 TS 版本 | 锁 **5.9.x**，不上 TS 7（native preview） | npm 最新 7.0.2 为 Go 原生移植，工具链未稳 |
| ADR-008 构建 | Vite（锁 7 稳定线）+ 零后端静态部署 | 纯前端无服务端依赖 |

### 1.3 引擎边界（防"引擎漂移"，CI lint 强制）

- 渲染层**只允许** import `three`；`render/` 目录之外出现 three import 即 lint error。
- 需自建渲染基建（每项 <150 行）：场景对象池、LOD 管理、阴影相机跟随、毒圈/弹道特效材质、调试 HUD 覆盖层。

---

## 二、场景设计结论（仿真与表现分离 + 确定性架构）

### 2.1 总体架构（最重要的一条决策）

玩法逻辑全部运行在**无 DOM 依赖的确定性仿真核心**中，Three.js 只做「快照 → 场景对象」映射，UI 只读事件流。分层自下而上：

```
UI 层（React 低频） + HUD/小地图（DOM/Canvas2D 高频直写）
        ↑ GameEvent 事件流
表现层 render/（Three.js r185）：场景·资源·LOD·相机·特效·对象池
        ↑ 每 rAF 只读 WorldSnapshot
仿真核心 core/（纯 TS，零 DOM 依赖，Node 可直接运行）
        fixed tick 50Hz · seeded RNG · ECS-lite
        ↑ PlayerIntent 指令流
输入层 input/ ＋ 内容层 content/（配置表 JSON）
```

三条关键推论：
1. **仿真核心不 import Three.js** → AC2/AC3/AC4/AC5 可在 Node + Vitest 中直接跑满局自动化断言（这是整个测试策略成立的前提）。
2. 渲染层崩溃/加载失败不推进仿真状态；渲染层可整体降级为占位几何。
3. UI 只消费事件，不回写仿真状态，杜绝 UI 驱动逻辑。

### 2.2 目录结构与依赖方向（CI 强制，违反即 lint error）

| 模块 | 可依赖 | 禁止依赖 |
|---|---|---|
| `core/`（loop/rng/world/events/systems） | `content` | `render` `ui` `input` `three` `react` |
| `content/`（weapons/loot/zone/map/constants） | — | 其他所有模块 |
| `render/` | `core` 类型、`three`、`content` | `ui` |
| `input/` | `core` 类型 | `render` `ui` |
| `ui/` | `core` 类型与事件 | `core` 内部实现细节 |

### 2.3 双循环确定性模型（性能与可复现的骨架）

```
rAF 渲染循环（可变，浏览器驱动）
 ├─ 累积器 accumulator += dt
 ├─ while (accumulator >= 20ms && catchUp < 3) core.tick()   // 固定 50Hz
 ├─ catchUp ≥ 3 → 丢弃积压并告警（防死亡螺旋，宁降速不雪崩）
 ├─ renderer.render(scene, camera)
 └─ 渲染层用 alpha = accumulator/TICK_MS 做位置插值（消除 50Hz 抖动）
```

- 逻辑 tick **50Hz（20ms）**：射击/掉血精度足够（AC4/AC5 按秒结算），比 60Hz 省 17% 逻辑开销。
- 插值只做渲染层位置/朝向 lerp，**不插值逻辑状态**，保证回放与断言用纯逻辑状态。
- 确定性铁律：所有随机数来自 **seeded RNG**（xoshiro128\*\* 或 mulberry32），`Math.random()` 与 `tick()` 内 `Date.now()`、DOM 访问全部禁止（lint 层面强制，破坏禁令的 PR 直接打回）。
- 随机流隔离：跳伞气流/AI 行为/物资生成由同一 rng 流的不同**子流**驱动（`rng.fork('loot')` / `rng.fork('ai')`），避免行为改动影响物资分布。
- 回放协议免费获得：录制 `{seed, contentPackVersion, intents[]}` 落 JSON，同 seed 同意图序列必然逐帧一致——bug 复现与 AC2 断言共用此机制。

### 2.4 场景与对局规模参数

| 项 | 数值 | 说明 |
|---|---|---|
| 地图尺度 | **1.6km × 1.6km** | AC2 落点容差 5% = 80m |
| 地形 | 程序化高度场 + 区域划分（城区/野区） | 无真实地形资产 |
| 建筑 | AABB 占位体 | 配合分离轴碰撞（先 X 后 Z + 速度钳制） |
| 对局规模 | 玩家 1 + AI 10~19，实体上限 20 | N5 |
| 单局时长 | < 10 分钟自然结束（AC1） | 缩圈 6 阶段总时长约束保证 |
| 美术 | 程序化几何 + 免费低模占位 | 范围裁剪：不做骨骼动画/联网/账号，AC 全部为数值/流程验收 |

### 2.5 仿真系统与 tick 执行顺序（core/systems）

| 顺序 | System | 职责 |
|---|---|---|
| 1 | lifecycle | 对局状态机 lobby→parachuting→playing→ended；胜负判定（仅剩 1 存活） |
| 2 | parachute | 运输机航线、四阶段（自由落体→开伞→滑翔→落地）物理 |
| 3 | movement | 地面移动、高度采样、AABB 碰撞 |
| 4 | combat | 射击节流、弹道射线、命中判定（包围盒+部位+距离衰减）、换弹/切枪 |
| 5 | loot | 按区域密度生成、拾取判定、背包容量/丢弃、护甲减伤/医疗回血 |
| 6 | zone | 缩圈阶段表、圈心/半径插值收缩、圈外按秒掉血 |
| 7 | ai | FSM（patrol/loot/seek/fire/fleeZone/dead）+ 轮转分帧决策 |

**AI 与玩家共用同一套 PlayerIntent 与同一套 systems，AI 不走特权通道**——这条约束使"AI 也会被淘汰/也会避毒"天然成立，也让 AC4 命中率可用 AI 对 AI 对局复现验证。

核心契约（`MatchHandle`）：`tick(intents[])` 推进 / `snapshot()` 只读快照（渲染唯一数据源）/ `drainEvents()` 事件消费 / `status()` / `result()`（排名/淘汰数/用时）。

---

## 三、武器系统设计结论（AC3/AC4 数值基准）

### 3.1 WeaponDef schema（content/weapons.ts）

```ts
interface WeaponDef {
  id: WeaponId; category: 'ar' | 'smg';
  damage: number;        // 基础伤害
  rpm: number;           // 射速（发/分）
  magazine: number;      // 弹匣容量
  reloadMs: number;      // 换弹时间
  recoil: number;        // 后坐力系数 0..1
  effectiveRange: number;// 有效射程 m，超出伤害线性衰减至 50%
  spread: number;        // 散布 rad
  projectileSpeed: number; // 弹速 m/s（射线扫描命中判定）
}
```

### 3.2 双武器初始数值（彼此可区分是 AC4 验收点）

| 参数 | 步枪 `ar_m4` | 冲锋枪 `smg_ump` |
|---|---|---|
| damage | 26 | 18 |
| rpm | 620 | 850 |
| magazine | 30 | 25 |
| reloadMs | 2200 | 1800 |
| effectiveRange | 350m | 120m |
| recoil | 0.45 | 0.30 |

### 3.3 命中与伤害结算规则

- **部位倍率**：头 2.5 / 躯干 1.0 / 四肢 0.75；生命值归零即淘汰（cause: shot | zone）。
- **距离衰减**：超出 effectiveRange 后伤害线性衰减至 50%。
- **命中判定**：弹道射线扫描（projectileSpeed）+ 目标包围盒，静止目标有效射程内命中率 ≥90%（蒙特卡洛 1000 发自动化断言）。

### 3.4 物资与防具医疗数值（AC3 基准）

| 项 | 数值 |
|---|---|
| 护甲（躯干减伤） | 0.35 |
| 头盔（爆头减伤） | 0.5 |
| 医疗包 | +60 HP，使用 3000ms |
| 物资种类 | 武器/弹药/护甲/头盔/医疗包/投掷物，均带 gridCost 背包格占用 |
| 生成规则 | 按 zone 分区密度 + 权重池（LootTableDef），生成数量/种类必须与表断言一致 |
| 生效时机 | 拾取即生效：装备武器立即可射击、穿甲减伤、医疗回血 |

### 3.5 缩圈配置（AC5 基准，ZoneConfig）

- 首圈半径 **600m**，每阶段半径乘数 **0.65**，圈心随机偏移比例 0.4。
- 6 阶段圈外 dps：`[0.4, 0.8, 1.5, 2.5, 4, 6]`（逐阶段递增，验收断言点）。
- 等待/收缩秒：`[60/40, 50/35, 40/30, 35/25, 30/20, 25/15]`（合计 < 10 分钟，反推满足 AC1）。
- HUD 实时显示当前圈、下一圈轮廓与阶段倒计时。

---

## 四、60FPS 性能红线（超预算即视为性能缺陷）

### 4.1 硬红线指标（N1/N4 推导，验收工具：调试 HUD）

| 预算项 | 目标值 | 硬上限 | 红线含义 |
|---|---|---|---|
| 帧率 | 桌面 **60 FPS**；移动 ≥30 FPS | — | N4，M0 DoD 即要求空对局 60FPS 稳定 |
| 单帧 draw calls | < 120 | **150** | 超 150 判性能缺陷 |
| 单帧三角形 | < 400k | **800k** | — |
| 逻辑 tick 单帧耗时 | < 3ms | **8ms**（超限告警） | tick 超时会挤压渲染预算 |
| 首包 JS（gz） | < 800KB | **1.2MB** | 支撑 N1 首屏可交互 ≤5s |
| 纹理内存 | < 200MB | **400MB** | — |
| 首屏可交互 | ≤ 5s（桌面宽带） | — | N1，免安装定位的底线 |

### 4.2 画质三档定义（Medium 为默认）

| 参数 | Low | Medium（默认） | High |
|---|---|---|---|
| 像素比 | min(dpr,1)×0.75 | min(dpr,1) | min(dpr,2) |
| 阴影 | 关闭 | 1 级跟随相机 1024 | 2048 + 更远投影 |
| 视距/雾 | 300m 雾浓 | 600m | 1200m |
| LOD 切换距离 | 收紧 50% | 基准 | 放宽 30% |
| 植被/物资实例化密度 | 40% | 100% | 100% |
| 反锯齿 | 关 | 关（像素比补偿） | MSAA×4（WebGL2） |

默认档位：`navigator.userAgent` 粗分（移动→Low，桌面→Medium）；High 仅手动或设备探测通过后开启。

### 4.3 动态降档规则（render 层实现，与仿真无关）

- 采样窗口：每 **2 秒**计算平均 FPS 与 p95 帧时间。
- **降档**：连续 2 窗口 `FPS < 45` → 降一档（High→Medium→Low）；Low 后改为降分辨率 25%。
- **升档**：连续 5 窗口 `FPS > 58` → 升一档，每分钟至多一次（防抖动）。
- 每次档位变化写入调试 HUD 与 console，便于定位。

### 4.4 分帧与达标手段

- **AI 分帧**：决策每 tick 只更新 **1/4 实体**（轮转分片），感知与决策同频，移动每 tick 执行；单 tick 决策耗时预算 <3ms（M6 验收）。
- **毒圈掉血**：按秒结算（AC5 语义），tick 内累计时间再结算，不逐 tick 扣血。
- 渲染达标手段：地形/植被用 `InstancedMesh`；物资与建筑静态合批；阴影只投影主光；远处实体只更新朝向不更新动画。
- 兼容矩阵：桌面 Chrome/Edge/Safari/Firefox 完整；Android 中端机（≥4GB）Low/Medium ≥30FPS；iOS Safari Low/Medium（全屏/指针锁定需用户手势）；WebGL2 不可用直接降级提示页（不承诺 WebGL1）。
- 指针锁定（Pointer Lock）用于瞄准；Esc 退出后 UI 需提供"点击继续"重进。

### 4.5 可观测性（性能验收的测量工具）

内置调试 HUD（`?debug=1`，Release 默认关闭），M0 交付时必须可用：FPS/平均与 p95 帧时间/tick 耗时与漂移/draw calls/triangles/纹理内存/实体数/AI 状态分布/当前画质档与最近切换原因；支持 `?seed=123&replay=xxx` 固定种子与回放。

---

## 五、里程碑与执行对齐（开发节点照此排期）

```
M0 地基(0.5w) → M1 跳伞(1w) → M2 移动+地图(1w) → M3 物资(1w)
→ M4 射击(1w) → M5 缩圈(0.5w) → M6 AI(1w) → M7 闭环+调优(1w)   合计 ≈ 7 周
```

| 里程碑 | 关键交付 | 硬验收（DoD） | AC |
|---|---|---|---|
| M0 地基 | 50Hz 确定性循环、seeded RNG、事件总线、调试 HUD、CI + 依赖方向 lint | 空对局 60FPS；core 内 Math.random/Date.now 被 lint 禁止；HUD 可见 | — |
| M1 跳伞 | 四阶段跳伞、落点控制 | 同 seed 同输入落地坐标逐 tick 一致；落地 1s 内 state=ground；偏差 ≤80m | AC2 |
| M2 移动+地图 | 高度场、城区/野区、AABB 碰撞、第三人称相机 | 60FPS；不穿墙不穿地；draw calls<120 | — |
| M3 物资 | 密度生成、拾取、背包、防具医疗生效 | 生成符合权重表；数值与配置一致 | AC3 |
| M4 射击 | 武器表、弹道命中、部位/距离衰减 | 静止目标命中率 ≥90%（1000 发）；武器参数可区分 | AC4 |
| M5 缩圈 | 阶段表、插值收缩、按秒掉血、HUD 圈轮廓 | 各阶段参数与表一致且 dps 递增 | AC5 前半 |
| M6 AI | FSM 六状态、感知索敌、分帧 | AI ≥10；完成落地→拾取→交火→避毒路径；决策 <3ms | AC5 对抗 |
| M7 闭环 | 胜负结算、录制回放、降档、回归 | 10 局采样 100% 自然结束 ≤10min；性能预算全达标 | AC1 + AC5 胜负 |

依赖：M1→M2→M3→M4 串行；M5 仅依赖 M2 可与 M4 并行；M6 依赖 M3/M4/M5；M7 收口。每个里程碑必须以"可运行 + 可验收"结束，禁止跨里程碑堆叠未验证功能。

测试策略三层：**Node 仿真断言为主**（core 零 DOM → 无需浏览器、可进 CI、覆盖 AC2/3/4/5 全部数值）；Playwright 性能冒烟仅 M0/M2/M7 各一次（读 HUD 断言预算，不逐帧比对画面）；人工体验走查仅 M7。

---

## 六、风险红线与待核实事项（实现前必须确认）

| 风险 | 触发条件 | 对策 |
|---|---|---|
| 跳伞手感调不平（AC2） | M1 连续 3 天不收敛 | 空气阻力模型参数化（content 暴露 drag/glide）+ 落点预览圈 UI |
| AI 交火强弱失衡 → 单局时长失控 | M6 采样 >12min 或 <4min | AI 反应延迟/命中率/搜索半径进配置表，M7 十局采样调参 |
| 移动端帧率不达标 | 中端机 Medium <30FPS | 自动降档兜底；Low 档为硬底线（关阴影+降分辨率） |
| 自研碰撞穿墙/卡墙 | M2 冒烟出现 | 先 X 后 Z 分离轴 + 速度钳制；缺陷用回放文件复现 |

**M0 前必须核实的 3 项**（本文数值以官方文档/公开资料为据，非实测）：
1. Three.js 核心 gz 体积与真实首屏时间——用实际 `vite build` 产物复核并回填 4.1 的首包红线。
2. iOS Safari WebGL2 在目标最低机型上的表现——不达标则 iOS 锁 Low 档。
3. Pointer Lock 在平台预览 iframe 中的可用性——若被禁，降级"鼠标移动=视野"方案并记录。

## 七、二期演进预留（本期不做，只留边界）

- **多人联机**：`tick(intents)` 已解耦输入与状态，二期将本地输入替换为远端指令流（客户端预测 + 服务器权威），core 无需重写——这是确定性设计免费换来的关键预留；二期联机选状态同步，不依赖 lockstep（跨设备浮点一致性本期不承诺）。
- **载具/复杂物理**：movement system 内部可替换为 Rapier，对外仍走 PlayerIntent。
- **内容扩量**：content 配置表即内容管线，新增武器/物资/地图不改代码。
- **存档/战绩**：结构化 MatchResult 直接对接后端传输层。

---

*版本 v1.0 ｜ 2026-08-30 ｜ 依据 PR #8（commit ec48f16）架构方案固化；术语与规范以《「和平精英Web版」核心玩法需求》与本方案原文为准。*

## 沉淀知识：和平精英Web版两次开发失败复盘与pubg-web-core串行开发规范

# 沉淀知识：和平精英Web版两次开发失败复盘与pubg-web-core串行开发规范

> **适用功能线**：branchKey=`pubg-web-core`（和平精英Web版核心玩法）
> **版本**：v3（2026-08-31。演进：v1《小步串行开发与防超时规范》→ v2《串行小步开发规范与两轮失败复盘》→ v3 并入第三轮「换流程外壳仍失败」的实证与 Agent 兜底成功案例，固化**串行开发、禁止并行分支**红线）
> **权威技术基准**：《Web大逃杀技术方案与性能红线》（知识 id=6439fc3e-9217-4004-b091-aa79a6f9bcab）＋ 架构方案 PR #8（产物 id=cmos298dg0001m9mxandnum2z，repo hl3w22bupt/myrd-playground，Three.js r185 + Vite 7 + TS 5.9.x + 50Hz 确定性仿真核心 + seeded RNG）
> **需求基线（唯一需求来源）**：《和平精英Web版（pubg-web-core）收敛总需求：稳定60FPS+画面够看+核心玩法完整闭环》（id=cmtg6bxv6003ym9hav1sxej1e，branchKey=pubg-web-core）
> **用途**：约束本功能线所有开发节点的立项方式、分支策略、步长与门禁分级，固化三轮失败根因与已验证的补救路径，供后续迭代直接复用，防止同类失败重演。本规范管「怎么不掉链子」，技术基准文档管「怎么做对」。

---

## 一、三轮失败全景（开发类运行 9 次：7 败 2 成）

### 1.1 第一轮：全量口径（规范产生前）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 1 | 实现核心玩法（跳伞/拾取/射击/缩圈/AI 全量） | ❌ failed | cmtfz3zu70016m9ha4wldebwo | **单次任务过重**：5 大玩法模块塞进一个节点；且无独立需求基线 |
| 2 | 优化画面与流畅度 | ❌ failed | cmtfz6s9k001dm9hatl10qx9b | **目标混合**：画面表现 + 性能红线两类验收口径同节点，失败无法归因 |
| 3 | 实现最小可玩闭环（需求 id=cmtg05te2001zm9hamye40r6u） | ✅ completed | 见功能线运行记录 | 先立项收敛需求、边界明确、验收口径单一（正面样本） |

### 1.2 第二轮：小步口径（v1 规范执行后，3 步全败）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 4 | 第1小步·性能修复（稳定60FPS） | ❌ failed | cmtg2wvet002tm9hagm2awqhj | **空仓库起步** + **完整E2E门禁过重** |
| 5 | 第2小步·画面升级（材质光照雾效粒子+HUD） | ❌ failed | cmtg3pefz0034m9hahhlpy86p | 小步体量 × 全量门禁，单次运行预算失衡 |
| 6 | 第3小步·玩法补齐与缺陷修复（最终E2E+PR） | ❌ failed | cmtg5bzsp003jm9ha5876khnw | 同上，且前两步无合入成果可叠加，修复失去基线 |

（第 5、6 步之间插入一次成功的「代码审查」Agent 联合审查：审查前两步变更并输出缺陷清单，产物 id=cmst009ls000am9jmyk8ylfil —— 「轻实现 + 专项审查」组合是可行的补充通道。）

### 1.3 第三轮：换流程外壳（v2 规范执行后，仍败）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 7 | pubg-web-core 分支叠加「画质与60FPS性能优化」 | ❌ failed | cmtg8kgc3004zm9hawlb9kvxo | 双目标（性能+画面）混合 + 「实现+完整E2E门禁」整链仍压在单次运行 |
| 8 | 第1小步·性能修复（流程变体：开发测试→审查→人工确认→创建PR） | ❌ failed | cmtg6jkbc004am9hauxsfe20k | **流程外壳变了，预算约束没变**：仍要求单次运行装下 实现+全量门禁，且未先拉取既有实现 |

**第三轮结论（v3 新增）**：失败与「流程里有没有审查 / 人工确认环节」无关，与「单次运行预算能否装下 实现 + 门禁」有关。给同一摊子加环节只会更重，不会更稳。有效解法只有四个：收敛范围、拆小步、门禁分级、换执行通道（Agent 兜底）。

### 1.4 根因归纳（跨三轮稳定复现的 3 + 1 条）

1. **空仓库起步**：开发工作流未先 `git fetch origin pull/<PR号>/head:pr-<PR号>` 拉取既有实现（PR #8 架构 + 已合入的最小可玩闭环 + PR #9 补齐成果），在空仓库上从零重复搭地基，把宝贵的单次运行时长消耗在与本步目标无关的工作上。
2. **单次任务过重**：第一轮是「节点肥」（多模块/多口径混装）；第二、三轮节点已瘦，但「实现 + 全量门禁」整条链仍压在同一个单次运行里，链条总重没降。
3. **完整E2E门禁过重**：小步场景下「lint + 全量单测 + Node 全流程自动化断言 + 构建 + 冒烟」成本占比畸高，直接挤爆单次运行时间窗，是二、三轮连败的直接放大器。v2 已修订为门禁分级（见第三节规则 3）。
4. **只换流程外壳无效（v3 新增）**：第三轮改用含「审查 + 人工确认」的流程变体（run cmtg6jkbc004am9hauxsfe20k）依旧失败。诊断失败时先看三件事——仓库基线是否为空、单次运行装了哪些活、门禁多重——而不是流程叫什么名字。

---

## 二、补救路径（逐条标注验证状态）

| # | 动作 | 验证状态 | 证据 |
|---|---|---|---|
| 1 | **需求固化**：失败动作立为正式需求基线，目标不悬空 | ✅ 已验证 | 收敛总需求 id=cmtg6bxv6003ym9hav1sxej1e（branchKey=pubg-web-core，统一修正 `pubb-web-core` 笔误） |
| 2 | **收敛范围**：把大目标收敛为边界单一的最小可玩闭环 | ✅ 已验证 | 需求 id=cmtg05te2001zm9hamye40r6u → 对应 run completed（9 次开发运行中 2 次成功之一） |
| 3 | **同 branchKey 串行叠加**：后一步基于前一步已合入成果 | 📌 已固化为红线 | 第三节规则 1；本功能线后续节点一律复用 branchKey=pubg-web-core 串行执行 |
| 4 | **Agent 兜底**：工作流连续失败后由 @开发Agent 直接接管 | ✅ 已实证 | 「开发与测试Agent」检查分支产物、补齐缺失玩法与性能缺口并提 PR → completed，PR #9（产物 id=cmst009lq0009m9jmg3e4zh9l） |
| 5 | **审查前置**：先联合审查既有变更，输出缺陷清单再修 | ✅ 已实证 | 代码审查Agent 缺陷清单（产物 id=cmst009ls000am9jmyk8ylfil），修复步以其为输入，禁止盲修 |
| 6 | 仅更换流程外壳（增加审查/人工确认环节） | ❌ 已证伪 | 第三轮 run cmtg6jkbc004am9hauxsfe20k 含上述环节仍 failed |

---

## 三、硬性规则（v3 红线，违反即打回）

### 规则 1：branchKey 复用 + 单分支串行，严禁并行分支

- `pubg-web-core` 功能线的**所有开发节点必须复用 branchKey=pubg-web-core**，按需求 id 复核绑定后串行执行（检索绑定时注意历史需求存在 `pubb-web-core` 拼写笔误，一律以需求 id 为准）。
- **同一时间窗内本功能线只允许一个进行中的开发节点；严禁并行新开分支改同一批文件。**「pubg-web-core 必须串行开发、禁止并行分支」是本功能线的强制约定，不是建议。
- 后一节点必须基于前一节点**已合入**的成果（N-1 的 merge commit 是 N 的基线）；前一步未合入，后一步不得开工。
- 理由：并行分支 ① 同一批文件互相覆盖、合并冲突；② 没有已合入基线可叠加（第二轮第 3 小步失败的直接诱因之一）；③ 诱发空仓库起步，重复搭地基浪费单次运行预算。

### 规则 2：小步提交，每步只做一件事

- 每步目标在 **性能（performance）/ 画面（visual）/ 玩法（gameplay）** 三类中**三选一**，禁止混合；单步改动规模以「一次运行内能完成 实现 + 轻门禁」为上限。
- **开工前必须先考古**：`git fetch origin pull/<PR号>/head:pr-<PR号>` 核实既有实现（当前可复用：PR #8 架构、最小可玩闭环、PR #9 补齐成果），能复用就复用，**禁止空仓库起步**。
- 术语与数值只认权威技术基准（知识 id=6439fc3e-…），新数值落 `content/` 配置表并配测试断言，禁止硬编码。

### 规则 3：门禁分级（修订 v1 规则 3）

- **小步（实现步）→ 轻门禁**：lint + 本次改动相关单测 + 冒烟；不跑全量 Node 自动化断言。
- **收口步 → 完整 E2E 门禁（重门禁）**：lint + 全量单测 + Node 全流程自动化断言 + 构建 + 冒烟 + PR。
- **门禁预算前置**：开工前估算「实现 + 门禁」总耗时；预估超出单次运行预算就先拆步，不指望运行中途省时间。

### 规则 4：失败必须固化

- 任何 run_workflow 失败后，要么固化为需求基线（如收敛总需求 cmtg6bxv6003ym9hav1sxej1e），要么沉淀/更新为知识规范（即本文档）；不允许目标悬空后无人认领。

### 规则 5：连续失败切换执行通道（兜底阈值，v3 新增）

- **同一小步的 run_workflow 连续失败 ≥2 次 → 停止重试工作流**，改由 @开发Agent 直接接管该小步（考古既有实现 + 实现 + 轻门禁 + 提交/PR）；工作流通道留给收口与验证。
- 依据：第二轮 3 连败、第三轮 2 败期间，Agent 通道已实际交付 PR #9——兜底通道不是理论，是被验证过的交付路径。

---

## 四、推荐节点拆分（v3：拆分与门禁级别沿用 v2）

| 顺序 | 节点 | 目标类型 | 门禁级别 |
|---|---|---|---|
| P0 | 仿真核心骨架与确定性底座（50Hz fixed timestep + seeded RNG + ECS-lite + MatchHandle + 依赖方向 lint） | 玩法 | 轻门禁 |
| P1 | 3D 地图与移动碰撞（1.6km² 高度场、城区/野区、AABB 建筑） | 玩法 | 轻门禁 |
| P2 | 跳伞落地四阶段（航线 + 自由落体→开伞→滑翔→落地，落点可复现） | 玩法 | 轻门禁 |
| P3 | 物资拾取与背包（区域密度、容量/丢弃、护甲减伤/医疗回血） | 玩法 | 轻门禁 |
| P4 | 武器射击命中（ar_m4 / smg_ump、弹道射线 + 包围盒、部位/距离衰减） | 玩法 | 轻门禁 |
| P5 | 缩圈毒圈（≥3 阶段收缩、圈外按秒递增掉血、HUD 倒计时） | 玩法 | 轻门禁 |
| P6 | AI 敌人与胜负结算（≥10 AI FSM、共用 PlayerIntent、唯一存活者结算） | 玩法 | 轻门禁 |
| P7 | 性能优化（稳定60FPS、1% 最低帧、内存不泄漏） | **性能** | 轻门禁 |
| P8 | 画面表现提升（材质/光照/雾效/粒子/HUD） | **画面** | 轻门禁 |
| 收口 | 最终 E2E + PR（AC1–AC4 全量断言） | 混合验收 | **完整 E2E 门禁** |

排序原则：先玩法闭环（P0→P6 串行补齐），再性能（P7），再画面（P8），最后收口跑重门禁。任何节点失败只影响该节点，已合入成果不回退；P0–P8 期间禁止顺手做别的类型的事。

---

## 五、关联产物索引

| 类型 | id / 标识 | 说明 |
|---|---|---|
| 需求（第一轮基线） | cmtfyd7uc000im9hapib6ann3 | 「和平精英Web版」核心玩法需求（跳伞/拾取/射击/缩圈/AI 对抗） |
| 架构方案 | PR #8，产物 cmos298dg0001m9mxandnum2z | 技术选型与目录/依赖方向约定（repo hl3w22bupt/myrd-playground） |
| 知识（技术基准） | 6439fc3e-9217-4004-b091-aa79a6f9bcab | Web大逃杀技术方案与性能红线（数值唯一依据） |
| 需求（最小可玩闭环） | cmtg05te2001zm9hamye40r6u | branchKey 登记 `pubb-web-core`（笔误，绑定一律以需求 id 复核）；对应 run 成功 |
| 需求（收敛总需求，当前唯一来源） | cmtg6bxv6003ym9hav1sxej1e | 稳定60FPS + 画面够看 + 玩法完整闭环，branchKey=pubg-web-core |
| 失败 run（第一轮·全量口径） | cmtfz3zu70016m9ha4wldebwo / cmtfz6s9k001dm9hatl10qx9b | 单次任务过重 + 目标混合 |
| 失败 run（第二轮·小步口径） | cmtg2wvet002tm9hagm2awqhj / cmtg3pefz0034m9hahhlpy86p / cmtg5bzsp003jm9ha5876khnw | 空仓库起步 + 完整E2E门禁过重 |
| 失败 run（第三轮·换流程外壳） | cmtg8kgc3004zm9hawlb9kvxo / cmtg6jkbc004am9hauxsfe20k | 双目标混合 / 外壳变了预算没变 |
| Agent 兜底成果 | PR #9，产物 cmst009lq0009m9jmg3e4zh9l | 开发与测试Agent 补齐缺失玩法与性能缺口并提 PR（兜底通道实证） |
| 审查产物 | cmst009ls000am9jmyk8ylfil | 前两步变更联合审查缺陷清单（修复步输入，禁止盲修） |
| 知识（流程规范·本文档） | b44145e4-6dda-4f92-8741-e0c8bf3dc6b6 | v3：串行开发禁并行分支 + 三轮失败复盘 + 已验证补救路径 |

---

## 六、适用边界

- 本规范**强制适用于** `pubg-web-core` 功能线及其全部后续开发节点；新增玩法/优化项按第四节模式继续追加串行小步。
- 其他项目/功能线可参照**方法论**：branchKey 复用串行、单步单目标（性能/画面/玩法三选一）、门禁分级（小步轻、收口重）、开工先考古禁空仓库起步、审查前置、连续失败即切 Agent 兜底、失败即固化；节点拆分与 AC 划分按各自需求基线重划，不照抄 P0–P8 清单。
- 本规范与《Web大逃杀技术方案与性能红线》（6439fc3e-…）互补：那份管「怎么做对」，这份管「怎么不掉链子」。


## Agent 与 Agent 驱动游戏研发调研报告：Mobius 仓库 × 三篇文章设计对比与可借鉴点

> 沉淀自目标 DAG「mobius 调研 → 沉淀知识 → 方案设计 → 需求 → 开发」（goal `cmtmvs3u0000ejqjst3gc2cmf`）。本文对应调研节点产物 `cmsk2tgmn0000m9rrqdhia5nl`（产品及商业化军师产出），由目标管理大师于 2026-09-04 固化入库，供后续「方案设计 / 需求 / 开发」节点直接检索引用。

# Agent 与 Agent 驱动游戏研发调研报告：Mobius 仓库 × 三篇文章设计对比与可借鉴点

## 0. TL;DR（30 秒版）

- **Mobius 根本不是游戏项目**——它是通用「自进化 Agent OS」。它解决了「怎么组织多个 agent」，但对「游戏研发」这个领域零结构：整个仓库没有任何引擎、关卡、美术管线、玩法验证的痕迹。
- 三篇文章恰好补上领域那一半：网易证明「**知识先于生成**」；腾讯云给出「**结构化策划案 → 可玩原型 → 资产 → 引擎**」的领域管线；触乐证明「**开发不再是瓶颈，判断/验收才是**」。
- 第一结论：**通用组织能力（Mobius 已验证可行）+ 领域结构（三篇文章证明是价值所在）= 我们该做的东西。只抄任何一半都会死。**
- v1 最小闭环：结构化策划案 schema → 带 QA 互查的 Web 原型生成 → 可玩链接 + 人工验收 checklist；组织上用 1 首席 + 策划/程序/QA/美术四职能 + 共享黑板；知识层从三级 Skill/Memory 起步。引擎移植、自进化、数据回流全部留给后续版本。

## 1. 调研来源与范围

| 来源 | 类型 | 读完的部分 |
|---|---|---|
| mobius-system/mobius | 开源仓库 | README、文档总览、研究团队教程、技能/记忆机制教程 |
| 文章A：网易《游戏研发中的 AI 转型：多 Agent 系统与知识工程实践》（林香鑫，AICon 演讲） | 大厂中台视角 | InfoQ/公众号全文 |
| 文章B：腾讯云林哲《基于 AI Agent 的小游戏开发实践》 | 云厂商产品视角 | GameLook 专稿全文 |
| 文章C：触乐《当 AI 开始重写小游戏生产流程》 | 独立开发者+行业视角 | 36氪转载全文 |

**范围偏差声明（重要，后续节点必读）**：军师执行时未拿到目标描述中的 3 个 mp.weixin 原始链接，按「Agent 游戏研发」主题自选了上述三篇替代文章。目标原始链接之一经秘书预判为 **Claude of Tanks**（agent 驱动游戏研发标杆案例，要点：126 辆战车一份规格数据喂给所有消费端的单一数据源、确定性种子模拟、客户端提交输入/服务器裁定事实的权威仲裁架构、Tank Gallery/Scene Studio 内容检查工具、契约测试门槛）。后续「方案设计」节点若需覆盖原始链接来源，需对 Claude of Tanks 补研；本报告三大主线结论（组织 × 领域 × 验收）不受影响。

## 2. 四个研究对象的设计拆解

### 2.1 Mobius（mobius-system/mobius）

- **定位**：首个开源自进化 Agent OS。把模型、agent、项目、设备、算力连进一个工作网络，会随使用改写自身代码/UI/插件，每次改动可追溯（部署时建议 fork，自进化后可提交回自己仓库）。
- **组织模型（两层）**：
  1. `@` 跨会话连接——事后补建，点对点，可选「只读引用」或「双向交流」；
  2. 智能体群——事前预设，多 agent 共享「群黑板」自主分工。研究团队形态：1 首席（不可删，负责拆解+整合）+ 最多 12 助理，逐成员配模型/职责/Skill 与 Memory 范围。
- **知识层**：Skill/Memory 三级作用域（内置/用户级/项目级），会话创建时勾选、中途可追加——本质是**提示词级注入**，没有代码级知识图谱。
- **管控层**：巡检/鞭策防 agent 偷懒、模型调用限频（token proxy）、危险操作人工审批与无人值守 agent 分开——「拆成多个 agent 各守边界，别把两套要求塞进一个上下文」是它的核心论点。
- **架构**：tmux 会话为底座，编码 agent（Claude Code/Codex/GLM harness）被 OS 编排，Node/TS 后端 + SQLite + Web/Electron/TUI 三端。模型完全解耦。

### 2.2 文章A：网易《游戏研发中的 AI 转型：多 Agent 系统与知识工程实践》

- **核心洞察**：内部大规模调研发现，游戏研发最大时间成本不是写代码，而是**理解代码**（千万行仓库、20% 时间花在问人）。所以先做知识，再做生成。
- **设计**：显性知识（文档/工单/仓库归集 → agentic RAG）+ 隐性知识（AST + 调用流 → 代码知识图谱，工单↔提交记录打通）；「研发空间」把团队隐性规范显性化（SDK 版本、引擎代码、编码风格）；Core Agent 协调一批「项目风格化」子 Agent。
- **金句级论断**：「Agent 架构最后的差异不会太大，真正重要的是你给 Agent 提供了什么上下文。」
- **AI Review 演进**：prompt 工程（1000 个问题只有 10 个有效）→ 静态分析+大模型双引擎 → multi-agent 过滤分级 → 注入知识工程 → 少而精。「白天人写代码，晚上 AI 审查」。
- **数据**：团队工具月产 500 万行代码、覆盖几十个项目；新人熟悉 4 万行代码从 2 周 → 1-2 天。

### 2.3 文章B：腾讯云林哲《基于 AI Agent 的小游戏开发实践》

- **核心洞察**：
  1. 玩法验证有沉没成本，MVP 验证前参与人数要最少；
  2. **WebGame 技术栈对 LLM 最友好**（20 年成熟度、模型知识充分、代码即资产、浏览器即预览）。
- **流水线**：专家中心（岗位化 Skill+知识库）→ 与专家对话迭代出结构化策划案 → 专家团（工程师生成 + QA 审核互查）一句话出可玩原型 → AI 生成**关卡可视化编辑页**（元素编号化，让自然语言修改有明确落点）→ 上下文贯穿：美术无需逐图写提示词，一句话替换全套资产 → 导出（策划案/数值/关卡/美术/源码）给 CodeBuddy → 引擎 MCP（Unity/Cocos/UE 已支持）+ Skill 划定 MCP 操作边界 → 图生视频抽帧解决序列帧动画。全程 2 天出 Cocos 版。

### 2.4 文章C：触乐《当 AI 开始重写小游戏生产流程》

- **事实**：个人开发者 1200 元 + 2 个月业余做出上线微信小游戏（Claude Code 写码、GPT/Gemini/豆包出图）；AI 广告素材成本不到传统 1/10，买量侧比研发侧落地更快；Sekai 上已有 1500 万个迷你应用，游戏正在变成 UGC 社交内容。
- **核心论断**：**开发不再是瓶颈，判断成了新门槛**。「AI 帮不了你的 4 件事」：产品决策（好不好玩）、新手引导设计（AI 不知道玩家为何困惑，90% 测试者看不懂的教训）、美术风格统一、平台合规审核。小游戏规模恰好规避了 AI 的上下文丢失问题（代码量小、平台单一）。

## 3. 设计对比（一张表）

| 维度 | Mobius | 网易 | 腾讯云 WorkBuddy | 行业/个人实践（文章C） |
|---|---|---|---|---|
| 定位 | 通用自进化 Agent OS | 企业内代码智能中台 | 垂直游戏原型流水线 | 单人工具链 + 平台生态 |
| 组织模型 | @点对点 + 群黑板，首席制 | Core Agent 协调风格化子 Agent | 专家团两两互查（工程+QA） | 无（单人+多工具） |
| 知识/上下文 | Skill/Memory 三级，提示词级 | **代码图谱+研发空间（最深）** | 会话上下文贯穿全流程 | 靠小游戏规模天然规避 |
| 领域结构 | **无（游戏零结构）** | 通用代码级 | **有（策划案→关卡→资产→引擎）** | 有（全流程+平台合规） |
| 验证/质量 | 巡检防偷懒（治意愿不治结果） | AI Review 少而精 | QA agent 互查 | **人工验收是硬瓶颈** |
| 商业形态 | 开源+自托管 | 内部效能（数据回流成壁垒） | 云产品（150+ 客户） | 平台抽成+流量分配 |

**空档清晰可见**：Mobius 有组织没领域，网易有知识没游戏管线，腾讯云有管线但绑定腾讯生态且只到小游戏原型。**「游戏领域的知识工程 + 开放的多 agent 组织」目前没人做全。**

## 4. 可借鉴点清单（按优先级，直接指导实现）

### P0 —— 决定产品形态

1. **上下文贯穿的单一事实源**：把策划案做成**机器可读的结构化工件**（世界观/关卡/数值/UI 的 schema），原型、美术、配表全部从它派生——这是腾讯云流程里最值钱的一步，也直接回应文章C「AI 不知道玩家为何困惑」：结构化设计文档就是人的产品决策的载体。
2. **知识先于生成**：v1 就要有项目知识层——目录结构语义化、引擎版本与 API、编码风格、命名表（网易「研发空间」+ Mobius 三级 Skill/Memory 作用域的合体）。没有这层，多 agent 就是并行的平庸。
3. **验收回路是一等公民**：生成 agent 与 QA agent 对抗互查（腾讯云）+ 可运行冒烟测试 + 人工 checklist。Mobius 的巡检只解决「偷不偷懒」，不解决「对不对」；三篇文章在这一点上完全一致：最终验收必须是人，产品要给验收者好用的工具而非更多产出。

### P1 —— 组织与执行

4. 双层协作照抄 Mobius：主策划 agent 与职能 agent 点对点单聊 + 共享黑板放关卡状态/资产清单/阻塞项。
5. **「让 AI 给 AI 造工具」**：AI 生成关卡可视化编辑页、元素编号化，把模糊的自然语言修改变成精确指令——这是文章B里最聪明的单个设计，成本低收益大。
6. Web-first 原型 + 引擎移植分段：v1 只做 Web 原型闭环（LLM 知识最充分、浏览器即预览），引擎移植（MCP+Skill 划边界）放 v2。
7. 管控照抄 Mobius：危险操作人工审批与无人值守 agent 分开、token 限频、按 agent 划边界——别把两套要求塞进一个上下文。

### P2 —— 长期壁垒

8. 数据回流：纠错数据、审查标记、验收结论沉淀回知识库（网易的闭环），配合 Mobius 式「每次改动可追溯」。这是唯一随时间复利的资产。
9. 把文章C列出的「AI 做不到的 4 件事」直接做成产品功能：新手引导工作流、风格参考卡库、合规材料 checklist——**人的新瓶颈就是你的收费点**。

## 5. 反面清单（不要做的）

- **不要先造通用 Agent OS 等游戏场景长出来**——Mobius 本身就是反例，通用平台对游戏零领域结构，网易也证明了价值全在领域上下文里。
- **不要拿「一句话自动出游戏」当核心卖点**——三篇文章一致证明验收/好玩靠人，宣传过头用户第一次用就失望。
- Mobius 的「自进化改自己源码」在多租户商业场景是安全与合规噩梦；**借鉴其审计与可追溯，不要借鉴「改自己」**。
- 别把「生成更多」当差异点：小游戏月提交已超 1 万款、审核排队 3 天起步——同质化和合规才是死穴，能帮「过审与验收」比能「生成」稀缺得多。

## 6. 给下一步实现的一句话指令

**v1 最小闭环 = 结构化策划案 schema → 带 QA 互查的 Web 原型生成 → 可玩链接 + 人工验收 checklist，组织上用 1 首席 + 策划/程序/QA/美术四职能 + 共享黑板，知识层从三级 Skill/Memory 起步。引擎移植、自进化、数据回流全部留给后续版本。**

## 7. 溯源与关联

- **目标**：`cmtmvs3u0000ejqjst3gc2cmf`（调研 → 沉淀知识 → 方案设计 → 录需求 → 开发工作流）
- **调研产物**：artifact `cmsk2tgmn0000m9rrqdhia5nl`（产品及商业化军师，2026-09-04）；完整报告原文存于该目标的 goal session 消息中
- **本文与验收标准的对应**：验收项「调研报告已沉淀为知识库文档，可通过『调研 / agent / mobius』相关标签检索到」由本文满足
- **相关知识文档**：《沉淀Web大逃杀技术方案与性能红线》《和平精英Web版两次开发复盘与串行开发规范》——文章B「WebGame 技术栈对 LLM 最友好」的判断与 MyRD 已有的和平精英 Web 实践相互印证
- **待补研**：目标描述中 3 个 mp.weixin 原始链接（其中之一为 Claude of Tanks，要点见第 1 节范围偏差声明）

## Sources

- [mobius-system/mobius](https://github.com/mobius-system/mobius)
- [网易多 Agent 与知识工程实践（InfoQ）](https://www.infoq.cn/article/psxyteixpjvwal89fmue)
- [腾讯云林哲：怎么用 AI Agent 开发小游戏（GameLook）](http://www.gamelook.com.cn/2026/06/595411/)
- [当 AI 开始重写小游戏生产流程（触乐/36氪）](https://m.36kr.com/p/3919432566779528)


## 沉淀AI女友剧情生存玩法设计基线

# 沉淀AI女友剧情生存玩法设计基线

> **依据**：需求《我被AI女友包围了》剧情生存挑战游戏需求（id=cmtob3m0p000pm9y6yl6yi1uq）＋ 游戏策划产物（id=cmtn5fhk20008jqck1thxilil）＋ 平台既有 Godot 工程约定（`games/godot-coin-rush`：六段式 GameDesignSpec / contract-check / verify.sh）＋ Godot 官方 Web 导出文档。
> **用途**：实现节点（开发/测试/部署）执行对齐的唯一设计基准。
> **冲突裁决规则**：需求硬约束 > 策划案原文（design-spec.md / design-spec.json）> 本文；发现偏差须回填本文（版本 +1）。
> **两条硬约束**：① godot headless 门禁 0 error 方可合并；② 构建产物必须在平台 AppHost 部署可启动、健康检查通过，禁止仅本地可跑的交付形态。

---

## 一、玩法定位与核心循环（AC1 落点）

**定位**：剧情驱动的生存挑战游戏。玩家扮演被多位 AI 女友包围的主角，通过对话抉择与状态管理在剧情推进中求生并走向多分支结局。

**核心循环（全项目唯一的循环定义，文案/实现/测试均以此表述为准）**：

```
剧情节点选择 → 好感度/威胁度/生存状态变化 → 触发后续剧情与结局分支 →（回到节点选择）
```

三条由循环直接推出的架构推论（策划案已确认，实现不得违背）：

1. **数据驱动**：人设卡、剧情节点、数值全部是 content JSON；逻辑只认 schema 与 `spec.numeric` 键名，不认具体角色与具体数值。
2. **可追溯**：每次结算写 trace，任何 AI 行为输出都能回放定位到 `persona_id` + 状态前后值。
3. **可验证**：验收一律落成契约测试断言（spec/persona/story/ending 四类 + smoke），不靠人工体感。

## 二、单一事实源：六段式 GameDesignSpec（平台既有工程约定）

- 落点 `.myrd/spec/design-spec.json`，六段：**meta / world / entities / levels / numeric / acceptance**。
- `entities[].script/scene`、`levels[].story_data`、`acceptance[].check` **声明的路径必须真实建出**，契约测试校验落点存在性。
- 数值只认 `spec.numeric`，键名与未来 `game_state.gd` 字段一一对应——改数值=改表，不改码。
- 策划案已交付内容（9 个内容 JSON + 2 份文档）：schema 契约 1 份 + 5 张人设卡 + 3 幕剧情（= 9 个 JSON），另有六段式 `design-spec.json` 与人读版 `design-spec.md`（含数值表、两条链路逐步演算、美术基线）。**策划阶段未产 Godot 代码，实现节点按 spec 施工。**

## 三、AI女友人设卡基线（AC2 落点）

- **schema 契约**：`games/ai-girlfriend-siege/data/schema/persona.schema.json`，**9 个必填字段**，覆盖并超出需求的 5 字段（姓名 / 性格标签 / 说话风格 / 好感度规则 / 威胁·危机行为模式）。
- **5 张基线人设卡**（`data/personas/persona-{lumi,vex,ada,momo,sera}.json`）：治愈 / 病娇 / 冷静 / 活泼 / 神秘 五型；字段含主题色、口头禅、`favor_rules`、`threat_rules`、`portrait_prompt`。
- **美术单一事实源**：立绘/形象资产只从 `portrait_prompt` 派生，禁止另行脑补设定——防止多 agent 并行产出美术与文案漂移。
- **解耦铁律**：`persona_loader` 只认 schema 不认具体角色 → **改人设卡免改码**。验收手段 = swap 测试（替换某张卡 JSON、零代码改动，门禁仍过且行为变化）。
- **可追溯格式**：`story_engine` 每次结算写 trace：`node_id / option_id / persona_id / favor·threat 前值与后值`，回放可定位到具体人设与状态。

## 四、剧情幕结构与结局分支（AC3 落点）

- **三幕骨架「包围 → 裂痕 → 倒计时」**：`data/story/act{1,2,3}.json`，共 **18 个节点**，节点图闭合无死链。
- 节点 / 选项 / 数值效果**全部显式声明**；effects 用声明式键值（Δfavor/Δthreat/flag/goto），**禁止节点内嵌脚本逻辑**——嵌逻辑即破坏可追溯与换卡免改码。
- **4 个结局**；其中 **2 条已逐步演算、可复现的可玩链路**（满足"至少 2 个不同结局"验收）：
  - **链路 A → 独活结局**：全程威胁累积 Σthreat 控制在幕级上限（<300）内，终局选逃跑；
  - **链路 B → 带走 Lumi 结局**：Lumi favor 终值 96 ≥ 70，且 threat 30 ≤ 60。
- 结局判定阈值基线（策划案演算使用值）：**favor 结局门槛 ≥70；单人 threat 结局门槛 ≤60；幕级 Σthreat 上限 300**。
- 结局判定由 `ending_contract.gd` 断言（对应 acceptance acc-5/acc-6）；冒烟测试用脚本驱动固定选择序列，跑出 ≥2 个不同结局即 AC3 达成。

## 五、生存循环与数值规则

- 状态三轴：**favor（好感度）/ threat（威胁度）/ 生存状态**；具体生存轴与衰减公式以 `spec.numeric` 为准，键名与 `game_state.gd` 一一对应。
- 每次选择的标准结算链：选项 effects 声明 Δ 值 → story_engine 结算 → trace 落账 → 门控判断下一节点/结局。
- 数值调优只改 `spec.numeric` 与人设卡 `favor_rules/threat_rules`，**任何数值调优不允许以改代码的方式实现**。

## 六、godot 门禁与 CI（AC4 落点）

**门禁三件套（全部 headless，0 error 才可合并；CI 拒绝含错误代码的提交）**：

1. **preflight**：环境与引擎版本预检；
2. **`godot --headless --import`**：资源导入完整性（坏资源/坏路径在此暴露）；
3. **smoke**：headless 跑冒烟 + 契约测试（spec / persona / story / ending 四件，先例即 `games/godot-coin-rush` 的 `contract-check.mjs` + `verify.sh` 模式）。

附加门禁规则：spec 中声明的落点（entities script/scene、levels story_data、acceptance check）必须真实存在；persona/story JSON 过 schema 校验，坏配置 = 门禁失败（让 AC2 的"≥5 字段结构化"变成机器可验证，而不是评审口径）。

## 七、Web 导出与 AppHost 部署规范（AC5 落点）

**引擎事实（Godot 官方文档，已核实）**：
- Godot 4.3 起，**单线程 Web 导出是官方默认推荐路线**：无需跨域隔离响应头、兼容性最好；
- 开启线程支持（SharedArrayBuffer）则硬性要求：HTTPS 安全上下文 + `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`。

**项目裁决规则**：
1. **默认锁单线程导出**；仅当 AppHost 可注入自定义响应头且走 HTTPS 时，才允许评估线程模式。
2. `.wasm` 必须 `application/wasm` MIME；index.html / wasm / pck 同源部署。
3. 体积与首屏预算：剧情游戏静态资源大头是**中文字体与立绘**——中文字体必须子集化；具体体积/首屏红线由实现节点导出实测后回填本文（不在无实测数据时空定数值）。
4. **健康检查**：交付包内置静态 `/healthz`（200 + `{status:"ok",version}`）；部署后 AppHost 探活通过 + 浏览器冒烟（canvas 出现、console 无 error）。
5. PWA service worker 可官方模拟 COOP/COEP，但增加缓存失效复杂度，AppHost 场景**默认不启用**。
6. 禁止 desktop-only / 仅本地可跑形态；未过健康检查的构建不得标记完成。

## 八、目录结构与依赖方向（CI 强制）

```
games/ai-girlfriend-siege/
  data/schema/persona.schema.json      # 契约：人设卡字段
  data/personas/persona-{lumi,vex,ada,momo,sera}.json
  data/story/act{1,2,3}.json           # 三幕节点图
  design/design-spec.md                # 人读版：数值表+链路演算+美术基线
.myrd/spec/design-spec.json            # 六段式单一事实源
```

依赖方向：`persona_loader` 只依赖 schema；`story_engine` 只依赖 `spec.numeric` 键名与 act JSON；UI 只读状态与事件流；**任何 .gd 禁止硬编码角色名或数值**（出现即 lint/评审打回）。

## 九、验收标准映射（AC → 基线落点）

| AC | 验收点 | 基线落点 | 自动化手段 |
|---|---|---|---|
| AC1 | 玩法定位+核心循环经评审确认 | §一 循环唯一表述 | spec 契约测试 |
| AC2 | 人设卡 ≥5 字段、改卡免改码 | §三 schema 9 必填字段 + swap 测试 | persona 契约测试 |
| AC3 | ≥1 条链路复现 ≥2 结局 | §四 4 结局 + 2 条已演算链路 | ending 契约 + smoke |
| AC4 | godot 门禁 CI 生效、错误提交被拒 | §六 三件套 0 error | CI 拒绝合并验证 |
| AC5 | AppHost 部署可启动 + 健康检查通过 | §七 单线程导出 + /healthz + 冒烟 | 部署核对（策划案 acc-12 同为人工核对项）|

策划案共 12 条 acceptance，其中 10 条已配可执行检查（spec/persona/story/ending 四契约 + smoke）；实现节点不得降低已配检查的覆盖面。

## 十、执行经验与 DO NOT（本次目标执行沉淀）

**有效的做法**：
- 策划阶段就把验收配成可执行检查（12 条中 10 条可自动断言）——这是实现节点不返工的关键，印证调研结论「验收回路是一等公民」「知识先于生成」。
- 文案、美术、数值全部从单一事实源派生（portrait_prompt / spec.numeric），多 agent 并行也不漂移。
- 自检抓到链路演算中的「带问号模糊值」并修正为精确终值——**数值表述必须可判定，禁止"约/大概/左右"**。

**DO NOT（违反即打回）**：
- 禁止把人设写进 .gd 代码或节点属性（AC2 直接失败）；
- 禁止节点 effects 内嵌脚本/表达式求值逻辑（破坏可追溯与换卡免改码）；
- 禁止绕过 godot headless 门禁合入主干；
- 禁止交付 desktop-only / 仅本地可跑形态；
- 禁止在策划与配置文档中使用不可判定的数值表述。

## 十一、待核实与回填项（实现节点开工前处理）

1. **数值终值比对**：链路终值在策划执行过程播报中出现过一次修订（如链路 A Σthreat 曾出现 225/210/220 等中间口径），**以 design-spec.md 演算表终值为准**；工作区产物未推送远端分支，实现节点重建文件时须逐值核对并回填本文。
2. **AppHost 能力核实**：是否支持自定义响应头与 HTTPS —— 决定线程模式可行性；不支持则永久锁单线程导出。
3. **实测回填**：Web 导出体积（wasm/pck）与首屏加载时间，导出后实测回填 §七。
4. **生存轴定义**：体力/理智类生存状态的具体轴与衰减公式以 `spec.numeric` 为准，本文不预设定。

---

*版本 v1.0 ｜ 2026-09-05 ｜ 目标管理大师固化。依据：需求 id=cmtob3m0p000pm9y6yl6yi1uq、策划案产物 id=cmtn5fhk20008jqck1thxilil、平台 Godot 工程约定（games/godot-coin-rush）、Godot 官方导出文档。*



---

# 换行验证产品

验证 summary 每项换行


## 关联项目

### 心伴 [frontend]

项目名: 心伴
描述: ai 情绪陪伴
类型: mobile
GitHub: https://github.com/hl3w22bupt/odbo
工作流类型: cmqc71gii0005m9uni8nwb6j3

### MyRD Playground [mobile]

项目名: MyRD Playground
描述: MyRD 功能测试和沙盒环境
类型: web-app
GitHub: https://github.com/hl3w22bupt/myrd-playground.git
工作流类型: cmqc5q1ne0005m98t740g0eh9


---


## 产品关联知识

## 项目开发规范

# 项目开发规范

## 代码风格
- 使用 TypeScript
- - 遵循 ESLint 规范
- 提交前运行 lint 检查

## Git 提交规范
- 使用 Conventional Commits 格式
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新

## Agent 执行轨迹（agent_execution_trajectories）孤儿 running 记录：诊断、根因与自愈处置手册

# Agent 执行轨迹（agent_execution_trajectories）孤儿 running 记录：诊断、根因与自愈处置手册

## 背景
平台中所有 Agent 执行（channel 频道消息、express_lane 直通车、workflow 内 agent 节点、exploration、secretary、onboarding 等）都会写入一条 agentExecutionTrajectory 轨迹记录，采用 create-then-finalize 生命周期：

- 创建时（createAgentTrajectory）写入 `status='running'`；
- Agent 执行正常结束时（final 事件 / 流自然结束），pipeline 返回路径将 status 置为 `completed`；
- 异常被 catch 时置为 `failed`，并回填 outputPreview / error / durationMs / completedAt。

Claude 子进程层存在 10 分钟默认超时（SIGTERM → 10s 后 SIGKILL）。

`agent_execution_trajectories` 表是所有 Agent 执行的基础数据源，也是进化分析（evidence mining）的关键证据来源，轨迹数据质量直接影响进化证据统计与状态判定。平台 Worker 启动时运行一整套自愈（auto-heal）机制，但当前对轨迹记录存在覆盖盲区。

## 现象
增量时间窗内观测到 7 条轨迹全部停留 `status='running'`，且错误为空、输出摘要为空，覆盖执行类型与角色：

- **channel**：PD-Agent、Architect-Agent、开发者；
- **workflow**：「把 HTML 原型转成生产级 React Native 前端（先发 Android）」frontend 节点、「创建 PR（基于实际变更）」create-pr 节点；
- **express_lane**：Express Agent ×2。

共同特征：记录创建后从未被 finalize，既无 error，也无任何中间输出（outputPreview=NULL），从数据上完全看不出是否还在推进。

影响：
- 轨迹表被孤儿记录污染，进化分析（evidence mining）统计失真（running 状态混入失败/完成判定）；
- 轨迹模型没有 timeout / expiration 字段，理论上可无限 running；
- 与「真正仍在运行但尚无输出」的合法长任务无法从数据上区分。

## 根因
1. **轨迹完结依赖进程内 pipeline 的返回路径**。超时/取消逻辑全部在 Worker 进程内存中（startTimer + activePipelines 注册表）。Worker 被重启（挂起检测触发自动重启、OOM、部署）时，内存定时器与注册表一并丢失，正在执行的轨迹失去 finalize 触发点，永远不会被置为终态。
2. **自愈覆盖盲区**。平台启动自愈覆盖了 workflowRun（autoHealStaleRuns→paused）、expressLaneRun（→failed，error='执行中断（Worker 重启）'）、channel_messages 的 streaming 占位消息（>10 分钟清理 streaming 标记）、agent busy 状态（→idle）、goal 执行（resumeStuckGoalExecutions）、vibe workspace（小时级清理），但**不覆盖 agentExecutionTrajectory 本身**（代码中 grep 零引用），轨迹成为永久孤儿。
3. **自愈仅在启动时执行一次**，运行期没有周期性僵死检测。
4. **finalize 无重试**。finalizeAgentTrajectory 内部 try-catch 仅记录日志：若 finalize 本身失败，轨迹不会再次尝试落终态。
5. **长任务与死执行不可区分**。长时间无任何输出的运行（git/gh 等待交互输入、依赖安装卡住、构建/推送阻塞、模型侧无响应）也不会产生 outputPreview，与死执行在数据上表现完全一致，无法仅靠「有无输出」判定。

## 处置
### 1. 定位滞留轨迹
```sql
SELECT id, agent_type, agent_name, status, created_at,
       (now() - created_at) AS age, output_length, error
FROM agent_execution_trajectories
WHERE status = 'running' AND created_at < now() - interval '30 minutes'
ORDER BY created_at;
```
也可按更新时间检索并补充更多诊断字段：
```sql
SELECT id, agent_type, status, "createdAt", "updatedAt", output_preview, error, metadata
FROM agent_execution_trajectories
WHERE status = 'running' AND "updatedAt" < now() - interval '30 minutes'
ORDER BY "updatedAt";
```
重点看 output_length IS NULL/0 的记录——无输出即无进展。

### 2. 区分「假 running」与「真僵尸」
- 检查对应 Worker / 子进程是否存活；
- 观察 updatedAt 是否仍在刷新；
- 若不再变化且无输出，判定为孤儿。

### 3. 按类型处置
- **workflow 节点**：查关联 workflow_run 的 status。若 run 也卡住，启动自愈会将其置为 paused（节点重置为 pending），可手动 resume；轨迹需同步标记 failed 并注明原因。
- **express_lane**：expressLaneRun 启动自愈已标记 failed（error='执行中断（Worker 重启）'）；确认轨迹同步标记 failed。worktree 现场保留在 `$WORKSPACE_ROOT/<projectId>/run-express-<taskId>`，可手动补收尾后「续跑」。
- **channel**：启动自愈会清理 streaming=true 且超过 10 分钟的 channel_messages 占位消息（content 置为「(Agent 异常中断 — Worker 重启)」）；轨迹需同步标记 failed。

### 4. 检查僵尸子进程
```bash
ps aux | grep -E 'claude (-p |--print)' | grep -v grep
```
对照轨迹的 worktree / session_id / prompt_preview 定位残留进程，确认无活动输出后 kill（SIGTERM → 10 秒后 SIGKILL）。

### 5. 清理孤立 worktree
确认无活动执行引用后，用 `git worktree remove --force` 删除 `$WORKSPACE_ROOT/<projectId>/run-*` 下对应目录。

### 6. 批量修复（谨慎）
先人工确认无关联的活动中执行，避免误杀：
```sql
UPDATE agent_execution_trajectories
SET status = 'failed',
    error = '执行中断（僵死自愈：无进展超时）',
    completed_at = now()
WHERE status = 'running' AND created_at < now() - interval '30 minutes';
```
保留 inputs / metadata 以便复盘，避免误判为进行中或计入成功统计。

### 7. 复盘
把轨迹 id 关联到 workflow run / express lane / channel 会话，判断是「提示词缺执行纪律」还是「编排层 finalize 缺失」。

## 预防
- **轨迹有界生命周期 + 僵死自愈**：轨迹必须有硬上界与回收任务（启动时 + 每小时周期检测）。
- **所有执行路径必须输出中间进度**，避免「运行中但零输出」。
- **新增执行环节（新 agentType）时**，必须补齐完结路径与自愈覆盖，并把 agentExecutionTrajectory 纳入与 workflowRun / expressLaneRun 同级的启动自愈清单。
- **Agent 提示词层**：要求有界执行（见《Workflow Agent 节点执行纪律规范》），确保任何路径都能 finalize。
- **记录层**：为轨迹增加 timeout / expiration 字段与「心跳刷新」机制，长期无心跳即可判定可回收；监控 running 超过阈值（如 30 分钟）的记录。
- **Worker 重启流程**中补充 trajectory 清理步骤。

## 情绪陪伴 App 产品调研框架

## 情绪陪伴 App 产品调研分析框架

### 背景
MyRD Admin 提出设计一款以"情绪价值"为核心的陪伴类 App，并引入游戏化交互机制。PD-Agent 就此进行了系统性调研分析。

### 市场与竞品分析
- **现有格局**：冥想类（Headspace、Calm）、日记记录类（Daylio）、虚拟陪伴类（Replika、Character.AI）App 已在市场存在，但多数偏"工具属性"，缺乏有深度的互动体验
- **差异化机会**：游戏化交互是关键的破局点，将情绪调节转化为"养成类 RPG"或"模拟经营"式体验

### 用户需求画像
- **目标人群**：Z 世代及年轻职场人，面临孤独感或高压，排斥传统说教式心理咨询
- **核心诉求**："被理解"、"被陪伴"以及"低压力的情绪宣泄口"，而非"治疗"

### 游戏化交互机制（核心差异化）
- **情绪映射**：将用户抽象情绪（文字、语音、表情）转化为游戏内数值或视觉反馈
  - 示例：用户开心时虚拟家园天气变晴；用户焦虑时出现需要安抚的小怪兽
- **正向反馈循环**：通过"情绪打卡"或"互助任务"解锁装扮、剧情或虚拟互动
- **方向待定**：AI 虚拟伴侣养成 vs 个人情绪花园经营

### 技术可行性
- 涉及 NLP 自然语言处理进行情绪识别
- 高保真游戏化 UI/UX 设计
- 通用技术选型方向待进一步确定

### 伦理与合规风险
- 需明确界定"陪伴"与"心理咨询"的边界
- 避免用户过度依赖及潜在法律风险

### 商业模式探讨
- 订阅制 / 内购制 / 广告变现 待评估

### 后续调研方向
1. 竞品深度拆解：挑选 2-3 款 AI 聊天+游戏元素的应用进行分析
2. MVP 核心功能定义
3. 商业模式确定

## MyRD 平台真实仓库结构地图、文档/技能入口与常见路径陷阱

# MyRD 平台真实仓库结构地图、文档/技能入口与常见路径陷阱

## 背景
agent 在涉及 MyRD 平台的任务中反复出现两类高成本问题：

1. **文档/技能入口定位失败**：任务开始时多次通过 glob 搜索 `**/myrd*/**/SKILL.md`、`**/myrd-platform-skill*` 等模式均返回 0 命中，误判平台「为云端平台、本地无文档」（#18283），或技能未在预期目录找到（#18123），随后不得不多轮读取源码与文档才定位入口（#18282-18293）。myrd-platform-skill 是 agent 理解平台的标准入口（最近 14 天调用 4 次），但 agent 本地环境无法直接命中其正文，造成重复勘察，agent 花费约十余次观测重复勘察结构。
2. **引用不存在的文件路径**：多会话（#18282-18293、#18596-18617）反复手工翻查源码才能定位平台结构，且 #18616/#18617 实证发现提案引用了不存在的 `frontend/lib/services/*` 与 `myagent-client.ts` 路径，导致提案被驳回、评审周期浪费。

根因在于「文档与实际源码结构不一致」——仓库（典型根目录 `/Users/leo/workspace/myrd`）存在源码与编译产物并存、文档过时等问题。本文档给出经源码核实的真实入口、真实结构地图及高频错误路径，供涉及 MyRD 内部实现的任务直接使用，消除重复探索并防止错误路径再次出现，显著降低后续任务冷启动成本。

## 关键入口（权威文档与技能）
- **平台使用说明书（权威）**：`/Users/leo/workspace/myrd/docs/myrd-platform-skill.md`。注意：位于源码仓库 `docs/` 下，而非 `~/.claude/skills/`。内容覆盖：服务地址、JWT 认证、全部 API 分类、典型示例、数据模型、边界情况，并含平台进化系统架构说明。
- **快速开始**：`/Users/leo/workspace/myrd/docs/guides/quick-start.md`（环境搭建 → 服务启动 → 注册 → 建项目 → 跑工作流）。
- **工作流集成/部署状态**：`/Users/leo/workspace/myrd/WORKFLOW_INTEGRATION.md`、`/Users/leo/workspace/myrd/MYRD_SETUP_STATUS.md`。
- **数据库 schema**：`/Users/leo/workspace/myrd/prisma/schema.prisma`（含 `AgentExecutionTrajectory` 模型，表名 `agent_execution_trajectories`）。

## 真实结构（经源码核实）
- **入口与自愈**：`src/index.ts`（worker 启动时执行 auto-heal，覆盖 WorkflowRun / ExpressLaneRun / channel_messages / agent status / goals / vibe workspace，**不含** agentExecutionTrajectory）。
- **工作流引擎**：`src/services/workflow/engine.ts`（约 2626 行；含 `resume()` 约 443 行、`iterateFrom()` 约 784 行、`rerunFrom()`、`rollbackToCheckpoint()`、`sharedSetupProjectWorkspace()`；支持 DAG 执行 / 自愈 / 重试 / git checkpoint）。
- **Coding-agent 实现**：`src/services/coding-agent/{claude-code-agent.ts, local-claude-agent.ts, remote-agent.ts, types.ts}`（其中 `claude-code-agent.ts` 含 10 分钟默认超时与进程清理逻辑）。
- **进化系统服务**：`src/services/evolution/`（analyzer 等模块；支撑证据系统三类数据源、证据挖掘策略）。
- **路由**：`src/routes/workflows.ts` 等。
- **前端真实源码**：`frontend/` 目录存在，含 `app/` 与 `components/` 源码，如 `frontend/app/(dashboard)/projects/new/page.tsx`、`frontend/components/projects/run-workflow-button.tsx`。
- **编译产物（非源码）**：`src/dist/`——仅含编译后声明/产物（如 `src/dist/lib/myagent-client.d.ts`、`src/dist/services/coding-agent/myagent-agent.d.ts`），**不是源码**。

## 服务端口
前端 :3001、后端 API :3111、streaming :4112、MyAgent :3000、数据库 :5432。

## 高频错误路径（不存在，务必避免）
| 常见错误引用 | 真实对应 |
|---|---|
| `frontend/lib/services/workflow/engine.ts` | `src/services/workflow/engine.ts` |
| `frontend/lib/services/coding-agent/claude-code-agent.ts` | `src/services/coding-agent/claude-code-agent.ts` |
| `myagent-client.ts`（作为源码） | 无此源码；仅有编译声明 `src/dist/lib/myagent-client.d.ts` |
| 认为前端目录含业务服务代码 | `frontend/` 主要被 `node_modules` 占据；业务服务在 `src/services/` |

## 根因
1. 文档（含 `docs/guides/quick-start.md`）描述的结构与实际仓库不一致或已过时；
2. agent 凭记忆/推测引用路径，未做存在性核实；
3. `src/` 与 `src/dist/` 并存，把编译产物误当源码。

## 处置（核实方法）
- 引用任何路径前，先用 glob/grep 在仓库根目录确认文件存在；
- 区分 `src/`（源码）与 `src/dist/`（编译产物），引用源码一律指向 `src/`；
- 工作流引擎、coding-agent、evolution 等业务服务一律在 `src/services/` 下，不在 `frontend/lib/` 下；
- 「文件不存在」的判断以 glob 返回空为唯一依据，不要依据记忆或文档；
- 分析轨迹/进化数据时，直接读 `agent_execution_trajectories` 表与 `prisma/schema.prisma` 的 `AgentExecutionTrajectory` 模型，不要靠源码 glob 反推。

## 预防
- 涉及 MyRD 内部实现的提案/文档，落笔前对每个文件路径做一次 glob 核实；
- 平台是本地源码 + 多 run 工作区（`/Users/leo/.myrd/workspaces/proj-myrd/run-*`）并存；run 工作区可能包含主干尚未合入的功能（如 express-lane、轨迹追踪迁移），分析时以对应 run 工作区为准；
- 本文档随仓库结构变更应同步更新。

## 架构设计文档

# 架构设计

## 技术栈
- 前端：Next.js + React + TypeScript
- 后端：Motia (iii 引擎)
- 数据库：PostgreSQL + Prisma

## 模块划分
- 项目管理模块
- 任务管理模块
- 知识库模块

## 需求池功能说明

# 需求池功能

## 功能说明
需求池用于管理产品需求、Bug 修复、功能改进等任务。

## 状态流转
- backlog: 待办需求
- todo: 已计划
- in-progress: 进行中
- review: 评审中
- done: 已完成
- archived: 已归档

## 沉淀Web大逃杀技术方案与性能红线

# 沉淀Web大逃杀技术方案与性能红线

> 来源：《和平精英Web版》架构Agent技术方案（PR #8，产物 id=cmos298dg0001m9mxandnum2z，repo hl3w22bupt/myrd-playground）
> 需求基线：《「和平精英Web版」核心玩法需求（跳伞/拾取/射击/缩圈/AI 对抗）》（id=cmtfyd7uc000im9hapib6ann3）
> 用途：**开发节点（M0~M7）执行对齐的唯一技术基准**。本文所有数值均为架构评审结论，实现时落入 `content/` 配置表由测试断言，禁止硬编码、禁止擅自更改。

---

## 一、引擎选型结论（ADR-001/002/007/008）

**最终选型：Three.js r185 + Vite 7 + TypeScript 5.9.x + 零后端静态部署。**

### 1.1 为什么是 Three.js（候选对比结论）

| 维度 | Three.js r185 ✅ | Babylon.js | PlayCanvas | Unity WebGL |
|---|---|---|---|---|
| 核心体积（gz 约量级） | ~170KB | ~1MB+ | ~1MB | 10~40MB（含 wasm 堆） |
| 首屏可交互（红线 ≤5s） | 最优 | 良好 | 良好 | 难达标 |
| TS 类型 | 官方自带 | 官方维护 | 部分 | 生成式，质量一般 |
| 玩法逻辑自由度 | 最高 | 高 | 受编辑器约束 | C# 工具链负担 |

落选核心逻辑：本项目的核心工作量在**玩法仿真**（跳伞四阶段/弹道结算/缩圈几何/AI 行为），不在渲染管线。引擎越"全"（内置物理/GUI/场景序列化），越容易把逻辑写进引擎回调，破坏"仿真与表现分离"主决策；Unity WebGL 的 10~40MB 加载直接违反首屏 ≤5s 红线。Three.js 生态与问题检索量最大，上手成本最低。

### 1.2 配套选型（配套 ADR）

| 决策 | 结论 | 一句话理由 |
|---|---|---|
| ADR-002 物理碰撞 | **自研**（高度场采样 + AABB + 射线检测，约 300 行） | 本期碰撞仅三类需求；零 wasm 加载复杂度；完全确定性。不支持刚体堆叠，二期载具预留接口 |
| ADR-003 时间步进 | **fixed timestep 50Hz + rAF 可变渲染 + 插值** | AC2 落点可复现的硬前提；可变 dt 无法保证 |
| ADR-004 实体组织 | **ECS-lite**（轻量结构化实体 + 系统函数） | 实体上限 20，bitecs 等重型 ECS 无收益 |
| ADR-005 UI 方案 | React 19（低频菜单/背包/结算）+ 原生 DOM/Canvas2D 直写（高频 HUD/小地图） | React 重渲染不适合每帧更新 |
| ADR-006 AI 决策 | **有限状态机 FSM + 分帧更新**，不做行为树/GOAP | 需求仅 5 类行为，FSM 足够 |
| ADR-007 TS 版本 | 锁 **5.9.x**，不上 TS 7（native preview） | npm 最新 7.0.2 为 Go 原生移植，工具链未稳 |
| ADR-008 构建 | Vite（锁 7 稳定线）+ 零后端静态部署 | 纯前端无服务端依赖 |

### 1.3 引擎边界（防"引擎漂移"，CI lint 强制）

- 渲染层**只允许** import `three`；`render/` 目录之外出现 three import 即 lint error。
- 需自建渲染基建（每项 <150 行）：场景对象池、LOD 管理、阴影相机跟随、毒圈/弹道特效材质、调试 HUD 覆盖层。

---

## 二、场景设计结论（仿真与表现分离 + 确定性架构）

### 2.1 总体架构（最重要的一条决策）

玩法逻辑全部运行在**无 DOM 依赖的确定性仿真核心**中，Three.js 只做「快照 → 场景对象」映射，UI 只读事件流。分层自下而上：

```
UI 层（React 低频） + HUD/小地图（DOM/Canvas2D 高频直写）
        ↑ GameEvent 事件流
表现层 render/（Three.js r185）：场景·资源·LOD·相机·特效·对象池
        ↑ 每 rAF 只读 WorldSnapshot
仿真核心 core/（纯 TS，零 DOM 依赖，Node 可直接运行）
        fixed tick 50Hz · seeded RNG · ECS-lite
        ↑ PlayerIntent 指令流
输入层 input/ ＋ 内容层 content/（配置表 JSON）
```

三条关键推论：
1. **仿真核心不 import Three.js** → AC2/AC3/AC4/AC5 可在 Node + Vitest 中直接跑满局自动化断言（这是整个测试策略成立的前提）。
2. 渲染层崩溃/加载失败不推进仿真状态；渲染层可整体降级为占位几何。
3. UI 只消费事件，不回写仿真状态，杜绝 UI 驱动逻辑。

### 2.2 目录结构与依赖方向（CI 强制，违反即 lint error）

| 模块 | 可依赖 | 禁止依赖 |
|---|---|---|
| `core/`（loop/rng/world/events/systems） | `content` | `render` `ui` `input` `three` `react` |
| `content/`（weapons/loot/zone/map/constants） | — | 其他所有模块 |
| `render/` | `core` 类型、`three`、`content` | `ui` |
| `input/` | `core` 类型 | `render` `ui` |
| `ui/` | `core` 类型与事件 | `core` 内部实现细节 |

### 2.3 双循环确定性模型（性能与可复现的骨架）

```
rAF 渲染循环（可变，浏览器驱动）
 ├─ 累积器 accumulator += dt
 ├─ while (accumulator >= 20ms && catchUp < 3) core.tick()   // 固定 50Hz
 ├─ catchUp ≥ 3 → 丢弃积压并告警（防死亡螺旋，宁降速不雪崩）
 ├─ renderer.render(scene, camera)
 └─ 渲染层用 alpha = accumulator/TICK_MS 做位置插值（消除 50Hz 抖动）
```

- 逻辑 tick **50Hz（20ms）**：射击/掉血精度足够（AC4/AC5 按秒结算），比 60Hz 省 17% 逻辑开销。
- 插值只做渲染层位置/朝向 lerp，**不插值逻辑状态**，保证回放与断言用纯逻辑状态。
- 确定性铁律：所有随机数来自 **seeded RNG**（xoshiro128\*\* 或 mulberry32），`Math.random()` 与 `tick()` 内 `Date.now()`、DOM 访问全部禁止（lint 层面强制，破坏禁令的 PR 直接打回）。
- 随机流隔离：跳伞气流/AI 行为/物资生成由同一 rng 流的不同**子流**驱动（`rng.fork('loot')` / `rng.fork('ai')`），避免行为改动影响物资分布。
- 回放协议免费获得：录制 `{seed, contentPackVersion, intents[]}` 落 JSON，同 seed 同意图序列必然逐帧一致——bug 复现与 AC2 断言共用此机制。

### 2.4 场景与对局规模参数

| 项 | 数值 | 说明 |
|---|---|---|
| 地图尺度 | **1.6km × 1.6km** | AC2 落点容差 5% = 80m |
| 地形 | 程序化高度场 + 区域划分（城区/野区） | 无真实地形资产 |
| 建筑 | AABB 占位体 | 配合分离轴碰撞（先 X 后 Z + 速度钳制） |
| 对局规模 | 玩家 1 + AI 10~19，实体上限 20 | N5 |
| 单局时长 | < 10 分钟自然结束（AC1） | 缩圈 6 阶段总时长约束保证 |
| 美术 | 程序化几何 + 免费低模占位 | 范围裁剪：不做骨骼动画/联网/账号，AC 全部为数值/流程验收 |

### 2.5 仿真系统与 tick 执行顺序（core/systems）

| 顺序 | System | 职责 |
|---|---|---|
| 1 | lifecycle | 对局状态机 lobby→parachuting→playing→ended；胜负判定（仅剩 1 存活） |
| 2 | parachute | 运输机航线、四阶段（自由落体→开伞→滑翔→落地）物理 |
| 3 | movement | 地面移动、高度采样、AABB 碰撞 |
| 4 | combat | 射击节流、弹道射线、命中判定（包围盒+部位+距离衰减）、换弹/切枪 |
| 5 | loot | 按区域密度生成、拾取判定、背包容量/丢弃、护甲减伤/医疗回血 |
| 6 | zone | 缩圈阶段表、圈心/半径插值收缩、圈外按秒掉血 |
| 7 | ai | FSM（patrol/loot/seek/fire/fleeZone/dead）+ 轮转分帧决策 |

**AI 与玩家共用同一套 PlayerIntent 与同一套 systems，AI 不走特权通道**——这条约束使"AI 也会被淘汰/也会避毒"天然成立，也让 AC4 命中率可用 AI 对 AI 对局复现验证。

核心契约（`MatchHandle`）：`tick(intents[])` 推进 / `snapshot()` 只读快照（渲染唯一数据源）/ `drainEvents()` 事件消费 / `status()` / `result()`（排名/淘汰数/用时）。

---

## 三、武器系统设计结论（AC3/AC4 数值基准）

### 3.1 WeaponDef schema（content/weapons.ts）

```ts
interface WeaponDef {
  id: WeaponId; category: 'ar' | 'smg';
  damage: number;        // 基础伤害
  rpm: number;           // 射速（发/分）
  magazine: number;      // 弹匣容量
  reloadMs: number;      // 换弹时间
  recoil: number;        // 后坐力系数 0..1
  effectiveRange: number;// 有效射程 m，超出伤害线性衰减至 50%
  spread: number;        // 散布 rad
  projectileSpeed: number; // 弹速 m/s（射线扫描命中判定）
}
```

### 3.2 双武器初始数值（彼此可区分是 AC4 验收点）

| 参数 | 步枪 `ar_m4` | 冲锋枪 `smg_ump` |
|---|---|---|
| damage | 26 | 18 |
| rpm | 620 | 850 |
| magazine | 30 | 25 |
| reloadMs | 2200 | 1800 |
| effectiveRange | 350m | 120m |
| recoil | 0.45 | 0.30 |

### 3.3 命中与伤害结算规则

- **部位倍率**：头 2.5 / 躯干 1.0 / 四肢 0.75；生命值归零即淘汰（cause: shot | zone）。
- **距离衰减**：超出 effectiveRange 后伤害线性衰减至 50%。
- **命中判定**：弹道射线扫描（projectileSpeed）+ 目标包围盒，静止目标有效射程内命中率 ≥90%（蒙特卡洛 1000 发自动化断言）。

### 3.4 物资与防具医疗数值（AC3 基准）

| 项 | 数值 |
|---|---|
| 护甲（躯干减伤） | 0.35 |
| 头盔（爆头减伤） | 0.5 |
| 医疗包 | +60 HP，使用 3000ms |
| 物资种类 | 武器/弹药/护甲/头盔/医疗包/投掷物，均带 gridCost 背包格占用 |
| 生成规则 | 按 zone 分区密度 + 权重池（LootTableDef），生成数量/种类必须与表断言一致 |
| 生效时机 | 拾取即生效：装备武器立即可射击、穿甲减伤、医疗回血 |

### 3.5 缩圈配置（AC5 基准，ZoneConfig）

- 首圈半径 **600m**，每阶段半径乘数 **0.65**，圈心随机偏移比例 0.4。
- 6 阶段圈外 dps：`[0.4, 0.8, 1.5, 2.5, 4, 6]`（逐阶段递增，验收断言点）。
- 等待/收缩秒：`[60/40, 50/35, 40/30, 35/25, 30/20, 25/15]`（合计 < 10 分钟，反推满足 AC1）。
- HUD 实时显示当前圈、下一圈轮廓与阶段倒计时。

---

## 四、60FPS 性能红线（超预算即视为性能缺陷）

### 4.1 硬红线指标（N1/N4 推导，验收工具：调试 HUD）

| 预算项 | 目标值 | 硬上限 | 红线含义 |
|---|---|---|---|
| 帧率 | 桌面 **60 FPS**；移动 ≥30 FPS | — | N4，M0 DoD 即要求空对局 60FPS 稳定 |
| 单帧 draw calls | < 120 | **150** | 超 150 判性能缺陷 |
| 单帧三角形 | < 400k | **800k** | — |
| 逻辑 tick 单帧耗时 | < 3ms | **8ms**（超限告警） | tick 超时会挤压渲染预算 |
| 首包 JS（gz） | < 800KB | **1.2MB** | 支撑 N1 首屏可交互 ≤5s |
| 纹理内存 | < 200MB | **400MB** | — |
| 首屏可交互 | ≤ 5s（桌面宽带） | — | N1，免安装定位的底线 |

### 4.2 画质三档定义（Medium 为默认）

| 参数 | Low | Medium（默认） | High |
|---|---|---|---|
| 像素比 | min(dpr,1)×0.75 | min(dpr,1) | min(dpr,2) |
| 阴影 | 关闭 | 1 级跟随相机 1024 | 2048 + 更远投影 |
| 视距/雾 | 300m 雾浓 | 600m | 1200m |
| LOD 切换距离 | 收紧 50% | 基准 | 放宽 30% |
| 植被/物资实例化密度 | 40% | 100% | 100% |
| 反锯齿 | 关 | 关（像素比补偿） | MSAA×4（WebGL2） |

默认档位：`navigator.userAgent` 粗分（移动→Low，桌面→Medium）；High 仅手动或设备探测通过后开启。

### 4.3 动态降档规则（render 层实现，与仿真无关）

- 采样窗口：每 **2 秒**计算平均 FPS 与 p95 帧时间。
- **降档**：连续 2 窗口 `FPS < 45` → 降一档（High→Medium→Low）；Low 后改为降分辨率 25%。
- **升档**：连续 5 窗口 `FPS > 58` → 升一档，每分钟至多一次（防抖动）。
- 每次档位变化写入调试 HUD 与 console，便于定位。

### 4.4 分帧与达标手段

- **AI 分帧**：决策每 tick 只更新 **1/4 实体**（轮转分片），感知与决策同频，移动每 tick 执行；单 tick 决策耗时预算 <3ms（M6 验收）。
- **毒圈掉血**：按秒结算（AC5 语义），tick 内累计时间再结算，不逐 tick 扣血。
- 渲染达标手段：地形/植被用 `InstancedMesh`；物资与建筑静态合批；阴影只投影主光；远处实体只更新朝向不更新动画。
- 兼容矩阵：桌面 Chrome/Edge/Safari/Firefox 完整；Android 中端机（≥4GB）Low/Medium ≥30FPS；iOS Safari Low/Medium（全屏/指针锁定需用户手势）；WebGL2 不可用直接降级提示页（不承诺 WebGL1）。
- 指针锁定（Pointer Lock）用于瞄准；Esc 退出后 UI 需提供"点击继续"重进。

### 4.5 可观测性（性能验收的测量工具）

内置调试 HUD（`?debug=1`，Release 默认关闭），M0 交付时必须可用：FPS/平均与 p95 帧时间/tick 耗时与漂移/draw calls/triangles/纹理内存/实体数/AI 状态分布/当前画质档与最近切换原因；支持 `?seed=123&replay=xxx` 固定种子与回放。

---

## 五、里程碑与执行对齐（开发节点照此排期）

```
M0 地基(0.5w) → M1 跳伞(1w) → M2 移动+地图(1w) → M3 物资(1w)
→ M4 射击(1w) → M5 缩圈(0.5w) → M6 AI(1w) → M7 闭环+调优(1w)   合计 ≈ 7 周
```

| 里程碑 | 关键交付 | 硬验收（DoD） | AC |
|---|---|---|---|
| M0 地基 | 50Hz 确定性循环、seeded RNG、事件总线、调试 HUD、CI + 依赖方向 lint | 空对局 60FPS；core 内 Math.random/Date.now 被 lint 禁止；HUD 可见 | — |
| M1 跳伞 | 四阶段跳伞、落点控制 | 同 seed 同输入落地坐标逐 tick 一致；落地 1s 内 state=ground；偏差 ≤80m | AC2 |
| M2 移动+地图 | 高度场、城区/野区、AABB 碰撞、第三人称相机 | 60FPS；不穿墙不穿地；draw calls<120 | — |
| M3 物资 | 密度生成、拾取、背包、防具医疗生效 | 生成符合权重表；数值与配置一致 | AC3 |
| M4 射击 | 武器表、弹道命中、部位/距离衰减 | 静止目标命中率 ≥90%（1000 发）；武器参数可区分 | AC4 |
| M5 缩圈 | 阶段表、插值收缩、按秒掉血、HUD 圈轮廓 | 各阶段参数与表一致且 dps 递增 | AC5 前半 |
| M6 AI | FSM 六状态、感知索敌、分帧 | AI ≥10；完成落地→拾取→交火→避毒路径；决策 <3ms | AC5 对抗 |
| M7 闭环 | 胜负结算、录制回放、降档、回归 | 10 局采样 100% 自然结束 ≤10min；性能预算全达标 | AC1 + AC5 胜负 |

依赖：M1→M2→M3→M4 串行；M5 仅依赖 M2 可与 M4 并行；M6 依赖 M3/M4/M5；M7 收口。每个里程碑必须以"可运行 + 可验收"结束，禁止跨里程碑堆叠未验证功能。

测试策略三层：**Node 仿真断言为主**（core 零 DOM → 无需浏览器、可进 CI、覆盖 AC2/3/4/5 全部数值）；Playwright 性能冒烟仅 M0/M2/M7 各一次（读 HUD 断言预算，不逐帧比对画面）；人工体验走查仅 M7。

---

## 六、风险红线与待核实事项（实现前必须确认）

| 风险 | 触发条件 | 对策 |
|---|---|---|
| 跳伞手感调不平（AC2） | M1 连续 3 天不收敛 | 空气阻力模型参数化（content 暴露 drag/glide）+ 落点预览圈 UI |
| AI 交火强弱失衡 → 单局时长失控 | M6 采样 >12min 或 <4min | AI 反应延迟/命中率/搜索半径进配置表，M7 十局采样调参 |
| 移动端帧率不达标 | 中端机 Medium <30FPS | 自动降档兜底；Low 档为硬底线（关阴影+降分辨率） |
| 自研碰撞穿墙/卡墙 | M2 冒烟出现 | 先 X 后 Z 分离轴 + 速度钳制；缺陷用回放文件复现 |

**M0 前必须核实的 3 项**（本文数值以官方文档/公开资料为据，非实测）：
1. Three.js 核心 gz 体积与真实首屏时间——用实际 `vite build` 产物复核并回填 4.1 的首包红线。
2. iOS Safari WebGL2 在目标最低机型上的表现——不达标则 iOS 锁 Low 档。
3. Pointer Lock 在平台预览 iframe 中的可用性——若被禁，降级"鼠标移动=视野"方案并记录。

## 七、二期演进预留（本期不做，只留边界）

- **多人联机**：`tick(intents)` 已解耦输入与状态，二期将本地输入替换为远端指令流（客户端预测 + 服务器权威），core 无需重写——这是确定性设计免费换来的关键预留；二期联机选状态同步，不依赖 lockstep（跨设备浮点一致性本期不承诺）。
- **载具/复杂物理**：movement system 内部可替换为 Rapier，对外仍走 PlayerIntent。
- **内容扩量**：content 配置表即内容管线，新增武器/物资/地图不改代码。
- **存档/战绩**：结构化 MatchResult 直接对接后端传输层。

---

*版本 v1.0 ｜ 2026-08-30 ｜ 依据 PR #8（commit ec48f16）架构方案固化；术语与规范以《「和平精英Web版」核心玩法需求》与本方案原文为准。*

## 沉淀知识：和平精英Web版两次开发失败复盘与pubg-web-core串行开发规范

# 沉淀知识：和平精英Web版两次开发失败复盘与pubg-web-core串行开发规范

> **适用功能线**：branchKey=`pubg-web-core`（和平精英Web版核心玩法）
> **版本**：v3（2026-08-31。演进：v1《小步串行开发与防超时规范》→ v2《串行小步开发规范与两轮失败复盘》→ v3 并入第三轮「换流程外壳仍失败」的实证与 Agent 兜底成功案例，固化**串行开发、禁止并行分支**红线）
> **权威技术基准**：《Web大逃杀技术方案与性能红线》（知识 id=6439fc3e-9217-4004-b091-aa79a6f9bcab）＋ 架构方案 PR #8（产物 id=cmos298dg0001m9mxandnum2z，repo hl3w22bupt/myrd-playground，Three.js r185 + Vite 7 + TS 5.9.x + 50Hz 确定性仿真核心 + seeded RNG）
> **需求基线（唯一需求来源）**：《和平精英Web版（pubg-web-core）收敛总需求：稳定60FPS+画面够看+核心玩法完整闭环》（id=cmtg6bxv6003ym9hav1sxej1e，branchKey=pubg-web-core）
> **用途**：约束本功能线所有开发节点的立项方式、分支策略、步长与门禁分级，固化三轮失败根因与已验证的补救路径，供后续迭代直接复用，防止同类失败重演。本规范管「怎么不掉链子」，技术基准文档管「怎么做对」。

---

## 一、三轮失败全景（开发类运行 9 次：7 败 2 成）

### 1.1 第一轮：全量口径（规范产生前）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 1 | 实现核心玩法（跳伞/拾取/射击/缩圈/AI 全量） | ❌ failed | cmtfz3zu70016m9ha4wldebwo | **单次任务过重**：5 大玩法模块塞进一个节点；且无独立需求基线 |
| 2 | 优化画面与流畅度 | ❌ failed | cmtfz6s9k001dm9hatl10qx9b | **目标混合**：画面表现 + 性能红线两类验收口径同节点，失败无法归因 |
| 3 | 实现最小可玩闭环（需求 id=cmtg05te2001zm9hamye40r6u） | ✅ completed | 见功能线运行记录 | 先立项收敛需求、边界明确、验收口径单一（正面样本） |

### 1.2 第二轮：小步口径（v1 规范执行后，3 步全败）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 4 | 第1小步·性能修复（稳定60FPS） | ❌ failed | cmtg2wvet002tm9hagm2awqhj | **空仓库起步** + **完整E2E门禁过重** |
| 5 | 第2小步·画面升级（材质光照雾效粒子+HUD） | ❌ failed | cmtg3pefz0034m9hahhlpy86p | 小步体量 × 全量门禁，单次运行预算失衡 |
| 6 | 第3小步·玩法补齐与缺陷修复（最终E2E+PR） | ❌ failed | cmtg5bzsp003jm9ha5876khnw | 同上，且前两步无合入成果可叠加，修复失去基线 |

（第 5、6 步之间插入一次成功的「代码审查」Agent 联合审查：审查前两步变更并输出缺陷清单，产物 id=cmst009ls000am9jmyk8ylfil —— 「轻实现 + 专项审查」组合是可行的补充通道。）

### 1.3 第三轮：换流程外壳（v2 规范执行后，仍败）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 7 | pubg-web-core 分支叠加「画质与60FPS性能优化」 | ❌ failed | cmtg8kgc3004zm9hawlb9kvxo | 双目标（性能+画面）混合 + 「实现+完整E2E门禁」整链仍压在单次运行 |
| 8 | 第1小步·性能修复（流程变体：开发测试→审查→人工确认→创建PR） | ❌ failed | cmtg6jkbc004am9hauxsfe20k | **流程外壳变了，预算约束没变**：仍要求单次运行装下 实现+全量门禁，且未先拉取既有实现 |

**第三轮结论（v3 新增）**：失败与「流程里有没有审查 / 人工确认环节」无关，与「单次运行预算能否装下 实现 + 门禁」有关。给同一摊子加环节只会更重，不会更稳。有效解法只有四个：收敛范围、拆小步、门禁分级、换执行通道（Agent 兜底）。

### 1.4 根因归纳（跨三轮稳定复现的 3 + 1 条）

1. **空仓库起步**：开发工作流未先 `git fetch origin pull/<PR号>/head:pr-<PR号>` 拉取既有实现（PR #8 架构 + 已合入的最小可玩闭环 + PR #9 补齐成果），在空仓库上从零重复搭地基，把宝贵的单次运行时长消耗在与本步目标无关的工作上。
2. **单次任务过重**：第一轮是「节点肥」（多模块/多口径混装）；第二、三轮节点已瘦，但「实现 + 全量门禁」整条链仍压在同一个单次运行里，链条总重没降。
3. **完整E2E门禁过重**：小步场景下「lint + 全量单测 + Node 全流程自动化断言 + 构建 + 冒烟」成本占比畸高，直接挤爆单次运行时间窗，是二、三轮连败的直接放大器。v2 已修订为门禁分级（见第三节规则 3）。
4. **只换流程外壳无效（v3 新增）**：第三轮改用含「审查 + 人工确认」的流程变体（run cmtg6jkbc004am9hauxsfe20k）依旧失败。诊断失败时先看三件事——仓库基线是否为空、单次运行装了哪些活、门禁多重——而不是流程叫什么名字。

---

## 二、补救路径（逐条标注验证状态）

| # | 动作 | 验证状态 | 证据 |
|---|---|---|---|
| 1 | **需求固化**：失败动作立为正式需求基线，目标不悬空 | ✅ 已验证 | 收敛总需求 id=cmtg6bxv6003ym9hav1sxej1e（branchKey=pubg-web-core，统一修正 `pubb-web-core` 笔误） |
| 2 | **收敛范围**：把大目标收敛为边界单一的最小可玩闭环 | ✅ 已验证 | 需求 id=cmtg05te2001zm9hamye40r6u → 对应 run completed（9 次开发运行中 2 次成功之一） |
| 3 | **同 branchKey 串行叠加**：后一步基于前一步已合入成果 | 📌 已固化为红线 | 第三节规则 1；本功能线后续节点一律复用 branchKey=pubg-web-core 串行执行 |
| 4 | **Agent 兜底**：工作流连续失败后由 @开发Agent 直接接管 | ✅ 已实证 | 「开发与测试Agent」检查分支产物、补齐缺失玩法与性能缺口并提 PR → completed，PR #9（产物 id=cmst009lq0009m9jmg3e4zh9l） |
| 5 | **审查前置**：先联合审查既有变更，输出缺陷清单再修 | ✅ 已实证 | 代码审查Agent 缺陷清单（产物 id=cmst009ls000am9jmyk8ylfil），修复步以其为输入，禁止盲修 |
| 6 | 仅更换流程外壳（增加审查/人工确认环节） | ❌ 已证伪 | 第三轮 run cmtg6jkbc004am9hauxsfe20k 含上述环节仍 failed |

---

## 三、硬性规则（v3 红线，违反即打回）

### 规则 1：branchKey 复用 + 单分支串行，严禁并行分支

- `pubg-web-core` 功能线的**所有开发节点必须复用 branchKey=pubg-web-core**，按需求 id 复核绑定后串行执行（检索绑定时注意历史需求存在 `pubb-web-core` 拼写笔误，一律以需求 id 为准）。
- **同一时间窗内本功能线只允许一个进行中的开发节点；严禁并行新开分支改同一批文件。**「pubg-web-core 必须串行开发、禁止并行分支」是本功能线的强制约定，不是建议。
- 后一节点必须基于前一节点**已合入**的成果（N-1 的 merge commit 是 N 的基线）；前一步未合入，后一步不得开工。
- 理由：并行分支 ① 同一批文件互相覆盖、合并冲突；② 没有已合入基线可叠加（第二轮第 3 小步失败的直接诱因之一）；③ 诱发空仓库起步，重复搭地基浪费单次运行预算。

### 规则 2：小步提交，每步只做一件事

- 每步目标在 **性能（performance）/ 画面（visual）/ 玩法（gameplay）** 三类中**三选一**，禁止混合；单步改动规模以「一次运行内能完成 实现 + 轻门禁」为上限。
- **开工前必须先考古**：`git fetch origin pull/<PR号>/head:pr-<PR号>` 核实既有实现（当前可复用：PR #8 架构、最小可玩闭环、PR #9 补齐成果），能复用就复用，**禁止空仓库起步**。
- 术语与数值只认权威技术基准（知识 id=6439fc3e-…），新数值落 `content/` 配置表并配测试断言，禁止硬编码。

### 规则 3：门禁分级（修订 v1 规则 3）

- **小步（实现步）→ 轻门禁**：lint + 本次改动相关单测 + 冒烟；不跑全量 Node 自动化断言。
- **收口步 → 完整 E2E 门禁（重门禁）**：lint + 全量单测 + Node 全流程自动化断言 + 构建 + 冒烟 + PR。
- **门禁预算前置**：开工前估算「实现 + 门禁」总耗时；预估超出单次运行预算就先拆步，不指望运行中途省时间。

### 规则 4：失败必须固化

- 任何 run_workflow 失败后，要么固化为需求基线（如收敛总需求 cmtg6bxv6003ym9hav1sxej1e），要么沉淀/更新为知识规范（即本文档）；不允许目标悬空后无人认领。

### 规则 5：连续失败切换执行通道（兜底阈值，v3 新增）

- **同一小步的 run_workflow 连续失败 ≥2 次 → 停止重试工作流**，改由 @开发Agent 直接接管该小步（考古既有实现 + 实现 + 轻门禁 + 提交/PR）；工作流通道留给收口与验证。
- 依据：第二轮 3 连败、第三轮 2 败期间，Agent 通道已实际交付 PR #9——兜底通道不是理论，是被验证过的交付路径。

---

## 四、推荐节点拆分（v3：拆分与门禁级别沿用 v2）

| 顺序 | 节点 | 目标类型 | 门禁级别 |
|---|---|---|---|
| P0 | 仿真核心骨架与确定性底座（50Hz fixed timestep + seeded RNG + ECS-lite + MatchHandle + 依赖方向 lint） | 玩法 | 轻门禁 |
| P1 | 3D 地图与移动碰撞（1.6km² 高度场、城区/野区、AABB 建筑） | 玩法 | 轻门禁 |
| P2 | 跳伞落地四阶段（航线 + 自由落体→开伞→滑翔→落地，落点可复现） | 玩法 | 轻门禁 |
| P3 | 物资拾取与背包（区域密度、容量/丢弃、护甲减伤/医疗回血） | 玩法 | 轻门禁 |
| P4 | 武器射击命中（ar_m4 / smg_ump、弹道射线 + 包围盒、部位/距离衰减） | 玩法 | 轻门禁 |
| P5 | 缩圈毒圈（≥3 阶段收缩、圈外按秒递增掉血、HUD 倒计时） | 玩法 | 轻门禁 |
| P6 | AI 敌人与胜负结算（≥10 AI FSM、共用 PlayerIntent、唯一存活者结算） | 玩法 | 轻门禁 |
| P7 | 性能优化（稳定60FPS、1% 最低帧、内存不泄漏） | **性能** | 轻门禁 |
| P8 | 画面表现提升（材质/光照/雾效/粒子/HUD） | **画面** | 轻门禁 |
| 收口 | 最终 E2E + PR（AC1–AC4 全量断言） | 混合验收 | **完整 E2E 门禁** |

排序原则：先玩法闭环（P0→P6 串行补齐），再性能（P7），再画面（P8），最后收口跑重门禁。任何节点失败只影响该节点，已合入成果不回退；P0–P8 期间禁止顺手做别的类型的事。

---

## 五、关联产物索引

| 类型 | id / 标识 | 说明 |
|---|---|---|
| 需求（第一轮基线） | cmtfyd7uc000im9hapib6ann3 | 「和平精英Web版」核心玩法需求（跳伞/拾取/射击/缩圈/AI 对抗） |
| 架构方案 | PR #8，产物 cmos298dg0001m9mxandnum2z | 技术选型与目录/依赖方向约定（repo hl3w22bupt/myrd-playground） |
| 知识（技术基准） | 6439fc3e-9217-4004-b091-aa79a6f9bcab | Web大逃杀技术方案与性能红线（数值唯一依据） |
| 需求（最小可玩闭环） | cmtg05te2001zm9hamye40r6u | branchKey 登记 `pubb-web-core`（笔误，绑定一律以需求 id 复核）；对应 run 成功 |
| 需求（收敛总需求，当前唯一来源） | cmtg6bxv6003ym9hav1sxej1e | 稳定60FPS + 画面够看 + 玩法完整闭环，branchKey=pubg-web-core |
| 失败 run（第一轮·全量口径） | cmtfz3zu70016m9ha4wldebwo / cmtfz6s9k001dm9hatl10qx9b | 单次任务过重 + 目标混合 |
| 失败 run（第二轮·小步口径） | cmtg2wvet002tm9hagm2awqhj / cmtg3pefz0034m9hahhlpy86p / cmtg5bzsp003jm9ha5876khnw | 空仓库起步 + 完整E2E门禁过重 |
| 失败 run（第三轮·换流程外壳） | cmtg8kgc3004zm9hawlb9kvxo / cmtg6jkbc004am9hauxsfe20k | 双目标混合 / 外壳变了预算没变 |
| Agent 兜底成果 | PR #9，产物 cmst009lq0009m9jmg3e4zh9l | 开发与测试Agent 补齐缺失玩法与性能缺口并提 PR（兜底通道实证） |
| 审查产物 | cmst009ls000am9jmyk8ylfil | 前两步变更联合审查缺陷清单（修复步输入，禁止盲修） |
| 知识（流程规范·本文档） | b44145e4-6dda-4f92-8741-e0c8bf3dc6b6 | v3：串行开发禁并行分支 + 三轮失败复盘 + 已验证补救路径 |

---

## 六、适用边界

- 本规范**强制适用于** `pubg-web-core` 功能线及其全部后续开发节点；新增玩法/优化项按第四节模式继续追加串行小步。
- 其他项目/功能线可参照**方法论**：branchKey 复用串行、单步单目标（性能/画面/玩法三选一）、门禁分级（小步轻、收口重）、开工先考古禁空仓库起步、审查前置、连续失败即切 Agent 兜底、失败即固化；节点拆分与 AC 划分按各自需求基线重划，不照抄 P0–P8 清单。
- 本规范与《Web大逃杀技术方案与性能红线》（6439fc3e-…）互补：那份管「怎么做对」，这份管「怎么不掉链子」。


## Agent 与 Agent 驱动游戏研发调研报告：Mobius 仓库 × 三篇文章设计对比与可借鉴点

> 沉淀自目标 DAG「mobius 调研 → 沉淀知识 → 方案设计 → 需求 → 开发」（goal `cmtmvs3u0000ejqjst3gc2cmf`）。本文对应调研节点产物 `cmsk2tgmn0000m9rrqdhia5nl`（产品及商业化军师产出），由目标管理大师于 2026-09-04 固化入库，供后续「方案设计 / 需求 / 开发」节点直接检索引用。

# Agent 与 Agent 驱动游戏研发调研报告：Mobius 仓库 × 三篇文章设计对比与可借鉴点

## 0. TL;DR（30 秒版）

- **Mobius 根本不是游戏项目**——它是通用「自进化 Agent OS」。它解决了「怎么组织多个 agent」，但对「游戏研发」这个领域零结构：整个仓库没有任何引擎、关卡、美术管线、玩法验证的痕迹。
- 三篇文章恰好补上领域那一半：网易证明「**知识先于生成**」；腾讯云给出「**结构化策划案 → 可玩原型 → 资产 → 引擎**」的领域管线；触乐证明「**开发不再是瓶颈，判断/验收才是**」。
- 第一结论：**通用组织能力（Mobius 已验证可行）+ 领域结构（三篇文章证明是价值所在）= 我们该做的东西。只抄任何一半都会死。**
- v1 最小闭环：结构化策划案 schema → 带 QA 互查的 Web 原型生成 → 可玩链接 + 人工验收 checklist；组织上用 1 首席 + 策划/程序/QA/美术四职能 + 共享黑板；知识层从三级 Skill/Memory 起步。引擎移植、自进化、数据回流全部留给后续版本。

## 1. 调研来源与范围

| 来源 | 类型 | 读完的部分 |
|---|---|---|
| mobius-system/mobius | 开源仓库 | README、文档总览、研究团队教程、技能/记忆机制教程 |
| 文章A：网易《游戏研发中的 AI 转型：多 Agent 系统与知识工程实践》（林香鑫，AICon 演讲） | 大厂中台视角 | InfoQ/公众号全文 |
| 文章B：腾讯云林哲《基于 AI Agent 的小游戏开发实践》 | 云厂商产品视角 | GameLook 专稿全文 |
| 文章C：触乐《当 AI 开始重写小游戏生产流程》 | 独立开发者+行业视角 | 36氪转载全文 |

**范围偏差声明（重要，后续节点必读）**：军师执行时未拿到目标描述中的 3 个 mp.weixin 原始链接，按「Agent 游戏研发」主题自选了上述三篇替代文章。目标原始链接之一经秘书预判为 **Claude of Tanks**（agent 驱动游戏研发标杆案例，要点：126 辆战车一份规格数据喂给所有消费端的单一数据源、确定性种子模拟、客户端提交输入/服务器裁定事实的权威仲裁架构、Tank Gallery/Scene Studio 内容检查工具、契约测试门槛）。后续「方案设计」节点若需覆盖原始链接来源，需对 Claude of Tanks 补研；本报告三大主线结论（组织 × 领域 × 验收）不受影响。

## 2. 四个研究对象的设计拆解

### 2.1 Mobius（mobius-system/mobius）

- **定位**：首个开源自进化 Agent OS。把模型、agent、项目、设备、算力连进一个工作网络，会随使用改写自身代码/UI/插件，每次改动可追溯（部署时建议 fork，自进化后可提交回自己仓库）。
- **组织模型（两层）**：
  1. `@` 跨会话连接——事后补建，点对点，可选「只读引用」或「双向交流」；
  2. 智能体群——事前预设，多 agent 共享「群黑板」自主分工。研究团队形态：1 首席（不可删，负责拆解+整合）+ 最多 12 助理，逐成员配模型/职责/Skill 与 Memory 范围。
- **知识层**：Skill/Memory 三级作用域（内置/用户级/项目级），会话创建时勾选、中途可追加——本质是**提示词级注入**，没有代码级知识图谱。
- **管控层**：巡检/鞭策防 agent 偷懒、模型调用限频（token proxy）、危险操作人工审批与无人值守 agent 分开——「拆成多个 agent 各守边界，别把两套要求塞进一个上下文」是它的核心论点。
- **架构**：tmux 会话为底座，编码 agent（Claude Code/Codex/GLM harness）被 OS 编排，Node/TS 后端 + SQLite + Web/Electron/TUI 三端。模型完全解耦。

### 2.2 文章A：网易《游戏研发中的 AI 转型：多 Agent 系统与知识工程实践》

- **核心洞察**：内部大规模调研发现，游戏研发最大时间成本不是写代码，而是**理解代码**（千万行仓库、20% 时间花在问人）。所以先做知识，再做生成。
- **设计**：显性知识（文档/工单/仓库归集 → agentic RAG）+ 隐性知识（AST + 调用流 → 代码知识图谱，工单↔提交记录打通）；「研发空间」把团队隐性规范显性化（SDK 版本、引擎代码、编码风格）；Core Agent 协调一批「项目风格化」子 Agent。
- **金句级论断**：「Agent 架构最后的差异不会太大，真正重要的是你给 Agent 提供了什么上下文。」
- **AI Review 演进**：prompt 工程（1000 个问题只有 10 个有效）→ 静态分析+大模型双引擎 → multi-agent 过滤分级 → 注入知识工程 → 少而精。「白天人写代码，晚上 AI 审查」。
- **数据**：团队工具月产 500 万行代码、覆盖几十个项目；新人熟悉 4 万行代码从 2 周 → 1-2 天。

### 2.3 文章B：腾讯云林哲《基于 AI Agent 的小游戏开发实践》

- **核心洞察**：
  1. 玩法验证有沉没成本，MVP 验证前参与人数要最少；
  2. **WebGame 技术栈对 LLM 最友好**（20 年成熟度、模型知识充分、代码即资产、浏览器即预览）。
- **流水线**：专家中心（岗位化 Skill+知识库）→ 与专家对话迭代出结构化策划案 → 专家团（工程师生成 + QA 审核互查）一句话出可玩原型 → AI 生成**关卡可视化编辑页**（元素编号化，让自然语言修改有明确落点）→ 上下文贯穿：美术无需逐图写提示词，一句话替换全套资产 → 导出（策划案/数值/关卡/美术/源码）给 CodeBuddy → 引擎 MCP（Unity/Cocos/UE 已支持）+ Skill 划定 MCP 操作边界 → 图生视频抽帧解决序列帧动画。全程 2 天出 Cocos 版。

### 2.4 文章C：触乐《当 AI 开始重写小游戏生产流程》

- **事实**：个人开发者 1200 元 + 2 个月业余做出上线微信小游戏（Claude Code 写码、GPT/Gemini/豆包出图）；AI 广告素材成本不到传统 1/10，买量侧比研发侧落地更快；Sekai 上已有 1500 万个迷你应用，游戏正在变成 UGC 社交内容。
- **核心论断**：**开发不再是瓶颈，判断成了新门槛**。「AI 帮不了你的 4 件事」：产品决策（好不好玩）、新手引导设计（AI 不知道玩家为何困惑，90% 测试者看不懂的教训）、美术风格统一、平台合规审核。小游戏规模恰好规避了 AI 的上下文丢失问题（代码量小、平台单一）。

## 3. 设计对比（一张表）

| 维度 | Mobius | 网易 | 腾讯云 WorkBuddy | 行业/个人实践（文章C） |
|---|---|---|---|---|
| 定位 | 通用自进化 Agent OS | 企业内代码智能中台 | 垂直游戏原型流水线 | 单人工具链 + 平台生态 |
| 组织模型 | @点对点 + 群黑板，首席制 | Core Agent 协调风格化子 Agent | 专家团两两互查（工程+QA） | 无（单人+多工具） |
| 知识/上下文 | Skill/Memory 三级，提示词级 | **代码图谱+研发空间（最深）** | 会话上下文贯穿全流程 | 靠小游戏规模天然规避 |
| 领域结构 | **无（游戏零结构）** | 通用代码级 | **有（策划案→关卡→资产→引擎）** | 有（全流程+平台合规） |
| 验证/质量 | 巡检防偷懒（治意愿不治结果） | AI Review 少而精 | QA agent 互查 | **人工验收是硬瓶颈** |
| 商业形态 | 开源+自托管 | 内部效能（数据回流成壁垒） | 云产品（150+ 客户） | 平台抽成+流量分配 |

**空档清晰可见**：Mobius 有组织没领域，网易有知识没游戏管线，腾讯云有管线但绑定腾讯生态且只到小游戏原型。**「游戏领域的知识工程 + 开放的多 agent 组织」目前没人做全。**

## 4. 可借鉴点清单（按优先级，直接指导实现）

### P0 —— 决定产品形态

1. **上下文贯穿的单一事实源**：把策划案做成**机器可读的结构化工件**（世界观/关卡/数值/UI 的 schema），原型、美术、配表全部从它派生——这是腾讯云流程里最值钱的一步，也直接回应文章C「AI 不知道玩家为何困惑」：结构化设计文档就是人的产品决策的载体。
2. **知识先于生成**：v1 就要有项目知识层——目录结构语义化、引擎版本与 API、编码风格、命名表（网易「研发空间」+ Mobius 三级 Skill/Memory 作用域的合体）。没有这层，多 agent 就是并行的平庸。
3. **验收回路是一等公民**：生成 agent 与 QA agent 对抗互查（腾讯云）+ 可运行冒烟测试 + 人工 checklist。Mobius 的巡检只解决「偷不偷懒」，不解决「对不对」；三篇文章在这一点上完全一致：最终验收必须是人，产品要给验收者好用的工具而非更多产出。

### P1 —— 组织与执行

4. 双层协作照抄 Mobius：主策划 agent 与职能 agent 点对点单聊 + 共享黑板放关卡状态/资产清单/阻塞项。
5. **「让 AI 给 AI 造工具」**：AI 生成关卡可视化编辑页、元素编号化，把模糊的自然语言修改变成精确指令——这是文章B里最聪明的单个设计，成本低收益大。
6. Web-first 原型 + 引擎移植分段：v1 只做 Web 原型闭环（LLM 知识最充分、浏览器即预览），引擎移植（MCP+Skill 划边界）放 v2。
7. 管控照抄 Mobius：危险操作人工审批与无人值守 agent 分开、token 限频、按 agent 划边界——别把两套要求塞进一个上下文。

### P2 —— 长期壁垒

8. 数据回流：纠错数据、审查标记、验收结论沉淀回知识库（网易的闭环），配合 Mobius 式「每次改动可追溯」。这是唯一随时间复利的资产。
9. 把文章C列出的「AI 做不到的 4 件事」直接做成产品功能：新手引导工作流、风格参考卡库、合规材料 checklist——**人的新瓶颈就是你的收费点**。

## 5. 反面清单（不要做的）

- **不要先造通用 Agent OS 等游戏场景长出来**——Mobius 本身就是反例，通用平台对游戏零领域结构，网易也证明了价值全在领域上下文里。
- **不要拿「一句话自动出游戏」当核心卖点**——三篇文章一致证明验收/好玩靠人，宣传过头用户第一次用就失望。
- Mobius 的「自进化改自己源码」在多租户商业场景是安全与合规噩梦；**借鉴其审计与可追溯，不要借鉴「改自己」**。
- 别把「生成更多」当差异点：小游戏月提交已超 1 万款、审核排队 3 天起步——同质化和合规才是死穴，能帮「过审与验收」比能「生成」稀缺得多。

## 6. 给下一步实现的一句话指令

**v1 最小闭环 = 结构化策划案 schema → 带 QA 互查的 Web 原型生成 → 可玩链接 + 人工验收 checklist，组织上用 1 首席 + 策划/程序/QA/美术四职能 + 共享黑板，知识层从三级 Skill/Memory 起步。引擎移植、自进化、数据回流全部留给后续版本。**

## 7. 溯源与关联

- **目标**：`cmtmvs3u0000ejqjst3gc2cmf`（调研 → 沉淀知识 → 方案设计 → 录需求 → 开发工作流）
- **调研产物**：artifact `cmsk2tgmn0000m9rrqdhia5nl`（产品及商业化军师，2026-09-04）；完整报告原文存于该目标的 goal session 消息中
- **本文与验收标准的对应**：验收项「调研报告已沉淀为知识库文档，可通过『调研 / agent / mobius』相关标签检索到」由本文满足
- **相关知识文档**：《沉淀Web大逃杀技术方案与性能红线》《和平精英Web版两次开发复盘与串行开发规范》——文章B「WebGame 技术栈对 LLM 最友好」的判断与 MyRD 已有的和平精英 Web 实践相互印证
- **待补研**：目标描述中 3 个 mp.weixin 原始链接（其中之一为 Claude of Tanks，要点见第 1 节范围偏差声明）

## Sources

- [mobius-system/mobius](https://github.com/mobius-system/mobius)
- [网易多 Agent 与知识工程实践（InfoQ）](https://www.infoq.cn/article/psxyteixpjvwal89fmue)
- [腾讯云林哲：怎么用 AI Agent 开发小游戏（GameLook）](http://www.gamelook.com.cn/2026/06/595411/)
- [当 AI 开始重写小游戏生产流程（触乐/36氪）](https://m.36kr.com/p/3919432566779528)


## 沉淀AI女友剧情生存玩法设计基线

# 沉淀AI女友剧情生存玩法设计基线

> **依据**：需求《我被AI女友包围了》剧情生存挑战游戏需求（id=cmtob3m0p000pm9y6yl6yi1uq）＋ 游戏策划产物（id=cmtn5fhk20008jqck1thxilil）＋ 平台既有 Godot 工程约定（`games/godot-coin-rush`：六段式 GameDesignSpec / contract-check / verify.sh）＋ Godot 官方 Web 导出文档。
> **用途**：实现节点（开发/测试/部署）执行对齐的唯一设计基准。
> **冲突裁决规则**：需求硬约束 > 策划案原文（design-spec.md / design-spec.json）> 本文；发现偏差须回填本文（版本 +1）。
> **两条硬约束**：① godot headless 门禁 0 error 方可合并；② 构建产物必须在平台 AppHost 部署可启动、健康检查通过，禁止仅本地可跑的交付形态。

---

## 一、玩法定位与核心循环（AC1 落点）

**定位**：剧情驱动的生存挑战游戏。玩家扮演被多位 AI 女友包围的主角，通过对话抉择与状态管理在剧情推进中求生并走向多分支结局。

**核心循环（全项目唯一的循环定义，文案/实现/测试均以此表述为准）**：

```
剧情节点选择 → 好感度/威胁度/生存状态变化 → 触发后续剧情与结局分支 →（回到节点选择）
```

三条由循环直接推出的架构推论（策划案已确认，实现不得违背）：

1. **数据驱动**：人设卡、剧情节点、数值全部是 content JSON；逻辑只认 schema 与 `spec.numeric` 键名，不认具体角色与具体数值。
2. **可追溯**：每次结算写 trace，任何 AI 行为输出都能回放定位到 `persona_id` + 状态前后值。
3. **可验证**：验收一律落成契约测试断言（spec/persona/story/ending 四类 + smoke），不靠人工体感。

## 二、单一事实源：六段式 GameDesignSpec（平台既有工程约定）

- 落点 `.myrd/spec/design-spec.json`，六段：**meta / world / entities / levels / numeric / acceptance**。
- `entities[].script/scene`、`levels[].story_data`、`acceptance[].check` **声明的路径必须真实建出**，契约测试校验落点存在性。
- 数值只认 `spec.numeric`，键名与未来 `game_state.gd` 字段一一对应——改数值=改表，不改码。
- 策划案已交付内容（9 个内容 JSON + 2 份文档）：schema 契约 1 份 + 5 张人设卡 + 3 幕剧情（= 9 个 JSON），另有六段式 `design-spec.json` 与人读版 `design-spec.md`（含数值表、两条链路逐步演算、美术基线）。**策划阶段未产 Godot 代码，实现节点按 spec 施工。**

## 三、AI女友人设卡基线（AC2 落点）

- **schema 契约**：`games/ai-girlfriend-siege/data/schema/persona.schema.json`，**9 个必填字段**，覆盖并超出需求的 5 字段（姓名 / 性格标签 / 说话风格 / 好感度规则 / 威胁·危机行为模式）。
- **5 张基线人设卡**（`data/personas/persona-{lumi,vex,ada,momo,sera}.json`）：治愈 / 病娇 / 冷静 / 活泼 / 神秘 五型；字段含主题色、口头禅、`favor_rules`、`threat_rules`、`portrait_prompt`。
- **美术单一事实源**：立绘/形象资产只从 `portrait_prompt` 派生，禁止另行脑补设定——防止多 agent 并行产出美术与文案漂移。
- **解耦铁律**：`persona_loader` 只认 schema 不认具体角色 → **改人设卡免改码**。验收手段 = swap 测试（替换某张卡 JSON、零代码改动，门禁仍过且行为变化）。
- **可追溯格式**：`story_engine` 每次结算写 trace：`node_id / option_id / persona_id / favor·threat 前值与后值`，回放可定位到具体人设与状态。

## 四、剧情幕结构与结局分支（AC3 落点）

- **三幕骨架「包围 → 裂痕 → 倒计时」**：`data/story/act{1,2,3}.json`，共 **18 个节点**，节点图闭合无死链。
- 节点 / 选项 / 数值效果**全部显式声明**；effects 用声明式键值（Δfavor/Δthreat/flag/goto），**禁止节点内嵌脚本逻辑**——嵌逻辑即破坏可追溯与换卡免改码。
- **4 个结局**；其中 **2 条已逐步演算、可复现的可玩链路**（满足"至少 2 个不同结局"验收）：
  - **链路 A → 独活结局**：全程威胁累积 Σthreat 控制在幕级上限（<300）内，终局选逃跑；
  - **链路 B → 带走 Lumi 结局**：Lumi favor 终值 96 ≥ 70，且 threat 30 ≤ 60。
- 结局判定阈值基线（策划案演算使用值）：**favor 结局门槛 ≥70；单人 threat 结局门槛 ≤60；幕级 Σthreat 上限 300**。
- 结局判定由 `ending_contract.gd` 断言（对应 acceptance acc-5/acc-6）；冒烟测试用脚本驱动固定选择序列，跑出 ≥2 个不同结局即 AC3 达成。

## 五、生存循环与数值规则

- 状态三轴：**favor（好感度）/ threat（威胁度）/ 生存状态**；具体生存轴与衰减公式以 `spec.numeric` 为准，键名与 `game_state.gd` 一一对应。
- 每次选择的标准结算链：选项 effects 声明 Δ 值 → story_engine 结算 → trace 落账 → 门控判断下一节点/结局。
- 数值调优只改 `spec.numeric` 与人设卡 `favor_rules/threat_rules`，**任何数值调优不允许以改代码的方式实现**。

## 六、godot 门禁与 CI（AC4 落点）

**门禁三件套（全部 headless，0 error 才可合并；CI 拒绝含错误代码的提交）**：

1. **preflight**：环境与引擎版本预检；
2. **`godot --headless --import`**：资源导入完整性（坏资源/坏路径在此暴露）；
3. **smoke**：headless 跑冒烟 + 契约测试（spec / persona / story / ending 四件，先例即 `games/godot-coin-rush` 的 `contract-check.mjs` + `verify.sh` 模式）。

附加门禁规则：spec 中声明的落点（entities script/scene、levels story_data、acceptance check）必须真实存在；persona/story JSON 过 schema 校验，坏配置 = 门禁失败（让 AC2 的"≥5 字段结构化"变成机器可验证，而不是评审口径）。

## 七、Web 导出与 AppHost 部署规范（AC5 落点）

**引擎事实（Godot 官方文档，已核实）**：
- Godot 4.3 起，**单线程 Web 导出是官方默认推荐路线**：无需跨域隔离响应头、兼容性最好；
- 开启线程支持（SharedArrayBuffer）则硬性要求：HTTPS 安全上下文 + `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`。

**项目裁决规则**：
1. **默认锁单线程导出**；仅当 AppHost 可注入自定义响应头且走 HTTPS 时，才允许评估线程模式。
2. `.wasm` 必须 `application/wasm` MIME；index.html / wasm / pck 同源部署。
3. 体积与首屏预算：剧情游戏静态资源大头是**中文字体与立绘**——中文字体必须子集化；具体体积/首屏红线由实现节点导出实测后回填本文（不在无实测数据时空定数值）。
4. **健康检查**：交付包内置静态 `/healthz`（200 + `{status:"ok",version}`）；部署后 AppHost 探活通过 + 浏览器冒烟（canvas 出现、console 无 error）。
5. PWA service worker 可官方模拟 COOP/COEP，但增加缓存失效复杂度，AppHost 场景**默认不启用**。
6. 禁止 desktop-only / 仅本地可跑形态；未过健康检查的构建不得标记完成。

## 八、目录结构与依赖方向（CI 强制）

```
games/ai-girlfriend-siege/
  data/schema/persona.schema.json      # 契约：人设卡字段
  data/personas/persona-{lumi,vex,ada,momo,sera}.json
  data/story/act{1,2,3}.json           # 三幕节点图
  design/design-spec.md                # 人读版：数值表+链路演算+美术基线
.myrd/spec/design-spec.json            # 六段式单一事实源
```

依赖方向：`persona_loader` 只依赖 schema；`story_engine` 只依赖 `spec.numeric` 键名与 act JSON；UI 只读状态与事件流；**任何 .gd 禁止硬编码角色名或数值**（出现即 lint/评审打回）。

## 九、验收标准映射（AC → 基线落点）

| AC | 验收点 | 基线落点 | 自动化手段 |
|---|---|---|---|
| AC1 | 玩法定位+核心循环经评审确认 | §一 循环唯一表述 | spec 契约测试 |
| AC2 | 人设卡 ≥5 字段、改卡免改码 | §三 schema 9 必填字段 + swap 测试 | persona 契约测试 |
| AC3 | ≥1 条链路复现 ≥2 结局 | §四 4 结局 + 2 条已演算链路 | ending 契约 + smoke |
| AC4 | godot 门禁 CI 生效、错误提交被拒 | §六 三件套 0 error | CI 拒绝合并验证 |
| AC5 | AppHost 部署可启动 + 健康检查通过 | §七 单线程导出 + /healthz + 冒烟 | 部署核对（策划案 acc-12 同为人工核对项）|

策划案共 12 条 acceptance，其中 10 条已配可执行检查（spec/persona/story/ending 四契约 + smoke）；实现节点不得降低已配检查的覆盖面。

## 十、执行经验与 DO NOT（本次目标执行沉淀）

**有效的做法**：
- 策划阶段就把验收配成可执行检查（12 条中 10 条可自动断言）——这是实现节点不返工的关键，印证调研结论「验收回路是一等公民」「知识先于生成」。
- 文案、美术、数值全部从单一事实源派生（portrait_prompt / spec.numeric），多 agent 并行也不漂移。
- 自检抓到链路演算中的「带问号模糊值」并修正为精确终值——**数值表述必须可判定，禁止"约/大概/左右"**。

**DO NOT（违反即打回）**：
- 禁止把人设写进 .gd 代码或节点属性（AC2 直接失败）；
- 禁止节点 effects 内嵌脚本/表达式求值逻辑（破坏可追溯与换卡免改码）；
- 禁止绕过 godot headless 门禁合入主干；
- 禁止交付 desktop-only / 仅本地可跑形态；
- 禁止在策划与配置文档中使用不可判定的数值表述。

## 十一、待核实与回填项（实现节点开工前处理）

1. **数值终值比对**：链路终值在策划执行过程播报中出现过一次修订（如链路 A Σthreat 曾出现 225/210/220 等中间口径），**以 design-spec.md 演算表终值为准**；工作区产物未推送远端分支，实现节点重建文件时须逐值核对并回填本文。
2. **AppHost 能力核实**：是否支持自定义响应头与 HTTPS —— 决定线程模式可行性；不支持则永久锁单线程导出。
3. **实测回填**：Web 导出体积（wasm/pck）与首屏加载时间，导出后实测回填 §七。
4. **生存轴定义**：体力/理智类生存状态的具体轴与衰减公式以 `spec.numeric` 为准，本文不预设定。

---

*版本 v1.0 ｜ 2026-09-05 ｜ 目标管理大师固化。依据：需求 id=cmtob3m0p000pm9y6yl6yi1uq、策划案产物 id=cmtn5fhk20008jqck1thxilil、平台 Godot 工程约定（games/godot-coin-rush）、Godot 官方导出文档。*



---

# 双栏布局验证


## 关联项目

### 心伴 [frontend]

项目名: 心伴
描述: ai 情绪陪伴
类型: mobile
GitHub: https://github.com/hl3w22bupt/odbo
工作流类型: 标准开发提交流程（开发测试→审查→人工确认→创建PR）

### MyRD Playground [mobile]

项目名: MyRD Playground
描述: MyRD 功能测试和沙盒环境
类型: web-app
GitHub: https://github.com/hl3w22bupt/myrd-playground.git
工作流类型: 功能开发


---


## 产品关联知识

## 项目开发规范

# 项目开发规范

## 代码风格
- 使用 TypeScript
- - 遵循 ESLint 规范
- 提交前运行 lint 检查

## Git 提交规范
- 使用 Conventional Commits 格式
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新

## Agent 执行轨迹（agent_execution_trajectories）孤儿 running 记录：诊断、根因与自愈处置手册

# Agent 执行轨迹（agent_execution_trajectories）孤儿 running 记录：诊断、根因与自愈处置手册

## 背景
平台中所有 Agent 执行（channel 频道消息、express_lane 直通车、workflow 内 agent 节点、exploration、secretary、onboarding 等）都会写入一条 agentExecutionTrajectory 轨迹记录，采用 create-then-finalize 生命周期：

- 创建时（createAgentTrajectory）写入 `status='running'`；
- Agent 执行正常结束时（final 事件 / 流自然结束），pipeline 返回路径将 status 置为 `completed`；
- 异常被 catch 时置为 `failed`，并回填 outputPreview / error / durationMs / completedAt。

Claude 子进程层存在 10 分钟默认超时（SIGTERM → 10s 后 SIGKILL）。

`agent_execution_trajectories` 表是所有 Agent 执行的基础数据源，也是进化分析（evidence mining）的关键证据来源，轨迹数据质量直接影响进化证据统计与状态判定。平台 Worker 启动时运行一整套自愈（auto-heal）机制，但当前对轨迹记录存在覆盖盲区。

## 现象
增量时间窗内观测到 7 条轨迹全部停留 `status='running'`，且错误为空、输出摘要为空，覆盖执行类型与角色：

- **channel**：PD-Agent、Architect-Agent、开发者；
- **workflow**：「把 HTML 原型转成生产级 React Native 前端（先发 Android）」frontend 节点、「创建 PR（基于实际变更）」create-pr 节点；
- **express_lane**：Express Agent ×2。

共同特征：记录创建后从未被 finalize，既无 error，也无任何中间输出（outputPreview=NULL），从数据上完全看不出是否还在推进。

影响：
- 轨迹表被孤儿记录污染，进化分析（evidence mining）统计失真（running 状态混入失败/完成判定）；
- 轨迹模型没有 timeout / expiration 字段，理论上可无限 running；
- 与「真正仍在运行但尚无输出」的合法长任务无法从数据上区分。

## 根因
1. **轨迹完结依赖进程内 pipeline 的返回路径**。超时/取消逻辑全部在 Worker 进程内存中（startTimer + activePipelines 注册表）。Worker 被重启（挂起检测触发自动重启、OOM、部署）时，内存定时器与注册表一并丢失，正在执行的轨迹失去 finalize 触发点，永远不会被置为终态。
2. **自愈覆盖盲区**。平台启动自愈覆盖了 workflowRun（autoHealStaleRuns→paused）、expressLaneRun（→failed，error='执行中断（Worker 重启）'）、channel_messages 的 streaming 占位消息（>10 分钟清理 streaming 标记）、agent busy 状态（→idle）、goal 执行（resumeStuckGoalExecutions）、vibe workspace（小时级清理），但**不覆盖 agentExecutionTrajectory 本身**（代码中 grep 零引用），轨迹成为永久孤儿。
3. **自愈仅在启动时执行一次**，运行期没有周期性僵死检测。
4. **finalize 无重试**。finalizeAgentTrajectory 内部 try-catch 仅记录日志：若 finalize 本身失败，轨迹不会再次尝试落终态。
5. **长任务与死执行不可区分**。长时间无任何输出的运行（git/gh 等待交互输入、依赖安装卡住、构建/推送阻塞、模型侧无响应）也不会产生 outputPreview，与死执行在数据上表现完全一致，无法仅靠「有无输出」判定。

## 处置
### 1. 定位滞留轨迹
```sql
SELECT id, agent_type, agent_name, status, created_at,
       (now() - created_at) AS age, output_length, error
FROM agent_execution_trajectories
WHERE status = 'running' AND created_at < now() - interval '30 minutes'
ORDER BY created_at;
```
也可按更新时间检索并补充更多诊断字段：
```sql
SELECT id, agent_type, status, "createdAt", "updatedAt", output_preview, error, metadata
FROM agent_execution_trajectories
WHERE status = 'running' AND "updatedAt" < now() - interval '30 minutes'
ORDER BY "updatedAt";
```
重点看 output_length IS NULL/0 的记录——无输出即无进展。

### 2. 区分「假 running」与「真僵尸」
- 检查对应 Worker / 子进程是否存活；
- 观察 updatedAt 是否仍在刷新；
- 若不再变化且无输出，判定为孤儿。

### 3. 按类型处置
- **workflow 节点**：查关联 workflow_run 的 status。若 run 也卡住，启动自愈会将其置为 paused（节点重置为 pending），可手动 resume；轨迹需同步标记 failed 并注明原因。
- **express_lane**：expressLaneRun 启动自愈已标记 failed（error='执行中断（Worker 重启）'）；确认轨迹同步标记 failed。worktree 现场保留在 `$WORKSPACE_ROOT/<projectId>/run-express-<taskId>`，可手动补收尾后「续跑」。
- **channel**：启动自愈会清理 streaming=true 且超过 10 分钟的 channel_messages 占位消息（content 置为「(Agent 异常中断 — Worker 重启)」）；轨迹需同步标记 failed。

### 4. 检查僵尸子进程
```bash
ps aux | grep -E 'claude (-p |--print)' | grep -v grep
```
对照轨迹的 worktree / session_id / prompt_preview 定位残留进程，确认无活动输出后 kill（SIGTERM → 10 秒后 SIGKILL）。

### 5. 清理孤立 worktree
确认无活动执行引用后，用 `git worktree remove --force` 删除 `$WORKSPACE_ROOT/<projectId>/run-*` 下对应目录。

### 6. 批量修复（谨慎）
先人工确认无关联的活动中执行，避免误杀：
```sql
UPDATE agent_execution_trajectories
SET status = 'failed',
    error = '执行中断（僵死自愈：无进展超时）',
    completed_at = now()
WHERE status = 'running' AND created_at < now() - interval '30 minutes';
```
保留 inputs / metadata 以便复盘，避免误判为进行中或计入成功统计。

### 7. 复盘
把轨迹 id 关联到 workflow run / express lane / channel 会话，判断是「提示词缺执行纪律」还是「编排层 finalize 缺失」。

## 预防
- **轨迹有界生命周期 + 僵死自愈**：轨迹必须有硬上界与回收任务（启动时 + 每小时周期检测）。
- **所有执行路径必须输出中间进度**，避免「运行中但零输出」。
- **新增执行环节（新 agentType）时**，必须补齐完结路径与自愈覆盖，并把 agentExecutionTrajectory 纳入与 workflowRun / expressLaneRun 同级的启动自愈清单。
- **Agent 提示词层**：要求有界执行（见《Workflow Agent 节点执行纪律规范》），确保任何路径都能 finalize。
- **记录层**：为轨迹增加 timeout / expiration 字段与「心跳刷新」机制，长期无心跳即可判定可回收；监控 running 超过阈值（如 30 分钟）的记录。
- **Worker 重启流程**中补充 trajectory 清理步骤。

## 情绪陪伴 App 产品调研框架

## 情绪陪伴 App 产品调研分析框架

### 背景
MyRD Admin 提出设计一款以"情绪价值"为核心的陪伴类 App，并引入游戏化交互机制。PD-Agent 就此进行了系统性调研分析。

### 市场与竞品分析
- **现有格局**：冥想类（Headspace、Calm）、日记记录类（Daylio）、虚拟陪伴类（Replika、Character.AI）App 已在市场存在，但多数偏"工具属性"，缺乏有深度的互动体验
- **差异化机会**：游戏化交互是关键的破局点，将情绪调节转化为"养成类 RPG"或"模拟经营"式体验

### 用户需求画像
- **目标人群**：Z 世代及年轻职场人，面临孤独感或高压，排斥传统说教式心理咨询
- **核心诉求**："被理解"、"被陪伴"以及"低压力的情绪宣泄口"，而非"治疗"

### 游戏化交互机制（核心差异化）
- **情绪映射**：将用户抽象情绪（文字、语音、表情）转化为游戏内数值或视觉反馈
  - 示例：用户开心时虚拟家园天气变晴；用户焦虑时出现需要安抚的小怪兽
- **正向反馈循环**：通过"情绪打卡"或"互助任务"解锁装扮、剧情或虚拟互动
- **方向待定**：AI 虚拟伴侣养成 vs 个人情绪花园经营

### 技术可行性
- 涉及 NLP 自然语言处理进行情绪识别
- 高保真游戏化 UI/UX 设计
- 通用技术选型方向待进一步确定

### 伦理与合规风险
- 需明确界定"陪伴"与"心理咨询"的边界
- 避免用户过度依赖及潜在法律风险

### 商业模式探讨
- 订阅制 / 内购制 / 广告变现 待评估

### 后续调研方向
1. 竞品深度拆解：挑选 2-3 款 AI 聊天+游戏元素的应用进行分析
2. MVP 核心功能定义
3. 商业模式确定

## MyRD 平台真实仓库结构地图、文档/技能入口与常见路径陷阱

# MyRD 平台真实仓库结构地图、文档/技能入口与常见路径陷阱

## 背景
agent 在涉及 MyRD 平台的任务中反复出现两类高成本问题：

1. **文档/技能入口定位失败**：任务开始时多次通过 glob 搜索 `**/myrd*/**/SKILL.md`、`**/myrd-platform-skill*` 等模式均返回 0 命中，误判平台「为云端平台、本地无文档」（#18283），或技能未在预期目录找到（#18123），随后不得不多轮读取源码与文档才定位入口（#18282-18293）。myrd-platform-skill 是 agent 理解平台的标准入口（最近 14 天调用 4 次），但 agent 本地环境无法直接命中其正文，造成重复勘察，agent 花费约十余次观测重复勘察结构。
2. **引用不存在的文件路径**：多会话（#18282-18293、#18596-18617）反复手工翻查源码才能定位平台结构，且 #18616/#18617 实证发现提案引用了不存在的 `frontend/lib/services/*` 与 `myagent-client.ts` 路径，导致提案被驳回、评审周期浪费。

根因在于「文档与实际源码结构不一致」——仓库（典型根目录 `/Users/leo/workspace/myrd`）存在源码与编译产物并存、文档过时等问题。本文档给出经源码核实的真实入口、真实结构地图及高频错误路径，供涉及 MyRD 内部实现的任务直接使用，消除重复探索并防止错误路径再次出现，显著降低后续任务冷启动成本。

## 关键入口（权威文档与技能）
- **平台使用说明书（权威）**：`/Users/leo/workspace/myrd/docs/myrd-platform-skill.md`。注意：位于源码仓库 `docs/` 下，而非 `~/.claude/skills/`。内容覆盖：服务地址、JWT 认证、全部 API 分类、典型示例、数据模型、边界情况，并含平台进化系统架构说明。
- **快速开始**：`/Users/leo/workspace/myrd/docs/guides/quick-start.md`（环境搭建 → 服务启动 → 注册 → 建项目 → 跑工作流）。
- **工作流集成/部署状态**：`/Users/leo/workspace/myrd/WORKFLOW_INTEGRATION.md`、`/Users/leo/workspace/myrd/MYRD_SETUP_STATUS.md`。
- **数据库 schema**：`/Users/leo/workspace/myrd/prisma/schema.prisma`（含 `AgentExecutionTrajectory` 模型，表名 `agent_execution_trajectories`）。

## 真实结构（经源码核实）
- **入口与自愈**：`src/index.ts`（worker 启动时执行 auto-heal，覆盖 WorkflowRun / ExpressLaneRun / channel_messages / agent status / goals / vibe workspace，**不含** agentExecutionTrajectory）。
- **工作流引擎**：`src/services/workflow/engine.ts`（约 2626 行；含 `resume()` 约 443 行、`iterateFrom()` 约 784 行、`rerunFrom()`、`rollbackToCheckpoint()`、`sharedSetupProjectWorkspace()`；支持 DAG 执行 / 自愈 / 重试 / git checkpoint）。
- **Coding-agent 实现**：`src/services/coding-agent/{claude-code-agent.ts, local-claude-agent.ts, remote-agent.ts, types.ts}`（其中 `claude-code-agent.ts` 含 10 分钟默认超时与进程清理逻辑）。
- **进化系统服务**：`src/services/evolution/`（analyzer 等模块；支撑证据系统三类数据源、证据挖掘策略）。
- **路由**：`src/routes/workflows.ts` 等。
- **前端真实源码**：`frontend/` 目录存在，含 `app/` 与 `components/` 源码，如 `frontend/app/(dashboard)/projects/new/page.tsx`、`frontend/components/projects/run-workflow-button.tsx`。
- **编译产物（非源码）**：`src/dist/`——仅含编译后声明/产物（如 `src/dist/lib/myagent-client.d.ts`、`src/dist/services/coding-agent/myagent-agent.d.ts`），**不是源码**。

## 服务端口
前端 :3001、后端 API :3111、streaming :4112、MyAgent :3000、数据库 :5432。

## 高频错误路径（不存在，务必避免）
| 常见错误引用 | 真实对应 |
|---|---|
| `frontend/lib/services/workflow/engine.ts` | `src/services/workflow/engine.ts` |
| `frontend/lib/services/coding-agent/claude-code-agent.ts` | `src/services/coding-agent/claude-code-agent.ts` |
| `myagent-client.ts`（作为源码） | 无此源码；仅有编译声明 `src/dist/lib/myagent-client.d.ts` |
| 认为前端目录含业务服务代码 | `frontend/` 主要被 `node_modules` 占据；业务服务在 `src/services/` |

## 根因
1. 文档（含 `docs/guides/quick-start.md`）描述的结构与实际仓库不一致或已过时；
2. agent 凭记忆/推测引用路径，未做存在性核实；
3. `src/` 与 `src/dist/` 并存，把编译产物误当源码。

## 处置（核实方法）
- 引用任何路径前，先用 glob/grep 在仓库根目录确认文件存在；
- 区分 `src/`（源码）与 `src/dist/`（编译产物），引用源码一律指向 `src/`；
- 工作流引擎、coding-agent、evolution 等业务服务一律在 `src/services/` 下，不在 `frontend/lib/` 下；
- 「文件不存在」的判断以 glob 返回空为唯一依据，不要依据记忆或文档；
- 分析轨迹/进化数据时，直接读 `agent_execution_trajectories` 表与 `prisma/schema.prisma` 的 `AgentExecutionTrajectory` 模型，不要靠源码 glob 反推。

## 预防
- 涉及 MyRD 内部实现的提案/文档，落笔前对每个文件路径做一次 glob 核实；
- 平台是本地源码 + 多 run 工作区（`/Users/leo/.myrd/workspaces/proj-myrd/run-*`）并存；run 工作区可能包含主干尚未合入的功能（如 express-lane、轨迹追踪迁移），分析时以对应 run 工作区为准；
- 本文档随仓库结构变更应同步更新。

## 架构设计文档

# 架构设计

## 技术栈
- 前端：Next.js + React + TypeScript
- 后端：Motia (iii 引擎)
- 数据库：PostgreSQL + Prisma

## 模块划分
- 项目管理模块
- 任务管理模块
- 知识库模块

## 需求池功能说明

# 需求池功能

## 功能说明
需求池用于管理产品需求、Bug 修复、功能改进等任务。

## 状态流转
- backlog: 待办需求
- todo: 已计划
- in-progress: 进行中
- review: 评审中
- done: 已完成
- archived: 已归档

## 沉淀Web大逃杀技术方案与性能红线

# 沉淀Web大逃杀技术方案与性能红线

> 来源：《和平精英Web版》架构Agent技术方案（PR #8，产物 id=cmos298dg0001m9mxandnum2z，repo hl3w22bupt/myrd-playground）
> 需求基线：《「和平精英Web版」核心玩法需求（跳伞/拾取/射击/缩圈/AI 对抗）》（id=cmtfyd7uc000im9hapib6ann3）
> 用途：**开发节点（M0~M7）执行对齐的唯一技术基准**。本文所有数值均为架构评审结论，实现时落入 `content/` 配置表由测试断言，禁止硬编码、禁止擅自更改。

---

## 一、引擎选型结论（ADR-001/002/007/008）

**最终选型：Three.js r185 + Vite 7 + TypeScript 5.9.x + 零后端静态部署。**

### 1.1 为什么是 Three.js（候选对比结论）

| 维度 | Three.js r185 ✅ | Babylon.js | PlayCanvas | Unity WebGL |
|---|---|---|---|---|
| 核心体积（gz 约量级） | ~170KB | ~1MB+ | ~1MB | 10~40MB（含 wasm 堆） |
| 首屏可交互（红线 ≤5s） | 最优 | 良好 | 良好 | 难达标 |
| TS 类型 | 官方自带 | 官方维护 | 部分 | 生成式，质量一般 |
| 玩法逻辑自由度 | 最高 | 高 | 受编辑器约束 | C# 工具链负担 |

落选核心逻辑：本项目的核心工作量在**玩法仿真**（跳伞四阶段/弹道结算/缩圈几何/AI 行为），不在渲染管线。引擎越"全"（内置物理/GUI/场景序列化），越容易把逻辑写进引擎回调，破坏"仿真与表现分离"主决策；Unity WebGL 的 10~40MB 加载直接违反首屏 ≤5s 红线。Three.js 生态与问题检索量最大，上手成本最低。

### 1.2 配套选型（配套 ADR）

| 决策 | 结论 | 一句话理由 |
|---|---|---|
| ADR-002 物理碰撞 | **自研**（高度场采样 + AABB + 射线检测，约 300 行） | 本期碰撞仅三类需求；零 wasm 加载复杂度；完全确定性。不支持刚体堆叠，二期载具预留接口 |
| ADR-003 时间步进 | **fixed timestep 50Hz + rAF 可变渲染 + 插值** | AC2 落点可复现的硬前提；可变 dt 无法保证 |
| ADR-004 实体组织 | **ECS-lite**（轻量结构化实体 + 系统函数） | 实体上限 20，bitecs 等重型 ECS 无收益 |
| ADR-005 UI 方案 | React 19（低频菜单/背包/结算）+ 原生 DOM/Canvas2D 直写（高频 HUD/小地图） | React 重渲染不适合每帧更新 |
| ADR-006 AI 决策 | **有限状态机 FSM + 分帧更新**，不做行为树/GOAP | 需求仅 5 类行为，FSM 足够 |
| ADR-007 TS 版本 | 锁 **5.9.x**，不上 TS 7（native preview） | npm 最新 7.0.2 为 Go 原生移植，工具链未稳 |
| ADR-008 构建 | Vite（锁 7 稳定线）+ 零后端静态部署 | 纯前端无服务端依赖 |

### 1.3 引擎边界（防"引擎漂移"，CI lint 强制）

- 渲染层**只允许** import `three`；`render/` 目录之外出现 three import 即 lint error。
- 需自建渲染基建（每项 <150 行）：场景对象池、LOD 管理、阴影相机跟随、毒圈/弹道特效材质、调试 HUD 覆盖层。

---

## 二、场景设计结论（仿真与表现分离 + 确定性架构）

### 2.1 总体架构（最重要的一条决策）

玩法逻辑全部运行在**无 DOM 依赖的确定性仿真核心**中，Three.js 只做「快照 → 场景对象」映射，UI 只读事件流。分层自下而上：

```
UI 层（React 低频） + HUD/小地图（DOM/Canvas2D 高频直写）
        ↑ GameEvent 事件流
表现层 render/（Three.js r185）：场景·资源·LOD·相机·特效·对象池
        ↑ 每 rAF 只读 WorldSnapshot
仿真核心 core/（纯 TS，零 DOM 依赖，Node 可直接运行）
        fixed tick 50Hz · seeded RNG · ECS-lite
        ↑ PlayerIntent 指令流
输入层 input/ ＋ 内容层 content/（配置表 JSON）
```

三条关键推论：
1. **仿真核心不 import Three.js** → AC2/AC3/AC4/AC5 可在 Node + Vitest 中直接跑满局自动化断言（这是整个测试策略成立的前提）。
2. 渲染层崩溃/加载失败不推进仿真状态；渲染层可整体降级为占位几何。
3. UI 只消费事件，不回写仿真状态，杜绝 UI 驱动逻辑。

### 2.2 目录结构与依赖方向（CI 强制，违反即 lint error）

| 模块 | 可依赖 | 禁止依赖 |
|---|---|---|
| `core/`（loop/rng/world/events/systems） | `content` | `render` `ui` `input` `three` `react` |
| `content/`（weapons/loot/zone/map/constants） | — | 其他所有模块 |
| `render/` | `core` 类型、`three`、`content` | `ui` |
| `input/` | `core` 类型 | `render` `ui` |
| `ui/` | `core` 类型与事件 | `core` 内部实现细节 |

### 2.3 双循环确定性模型（性能与可复现的骨架）

```
rAF 渲染循环（可变，浏览器驱动）
 ├─ 累积器 accumulator += dt
 ├─ while (accumulator >= 20ms && catchUp < 3) core.tick()   // 固定 50Hz
 ├─ catchUp ≥ 3 → 丢弃积压并告警（防死亡螺旋，宁降速不雪崩）
 ├─ renderer.render(scene, camera)
 └─ 渲染层用 alpha = accumulator/TICK_MS 做位置插值（消除 50Hz 抖动）
```

- 逻辑 tick **50Hz（20ms）**：射击/掉血精度足够（AC4/AC5 按秒结算），比 60Hz 省 17% 逻辑开销。
- 插值只做渲染层位置/朝向 lerp，**不插值逻辑状态**，保证回放与断言用纯逻辑状态。
- 确定性铁律：所有随机数来自 **seeded RNG**（xoshiro128\*\* 或 mulberry32），`Math.random()` 与 `tick()` 内 `Date.now()`、DOM 访问全部禁止（lint 层面强制，破坏禁令的 PR 直接打回）。
- 随机流隔离：跳伞气流/AI 行为/物资生成由同一 rng 流的不同**子流**驱动（`rng.fork('loot')` / `rng.fork('ai')`），避免行为改动影响物资分布。
- 回放协议免费获得：录制 `{seed, contentPackVersion, intents[]}` 落 JSON，同 seed 同意图序列必然逐帧一致——bug 复现与 AC2 断言共用此机制。

### 2.4 场景与对局规模参数

| 项 | 数值 | 说明 |
|---|---|---|
| 地图尺度 | **1.6km × 1.6km** | AC2 落点容差 5% = 80m |
| 地形 | 程序化高度场 + 区域划分（城区/野区） | 无真实地形资产 |
| 建筑 | AABB 占位体 | 配合分离轴碰撞（先 X 后 Z + 速度钳制） |
| 对局规模 | 玩家 1 + AI 10~19，实体上限 20 | N5 |
| 单局时长 | < 10 分钟自然结束（AC1） | 缩圈 6 阶段总时长约束保证 |
| 美术 | 程序化几何 + 免费低模占位 | 范围裁剪：不做骨骼动画/联网/账号，AC 全部为数值/流程验收 |

### 2.5 仿真系统与 tick 执行顺序（core/systems）

| 顺序 | System | 职责 |
|---|---|---|
| 1 | lifecycle | 对局状态机 lobby→parachuting→playing→ended；胜负判定（仅剩 1 存活） |
| 2 | parachute | 运输机航线、四阶段（自由落体→开伞→滑翔→落地）物理 |
| 3 | movement | 地面移动、高度采样、AABB 碰撞 |
| 4 | combat | 射击节流、弹道射线、命中判定（包围盒+部位+距离衰减）、换弹/切枪 |
| 5 | loot | 按区域密度生成、拾取判定、背包容量/丢弃、护甲减伤/医疗回血 |
| 6 | zone | 缩圈阶段表、圈心/半径插值收缩、圈外按秒掉血 |
| 7 | ai | FSM（patrol/loot/seek/fire/fleeZone/dead）+ 轮转分帧决策 |

**AI 与玩家共用同一套 PlayerIntent 与同一套 systems，AI 不走特权通道**——这条约束使"AI 也会被淘汰/也会避毒"天然成立，也让 AC4 命中率可用 AI 对 AI 对局复现验证。

核心契约（`MatchHandle`）：`tick(intents[])` 推进 / `snapshot()` 只读快照（渲染唯一数据源）/ `drainEvents()` 事件消费 / `status()` / `result()`（排名/淘汰数/用时）。

---

## 三、武器系统设计结论（AC3/AC4 数值基准）

### 3.1 WeaponDef schema（content/weapons.ts）

```ts
interface WeaponDef {
  id: WeaponId; category: 'ar' | 'smg';
  damage: number;        // 基础伤害
  rpm: number;           // 射速（发/分）
  magazine: number;      // 弹匣容量
  reloadMs: number;      // 换弹时间
  recoil: number;        // 后坐力系数 0..1
  effectiveRange: number;// 有效射程 m，超出伤害线性衰减至 50%
  spread: number;        // 散布 rad
  projectileSpeed: number; // 弹速 m/s（射线扫描命中判定）
}
```

### 3.2 双武器初始数值（彼此可区分是 AC4 验收点）

| 参数 | 步枪 `ar_m4` | 冲锋枪 `smg_ump` |
|---|---|---|
| damage | 26 | 18 |
| rpm | 620 | 850 |
| magazine | 30 | 25 |
| reloadMs | 2200 | 1800 |
| effectiveRange | 350m | 120m |
| recoil | 0.45 | 0.30 |

### 3.3 命中与伤害结算规则

- **部位倍率**：头 2.5 / 躯干 1.0 / 四肢 0.75；生命值归零即淘汰（cause: shot | zone）。
- **距离衰减**：超出 effectiveRange 后伤害线性衰减至 50%。
- **命中判定**：弹道射线扫描（projectileSpeed）+ 目标包围盒，静止目标有效射程内命中率 ≥90%（蒙特卡洛 1000 发自动化断言）。

### 3.4 物资与防具医疗数值（AC3 基准）

| 项 | 数值 |
|---|---|
| 护甲（躯干减伤） | 0.35 |
| 头盔（爆头减伤） | 0.5 |
| 医疗包 | +60 HP，使用 3000ms |
| 物资种类 | 武器/弹药/护甲/头盔/医疗包/投掷物，均带 gridCost 背包格占用 |
| 生成规则 | 按 zone 分区密度 + 权重池（LootTableDef），生成数量/种类必须与表断言一致 |
| 生效时机 | 拾取即生效：装备武器立即可射击、穿甲减伤、医疗回血 |

### 3.5 缩圈配置（AC5 基准，ZoneConfig）

- 首圈半径 **600m**，每阶段半径乘数 **0.65**，圈心随机偏移比例 0.4。
- 6 阶段圈外 dps：`[0.4, 0.8, 1.5, 2.5, 4, 6]`（逐阶段递增，验收断言点）。
- 等待/收缩秒：`[60/40, 50/35, 40/30, 35/25, 30/20, 25/15]`（合计 < 10 分钟，反推满足 AC1）。
- HUD 实时显示当前圈、下一圈轮廓与阶段倒计时。

---

## 四、60FPS 性能红线（超预算即视为性能缺陷）

### 4.1 硬红线指标（N1/N4 推导，验收工具：调试 HUD）

| 预算项 | 目标值 | 硬上限 | 红线含义 |
|---|---|---|---|
| 帧率 | 桌面 **60 FPS**；移动 ≥30 FPS | — | N4，M0 DoD 即要求空对局 60FPS 稳定 |
| 单帧 draw calls | < 120 | **150** | 超 150 判性能缺陷 |
| 单帧三角形 | < 400k | **800k** | — |
| 逻辑 tick 单帧耗时 | < 3ms | **8ms**（超限告警） | tick 超时会挤压渲染预算 |
| 首包 JS（gz） | < 800KB | **1.2MB** | 支撑 N1 首屏可交互 ≤5s |
| 纹理内存 | < 200MB | **400MB** | — |
| 首屏可交互 | ≤ 5s（桌面宽带） | — | N1，免安装定位的底线 |

### 4.2 画质三档定义（Medium 为默认）

| 参数 | Low | Medium（默认） | High |
|---|---|---|---|
| 像素比 | min(dpr,1)×0.75 | min(dpr,1) | min(dpr,2) |
| 阴影 | 关闭 | 1 级跟随相机 1024 | 2048 + 更远投影 |
| 视距/雾 | 300m 雾浓 | 600m | 1200m |
| LOD 切换距离 | 收紧 50% | 基准 | 放宽 30% |
| 植被/物资实例化密度 | 40% | 100% | 100% |
| 反锯齿 | 关 | 关（像素比补偿） | MSAA×4（WebGL2） |

默认档位：`navigator.userAgent` 粗分（移动→Low，桌面→Medium）；High 仅手动或设备探测通过后开启。

### 4.3 动态降档规则（render 层实现，与仿真无关）

- 采样窗口：每 **2 秒**计算平均 FPS 与 p95 帧时间。
- **降档**：连续 2 窗口 `FPS < 45` → 降一档（High→Medium→Low）；Low 后改为降分辨率 25%。
- **升档**：连续 5 窗口 `FPS > 58` → 升一档，每分钟至多一次（防抖动）。
- 每次档位变化写入调试 HUD 与 console，便于定位。

### 4.4 分帧与达标手段

- **AI 分帧**：决策每 tick 只更新 **1/4 实体**（轮转分片），感知与决策同频，移动每 tick 执行；单 tick 决策耗时预算 <3ms（M6 验收）。
- **毒圈掉血**：按秒结算（AC5 语义），tick 内累计时间再结算，不逐 tick 扣血。
- 渲染达标手段：地形/植被用 `InstancedMesh`；物资与建筑静态合批；阴影只投影主光；远处实体只更新朝向不更新动画。
- 兼容矩阵：桌面 Chrome/Edge/Safari/Firefox 完整；Android 中端机（≥4GB）Low/Medium ≥30FPS；iOS Safari Low/Medium（全屏/指针锁定需用户手势）；WebGL2 不可用直接降级提示页（不承诺 WebGL1）。
- 指针锁定（Pointer Lock）用于瞄准；Esc 退出后 UI 需提供"点击继续"重进。

### 4.5 可观测性（性能验收的测量工具）

内置调试 HUD（`?debug=1`，Release 默认关闭），M0 交付时必须可用：FPS/平均与 p95 帧时间/tick 耗时与漂移/draw calls/triangles/纹理内存/实体数/AI 状态分布/当前画质档与最近切换原因；支持 `?seed=123&replay=xxx` 固定种子与回放。

---

## 五、里程碑与执行对齐（开发节点照此排期）

```
M0 地基(0.5w) → M1 跳伞(1w) → M2 移动+地图(1w) → M3 物资(1w)
→ M4 射击(1w) → M5 缩圈(0.5w) → M6 AI(1w) → M7 闭环+调优(1w)   合计 ≈ 7 周
```

| 里程碑 | 关键交付 | 硬验收（DoD） | AC |
|---|---|---|---|
| M0 地基 | 50Hz 确定性循环、seeded RNG、事件总线、调试 HUD、CI + 依赖方向 lint | 空对局 60FPS；core 内 Math.random/Date.now 被 lint 禁止；HUD 可见 | — |
| M1 跳伞 | 四阶段跳伞、落点控制 | 同 seed 同输入落地坐标逐 tick 一致；落地 1s 内 state=ground；偏差 ≤80m | AC2 |
| M2 移动+地图 | 高度场、城区/野区、AABB 碰撞、第三人称相机 | 60FPS；不穿墙不穿地；draw calls<120 | — |
| M3 物资 | 密度生成、拾取、背包、防具医疗生效 | 生成符合权重表；数值与配置一致 | AC3 |
| M4 射击 | 武器表、弹道命中、部位/距离衰减 | 静止目标命中率 ≥90%（1000 发）；武器参数可区分 | AC4 |
| M5 缩圈 | 阶段表、插值收缩、按秒掉血、HUD 圈轮廓 | 各阶段参数与表一致且 dps 递增 | AC5 前半 |
| M6 AI | FSM 六状态、感知索敌、分帧 | AI ≥10；完成落地→拾取→交火→避毒路径；决策 <3ms | AC5 对抗 |
| M7 闭环 | 胜负结算、录制回放、降档、回归 | 10 局采样 100% 自然结束 ≤10min；性能预算全达标 | AC1 + AC5 胜负 |

依赖：M1→M2→M3→M4 串行；M5 仅依赖 M2 可与 M4 并行；M6 依赖 M3/M4/M5；M7 收口。每个里程碑必须以"可运行 + 可验收"结束，禁止跨里程碑堆叠未验证功能。

测试策略三层：**Node 仿真断言为主**（core 零 DOM → 无需浏览器、可进 CI、覆盖 AC2/3/4/5 全部数值）；Playwright 性能冒烟仅 M0/M2/M7 各一次（读 HUD 断言预算，不逐帧比对画面）；人工体验走查仅 M7。

---

## 六、风险红线与待核实事项（实现前必须确认）

| 风险 | 触发条件 | 对策 |
|---|---|---|
| 跳伞手感调不平（AC2） | M1 连续 3 天不收敛 | 空气阻力模型参数化（content 暴露 drag/glide）+ 落点预览圈 UI |
| AI 交火强弱失衡 → 单局时长失控 | M6 采样 >12min 或 <4min | AI 反应延迟/命中率/搜索半径进配置表，M7 十局采样调参 |
| 移动端帧率不达标 | 中端机 Medium <30FPS | 自动降档兜底；Low 档为硬底线（关阴影+降分辨率） |
| 自研碰撞穿墙/卡墙 | M2 冒烟出现 | 先 X 后 Z 分离轴 + 速度钳制；缺陷用回放文件复现 |

**M0 前必须核实的 3 项**（本文数值以官方文档/公开资料为据，非实测）：
1. Three.js 核心 gz 体积与真实首屏时间——用实际 `vite build` 产物复核并回填 4.1 的首包红线。
2. iOS Safari WebGL2 在目标最低机型上的表现——不达标则 iOS 锁 Low 档。
3. Pointer Lock 在平台预览 iframe 中的可用性——若被禁，降级"鼠标移动=视野"方案并记录。

## 七、二期演进预留（本期不做，只留边界）

- **多人联机**：`tick(intents)` 已解耦输入与状态，二期将本地输入替换为远端指令流（客户端预测 + 服务器权威），core 无需重写——这是确定性设计免费换来的关键预留；二期联机选状态同步，不依赖 lockstep（跨设备浮点一致性本期不承诺）。
- **载具/复杂物理**：movement system 内部可替换为 Rapier，对外仍走 PlayerIntent。
- **内容扩量**：content 配置表即内容管线，新增武器/物资/地图不改代码。
- **存档/战绩**：结构化 MatchResult 直接对接后端传输层。

---

*版本 v1.0 ｜ 2026-08-30 ｜ 依据 PR #8（commit ec48f16）架构方案固化；术语与规范以《「和平精英Web版」核心玩法需求》与本方案原文为准。*

## 沉淀知识：和平精英Web版两次开发失败复盘与pubg-web-core串行开发规范

# 沉淀知识：和平精英Web版两次开发失败复盘与pubg-web-core串行开发规范

> **适用功能线**：branchKey=`pubg-web-core`（和平精英Web版核心玩法）
> **版本**：v3（2026-08-31。演进：v1《小步串行开发与防超时规范》→ v2《串行小步开发规范与两轮失败复盘》→ v3 并入第三轮「换流程外壳仍失败」的实证与 Agent 兜底成功案例，固化**串行开发、禁止并行分支**红线）
> **权威技术基准**：《Web大逃杀技术方案与性能红线》（知识 id=6439fc3e-9217-4004-b091-aa79a6f9bcab）＋ 架构方案 PR #8（产物 id=cmos298dg0001m9mxandnum2z，repo hl3w22bupt/myrd-playground，Three.js r185 + Vite 7 + TS 5.9.x + 50Hz 确定性仿真核心 + seeded RNG）
> **需求基线（唯一需求来源）**：《和平精英Web版（pubg-web-core）收敛总需求：稳定60FPS+画面够看+核心玩法完整闭环》（id=cmtg6bxv6003ym9hav1sxej1e，branchKey=pubg-web-core）
> **用途**：约束本功能线所有开发节点的立项方式、分支策略、步长与门禁分级，固化三轮失败根因与已验证的补救路径，供后续迭代直接复用，防止同类失败重演。本规范管「怎么不掉链子」，技术基准文档管「怎么做对」。

---

## 一、三轮失败全景（开发类运行 9 次：7 败 2 成）

### 1.1 第一轮：全量口径（规范产生前）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 1 | 实现核心玩法（跳伞/拾取/射击/缩圈/AI 全量） | ❌ failed | cmtfz3zu70016m9ha4wldebwo | **单次任务过重**：5 大玩法模块塞进一个节点；且无独立需求基线 |
| 2 | 优化画面与流畅度 | ❌ failed | cmtfz6s9k001dm9hatl10qx9b | **目标混合**：画面表现 + 性能红线两类验收口径同节点，失败无法归因 |
| 3 | 实现最小可玩闭环（需求 id=cmtg05te2001zm9hamye40r6u） | ✅ completed | 见功能线运行记录 | 先立项收敛需求、边界明确、验收口径单一（正面样本） |

### 1.2 第二轮：小步口径（v1 规范执行后，3 步全败）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 4 | 第1小步·性能修复（稳定60FPS） | ❌ failed | cmtg2wvet002tm9hagm2awqhj | **空仓库起步** + **完整E2E门禁过重** |
| 5 | 第2小步·画面升级（材质光照雾效粒子+HUD） | ❌ failed | cmtg3pefz0034m9hahhlpy86p | 小步体量 × 全量门禁，单次运行预算失衡 |
| 6 | 第3小步·玩法补齐与缺陷修复（最终E2E+PR） | ❌ failed | cmtg5bzsp003jm9ha5876khnw | 同上，且前两步无合入成果可叠加，修复失去基线 |

（第 5、6 步之间插入一次成功的「代码审查」Agent 联合审查：审查前两步变更并输出缺陷清单，产物 id=cmst009ls000am9jmyk8ylfil —— 「轻实现 + 专项审查」组合是可行的补充通道。）

### 1.3 第三轮：换流程外壳（v2 规范执行后，仍败）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 7 | pubg-web-core 分支叠加「画质与60FPS性能优化」 | ❌ failed | cmtg8kgc3004zm9hawlb9kvxo | 双目标（性能+画面）混合 + 「实现+完整E2E门禁」整链仍压在单次运行 |
| 8 | 第1小步·性能修复（流程变体：开发测试→审查→人工确认→创建PR） | ❌ failed | cmtg6jkbc004am9hauxsfe20k | **流程外壳变了，预算约束没变**：仍要求单次运行装下 实现+全量门禁，且未先拉取既有实现 |

**第三轮结论（v3 新增）**：失败与「流程里有没有审查 / 人工确认环节」无关，与「单次运行预算能否装下 实现 + 门禁」有关。给同一摊子加环节只会更重，不会更稳。有效解法只有四个：收敛范围、拆小步、门禁分级、换执行通道（Agent 兜底）。

### 1.4 根因归纳（跨三轮稳定复现的 3 + 1 条）

1. **空仓库起步**：开发工作流未先 `git fetch origin pull/<PR号>/head:pr-<PR号>` 拉取既有实现（PR #8 架构 + 已合入的最小可玩闭环 + PR #9 补齐成果），在空仓库上从零重复搭地基，把宝贵的单次运行时长消耗在与本步目标无关的工作上。
2. **单次任务过重**：第一轮是「节点肥」（多模块/多口径混装）；第二、三轮节点已瘦，但「实现 + 全量门禁」整条链仍压在同一个单次运行里，链条总重没降。
3. **完整E2E门禁过重**：小步场景下「lint + 全量单测 + Node 全流程自动化断言 + 构建 + 冒烟」成本占比畸高，直接挤爆单次运行时间窗，是二、三轮连败的直接放大器。v2 已修订为门禁分级（见第三节规则 3）。
4. **只换流程外壳无效（v3 新增）**：第三轮改用含「审查 + 人工确认」的流程变体（run cmtg6jkbc004am9hauxsfe20k）依旧失败。诊断失败时先看三件事——仓库基线是否为空、单次运行装了哪些活、门禁多重——而不是流程叫什么名字。

---

## 二、补救路径（逐条标注验证状态）

| # | 动作 | 验证状态 | 证据 |
|---|---|---|---|
| 1 | **需求固化**：失败动作立为正式需求基线，目标不悬空 | ✅ 已验证 | 收敛总需求 id=cmtg6bxv6003ym9hav1sxej1e（branchKey=pubg-web-core，统一修正 `pubb-web-core` 笔误） |
| 2 | **收敛范围**：把大目标收敛为边界单一的最小可玩闭环 | ✅ 已验证 | 需求 id=cmtg05te2001zm9hamye40r6u → 对应 run completed（9 次开发运行中 2 次成功之一） |
| 3 | **同 branchKey 串行叠加**：后一步基于前一步已合入成果 | 📌 已固化为红线 | 第三节规则 1；本功能线后续节点一律复用 branchKey=pubg-web-core 串行执行 |
| 4 | **Agent 兜底**：工作流连续失败后由 @开发Agent 直接接管 | ✅ 已实证 | 「开发与测试Agent」检查分支产物、补齐缺失玩法与性能缺口并提 PR → completed，PR #9（产物 id=cmst009lq0009m9jmg3e4zh9l） |
| 5 | **审查前置**：先联合审查既有变更，输出缺陷清单再修 | ✅ 已实证 | 代码审查Agent 缺陷清单（产物 id=cmst009ls000am9jmyk8ylfil），修复步以其为输入，禁止盲修 |
| 6 | 仅更换流程外壳（增加审查/人工确认环节） | ❌ 已证伪 | 第三轮 run cmtg6jkbc004am9hauxsfe20k 含上述环节仍 failed |

---

## 三、硬性规则（v3 红线，违反即打回）

### 规则 1：branchKey 复用 + 单分支串行，严禁并行分支

- `pubg-web-core` 功能线的**所有开发节点必须复用 branchKey=pubg-web-core**，按需求 id 复核绑定后串行执行（检索绑定时注意历史需求存在 `pubb-web-core` 拼写笔误，一律以需求 id 为准）。
- **同一时间窗内本功能线只允许一个进行中的开发节点；严禁并行新开分支改同一批文件。**「pubg-web-core 必须串行开发、禁止并行分支」是本功能线的强制约定，不是建议。
- 后一节点必须基于前一节点**已合入**的成果（N-1 的 merge commit 是 N 的基线）；前一步未合入，后一步不得开工。
- 理由：并行分支 ① 同一批文件互相覆盖、合并冲突；② 没有已合入基线可叠加（第二轮第 3 小步失败的直接诱因之一）；③ 诱发空仓库起步，重复搭地基浪费单次运行预算。

### 规则 2：小步提交，每步只做一件事

- 每步目标在 **性能（performance）/ 画面（visual）/ 玩法（gameplay）** 三类中**三选一**，禁止混合；单步改动规模以「一次运行内能完成 实现 + 轻门禁」为上限。
- **开工前必须先考古**：`git fetch origin pull/<PR号>/head:pr-<PR号>` 核实既有实现（当前可复用：PR #8 架构、最小可玩闭环、PR #9 补齐成果），能复用就复用，**禁止空仓库起步**。
- 术语与数值只认权威技术基准（知识 id=6439fc3e-…），新数值落 `content/` 配置表并配测试断言，禁止硬编码。

### 规则 3：门禁分级（修订 v1 规则 3）

- **小步（实现步）→ 轻门禁**：lint + 本次改动相关单测 + 冒烟；不跑全量 Node 自动化断言。
- **收口步 → 完整 E2E 门禁（重门禁）**：lint + 全量单测 + Node 全流程自动化断言 + 构建 + 冒烟 + PR。
- **门禁预算前置**：开工前估算「实现 + 门禁」总耗时；预估超出单次运行预算就先拆步，不指望运行中途省时间。

### 规则 4：失败必须固化

- 任何 run_workflow 失败后，要么固化为需求基线（如收敛总需求 cmtg6bxv6003ym9hav1sxej1e），要么沉淀/更新为知识规范（即本文档）；不允许目标悬空后无人认领。

### 规则 5：连续失败切换执行通道（兜底阈值，v3 新增）

- **同一小步的 run_workflow 连续失败 ≥2 次 → 停止重试工作流**，改由 @开发Agent 直接接管该小步（考古既有实现 + 实现 + 轻门禁 + 提交/PR）；工作流通道留给收口与验证。
- 依据：第二轮 3 连败、第三轮 2 败期间，Agent 通道已实际交付 PR #9——兜底通道不是理论，是被验证过的交付路径。

---

## 四、推荐节点拆分（v3：拆分与门禁级别沿用 v2）

| 顺序 | 节点 | 目标类型 | 门禁级别 |
|---|---|---|---|
| P0 | 仿真核心骨架与确定性底座（50Hz fixed timestep + seeded RNG + ECS-lite + MatchHandle + 依赖方向 lint） | 玩法 | 轻门禁 |
| P1 | 3D 地图与移动碰撞（1.6km² 高度场、城区/野区、AABB 建筑） | 玩法 | 轻门禁 |
| P2 | 跳伞落地四阶段（航线 + 自由落体→开伞→滑翔→落地，落点可复现） | 玩法 | 轻门禁 |
| P3 | 物资拾取与背包（区域密度、容量/丢弃、护甲减伤/医疗回血） | 玩法 | 轻门禁 |
| P4 | 武器射击命中（ar_m4 / smg_ump、弹道射线 + 包围盒、部位/距离衰减） | 玩法 | 轻门禁 |
| P5 | 缩圈毒圈（≥3 阶段收缩、圈外按秒递增掉血、HUD 倒计时） | 玩法 | 轻门禁 |
| P6 | AI 敌人与胜负结算（≥10 AI FSM、共用 PlayerIntent、唯一存活者结算） | 玩法 | 轻门禁 |
| P7 | 性能优化（稳定60FPS、1% 最低帧、内存不泄漏） | **性能** | 轻门禁 |
| P8 | 画面表现提升（材质/光照/雾效/粒子/HUD） | **画面** | 轻门禁 |
| 收口 | 最终 E2E + PR（AC1–AC4 全量断言） | 混合验收 | **完整 E2E 门禁** |

排序原则：先玩法闭环（P0→P6 串行补齐），再性能（P7），再画面（P8），最后收口跑重门禁。任何节点失败只影响该节点，已合入成果不回退；P0–P8 期间禁止顺手做别的类型的事。

---

## 五、关联产物索引

| 类型 | id / 标识 | 说明 |
|---|---|---|
| 需求（第一轮基线） | cmtfyd7uc000im9hapib6ann3 | 「和平精英Web版」核心玩法需求（跳伞/拾取/射击/缩圈/AI 对抗） |
| 架构方案 | PR #8，产物 cmos298dg0001m9mxandnum2z | 技术选型与目录/依赖方向约定（repo hl3w22bupt/myrd-playground） |
| 知识（技术基准） | 6439fc3e-9217-4004-b091-aa79a6f9bcab | Web大逃杀技术方案与性能红线（数值唯一依据） |
| 需求（最小可玩闭环） | cmtg05te2001zm9hamye40r6u | branchKey 登记 `pubb-web-core`（笔误，绑定一律以需求 id 复核）；对应 run 成功 |
| 需求（收敛总需求，当前唯一来源） | cmtg6bxv6003ym9hav1sxej1e | 稳定60FPS + 画面够看 + 玩法完整闭环，branchKey=pubg-web-core |
| 失败 run（第一轮·全量口径） | cmtfz3zu70016m9ha4wldebwo / cmtfz6s9k001dm9hatl10qx9b | 单次任务过重 + 目标混合 |
| 失败 run（第二轮·小步口径） | cmtg2wvet002tm9hagm2awqhj / cmtg3pefz0034m9hahhlpy86p / cmtg5bzsp003jm9ha5876khnw | 空仓库起步 + 完整E2E门禁过重 |
| 失败 run（第三轮·换流程外壳） | cmtg8kgc3004zm9hawlb9kvxo / cmtg6jkbc004am9hauxsfe20k | 双目标混合 / 外壳变了预算没变 |
| Agent 兜底成果 | PR #9，产物 cmst009lq0009m9jmg3e4zh9l | 开发与测试Agent 补齐缺失玩法与性能缺口并提 PR（兜底通道实证） |
| 审查产物 | cmst009ls000am9jmyk8ylfil | 前两步变更联合审查缺陷清单（修复步输入，禁止盲修） |
| 知识（流程规范·本文档） | b44145e4-6dda-4f92-8741-e0c8bf3dc6b6 | v3：串行开发禁并行分支 + 三轮失败复盘 + 已验证补救路径 |

---

## 六、适用边界

- 本规范**强制适用于** `pubg-web-core` 功能线及其全部后续开发节点；新增玩法/优化项按第四节模式继续追加串行小步。
- 其他项目/功能线可参照**方法论**：branchKey 复用串行、单步单目标（性能/画面/玩法三选一）、门禁分级（小步轻、收口重）、开工先考古禁空仓库起步、审查前置、连续失败即切 Agent 兜底、失败即固化；节点拆分与 AC 划分按各自需求基线重划，不照抄 P0–P8 清单。
- 本规范与《Web大逃杀技术方案与性能红线》（6439fc3e-…）互补：那份管「怎么做对」，这份管「怎么不掉链子」。


## Agent 与 Agent 驱动游戏研发调研报告：Mobius 仓库 × 三篇文章设计对比与可借鉴点

> 沉淀自目标 DAG「mobius 调研 → 沉淀知识 → 方案设计 → 需求 → 开发」（goal `cmtmvs3u0000ejqjst3gc2cmf`）。本文对应调研节点产物 `cmsk2tgmn0000m9rrqdhia5nl`（产品及商业化军师产出），由目标管理大师于 2026-09-04 固化入库，供后续「方案设计 / 需求 / 开发」节点直接检索引用。

# Agent 与 Agent 驱动游戏研发调研报告：Mobius 仓库 × 三篇文章设计对比与可借鉴点

## 0. TL;DR（30 秒版）

- **Mobius 根本不是游戏项目**——它是通用「自进化 Agent OS」。它解决了「怎么组织多个 agent」，但对「游戏研发」这个领域零结构：整个仓库没有任何引擎、关卡、美术管线、玩法验证的痕迹。
- 三篇文章恰好补上领域那一半：网易证明「**知识先于生成**」；腾讯云给出「**结构化策划案 → 可玩原型 → 资产 → 引擎**」的领域管线；触乐证明「**开发不再是瓶颈，判断/验收才是**」。
- 第一结论：**通用组织能力（Mobius 已验证可行）+ 领域结构（三篇文章证明是价值所在）= 我们该做的东西。只抄任何一半都会死。**
- v1 最小闭环：结构化策划案 schema → 带 QA 互查的 Web 原型生成 → 可玩链接 + 人工验收 checklist；组织上用 1 首席 + 策划/程序/QA/美术四职能 + 共享黑板；知识层从三级 Skill/Memory 起步。引擎移植、自进化、数据回流全部留给后续版本。

## 1. 调研来源与范围

| 来源 | 类型 | 读完的部分 |
|---|---|---|
| mobius-system/mobius | 开源仓库 | README、文档总览、研究团队教程、技能/记忆机制教程 |
| 文章A：网易《游戏研发中的 AI 转型：多 Agent 系统与知识工程实践》（林香鑫，AICon 演讲） | 大厂中台视角 | InfoQ/公众号全文 |
| 文章B：腾讯云林哲《基于 AI Agent 的小游戏开发实践》 | 云厂商产品视角 | GameLook 专稿全文 |
| 文章C：触乐《当 AI 开始重写小游戏生产流程》 | 独立开发者+行业视角 | 36氪转载全文 |

**范围偏差声明（重要，后续节点必读）**：军师执行时未拿到目标描述中的 3 个 mp.weixin 原始链接，按「Agent 游戏研发」主题自选了上述三篇替代文章。目标原始链接之一经秘书预判为 **Claude of Tanks**（agent 驱动游戏研发标杆案例，要点：126 辆战车一份规格数据喂给所有消费端的单一数据源、确定性种子模拟、客户端提交输入/服务器裁定事实的权威仲裁架构、Tank Gallery/Scene Studio 内容检查工具、契约测试门槛）。后续「方案设计」节点若需覆盖原始链接来源，需对 Claude of Tanks 补研；本报告三大主线结论（组织 × 领域 × 验收）不受影响。

## 2. 四个研究对象的设计拆解

### 2.1 Mobius（mobius-system/mobius）

- **定位**：首个开源自进化 Agent OS。把模型、agent、项目、设备、算力连进一个工作网络，会随使用改写自身代码/UI/插件，每次改动可追溯（部署时建议 fork，自进化后可提交回自己仓库）。
- **组织模型（两层）**：
  1. `@` 跨会话连接——事后补建，点对点，可选「只读引用」或「双向交流」；
  2. 智能体群——事前预设，多 agent 共享「群黑板」自主分工。研究团队形态：1 首席（不可删，负责拆解+整合）+ 最多 12 助理，逐成员配模型/职责/Skill 与 Memory 范围。
- **知识层**：Skill/Memory 三级作用域（内置/用户级/项目级），会话创建时勾选、中途可追加——本质是**提示词级注入**，没有代码级知识图谱。
- **管控层**：巡检/鞭策防 agent 偷懒、模型调用限频（token proxy）、危险操作人工审批与无人值守 agent 分开——「拆成多个 agent 各守边界，别把两套要求塞进一个上下文」是它的核心论点。
- **架构**：tmux 会话为底座，编码 agent（Claude Code/Codex/GLM harness）被 OS 编排，Node/TS 后端 + SQLite + Web/Electron/TUI 三端。模型完全解耦。

### 2.2 文章A：网易《游戏研发中的 AI 转型：多 Agent 系统与知识工程实践》

- **核心洞察**：内部大规模调研发现，游戏研发最大时间成本不是写代码，而是**理解代码**（千万行仓库、20% 时间花在问人）。所以先做知识，再做生成。
- **设计**：显性知识（文档/工单/仓库归集 → agentic RAG）+ 隐性知识（AST + 调用流 → 代码知识图谱，工单↔提交记录打通）；「研发空间」把团队隐性规范显性化（SDK 版本、引擎代码、编码风格）；Core Agent 协调一批「项目风格化」子 Agent。
- **金句级论断**：「Agent 架构最后的差异不会太大，真正重要的是你给 Agent 提供了什么上下文。」
- **AI Review 演进**：prompt 工程（1000 个问题只有 10 个有效）→ 静态分析+大模型双引擎 → multi-agent 过滤分级 → 注入知识工程 → 少而精。「白天人写代码，晚上 AI 审查」。
- **数据**：团队工具月产 500 万行代码、覆盖几十个项目；新人熟悉 4 万行代码从 2 周 → 1-2 天。

### 2.3 文章B：腾讯云林哲《基于 AI Agent 的小游戏开发实践》

- **核心洞察**：
  1. 玩法验证有沉没成本，MVP 验证前参与人数要最少；
  2. **WebGame 技术栈对 LLM 最友好**（20 年成熟度、模型知识充分、代码即资产、浏览器即预览）。
- **流水线**：专家中心（岗位化 Skill+知识库）→ 与专家对话迭代出结构化策划案 → 专家团（工程师生成 + QA 审核互查）一句话出可玩原型 → AI 生成**关卡可视化编辑页**（元素编号化，让自然语言修改有明确落点）→ 上下文贯穿：美术无需逐图写提示词，一句话替换全套资产 → 导出（策划案/数值/关卡/美术/源码）给 CodeBuddy → 引擎 MCP（Unity/Cocos/UE 已支持）+ Skill 划定 MCP 操作边界 → 图生视频抽帧解决序列帧动画。全程 2 天出 Cocos 版。

### 2.4 文章C：触乐《当 AI 开始重写小游戏生产流程》

- **事实**：个人开发者 1200 元 + 2 个月业余做出上线微信小游戏（Claude Code 写码、GPT/Gemini/豆包出图）；AI 广告素材成本不到传统 1/10，买量侧比研发侧落地更快；Sekai 上已有 1500 万个迷你应用，游戏正在变成 UGC 社交内容。
- **核心论断**：**开发不再是瓶颈，判断成了新门槛**。「AI 帮不了你的 4 件事」：产品决策（好不好玩）、新手引导设计（AI 不知道玩家为何困惑，90% 测试者看不懂的教训）、美术风格统一、平台合规审核。小游戏规模恰好规避了 AI 的上下文丢失问题（代码量小、平台单一）。

## 3. 设计对比（一张表）

| 维度 | Mobius | 网易 | 腾讯云 WorkBuddy | 行业/个人实践（文章C） |
|---|---|---|---|---|
| 定位 | 通用自进化 Agent OS | 企业内代码智能中台 | 垂直游戏原型流水线 | 单人工具链 + 平台生态 |
| 组织模型 | @点对点 + 群黑板，首席制 | Core Agent 协调风格化子 Agent | 专家团两两互查（工程+QA） | 无（单人+多工具） |
| 知识/上下文 | Skill/Memory 三级，提示词级 | **代码图谱+研发空间（最深）** | 会话上下文贯穿全流程 | 靠小游戏规模天然规避 |
| 领域结构 | **无（游戏零结构）** | 通用代码级 | **有（策划案→关卡→资产→引擎）** | 有（全流程+平台合规） |
| 验证/质量 | 巡检防偷懒（治意愿不治结果） | AI Review 少而精 | QA agent 互查 | **人工验收是硬瓶颈** |
| 商业形态 | 开源+自托管 | 内部效能（数据回流成壁垒） | 云产品（150+ 客户） | 平台抽成+流量分配 |

**空档清晰可见**：Mobius 有组织没领域，网易有知识没游戏管线，腾讯云有管线但绑定腾讯生态且只到小游戏原型。**「游戏领域的知识工程 + 开放的多 agent 组织」目前没人做全。**

## 4. 可借鉴点清单（按优先级，直接指导实现）

### P0 —— 决定产品形态

1. **上下文贯穿的单一事实源**：把策划案做成**机器可读的结构化工件**（世界观/关卡/数值/UI 的 schema），原型、美术、配表全部从它派生——这是腾讯云流程里最值钱的一步，也直接回应文章C「AI 不知道玩家为何困惑」：结构化设计文档就是人的产品决策的载体。
2. **知识先于生成**：v1 就要有项目知识层——目录结构语义化、引擎版本与 API、编码风格、命名表（网易「研发空间」+ Mobius 三级 Skill/Memory 作用域的合体）。没有这层，多 agent 就是并行的平庸。
3. **验收回路是一等公民**：生成 agent 与 QA agent 对抗互查（腾讯云）+ 可运行冒烟测试 + 人工 checklist。Mobius 的巡检只解决「偷不偷懒」，不解决「对不对」；三篇文章在这一点上完全一致：最终验收必须是人，产品要给验收者好用的工具而非更多产出。

### P1 —— 组织与执行

4. 双层协作照抄 Mobius：主策划 agent 与职能 agent 点对点单聊 + 共享黑板放关卡状态/资产清单/阻塞项。
5. **「让 AI 给 AI 造工具」**：AI 生成关卡可视化编辑页、元素编号化，把模糊的自然语言修改变成精确指令——这是文章B里最聪明的单个设计，成本低收益大。
6. Web-first 原型 + 引擎移植分段：v1 只做 Web 原型闭环（LLM 知识最充分、浏览器即预览），引擎移植（MCP+Skill 划边界）放 v2。
7. 管控照抄 Mobius：危险操作人工审批与无人值守 agent 分开、token 限频、按 agent 划边界——别把两套要求塞进一个上下文。

### P2 —— 长期壁垒

8. 数据回流：纠错数据、审查标记、验收结论沉淀回知识库（网易的闭环），配合 Mobius 式「每次改动可追溯」。这是唯一随时间复利的资产。
9. 把文章C列出的「AI 做不到的 4 件事」直接做成产品功能：新手引导工作流、风格参考卡库、合规材料 checklist——**人的新瓶颈就是你的收费点**。

## 5. 反面清单（不要做的）

- **不要先造通用 Agent OS 等游戏场景长出来**——Mobius 本身就是反例，通用平台对游戏零领域结构，网易也证明了价值全在领域上下文里。
- **不要拿「一句话自动出游戏」当核心卖点**——三篇文章一致证明验收/好玩靠人，宣传过头用户第一次用就失望。
- Mobius 的「自进化改自己源码」在多租户商业场景是安全与合规噩梦；**借鉴其审计与可追溯，不要借鉴「改自己」**。
- 别把「生成更多」当差异点：小游戏月提交已超 1 万款、审核排队 3 天起步——同质化和合规才是死穴，能帮「过审与验收」比能「生成」稀缺得多。

## 6. 给下一步实现的一句话指令

**v1 最小闭环 = 结构化策划案 schema → 带 QA 互查的 Web 原型生成 → 可玩链接 + 人工验收 checklist，组织上用 1 首席 + 策划/程序/QA/美术四职能 + 共享黑板，知识层从三级 Skill/Memory 起步。引擎移植、自进化、数据回流全部留给后续版本。**

## 7. 溯源与关联

- **目标**：`cmtmvs3u0000ejqjst3gc2cmf`（调研 → 沉淀知识 → 方案设计 → 录需求 → 开发工作流）
- **调研产物**：artifact `cmsk2tgmn0000m9rrqdhia5nl`（产品及商业化军师，2026-09-04）；完整报告原文存于该目标的 goal session 消息中
- **本文与验收标准的对应**：验收项「调研报告已沉淀为知识库文档，可通过『调研 / agent / mobius』相关标签检索到」由本文满足
- **相关知识文档**：《沉淀Web大逃杀技术方案与性能红线》《和平精英Web版两次开发复盘与串行开发规范》——文章B「WebGame 技术栈对 LLM 最友好」的判断与 MyRD 已有的和平精英 Web 实践相互印证
- **待补研**：目标描述中 3 个 mp.weixin 原始链接（其中之一为 Claude of Tanks，要点见第 1 节范围偏差声明）

## Sources

- [mobius-system/mobius](https://github.com/mobius-system/mobius)
- [网易多 Agent 与知识工程实践（InfoQ）](https://www.infoq.cn/article/psxyteixpjvwal89fmue)
- [腾讯云林哲：怎么用 AI Agent 开发小游戏（GameLook）](http://www.gamelook.com.cn/2026/06/595411/)
- [当 AI 开始重写小游戏生产流程（触乐/36氪）](https://m.36kr.com/p/3919432566779528)


## 沉淀AI女友剧情生存玩法设计基线

# 沉淀AI女友剧情生存玩法设计基线

> **依据**：需求《我被AI女友包围了》剧情生存挑战游戏需求（id=cmtob3m0p000pm9y6yl6yi1uq）＋ 游戏策划产物（id=cmtn5fhk20008jqck1thxilil）＋ 平台既有 Godot 工程约定（`games/godot-coin-rush`：六段式 GameDesignSpec / contract-check / verify.sh）＋ Godot 官方 Web 导出文档。
> **用途**：实现节点（开发/测试/部署）执行对齐的唯一设计基准。
> **冲突裁决规则**：需求硬约束 > 策划案原文（design-spec.md / design-spec.json）> 本文；发现偏差须回填本文（版本 +1）。
> **两条硬约束**：① godot headless 门禁 0 error 方可合并；② 构建产物必须在平台 AppHost 部署可启动、健康检查通过，禁止仅本地可跑的交付形态。

---

## 一、玩法定位与核心循环（AC1 落点）

**定位**：剧情驱动的生存挑战游戏。玩家扮演被多位 AI 女友包围的主角，通过对话抉择与状态管理在剧情推进中求生并走向多分支结局。

**核心循环（全项目唯一的循环定义，文案/实现/测试均以此表述为准）**：

```
剧情节点选择 → 好感度/威胁度/生存状态变化 → 触发后续剧情与结局分支 →（回到节点选择）
```

三条由循环直接推出的架构推论（策划案已确认，实现不得违背）：

1. **数据驱动**：人设卡、剧情节点、数值全部是 content JSON；逻辑只认 schema 与 `spec.numeric` 键名，不认具体角色与具体数值。
2. **可追溯**：每次结算写 trace，任何 AI 行为输出都能回放定位到 `persona_id` + 状态前后值。
3. **可验证**：验收一律落成契约测试断言（spec/persona/story/ending 四类 + smoke），不靠人工体感。

## 二、单一事实源：六段式 GameDesignSpec（平台既有工程约定）

- 落点 `.myrd/spec/design-spec.json`，六段：**meta / world / entities / levels / numeric / acceptance**。
- `entities[].script/scene`、`levels[].story_data`、`acceptance[].check` **声明的路径必须真实建出**，契约测试校验落点存在性。
- 数值只认 `spec.numeric`，键名与未来 `game_state.gd` 字段一一对应——改数值=改表，不改码。
- 策划案已交付内容（9 个内容 JSON + 2 份文档）：schema 契约 1 份 + 5 张人设卡 + 3 幕剧情（= 9 个 JSON），另有六段式 `design-spec.json` 与人读版 `design-spec.md`（含数值表、两条链路逐步演算、美术基线）。**策划阶段未产 Godot 代码，实现节点按 spec 施工。**

## 三、AI女友人设卡基线（AC2 落点）

- **schema 契约**：`games/ai-girlfriend-siege/data/schema/persona.schema.json`，**9 个必填字段**，覆盖并超出需求的 5 字段（姓名 / 性格标签 / 说话风格 / 好感度规则 / 威胁·危机行为模式）。
- **5 张基线人设卡**（`data/personas/persona-{lumi,vex,ada,momo,sera}.json`）：治愈 / 病娇 / 冷静 / 活泼 / 神秘 五型；字段含主题色、口头禅、`favor_rules`、`threat_rules`、`portrait_prompt`。
- **美术单一事实源**：立绘/形象资产只从 `portrait_prompt` 派生，禁止另行脑补设定——防止多 agent 并行产出美术与文案漂移。
- **解耦铁律**：`persona_loader` 只认 schema 不认具体角色 → **改人设卡免改码**。验收手段 = swap 测试（替换某张卡 JSON、零代码改动，门禁仍过且行为变化）。
- **可追溯格式**：`story_engine` 每次结算写 trace：`node_id / option_id / persona_id / favor·threat 前值与后值`，回放可定位到具体人设与状态。

## 四、剧情幕结构与结局分支（AC3 落点）

- **三幕骨架「包围 → 裂痕 → 倒计时」**：`data/story/act{1,2,3}.json`，共 **18 个节点**，节点图闭合无死链。
- 节点 / 选项 / 数值效果**全部显式声明**；effects 用声明式键值（Δfavor/Δthreat/flag/goto），**禁止节点内嵌脚本逻辑**——嵌逻辑即破坏可追溯与换卡免改码。
- **4 个结局**；其中 **2 条已逐步演算、可复现的可玩链路**（满足"至少 2 个不同结局"验收）：
  - **链路 A → 独活结局**：全程威胁累积 Σthreat 控制在幕级上限（<300）内，终局选逃跑；
  - **链路 B → 带走 Lumi 结局**：Lumi favor 终值 96 ≥ 70，且 threat 30 ≤ 60。
- 结局判定阈值基线（策划案演算使用值）：**favor 结局门槛 ≥70；单人 threat 结局门槛 ≤60；幕级 Σthreat 上限 300**。
- 结局判定由 `ending_contract.gd` 断言（对应 acceptance acc-5/acc-6）；冒烟测试用脚本驱动固定选择序列，跑出 ≥2 个不同结局即 AC3 达成。

## 五、生存循环与数值规则

- 状态三轴：**favor（好感度）/ threat（威胁度）/ 生存状态**；具体生存轴与衰减公式以 `spec.numeric` 为准，键名与 `game_state.gd` 一一对应。
- 每次选择的标准结算链：选项 effects 声明 Δ 值 → story_engine 结算 → trace 落账 → 门控判断下一节点/结局。
- 数值调优只改 `spec.numeric` 与人设卡 `favor_rules/threat_rules`，**任何数值调优不允许以改代码的方式实现**。

## 六、godot 门禁与 CI（AC4 落点）

**门禁三件套（全部 headless，0 error 才可合并；CI 拒绝含错误代码的提交）**：

1. **preflight**：环境与引擎版本预检；
2. **`godot --headless --import`**：资源导入完整性（坏资源/坏路径在此暴露）；
3. **smoke**：headless 跑冒烟 + 契约测试（spec / persona / story / ending 四件，先例即 `games/godot-coin-rush` 的 `contract-check.mjs` + `verify.sh` 模式）。

附加门禁规则：spec 中声明的落点（entities script/scene、levels story_data、acceptance check）必须真实存在；persona/story JSON 过 schema 校验，坏配置 = 门禁失败（让 AC2 的"≥5 字段结构化"变成机器可验证，而不是评审口径）。

## 七、Web 导出与 AppHost 部署规范（AC5 落点）

**引擎事实（Godot 官方文档，已核实）**：
- Godot 4.3 起，**单线程 Web 导出是官方默认推荐路线**：无需跨域隔离响应头、兼容性最好；
- 开启线程支持（SharedArrayBuffer）则硬性要求：HTTPS 安全上下文 + `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`。

**项目裁决规则**：
1. **默认锁单线程导出**；仅当 AppHost 可注入自定义响应头且走 HTTPS 时，才允许评估线程模式。
2. `.wasm` 必须 `application/wasm` MIME；index.html / wasm / pck 同源部署。
3. 体积与首屏预算：剧情游戏静态资源大头是**中文字体与立绘**——中文字体必须子集化；具体体积/首屏红线由实现节点导出实测后回填本文（不在无实测数据时空定数值）。
4. **健康检查**：交付包内置静态 `/healthz`（200 + `{status:"ok",version}`）；部署后 AppHost 探活通过 + 浏览器冒烟（canvas 出现、console 无 error）。
5. PWA service worker 可官方模拟 COOP/COEP，但增加缓存失效复杂度，AppHost 场景**默认不启用**。
6. 禁止 desktop-only / 仅本地可跑形态；未过健康检查的构建不得标记完成。

## 八、目录结构与依赖方向（CI 强制）

```
games/ai-girlfriend-siege/
  data/schema/persona.schema.json      # 契约：人设卡字段
  data/personas/persona-{lumi,vex,ada,momo,sera}.json
  data/story/act{1,2,3}.json           # 三幕节点图
  design/design-spec.md                # 人读版：数值表+链路演算+美术基线
.myrd/spec/design-spec.json            # 六段式单一事实源
```

依赖方向：`persona_loader` 只依赖 schema；`story_engine` 只依赖 `spec.numeric` 键名与 act JSON；UI 只读状态与事件流；**任何 .gd 禁止硬编码角色名或数值**（出现即 lint/评审打回）。

## 九、验收标准映射（AC → 基线落点）

| AC | 验收点 | 基线落点 | 自动化手段 |
|---|---|---|---|
| AC1 | 玩法定位+核心循环经评审确认 | §一 循环唯一表述 | spec 契约测试 |
| AC2 | 人设卡 ≥5 字段、改卡免改码 | §三 schema 9 必填字段 + swap 测试 | persona 契约测试 |
| AC3 | ≥1 条链路复现 ≥2 结局 | §四 4 结局 + 2 条已演算链路 | ending 契约 + smoke |
| AC4 | godot 门禁 CI 生效、错误提交被拒 | §六 三件套 0 error | CI 拒绝合并验证 |
| AC5 | AppHost 部署可启动 + 健康检查通过 | §七 单线程导出 + /healthz + 冒烟 | 部署核对（策划案 acc-12 同为人工核对项）|

策划案共 12 条 acceptance，其中 10 条已配可执行检查（spec/persona/story/ending 四契约 + smoke）；实现节点不得降低已配检查的覆盖面。

## 十、执行经验与 DO NOT（本次目标执行沉淀）

**有效的做法**：
- 策划阶段就把验收配成可执行检查（12 条中 10 条可自动断言）——这是实现节点不返工的关键，印证调研结论「验收回路是一等公民」「知识先于生成」。
- 文案、美术、数值全部从单一事实源派生（portrait_prompt / spec.numeric），多 agent 并行也不漂移。
- 自检抓到链路演算中的「带问号模糊值」并修正为精确终值——**数值表述必须可判定，禁止"约/大概/左右"**。

**DO NOT（违反即打回）**：
- 禁止把人设写进 .gd 代码或节点属性（AC2 直接失败）；
- 禁止节点 effects 内嵌脚本/表达式求值逻辑（破坏可追溯与换卡免改码）；
- 禁止绕过 godot headless 门禁合入主干；
- 禁止交付 desktop-only / 仅本地可跑形态；
- 禁止在策划与配置文档中使用不可判定的数值表述。

## 十一、待核实与回填项（实现节点开工前处理）

1. **数值终值比对**：链路终值在策划执行过程播报中出现过一次修订（如链路 A Σthreat 曾出现 225/210/220 等中间口径），**以 design-spec.md 演算表终值为准**；工作区产物未推送远端分支，实现节点重建文件时须逐值核对并回填本文。
2. **AppHost 能力核实**：是否支持自定义响应头与 HTTPS —— 决定线程模式可行性；不支持则永久锁单线程导出。
3. **实测回填**：Web 导出体积（wasm/pck）与首屏加载时间，导出后实测回填 §七。
4. **生存轴定义**：体力/理智类生存状态的具体轴与衰减公式以 `spec.numeric` 为准，本文不预设定。

---

*版本 v1.0 ｜ 2026-09-05 ｜ 目标管理大师固化。依据：需求 id=cmtob3m0p000pm9y6yl6yi1uq、策划案产物 id=cmtn5fhk20008jqck1thxilil、平台 Godot 工程约定（games/godot-coin-rush）、Godot 官方导出文档。*



---

# 多选测试产品


## 关联项目

### MyRD Playground [frontend]

项目名: MyRD Playground
描述: MyRD 功能测试和沙盒环境
类型: web-app
GitHub: https://github.com/hl3w22bupt/myrd-playground.git
工作流类型: 功能开发


---


## 产品关联知识

## 项目开发规范

# 项目开发规范

## 代码风格
- 使用 TypeScript
- - 遵循 ESLint 规范
- 提交前运行 lint 检查

## Git 提交规范
- 使用 Conventional Commits 格式
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新

## Agent 执行轨迹（agent_execution_trajectories）孤儿 running 记录：诊断、根因与自愈处置手册

# Agent 执行轨迹（agent_execution_trajectories）孤儿 running 记录：诊断、根因与自愈处置手册

## 背景
平台中所有 Agent 执行（channel 频道消息、express_lane 直通车、workflow 内 agent 节点、exploration、secretary、onboarding 等）都会写入一条 agentExecutionTrajectory 轨迹记录，采用 create-then-finalize 生命周期：

- 创建时（createAgentTrajectory）写入 `status='running'`；
- Agent 执行正常结束时（final 事件 / 流自然结束），pipeline 返回路径将 status 置为 `completed`；
- 异常被 catch 时置为 `failed`，并回填 outputPreview / error / durationMs / completedAt。

Claude 子进程层存在 10 分钟默认超时（SIGTERM → 10s 后 SIGKILL）。

`agent_execution_trajectories` 表是所有 Agent 执行的基础数据源，也是进化分析（evidence mining）的关键证据来源，轨迹数据质量直接影响进化证据统计与状态判定。平台 Worker 启动时运行一整套自愈（auto-heal）机制，但当前对轨迹记录存在覆盖盲区。

## 现象
增量时间窗内观测到 7 条轨迹全部停留 `status='running'`，且错误为空、输出摘要为空，覆盖执行类型与角色：

- **channel**：PD-Agent、Architect-Agent、开发者；
- **workflow**：「把 HTML 原型转成生产级 React Native 前端（先发 Android）」frontend 节点、「创建 PR（基于实际变更）」create-pr 节点；
- **express_lane**：Express Agent ×2。

共同特征：记录创建后从未被 finalize，既无 error，也无任何中间输出（outputPreview=NULL），从数据上完全看不出是否还在推进。

影响：
- 轨迹表被孤儿记录污染，进化分析（evidence mining）统计失真（running 状态混入失败/完成判定）；
- 轨迹模型没有 timeout / expiration 字段，理论上可无限 running；
- 与「真正仍在运行但尚无输出」的合法长任务无法从数据上区分。

## 根因
1. **轨迹完结依赖进程内 pipeline 的返回路径**。超时/取消逻辑全部在 Worker 进程内存中（startTimer + activePipelines 注册表）。Worker 被重启（挂起检测触发自动重启、OOM、部署）时，内存定时器与注册表一并丢失，正在执行的轨迹失去 finalize 触发点，永远不会被置为终态。
2. **自愈覆盖盲区**。平台启动自愈覆盖了 workflowRun（autoHealStaleRuns→paused）、expressLaneRun（→failed，error='执行中断（Worker 重启）'）、channel_messages 的 streaming 占位消息（>10 分钟清理 streaming 标记）、agent busy 状态（→idle）、goal 执行（resumeStuckGoalExecutions）、vibe workspace（小时级清理），但**不覆盖 agentExecutionTrajectory 本身**（代码中 grep 零引用），轨迹成为永久孤儿。
3. **自愈仅在启动时执行一次**，运行期没有周期性僵死检测。
4. **finalize 无重试**。finalizeAgentTrajectory 内部 try-catch 仅记录日志：若 finalize 本身失败，轨迹不会再次尝试落终态。
5. **长任务与死执行不可区分**。长时间无任何输出的运行（git/gh 等待交互输入、依赖安装卡住、构建/推送阻塞、模型侧无响应）也不会产生 outputPreview，与死执行在数据上表现完全一致，无法仅靠「有无输出」判定。

## 处置
### 1. 定位滞留轨迹
```sql
SELECT id, agent_type, agent_name, status, created_at,
       (now() - created_at) AS age, output_length, error
FROM agent_execution_trajectories
WHERE status = 'running' AND created_at < now() - interval '30 minutes'
ORDER BY created_at;
```
也可按更新时间检索并补充更多诊断字段：
```sql
SELECT id, agent_type, status, "createdAt", "updatedAt", output_preview, error, metadata
FROM agent_execution_trajectories
WHERE status = 'running' AND "updatedAt" < now() - interval '30 minutes'
ORDER BY "updatedAt";
```
重点看 output_length IS NULL/0 的记录——无输出即无进展。

### 2. 区分「假 running」与「真僵尸」
- 检查对应 Worker / 子进程是否存活；
- 观察 updatedAt 是否仍在刷新；
- 若不再变化且无输出，判定为孤儿。

### 3. 按类型处置
- **workflow 节点**：查关联 workflow_run 的 status。若 run 也卡住，启动自愈会将其置为 paused（节点重置为 pending），可手动 resume；轨迹需同步标记 failed 并注明原因。
- **express_lane**：expressLaneRun 启动自愈已标记 failed（error='执行中断（Worker 重启）'）；确认轨迹同步标记 failed。worktree 现场保留在 `$WORKSPACE_ROOT/<projectId>/run-express-<taskId>`，可手动补收尾后「续跑」。
- **channel**：启动自愈会清理 streaming=true 且超过 10 分钟的 channel_messages 占位消息（content 置为「(Agent 异常中断 — Worker 重启)」）；轨迹需同步标记 failed。

### 4. 检查僵尸子进程
```bash
ps aux | grep -E 'claude (-p |--print)' | grep -v grep
```
对照轨迹的 worktree / session_id / prompt_preview 定位残留进程，确认无活动输出后 kill（SIGTERM → 10 秒后 SIGKILL）。

### 5. 清理孤立 worktree
确认无活动执行引用后，用 `git worktree remove --force` 删除 `$WORKSPACE_ROOT/<projectId>/run-*` 下对应目录。

### 6. 批量修复（谨慎）
先人工确认无关联的活动中执行，避免误杀：
```sql
UPDATE agent_execution_trajectories
SET status = 'failed',
    error = '执行中断（僵死自愈：无进展超时）',
    completed_at = now()
WHERE status = 'running' AND created_at < now() - interval '30 minutes';
```
保留 inputs / metadata 以便复盘，避免误判为进行中或计入成功统计。

### 7. 复盘
把轨迹 id 关联到 workflow run / express lane / channel 会话，判断是「提示词缺执行纪律」还是「编排层 finalize 缺失」。

## 预防
- **轨迹有界生命周期 + 僵死自愈**：轨迹必须有硬上界与回收任务（启动时 + 每小时周期检测）。
- **所有执行路径必须输出中间进度**，避免「运行中但零输出」。
- **新增执行环节（新 agentType）时**，必须补齐完结路径与自愈覆盖，并把 agentExecutionTrajectory 纳入与 workflowRun / expressLaneRun 同级的启动自愈清单。
- **Agent 提示词层**：要求有界执行（见《Workflow Agent 节点执行纪律规范》），确保任何路径都能 finalize。
- **记录层**：为轨迹增加 timeout / expiration 字段与「心跳刷新」机制，长期无心跳即可判定可回收；监控 running 超过阈值（如 30 分钟）的记录。
- **Worker 重启流程**中补充 trajectory 清理步骤。

## MyRD 平台真实仓库结构地图、文档/技能入口与常见路径陷阱

# MyRD 平台真实仓库结构地图、文档/技能入口与常见路径陷阱

## 背景
agent 在涉及 MyRD 平台的任务中反复出现两类高成本问题：

1. **文档/技能入口定位失败**：任务开始时多次通过 glob 搜索 `**/myrd*/**/SKILL.md`、`**/myrd-platform-skill*` 等模式均返回 0 命中，误判平台「为云端平台、本地无文档」（#18283），或技能未在预期目录找到（#18123），随后不得不多轮读取源码与文档才定位入口（#18282-18293）。myrd-platform-skill 是 agent 理解平台的标准入口（最近 14 天调用 4 次），但 agent 本地环境无法直接命中其正文，造成重复勘察，agent 花费约十余次观测重复勘察结构。
2. **引用不存在的文件路径**：多会话（#18282-18293、#18596-18617）反复手工翻查源码才能定位平台结构，且 #18616/#18617 实证发现提案引用了不存在的 `frontend/lib/services/*` 与 `myagent-client.ts` 路径，导致提案被驳回、评审周期浪费。

根因在于「文档与实际源码结构不一致」——仓库（典型根目录 `/Users/leo/workspace/myrd`）存在源码与编译产物并存、文档过时等问题。本文档给出经源码核实的真实入口、真实结构地图及高频错误路径，供涉及 MyRD 内部实现的任务直接使用，消除重复探索并防止错误路径再次出现，显著降低后续任务冷启动成本。

## 关键入口（权威文档与技能）
- **平台使用说明书（权威）**：`/Users/leo/workspace/myrd/docs/myrd-platform-skill.md`。注意：位于源码仓库 `docs/` 下，而非 `~/.claude/skills/`。内容覆盖：服务地址、JWT 认证、全部 API 分类、典型示例、数据模型、边界情况，并含平台进化系统架构说明。
- **快速开始**：`/Users/leo/workspace/myrd/docs/guides/quick-start.md`（环境搭建 → 服务启动 → 注册 → 建项目 → 跑工作流）。
- **工作流集成/部署状态**：`/Users/leo/workspace/myrd/WORKFLOW_INTEGRATION.md`、`/Users/leo/workspace/myrd/MYRD_SETUP_STATUS.md`。
- **数据库 schema**：`/Users/leo/workspace/myrd/prisma/schema.prisma`（含 `AgentExecutionTrajectory` 模型，表名 `agent_execution_trajectories`）。

## 真实结构（经源码核实）
- **入口与自愈**：`src/index.ts`（worker 启动时执行 auto-heal，覆盖 WorkflowRun / ExpressLaneRun / channel_messages / agent status / goals / vibe workspace，**不含** agentExecutionTrajectory）。
- **工作流引擎**：`src/services/workflow/engine.ts`（约 2626 行；含 `resume()` 约 443 行、`iterateFrom()` 约 784 行、`rerunFrom()`、`rollbackToCheckpoint()`、`sharedSetupProjectWorkspace()`；支持 DAG 执行 / 自愈 / 重试 / git checkpoint）。
- **Coding-agent 实现**：`src/services/coding-agent/{claude-code-agent.ts, local-claude-agent.ts, remote-agent.ts, types.ts}`（其中 `claude-code-agent.ts` 含 10 分钟默认超时与进程清理逻辑）。
- **进化系统服务**：`src/services/evolution/`（analyzer 等模块；支撑证据系统三类数据源、证据挖掘策略）。
- **路由**：`src/routes/workflows.ts` 等。
- **前端真实源码**：`frontend/` 目录存在，含 `app/` 与 `components/` 源码，如 `frontend/app/(dashboard)/projects/new/page.tsx`、`frontend/components/projects/run-workflow-button.tsx`。
- **编译产物（非源码）**：`src/dist/`——仅含编译后声明/产物（如 `src/dist/lib/myagent-client.d.ts`、`src/dist/services/coding-agent/myagent-agent.d.ts`），**不是源码**。

## 服务端口
前端 :3001、后端 API :3111、streaming :4112、MyAgent :3000、数据库 :5432。

## 高频错误路径（不存在，务必避免）
| 常见错误引用 | 真实对应 |
|---|---|
| `frontend/lib/services/workflow/engine.ts` | `src/services/workflow/engine.ts` |
| `frontend/lib/services/coding-agent/claude-code-agent.ts` | `src/services/coding-agent/claude-code-agent.ts` |
| `myagent-client.ts`（作为源码） | 无此源码；仅有编译声明 `src/dist/lib/myagent-client.d.ts` |
| 认为前端目录含业务服务代码 | `frontend/` 主要被 `node_modules` 占据；业务服务在 `src/services/` |

## 根因
1. 文档（含 `docs/guides/quick-start.md`）描述的结构与实际仓库不一致或已过时；
2. agent 凭记忆/推测引用路径，未做存在性核实；
3. `src/` 与 `src/dist/` 并存，把编译产物误当源码。

## 处置（核实方法）
- 引用任何路径前，先用 glob/grep 在仓库根目录确认文件存在；
- 区分 `src/`（源码）与 `src/dist/`（编译产物），引用源码一律指向 `src/`；
- 工作流引擎、coding-agent、evolution 等业务服务一律在 `src/services/` 下，不在 `frontend/lib/` 下；
- 「文件不存在」的判断以 glob 返回空为唯一依据，不要依据记忆或文档；
- 分析轨迹/进化数据时，直接读 `agent_execution_trajectories` 表与 `prisma/schema.prisma` 的 `AgentExecutionTrajectory` 模型，不要靠源码 glob 反推。

## 预防
- 涉及 MyRD 内部实现的提案/文档，落笔前对每个文件路径做一次 glob 核实；
- 平台是本地源码 + 多 run 工作区（`/Users/leo/.myrd/workspaces/proj-myrd/run-*`）并存；run 工作区可能包含主干尚未合入的功能（如 express-lane、轨迹追踪迁移），分析时以对应 run 工作区为准；
- 本文档随仓库结构变更应同步更新。

## 架构设计文档

# 架构设计

## 技术栈
- 前端：Next.js + React + TypeScript
- 后端：Motia (iii 引擎)
- 数据库：PostgreSQL + Prisma

## 模块划分
- 项目管理模块
- 任务管理模块
- 知识库模块

## 需求池功能说明

# 需求池功能

## 功能说明
需求池用于管理产品需求、Bug 修复、功能改进等任务。

## 状态流转
- backlog: 待办需求
- todo: 已计划
- in-progress: 进行中
- review: 评审中
- done: 已完成
- archived: 已归档

## 沉淀Web大逃杀技术方案与性能红线

# 沉淀Web大逃杀技术方案与性能红线

> 来源：《和平精英Web版》架构Agent技术方案（PR #8，产物 id=cmos298dg0001m9mxandnum2z，repo hl3w22bupt/myrd-playground）
> 需求基线：《「和平精英Web版」核心玩法需求（跳伞/拾取/射击/缩圈/AI 对抗）》（id=cmtfyd7uc000im9hapib6ann3）
> 用途：**开发节点（M0~M7）执行对齐的唯一技术基准**。本文所有数值均为架构评审结论，实现时落入 `content/` 配置表由测试断言，禁止硬编码、禁止擅自更改。

---

## 一、引擎选型结论（ADR-001/002/007/008）

**最终选型：Three.js r185 + Vite 7 + TypeScript 5.9.x + 零后端静态部署。**

### 1.1 为什么是 Three.js（候选对比结论）

| 维度 | Three.js r185 ✅ | Babylon.js | PlayCanvas | Unity WebGL |
|---|---|---|---|---|
| 核心体积（gz 约量级） | ~170KB | ~1MB+ | ~1MB | 10~40MB（含 wasm 堆） |
| 首屏可交互（红线 ≤5s） | 最优 | 良好 | 良好 | 难达标 |
| TS 类型 | 官方自带 | 官方维护 | 部分 | 生成式，质量一般 |
| 玩法逻辑自由度 | 最高 | 高 | 受编辑器约束 | C# 工具链负担 |

落选核心逻辑：本项目的核心工作量在**玩法仿真**（跳伞四阶段/弹道结算/缩圈几何/AI 行为），不在渲染管线。引擎越"全"（内置物理/GUI/场景序列化），越容易把逻辑写进引擎回调，破坏"仿真与表现分离"主决策；Unity WebGL 的 10~40MB 加载直接违反首屏 ≤5s 红线。Three.js 生态与问题检索量最大，上手成本最低。

### 1.2 配套选型（配套 ADR）

| 决策 | 结论 | 一句话理由 |
|---|---|---|
| ADR-002 物理碰撞 | **自研**（高度场采样 + AABB + 射线检测，约 300 行） | 本期碰撞仅三类需求；零 wasm 加载复杂度；完全确定性。不支持刚体堆叠，二期载具预留接口 |
| ADR-003 时间步进 | **fixed timestep 50Hz + rAF 可变渲染 + 插值** | AC2 落点可复现的硬前提；可变 dt 无法保证 |
| ADR-004 实体组织 | **ECS-lite**（轻量结构化实体 + 系统函数） | 实体上限 20，bitecs 等重型 ECS 无收益 |
| ADR-005 UI 方案 | React 19（低频菜单/背包/结算）+ 原生 DOM/Canvas2D 直写（高频 HUD/小地图） | React 重渲染不适合每帧更新 |
| ADR-006 AI 决策 | **有限状态机 FSM + 分帧更新**，不做行为树/GOAP | 需求仅 5 类行为，FSM 足够 |
| ADR-007 TS 版本 | 锁 **5.9.x**，不上 TS 7（native preview） | npm 最新 7.0.2 为 Go 原生移植，工具链未稳 |
| ADR-008 构建 | Vite（锁 7 稳定线）+ 零后端静态部署 | 纯前端无服务端依赖 |

### 1.3 引擎边界（防"引擎漂移"，CI lint 强制）

- 渲染层**只允许** import `three`；`render/` 目录之外出现 three import 即 lint error。
- 需自建渲染基建（每项 <150 行）：场景对象池、LOD 管理、阴影相机跟随、毒圈/弹道特效材质、调试 HUD 覆盖层。

---

## 二、场景设计结论（仿真与表现分离 + 确定性架构）

### 2.1 总体架构（最重要的一条决策）

玩法逻辑全部运行在**无 DOM 依赖的确定性仿真核心**中，Three.js 只做「快照 → 场景对象」映射，UI 只读事件流。分层自下而上：

```
UI 层（React 低频） + HUD/小地图（DOM/Canvas2D 高频直写）
        ↑ GameEvent 事件流
表现层 render/（Three.js r185）：场景·资源·LOD·相机·特效·对象池
        ↑ 每 rAF 只读 WorldSnapshot
仿真核心 core/（纯 TS，零 DOM 依赖，Node 可直接运行）
        fixed tick 50Hz · seeded RNG · ECS-lite
        ↑ PlayerIntent 指令流
输入层 input/ ＋ 内容层 content/（配置表 JSON）
```

三条关键推论：
1. **仿真核心不 import Three.js** → AC2/AC3/AC4/AC5 可在 Node + Vitest 中直接跑满局自动化断言（这是整个测试策略成立的前提）。
2. 渲染层崩溃/加载失败不推进仿真状态；渲染层可整体降级为占位几何。
3. UI 只消费事件，不回写仿真状态，杜绝 UI 驱动逻辑。

### 2.2 目录结构与依赖方向（CI 强制，违反即 lint error）

| 模块 | 可依赖 | 禁止依赖 |
|---|---|---|
| `core/`（loop/rng/world/events/systems） | `content` | `render` `ui` `input` `three` `react` |
| `content/`（weapons/loot/zone/map/constants） | — | 其他所有模块 |
| `render/` | `core` 类型、`three`、`content` | `ui` |
| `input/` | `core` 类型 | `render` `ui` |
| `ui/` | `core` 类型与事件 | `core` 内部实现细节 |

### 2.3 双循环确定性模型（性能与可复现的骨架）

```
rAF 渲染循环（可变，浏览器驱动）
 ├─ 累积器 accumulator += dt
 ├─ while (accumulator >= 20ms && catchUp < 3) core.tick()   // 固定 50Hz
 ├─ catchUp ≥ 3 → 丢弃积压并告警（防死亡螺旋，宁降速不雪崩）
 ├─ renderer.render(scene, camera)
 └─ 渲染层用 alpha = accumulator/TICK_MS 做位置插值（消除 50Hz 抖动）
```

- 逻辑 tick **50Hz（20ms）**：射击/掉血精度足够（AC4/AC5 按秒结算），比 60Hz 省 17% 逻辑开销。
- 插值只做渲染层位置/朝向 lerp，**不插值逻辑状态**，保证回放与断言用纯逻辑状态。
- 确定性铁律：所有随机数来自 **seeded RNG**（xoshiro128\*\* 或 mulberry32），`Math.random()` 与 `tick()` 内 `Date.now()`、DOM 访问全部禁止（lint 层面强制，破坏禁令的 PR 直接打回）。
- 随机流隔离：跳伞气流/AI 行为/物资生成由同一 rng 流的不同**子流**驱动（`rng.fork('loot')` / `rng.fork('ai')`），避免行为改动影响物资分布。
- 回放协议免费获得：录制 `{seed, contentPackVersion, intents[]}` 落 JSON，同 seed 同意图序列必然逐帧一致——bug 复现与 AC2 断言共用此机制。

### 2.4 场景与对局规模参数

| 项 | 数值 | 说明 |
|---|---|---|
| 地图尺度 | **1.6km × 1.6km** | AC2 落点容差 5% = 80m |
| 地形 | 程序化高度场 + 区域划分（城区/野区） | 无真实地形资产 |
| 建筑 | AABB 占位体 | 配合分离轴碰撞（先 X 后 Z + 速度钳制） |
| 对局规模 | 玩家 1 + AI 10~19，实体上限 20 | N5 |
| 单局时长 | < 10 分钟自然结束（AC1） | 缩圈 6 阶段总时长约束保证 |
| 美术 | 程序化几何 + 免费低模占位 | 范围裁剪：不做骨骼动画/联网/账号，AC 全部为数值/流程验收 |

### 2.5 仿真系统与 tick 执行顺序（core/systems）

| 顺序 | System | 职责 |
|---|---|---|
| 1 | lifecycle | 对局状态机 lobby→parachuting→playing→ended；胜负判定（仅剩 1 存活） |
| 2 | parachute | 运输机航线、四阶段（自由落体→开伞→滑翔→落地）物理 |
| 3 | movement | 地面移动、高度采样、AABB 碰撞 |
| 4 | combat | 射击节流、弹道射线、命中判定（包围盒+部位+距离衰减）、换弹/切枪 |
| 5 | loot | 按区域密度生成、拾取判定、背包容量/丢弃、护甲减伤/医疗回血 |
| 6 | zone | 缩圈阶段表、圈心/半径插值收缩、圈外按秒掉血 |
| 7 | ai | FSM（patrol/loot/seek/fire/fleeZone/dead）+ 轮转分帧决策 |

**AI 与玩家共用同一套 PlayerIntent 与同一套 systems，AI 不走特权通道**——这条约束使"AI 也会被淘汰/也会避毒"天然成立，也让 AC4 命中率可用 AI 对 AI 对局复现验证。

核心契约（`MatchHandle`）：`tick(intents[])` 推进 / `snapshot()` 只读快照（渲染唯一数据源）/ `drainEvents()` 事件消费 / `status()` / `result()`（排名/淘汰数/用时）。

---

## 三、武器系统设计结论（AC3/AC4 数值基准）

### 3.1 WeaponDef schema（content/weapons.ts）

```ts
interface WeaponDef {
  id: WeaponId; category: 'ar' | 'smg';
  damage: number;        // 基础伤害
  rpm: number;           // 射速（发/分）
  magazine: number;      // 弹匣容量
  reloadMs: number;      // 换弹时间
  recoil: number;        // 后坐力系数 0..1
  effectiveRange: number;// 有效射程 m，超出伤害线性衰减至 50%
  spread: number;        // 散布 rad
  projectileSpeed: number; // 弹速 m/s（射线扫描命中判定）
}
```

### 3.2 双武器初始数值（彼此可区分是 AC4 验收点）

| 参数 | 步枪 `ar_m4` | 冲锋枪 `smg_ump` |
|---|---|---|
| damage | 26 | 18 |
| rpm | 620 | 850 |
| magazine | 30 | 25 |
| reloadMs | 2200 | 1800 |
| effectiveRange | 350m | 120m |
| recoil | 0.45 | 0.30 |

### 3.3 命中与伤害结算规则

- **部位倍率**：头 2.5 / 躯干 1.0 / 四肢 0.75；生命值归零即淘汰（cause: shot | zone）。
- **距离衰减**：超出 effectiveRange 后伤害线性衰减至 50%。
- **命中判定**：弹道射线扫描（projectileSpeed）+ 目标包围盒，静止目标有效射程内命中率 ≥90%（蒙特卡洛 1000 发自动化断言）。

### 3.4 物资与防具医疗数值（AC3 基准）

| 项 | 数值 |
|---|---|
| 护甲（躯干减伤） | 0.35 |
| 头盔（爆头减伤） | 0.5 |
| 医疗包 | +60 HP，使用 3000ms |
| 物资种类 | 武器/弹药/护甲/头盔/医疗包/投掷物，均带 gridCost 背包格占用 |
| 生成规则 | 按 zone 分区密度 + 权重池（LootTableDef），生成数量/种类必须与表断言一致 |
| 生效时机 | 拾取即生效：装备武器立即可射击、穿甲减伤、医疗回血 |

### 3.5 缩圈配置（AC5 基准，ZoneConfig）

- 首圈半径 **600m**，每阶段半径乘数 **0.65**，圈心随机偏移比例 0.4。
- 6 阶段圈外 dps：`[0.4, 0.8, 1.5, 2.5, 4, 6]`（逐阶段递增，验收断言点）。
- 等待/收缩秒：`[60/40, 50/35, 40/30, 35/25, 30/20, 25/15]`（合计 < 10 分钟，反推满足 AC1）。
- HUD 实时显示当前圈、下一圈轮廓与阶段倒计时。

---

## 四、60FPS 性能红线（超预算即视为性能缺陷）

### 4.1 硬红线指标（N1/N4 推导，验收工具：调试 HUD）

| 预算项 | 目标值 | 硬上限 | 红线含义 |
|---|---|---|---|
| 帧率 | 桌面 **60 FPS**；移动 ≥30 FPS | — | N4，M0 DoD 即要求空对局 60FPS 稳定 |
| 单帧 draw calls | < 120 | **150** | 超 150 判性能缺陷 |
| 单帧三角形 | < 400k | **800k** | — |
| 逻辑 tick 单帧耗时 | < 3ms | **8ms**（超限告警） | tick 超时会挤压渲染预算 |
| 首包 JS（gz） | < 800KB | **1.2MB** | 支撑 N1 首屏可交互 ≤5s |
| 纹理内存 | < 200MB | **400MB** | — |
| 首屏可交互 | ≤ 5s（桌面宽带） | — | N1，免安装定位的底线 |

### 4.2 画质三档定义（Medium 为默认）

| 参数 | Low | Medium（默认） | High |
|---|---|---|---|
| 像素比 | min(dpr,1)×0.75 | min(dpr,1) | min(dpr,2) |
| 阴影 | 关闭 | 1 级跟随相机 1024 | 2048 + 更远投影 |
| 视距/雾 | 300m 雾浓 | 600m | 1200m |
| LOD 切换距离 | 收紧 50% | 基准 | 放宽 30% |
| 植被/物资实例化密度 | 40% | 100% | 100% |
| 反锯齿 | 关 | 关（像素比补偿） | MSAA×4（WebGL2） |

默认档位：`navigator.userAgent` 粗分（移动→Low，桌面→Medium）；High 仅手动或设备探测通过后开启。

### 4.3 动态降档规则（render 层实现，与仿真无关）

- 采样窗口：每 **2 秒**计算平均 FPS 与 p95 帧时间。
- **降档**：连续 2 窗口 `FPS < 45` → 降一档（High→Medium→Low）；Low 后改为降分辨率 25%。
- **升档**：连续 5 窗口 `FPS > 58` → 升一档，每分钟至多一次（防抖动）。
- 每次档位变化写入调试 HUD 与 console，便于定位。

### 4.4 分帧与达标手段

- **AI 分帧**：决策每 tick 只更新 **1/4 实体**（轮转分片），感知与决策同频，移动每 tick 执行；单 tick 决策耗时预算 <3ms（M6 验收）。
- **毒圈掉血**：按秒结算（AC5 语义），tick 内累计时间再结算，不逐 tick 扣血。
- 渲染达标手段：地形/植被用 `InstancedMesh`；物资与建筑静态合批；阴影只投影主光；远处实体只更新朝向不更新动画。
- 兼容矩阵：桌面 Chrome/Edge/Safari/Firefox 完整；Android 中端机（≥4GB）Low/Medium ≥30FPS；iOS Safari Low/Medium（全屏/指针锁定需用户手势）；WebGL2 不可用直接降级提示页（不承诺 WebGL1）。
- 指针锁定（Pointer Lock）用于瞄准；Esc 退出后 UI 需提供"点击继续"重进。

### 4.5 可观测性（性能验收的测量工具）

内置调试 HUD（`?debug=1`，Release 默认关闭），M0 交付时必须可用：FPS/平均与 p95 帧时间/tick 耗时与漂移/draw calls/triangles/纹理内存/实体数/AI 状态分布/当前画质档与最近切换原因；支持 `?seed=123&replay=xxx` 固定种子与回放。

---

## 五、里程碑与执行对齐（开发节点照此排期）

```
M0 地基(0.5w) → M1 跳伞(1w) → M2 移动+地图(1w) → M3 物资(1w)
→ M4 射击(1w) → M5 缩圈(0.5w) → M6 AI(1w) → M7 闭环+调优(1w)   合计 ≈ 7 周
```

| 里程碑 | 关键交付 | 硬验收（DoD） | AC |
|---|---|---|---|
| M0 地基 | 50Hz 确定性循环、seeded RNG、事件总线、调试 HUD、CI + 依赖方向 lint | 空对局 60FPS；core 内 Math.random/Date.now 被 lint 禁止；HUD 可见 | — |
| M1 跳伞 | 四阶段跳伞、落点控制 | 同 seed 同输入落地坐标逐 tick 一致；落地 1s 内 state=ground；偏差 ≤80m | AC2 |
| M2 移动+地图 | 高度场、城区/野区、AABB 碰撞、第三人称相机 | 60FPS；不穿墙不穿地；draw calls<120 | — |
| M3 物资 | 密度生成、拾取、背包、防具医疗生效 | 生成符合权重表；数值与配置一致 | AC3 |
| M4 射击 | 武器表、弹道命中、部位/距离衰减 | 静止目标命中率 ≥90%（1000 发）；武器参数可区分 | AC4 |
| M5 缩圈 | 阶段表、插值收缩、按秒掉血、HUD 圈轮廓 | 各阶段参数与表一致且 dps 递增 | AC5 前半 |
| M6 AI | FSM 六状态、感知索敌、分帧 | AI ≥10；完成落地→拾取→交火→避毒路径；决策 <3ms | AC5 对抗 |
| M7 闭环 | 胜负结算、录制回放、降档、回归 | 10 局采样 100% 自然结束 ≤10min；性能预算全达标 | AC1 + AC5 胜负 |

依赖：M1→M2→M3→M4 串行；M5 仅依赖 M2 可与 M4 并行；M6 依赖 M3/M4/M5；M7 收口。每个里程碑必须以"可运行 + 可验收"结束，禁止跨里程碑堆叠未验证功能。

测试策略三层：**Node 仿真断言为主**（core 零 DOM → 无需浏览器、可进 CI、覆盖 AC2/3/4/5 全部数值）；Playwright 性能冒烟仅 M0/M2/M7 各一次（读 HUD 断言预算，不逐帧比对画面）；人工体验走查仅 M7。

---

## 六、风险红线与待核实事项（实现前必须确认）

| 风险 | 触发条件 | 对策 |
|---|---|---|
| 跳伞手感调不平（AC2） | M1 连续 3 天不收敛 | 空气阻力模型参数化（content 暴露 drag/glide）+ 落点预览圈 UI |
| AI 交火强弱失衡 → 单局时长失控 | M6 采样 >12min 或 <4min | AI 反应延迟/命中率/搜索半径进配置表，M7 十局采样调参 |
| 移动端帧率不达标 | 中端机 Medium <30FPS | 自动降档兜底；Low 档为硬底线（关阴影+降分辨率） |
| 自研碰撞穿墙/卡墙 | M2 冒烟出现 | 先 X 后 Z 分离轴 + 速度钳制；缺陷用回放文件复现 |

**M0 前必须核实的 3 项**（本文数值以官方文档/公开资料为据，非实测）：
1. Three.js 核心 gz 体积与真实首屏时间——用实际 `vite build` 产物复核并回填 4.1 的首包红线。
2. iOS Safari WebGL2 在目标最低机型上的表现——不达标则 iOS 锁 Low 档。
3. Pointer Lock 在平台预览 iframe 中的可用性——若被禁，降级"鼠标移动=视野"方案并记录。

## 七、二期演进预留（本期不做，只留边界）

- **多人联机**：`tick(intents)` 已解耦输入与状态，二期将本地输入替换为远端指令流（客户端预测 + 服务器权威），core 无需重写——这是确定性设计免费换来的关键预留；二期联机选状态同步，不依赖 lockstep（跨设备浮点一致性本期不承诺）。
- **载具/复杂物理**：movement system 内部可替换为 Rapier，对外仍走 PlayerIntent。
- **内容扩量**：content 配置表即内容管线，新增武器/物资/地图不改代码。
- **存档/战绩**：结构化 MatchResult 直接对接后端传输层。

---

*版本 v1.0 ｜ 2026-08-30 ｜ 依据 PR #8（commit ec48f16）架构方案固化；术语与规范以《「和平精英Web版」核心玩法需求》与本方案原文为准。*

## 沉淀知识：和平精英Web版两次开发失败复盘与pubg-web-core串行开发规范

# 沉淀知识：和平精英Web版两次开发失败复盘与pubg-web-core串行开发规范

> **适用功能线**：branchKey=`pubg-web-core`（和平精英Web版核心玩法）
> **版本**：v3（2026-08-31。演进：v1《小步串行开发与防超时规范》→ v2《串行小步开发规范与两轮失败复盘》→ v3 并入第三轮「换流程外壳仍失败」的实证与 Agent 兜底成功案例，固化**串行开发、禁止并行分支**红线）
> **权威技术基准**：《Web大逃杀技术方案与性能红线》（知识 id=6439fc3e-9217-4004-b091-aa79a6f9bcab）＋ 架构方案 PR #8（产物 id=cmos298dg0001m9mxandnum2z，repo hl3w22bupt/myrd-playground，Three.js r185 + Vite 7 + TS 5.9.x + 50Hz 确定性仿真核心 + seeded RNG）
> **需求基线（唯一需求来源）**：《和平精英Web版（pubg-web-core）收敛总需求：稳定60FPS+画面够看+核心玩法完整闭环》（id=cmtg6bxv6003ym9hav1sxej1e，branchKey=pubg-web-core）
> **用途**：约束本功能线所有开发节点的立项方式、分支策略、步长与门禁分级，固化三轮失败根因与已验证的补救路径，供后续迭代直接复用，防止同类失败重演。本规范管「怎么不掉链子」，技术基准文档管「怎么做对」。

---

## 一、三轮失败全景（开发类运行 9 次：7 败 2 成）

### 1.1 第一轮：全量口径（规范产生前）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 1 | 实现核心玩法（跳伞/拾取/射击/缩圈/AI 全量） | ❌ failed | cmtfz3zu70016m9ha4wldebwo | **单次任务过重**：5 大玩法模块塞进一个节点；且无独立需求基线 |
| 2 | 优化画面与流畅度 | ❌ failed | cmtfz6s9k001dm9hatl10qx9b | **目标混合**：画面表现 + 性能红线两类验收口径同节点，失败无法归因 |
| 3 | 实现最小可玩闭环（需求 id=cmtg05te2001zm9hamye40r6u） | ✅ completed | 见功能线运行记录 | 先立项收敛需求、边界明确、验收口径单一（正面样本） |

### 1.2 第二轮：小步口径（v1 规范执行后，3 步全败）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 4 | 第1小步·性能修复（稳定60FPS） | ❌ failed | cmtg2wvet002tm9hagm2awqhj | **空仓库起步** + **完整E2E门禁过重** |
| 5 | 第2小步·画面升级（材质光照雾效粒子+HUD） | ❌ failed | cmtg3pefz0034m9hahhlpy86p | 小步体量 × 全量门禁，单次运行预算失衡 |
| 6 | 第3小步·玩法补齐与缺陷修复（最终E2E+PR） | ❌ failed | cmtg5bzsp003jm9ha5876khnw | 同上，且前两步无合入成果可叠加，修复失去基线 |

（第 5、6 步之间插入一次成功的「代码审查」Agent 联合审查：审查前两步变更并输出缺陷清单，产物 id=cmst009ls000am9jmyk8ylfil —— 「轻实现 + 专项审查」组合是可行的补充通道。）

### 1.3 第三轮：换流程外壳（v2 规范执行后，仍败）

| # | 节点 | 结果 | run id | 根因 |
|---|---|---|---|---|
| 7 | pubg-web-core 分支叠加「画质与60FPS性能优化」 | ❌ failed | cmtg8kgc3004zm9hawlb9kvxo | 双目标（性能+画面）混合 + 「实现+完整E2E门禁」整链仍压在单次运行 |
| 8 | 第1小步·性能修复（流程变体：开发测试→审查→人工确认→创建PR） | ❌ failed | cmtg6jkbc004am9hauxsfe20k | **流程外壳变了，预算约束没变**：仍要求单次运行装下 实现+全量门禁，且未先拉取既有实现 |

**第三轮结论（v3 新增）**：失败与「流程里有没有审查 / 人工确认环节」无关，与「单次运行预算能否装下 实现 + 门禁」有关。给同一摊子加环节只会更重，不会更稳。有效解法只有四个：收敛范围、拆小步、门禁分级、换执行通道（Agent 兜底）。

### 1.4 根因归纳（跨三轮稳定复现的 3 + 1 条）

1. **空仓库起步**：开发工作流未先 `git fetch origin pull/<PR号>/head:pr-<PR号>` 拉取既有实现（PR #8 架构 + 已合入的最小可玩闭环 + PR #9 补齐成果），在空仓库上从零重复搭地基，把宝贵的单次运行时长消耗在与本步目标无关的工作上。
2. **单次任务过重**：第一轮是「节点肥」（多模块/多口径混装）；第二、三轮节点已瘦，但「实现 + 全量门禁」整条链仍压在同一个单次运行里，链条总重没降。
3. **完整E2E门禁过重**：小步场景下「lint + 全量单测 + Node 全流程自动化断言 + 构建 + 冒烟」成本占比畸高，直接挤爆单次运行时间窗，是二、三轮连败的直接放大器。v2 已修订为门禁分级（见第三节规则 3）。
4. **只换流程外壳无效（v3 新增）**：第三轮改用含「审查 + 人工确认」的流程变体（run cmtg6jkbc004am9hauxsfe20k）依旧失败。诊断失败时先看三件事——仓库基线是否为空、单次运行装了哪些活、门禁多重——而不是流程叫什么名字。

---

## 二、补救路径（逐条标注验证状态）

| # | 动作 | 验证状态 | 证据 |
|---|---|---|---|
| 1 | **需求固化**：失败动作立为正式需求基线，目标不悬空 | ✅ 已验证 | 收敛总需求 id=cmtg6bxv6003ym9hav1sxej1e（branchKey=pubg-web-core，统一修正 `pubb-web-core` 笔误） |
| 2 | **收敛范围**：把大目标收敛为边界单一的最小可玩闭环 | ✅ 已验证 | 需求 id=cmtg05te2001zm9hamye40r6u → 对应 run completed（9 次开发运行中 2 次成功之一） |
| 3 | **同 branchKey 串行叠加**：后一步基于前一步已合入成果 | 📌 已固化为红线 | 第三节规则 1；本功能线后续节点一律复用 branchKey=pubg-web-core 串行执行 |
| 4 | **Agent 兜底**：工作流连续失败后由 @开发Agent 直接接管 | ✅ 已实证 | 「开发与测试Agent」检查分支产物、补齐缺失玩法与性能缺口并提 PR → completed，PR #9（产物 id=cmst009lq0009m9jmg3e4zh9l） |
| 5 | **审查前置**：先联合审查既有变更，输出缺陷清单再修 | ✅ 已实证 | 代码审查Agent 缺陷清单（产物 id=cmst009ls000am9jmyk8ylfil），修复步以其为输入，禁止盲修 |
| 6 | 仅更换流程外壳（增加审查/人工确认环节） | ❌ 已证伪 | 第三轮 run cmtg6jkbc004am9hauxsfe20k 含上述环节仍 failed |

---

## 三、硬性规则（v3 红线，违反即打回）

### 规则 1：branchKey 复用 + 单分支串行，严禁并行分支

- `pubg-web-core` 功能线的**所有开发节点必须复用 branchKey=pubg-web-core**，按需求 id 复核绑定后串行执行（检索绑定时注意历史需求存在 `pubb-web-core` 拼写笔误，一律以需求 id 为准）。
- **同一时间窗内本功能线只允许一个进行中的开发节点；严禁并行新开分支改同一批文件。**「pubg-web-core 必须串行开发、禁止并行分支」是本功能线的强制约定，不是建议。
- 后一节点必须基于前一节点**已合入**的成果（N-1 的 merge commit 是 N 的基线）；前一步未合入，后一步不得开工。
- 理由：并行分支 ① 同一批文件互相覆盖、合并冲突；② 没有已合入基线可叠加（第二轮第 3 小步失败的直接诱因之一）；③ 诱发空仓库起步，重复搭地基浪费单次运行预算。

### 规则 2：小步提交，每步只做一件事

- 每步目标在 **性能（performance）/ 画面（visual）/ 玩法（gameplay）** 三类中**三选一**，禁止混合；单步改动规模以「一次运行内能完成 实现 + 轻门禁」为上限。
- **开工前必须先考古**：`git fetch origin pull/<PR号>/head:pr-<PR号>` 核实既有实现（当前可复用：PR #8 架构、最小可玩闭环、PR #9 补齐成果），能复用就复用，**禁止空仓库起步**。
- 术语与数值只认权威技术基准（知识 id=6439fc3e-…），新数值落 `content/` 配置表并配测试断言，禁止硬编码。

### 规则 3：门禁分级（修订 v1 规则 3）

- **小步（实现步）→ 轻门禁**：lint + 本次改动相关单测 + 冒烟；不跑全量 Node 自动化断言。
- **收口步 → 完整 E2E 门禁（重门禁）**：lint + 全量单测 + Node 全流程自动化断言 + 构建 + 冒烟 + PR。
- **门禁预算前置**：开工前估算「实现 + 门禁」总耗时；预估超出单次运行预算就先拆步，不指望运行中途省时间。

### 规则 4：失败必须固化

- 任何 run_workflow 失败后，要么固化为需求基线（如收敛总需求 cmtg6bxv6003ym9hav1sxej1e），要么沉淀/更新为知识规范（即本文档）；不允许目标悬空后无人认领。

### 规则 5：连续失败切换执行通道（兜底阈值，v3 新增）

- **同一小步的 run_workflow 连续失败 ≥2 次 → 停止重试工作流**，改由 @开发Agent 直接接管该小步（考古既有实现 + 实现 + 轻门禁 + 提交/PR）；工作流通道留给收口与验证。
- 依据：第二轮 3 连败、第三轮 2 败期间，Agent 通道已实际交付 PR #9——兜底通道不是理论，是被验证过的交付路径。

---

## 四、推荐节点拆分（v3：拆分与门禁级别沿用 v2）

| 顺序 | 节点 | 目标类型 | 门禁级别 |
|---|---|---|---|
| P0 | 仿真核心骨架与确定性底座（50Hz fixed timestep + seeded RNG + ECS-lite + MatchHandle + 依赖方向 lint） | 玩法 | 轻门禁 |
| P1 | 3D 地图与移动碰撞（1.6km² 高度场、城区/野区、AABB 建筑） | 玩法 | 轻门禁 |
| P2 | 跳伞落地四阶段（航线 + 自由落体→开伞→滑翔→落地，落点可复现） | 玩法 | 轻门禁 |
| P3 | 物资拾取与背包（区域密度、容量/丢弃、护甲减伤/医疗回血） | 玩法 | 轻门禁 |
| P4 | 武器射击命中（ar_m4 / smg_ump、弹道射线 + 包围盒、部位/距离衰减） | 玩法 | 轻门禁 |
| P5 | 缩圈毒圈（≥3 阶段收缩、圈外按秒递增掉血、HUD 倒计时） | 玩法 | 轻门禁 |
| P6 | AI 敌人与胜负结算（≥10 AI FSM、共用 PlayerIntent、唯一存活者结算） | 玩法 | 轻门禁 |
| P7 | 性能优化（稳定60FPS、1% 最低帧、内存不泄漏） | **性能** | 轻门禁 |
| P8 | 画面表现提升（材质/光照/雾效/粒子/HUD） | **画面** | 轻门禁 |
| 收口 | 最终 E2E + PR（AC1–AC4 全量断言） | 混合验收 | **完整 E2E 门禁** |

排序原则：先玩法闭环（P0→P6 串行补齐），再性能（P7），再画面（P8），最后收口跑重门禁。任何节点失败只影响该节点，已合入成果不回退；P0–P8 期间禁止顺手做别的类型的事。

---

## 五、关联产物索引

| 类型 | id / 标识 | 说明 |
|---|---|---|
| 需求（第一轮基线） | cmtfyd7uc000im9hapib6ann3 | 「和平精英Web版」核心玩法需求（跳伞/拾取/射击/缩圈/AI 对抗） |
| 架构方案 | PR #8，产物 cmos298dg0001m9mxandnum2z | 技术选型与目录/依赖方向约定（repo hl3w22bupt/myrd-playground） |
| 知识（技术基准） | 6439fc3e-9217-4004-b091-aa79a6f9bcab | Web大逃杀技术方案与性能红线（数值唯一依据） |
| 需求（最小可玩闭环） | cmtg05te2001zm9hamye40r6u | branchKey 登记 `pubb-web-core`（笔误，绑定一律以需求 id 复核）；对应 run 成功 |
| 需求（收敛总需求，当前唯一来源） | cmtg6bxv6003ym9hav1sxej1e | 稳定60FPS + 画面够看 + 玩法完整闭环，branchKey=pubg-web-core |
| 失败 run（第一轮·全量口径） | cmtfz3zu70016m9ha4wldebwo / cmtfz6s9k001dm9hatl10qx9b | 单次任务过重 + 目标混合 |
| 失败 run（第二轮·小步口径） | cmtg2wvet002tm9hagm2awqhj / cmtg3pefz0034m9hahhlpy86p / cmtg5bzsp003jm9ha5876khnw | 空仓库起步 + 完整E2E门禁过重 |
| 失败 run（第三轮·换流程外壳） | cmtg8kgc3004zm9hawlb9kvxo / cmtg6jkbc004am9hauxsfe20k | 双目标混合 / 外壳变了预算没变 |
| Agent 兜底成果 | PR #9，产物 cmst009lq0009m9jmg3e4zh9l | 开发与测试Agent 补齐缺失玩法与性能缺口并提 PR（兜底通道实证） |
| 审查产物 | cmst009ls000am9jmyk8ylfil | 前两步变更联合审查缺陷清单（修复步输入，禁止盲修） |
| 知识（流程规范·本文档） | b44145e4-6dda-4f92-8741-e0c8bf3dc6b6 | v3：串行开发禁并行分支 + 三轮失败复盘 + 已验证补救路径 |

---

## 六、适用边界

- 本规范**强制适用于** `pubg-web-core` 功能线及其全部后续开发节点；新增玩法/优化项按第四节模式继续追加串行小步。
- 其他项目/功能线可参照**方法论**：branchKey 复用串行、单步单目标（性能/画面/玩法三选一）、门禁分级（小步轻、收口重）、开工先考古禁空仓库起步、审查前置、连续失败即切 Agent 兜底、失败即固化；节点拆分与 AC 划分按各自需求基线重划，不照抄 P0–P8 清单。
- 本规范与《Web大逃杀技术方案与性能红线》（6439fc3e-…）互补：那份管「怎么做对」，这份管「怎么不掉链子」。


## Agent 与 Agent 驱动游戏研发调研报告：Mobius 仓库 × 三篇文章设计对比与可借鉴点

> 沉淀自目标 DAG「mobius 调研 → 沉淀知识 → 方案设计 → 需求 → 开发」（goal `cmtmvs3u0000ejqjst3gc2cmf`）。本文对应调研节点产物 `cmsk2tgmn0000m9rrqdhia5nl`（产品及商业化军师产出），由目标管理大师于 2026-09-04 固化入库，供后续「方案设计 / 需求 / 开发」节点直接检索引用。

# Agent 与 Agent 驱动游戏研发调研报告：Mobius 仓库 × 三篇文章设计对比与可借鉴点

## 0. TL;DR（30 秒版）

- **Mobius 根本不是游戏项目**——它是通用「自进化 Agent OS」。它解决了「怎么组织多个 agent」，但对「游戏研发」这个领域零结构：整个仓库没有任何引擎、关卡、美术管线、玩法验证的痕迹。
- 三篇文章恰好补上领域那一半：网易证明「**知识先于生成**」；腾讯云给出「**结构化策划案 → 可玩原型 → 资产 → 引擎**」的领域管线；触乐证明「**开发不再是瓶颈，判断/验收才是**」。
- 第一结论：**通用组织能力（Mobius 已验证可行）+ 领域结构（三篇文章证明是价值所在）= 我们该做的东西。只抄任何一半都会死。**
- v1 最小闭环：结构化策划案 schema → 带 QA 互查的 Web 原型生成 → 可玩链接 + 人工验收 checklist；组织上用 1 首席 + 策划/程序/QA/美术四职能 + 共享黑板；知识层从三级 Skill/Memory 起步。引擎移植、自进化、数据回流全部留给后续版本。

## 1. 调研来源与范围

| 来源 | 类型 | 读完的部分 |
|---|---|---|
| mobius-system/mobius | 开源仓库 | README、文档总览、研究团队教程、技能/记忆机制教程 |
| 文章A：网易《游戏研发中的 AI 转型：多 Agent 系统与知识工程实践》（林香鑫，AICon 演讲） | 大厂中台视角 | InfoQ/公众号全文 |
| 文章B：腾讯云林哲《基于 AI Agent 的小游戏开发实践》 | 云厂商产品视角 | GameLook 专稿全文 |
| 文章C：触乐《当 AI 开始重写小游戏生产流程》 | 独立开发者+行业视角 | 36氪转载全文 |

**范围偏差声明（重要，后续节点必读）**：军师执行时未拿到目标描述中的 3 个 mp.weixin 原始链接，按「Agent 游戏研发」主题自选了上述三篇替代文章。目标原始链接之一经秘书预判为 **Claude of Tanks**（agent 驱动游戏研发标杆案例，要点：126 辆战车一份规格数据喂给所有消费端的单一数据源、确定性种子模拟、客户端提交输入/服务器裁定事实的权威仲裁架构、Tank Gallery/Scene Studio 内容检查工具、契约测试门槛）。后续「方案设计」节点若需覆盖原始链接来源，需对 Claude of Tanks 补研；本报告三大主线结论（组织 × 领域 × 验收）不受影响。

## 2. 四个研究对象的设计拆解

### 2.1 Mobius（mobius-system/mobius）

- **定位**：首个开源自进化 Agent OS。把模型、agent、项目、设备、算力连进一个工作网络，会随使用改写自身代码/UI/插件，每次改动可追溯（部署时建议 fork，自进化后可提交回自己仓库）。
- **组织模型（两层）**：
  1. `@` 跨会话连接——事后补建，点对点，可选「只读引用」或「双向交流」；
  2. 智能体群——事前预设，多 agent 共享「群黑板」自主分工。研究团队形态：1 首席（不可删，负责拆解+整合）+ 最多 12 助理，逐成员配模型/职责/Skill 与 Memory 范围。
- **知识层**：Skill/Memory 三级作用域（内置/用户级/项目级），会话创建时勾选、中途可追加——本质是**提示词级注入**，没有代码级知识图谱。
- **管控层**：巡检/鞭策防 agent 偷懒、模型调用限频（token proxy）、危险操作人工审批与无人值守 agent 分开——「拆成多个 agent 各守边界，别把两套要求塞进一个上下文」是它的核心论点。
- **架构**：tmux 会话为底座，编码 agent（Claude Code/Codex/GLM harness）被 OS 编排，Node/TS 后端 + SQLite + Web/Electron/TUI 三端。模型完全解耦。

### 2.2 文章A：网易《游戏研发中的 AI 转型：多 Agent 系统与知识工程实践》

- **核心洞察**：内部大规模调研发现，游戏研发最大时间成本不是写代码，而是**理解代码**（千万行仓库、20% 时间花在问人）。所以先做知识，再做生成。
- **设计**：显性知识（文档/工单/仓库归集 → agentic RAG）+ 隐性知识（AST + 调用流 → 代码知识图谱，工单↔提交记录打通）；「研发空间」把团队隐性规范显性化（SDK 版本、引擎代码、编码风格）；Core Agent 协调一批「项目风格化」子 Agent。
- **金句级论断**：「Agent 架构最后的差异不会太大，真正重要的是你给 Agent 提供了什么上下文。」
- **AI Review 演进**：prompt 工程（1000 个问题只有 10 个有效）→ 静态分析+大模型双引擎 → multi-agent 过滤分级 → 注入知识工程 → 少而精。「白天人写代码，晚上 AI 审查」。
- **数据**：团队工具月产 500 万行代码、覆盖几十个项目；新人熟悉 4 万行代码从 2 周 → 1-2 天。

### 2.3 文章B：腾讯云林哲《基于 AI Agent 的小游戏开发实践》

- **核心洞察**：
  1. 玩法验证有沉没成本，MVP 验证前参与人数要最少；
  2. **WebGame 技术栈对 LLM 最友好**（20 年成熟度、模型知识充分、代码即资产、浏览器即预览）。
- **流水线**：专家中心（岗位化 Skill+知识库）→ 与专家对话迭代出结构化策划案 → 专家团（工程师生成 + QA 审核互查）一句话出可玩原型 → AI 生成**关卡可视化编辑页**（元素编号化，让自然语言修改有明确落点）→ 上下文贯穿：美术无需逐图写提示词，一句话替换全套资产 → 导出（策划案/数值/关卡/美术/源码）给 CodeBuddy → 引擎 MCP（Unity/Cocos/UE 已支持）+ Skill 划定 MCP 操作边界 → 图生视频抽帧解决序列帧动画。全程 2 天出 Cocos 版。

### 2.4 文章C：触乐《当 AI 开始重写小游戏生产流程》

- **事实**：个人开发者 1200 元 + 2 个月业余做出上线微信小游戏（Claude Code 写码、GPT/Gemini/豆包出图）；AI 广告素材成本不到传统 1/10，买量侧比研发侧落地更快；Sekai 上已有 1500 万个迷你应用，游戏正在变成 UGC 社交内容。
- **核心论断**：**开发不再是瓶颈，判断成了新门槛**。「AI 帮不了你的 4 件事」：产品决策（好不好玩）、新手引导设计（AI 不知道玩家为何困惑，90% 测试者看不懂的教训）、美术风格统一、平台合规审核。小游戏规模恰好规避了 AI 的上下文丢失问题（代码量小、平台单一）。

## 3. 设计对比（一张表）

| 维度 | Mobius | 网易 | 腾讯云 WorkBuddy | 行业/个人实践（文章C） |
|---|---|---|---|---|
| 定位 | 通用自进化 Agent OS | 企业内代码智能中台 | 垂直游戏原型流水线 | 单人工具链 + 平台生态 |
| 组织模型 | @点对点 + 群黑板，首席制 | Core Agent 协调风格化子 Agent | 专家团两两互查（工程+QA） | 无（单人+多工具） |
| 知识/上下文 | Skill/Memory 三级，提示词级 | **代码图谱+研发空间（最深）** | 会话上下文贯穿全流程 | 靠小游戏规模天然规避 |
| 领域结构 | **无（游戏零结构）** | 通用代码级 | **有（策划案→关卡→资产→引擎）** | 有（全流程+平台合规） |
| 验证/质量 | 巡检防偷懒（治意愿不治结果） | AI Review 少而精 | QA agent 互查 | **人工验收是硬瓶颈** |
| 商业形态 | 开源+自托管 | 内部效能（数据回流成壁垒） | 云产品（150+ 客户） | 平台抽成+流量分配 |

**空档清晰可见**：Mobius 有组织没领域，网易有知识没游戏管线，腾讯云有管线但绑定腾讯生态且只到小游戏原型。**「游戏领域的知识工程 + 开放的多 agent 组织」目前没人做全。**

## 4. 可借鉴点清单（按优先级，直接指导实现）

### P0 —— 决定产品形态

1. **上下文贯穿的单一事实源**：把策划案做成**机器可读的结构化工件**（世界观/关卡/数值/UI 的 schema），原型、美术、配表全部从它派生——这是腾讯云流程里最值钱的一步，也直接回应文章C「AI 不知道玩家为何困惑」：结构化设计文档就是人的产品决策的载体。
2. **知识先于生成**：v1 就要有项目知识层——目录结构语义化、引擎版本与 API、编码风格、命名表（网易「研发空间」+ Mobius 三级 Skill/Memory 作用域的合体）。没有这层，多 agent 就是并行的平庸。
3. **验收回路是一等公民**：生成 agent 与 QA agent 对抗互查（腾讯云）+ 可运行冒烟测试 + 人工 checklist。Mobius 的巡检只解决「偷不偷懒」，不解决「对不对」；三篇文章在这一点上完全一致：最终验收必须是人，产品要给验收者好用的工具而非更多产出。

### P1 —— 组织与执行

4. 双层协作照抄 Mobius：主策划 agent 与职能 agent 点对点单聊 + 共享黑板放关卡状态/资产清单/阻塞项。
5. **「让 AI 给 AI 造工具」**：AI 生成关卡可视化编辑页、元素编号化，把模糊的自然语言修改变成精确指令——这是文章B里最聪明的单个设计，成本低收益大。
6. Web-first 原型 + 引擎移植分段：v1 只做 Web 原型闭环（LLM 知识最充分、浏览器即预览），引擎移植（MCP+Skill 划边界）放 v2。
7. 管控照抄 Mobius：危险操作人工审批与无人值守 agent 分开、token 限频、按 agent 划边界——别把两套要求塞进一个上下文。

### P2 —— 长期壁垒

8. 数据回流：纠错数据、审查标记、验收结论沉淀回知识库（网易的闭环），配合 Mobius 式「每次改动可追溯」。这是唯一随时间复利的资产。
9. 把文章C列出的「AI 做不到的 4 件事」直接做成产品功能：新手引导工作流、风格参考卡库、合规材料 checklist——**人的新瓶颈就是你的收费点**。

## 5. 反面清单（不要做的）

- **不要先造通用 Agent OS 等游戏场景长出来**——Mobius 本身就是反例，通用平台对游戏零领域结构，网易也证明了价值全在领域上下文里。
- **不要拿「一句话自动出游戏」当核心卖点**——三篇文章一致证明验收/好玩靠人，宣传过头用户第一次用就失望。
- Mobius 的「自进化改自己源码」在多租户商业场景是安全与合规噩梦；**借鉴其审计与可追溯，不要借鉴「改自己」**。
- 别把「生成更多」当差异点：小游戏月提交已超 1 万款、审核排队 3 天起步——同质化和合规才是死穴，能帮「过审与验收」比能「生成」稀缺得多。

## 6. 给下一步实现的一句话指令

**v1 最小闭环 = 结构化策划案 schema → 带 QA 互查的 Web 原型生成 → 可玩链接 + 人工验收 checklist，组织上用 1 首席 + 策划/程序/QA/美术四职能 + 共享黑板，知识层从三级 Skill/Memory 起步。引擎移植、自进化、数据回流全部留给后续版本。**

## 7. 溯源与关联

- **目标**：`cmtmvs3u0000ejqjst3gc2cmf`（调研 → 沉淀知识 → 方案设计 → 录需求 → 开发工作流）
- **调研产物**：artifact `cmsk2tgmn0000m9rrqdhia5nl`（产品及商业化军师，2026-09-04）；完整报告原文存于该目标的 goal session 消息中
- **本文与验收标准的对应**：验收项「调研报告已沉淀为知识库文档，可通过『调研 / agent / mobius』相关标签检索到」由本文满足
- **相关知识文档**：《沉淀Web大逃杀技术方案与性能红线》《和平精英Web版两次开发复盘与串行开发规范》——文章B「WebGame 技术栈对 LLM 最友好」的判断与 MyRD 已有的和平精英 Web 实践相互印证
- **待补研**：目标描述中 3 个 mp.weixin 原始链接（其中之一为 Claude of Tanks，要点见第 1 节范围偏差声明）

## Sources

- [mobius-system/mobius](https://github.com/mobius-system/mobius)
- [网易多 Agent 与知识工程实践（InfoQ）](https://www.infoq.cn/article/psxyteixpjvwal89fmue)
- [腾讯云林哲：怎么用 AI Agent 开发小游戏（GameLook）](http://www.gamelook.com.cn/2026/06/595411/)
- [当 AI 开始重写小游戏生产流程（触乐/36氪）](https://m.36kr.com/p/3919432566779528)


## 沉淀AI女友剧情生存玩法设计基线

# 沉淀AI女友剧情生存玩法设计基线

> **依据**：需求《我被AI女友包围了》剧情生存挑战游戏需求（id=cmtob3m0p000pm9y6yl6yi1uq）＋ 游戏策划产物（id=cmtn5fhk20008jqck1thxilil）＋ 平台既有 Godot 工程约定（`games/godot-coin-rush`：六段式 GameDesignSpec / contract-check / verify.sh）＋ Godot 官方 Web 导出文档。
> **用途**：实现节点（开发/测试/部署）执行对齐的唯一设计基准。
> **冲突裁决规则**：需求硬约束 > 策划案原文（design-spec.md / design-spec.json）> 本文；发现偏差须回填本文（版本 +1）。
> **两条硬约束**：① godot headless 门禁 0 error 方可合并；② 构建产物必须在平台 AppHost 部署可启动、健康检查通过，禁止仅本地可跑的交付形态。

---

## 一、玩法定位与核心循环（AC1 落点）

**定位**：剧情驱动的生存挑战游戏。玩家扮演被多位 AI 女友包围的主角，通过对话抉择与状态管理在剧情推进中求生并走向多分支结局。

**核心循环（全项目唯一的循环定义，文案/实现/测试均以此表述为准）**：

```
剧情节点选择 → 好感度/威胁度/生存状态变化 → 触发后续剧情与结局分支 →（回到节点选择）
```

三条由循环直接推出的架构推论（策划案已确认，实现不得违背）：

1. **数据驱动**：人设卡、剧情节点、数值全部是 content JSON；逻辑只认 schema 与 `spec.numeric` 键名，不认具体角色与具体数值。
2. **可追溯**：每次结算写 trace，任何 AI 行为输出都能回放定位到 `persona_id` + 状态前后值。
3. **可验证**：验收一律落成契约测试断言（spec/persona/story/ending 四类 + smoke），不靠人工体感。

## 二、单一事实源：六段式 GameDesignSpec（平台既有工程约定）

- 落点 `.myrd/spec/design-spec.json`，六段：**meta / world / entities / levels / numeric / acceptance**。
- `entities[].script/scene`、`levels[].story_data`、`acceptance[].check` **声明的路径必须真实建出**，契约测试校验落点存在性。
- 数值只认 `spec.numeric`，键名与未来 `game_state.gd` 字段一一对应——改数值=改表，不改码。
- 策划案已交付内容（9 个内容 JSON + 2 份文档）：schema 契约 1 份 + 5 张人设卡 + 3 幕剧情（= 9 个 JSON），另有六段式 `design-spec.json` 与人读版 `design-spec.md`（含数值表、两条链路逐步演算、美术基线）。**策划阶段未产 Godot 代码，实现节点按 spec 施工。**

## 三、AI女友人设卡基线（AC2 落点）

- **schema 契约**：`games/ai-girlfriend-siege/data/schema/persona.schema.json`，**9 个必填字段**，覆盖并超出需求的 5 字段（姓名 / 性格标签 / 说话风格 / 好感度规则 / 威胁·危机行为模式）。
- **5 张基线人设卡**（`data/personas/persona-{lumi,vex,ada,momo,sera}.json`）：治愈 / 病娇 / 冷静 / 活泼 / 神秘 五型；字段含主题色、口头禅、`favor_rules`、`threat_rules`、`portrait_prompt`。
- **美术单一事实源**：立绘/形象资产只从 `portrait_prompt` 派生，禁止另行脑补设定——防止多 agent 并行产出美术与文案漂移。
- **解耦铁律**：`persona_loader` 只认 schema 不认具体角色 → **改人设卡免改码**。验收手段 = swap 测试（替换某张卡 JSON、零代码改动，门禁仍过且行为变化）。
- **可追溯格式**：`story_engine` 每次结算写 trace：`node_id / option_id / persona_id / favor·threat 前值与后值`，回放可定位到具体人设与状态。

## 四、剧情幕结构与结局分支（AC3 落点）

- **三幕骨架「包围 → 裂痕 → 倒计时」**：`data/story/act{1,2,3}.json`，共 **18 个节点**，节点图闭合无死链。
- 节点 / 选项 / 数值效果**全部显式声明**；effects 用声明式键值（Δfavor/Δthreat/flag/goto），**禁止节点内嵌脚本逻辑**——嵌逻辑即破坏可追溯与换卡免改码。
- **4 个结局**；其中 **2 条已逐步演算、可复现的可玩链路**（满足"至少 2 个不同结局"验收）：
  - **链路 A → 独活结局**：全程威胁累积 Σthreat 控制在幕级上限（<300）内，终局选逃跑；
  - **链路 B → 带走 Lumi 结局**：Lumi favor 终值 96 ≥ 70，且 threat 30 ≤ 60。
- 结局判定阈值基线（策划案演算使用值）：**favor 结局门槛 ≥70；单人 threat 结局门槛 ≤60；幕级 Σthreat 上限 300**。
- 结局判定由 `ending_contract.gd` 断言（对应 acceptance acc-5/acc-6）；冒烟测试用脚本驱动固定选择序列，跑出 ≥2 个不同结局即 AC3 达成。

## 五、生存循环与数值规则

- 状态三轴：**favor（好感度）/ threat（威胁度）/ 生存状态**；具体生存轴与衰减公式以 `spec.numeric` 为准，键名与 `game_state.gd` 一一对应。
- 每次选择的标准结算链：选项 effects 声明 Δ 值 → story_engine 结算 → trace 落账 → 门控判断下一节点/结局。
- 数值调优只改 `spec.numeric` 与人设卡 `favor_rules/threat_rules`，**任何数值调优不允许以改代码的方式实现**。

## 六、godot 门禁与 CI（AC4 落点）

**门禁三件套（全部 headless，0 error 才可合并；CI 拒绝含错误代码的提交）**：

1. **preflight**：环境与引擎版本预检；
2. **`godot --headless --import`**：资源导入完整性（坏资源/坏路径在此暴露）；
3. **smoke**：headless 跑冒烟 + 契约测试（spec / persona / story / ending 四件，先例即 `games/godot-coin-rush` 的 `contract-check.mjs` + `verify.sh` 模式）。

附加门禁规则：spec 中声明的落点（entities script/scene、levels story_data、acceptance check）必须真实存在；persona/story JSON 过 schema 校验，坏配置 = 门禁失败（让 AC2 的"≥5 字段结构化"变成机器可验证，而不是评审口径）。

## 七、Web 导出与 AppHost 部署规范（AC5 落点）

**引擎事实（Godot 官方文档，已核实）**：
- Godot 4.3 起，**单线程 Web 导出是官方默认推荐路线**：无需跨域隔离响应头、兼容性最好；
- 开启线程支持（SharedArrayBuffer）则硬性要求：HTTPS 安全上下文 + `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`。

**项目裁决规则**：
1. **默认锁单线程导出**；仅当 AppHost 可注入自定义响应头且走 HTTPS 时，才允许评估线程模式。
2. `.wasm` 必须 `application/wasm` MIME；index.html / wasm / pck 同源部署。
3. 体积与首屏预算：剧情游戏静态资源大头是**中文字体与立绘**——中文字体必须子集化；具体体积/首屏红线由实现节点导出实测后回填本文（不在无实测数据时空定数值）。
4. **健康检查**：交付包内置静态 `/healthz`（200 + `{status:"ok",version}`）；部署后 AppHost 探活通过 + 浏览器冒烟（canvas 出现、console 无 error）。
5. PWA service worker 可官方模拟 COOP/COEP，但增加缓存失效复杂度，AppHost 场景**默认不启用**。
6. 禁止 desktop-only / 仅本地可跑形态；未过健康检查的构建不得标记完成。

## 八、目录结构与依赖方向（CI 强制）

```
games/ai-girlfriend-siege/
  data/schema/persona.schema.json      # 契约：人设卡字段
  data/personas/persona-{lumi,vex,ada,momo,sera}.json
  data/story/act{1,2,3}.json           # 三幕节点图
  design/design-spec.md                # 人读版：数值表+链路演算+美术基线
.myrd/spec/design-spec.json            # 六段式单一事实源
```

依赖方向：`persona_loader` 只依赖 schema；`story_engine` 只依赖 `spec.numeric` 键名与 act JSON；UI 只读状态与事件流；**任何 .gd 禁止硬编码角色名或数值**（出现即 lint/评审打回）。

## 九、验收标准映射（AC → 基线落点）

| AC | 验收点 | 基线落点 | 自动化手段 |
|---|---|---|---|
| AC1 | 玩法定位+核心循环经评审确认 | §一 循环唯一表述 | spec 契约测试 |
| AC2 | 人设卡 ≥5 字段、改卡免改码 | §三 schema 9 必填字段 + swap 测试 | persona 契约测试 |
| AC3 | ≥1 条链路复现 ≥2 结局 | §四 4 结局 + 2 条已演算链路 | ending 契约 + smoke |
| AC4 | godot 门禁 CI 生效、错误提交被拒 | §六 三件套 0 error | CI 拒绝合并验证 |
| AC5 | AppHost 部署可启动 + 健康检查通过 | §七 单线程导出 + /healthz + 冒烟 | 部署核对（策划案 acc-12 同为人工核对项）|

策划案共 12 条 acceptance，其中 10 条已配可执行检查（spec/persona/story/ending 四契约 + smoke）；实现节点不得降低已配检查的覆盖面。

## 十、执行经验与 DO NOT（本次目标执行沉淀）

**有效的做法**：
- 策划阶段就把验收配成可执行检查（12 条中 10 条可自动断言）——这是实现节点不返工的关键，印证调研结论「验收回路是一等公民」「知识先于生成」。
- 文案、美术、数值全部从单一事实源派生（portrait_prompt / spec.numeric），多 agent 并行也不漂移。
- 自检抓到链路演算中的「带问号模糊值」并修正为精确终值——**数值表述必须可判定，禁止"约/大概/左右"**。

**DO NOT（违反即打回）**：
- 禁止把人设写进 .gd 代码或节点属性（AC2 直接失败）；
- 禁止节点 effects 内嵌脚本/表达式求值逻辑（破坏可追溯与换卡免改码）；
- 禁止绕过 godot headless 门禁合入主干；
- 禁止交付 desktop-only / 仅本地可跑形态；
- 禁止在策划与配置文档中使用不可判定的数值表述。

## 十一、待核实与回填项（实现节点开工前处理）

1. **数值终值比对**：链路终值在策划执行过程播报中出现过一次修订（如链路 A Σthreat 曾出现 225/210/220 等中间口径），**以 design-spec.md 演算表终值为准**；工作区产物未推送远端分支，实现节点重建文件时须逐值核对并回填本文。
2. **AppHost 能力核实**：是否支持自定义响应头与 HTTPS —— 决定线程模式可行性；不支持则永久锁单线程导出。
3. **实测回填**：Web 导出体积（wasm/pck）与首屏加载时间，导出后实测回填 §七。
4. **生存轴定义**：体力/理智类生存状态的具体轴与衰减公式以 `spec.numeric` 为准，本文不预设定。

---

*版本 v1.0 ｜ 2026-09-05 ｜ 目标管理大师固化。依据：需求 id=cmtob3m0p000pm9y6yl6yi1uq、策划案产物 id=cmtn5fhk20008jqck1thxilil、平台 Godot 工程约定（games/godot-coin-rush）、Godot 官方导出文档。*


