# QA 轮次记录 · v14：反馈中枢随包上线 + 部署护栏合规修复（iterate from deploy，2026-09-27）

## 本轮范围（iterate 从 deploy 起）

从定稿 HEAD 重导出 Web 产物（必须含 feedback.html）→ 过 godot-smoke 门禁（新默认帧预算 3000）→
部署 AppHost（cmuiepuda001xm9gyecrisk7n）→ 线上可达性 + 版本一致性验证 → 回写目标 artifacts。

## 部署事实

| 项 | 值 |
| --- | --- |
| HostedApp id | `cmuiepuda001xm9gyecrisk7n`（slug: game-2，星尘收集者） |
| deployment id | `cmuixd3mx00fmm9l6055nkxyw`（**v14**，status=running 即服务中，构建 833ms） |
| liveUrl | `https://leomac-studio.tail49399e.ts.net/apps/game-2/` |
| gitRef | `myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta`（game-2 产出分支，v9 起既定部署口径） |
| 部署 commit | `fcbd3aa`（= 部署时分支 HEAD；其后仅本 qa 文档提交，游戏工程与 server 源码零变更） |
| 接口 | `POST /api/v1/apphost/apps/:id/deployments`，bundle 模式 + `goalId` 目标联动（R6 自动回写 playable 产物） |

## 首次部署失败与修复（v13 → v14）

- **v13 `cmuix6vcu00ffm9l6mh5ueqrj` status=failed**：部署管线 route-analysis 护栏拒绝 ——
  「业务路由必须位于 /api/* 下（/health 与 / 豁免）。违规路由: /feedback, /feedback.html」。
  根因：feedback-hub 轮（98f256d）把反馈中枢注册为顶层路由，与平台部署契约冲突（该轮仅入库未部署，故当时未暴露）。
- **修复（commit fcbd3aa）**：
  1. `server/src/index.ts`：路由迁 `/api/public/feedback` + `/api/public/feedback.html`
     （public = 登录可选，手机玩家零门槛语义不变；**没有**用模板字符串/动态路径钻扫描器
     「模板字符串路径扫不到」的已知限制 —— 那是绕过门禁，不做）。
  2. `server/src/game-page.ts`：壳页「反馈 ★」角标 href 同步指向 `api/public/feedback`。
  3. `feedback.html`：BASE_PATH 推导剥离 `api/public/` 前缀，页面内二维码/回填链接仍落回游戏根
     （6/6 入口形态单测通过：带/不带 api/public、带/不带 .html、带/不带尾斜杠）。
- **预检**：平台 `scanRoutes` 对改动后源码零违规；`tsc --noEmit` 通过。

## 门禁（仓库内 std-skills/godot-game-dev/scripts/ 判定，未改动）

| 检查 | 结果 |
| --- | --- |
| resolve-godot.sh | ✅ Godot 4.3.stable.official |
| preflight.py | ✅ `PREFLIGHT: PASS`（13 类 / 68 工程文件）——重导出后、路由修复后各跑一次 |
| smoke.sh（**新默认帧预算 3000**，GODOT_SMOKE_FRAMES=3000） | ✅ `godot-smoke: PASS`（退出码 0，断言标记齐全，日志无脚本错误）×2 |
| input-fuzz.sh | ✅ `GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239` |
| playtest.sh | 仓库仍缺该脚本（Bug cmuimz29u0014m9l6t0cp1hpt 跟踪中），与前几轮口径一致不阻塞本节点 |

## 重导出与版本一致性

- `godot --headless --import` → `--export-release "Web"` 均退出码 0；
  `index.pck` 2530512B（尺寸与 v11/v12 持平），**feedback.html（35339B→35566B 修复版）随 assets_dir 发布**；
  pck 重导出仅 145B 级非确定性元数据差异（与 e54e5b7 轮同象）。
- **线上是否=HEAD：是**。线上 `/api/public/assets/index.pck` 下载解码后
  sha256=`b58360eec9553572…`，与本地 HEAD(87996a1/fcbd3aa，游戏工程两 commit 间无差异) 导出产物**逐字节一致**（2530512B）。

## 线上冒烟（v14）

| 检查 | 结果 |
| --- | --- |
| `GET /health` | ✅ 200 `{"ok":true,"app":"star-dust-collector","assets":"lazy/object-storage"}` |
| `GET /`（壳页） | ✅ 200 13269B，含音频手势解锁器、「反馈 ★」角标 href=`api/public/feedback` |
| `GET /api/public/feedback` | ✅ 200 text/html 35566B（修复版：BASE_PATH 剥离 api/public 前缀） |
| `GET /api/public/feedback.html` | ✅ 200 同上（别名入口） |
| `GET /feedback.html`（顶层） | ⛔ 404 —— **部署护栏明确禁止顶层业务路由，属预期**；反馈中枢权威入口 = `<liveUrl>api/public/feedback` |

## 产物回写

- 部署 API `goalId` 联动自动回写 playable 条目：`artifactId=cmuixd3mx00fmm9l6055nkxyw`（deployment id）、
  `url=liveUrl`、`artifactType=playable`、`op=deploy_playable`。
- 另按 v9 起惯例追加 `hosted_app` 汇总条目（artifactId=HostedApp id，detail 含本轮部署 id/liveUrl/门禁/验证证据）。

## 遗留与边界

- **顶层 `/feedback.html` 在 M1 部署契约下不可达**（护栏硬校验，非缺陷）：若产品坚持该形态，
  需平台侧把静态页豁免纳入契约（运维/模板 PR），游戏线不自行绕过。
- playtest.sh 模板资产仍缺（Bug cmuimz29u0014m9l6t0cp1hpt），playtest 维持 blocked。
- 本文件在部署 commit `fcbd3aa` 之后提交（仅文档）；线上 pck 与 HEAD 导出逐字节一致为版本权威证据。
