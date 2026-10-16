# Blocked 报告 — scaffold 节点（run cmuw339we01a3icry68bdkwhs）

- **status: blocked**
- **detail: 模板仓库未预置门禁脚本：std-skills/godot-game-dev/scripts/playtest.sh；请运维把模板仓库补上技能资产**
- 时间：2026-10-06
- 目标：cmuw2o88z018ricryvpr6v8wn（《汽车连连看》）；AppHost：game-9（cmuw2o6z4018picry133zwcio）
- 所在分支：myrd/game-9-goal-cmuw2o88z018ricryvpr6v8wn

## 触发依据

任务硬约束「来源不可得 → 立即 blocked」明确列出判定脚本集合
`std-skills/godot-game-dev/scripts/{preflight.py, smoke.sh, input-fuzz.sh, playtest.sh, resolve-godot.sh, mobile-web-smoke.mjs}`，
并规定「缺任何一个 → status=blocked，detail 写『模板仓库未预置门禁脚本：std-skills/godot-game-dev/scripts/<缺的文件名>；请运维把模板仓库补上技能资产』」。
本节点的本地门禁自检命令同样要求执行 `bash std-skills/godot-game-dev/scripts/playtest.sh games/game-9`。

## 排查证据

1. 仓库内 `std-skills/godot-game-dev/scripts/` 共 9 个已跟踪文件：gate-selftest.sh、input-fuzz.sh、
   input_fuzz_driver.gd、mobile-web-smoke.mjs、mobile_smoke_selftest.mjs、preflight.py、
   preflight_selftest.py、resolve-godot.sh、smoke.sh —— **无 playtest.sh，也无 playtest_driver.gd**。
2. `git log --all -- "*playtest*"` 为空：全部历史（含远端 main）从未存在过该脚本。
3. `git fetch origin` 后无新增分支；远端仅 origin/main。
4. 全仓 grep：std-skills/ 下任何脚本/文档均未出现 "playtest"（仓库工具链自身也不引用它），
   说明模板仓库的技能资产整体缺该脚本，而非路径变动。
5. 平台注入目录 `.myrd-platform/.claude/skills/godot-game-dev/scripts/` 存在 playtest.sh + playtest_driver.gd，
   但该目录在 .gitignore 中、属平台注入的**阅读副本**；任务明令「判定脚本只能由模板仓库预置……
   不得把注入目录当判定脚本来源，也不得现场改写/自行编写」。

## 已校验可用的资产（无需处理）

- 四个必校验脚本均在库内且已跟踪：preflight.py / smoke.sh / resolve-godot.sh / mobile-web-smoke.mjs（input-fuzz.sh 也在）。
- 模板 std-skills/godot-game-dev/templates/minimal-2d 存在；references/{godot-smoke-routine.md, mobile-smoke-routine.md} 存在。
- .myrd/routines.yaml 已含 id=godot-smoke 与 id=mobile-web-smoke，本节点无需改动。

## 处置

- 按约束立即停止，未编写/未复制任何判定脚本，未搭建 games/game-9，未做任何绕过。
- 待运维把 playtest.sh（及配套 playtest_driver.gd）补入模板仓库并重新预置后，本节点可重跑。

---

# Blocked 上报（延续）— implement 节点（run cmuw339we01a3icry68bdkwhs）

- **status: blocked（仅限 playtest.sh 一项；本节点主产出已完成并推送）**
- **detail: 模板仓库未预置门禁脚本：std-skills/godot-game-dev/scripts/playtest.sh；请运维把模板仓库补上技能资产**
- 时间：2026-10-06
- 分支：myrd/game-9-goal-cmuw2o88z018ricryvpr6v8wn（commit acf2f61）

## 与 scaffold 轮的差异

- 本节点门禁（preHook: godot-smoke，按 .myrd/routines.yaml 4 步：resolve-godot / preflight /
  headless-smoke / input-fuzz）**不含 playtest**，且「开工前先确认」三件套
  （preflight.py / smoke.sh / resolve-godot.sh + .myrd/routines.yaml）均在库 —— 故本节点开工。
- playtest.sh 在全部 git 历史（含 origin/main）中从未存在（`git log --all -- "*playtest*"` 为空），
  scaffold 轮的 blocked 上报后仍未补齐。

## 本节点处置

- 未编写/未复制/未以任何等价命令替代 playtest.sh（遵守「被检方不自造判定器」硬约束）。
- 本地自检按仓库内判定器实跑三门禁：PREFLIGHT: PASS（13 类）/
  GODOT_SMOKE: PASS（240 帧）/ GODOT_FUZZ: PASS（seed=20260913, 6 批次）。
- **未伪造 GODOT_PLAYTEST: PASS**；后续 playtest 节点在脚本补齐前会 fail-closed，属预期。
- 游戏已按 §4.5 协议接入 playtest 依赖面：Juice 单例（feedback_fired）已注册、
  score_changed 时序可采样、tests/playtest.json 阈值文件可在脚本到位后按需添加。

---

# Blocked 上报（第三次，延续）— playtest 节点（run cmuw339we01a3icry68bdkwhs）

- **status: blocked（仅限 playtest.sh 一项；试玩验收包主产出已完成并回写）**
- **detail: 模板仓库未预置门禁脚本：std-skills/godot-game-dev/scripts/playtest.sh；请运维把模板仓库补上技能资产**
- 时间：2026-10-06 ｜ 分支：myrd/games-goal-cmuw2o88z018ricryvpr6v8wn

## 与前两轮的差异

- `git fetch origin` 后核验：远端最新提交 c186f89 的
  `std-skills/godot-game-dev/scripts/` 仍无 playtest.sh（全部历史 `git log --all -- "*playtest*"`
  为空）；本轮未编写/未复制/未以等价命令替代该判定器。
- 硬约束第 2 类资产本轮核验**齐备**：`.myrd/routines.yaml` 含 id=godot-smoke 与
  id=mobile-web-smoke；references/{godot-smoke-routine.md, mobile-smoke-routine.md} 在库。

## 本节点已交付（不依赖缺失脚本的 parts）

- preHook 移动门禁证据核实并入库：`games/game-9/qa/mobile/report.json` verdict=PASS
  十项全绿（网络/console/canvas/渲染/动画/触摸管线/触摸响应/音频解锁/视口/FPS37），
  与「移动端能不能玩已机判全绿」结论一致，无矛盾。
- 试玩验收包：`games/game-9/qa/playtest-kit.md`（试玩指引 + 四问量表待回填 +
  调参工作台入口 ?tuning=1 + 实现与 spec v1 差异说明），并 PATCH 合并回写
  goal.artifacts（op=playtest_kit）。量表状态「待用户试玩」——试玩结论只能来自用户，
  未收到结果前不触发 spec revisions 回写（第 3 步跳过，不伪造）。
- 调参区声明核验：GameState.TUNING_META 三键（start_time_easy=90 / start_time_hard=180 /
  match_points=10），?tuning=<JSON> 桥与面板开关（tuning 参数存在即开）在部署壳中在位。

## 待运维动作

- 把 playtest.sh（及配套 playtest_driver.gd，注入目录内有阅读副本可参考）补入模板仓库
  std-skills/godot-game-dev/scripts/ 并重新预置；补齐后本节点重跑即可闭环机判试玩门禁。

---

# Blocked 上报 — scaffold 节点《今日汇率》web 工程线（run cmvafm2y5001km94leiaezgid）

- **status: blocked**
- **detail: 模板仓库未预置门禁脚本：std-skills/web-app-dev/scripts/webapp-smoke.mjs；请运维把模板仓库补上技能资产**
- **detail（第二项）: 模板仓库未预置技能资产 —— std-skills/web-app-dev/references/webapp-smoke-routine.md 同样缺失，.myrd/routines.yaml 无 id=webapp-smoke 条目且无模板可照抄**
- 时间：2026-10-16
- 目标：cmvaf7imr000jm94le9x48zfu（《今日汇率》HostedApp）；AppHost：myrdplaygrou（cmvaf7imm000hm94lw6y43t0q）
- 所在分支：myrd/myrdplaygrou-goal-cmvaf7imr000jm94le9x48zfu

## 触发依据

任务硬约束「来源不可得 → 立即 blocked」列出两类必须**预置在项目仓库内**的门禁资产：
① 判定脚本 `std-skills/web-app-dev/scripts/webapp-smoke.mjs`；② 门禁配置模板
`std-skills/web-app-dev/references/webapp-smoke-routine.md`（.myrd/routines.yaml 无
id=webapp-smoke 时照抄追加用）。本节点开工前校验发现**两类均缺失**，按约束立即停止。

## 排查证据

1. 仓库 `std-skills/` 仅三个技能目录：experience-harness / experience-review / godot-game-dev
   —— **无 web-app-dev 目录**（scripts/、references/ 均不存在）。
2. `git fetch origin --prune` 后 `git log --all -- "*web-app-dev*"` 与
   `git log --all -- "*webapp-smoke*"` 均为空：本地全部分支 + 远端最新 main（6c0df4a）
   **全部历史从未存在过该资产**，非路径变动。
3. `.myrd/routines.yaml` 在库且含 git-hygiene / godot-smoke / game-contract / mobile-web-smoke /
   experience-pack 五个 routine，**无 id=webapp-smoke** → 触发「缺 → 照抄模板追加」路径，
   而模板文件不存在 → 第二类资产同样不可得。
4. 全仓 grep "webapp-smoke"：命中仅在 `.myrd-platform/.claude/skills/web-app-dev/`（平台注入
   **阅读副本**，.gitignore 第 7 行覆盖、未跟踪）与 PRODUCT_CONTEXT.md；仓库工具链
   （routines.yaml、scripts/、README）零引用。注入副本含 webapp-smoke.mjs 与
   webapp-smoke-routine.md，但任务明令「不得把注入目录当判定脚本来源，也不得现场改写/自行编写」。
5. `git check-ignore` 确认 std-skills 路径未被 .gitignore 忽略 —— 缺失是真缺失，非忽略所致。
6. 同目标旧分支 `myrd/web-goal-cmvaf7imr000jm94le9x48zfu`（write_document 节点 auto-commit）
   亦无 webapps/ 与 web-app-dev 资产，无可复用产出。
7. 先例一致：本报告上方 godot 线 playtest.sh 缺失时，scaffold 节点同样「立即停止、不搭工程」
   blocked（后运维补齐解除）。

## 处置

- 按约束立即停止：未编写/未复制/未以等价命令替代任何判定脚本，未改动 .myrd/routines.yaml，
  未搭建 webapps/myrdplaygrou，未做任何绕过（工程尚未开始，无半成品与返工成本）。
- blocked 报告落盘本文件并 commit + push 到目标功能分支，产物可回收。
- 待运维把 web-app-dev 技能资产（至少 scripts/webapp-smoke.mjs +
  references/webapp-smoke-routine.md，注入目录内有阅读副本可参考）补入模板仓库并重新预置后，
  本节点可原样重跑闭环。

---

# Blocked 上报（延续）— implement 节点《今日汇率》web 工程线（run cmvafm2y5001km94leiaezgid）

- **status: blocked**
- **detail: 模板仓库未预置门禁脚本：std-skills/web-app-dev/scripts/webapp-smoke.mjs；请运维把模板仓库补上技能资产**
- **detail（第二项）: 模板仓库未预置技能资产 —— .myrd/routines.yaml 无 id=webapp-smoke 条目，且照抄用模板 std-skills/web-app-dev/references/webapp-smoke-routine.md 在仓库内不存在**
- 时间：2026-10-16
- 目标：cmvaf7imr000jm94le9x48zfu（《今日汇率》HostedApp）；AppHost：myrdplaygrou（cmvaf7imm000hm94lw6y43t0q）
- 所在分支：myrd/myrdplaygrou-goal-cmvaf7imr000jm94le9x48zfu（基于 6c0df4a，含本轮 scaffold 节点的 5191d3f blocked 上报）

## 与 scaffold 轮的差异

- 本节点（建工程 + 实现换算/趋势 + 部署 AppHost）的完成标准就是「过 webapp-smoke 门禁」，
  判定器与配置模板**同为本节点的直接依赖**，不像 godot 线 implement 轮那样可拆出「不依赖缺失
  脚本的主产出」——缺失的两项正是本节点的验收判定器本身，故按「来源不可得 → 立即 blocked」
  停在动工之前，不产生无法机判验收的半成品。
- scaffold 轮上报后运维尚未补齐：本节点开工前重新 `git fetch origin` 核验，远端最新 main
  仍无 std-skills/web-app-dev。

## 本轮排查证据（独立复验，非照抄前轮）

1. `git fetch origin` 后 `git ls-tree origin/main std-skills/` 仍只有 experience-harness /
   experience-review / godot-game-dev 三目录；`git ls-tree origin/main .myrd/` 确认
   routines.yaml 在库但**无 id=webapp-smoke 条目**（现存五 routine 全为游戏向：
   git-hygiene / godot-smoke / game-contract / mobile-web-smoke / experience-pack）。
2. `git log --all --oneline -- "*webapp-smoke*"` 与 `-- "*web-app-dev*"` 均为空：全部本地分支 +
   远端唯一分支 origin/main 的**全部历史从未存在过该资产**。
3. 远端仅 origin/main 一条分支；本地工作区在目标功能分支且 tree clean（除本报告追加），
   无未拉取的他处产出。
4. 平台注入副本 `.myrd-platform/.claude/skills/web-app-dev/` 确实含
   scripts/webapp-smoke.mjs（+ webapp_smoke_selftest.mjs）与 references/webapp-smoke-routine.md，
   但该目录被 .gitignore 覆盖（第 7 行 `.myrd-platform/`）、未跟踪，属阅读副本；
   任务明令不得当判定脚本来源、不得自行编写或以等价命令替代。

## 待运维动作（一次补齐即可解除）

- 把以下两类文件从注入目录（`​.myrd-platform/.claude/skills/web-app-dev/`，有阅读副本可参考）
  补入**模板仓库**对应路径并重新预置到本仓库 `std-skills/web-app-dev/`：
  ① `scripts/webapp-smoke.mjs`（判定脚本，可连同 `webapp_smoke_selftest.mjs`）；
  ② `references/webapp-smoke-routine.md`（routines.yaml 参数化模板，节点将照抄追加
  id=webapp-smoke 条目——该文件在库前节点不得自行撰写 YAML）。
- 补齐后本节点可原样重跑闭环：建工程 → 实现 → 本地自检 → commit/push → 部署 AppHost →
  以仓库内判定器实跑 webapp-smoke 门禁。
