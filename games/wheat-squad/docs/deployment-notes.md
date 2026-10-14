# 部署说明 — wheat-squad v1.3（spec 链 v5 · 部署 v15）

> 更新时间：2026-10-14（deploy 节点 · 部署轮 v15）· 负责人：游戏程序（部署面）· 部署单 v15 `cmv7kaen8001kjofi5p7qyb2l` running/current @ 发布 commit `762742c`（分支 `myrd/r1-spec-v11-qa-cmv7f2hrc004njoty0c4cwuih`，远端 SHA 全等后发起）

## 试玩入口与现状

- 入口：`https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw`（**A3 正式试玩采集窗开启中**，记录卡 `qa/playtest-collection-round1.md`）
- **W-3 平台 serving 层页面路由串线：已解除**（v13 起平台侧修复生效）——v15 三点复测 `/gw` title=麦浪小队 HTTP 200，页面路与资产路均为本游戏内容。
- **v15 部署轮抓到并修复「部署字节落后代码」缺陷（如实披露）**：确定性重建 diff 显示仓内 build/ 为 `8868d0f` 时刻陈旧产物——`spec.json` 缺 v1.3 B 案 assets 补登 4 件（ui-kit-01 / sub-icon / sub-sharecard-5x4 / sub-shots-3），`main.mjs` 的 `__G2WS_SPEC` 内联 spec 落后 v1.3。**v14 线上字节即该陈旧产物**（`bcde4bea…`）。处置 = 重建产物落发布 commit `762742c` → 发布 commit 上复跑五步门禁全绿 → 重部署 v15；v15 线上 `main.mjs` md5 `f3a6a6b4…` ≡ 发布 commit build 逐字节全等，**v1.3 spec 内联 + B 案补登已在线**。其余 9 件产物重建零漂移（构建确定性成立）。

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
