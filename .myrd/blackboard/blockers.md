# 《3D 切水果》目标阻塞项（主策划线上复核后更新 2026-10-09）

> 目标：cmuzmgo3y000gm9fyz4cd9en0（创建小游戏应用：《3D 切苹果》→ 多水果 3D 切水果 spec v2）
> 分支：`myrd/game-3d-goal-cmuzmgo3y000gm9fyz4cd9en0`（复核取证 HEAD `6217341`）
> 线上：https://leomac-studio.tail49399e.ts.net/apps/3d/ （deployment v6 `cmv0o4qgj001bm9aabn2o441v` running，游戏代码 commit `c2f86da`）
> （历史：《汽车连连看》game-9 轮的黑板已归档至 git 历史，本轮整体替换为本目标口径。）

## 当前阻塞（1 项，需要人）

| # | 阻塞 | 影响 | 责任 | 状态 |
| --- | --- | --- | --- | --- |
| B1 | 人工试玩验收未拍板：owner 按 `games/3d/qa/playtest-kit.md`（v2 多水果轮）四问量表试玩回填（入口 liveUrl，调参 `?tuning=1`） | 目标关闭的唯一前置。机器侧五件套本轮独立复跑全绿（PREFLIGHT / SMOKE / FUZZ / PLAYTEST / MOBILE_SMOKE），**人工拍板是最终裁决** | @MyRD Admin（目标 owner） | ⏳ 待人工（试玩指引已备：playtest-kit.md §1-§2） |

## 已知遗留（不阻塞验收，交 owner 试玩时参考 / 下轮迭代回流）

| # | 事项 | 等级 | 责任 |
| --- | --- | --- | --- |
| L1 | 壳页 `<title>`/`<h1>` 仍为「3D 切苹果」，玩法提示已是多水果口径（c2f86da 只改了提示文案）——与需求更正「3D 切水果」标题口径不一致，纯文案 | P2 | 下轮工作流 |
| L2 | 计分口径差：spec v2 `scoring.valuesByFruit`（分种类 10~25）vs 实现 `fruit_points=10` 扁平（与需求更正版「+10 不分种类」一致）——两者只能留一个，等 owner 试玩感受后定，再走 spec revisions 落新版本 | 决策项 | owner 试玩后定 |
| L3 | spec v2 `hud-timer.warnBelowSec=10`（最后 10 秒警示高亮）未实现，HUD 为纯文本 | 观察项 | 下轮迭代 |
| L4 | 证据口径说明：`qa/mobile/report.json` 落盘 checkedAt=2026-10-08T16:37Z（fps=28），playtest-kit.md 抄录为 07:56Z（fps=17）——是两次不同的 PASS 运行（阈值 ≥8 均达标），结论不受影响；本轮主策划已用 08:14Z 独立复跑（fps=17，10/10 PASS，`qa/mobile-recheck-v6/`）收口 | 说明 | 已收口 |

## 已解除

| 事项 | 解除方式 |
| --- | --- |
| v1 单苹果轮全部阻塞 | v1 轮复核通过（artifact acceptance_review @ 16:59Z）；需求更正 + spec v2 + 工作流重部署闭环完成 |
| 多水果 spec v2 上线验证 | 部署 v6 running；线上 index.pck SHA-256 `dbd26cca9283…` 与仓库构建一致（GDPC 魔数完好，含 fruit_catalog/Combo 标记）；六果目录、双层网格、方向光阴影、切面剖面、按果配汁均代码在档 |
| 门禁可信度（单次留证 → 跨轨迹复现） | 本轮独立复跑：PREFLIGHT PASS 14 类 / GODOT_SMOKE PASS 240 帧 / GODOT_FUZZ PASS seed=20260913 / GODOT_PLAYTEST PASS 3 局（10/20/20 分，首奖 3.3/7.1/6.4s，间隔 ≤2.4s）/ MOBILE_SMOKE PASS 10/10 |

## 升级规则

B1 若超过一轮无人响应 → 停止空转，升级给主人拍板「验收通过/打回」。
