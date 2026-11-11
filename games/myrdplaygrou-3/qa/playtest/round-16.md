# round-16：v15 线上验证 + 冒烟证据面回归发现（改→玩→看 第 2 轮，2026-11-11）

- 分支 `myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；v15 = cmwc4zm8z002tm9bhray3nnyo（commitHash=c27629b=推送 HEAD，线上 607,060B 与 dist 逐字节一致，sha16=d41457e4）
- 本轮动作：部署 v15 → 线上 SEQ-P 复玩 → ?smoke=69 取证 → **发现仪器面回归** → 归因 → IP-P5 修复（改动在 round-17 落地部署 v16）

## 观察

- **IP-P1 线上终验**：v15 线上 SEQ-P 同窗探针 `switchCount=19/40.6s`（r16b）——对比 v14 线上基线 `82/44.4s`（r14b），同序列同窗 **-75%**；终局探针 ballOwner=2=受控人自己拿球（传球接收→控制权跟人，新离散切换路径在线上在链）。
- **回归发现（如实暴露）**：v15 线上 `?smoke=69` payload = **score 0:0 / goals 0 / shots 2**——旧版同参数有进球横幅取证面（v14 qa/smoke-mobile.png）。归因：冒烟协议意图重算粒度 1s（块首一次），IP-P1 控制权稳定化后「逐帧抢切换」不再是 1Hz autopilot 的免费外挂——同 seed 同语义对照实验：旧内核 10 射门 1 球（1:0，58~66s 窗口）vs 新内核 2 射门 0 球。真人通道不受影响：60Hz 意图模拟下新内核 9 球/22 射门（旧内核 60Hz 口径 9.2 球/22.2 射门，持平）；内核契约 8 用例 + 全门禁绿。定性 = **仪器面回归**（冒烟证据面的对局活力代表性），非玩家可感回归。
- v15 线上 /health 200；页内教学卡/常驻标签/单环在链（browser-smoke payload onboarding/switchRing 断言全过）。

## 动作

- POST deployments（manifestPath=games/myrdplaygrou-3/apphost.toml，v14 判例姿势）→ 504 受理 → 轮询 v15=cmwc4zm8z002tm9bhray3nnyo running @ c27629b（单笔受理核对）
- 线上逐字节复证：GET / 200 = 607,060B，cmp dist/web/index.html 逐字节一致
- SEQ-P 线上复玩（r16b：截图×2 即时拷贝 + 中途/终局探针）
- 线上 ?smoke=69 取证 → 发现 score 0:0 → 内核对照实验定位回归 → IP-P5 修复（main.js 冒烟意图粒度 1s→0.1s，游戏侧协议参数）→ 全门禁复跑绿 → 提交 799d06e（+94a6648 清理归因用临时文件 world-old-tmp.js）

## 截图

- qa/playtest/steps/r16b-016-live-v15.png v15 线上实局：两处小组对抗、球与控制环清晰可读
- qa/playtest/steps/r16b-028-live-v15-final.png v15 线上同窗终态：受控人持球、阵型松散度优于基线人堆

## 改进点

- IP-P5 冒烟证据面代表性（本轮发现并归因，round-17 修复）：冒烟协议是 qa/smoke 取证与 celebration 视觉证据的确定性来源，1Hz 意图下进球/庆祝事件近乎消失 = 证据面失真

## 改动

- src/main.js 冒烟快进循环：0.1s 块 ×10 意图重算（零内核/零门禁改动）；归因实验临时文件已清理

## 复玩对比

- 线上 switchCount：v14 82/44.4s → v15 19/40.6s（-75%，IP-P1 保持成立）
- 冒烟证据面：v15 0:0/2 射门 → IP-P5 后见 round-17（恢复进球/庆祝在链）
