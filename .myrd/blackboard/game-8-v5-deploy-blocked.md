# 《牛牛打游戏》(game-8) v5 修复轮 —— 部署卡点 blocked 记录（2026-10-14，第三轮更新）

## 第三轮增量（2026-10-14 深夜，本 run）

- **抓出并修复「C 结算重叠」修复未生效的锚点 bug**：场景 `ResultLabel` 为 `anchor_bottom=1`，
  二轮的 `offset_bottom=134` 实为「label 底边悬到面板外」→ 运行时仍压按钮。补
  `result_label.anchor_bottom = 0.0` 后，调参桥快进失败局浏览器截图实锤三段分层零重叠
  （`qa/local-v5-verify/cd-{mobile-result,desktop-ingame,desktop-result}.png`）。
  该缺陷一二轮均未在浏览器到过结算面板（调参桥快进局是唯一现实取证路径）。
- 门禁四件套在含补刀的 HEAD 复跑全绿（preflight 1042 文件 / smoke@320 / fuzz seed=20260913 /
  playtest 3 局），新 pck `3ca34b43…86f60`（2,613,856 B）自跑冒烟 PASS。
- 本地壳链路可玩性三项新 pck 复验：P1=1365 / P2=117px / P3=173px 全 PASS。
- 分支同步模板仓 PR #810（`311f1d2`）：mobile-web-smoke 判定脚本新增「真实事件驱动位移>阈值」
  与「同屏可收集物>0」观测断言 + 移动门禁坐标校准 —— v5 需求要求的门禁盲区闭合已在本仓就位。
- 部署 403 第三次独立复现（req_1791969367365）+ 平台源码/只读查库互证；**goal 读取/回写 API 同样
  403** → 部署受理后的 artifacts 回写也需 owner/admin 代执行（详见 handoff §五）。

## 当前阻塞（1 项，结构性身份错位，需要换触发方式或换身份）

| # | 阻塞 | 影响 | 责任 | 状态 |
| --- | --- | --- | --- | --- |
| B1 | **AppHost 部署 403（本轮实证为身份错位，非缺凭据）**：部署授权要求「有效身份 == app owner 或 admin」；app owner 与 goal owner 实测同一人 `cmuimu6w50003m9l61jj8nzxg`，但本 run 由目标大师账号**项目级触发**（`Task.metadata.goalId` 空），平台对项目级 run 有意签发无 actFor 的节点 token（2026-09-22 安全收窄）→ 干跑+正式 POST 各一次 403（req_1791968047179 / req_1791968912360） | 修复代码与产物**已在分支就绪**（`myrd/game-8-goal-cmujpml1e006rm99i9hc33huu` @ `500c008`，远端 tip 实测一致；门禁四件套本轮复跑全绿），但线上仍是 v4 不可玩包（pck `7738850a…5d8502` 实锤）——部署前无法完成「liveUrl 复验 A/B/C/D + artifacts 回写」 | 见下「解阻路径」 | 🔺 第二轮，按升级规则停止空转，待拍板 |

## 解阻路径（二选一）

1. **首选**：从目标 `cmujpml1e006rm99i9hc33huu` 的会话**委派发起工作流** —— goal 委派 run 的
   triggeredByUserId = goal owner = app owner，节点 token 天然过授权，且可带 goalId 让平台自动回写产物；
2. app owner（`cmuimu6w…`）或系统管理员执行 `games/game-8/docs/v5-release-handoff.md` §六 一键部署（一条 curl）。

部署受理后复验链（handoff §四/§六）：mobile-web-smoke（判定脚本）+ playability-probe（工程探针）双验 liveUrl →
线上 pck sha256 对齐 `3ca34b43…86f60`（2,613,856B，第三轮 C 补刀后 HEAD 重导出实算）→ 回写三要素。

## 本轮（v5 第二轮）已完成

- 门禁四件套在 HEAD `500c008` **复跑全绿**（本轮新鲜证据）：preflight PASS（15 类×1033 文件）/
  smoke@320 PASS / fuzz PASS（seed=20260913，6批239帧）/ playtest@3600 PASS（3局 fb=185/224/221）。
- 分支推送核实：`git ls-remote` 实测远端 tip = `500c008` 与本地一致（早前显示滞后系本地 tracking ref 过期假象）。
- 线上版本实锤：经 `api/public/assets/index.pck.gz.b64` 下载解码，线上 pck = `7738850a…5d8502`
  （3,210,752B）= v4 不可玩包，**部署尚未发生**。
- 部署授权诊断闭环（读平台路由源码 + 只读查库，未改平台任何数据）：403 根因 = run 触发人身份 ≠ app owner，
  详见 `games/game-8/docs/v5-release-handoff.md` §五。
- handoff 勘误：pck 参考哈希 `2a27c8b8…` → `ec9cd0d6…`（HEAD blob 实算）。

## 上一轮（v5 第一轮）已完成（不受 B1 阻塞，保持记录）

- v5 四缺陷修复全部实锤并落库（根因取证 → 修复 → 本地真实浏览器复验，见 `games/game-8/docs/v5-release-handoff.md` §一）：
  - A 零刷出：Godot 4.3 Web 导出下 `static var` packed array 数据丢失 → static func 化；
  - B 移动失效：摇杆触摸处理从 `_unhandled_input` 上移 `_input`（Godot 4 GUI 阶段先消费 ScreenTouch）+ 热区外扩；
    **勘误：键盘 WASD 线上实测一直有效（118px），v4 验收该条为连按口径测量伪影**；
  - C 结算重叠：结论行 autowrap + 三段重排互不重叠；
  - D 触屏 UI 泄漏：判定加 `pointer:coarse`，桌面视口完全隐藏。
- 门禁盲区闭合：`games/game-8/tools/playability-probe.mjs`（CDP 真实事件驱动 + 像素检测，P1/P2/P3 三断言，非引擎级注入）——
  本地壳链路 1272 命中 / 118px / 172px 全 PASS；线上 v4 现状 P1=5 / P3=0px FAIL（`qa/pre-deploy-live/`），坐实必须部署 v5 包。

## 升级规则

B1 已持续两轮（第一轮无凭据 401/403，第二轮有凭据仍 403 身份错位）→ **按规则停止空转**：
请主人在「从目标委派重跑工作流」与「owner/admin 手动一键部署」之间拍板其一；
两路的复验链与回写清单均已在 handoff 备好，执行后本工作流可直接恢复复验收尾。
修复产物无时效性（分支已推送），不存在丢失风险。
