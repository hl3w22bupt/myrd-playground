# round-17：IP-P5 部署 v16 + 线上进球庆祝实拍收口（改→玩→看 第 3 轮，2026-11-11）

- 分支 `myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；HEAD=94a6648；**v16 = cmwc5dhrd0031m9bh58t9v2s1**（version=16，commitHash=94a6648=推送 HEAD 全等，manifestPath=games/myrdplaygrou-3/apphost.toml）
- 上游：策划案 v3（cmwburjse0011m9bb8t1mjuqn）；缺陷单 cmwbumwrj/cmwbumwtv 已 closed（v10 修复线上实证）；本周期改动 = IP-P1/IP-P3/IP-P5（见 round-14/15/16）

## 观察

- **线上进球庆祝实拍达成**（收口 round-11 遗留缺口「实局进球庆祝线上实拍未捕获」）：v16 线上 `?smoke=69` 实拍四要素同框——横幅「进球！主队」发光 + 进球特写机位（门后机位读网窝、客队 GK 在网口）+ 彩带粒子飘散 + 比分 2:0 弹跳；payload ok=true/state=playing/goals=2/timeLeft≈23/exceptions=0。seed=333 在 0.1s 意图粒度下进球时刻 12/68.1/76.5s，smoke=69 块末恰落第二球庆祝窗（内核直算 celebrationLeft=0.38s 可见）。
- **IP-P1 在 v16 保持**：线上 SEQ-P 复玩 switchCount=36/42.9s（0.84/s；r16b v15 为 19/40.6s，同序列突发驱动时序方差带内），对 v14 基线 82/44.4s（1.85/s）仍 -55%~-75% 带。
- **线上门禁**：mobile-web-smoke PASS（网络/渲染/触摸/音频契约/视口/FPS 全绿，fps≥8 软渲染口径）；GET / 200 = 607,064B 与 dist/web/index.html 逐字节一致（sha16=97adfc85）；/health 200（title 为共享壳硬编码标签，已知平台形态非串线）。
- 本地门禁（IP-P5 后全量复跑）：tests/run-all 7/7 PASS、preflight PASS 0 WARN、browser-smoke 双视口 PASS（desktop 14.4 / mobile 13.3）、asset-triple-check PASS（清单 7 项全 programmatic）。

## 动作

- 部署 POST（manifestPath 判例姿势）→ 504 受理 → 轮询 v16=cmwc5dhrd0031m9bh58t9v2s1 running @ 94a6648（单笔受理核对，无双受理）
- 线上逐字节复证 + ?smoke=69 会话（navigate→60s 等待→title/payload 探针→截图即时拷贝）
- SEQ-P 线上复玩（r17b：截图×2 + 终局探针）
- 线上 mobile-web-smoke 门禁复跑 → PASS
- 收尾仪器：visual-ratchet（advisory）+ playtest-summary.mjs + summary.md 重写

## 截图

- qa/playtest/steps/r17-002-live-v16-goal-celebration.png **线上实拍进球庆祝**：横幅+特写机位网窝+彩带+比分弹跳四要素同框
- qa/playtest/steps/r17b-016-live-v16.png v16 线上实局：对抗散布可读
- qa/playtest/steps/r17b-028-live-v16-final.png v16 线上同窗终态

## 改进点

- IP-P5 冒烟证据面代表性（round-16 发现）——本轮修复并部署，进球庆祝视觉证据恢复在链
- round-11 遗留缺口②（实局进球庆祝线上实拍未捕获）——本轮收口（线上实拍达成）

## 改动

- 无新增源码改动（IP-P5 已随 round-16 提交 799d06e；本轮为部署与证据收口轮）

## 复玩对比

- 比上一版更好（保留）：冒烟证据面 0:0/2 射门（v15）→ 2:0 进球庆祝在链（v16）；线上交互面 switchCount 保持基线 1/4~1/2 水平；门禁全绿
- 本打磨周期三轮读数链：switchCount 82/44.4s（v14 基线）→ 34/42.5s（r16 本地 IP-P1+IP-P3）→ 19/40.6s（v15 线上）→ 36/42.9s（v16 线上复测，方差带内稳定）；内核 maxHoldSecMean 11.2→15.8s（+37%）
