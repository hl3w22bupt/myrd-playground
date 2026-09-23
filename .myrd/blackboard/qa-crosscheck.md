# qa-crosscheck.md — QA 互查记录（transport-ship-3d）

> 更新时间：2026-09-23 · 主策划整合批次
> 执行方式说明：本执行环境未暴露 `assign_agent` 工具，无法派活独立 QA 成员（见 blockers.md B-3）。
> 互查以「**独立机判脚本（qa-audit.mjs，实现侧不可绕过）+ 第二遍交叉走查（对照 spec 逐条核对实现）**」替代，
> 全部证据为可复现命令与原文日志，不伪造「另一人已查」。
> 下一步：主人人工试玩验收（好不好玩最终裁决）——机判全绿不代表验收通过。

---

## 一、互查发现与处置（第二遍走查实际抓到的问题）

| # | 发现 | 严重度 | 处置 | 复现/证据 |
|---|---|---|---|---|
| Q1 | 关卡数据缺陷：spawn-north 出生点落在舰桥掩体 AABB 内 → 敌兵出生即在遮挡里，永不可命中（对轴射击 172 发 0 命中） | P0 | 出生点移出掩体（z=-24→-21.5），舰桥盒缩短（maxZ -22→-24） | kernel 冒烟：修复后同轴射击立刻出命中 |
| Q2 | 玩家移动绕过碰撞（loop.js 直接写 x/z，没走 moveWithCollision）→ 玩家可穿掩体/出围栏 | P0 | 改走 moveWithCollision（掩体滑移 + bounds 钳制） | ac-2 快照含 px/pz；围栏钳制由 clampToDeck 断言 |
| Q3 | 数值过载：四种子一致的基线 bot 第 3 波 ~46s 阵亡，达不到 content.sessionSeconds=180 节奏目标 | P1 | 走版本链调参（v3）：敌压下调 + 波休 6→8s + 清波回血 WAVE_CLEAR_HEAL=35 | 复跑四种子：46s→86s（静态 bot），移动玩家余量充足 |
| Q4 | tick 口径混用：combat.js 里硬编码 `0.016666666666666666` 换算，未走 FIXED_STEP | P2 | 统一 TICKS() 助手 | qa-audit 数值键扫描 + 代码评审 |
| Q5 | 弹匣打空不自动换弹（要等下一次死扣扳机） | P2 | tryFire 内 ammo==0 当 tick 触发 startReload | combat.spec「换弹时长/备弹记账」三条转绿 |
| Q6 | 冒烟模式空意图把玩家 yaw 归零 → 截图朝向错误（差点误判成相机数学 bug） | P2 | smoke 意图携带 PLAYER_START.yaw | 截图对比：舰桥入画 |
| Q7 | 逆光导致甲板死黑、天空橙色过溢、枪模比例偏大 | P2 | 曝光 0.75→0.95、半球光抬升 + 相机侧补光、天空渐变收窄、枪模 0.8x + 位姿修正 | smoke-frame.png（黑板 gate-logs） |
| Q8 | 测试侧两类自伤：①kernel-determinism 用「每 tick 不同意图」去比「单帧单意图」（实验不等价）；②wave.spec 把 ticks 当 seconds 传 fastForward（479s≠479tick），且清波前提没含「出兵完毕」 | P2 | 修正测试设计；kernel 行为经独立复跑证实无缺陷 | 全套复跑 0 FAIL |

## 二、互查基线（机判门禁，全部可复现）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 契约门禁 | `node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .` | **71 PASS / 0 FAIL**（exit 0） |
| ac-1 单文件 | `node games/transport-ship-3d/tests/singlefile.contract.mjs` | PASS（零外链/零 CDN/three 内联） |
| ac-2 确定性 | `node games/transport-ship-3d/tests/kernel-determinism.spec.mjs` | PASS（2441+2700 tick 逐字段一致、大 dt 钳制等价、fastForward 等价） |
| ac-3 武器数值 | `node games/transport-ship-3d/tests/combat.spec.mjs` | PASS（射速/弹匣/换弹/伤害/爆头/得分/承伤口径） |
| ac-4 波次 | `node games/transport-ship-3d/tests/wave.spec.mjs` | PASS（规模公式/封顶/轮转/休整/清波奖励与回血） |
| ac-6 QA 审计 | `node games/transport-ship-3d/tests/qa-audit.mjs` | PASS（内核纯净 5 文件 / 数值 41 键双向零偏差 / HUD 14 id / 产物 SRC_SHA 同步 / 元素编号 11 个落地） |
| 真浏览器冒烟 | headless Chrome `index.html?smoke=30`（SwiftShader WebGL） | `{"ok":true,...,"drawCalls":9,"triangles":2700}`，0 个未捕获错误 |

原文日志：`.myrd/blackboard/gate-logs/transport-ship-3d/full-suite-*.log`、`smoke-frame.png`

## 三、互查遗留（不阻塞，呈主人）

1. **人工试玩未做**（主人裁决项）：手感/难度/好玩与否。机判只能保证「与 approved spec 一致且数值按 spec 曲线」。
2. **移动端触控未做**：spec.meta platform 写「桌面/移动 Web」，本版仅键鼠（世界提示口径已注明）；若主人要触控版，走 spec 修订 + 增量实现。
3. **静态 bot 命中率 33%** 主要打掩体后目标（bot 不绕位），非命中判定问题；真人体验待验证。
4. 竞速线（qqfeiche3d）复刻不在本节点，见 blockers.md B-2。
