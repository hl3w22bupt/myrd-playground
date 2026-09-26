# 关卡状态黑板 — stack-tower（正式发布轮 M2.1）

> 更新时间：2026-09-26（正式发布轮开工 · 主策划）
> 负责人：主策划（整合人）· T4 程序线维护实现状态列，T5 QA 线维护核销列
> 下一步：程序发布体检（N1）→ QA 对内放行（N2）→ 美术终检（N3）→ 策划 notes（N4）→ deploy（N5）→ QA 对外放行（N6）→ 版本链登记（N7）

## 关卡清单

| 关卡 | 状态 | 内容量 | 契约覆盖 | 核销状态 |
|---|---|---|---|---|
| lvl-01-stack-tower | **production**（随 M2.1 发布） | 12 关曲线 / 228 层推导（8+2(l−1)）；速度 160+24(l−1) 封顶 420；完美窗口 140−8(l−1) 封底 60 | e01–e08 八条 gameplay 契约（ac-lvl01-e01~e08）全绿 | 自动化面全绿（22/22）；「开局不劝退体感」（e05 人工列）+ 真机三项归主人试玩/B6，未核销不判完成 |

## 关卡实现落点（契约断言面）

- 关卡数据：`games/stack-tower/src/kernel/`（numeric.ts 数值 SSOT / sim.ts / difficulty.ts / judge.ts / tower.ts）
- 契约测试：`games/stack-tower/tests/contract/lvl-01-stack-tower_e01~e08*.spec.mjs`（8 条，全部 PASS）
- 数值冻结：v1 系冻结四组（perfect_window / cut_width / scoring / difficulty + DEFAULT_SEED / FIXED_STEP_MS / MAX_DT_MS）——本轮发布体检机验 v1/v3 深比全等，漂移即回退

## 本轮发布口径（M2.1 正式发布轮 · 2026-09-26）

- 发布内容 = M2.1「有声可装」全量（sfx-pack-v1 + 移动端触控适配 + PWA 安装），数值维持 spec v1 冻结基线，零调优零新功能
- 关卡面本轮**零改动**（HEAD eddcf0c vs 9/25 部署版 75debf9：关卡/内核/表现层字节全等，diff 已验空）

## r2 复验轮增记（2026-09-26）

- 关卡面**零改动**（r2 tag `6a6b4a8` vs r1 tag `5a3284f`：kernel/levels 相关文件 diff 为空，仅壳注册链路 + 测试工具变更）；v1 冻结数值七组键序无关深比全等（r2 体检机验复跑）。
- 生产树已更新至 `stack-tower-m2.1-release-r2` @ `6a6b4a8`（deployment `cmuhzflkk001mm97cxzu1tphg`）：线上在线可玩全绿（live-smoke L1 全项 PASS，2026-09-26）。
- SW/PWA 线上面维持不绿（R2 平台层缺陷，`qa-live-check-m21-r2.md` §二）——**production 状态不据此改判**：关卡本体（12 关曲线/228 层推导/八条 gameplay 契约）不受影响，自动化面 22/22 全绿维持。
