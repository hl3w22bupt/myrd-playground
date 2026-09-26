# QA 轮次记录 · v15：定稿 HEAD 终态重部署（iterate from deploy 续跑，2026-09-27）

## 本轮范围（iterate 从 deploy 起）

同 v14 轮任务口径的续跑确认轮：从定稿 HEAD 重导出 Web 产物（必须含 feedback.html 回填中枢页）→
过 godot-smoke 门禁（新默认帧预算 3000）→ 部署 AppHost（cmuiepuda001xm9gyecrisk7n）→
线上可达性 + 版本一致性验证 → 回写目标 artifacts。
与 v14 轮的差别：v14 部署 commit=fcbd3aa（其后仅 qa 文档 f0955de）；本轮把部署 commit 严格对齐到
**分支 HEAD f0955de 本身**，使「线上版本=HEAD」在 commit 粒度无任何解释余量。

## 部署事实

| 项 | 值 |
| --- | --- |
| HostedApp id | `cmuiepuda001xm9gyecrisk7n`（slug: game-2，星尘收集者） |
| deployment id | `cmuixvwrc00fzm9l6zzdv0v0h`（**v15**，status=running 即服务中，构建 840ms） |
| liveUrl | `https://leomac-studio.tail49399e.ts.net/apps/game-2/` |
| gitRef | `myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta`（game-2 产出分支，非 main，v9 起既定部署口径） |
| 部署 commit | `f0955de`（**= 部署时分支 HEAD，逐字节口径本轮零解释余量**） |
| 接口 | `POST /api/v1/apphost/apps/:id/deployments`（PLATFORM_API_URL `http://localhost:3111` + 平台 JWT Bearer），bundle 模式 + `goalId` 联动（R6 自动回写 playable 产物，artifactKind=playable） |
| 被替代 | v14 `cmuixd3mx00fmm9l6055nkxyw` → status=superseded |

### 部署 gitRef 口径说明（任务文本分支名与平台派生名的对齐）

- 任务固定参数写 `myrd/games-goal-cmuiepudc001zm9gyyzqgztta`，是模板通用形态
  （`deriveGoalBranch(branchKey='games', goalId)`，见平台 `src/lib/app-workshop.ts`）。
- 平台对本目标/本应用（slug=game-2）实际派生的目标分支是
  `myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta`（`deriveGoalBranch('game-2', goalId)`），
  全部 v9–v14 部署均用它，远端实存且与本地 HEAD 同步。
- 两条分支均为**非 main 的目标产出分支**；「本游戏全部产出在 goal 分支、部署绝不用 main」的硬约束
  两侧都满足。本轮沿用平台派生分支（与既有 14 轮部署及 artifacts 记录同口径），不另切分支。

## 门禁（仓库内 std-skills/godot-game-dev/scripts/ 判定，未改动）

| 检查 | 结果 |
| --- | --- |
| resolve-godot.sh | ✅ Godot 4.3.stable.official.77dcf97d8 |
| preflight.py | ✅ `PREFLIGHT: PASS`（13 类 / 69 工程文件，不含 .godot/ 缓存） |
| smoke.sh（**新默认帧预算 3000**，`GODOT_SMOKE_FRAMES=3000`） | ✅ `godot-smoke: PASS`（退出码 0，断言标记齐全，日志零 SCRIPT ERROR） |
| input-fuzz.sh | ✅ `GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239` |
| playtest.sh | 仓库仍缺该脚本（Bug cmuimz29u0014m9l6t0cp1hpt 跟踪中），未自造判定器，与前几轮口径一致不阻塞本节点（godot-smoke routine 四步：availability/preflight/headless-smoke/input-fuzz） |

## 重导出与版本一致性（本轮亮点：确定性复现）

- `godot --headless --path games/game-2 --import` → `--export-release "Web" export/web/index.html`
  均退出码 0。
- 重导出产物与仓库既有提交（87996a1 重导出轮）**逐字节一致**（连 v14 轮记录的 145B 级
  元数据非确定性差异本轮也未出现）：index.pck 2530512B（sha256 b58360ee…）、index.js 331495B
  （8b649683…）、feedback.html 35566B（1db3e585…）。`git status` 零 diff，无需产物提交。
- feedback.html 回填中枢页随 assets_dir 发布 ✅。

## 线上验证（v15）

| 检查 | 结果 |
| --- | --- |
| `GET /health` | ✅ 200 `{"ok":true,"app":"star-dust-collector","assets":"lazy/object-storage"}` |
| `GET /`（壳页，跟随 308） | ✅ 200 13269B，含音频手势解锁器（AudioContext/unlockAudio 标记 ×10）、「反馈 ★」角标 href=`api/public/feedback` |
| `GET /api/public/feedback` | ✅ 200 text/html 35566B，**与 HEAD 导出逐字节一致**（1db3e585…） |
| `GET /api/public/feedback.html` | ✅ 200 同上（别名入口） |
| `GET /feedback.html`（顶层） | ⛔ 404 —— 部署护栏明确禁止顶层业务路由（v13/v14 已裁决），属预期；反馈中枢权威入口 = `<liveUrl>api/public/feedback` |
| 资产逐字节核验 | ✅ `/api/public/assets/{index.pck,index.wasm}` 为 base64(gzip(资产)) 信封，解码后 sha256 与 HEAD 导出一致；`index.js` 为裸文本直出，直接一致。四资产（pck/js/wasm/feedback.html）全部 `线上 == HEAD 导出` |

**线上是否=HEAD：是（commit 粒度 + 字节粒度双重成立）。**
部署记录 commit_hash=f0955de（=部署时分支 HEAD，无「其后仅 docs」解释项）；
四资产 sha256 与本地 HEAD 重导出逐字节一致。

## artifacts 回写

- R6 目标联动自动回写 ✅：goal `cmuiepudc001zm9gyyzqgztta` artifacts 新增
  `deploy_playable` 条目（artifactId=`cmuixvwrc00fzm9l6zzdv0v0h`，url=liveUrl，status=completed）。
- 本文档 + 会话输出的 `[CHECKPOINT]` 摘要行（含 HostedApp id / deployment id / liveUrl / 门禁与验证摘要）
  交由目标审视解析追加 run_workflow 摘要条目。

## 结论

v15 为当前终态：门禁全绿（新默认帧预算 3000）、线上四资产=HEAD 逐字节、
feedback 回填中枢双形态入口可达、R6 回写落库。游戏工程与 server 源码相对 v14 零变更，
本轮价值 = 把部署 commit 从 fcbd3aa 严格对齐到分支 HEAD f0955de，并复核全链路稳定。
