# 部署说明 — wheat-squad v1.4（spec 链 v6 · 部署 v21）

> 更新时间：2026-10-16（游戏程序 · 复证轮 + 部署轮 r14）· 负责人：游戏程序（部署面）· 部署单 **v21 `cmvafh9i1001em94lwu8osw8u` running/current @ commit `af399d7`**（分支 `game/wheat-squad`，远端 SHA 全等后发起；坑 `cmv36wl94001xm9mxp119q48x` wheat-squad-2 · sourceId=wheat-squad）
> 历史注记：v15（2026-10-14）修「部署字节落后代码」缺陷后，v17→v20（R1 复测收口轮）随 spec v1.4（链 v6）重锚构建指纹至 `4eccaf29`；v21 为复证发布（部署字节与 v20 逐字节全等，gitRef 重绑当前分支，非内容更新）。

## 试玩入口与现状

- 入口：`https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw`（**A3 正式试玩采集窗开启中**，记录卡 `qa/playtest-collection-round1.md`；采集字节 = v21 ≡ v20 逐字节，内嵌 sha `4eccaf29` ≡ 补采报告绑定 sha）
- **W-3 平台 serving 层页面路由串线：已解除**（v13 起平台侧修复生效）——v21 复测 `/gw` title=麦浪小队 HTTP 200，页面路与资产路均为本游戏内容。
- **v21 线上自测（2026-10-16）**：/health 200 · `main.mjs` md5 `67a60360…` live≡仓内 build 逐字节 · **WS-LIVE-SMOKE PASS**（ready→拖动击杀 2→victory 167s→console 零错误）。证据 `gate-logs/r1re-prog-reverify-20261016/06·07`。

## 埋点本地日志开关说明（v1.3 · 9 事件）

**默认态：只缓冲、不外发、不落盘**。遥测缓冲于页面内存（`telemetry` 数组），零网络发送代码、零 localStorage/文件写入——玩家数据不出页面。

| 操作 | 方式 |
|---|---|
| 看实时遥测（调试） | 浏览器控制台：`__G2WS_GAME.telemetryEntries()`（全量 9 事件：run_start / run_end{run_duration_ms,reason} / first_kill / first_core_action_at / feedback_latency_ms / first_tap / first_loop_complete / restart_clicked{count,atMs} / hint_shown{atMs,text}） |
| 看事件名速览 | `__G2WS_GAME.telemetryEvents()` |
| 导出一局日志（复制粘贴级） | 控制台执行 `JSON.stringify(__G2WS_GAME.telemetryEntries(), null, 2)`，输出即本地日志（人工留存，无自动上传） |
| 「开关」语义 | 无需配置：默认关（零外发）；读取口常开（上述 debug 面）。未来接渠道分析 SDK 时必须走 spec revision（telemetryFields 面变更 = 契约面变更），并补外发开关与合规说明——当前版本不预埋 |
| A3 采集旁证口径 | `restart_clicked` 遥测**仅作记录卡附录旁证不进判定**；A3 判定 = 记录卡真人回填（时间窗可验真 + 旁证比对列） |

## 部署前门禁（部署轮 v15 实跑，发布 commit `762742c`）

verify.sh 五步全 PASS（统一契约 approved v1.3 对账 · 自有契约 16/0/1PEND · WS-SMOKE 全链路 victory 167s + 四事件埋点真实产生 + console 零错误 · SCOPE-GUARD 双模式，`VERIFY_EXIT=0`）；确定性重建 → 陈旧产物发现与修复（见上）；线上三点复测全过 + LIVE_SMOKE_EXIT=0。证据 `gate-logs/deploy-v15-20261014/`（01 门禁×2 + 02 部署单 + 03 线上冒烟 + 04 三点复测）。

## wx 包（任务书：时间允许才出）

本轮不出 wx 包（提审线归 g2-blocks-wx 判例管理；wheat-squad 无 wx 提审任务，渠道面顺延批次——spec meta.platform.note 口径不变）。
