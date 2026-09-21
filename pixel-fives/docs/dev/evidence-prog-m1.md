# 程序线证据落文 · M1 冲刺（2026-09-12）—— 待归位

> 归属：MiniGame游戏工作室 · 游戏程序线
> 任务：P1–P4 按 Q5–Q7 改造；占位精灵先行不等美术；契约槽位 `pending-approved`
> 黑板 `.myrd/blackboard/` 不可达，本文件为 levels/assets/blockers 三板的暂存证据；黑板恢复后按 §7 归位。

## 0. 环境复核（程序线本人实测，2026-09-12）

| 项 | 结论 | 证据 |
|---|---|---|
| 工作区分支 | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` 已就位 | `.git/HEAD` |
| 策划线 v1.2 终稿 + 机器可读导出 | 在库（`docs/spec/design-spec-v1.2.md` + `.myrd/spec/design-spec.json`，status=draft-pending-review） | 文件读取核对 |
| 美术线 .grid 资产 + 生产线 | 在库（assets/*.grid、tools/gen-assets.mjs、manifest.json） | 文件读取核对 |
| 黑板 `.myrd/blackboard/` | 不存在 | 目录遍历 |
| Open Design daemon / pencil | 不可达（与 Team Lead/QA/主策划三方声明一致） | MCP 调用失败原文 |
| 本 agent 运行时 Bash 工具 | **缺失**（仅 Read/Write/Edit/Glob/Grep），node/git 无法由本线直接执行 | 运行环境事实，见 §6 交接 |

## 1. P1–P4 交付与 Q5–Q7（=R-08 终裁）改造对照

| 包 | 内容 | Q5–Q7 改造落点 | 状态 |
|---|---|---|---|
| P1 关卡落点 | `src/levels/pitch.js`（el-01..el-10 稳定 id 逐条实现，坐标/门嘴带/站位/HUD/onboarding/庆祝参数与 spec §4.1 一致） | el-10 事件链供 acc-06 逐拍断言 | ✅ 交付 |
| P2 模拟核 | `src/core/world.js`（60Hz 确定性物理、球心越线判定、带球、球网边界）+ `src/core/match.js`（比分/计时/庆祝冻结 1.2s/终局/重开） | 确定性红线：sim 内零 `Math.random`/`Date.now`，浮点仅 `+ - * / sqrt/pow`（弃 `Math.hypot`，跨环境逐字节一致） | ✅ 交付 |
| P3 bot + 入口 | `src/ai/bot.js`（同 seed 确定性派生双方控制器，`deriveBotSeed`）+ `tools/bot-sim.mjs`（headless runner） | **R-08 全量落地**：① 指标拆分 `goal_range_ratio`/`duration_in_range_ratio`；② `errors` 非空 ⇒ exit≠0；③ 报告补 `meta` + `per_game[]`（逐场 seed/比分/时长/shots/touches/errors）；④ seeds=42..141（含端点 100 场），双方同一套 | ✅ 交付 |
| P4 验收测试 | acc-01 `tests/smoke/full-match.test.mjs`、acc-02 `tests/red-line/input-to-shot.test.mjs`、acc-06 `tests/goal-flow.test.mjs`、acc-03/04 支撑 `tests/qa/bot-sim-contract.test.mjs` + 仓内 `scripts/contract-check.mjs`（acc-07） | 断言字段名与 §5.1 逐字一致；同 seed 复跑 stdout 逐字节一致；退出码规则注入验证（errors⇒≠0、比率<1⇒≠0） | ✅ 交付 |
| Web build | `index.html` + `src/app/{main,input,renderer,gridSprites}.js`（占位精灵先行；.grid 可用即自动采用；三模式 1/2/3；A08 进球音效 WAV 优先/合成兜底） | 与 bot-sim 同一套 core 模拟入口 | ✅ 交付 |

## 2. 契约槽位状态（pending-approved）

- spec v1.2 status = `draft-pending-review`（**未 approved**）→ `src/core/constants.js` 的
  `PENDING_APPROVED_SLOTS` 全部保持 pending-approved，**未翻转**（acc-09 待主策划批准后执行）。
- 本轮新增槽位：`ball.low_speed_cutoff_px_s = 2`（spec §5〔v1.1〕已有此键，原 constants 缺登记——数值单源补齐）。
- 别名映射维持策划线注记：`bot.goal_range`/`bot.duration_in_range_s` ⇔ `bot_sim.goal_range`/`bot_sim.duration_in_range_s`。
- `scripts/contract-check.mjs` 双模式：spec approved → 全量强制；未批准 → `pending-approved`（结构契约强制，pending check 落点降级 warning）。

## 3. 与 spec 冲突的修正记录（非设计变更，均以 spec 为准）

1. **进球判定**：`entities/goal.js` 原实现为球**边缘**越线；spec §3.1/el-03「**球心**越过门线」→ 已改为球心判定（含门嘴带开区间）。acc-06 测试锁定该语义。
2. **数值单源**：低速截断 2px/s 原硬编码于 `ball.js` → 提取为 `BALL.LOW_SPEED_CUTOFF` 并登记槽位。
3. **确定性**：`player.js`/`ball.js` 的 `Math.hypot` → `Math.sqrt`（hypot 在 V8 有扩展精度路径，跨版本存在不确定性；sqrt 为 IEEE 精确）。R-08「同 seed 复跑逐字节一致」的硬前提。

## 4. 决策记录（DR）

- **DR-P1 报告无墙钟**：`meta.generated_at` 取构建 git 提交时间（ISO8601；无 git 回退固定 spec 日期 2026-09-12T00:00:00Z），使「meta 必须可追溯」与「同 seed 复跑逐字节一致」两条冻结条款同时成立；墙钟只进 stderr。若 QA 判读需真实墙钟，须走 spec 修订（不静默改）。
- **DR-P2 headless fps 语义**：冒烟指标在 headless 语义下度量模拟核的帧预算余量（逐 tick 墙钟 P95、60-tick 窗口可持续帧率）；真实浏览器渲染帧率由 Web build 的 FPS 覆盖层（F 键）人核。口径已写进测试头注。
- **DR-P3 庆祝期计时冻结**：el-10「冻结对局」实现为模拟与 90s 计时双冻结，庆祝 1.2s 不计入时长 ⇒ `duration_s` 恒 90 ∈ [80,100]。
- **DR-P4 bot 策略属程序内实现**：绕后站位/中路走廊/朝向闸门/种子噪声均为程序内部策略，不触 spec 数值；调参杠杆 = `laneHalf` 与射门条件（若门禁出现越界 seed 按 R-08 no_relax 纪律逐 seed 修复，禁止放宽区间）。
- **DR-P5 占位精灵先行**：渲染层逐资产回退（.grid fetch 失败 → 内建占位），file:// 直开可玩；美术获批与否不阻塞游戏可跑。

## 5. 交付物清单（本轮全部落盘）

```
scripts/contract-check.mjs                       # acc-07 仓内契约检查（双模式）
pixel-fives/
├── index.html                                   # Web build 入口
├── README.md                                    # 快速开始 + 命令全集
├── src/levels/pitch.js                          # P1：el-01..el-10
├── src/core/world.js                            # P2：确定性物理
├── src/core/match.js                            # P2：对局流程/el-10
├── src/ai/bot.js                                # P3：确定性 bot
├── tools/bot-sim.mjs                            # P3：R-08 runner（可执行 + 可导入纯函数）
├── src/app/{gridSprites,input,renderer,main}.js # Web 层
├── tests/smoke/full-match.test.mjs              # acc-01
├── tests/red-line/input-to-shot.test.mjs        # acc-02
├── tests/qa/bot-sim-contract.test.mjs           # acc-03/04
├── tests/goal-flow.test.mjs                     # acc-06
└── docs/dev/evidence-prog-m1.md                 # 本文件
修改（spec 对齐）：src/entities/goal.js（球心判定）、src/entities/ball.js（sqrt+单源截断）、
                  src/entities/player.js（sqrt）、src/core/constants.js（LOW_SPEED_CUTOFF+槽位+队色暗亮阶）
```

## 6. 验证命令（QA / Team Lead 执行；本 agent 运行时无 Bash，命令逐条可复制）

```bash
node scripts/contract-check.mjs                                   # 期望 mode=pending-approved, errors=0, exit 0
node pixel-fives/tests/goal-flow.test.mjs                         # 期望 failures=0, exit 0
node pixel-fives/tests/red-line/input-to-shot.test.mjs            # 期望 failures=0, exit 0
node pixel-fives/tests/smoke/full-match.test.mjs                  # 期望 fps_min>=58, p95<=18, errors=0, exit 0
node pixel-fives/tests/qa/bot-sim-contract.test.mjs               # 期望 100 场全过 + 复跑逐字节一致, exit 0
node pixel-fives/tools/bot-sim.mjs --seeds 42..141 --json         # DoD#4/5：QA 同套种子入口
python3 -m http.server 8000 --directory . && curl -sI http://localhost:8000/pixel-fives/index.html   # Web 冒烟：HTTP 200 + 浏览器开核心循环
```

## 7. 待归位清单（黑板恢复后）

- [ ] 本文件 §1/§2/§3 迁入 `.myrd/blackboard/levels.md`、`assets.md`（资产接线部分）、`blockers.md`（§8）
- [ ] `scripts/contract-check.mjs` 与平台 `game-contract` routine 对齐（spec approved 后切强制模式）
- [ ] 主策划批准 v1.2 → 程序线执行 `PENDING_APPROVED_SLOTS` 翻转并回报（acc-09）

## 8. 阻塞与残余风险（blockers）

| 项 | 等级 | 说明 | 处置 |
|---|---|---|---|
| 本 agent 运行时无 Bash | 阻塞（本线执行层） | 代码已全量落盘并经逐文件桌面自查，但四组测试与 git 提交无法由本线亲手执行 | §6 命令交接 QA/Team Lead 执行；或任何有 Bash 的会话按 README 快速开始跑门禁后 `git add -A && git commit && git push origin myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` |
| bot-sim 门禁未实跑 | 风险（中） | goal_range [1,12] 对全部 100 seed 的满足度需一次实跑确认；出现越界 seed 时按 R-08 逐 seed 修复 bot 策略（杠杆见 DR-P4），禁止放宽区间 | 跑 §6 第 5 条命令，越界按 per_game.seed 定位 |
| spec 未 approved | 流程 | 契约槽位按指示保持 pending-approved；contract-check 自动降级警示模式 | 主策划批准后翻转（acc-09） |
| 黑板/OD daemon 不可达 | 环境升级项 | 与 Team Lead 升级口径一致 | 证据已落 repo（本文件），不阻塞他线 |
