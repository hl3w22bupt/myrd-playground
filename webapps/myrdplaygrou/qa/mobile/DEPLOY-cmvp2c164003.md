# 部署与门禁留痕 —— 趋势卡缺陷修复上线（需求 cmvp2c164003em91ku0scqas4）

> 分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`，**终态部署基于 `7b7848b`（应用代码 = `3b1ea65`）**。
> 根因取证见 `webapps/myrdplaygrou/.myrd/fix-notes-cmvp2c164003.md`（commit d39d5d0）与
> `.myrd/implement-notes.md`（commit 3b1ea65，状态机重构口径）；本文只记部署与门禁事实。

## 修复演进（同需求两轮实现，最终采纳状态机版）

| commit | 内容 |
|---|---|
| `223ac49` | 第一轮修复：终态三道防线（isValidTrend + renderTrend 收紧 + finally 保险）+ hover/touch tooltip + t.failed 文案修正 |
| `3b1ea65` | 第二轮重构：趋势加载态改**状态机驱动**（success/error/loading + trendError 重试按钮 + trendTip 浮层），index/landing 同步，附自检记录 trend-fix-selftest.json |

两轮均覆盖两缺陷（①加载终态 ②数值提示）+ 文案语义；后者交互语义更细（触摸 pointercancel 才收起，
鼠标移出即收起），为分支最终形态。**v16 为过渡部署（223ac49 版），v17 为终态部署（3b1ea65 版）。**

## 部署事实（2026-10-26）

| 项 | 值 |
|---|---|
| HostedApp id | `cmvaf7imm000hm94lw6y43t0q`（slug `myrdplaygrou`） |
| **deployment id（终态）** | **`cmvp3vvbo004bm91kowxtp46j`**（v17，mode=bundle，commit `7b7848b`） |
| 过渡部署 | `cmvp3fdbn0048m91k6hpnftqe`（v16，commit `d39d5d0`，已被 v17 替代） |
| gitRef | `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`（未用 main） |
| manifestPath | `webapps/myrdplaygrou/apphost.toml` |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/ |
| 触发方式 | 平台 API `POST /api/v1/apphost/apps/:id/deployments`（deployedBy=agent，goalId 联动） |
| artifacts 回写 | 目标 `cmvaf7imr000jm94le9x48zfu` artifacts 已含 v17 条目（op=deploy_tool，artifactId=deploymentId，url=liveUrl，status=completed）；HostedApp id 与 liveUrl 条目此前已在 |

## 上线核验（防「部署了旧版」）

- v17 实例 `GET /health` → 200；`GET /` → 200
- 公网 `GET /api/public/assets/app.js` → 200，sha256 `e9072c2e…` **等于 `3b1ea65` 版 app.js**
- index.html 含 `trendError` / `trendTip` / `trendRetryBtn` 结构（错误终态 + tooltip + 读屏文本）
- 状态机/tooltip 标记在上线 app.js 中 20 处；「趋势数据加载中…」仅存在于 loading 态渲染分支

## 移动端门禁（review 节点 preHook 口径，仓库内判定器实跑）

- 判定器：`node std-skills/web-app-dev/scripts/webapp-smoke.mjs --url <liveUrl> --out webapps/myrdplaygrou/qa/mobile`（未用注入目录阅读副本，未改写脚本）
- **v17 结果：WEBAPP_SMOKE: PASS（exit 0）** —— 网络全通 / console 零 error 零未捕获 / 首屏非纯色 / DOM 有内容 / 触摸事件到达 DOM（tap+swipe）/ 无横向溢出
- 唯一 WARN（非阻断）：「tap 后画面零变化」——脚本自述静态页可为 0；tap 落点为非交互区，属提示性条目
- v16 轮次同判据 PASS（exit 0，无 WARN）；两轮证据均落本目录 `report.json` + `phase-load.png` / `phase-tap.png`

## 复验轮（2026-10-26，重派独立复检）

- 分支/远端：HEAD `c6de7f5` == `FETCH_HEAD`（远端无新提交，本地无领先），工作区干净
- 线上即修复版实证：`GET /api/public/assets/app.js` 与本地 `3b1ea65`（=HEAD）**逐字节 diff 一致**；
  `trendPhase` / `fx-trend-bug-tip` / `showTrendTipAt` / `pointerdown` 标记在 26.8KB 上线文件中齐备
- `/health` → 200（game-9 共享壳，assets_dir 复用符合预期）；`/` → 308 归一 → 200（HTML 正常，zh-CN + viewport）
- 部署列表 API 对本 token 返回 403（非 app owner，仅部署口可用）→ 以「liveUrl 200 + 资产==HEAD」作为部署完成证据，**未重复部署**（避免 v17 被无变化记录覆盖）
- 源码逐条复核三修复落地：① CSS L205 显式 `[hidden]{display:none!important}` 守卫 + `trendPhase` 四态状态机（error 态重试按钮 82×44px≥44×44）；② tooltip 双通道（pointermove=PC hover / pointerdown=移动点按，命中层盖全图、`touch-action:pan-y` 不劫持滚动、读屏走 `trendTipLive` aria-live）；③ `t.failed` 折叠文案已换语义准确的「趋势数据获取失败，请检查网络后重试」
- **本轮新鲜门禁：WEBAPP_SMOKE: PASS（exit 0，六项全绿，无 WARN）**，证据落本目录 `report.json`（checkedAt 2026-10-26T10:27Z）+ `phase-load.png` / `phase-tap.png`

## 环境事件（处置记录）

1. 跑门禁前发现 `liveUrl` 整体不可达（curl reset），根因是**本机 Tailscale 已停止**；
   `open -a Tailscale` 拉起后 liveUrl 恢复（308 归一 → 200）。该域名是门禁与用户验收的唯一入口，
   属部署契约依赖的本机基础设施，非应用代码问题。
2. 部署期间远端分支被同需求并行执行体推进两次（`3b1ea65` 实现、`7b7848b` 平台 auto-commit）；
   本地分支已对齐远端并按最终 HEAD 重新部署 + 复检，未发生覆盖他人提交的情况。
