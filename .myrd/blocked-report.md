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
