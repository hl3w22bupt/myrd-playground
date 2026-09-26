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
| deployment id | `cmuiy9ypu00g2m9l6ljmg83lq`（**v16**，status=running 即服务中，构建 838ms） |
| liveUrl | `https://leomac-studio.tail49399e.ts.net/apps/game-2/` |
| gitRef | `myrd/games-goal-cmuiepudc001zm9gyyzqgztta`（任务固定参数分支，本轮起既定部署口径） |
| 部署 commit | `e75b5c7`（**= 部署时分支 HEAD，commit 粒度零解释余量**） |
| 被替代 | v15 `cmuixvwrc00fzm9l6zzdv0v0h` |

## 线上验证（v16）

| 检查 | 结果 |
| --- | --- |
| `GET /health` | ✅ 200 `{"ok":true,"app":"star-dust-collector","assets":"lazy/object-storage"}` |
| `GET /`（壳页，跟随 308） | ✅ 200 13269B，音频手势解锁器标记 ×10，「反馈 ★」角标 href=`api/public/feedback` |
| `GET /api/public/feedback` | ✅ 200 text/html 35566B，**与 HEAD 导出逐字节一致**（sha256 1db3e585…） |
| `GET /api/public/feedback.html` | ✅ 200 同上（别名入口） |
| `GET /feedback.html`（顶层） | ⛔ 404 —— 部署护栏明确禁止顶层业务路由（v13/v14 已裁决），属预期；反馈中枢权威入口 = `<liveUrl>api/public/feedback` |
| `GET /api/public/assets/index.pck` | ✅ 200 text/plain（base64 文本形态，M1 网关「只透传文本」契约合规，壳端 DecompressionStream 解压） |
| routeAnalysis | /health、/（static）+ /api/public/feedback(.html)、/api/public/assets/:name（public），无登录墙路由 |

## 结论

- 线上版本 = HEAD（e75b5c7），gitRef = 任务固定参数分支 `myrd/games-goal-cmuiepudc001zm9gyyzqgztta`，
  feedback.html 回填中枢页随产物发布且线上逐字节一致，门禁（3000 帧预算）三件套全绿。
- playtest.sh 仍缺（Bug cmuimz29u0014m9l6t0cp1hpt），未自造判定器，不阻塞本节点。
