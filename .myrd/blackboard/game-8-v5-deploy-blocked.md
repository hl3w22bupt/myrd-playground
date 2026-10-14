# 《牛牛打游戏》(game-8) v5 修复轮 —— 部署卡点 blocked 记录（2026-10-14）

## 当前阻塞（1 项，需要人/权限）

| # | 阻塞 | 影响 | 责任 | 状态 |
| --- | --- | --- | --- | --- |
| B1 | **AppHost 部署无凭据**：`POST /api/v1/apphost/apps/cmujpmjsy006pm99ip9yws3wl/deployments` 要求「应用所有者（`cmuimu6w…`）或系统管理员」；本执行环境无 `MYRD_TOKEN`、无平台登录凭据、无内部免鉴权通道（本地网关 localhost:3111 实测 401，open/internal 路由 404） | 修复代码与产物**已在分支就绪**（`myrd/game-8-goal-cmujpml1e006rm99i9hc33huu` @ `db8b9ce`，门禁全绿），但线上仍是 v4 不可玩包——部署前无法完成「liveUrl 复验 A/B/C/D + artifacts 回写」 | app owner（`cmuimu6w…`）/ 系统管理员 | ⏳ 待执行 §六 一键部署（games/game-8/docs/v5-release-handoff.md） |

## 已完成（不受 B1 阻塞）

- v5 四缺陷修复全部实锤并落库（根因取证 → 修复 → 本地真实浏览器复验，见 `games/game-8/docs/v5-release-handoff.md` §一）：
  - A 零刷出：Godot 4.3 Web 导出下 `static var` packed array 数据丢失 → static func 化；
  - B 移动失效：摇杆触摸处理从 `_unhandled_input` 上移 `_input`（Godot 4 GUI 阶段先消费 ScreenTouch）+ 热区外扩；
    **勘误：键盘 WASD 线上实测一直有效（118px），v4 验收该条为连按口径测量伪影**；
  - C 结算重叠：结论行 autowrap + 三段重排互不重叠；
  - D 触屏 UI 泄漏：判定加 `pointer:coarse`，桌面视口完全隐藏。
- 门禁四件套全绿：preflight / smoke@320 / fuzz（6批239帧）/ playtest@3600（3局 fb=185/222/213）+ 产物自跑冒烟 PASS（pck 2,612,896B @ `db8b9ce`）。
- 门禁盲区闭合：`games/game-8/tools/playability-probe.mjs`（CDP 真实事件驱动 + 像素检测，P1/P2/P3 三断言，非引擎级注入）——
  本地壳链路 1272 命中 / 118px / 172px 全 PASS；线上 v4 现状 P1=5 / P3=0px FAIL（`qa/pre-deploy-live/`），坐实必须部署 v5 包。

## 解除 B1 后的自动复验链（照 handoff §六 执行）

部署受理 → `mobile-web-smoke`（判定脚本）+ `playability-probe`（工程探针）双验 liveUrl →
线上 pck sha256 对齐 `2a27c8b8…a17f63`（2,612,896B）→ 回写 HostedApp / deployment id / liveUrl 三要素。

## 升级规则

B1 若超过一轮无人响应 → 停止空转，升级给主人拍板「换有权限身份部署 / 暂缓上线」。
修复产物无时效性（分支已推送），不存在丢失风险。
