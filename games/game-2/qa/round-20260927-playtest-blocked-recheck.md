# qa round 2026-09-27 · 试玩验收节点迭代重跑：playtest 维持 blocked（模板仓库仍未补 playtest.sh）

> 本轮 = 主通道（branchKey=game-2）迭代重跑的 **playtest 节点**。inputs 三段范围逐一核实；
> 均为只读取证 + 一次空的 PATCH 探针（无副作用）。**未自造任何判定器**，
> 未把平台注入的阅读副本当判定来源，未编造任何试玩结论。

## 结论（TL;DR）

| 范围段 | 结论 | 证据 |
|---|---|---|
| ① implement：smoke.gd 有符号方向断言 + 反向相位 | **已在部署分支 HEAD 落地** | `tests/smoke.gd`：move_right 10 帧 `(x-origin.x) ≥ +MIN_MOVE_DISTANCE` 且 `\|Δy\| ≤ MAX_LATERAL_DRIFT`；反向相位 move_left 10 帧 `(x-origin.x) ≤ −MIN_MOVE_DISTANCE`。HEAD=`4fb0e9d` |
| ② deploy：HEAD 重导出 + 重部署 AppHost | **已完成（上轮 v7）** | v7 `deploymentId=cmuilrr0u009ym9gcnlam99c7`，commit=`4f7dc69`，gitRef=`myrd/games-goal-cmuiepudc001zm9gyyzqgztta`，AppHost id=`cmuiepuda001xm9gyecrisk7n`；liveUrl 实测 200 |
| ③ playtest | **blocked（维持）** | 模板仓库未预置 `std-skills/godot-game-dev/scripts/playtest.sh`；上轮上报后 origin/main 仍未补 |

## ① implement 核实（只读）

- `games/game-2/tests/smoke.gd` 当前内容即有符号方向语义契约：
  - `MOVE_FRAMES=10`、`LEFT_MOVE_FRAMES=10`（等长反向相位，`FRAME_LEFT_MOVE_END = FRAME_MOVE_END + LEFT_MOVE_FRAMES`）；
  - move_right 相位断言：`(x - origin.x) >= +MIN_MOVE_DISTANCE`，且纵向 `|Δy| <= MAX_LATERAL_DRIFT`；
  - 反向相位：先释放全部方向动作、独立记录出发点，再按住 move_left，断言 `(x - origin.x) <= -MIN_MOVE_DISTANCE`；
  - 失败文案显式点名「输入映射可能镜像/反向」——镜像/反向操控缺陷可被门禁测出。
- 提交溯源：`4f7dc69`（feat: 合并方向语义冒烟断言与调参面板进部署分支）→ `4fb0e9d`（docs）。
- 远端一致性：`git ls-remote origin` 权威核实 `refs/heads/myrd/games-goal-cmuiepudc001zm9gyyzqgztta = 4fb0e9d` = 本地 HEAD（无欠 push）。

## ② deploy 核实（只读 + 实测）

- 目标 artifacts 的 `hosted_app` 产物：liveUrl=`https://leomac-studio.tail49399e.ts.net/apps/game-2/`，
  v7 `status=running`，deploymentId=`cmuilrr0u009ym9gcnlam99c7`，commit=`4f7dc69`（=实现提交；其后仅 docs 提交）。
- 本轮实测（curl）：
  - `/apps/game-2/` → HTTP 308 → 跟随重定向终态 **HTTP 200**，页面 `<title>星尘收集者</title>`；
  - `/apps/game-2/gw` → **HTTP 200**（双入口）。
- 工作区 `games/game-2/export/web/` 为本轮重导出产物（`index.pck` 等，2026-09-27 00:24），与部署同源。
- 门禁（上轮 v7 部署记录，与 preHook 同源、仓库内判定脚本）：PREFLIGHT: PASS + GODOT_SMOKE: PASS（240 帧）+ GODOT_FUZZ: PASS（seed=20260913）。

## ③ playtest：blocked（硬约束触发）

**blocked 原因**：模板仓库未预置门禁脚本 `std-skills/godot-game-dev/scripts/playtest.sh`；请运维把模板仓库补上技能资产。

核查证据：

1. 项目仓库 `std-skills/godot-game-dev/scripts/` 实有：
   `preflight.py`、`smoke.sh`、`input-fuzz.sh`、`resolve-godot.sh`、`gate-selftest.sh`、`preflight_selftest.py`、`input_fuzz_driver.gd` ——
   required 五件套 **缺 `playtest.sh`（配套 `playtest_driver.gd` 亦缺）**；工作树 clean，非漏提交。
2. **上轮上报后模板仓库仍未补**：`origin/main` 最新 `a15f66b`（Merge PR #21 chore/prune-platform-routines）同一目录
   `git ls-tree` 清单同样无 `playtest.sh`。
3. 平台注入阅读副本 `.myrd-platform/.claude/skills/godot-game-dev/scripts/` **存在** `playtest.sh` + `playtest_driver.gd`
   —— 证明模板仓库预置的技能资产落后于平台注入版本，属运维补齐范围，不是 agent 可自行修复项；
   判定只认仓库内路径，**严禁把阅读副本当判定脚本来源，也不现场改写仓库内脚本**。
4. 门禁配置侧核查通过（不构成解除条件）：仓库根 `.myrd/routines.yaml` 含 `id=godot-smoke` routine；
   `std-skills/godot-game-dev/references/godot-smoke-routine.md` 存在。

非阻塞观察（如实记录，不在本节点改写仓库内配置）：
`.myrd/routines.yaml` 的 `godot-smoke` routine `params.gamePath` 指向 `games/godot-coin-rush`（模板示例残留）；
实际门禁以显式传参 `games/game-2` 执行（上轮 v7 部署记录可证）。

## 对节点交付的影响

- 试玩验收包（试玩指引 + 四问量表 + 调参工作台入口）**未正式交付**：blocked 态不产出「试玩通过/好玩」类结论。
- **四问量表全部标「待用户试玩」**：未收到任何用户回填，第 3 步（revisions 写 spec.numeric → approve 拍板 → op=tuning_applied 回写）未执行、未伪造。
- 供用户先行试玩的调参工作台入口（真实存在、实测可达）：
  `https://leomac-studio.tail49399e.ts.net/apps/game-2/?tuning=1` —— 打开即右上角调参面板，拖滑杆即时改数值；
  点「复制调参 URL」回发即一次完整调参结果。
- 调参数值只认 `games/game-2/autoload/game_config.gd` `TUNING_META` 声明的 17 个键：
  `score_per_crystal`、`damage_per_hit`、`initial_shield`、`invincibility_seconds`、`max_crystals`、`max_asteroids`、
  `asteroid_speed_min`、`asteroid_speed_max`、`player_speed`、`respawn_delay_seconds`、`difficulty_step`、
  `difficulty_asteroids_per_level`、`difficulty_asteroids_cap`、`difficulty_speed_per_level`、`difficulty_speed_cap_scale`、
  `score_target`、`milestone_step`；URL 里未声明的键将被忽略并在 diff 说明中标注。

### 四问量表（模板，收到用户回填后才落账；此前一律「待用户试玩」）

| # | 问题 | 回填格式 |
|---|---|---|
| ① | 首分钟能否看懂目标与操作 | 是/否 + 卡点描述 |
| ② | 结束时想不想再来一局 | 1-5 分 + 原因 |
| ③ | 手感与反馈（打击感/音效/画面响应） | 1-5 分 |
| ④ | 节奏有无明显断档或无聊段 | 有/无 + 出现在第几秒 |

## 解除条件

运维把 `playtest.sh`（及配套 `playtest_driver.gd`）补进模板仓库并同步到项目仓库
`std-skills/godot-game-dev/scripts/` 后重跑本节点：
交付验收包 → 人工试玩 → 四问回填 + 调参 URL → `POST /api/v1/game-design-specs/:id/revisions` 写 spec.numeric（带 sourceTrajectoryId 溯源）
→ `POST /api/v1/game-design-specs/:id/approve` 拍板 → artifacts 追加 `op=tuning_applied` → 下一轮按新 spec 重部署。
