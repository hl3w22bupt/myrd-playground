# 《hello》线上部署冒烟复核报告

- 复核节点：goal cmuqk3j2o001mm9bfptrztaj1 ·「导出并部署」复核线上版并回写产物标识
- 复核方式：公网入口 curl 冒烟 + 资产二进制完整性校验 + 部署记录（平台 API）+ 源码/导出物比对
- 复核时间：2026-10-02（部署 v2 running 期间）

## 产物标识（回写 artifacts 的权威数值）

| 项 | 值 |
| --- | --- |
| HostedApp id | `cmuqk3huq001km9bf5ejp7tdg`（slug=hello，status=ready） |
| 当前部署 id | `cmuqlxz2v001km9bxc0w5pspp`（version=2，status=running；v1 `cmuqlx7w8001im9bx4vk0xae5` 因 504 重发被 superseded） |
| gitRef / commit | `myrd/games-goal-cmuqk3j2o001mm9bfptrztaj1` @ `dfd20d1`（远端分支 HEAD 与部署 commitHash 一致） |
| liveUrl | `https://leomac-studio.tail49399e.ts.net/apps/hello`（平台记录 `/apps/hello/`，入口 308 归一化到无尾斜杠） |

## 线上端点冒烟

| 端点 | 结果 |
| --- | --- |
| `GET /apps/hello/health` | HTTP 200，`{"ok":true,"app":"hello","env":"development","assets":"lazy/object-storage"}` |
| `GET /apps/hello/` | HTTP 308 → `/apps/hello` → HTTP 200，12,300 B 单文件壳页 |
| 页面标题 | `<title>《hello》 · 休闲收集</title>`；启动屏 `<h1>《hello》</h1>`（与需求「标题/启动界面一致展示」相符） |
| `api/public/assets/index.js` | HTTP 200 `text/javascript`，331,495 B |
| `api/public/assets/index.wasm.gz.b64` | HTTP 200 `text/plain`，10,696,408 B（b64）→ gzip 解出 35,376,909 B |
| `api/public/assets/index.pck.gz.b64` | HTTP 200 `text/plain`，3,312,808 B（b64）→ gzip 解出 2,497,520 B |

## 资产二进制完整性与部署一致性（本节点新增的强证据）

- wasm 魔数 `00 61 73 6d 01 00 00 00`（`\0asm` v1）合法，35,376,909 B；
  **sha256 `fe5cebc5…` 与部署 commit `dfd20d1` 内 `games/hello/export/web/index.wasm` 逐字节一致**。
- pck 魔数 `47 44 50 43`（`GDPC`）合法，2,497,520 B；
  **sha256 `84417f2a…` 与部署 commit `dfd20d1` 内 `index.pck` 逐字节一致**。
- 结论：线上伺服的正是被复核版本的导出物，无旧包/错包。

## 对照验收标准逐条判定

1. **标题与启动界面显示《hello》，无阻断性报错** — PASS（静态证据）：title 与启动屏 h1 均为《hello》；资产链路全 200、wasm 结构校验通过。浏览器控制台实测未在本节点执行，运行时行为由无头门禁覆盖（GODOT_SMOKE: PASS，240 帧 9 项断言）。
2. **收集计数/进度实时累加** — PASS：`autoload/game_state.gd` 的 `add_score → score_changed` 信号驱动 HUD「第 N 关 · 收集 x/y · 剩余秒数」实时刷新（`scripts/main.gd` 订阅 `collected`）；胜利/失败/重开闭环齐备（`game_won`/`game_over`/空格推进）。
3. **零插件、主流浏览器直开** — PASS：标准 HTML5 + WebAssembly；壳页要求 DecompressionStream（Chrome 80+ / Safari 16.4+），符合「最新版浏览器」口径；移动端含虚拟摇杆/触屏确认键与音频手势解锁。
4. **静态产物已部署、入口稳定可访问** — PASS：/health 与首页 200，三类资产端点全 200，无 404；部署记录 status=running、gitRef 指向本目标分支。
5. **1 分钟内理解玩法** — PASS：启动屏键位+目标说明、页内 hint 条、README「30 秒上手」三重引导；玩法一句话（限时收满目标数金色方块）。

## 残余差距（不阻断部署验收）

- 真机（iOS Safari）实测：外部依赖，按 goal 验收第 6 条保留「真机待验」差距。
- 试玩回填：playtest.sh 未被模板仓库预置（playtest_kit 条目已按 blocked 记录），待运维补技能资产。
- 浏览器控制台逐条报错清单：未在真实浏览器采集，如需可后续用无头 CDP 补一轮。

## 回写记录

本报告结论已合并回 goal artifacts 的 `hosted_app`（artifactId=cmuqk3huq001km9bf5ejp7tdg）条目 detail，
保留原有 HostedApp id / deploymentId / liveUrl / 本地门禁结论，追加本节点独立线上复核证据与本报告路径。
