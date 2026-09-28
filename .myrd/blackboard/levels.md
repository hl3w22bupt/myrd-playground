# 关卡状态黑板 — stack-tower（霓虹夜塔冲刺 r4 → **B0 微信小游戏移植轮**）

## B0 · 微信小游戏移植轮（2026-09-28 开工 · 主策划）

> 更新时间：2026-09-28（B0 开工首笔 · 主策划）
> 负责人：主策划（整合人）· 程序线维护实现状态列 · QA 线维护核销列
> 下一步：N1 spec v1.3（platform 段四条目）→ N1.5 QA 预检 → N2 程序‖美术 → N3 三轨门禁 → N4 提审包回流 → 主人拍板是否提审

- **移植轮红线：关卡面零改动**——world/entities/levels/numeric 四段与 v1.2 逐字节一致（N1 冻结守卫机械断言）；web 行为零变化（v1.2 四判据 + 31 条契约全量重跑）。wx 侧新增面全部走 platform 适配层（`src/platform/wx.ts` 装配体 + `src/audio/bgm.ts` 环 + `wx/` 包骨架 + 开放数据域子包），内核零触碰。
- B0 验收主判据 = **会话分享 5:4 卡**（N3 wx 轨）；朋友圈分享 = 附带项；开放数据域不卡「真机看到真实好友分」。

> 前轮纪要：2026-09-27（r4 开工 · 主策划）
> 负责人：主策划（整合人）· T4 程序线维护实现状态列，T5 QA 线维护核销列
> 下一步：**N6 主人拍板**（首图定稿 + 发布包终审 + 试玩终裁 + 真机三项 + R2 裁决）——机器不替人判断好玩

## r4 关卡面改动计划（spec v1.2 驱动，先 approved 后动码）

- **开局 3–5 块初始摆位**（任务书条款）：落点 `games/stack-tower/src/kernel/tower.ts`，参数 `numeric.opening`（`STACK_MIN_BLOCKS=3 / STACK_MAX_BLOCKS=5 / STACK_WIDTH_JITTER_PX`，seeded RNG 决定块数与宽度扰动，确定性可复现）。塔基块（宽度 120、中心 x=240、yIndex=0）规格不变，初始摆位块叠于其上；初始摆位块**不计分不计 layers**（layerCount 仍只数玩家落块），塔顶=初始摆位最顶块。
- **e08 口径同步修订**：「重开后塔回单块」→「重开后塔回初始摆位（同 seed 同摆位）」，其余语义逐字保留（keepWidth<36 game-over / 分数连击清零 / 摆速窗口回 L1 值）。契约测试 e01/e08 同步（e01 断言不变仍真）。
- **数值冻结不变**：v1 冻结七键零漂移（机械断言 `numeric-acc-num-frozen-gate` 进门禁）；本特性全部新数值走 `numeric.opening` 新组，不触碰冻结键集。

## 关卡清单

| 关卡 | 状态 | 内容量 | 契约覆盖 | 核销状态 |
|---|---|---|---|---|
| lvl-01-stack-tower | **production**（r4 霓虹夜塔换装 + 开局摆位新特性） | 12 关曲线 / 228 层推导（玩家块口径，v1.2 e09：开局另预置 3–5 块不计层）；速度 160+24(l−1) 封顶 420；完美窗口 140−8(l−1) 封底 60 | e01–e08 + **e09 开局摆位（v1.2 新增）** + r4 增量 9 条（acc-j1..j5/e1/t1/a8/num）全绿；程序线复跑 8 门禁全绿（2026-09-27 11:07–11:14，含裸调用契约门禁 v1.2 形状修复 + e09 折入核验 + run-all 聚合完整性断言，证据 `gate-logs/r4-neon-juice-20260927-prog-recheck/`）；驳回①修复后复跑：acc-j1 按 spec 实验口径（CDP 4x CPU throttle + 390x844/360x640 双视口，参数自 spec numeric.benchmark_device 读入）实测 310ms/166ms ≤3000ms，run-all 31/31 + 裸调用契约门禁 PASS（同目录 9/10 号日志，11:44–11:55） | **自动化面全绿（契约 31/31）**；「开局不劝退体感」「霓虹夜塔好不好玩」归 N6 主人试玩终裁，未核销不判完成 |

## 关卡实现落点（契约断言面）

- 关卡数据：`games/stack-tower/src/kernel/`（numeric.ts 数值 SSOT / sim.ts / difficulty.ts / judge.ts / tower.ts）
- 契约测试：`games/stack-tower/tests/contract/`（r4 = 31 条全绿：e01~e08 八条 gameplay（含 e09 断言）+ M2.1 14 条 + r4 新增 9 条）
- 数值冻结：v1 系冻结四组（perfect_window / cut_width / scoring / difficulty + DEFAULT_SEED / FIXED_STEP_MS / MAX_DT_MS）——本轮发布体检机验 v1/v3 深比全等，漂移即回退

## 本轮发布口径（M2.1 正式发布轮 · 2026-09-26）

- 发布内容 = M2.1「有声可装」全量（sfx-pack-v1 + 移动端触控适配 + PWA 安装），数值维持 spec v1 冻结基线，零调优零新功能
- 关卡面本轮**零改动**（HEAD eddcf0c vs 9/25 部署版 75debf9：关卡/内核/表现层字节全等，diff 已验空）

## r2 复验轮增记（2026-09-26）

- 关卡面**零改动**（r2 tag `6a6b4a8` vs r1 tag `5a3284f`：kernel/levels 相关文件 diff 为空，仅壳注册链路 + 测试工具变更）；v1 冻结数值七组键序无关深比全等（r2 体检机验复跑）。
- 生产树已更新至 `stack-tower-m2.1-release-r2` @ `6a6b4a8`（deployment `cmuhzflkk001mm97cxzu1tphg`）：线上在线可玩全绿（live-smoke L1 全项 PASS，2026-09-26）。
- SW/PWA 线上面维持不绿（R2 平台层缺陷，`qa-live-check-m21-r2.md` §二）——**production 状态不据此改判**：关卡本体（12 关曲线/228 层推导/八条 gameplay 契约）不受影响，自动化面 22/22 全绿维持。
