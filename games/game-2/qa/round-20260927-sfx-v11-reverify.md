# QA 轮次记录：SFX 轮 v11 重入独立复核（2026-09-27）

## 背景

「小游戏工坊 · 星尘收集者 · game-2」iterate（startNodeId=implement）重入执行。上一轮执行已落地
验收标准 6 音效反馈（commit 913d9af）→ Web 重导出（0fc434a）→ AppHost 部署 v11（cmuisxkxr00cam9l654pg9uwm）
→ artifacts 回写。本次重入**不重复部署**（再部署只会产出 v12、白烧预算），改为独立复核终态一致性。

## 复核项与证据

| # | 复核项 | 结论 | 证据 |
|---|--------|------|------|
| 1 | HEAD 含四类音效实现 | ✅ | commit 913d9af：autoload/sfx.gd（161 行，16-bit PCM 22050Hz 程序化合成，collect/hit/game_over/restart 各占 1 个 AudioStreamPlayer）+ main.gd 四处接线 + project.godot 注册 autoload + tests/smoke.gd G 段契约断言 |
| 2 | PREFLIGHT | ✅ PASS | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-2` 退出码 0，`PREFLIGHT: PASS 13 类前置一致性检查全部通过（63 个工程文件）` |
| 3 | GODOT_SMOKE（240 帧） | ✅ PASS | 退出码 0，`godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）`——smoke.sh 仅在场景日志命中 `GODOT_SMOKE: PASS` 标记且零 SCRIPT ERROR 时才走该分支 |
| 4 | GODOT_FUZZ | ✅ PASS | 退出码 0，`GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239` |
| 5 | 线上健康（v11） | ✅ | GET /health → 200 `{"ok":true,"app":"star-dust-collector","assets":"lazy/object-storage"}`；/（跟随 308）→ 200；/gw → 200 |
| 6 | 线上 pck = HEAD 导出 | ✅ 逐字节一致 | 部署记录 commitHash=0fc434a=分支 HEAD；线上 `/api/public/assets/index.pck`（base64→gunzip）2530512B，sha256=`4ca3c417047cd39006e1825e7460e98dc9cb335318669cb4e37e0e014d459b85` == 本地 `games/game-2/export/web/index.pck` |
| 7 | 部署参数正确性 | ✅ | gitRef=`myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta`（本 goal 实际功能分支；任务文本里的 `myrd/games-goal-<goalId>` 属另一目标 cmtoavt8w，远端不存在本 goal 该名分支）、sourceId=`cmuiepudc001zm9gyyzqgztta`、triggeredById 同、mode=bundle、构建 827ms、v10 已 superseded |
| 8 | artifacts 回写 | ✅ 已在 | goal 卡片已有 v11 条目（artifactId=cmuiepuda001xm9gyecrisk7n，deploymentId=cmuisxkxr00cam9l654pg9uwm，liveUrl、冒烟结论齐全） |

## playtest 处置

`std-skills/godot-game-dev/scripts/playtest.sh` 模板仓库仍未预置（Bug cmuimz29u0014m9l6t0cp1hpt 跟进中）。
按「来源不可得 → 不自造判定器」纪律维持 blocked 上报，本地三门禁（preflight/smoke/fuzz）全绿。

## 结论

SFX 轮终态一致：HEAD（179f23f，含 913d9af SFX 实现）＝线上 v11 实际伺服产物（pck sha256 逐字节一致），
三门禁独立复跑全绿，liveUrl 三入口 200。**重入无需再部署**。遗留待办不变：
① playtest.sh 待运维补模板；② C4 听感复测（iOS Safari 真机首手势后收集星尘可听到音效、切后台往返音效仍响）。
