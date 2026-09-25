# Stack Tower QA 预审记录（T5）— 对 spec v1 终稿逐条三态

> 预审时间：2026-09-25 · 预审人：游戏 QA（T5，独立视角） · 预审对象：spec v1（platformSpecId `cmuga6tq90011gqlo3wkh9k7a`，draft）
> 三态口径：【可执行】= acceptance.check 为可粘贴命令且契约文件存在、断言完备（骨架期 not-runnable 属可执行列的骨架态，不计绿）；【人工】= 归主人试玩/体感终裁；【打回】= 命中反例清单条目，须 T2 修复。
> 证据：`node games/stack-tower/tests/contract/run-all.mjs` 实跑输出 = 8/8 not-runnable（骨架态，缺因显式）+ 8/8 命令与 spec acceptance 逐字对齐（runner 启动校验）。

## 0. QA 反例清单（QNC-01~08，本轮重建并固化条目号；T1 原文未在平台回传，见 blackboard B1 升级项）

| 条目 | 反例 | 本稿命中 |
|---|---|---|
| QNC-01 | numeric 含「待调优/视情况/后定」等非数值表述 | 未命中（四组全为写死数值） |
| QNC-02 | acceptance 存在「必失败/不可达成」的无窗断言 | 未命中（必改①已改写为「前 3 次输入内存在 ≥1 个可命中窗口」） |
| QNC-03 | aha/整屏特效未降维为事件契约 | 未命中（必改②已降维为 tower-ripple，契约 e06 断言无 screen-flash 字段） |
| QNC-04 | acceptance.check 不可粘贴，或与 tests/contract/ 文件名不映射 | 未命中（8/8 逐字对齐） |
| QNC-05 | 跨字段数值不自洽（时长/层数/速度推不通） | **命中 → 打回**：`sessionSeconds=180` 未标注口径；若按「全局长度」解读，与难度曲线推出的总层数 228 层（Σ(8+2(l−1))) 推不通 |
| QNC-06 | 风格卡/情绪板引入 spec world 段没有的主题项 | 未命中（12 关键词逐条标注派生出处） |
| QNC-07 | 资产预算超 300KB 或引入外部资源 | 未命中（源码级 ≤20KB，零外部资源） |
| QNC-08 | 契约空转：断言恒真或不过问产物可达性 | 未命中（三态 runner：not-runnable 显式缺因，FAIL 非零退出） |

## 1. acceptance 逐条三态（8/8）

| spec acceptance id | 契约文件（tests/contract/） | 三态 | 预审意见 |
|---|---|---|---|
| ac-lvl01-e01-spawn | lvl-01-stack-tower_e01-spawn-first-block.spec.mjs | 可执行 | 命令可粘贴；4 断言覆盖宽度/中点/静止；逻辑宽 240 已在文件头注明平台约定 |
| ac-lvl01-e02-swing | lvl-01-stack-tower_e02-swing-motion.spec.mjs | 可执行 | 确定性双跑全等 + 解析解 2.56px/tick + 行程钳制，覆盖 spec 三项要求 |
| ac-lvl01-e03-input | lvl-01-stack-tower_e03-drop-input.spec.mjs | 可执行 | 同 tick 事件断言落在「同一 tick」语义上，无歧义 |
| ac-lvl01-e04-cut | lvl-01-stack-tower_e04-overlap-cut.spec.mjs | 可执行 | 文件头已注明：整块掉落（keepWidth=0）必然同时触发 e08 的 floor 判定，本条只断言计分/塔身不变——两契约不重叠不打架 |
| ac-lvl01-e05-window | lvl-01-stack-tower_e05-perfect-window.spec.mjs | 可执行 + 人工补位 | 必改①量化为「往返周期内独立命中段 ≥2 + 前 3 次输入预算内可达成」；「开局不劝退」的体感归人工（试玩） |
| ac-lvl01-e06-ripple | lvl-01-stack-tower_e06-tower-ripple.spec.mjs | 可执行 | 必改②四断言齐：同 tick / 恰四字段 / window_ms=140 / duration∈[250,350] 默认 300 / 无 screen-flash |
| ac-lvl01-e07-score | lvl-01-stack-tower_e07-score-hud.spec.mjs | 可执行 + 人工补位 | 计分序列 35/75/120 可机判；HUD 真实显示（DOM 呈现）headless 不可判 → formatHud 代理断言 + 人工试玩补位 |
| ac-lvl01-e08-recover | lvl-01-stack-tower_e08-fail-recover.spec.mjs | 可执行 | floor 归因事件 + 冻结断言 + 复位四项 + 「无状态残留」落在 debris 清空与数值回 L1 上 |

## 2. 非逐条项核查

| 项 | 三态 | 说明 |
|---|---|---|
| numeric 四组写死（完美窗口/切面宽度递减/计分/难度曲线） | 可执行 | e07 第 4 条「数值总闸」断言 NUMERIC 与 spec.numeric 深度一致——数值漂移会直接红灯 |
| tower-ripple 契约完整入 spec | 可执行 | content.towerRipple（载荷/区间/触发/消费/禁止）+ world.architecture_rules 双落点 + types.ts 类型 |
| acceptance 100% 命令化 | 可执行 | 8/8 check 均为 `node games/stack-tower/tests/contract/…` 可粘贴命令 |
| 玩法「好不好玩」 | **人工** | 红线：机器不替人判断好玩；主人试玩是最终裁决，预审只保证「可试玩的前置条件齐备」 |
| content.sessionSeconds=180 口径 | **打回（QNC-05）** | 见 §0；要求：spec 明确「单关会话护栏」口径或修正数值，使 12 关曲线自洽 |

## 3. 预审结论

**NEEDS_WORK（1 条打回：QNC-05）** → 转 T2 一轮修复（spec 经 `/revisions` 升版，v1 保留 superseded）→ QA 复审一次（只核 QNC-05 清零 + 版本链与契约基线同步）→ 全绿后声明 approved 候选版（代持台账）。

复审范围限定：QNC-05 单点 + 版本链一致性，不重复全量预审（防循环打回）。

---

## 4. QA 复审记录（2026-09-25，一次，限定范围）

| 复审项 | 结论 | 证据 |
|---|---|---|
| QNC-05 清零 | **清零** | v2 `content.sessionScopeNote` 显式口径：「单关会话护栏（秒）」+ 总层数推导 Σ(8+2(l−1))=228 与单关 8~30 层在 180s 护栏内自洽；全局长度留实测回填槽 |
| 版本链一致 | 通过 | v1 `cmuga6tq90011gqlo3wkh9k7a`（draft→superseded）→ v2 `cmugal9ob0013gqlok6dstuyc`（draft），parentSpecId 正确回链 |
| 契约基线同步 | 通过 | `.myrd/spec/design-spec.json` 已刷新至 v2；`run-all.mjs` 重跑 8/8 命令与 v2 acceptance 逐字对齐（not-runnable 骨架态，缺因显式） |
| 复审纪律 | 通过 | 未发现 v2 引入新的反例命中（修复只动 sessionScopeNote 与 revision_note 两处） |

**复审结论：CERTIFIED（骨架态）** —— 预审全绿，转收口：spec v2 走代持拍板（approved 候选版），待主人试玩终裁「好不好玩」。
