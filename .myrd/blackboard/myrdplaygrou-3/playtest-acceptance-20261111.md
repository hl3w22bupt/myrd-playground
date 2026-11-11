# 试玩验收收口记录：《实况足球》v2 重跑（playtest-acceptance，2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；游戏源码零改动（SRC_SHA=bfd6df248a4846bb 与已部署 v7/c2109af 构建全等）。
- 上游：策划案 v2（cmwbl64r10082m97atgikgm0o）唯一事实源；本轮任务 = playtest/polish 节点的试玩验收面（preHook: threejs-browser-smoke 全绿后进入）。

## ① 前置证据核对（先核对后动手，不替门禁背书）

- 门禁资产 6 件判定脚本全在仓（std-skills/threejs-game-dev/scripts/）；references 两模板在仓；.myrd/routines.yaml 含 id=threejs-preflight 与 id=threejs-browser-smoke（gamePath=games/myrdplaygrou-3）→ 不触发 blocked。
- preHook 双视口冒烟复跑留痕（qa/smoke/report.json，checkedAt=2026-11-11T05:43:38Z）：双视口 ok:true、exceptions=0、consoleErrors=0、fps 19.1/16.4；inputProbe.ok=true（leftDx=-1.8/rightDx=+1.8/upDz<0/downDz>0）+ playersOnField=10、teams=2、playerSegments=160 —— 任务书两断言（输入方向 / 多球员在场数量）在链。
- 线上复证：liveUrl 308→200（589,387B 与 dist/web/index.html 逐字节一致 cmp）、/health 200、移动门禁 verdict=PASS（fps=14、console 0 错、触摸管线/响应 pass；report 内 render/animate 两 check 的 detail 为判定器失败分支模板无条件写入 —— mobile-web-smoke.mjs:384-385 实证，真实读数以 metrics 为准）。
- qa/experience/ 4 包 1630 图（v5×2 + v7×2，双视口 8 步输入全到达）；qa/playtest-summary.json C4 唯一缺口 = 平台级判定器间 schema 漂移（产出器写 {id,label,status} / 读数器认 {name,pass}，两判定器红线禁改），如实归因。

## ② 验收动作与回写

- round-5.md 落档（qa/playtest/round-5.md）：本验收轮记录，游戏源码零改动。
- op=playtest_kit 重发（v2 口径）：旧 kit 为 v1 语义（金币收集/进 3 球获胜/守门员三角波）已过时；新 kit 对照 v2 镜像 spec + numeric.js 写就（5v5 两队/受控人切换/关节人形/方向键钉死/平缓数值/音频解锁/起手建议 + 四问量表 + 调参说明 + 证据面 + 已知缺口）。
- 打分卡状态：requestKey=playtest_cmwaqvrng002lm9m2nftdd20h 已于 2026-11-10T17:06:04Z 发出，目标会话 38 条消息全扫无 inputAnswers → 按「同 requestKey 未回答不重复发」纪律不重发；试玩结论只能来自用户，未回填前验收状态 = 「自动化达成、试玩打分待用户」。
- op=playtest_summary 回写（ADVISORY 第一阶段单行 JSON）：autoPassSuggested=true（冒烟 PASS + 部署成功 + qa 证据齐全三条件全证）、screenshots=1630、consoleErrors=0、versionSha=本轮 HEAD。
- spec 修订：未写（未收到用户试玩结果，严禁编造；调参数值通道待用户反馈 → POST /api/v1/game-design-specs/cmwbl64r10082m97atgikgm0o/revisions 带 sourceTrajectoryId 溯源）。

## ③ 如实透出的缺口（不在验收包内美化）

1. 平台 spec v2 的 level-2~5 关卡递进（难度乘数/净胜球目标/夜场灯光）未在本轮构建实现；本轮可玩面 = 90 秒 5v5 单局（level-1「训练赛 · 首秀开球」语义），仓内契约 spec 已声明「唯一关卡」。
2. 构建无 ?tuning=1 调参桥（仅 ?smoke= 协议，src/main.js:15），验收包如实声明；URL 未声明键按纪律忽略。
3. playtest-summary 判定器 C4 恒 FAIL（schema 漂移，平台侧待对齐）；交互可达性实证以 qa/mobile/report.json 原始 checks + 取证包 inputArrived 为准。
