# 打磨收尾摘要：《实况足球》GOAL RUSH v2 重跑 · 打磨轮（round-6/7/8/9，2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；收尾 HEAD=d8d8a6c（v8 部署 commitHash 全等）
- 上游事实源：策划案 v2（cmwbl64r10082m97atgikgm0o）；仓内镜像 `games/myrdplaygrou-3/.myrd/spec/design-spec.json`（v2Delta 三项 + 12 条验收）
- 改进点清单出处：qa/ 既有证据（playtest-summary.json rounds 1-5 / qa/smoke / qa/experience 双视口取证包 / qa/mobile 门禁）逐条整理为 IP-1/2/3

## 改进点 → 改动 → 结论对照表

| IP | 玩家可感问题（证据出处） | 改动（轮次/提交） | 结论 |
|---|---|---|---|
| IP-1 桌面横向视口取景空旷 | 桌面 1280×720 球场只占中段 ~40% 屏宽、两侧大片空带、球员过小（qa/smoke/smoke-desktop.png 改前版 + qa/experience desktop 04 步） | followCamera 按 aspect 分段插值（竖屏端点不动/横屏收近压低，round-6/bdb31c3） | 桌面取景占满画幅、球员读数 ~2.2×；drawCalls 201→182（视锥剔除）；**移动端逐字节零漂移**（139,832B=139,832B，ratchet title 1.0 实证竖屏端点不变） |
| IP-2 球门无网、射门目标辨识弱 | 球门只有两柱一梁灰白线框，远看像场地标线（round-6 后 smoke-desktop + experience 02 初始画面） | netTexture 程序化网格贴图 + 三面网装配（背/顶/双侧 ×2 门，round-7/6c9aa39） | 实局帧球门「白柱+横梁+半透明网格」完整结构可辨（round7-goal-net-approach.png）；drawCalls 182→208 预算内；进球判定零触碰 |
| IP-3 进球瞬间缺画面爆点 | 进球=横幅+音效两项反馈，画面无爆点（main.js handleEvents 代码面 + 实局观察）；进球瞬间相机被开球重置立即拽离门区（观感缺陷） | celebrate.js 彩带粒子池（Points 单 drawCall/空闲零绘制）+ FOV 冲击 + 进球特写机位（goalHold 2.2s 锁门）+ 冒烟快进补 handleEvents（round-8/d8d8a6c） | `?smoke=69` 确定性取证：横幅+特写门+网窝+彩带四要素同框（双视口，2:0@22s 与内核仿真 s=60/68 全等）；线上实局实证特写机位生效（round9-live-goal-hold-net.png 门后机位看网窝）；庆祝画面从 2 通道 → 5 通道 |
| 伴生：帧率余量刀口 | mobile fps 在门禁线（≥10）附近抖动；受控 A/B 锚定环境负载为主因（无新改动同负载 9.4 FAIL） | Bloom 1/4→1/8（低频辉光视觉无损，全屏 pass 像素 ↓75%，round-8） | 负载 17.1 下双视口 10.3/10.5 PASS；后段复跑 16/14.7（负载回落） |

## 轮次索引（qa/playtest/round-N.md，机器可解析段协议齐全）

- round-6（bdb31c3）：IP-1 相机宽高比自适应 + 冒烟截图补真实跟屏相机 · 截图 4
- round-7（6c9aa39）：IP-2 球门三面网 · 截图 3
- round-8（d8d8a6c）：IP-3 粒子/FOV/特写机位 + Bloom 余量 · 截图 4
- round-9（本轮）：v8 部署上线 + 线上实局验证（源码零改动）· 截图 5

## 收尾门禁与证据

- 构建：SRC_SHA 单文件 594,717 字节 ×2（index.html = landing.html，STAGE PASS 逐字节一致）
- tests/run-all：7/7 PASS（方向语义/实况契约/确定性/状态机/单文件/冒烟payload/构建复现）
- preflight：PASS（21 项 0 WARN）
- browser-smoke（本地构建，双视口 62s 快进）：PASS——inputProbe.ok=true（leftDx=-1.8/rightDx=+1.8/upDz<0/downDz>0，**sf-bug-controls 方向断言**）+ playersOnField=10/teams=2（**多球员断言**）+ exceptions=0/consoleErrors=0
- 部署：v8=cmwbtonx4001cm9dzws5myo5z（504 受理→running 在服，commitHash=d8d8a6c）；线上 GET / 200=594,717B 与 dist/web/index.html 逐字节一致（cmp）；/health 200
- 线上 mobile-web-smoke：PASS（触摸管线/响应 pass、音频解锁契约 pass、FPS≥8 pass；1 WARN=摇杆热区 --project 未传，合法降级仅取证）
- playtest-summary：**valid=false，唯一缺口 C4**（平台级判定器间 schema 漂移：mobile-web-smoke.mjs:87-92 写 checks={id,label,status,detail}、playtest-summary.mjs:211-214 读 c.name/c.pass——两判定器红线禁改；原始证据在档：qa/mobile/report.json touch-pipeline=pass/touch-response=pass，交互可达性另证=线上 __tsState 探针全量状态 + 冒烟 inputProbe.ok=true）。其余 C1/C2/C3/C5/C6 全绿：rounds=9、screenshots=29、consoleErrors=0
- visual-ratchet（advisory）：**OK**——v7→v8 线上移动配对 2 对 0 回归（title 1.0 / 摇杆 0.75 ≥0.7）；桌面取景重构为 round-6 刻意重设计（报告历史条目在档）

## 如实透出的缺口

1. playtest-summary C4 恒 FAIL（平台级 schema 漂移，两判定器红线禁改）——op=playtest_summary 按「缺口无法补齐」纪律回写 autoPassSuggested=false + 完整归因。
2. 实局进球庆祝抓拍 3 次因轮询延迟错过特写窗（round8-live-goal-capture-late.png 留痕）；特写窗已延至 2.2s 且线上实证机位生效，粒子瞬间的实局帧以确定性冒烟取证（?smoke=69）为准。
3. 平台 spec v2 levels 2~5 关卡递进未实现（round-5 既有披露，维持：本轮可玩面=90s 5v5 单局 level-1 语义）；用户四问试玩量表仍未回填（requestKey=playtest_cmwaqvrng002lm9m2nftdd20h 已发未答，不重发不代答）。
