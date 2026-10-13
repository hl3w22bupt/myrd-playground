# 部署说明 — wheat-squad v1.2（spec 链 v4 · 部署 v12）

> 更新时间：2026-10-13（部署轮 r10）· 负责人：游戏程序（部署面）/ 主策划（整合）· 部署单 v12 `cmv641ays003ym9qq0w2u53bg` ready @ `7608768`（分支 `myrd/spec-v1-qa-deploy-cmv5zila9002jm9qqpsyos4g1`）

## 试玩入口与现状

- 入口：`https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw`
- **⚠️ W-3 平台 serving 层页面路由串线（第八次复现，2026-10-13 v12 复测）**：页面路仍发 game-9 共享壳（title=汽车连连看，boot 断链 404），**与部署内容无关**——资产路已确认本轮新字节在线（`main.mjs` live md5 `bcde4bea…` ≡ HEAD build 逐字节）。**本轮新增两条决定性证据**：① 页面字节跨坑全等（`/apps/wheat-squad-2/gw` md5 ≡ `/apps/game-9/gw` md5 = `abb7c87b…`，serving 层对所有 app 发同一份壳）；② 壳源码 boot 契约 = Godot 专用（`assets/index.js` → `index.wasm.gz.b64` + `index.pck.gz.b64` → `WebAssembly.validate` 硬校验 → `new Engine`，无非 Godot 回退分支），且资产网关单段 `:name` 路由使嵌套模块 `src/*.mjs` 全 404（HTTP 404 实测）——TS 多模块工程无法经该壳 boot，**属平台 serving 层缺陷，游戏仓侧不可修**。解除归运维/平台侧（主人转发），解除判据：页面 title=麦浪小队 ⇒ `tools/smoke-live.mjs` PASS。本地试玩不受影响（`node games/wheat-squad/tools/smoke.mjs` 全链路 PASS 即本地可玩实证）。**试玩入口维持暂缓交付**（避免误测 game-9 壳，r9 判例延续）。

## 埋点本地日志开关说明（v1.2 · 9 事件）

**默认态：只缓冲、不外发、不落盘**。遥测缓冲于页面内存（`telemetry` 数组），零网络发送代码、零 localStorage/文件写入——玩家数据不出页面。

| 操作 | 方式 |
|---|---|
| 看实时遥测（调试） | 浏览器控制台：`__G2WS_GAME.telemetryEntries()`（全量 9 事件：run_start / run_end{run_duration_ms,reason} / first_kill / first_core_action_at / feedback_latency_ms / first_tap / first_loop_complete / restart_clicked{count,atMs} / hint_shown{atMs,text}） |
| 看事件名速览 | `__G2WS_GAME.telemetryEvents()` |
| 导出一局日志（复制粘贴级） | 控制台执行 `JSON.stringify(__G2WS_GAME.telemetryEntries(), null, 2)`，输出即本地日志（人工留存，无自动上传） |
| 「开关」语义 | 无需配置：默认关（零外发）；读取口常开（上述 debug 面）。未来接渠道分析 SDK 时必须走 spec revision（telemetryFields 面变更 = 契约面变更），并补外发开关与合规说明——当前版本不预埋 |

## 部署前门禁（部署轮 r10 实跑，HEAD `7608768`）

verify.sh 五步全 PASS（统一契约 · 自有契约 · WS-SMOKE 打开→首次核心操作→单局结束→重开 + A1/A4 + 四事件埋点真实产生 + console 零错误 · SCOPE-GUARD 双模式，`VERIFY_EXIT=0`）——证据 `gate-logs/deploy-r10-20261013/01-verify-gates.log`；确定性重建零漂移（部署字节 = 提交字节）；部署单 API 级受理、W-3 第八次复测探针与 LIVE_SMOKE_EXIT=1（预期红，fail-closed）见 `02-deploy-api.log` / `03-live-w3-probe-v12.log` / `04-live-smoke-v12.log`。

## wx 包（任务书：时间允许才出）

本轮不出 wx 包（W-3 未解除，页面路不可用使 wx 包验证无线上锚点；渠道面顺延批次——spec meta.platform.note 口径不变）。
