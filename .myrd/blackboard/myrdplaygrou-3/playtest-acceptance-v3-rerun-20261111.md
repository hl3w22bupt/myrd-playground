# 试玩验收轮记录：《实况足球》流水线重跑轮 playtest 节点（playtest-acceptance-v3-rerun，2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；节点执行时 HEAD=c7a5b8768a2bda87eb3da96d1a5b4a3266531ba9；游戏源码零改动（v3 实现面沿用 c906e96）
- 上游：策划案 v3（cmwburjse0011m9bb8t1mjuqn）唯一事实源；deploy 节点已收口（v14=cmwc2lz7f001im9bhquvnkgv5 线上与 HEAD 构建逐字节一致）

## ① 前置核验（先核对后动手）

- stalled run 处置：cmwbl6h6e008am97aetlijmmv GET 实查 status=completed（08:16:52Z）→ 免 cancel。
- 门禁资产 6 件判定脚本在仓 + routines.yaml 两条 threejs routine 在位 → 不触发 blocked。
- preHook browser-smoke 亲跑复证：**BROWSER-SMOKE: PASS exit 0**（双视口 fps 12.7/11.7、零异常；switchRing.instanceCount=1 / hudLabels 移动·传球·射门 / rematch 按钮 v3 断言在链）→ qa/smoke 证据刷新（本节点提交）。
- 线上：606,863B sha256=321171cd97bc65d8… 与 dist/web/index.html 逐字节一致；/health 200（title=共享壳硬编码 PvZ 标签，仅标签非串线）。
- playtest-summary 判定器亲跑：rounds=12 / screenshots=37 / consoleErrors=0 / fps=17 / versionSha=c7a5b87；FAIL 唯一缺口 C4（schema 漂移同源亲验，红线禁改）。

## ② 验收动作与回写

- qa/playtest/round-13.md 落档（本验收轮记录，源码零改动）。
- op=playtest_kit 重写（v3 语义）：旧 kit（05:55:56）为 v2 GOAL RUSH 语义已过时（与线上 5v5 不符）；新 kit 对照 spec v3 + numeric.js 写就，四问量表与打分卡同构，调参通道如实披露（无 ?tuning=1 桥，src/main.js:22 仅读 smoke）。
- 打分卡重发：旧卡已于 11-10T23:51Z 被用户回答（反馈已闭环为 v3），重发合规 → POST ask-user **HTTP 201 created=true messageId=cmwc3b24p001nm9bh0sxv783u**（requestKey=playtest_cmwaqvrng002lm9m2nftdd20h）。
- op=playtest_summary 回写（单行 JSON，ADVISORY 第一阶段）：autoPassSuggested=true（冒烟 PASS + 部署成功逐字节一致 + 证据齐全三条件全证）/ rounds=0 / screenshots=70 / consoleErrors=0 / versionSha=c7a5b8768a2bda87eb3da96d1a5b4a3266531ba9 / evidence=games/myrdplaygrou-3/qa/experience/。
- PATCH 后 GET 复核：artifacts 35 → 37 条，playtest_kit(v3) 与 playtest_summary(重跑轮) 均 EXISTS。

## ③ 状态与交接

- **验收状态 = 待用户试玩**：本轮打分卡未回填前不写 spec.numeric 修订、不写 tuning_applied（严禁编造）；用户回答到达后按 numeric.js/spec.numeric 声明键走 POST /api/v1/game-design-specs/cmwburjse0011m9bb8t1mjuqn/revisions（带 sourceTrajectoryId）→ approve → 回写 op=tuning_applied → 下轮按新 spec 重部署。
- 下一节点（polish 若被调度）按既有 round-1~12 流程走「改→玩→看」；如无新反馈则本分支终态 = v14 在服。
