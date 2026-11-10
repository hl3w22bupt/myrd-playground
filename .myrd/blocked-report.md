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

# Blocked 上报 — threejs scaffold 节点（run cmwar74im003km9m2cwb92xkq）

- **status: blocked**
- **detail: 模板仓库未预置门禁脚本：std-skills/threejs-game-dev/scripts/{preflight.mjs,browser-smoke.mjs,asset-triple-check.mjs,playtest-summary.mjs,visual-ratchet.mjs,lib-png.mjs}（六件全缺，目录 std-skills/threejs-game-dev/ 整体不存在）；且模板 std-skills/threejs-game-dev/templates/minimal-3d/ 不存在、references/{threejs-preflight-routine.md,threejs-browser-smoke-routine.md} 不存在 —— 请运维把模板仓库补上 threejs-game-dev 技能资产**
- 时间：2026-11-10
- 目标：cmwaqvrng002lm9m2nftdd20h（《实况足球》，休闲收集 / 3D 实况足球）；AppHost：cmwaqvrnc002jm9m2nqwfsoie（myrdplaygrou-3）
- 所在分支：myrd/game-3-goal-cmwaqvrng002lm9m2nftdd20h（HEAD 9d31d44）

## 触发依据

任务硬约束「来源不可得 → 立即 blocked」列出两类必须**仓库内预置**的资产：

1. 门禁判定脚本 6 件套 `std-skills/threejs-game-dev/scripts/{preflight.mjs, browser-smoke.mjs,
   asset-triple-check.mjs, playtest-summary.mjs, visual-ratchet.mjs, lib-png.mjs}` —— 「缺任何一个 →
   status=blocked」「严禁自己编写这些脚本或用等价命令替代」「不得把注入目录当判定脚本来源」。
2. 模板 `std-skills/threejs-game-dev/templates/minimal-3d/`（「模板不存在 → blocked」）与
   references/{threejs-preflight-routine.md, threejs-browser-smoke-routine.md}（routines.yaml 现缺
   threejs-preflight / threejs-browser-smoke 两条，唯一合法补法是照抄这两份 references，两者都不存在
   → blocked）。

## 缺项清单（一次性取证，证据行 E1..E9）

- E1 `ls std-skills/` → 仅 experience-harness / experience-review / godot-game-dev / web-app-dev
  四个目录，**无 threejs-game-dev**。
- E2 `git ls-tree --name-only origin/main std-skills/` → 同样四个目录：远端 main 亦无。
- E3 `git log --all --oneline -- "*threejs*"` → 空：全部历史（含所有已知分支）从未存在过
  路径含 threejs 的文件，排除「路径变动/曾存在后被删」。
- E4 `find . -name preflight.mjs -o -name browser-smoke.mjs -o -name asset-triple-check.mjs
  -o -name playtest-summary.mjs -o -name visual-ratchet.mjs -o -name lib-png.mjs`（排除 node_modules）
  → 六件**仅命中** `.myrd-platform/.claude/skills/threejs-game-dev/scripts/`（平台注入的阅读副本，
  在 .gitignore 的 `.myrd-platform/` 规则下、不随仓库分发；任务明令不得作为判定来源）。
- E5 `ls templates/` → 仅 `apphost/myrd-app`，无 `threejs-game-dev/templates/minimal-3d/`。
- E6 `.myrd/routines.yaml`（102 行全文核验）→ 5 条 routine：git-hygiene / godot-smoke /
  game-contract / mobile-web-smoke / experience-pack；`grep threejs` 无命中 ——
  **缺 id=threejs-preflight 与 id=threejs-browser-smoke 两条**。
- E7 照抄补 routine 所需的 `std-skills/threejs-game-dev/references/{threejs-preflight-routine.md,
  threejs-browser-smoke-routine.md}` 两文件均不存在（E1 所证目录整体缺失）。
- E8 `grep threejs .gitignore` 无命中 —— 排除「资产在库但被 ignore 藏住」的解释。
- E9 `git ls-remote --heads origin`（139 分支）中 three/game-3/cmwaqv 相关仅
  myrd/game-3-goal-cmuieq51k002cm9gysxbyppv7 与 myrd/game-3d-goal-cmuzmgo3y000gm9fyz4cd9en0，
  其树内 grep threejs/myrdplaygrou-3 均无文件；无任何分支携带该技能资产。

## 能力清单（重入工单要素 1）

`cap: write=✓ exec=✓ read=✓ net=✓`（写/执行/只读/外部通道全通；node/git 可用）。
阻塞与能力无关，纯为**模板仓库资产缺失**（外部未就绪，非自身缺陷）。

## 解锁条件（重入工单要素 2）

运维把 threejs-game-dev 技能资产补入模板仓库 `std-skills/threejs-game-dev/` 并重新预置：
①scripts/ 六件套；②templates/minimal-3d/；③references/{threejs-preflight-routine.md,
threejs-browser-smoke-routine.md}。注入目录 `.myrd-platform/.claude/skills/threejs-game-dev/`
内有全套阅读副本（六脚本 + minimal-3d 模板 + 7 份 references 均在）可作同步参考。

## 可执行预案（解锁后重入即可原样执行，要素 3）

1. 复检门禁资产：`ls std-skills/threejs-game-dev/scripts/`（六件齐）→ 复制模板
   `cp -r std-skills/threejs-game-dev/templates/minimal-3d games/myrdplaygrou-3 && rm -rf
   games/myrdplaygrou-3/node_modules`，应用名改《实况足球》。
2. 落风格卡 `games/myrdplaygrou-3/.myrd/style-card.md`（palette=#3498db/#2ecc71/#f39c12 扁平明快 /
   ui / 形状语言 / 禁忌反例三段）+ 资产清单（全 programmatic+reason 合法路线或 3-5 项 generated）→
   `node std-skills/threejs-game-dev/scripts/asset-triple-check.mjs --game games/myrdplaygrou-3
   --spec .myrd/spec/design-spec.json` 退出码 0。
3. 接线 kernel/render 骨架（kernel 零 three/零 DOM/零系统随机/零系统时钟；数值唯一来源
   src/numeric.js；竖屏触屏优先 + 键盘兼容 + 重开入口）→ `node tools/build.mjs` 产出单文件
   dist/web/index.html；模板 tests/run-all.mjs 全绿。
4. `node std-skills/threejs-game-dev/scripts/preflight.mjs games/myrdplaygrou-3` 退出码 0 →
   `node std-skills/threejs-game-dev/scripts/browser-smoke.mjs games/myrdplaygrou-3` 含
   BROWSER-SMOKE: PASS；routines.yaml 照抄 references 补 two 条 routine（params.gamePath =
   games/myrdplaygrou-3）。
5. `git add -A && git commit && git push` 到本分支 → AppHost 以 gitRef=本分支部署 →
   liveUrl 试玩验收 → 打磨收口。

## 处置

- 按硬约束立即停止：未编写/未复制/未链接/未以任何等价命令替代六件判定脚本；未自造
  minimal-3d 模板；未改动 routines.yaml（无可照抄来源，改了就是自造门禁）；未搭建
  games/myrdplaygrou-3（模板缺失，自起炉灶即违反「以模板为起点」约束）。
- 本节点零工程产物落盘（working tree 仅本报告一行追加）；预案≠已完成，待资产补齐后重跑闭环。
