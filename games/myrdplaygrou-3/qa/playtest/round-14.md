# round-14：打磨轮基线发现（改前，线上 v14，2026-11-11）

- 分支 `myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；基线对象 = 在服 v14（commitHash=c8ed7aa，606,863B）
- 性质：polish 节点改前基线轮 —— 固定序列 SEQ-P（qa/playtest/seq-p.sh，18 步）建立跨轮可比面

## 观察

- **IP-P1 切换抖振（实锤）**：线上实局 SEQ-P 探针，timeLeft=45.6（已踢 44.4s）时 `switchCount=82`（≈1.85 次/秒）——挤抢/球在飞时控制权逐帧易主，环脉冲+确认音连发。根因 = `world.js:426` 每 tick 无条件重算「最近主队非门将」，无迟滞无飞行窗冻结。缺陷单 cmwbumwrj 修掉的是「全队闪烁」（池化单环 v10 已闭环），切换单实例化后残留的**频率抖振**是同诉症状的后半段。
- **IP-P3 客队零射门（结构性）**：确定性内核 5 种子全集对局逐队事件统计（qa/playtest/switch-sim-before.json + 事件流归账）——客队 5 场 **0 射门 0 进球**，总比分 46:0。根因 = 客队起脚门槛 `distPress>1.8`（远射）/`>1.2`（小禁区）结构性不可达：home chaser 以 PRESS_MARGIN=0.4m 粘人，distPress 恒 ≈0.4-0.9m → `AWAY_SHOT_RANGE_Z=8` 声明的出手通道形同虚设，防守与 GK 半场沦为摆设。
- 首轮实跑（tmp 已回收）与复跑（r14b）同窗探针一致（70~82 次），读数稳健。
- 过程失误如实记录：首轮 SEQ-P（tmp xh-session-VJk5mh）截图未在会话回收前拷贝入 qa/playtest/steps/，已用**同构建同序列线上复跑（r14b）**重建证据，非伪造补拍。

## 动作

- 阅读既有证据：qa/playtest/round-11.md（线上 0:0@38s、切环单实例）、summary.md 缺口②、round-12/13 门禁记录
- sessiond 起会话（线上 URL）→ SEQ-P 全序列（截图×3 + 中途探针 + 终局全量探针）
- 新建机判仪器 qa/playtest/switch-sim.mjs（5 种子 × 90s 全集对局：switches/maxHold/shots/goals/possChg）→ switch-sim-before.json
- 内核事件流逐队归账脚本（客队射门=0 实证）
- SEQ-P 线上复跑（r14b，截图即时拷贝 qa/playtest/steps/r14b-*.png）

## 截图

- qa/playtest/steps/r14b-000-live-baseline-title.png（教学卡四操作+开始/跳过，改前基线首屏）
- qa/playtest/steps/r14b-016-live-baseline.png（中场人堆：7+ 球员塌向球，控制环可读）
- qa/playtest/steps/r14b-028-live-baseline-final.png（同窗终态 0:0，客队持球压至主队半场）

## 改进点

- **IP-P1 切换抖振稳定化**（出处：本轮线上探针 switchCount=82/44.4s；缺陷单 cmwbumwrj 同诉残留症状）
- **IP-P3 客队出手通道**（出处：5 种子逐队事件统计客队 0 射门；live 观察客队持球 40s 钉在 z≈11.3 不起脚）
- IP-P4 中场胶水僵局（双方全队塌向球）——归因 SUPPORT_OFFSET/盯人间距，属 spec.numeric 域，本节点不动，登记为 spec 修订通道候选（待用户打分卡回填一并裁决）

## 改动

- 无源码改动（基线发现轮）；新增机判仪器 switch-sim.mjs + SEQ-P 固定序列脚本

## 复玩对比

- 基线锚点：switches=82（live 44.4s）/ 模拟 switchesMean=26.6、maxHoldSecMean=11.2s、客队射门 0 —— 供 round-15 改后对比
