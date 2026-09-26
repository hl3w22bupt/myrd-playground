# QA 轮次记录 · v16：部署分支严格对齐 myrd/games-goal-…（iterate from deploy，2026-09-27）

## 本轮范围（iterate 从 deploy 起）

任务固定参数口径的严格执行轮：从定稿 HEAD 重导出 Web 产物（必须含 feedback.html 回填中枢页）→
过 godot-smoke 门禁（新默认帧预算 3000）→ 部署 AppHost（cmuiepuda001xm9gyecrisk7n）→
线上可达性 + 版本一致性验证 → 回写目标 artifacts。
与 v15 轮的差别：**部署 gitRef 从平台派生名 `myrd/game-2-goal-…` 切换到任务固定参数名
`myrd/games-goal-cmuiepudc001zm9gyyzqgztta`**，消除任务文本与部署事实之间的分支名解释余量。

## 分支对齐（本轮核心动作）

- 远端实存两条目标产出分支：`myrd/games-goal-cmuiepudc001zm9gyyzqgztta`（模板通用形态，
  停在 v8 轮 89e4fa9，仅 1 个 docs 提交）与 `myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta`
  （v9–v15 全部工作，23 个提交，定稿 HEAD de18caa）。
- 本轮从定稿基线新建本地 `myrd/games-goal-cmuiepudc001zm9gyyzqgztta` 并 merge 远端 89e4fa9
  （保留远端历史，仅一个 QA 文档新增，零冲突），merge 结果 2064d71 = 定稿工作全集。
- 部署 gitRef 使用 `myrd/games-goal-cmuiepudc001zm9gyyzqgztta`，两条硬约束同时满足：
  ① gitRef = 任务固定参数分支名（非 main）；② 该分支含本游戏全部产出与导出产物。

## 门禁（仓库内 std-skills/godot-game-dev/scripts/ 判定，未改动）

| 检查 | 结果 |
| --- | --- |
| resolve-godot.sh | ✅ Godot 4.3.stable.official.77dcf97d8（`--headless --version` 通过） |
| preflight.py | ✅ `PREFLIGHT: PASS`（13 类 / 70 工程文件，不含 .godot/ 缓存） |
| smoke.sh（**新默认帧预算 3000**，`GODOT_SMOKE_FRAMES=3000`） | ✅ `godot-smoke: PASS`（退出码 0，断言标记齐全，日志零 SCRIPT ERROR） |
| input-fuzz.sh | ✅ `GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239` |
| playtest.sh | 仓库仍缺该脚本（Bug cmuimz29u0014m9l6t0cp1hpt 跟踪中），未自造判定器，与前几轮口径一致不阻塞本节点 |

## 重导出与版本一致性

- `godot --headless --path games/game-2 --import` → `--export-release "Web" export/web/index.html`
  均退出码 0。
- 重导出产物与仓库既有提交**逐字节一致**（连续第三轮确定性复现）：
  index.pck 2530512B（sha256 b58360ee…）、index.js 331495B（8b649683…）、
  feedback.html 35566B（1db3e585…）。`git status` 零 diff，产物随 HEAD 提交在库。
- feedback.html 回填中枢页随 assets_dir 发布 ✅。
- index.wasm 35376909B 走 assets_dir 对象存储（bundle 不含资产，不受 25MB 上限约束）。

## 部署事实

| 项 | 值 |
| --- | --- |
| HostedApp id | `cmuiepuda001xm9gyecrisk7n`（slug: game-2，星尘收集者） |
| deployment id | （部署后回填） |
| liveUrl | （部署后回填） |
| gitRef | `myrd/games-goal-cmuiepudc001zm9gyyzqgztta`（任务固定参数分支，本轮起既定部署口径） |
| 部署 commit | （部署后回填） |

## 线上验证

（部署后回填）
