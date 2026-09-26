# v17 部署轮 QA 记录 —— iterate（deploy 起）：定稿 HEAD 重导出 + 门禁（新默认帧预算）+ AppHost 部署

- 日期：2026-09-27
- 触发：工作流 iterate（从 deploy 节点起），run `cmuiwrf5p00f7m9l6z8y5th2v`
- 部署分支（任务固定参数）：`myrd/games-goal-cmuiepudc001zm9gyyzqgztta`
- 部署时分支 HEAD：`695190c`（GitHub 直查 + `git fetch` FETCH_HEAD 双确认远端 tip=HEAD，无未推送提交）
- AppHost 应用：`cmuiepuda001xm9gyecrisk7n`（slug=game-2，star-dust-collector）
- liveUrl：`https://leomac-studio.tail49399e.ts.net/apps/game-2/`（= `/apps/game-2`）

## 一、门禁（仓库内 std-skills/godot-game-dev/scripts/ 判定，未改动）

| 脚本 | 结果 |
| --- | --- |
| resolve-godot.sh | ✅ Godot 4.3.stable.official.77dcf97d8 |
| preflight.py | ✅ `PREFLIGHT: PASS`（13 类 / 71 工程文件，不含 .godot/ 缓存） |
| smoke.sh（新默认帧预算 3000，preHook 显式 `GODOT_SMOKE_FRAMES=3000`） | ✅ `godot-smoke: PASS`（tests/smoke.tscn，退出码 0，断言标记齐全，日志无脚本错误） |
| input-fuzz.sh | ✅ `GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239` |

`.myrd/routines.yaml` id=godot-smoke 例行存在（smokeFrames: 3000）。playtest.sh 仍缺（模板仓库未预置，Bug `cmuimz29u0014m9l6t0cp1hpt` 跟踪中；本轮门禁为 godot-smoke 四脚本，不涉及 playtest 判定器，未自造替代）。

## 二、从定稿 HEAD 重导出 Web 产物

- `godot --headless --path games/game-2 --import` → `--export-release "Web" export/web/index.html`，退出码 0。
- **确定性复现**：重导出后 `git status --porcelain` 为空——index.pck（2530512B）/index.js（331495B）/feedback.html（35566B）/index.html 与 HEAD 已提交产物逐字节一致（sha256 前后对照全同）。
- feedback.html 回填中枢页随包发布（liveUrl 二维码 + 四类音效试听评分 + 一键回填）。

## 三、部署 AppHost 与线上验证

- 部署 API：`POST /api/v1/apphost/apps/cmuiepuda001xm9gyecrisk7n/deployments`
  `{gitRef: "myrd/games-goal-cmuiepudc001zm9gyyzqgztta", mode: "bundle", deployedBy: "workflow", triggeredById: run cmuiwrf5p…, goalId: cmuiepudc001zm9gyyzqgztta}`
- 部署 v17：id=`cmuiyq9he00g5m9l69qv6tr5g`，commitHash=`695190c`（=部署时分支 HEAD，逐位一致），构建 821ms，HTTP 200。
- 线上实测（全部 200）：
  - `/health` → `{"ok":true,"app":"star-dust-collector","assets":"lazy/object-storage"}`
  - `/` → 308（网关规范化到带尾斜杠壳页；跟随重定向后壳页含音频手势解锁器与 feedback 角标）
  - `/api/public/feedback` → 35566B，sha256 `1db3e585…` 与 HEAD 提交逐字节一致（回填中枢页同源可达）；别名 `/api/public/feedback.html` 200 同内容
  - `/api/public/assets/index.pck` → base64 文本形态（M1 网关契约），base64→gunzip 后 2530512B，sha256 `b58360ee…` 与 HEAD 导出逐字节一致
  - `/api/public/assets/index.wasm` → 200
- 部署护栏口径沿用 v13/v14 裁决：权威入口 = `api/public/feedback`，顶层 `/feedback.html` 404 属预期。

## 四、轮末对齐

- 本 QA 记录提交后做**终态复部署**（部署 #2），使线上 commitHash = 轮末 git HEAD（游戏产物为 docs-only 提交前后逐字节不变，已由 §二确定性证明）。
- HostedApp id / deployment id / liveUrl 回写目标 artifacts（`deploy_playable` 由平台 goalId 联动自动 upsert；另有 hosted_app 轮记录产物）。
