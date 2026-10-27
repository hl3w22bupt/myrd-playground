# QA 纸面预审记录 — spec v1.2（r4 霓虹夜塔冲刺 N1）

> 日期：2026-09-27 · 预审人：QA 线（T5，纸面预审，不构成 M2.1 核销）· 批准人：主策划
> 结论：**PASS → approve 放行**（POST /:id/approve 已执行，平台 v4 = 唯一 approved）

## 预审三查（任务书 N1 要求）

| 查项 | 方法 | 结果 |
|---|---|---|
| numeric diff/hash 相等 | 独立 sha256（sort_keys 规范化）：v1 冻结七键 vs v1.2 | **相等**（61b6fac49c44d7b2… 双方一致）；build-spec-v12.mjs 内置守卫双通道复核（e5ef7557… 全等） |
| 落点具名 | e09/buildOpeningStack/numeric.opening、theme.ts(./theme.js)、9 个新 check 文件路径逐条扫描 | **全部具名**（acc-j1..j5/acc-e1/acc-t1/acc-a8/acc-num 的 check 均为 `node games/stack-tower/tests/contract/<file>`） |
| 音画行可执行 | acc-j3 语句三要素：dispatch 时刻（内核上抛）→ AudioContext 播放调用（play 调用点，非实际出声）+ 预算常量 theme.AUDIO_DISPATCH_BUDGET_MS=50 | **可执行**（spy 可测，采纳 QA 重定义口径） |

## 只增不改审计（v1.1 → v1.2 全段 diff）

- world APPEND-ONLY（+2 条）；art_style/logline 未动（换装落 N2 风格卡与 theme.js，不动 world 文本——本轮为「换装实现」，world 段 art_style 将随 N2 冻结在 v1.3 评估，本轮不抢跑）
- levels：+e09（开局 3–5 块初始摆位，落点 `src/kernel/tower.ts` `buildOpeningStack()` + `numeric.opening`）；e08 语句唯一修订（塔回初始摆位），其余 7 元素零漂移
- acceptance：+9（acc-j1/j2/j3/j4/j5/e1/t1/a8/num）+ ac-lvl01-e08-recover 唯一修订，其余 22 条零漂移
- content：+analytics（统计三行 85%/3局/20% 标注 B 轮启动门槛，本轮验收范围=埋点完整性与字段合规）；既有键零漂移
- entities +3 / assets +13（a08..a20，含 file+source 规范字段）/ numeric +opening 组；冻结七键零漂移

## 版本链登记留痕

- POST /api/v1/game-design-specs/cmugok2uz000xm9ilx42t8pnl/revisions → **HTTP 201**，新 id `cmuj5f6ik00hkm9l64r5uickm`，version 3→4，status draft
- POST /api/v1/game-design-specs/cmuj5f6ik00hkm9l64r5uickm/approve → **HTTP 200**，status approved
- 全链复核：projectId=cmto0g28j0002m9sqnvjdy8o7 scope 内 approved 唯一 = (v4, cmuj5f6ik00hkm9l64r5uickm)；v3 自动置 superseded（平台事务内维护）
- 导出件：`.myrd/spec/stack-tower-spec.json` 与 `.myrd/spec/design-spec.json`（任务书指定路径）同内容双落盘；`design-spec.json` 原糖果线遗留内容于 2026-09-25 前已丢失（git 不可回滚），本文件自此为 stack-tower 专属导出件

## 已知未收口项（不阻塞本轮）

1. acc-a7 的 check 指向 D4 冻结文件（tests/audio/events.test.ts），随 v1.1 折入原文不变；仓库该文件仍不存在（2026-09-27 实查）→ 不入 run-all CONTRACTS，不计红不判绿，随终报单列。
2. 9 个新 acceptance 的 check 文件属 N4 程序产物，approved spec 已先行（任务书铁律：先有 approved spec，程序再动代码）→ N4 落码后同门运行。
