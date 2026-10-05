# PLAYTEST 交付报告：《汽车连连看》试玩验收包（goal cmuv35n7o0051icry63ndtamn）

- 日期：2026-10-05
- 节点：scaffold→implement→deploy→playtest 主通道 · playtest（人机回环节点）
- 分支：myrd/games-goal-cmuv35n7o0051icry63ndtamn（本节点 commit 见 git log）
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/game-15/（/health 200，app=car-lianliankan）
- 量表状态：**待用户试玩**（未收到用户结论，第 3 步调参回写跳过，不伪造试玩结论）

## 已完成

1. **preHook 证据核验**：games/game-15/qa/mobile/report.json verdict=PASS（10/10：网络全通 /
   console 零错 / canvas 挂载 / 首帧非纯色 / 画面在动 / 触摸到达 / 触摸响应 / 音频解锁器 /
   无横向溢出 / FPS 27），三张分阶段截图在库；本次 preHook 复跑仅刷新 checkedAt/tapDiff(2→3)/
   截图，verdict 不变、与 a54eba8 既有证据一致。report.json 的 checks[].detail 是判定器
   check() 第 4 参无条件填入的「失败解释」固定文案（mobile-web-smoke.mjs L273-287），
   PASS 判定以 status 与 metrics 为准 —— 证据与 preHook 结论无矛盾。
2. **试玩验收包已回写目标 artifacts**（GET 现状 5 条 + 追加 1 条 op=playtest_kit /
   artifactType=playtest_kit 后整体 PATCH，未覆盖任何既有条目）：试玩指引（按实现说明写实，
   对照已批准 spec《汽车连连看》GameDesignSpec v1 cmuv3lyz0005vicryanq7ej03 的 meta/levels/
   content）+ 四问结构化量表（逐条待回填）+ 调参工作台入口 <liveUrl>?tuning=1。
3. **调参面核实（对照工程 GameState.TUNING_META，调参数值只认声明键）**：
   - score_per_pair（每对得分）：默认 10，范围 5–50，步长 5；
   - total_hints（每局提示次数）：默认 3，范围 1–9，步长 1。
   spec.numeric 其余键（score.combo* / hint.scoreCost / shuffle.* 等）不在工程调参面，
   URL 携带未声明键会被 apply_tuning 忽略 —— 回写 diff 时须标注。
   注意映射：score_per_pair ↔ spec.numeric.score.basePair（spec 现值 100）、
   total_hints ↔ spec.numeric.hint.initialCharges（spec 现值 3）；
   未来 tuning_applied 回写 revisions 时按此映射落 spec.numeric，并附 sourceTrajectoryId。

## 实现与 spec v1 的已知口径差（试玩指引按实现写实，供试玩者对照）

- 车种：实现 10 种（轿车/跑车/公交/出租/越野/消防/警车/救护/卡车/赛车，_draw 矢量绘制 +
  10 色相），spec 为 8 款位图车型（AI 生成位图未接入）。
- 关卡：实现 4 档梯度（6×8·24对·8种 → 6×8·24对·10种 → 6×10·30对·10种 → 8×10·40对·10种封顶），
  spec 为 3 关（6×6 / 8×6 / 8×8）。
- 计分：实现每对 +score_per_pair（默认 10），无连击/提示扣分/洗牌扣分/完美奖励（spec 有）；
  提示每关 3 次（可调），洗牌不限次。
- 图鉴：按「本局」收集（过关重开即清零重收），spec 语境为跨局持久图鉴。
- 音效：Juice.sfx 调用点已钉住但 SFX_BANK 留空 = 当前无声（量表第③问「音效」按此事实打分）。

## 遗留（如实披露，非本节点新发现）

- **playtest.sh 仍缺失**：模板仓库未预置门禁脚本 std-skills/godot-game-dev/scripts/playtest.sh
  （连同 playtest_driver.gd，全历史无提交；注入目录同名脚本是阅读副本，未当判定来源、未复制）。
  沿用 .myrd/blocked-report.md 的既有 blocked 上报（scaffold 节点发起，implement/deploy 同口径
  沿用），本轮未伪造 GODOT_PLAYTEST 结论。本节点自身不运行该判定器（机判由 preHook
  mobile-web-smoke 承担，其脚本在仓库内齐全），机器人试玩门禁待运维补模板仓库后由后续轮补跑。
- 用户量表结论 + 调参 URL 回填后 → 解析 ?tuning= JSON 与现值 diff → POST
  /api/v1/game-design-specs/cmuv3lyz0005vicryanq7ej03/revisions（落 spec.numeric，新版本）→
  POST /api/v1/game-design-specs/:id/approve 拍板 → 追加 op=tuning_applied 产物；
  下一轮工作流按新 spec 重部署，不在本节点改代码默认值。
