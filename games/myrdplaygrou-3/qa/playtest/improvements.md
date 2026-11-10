# 打磨轮具名改进点清单（polish 节点 · 2026-11-11）

## 证据状态声明

- **试玩结论（用户打分卡）**：上一 playtest 节点已发打分卡（requestKey=playtest_cmwaqvrng002lm9m2nftdd20h，
  messageId=cmwaxyy11002ym97agrrhqrn9），截至本节点收口**未收到回填**（平台无 GET 通道可轮询，
  上一节点已注记「不轮询空等」）。本清单**不含任何「好玩」类人工结论**——全部改进点来自
  机器取证与画面信号，标注「无试玩结论，取证自查」。
- **证据源**（均已亲读）：
  - E1 = `games/myrdplaygrou-3/qa/experience/2026-11-10T16-52-47-deploy/`（部署取证包：8 步截图
    + 322 帧 + console/errors.json 空 + fps-series；对线上 deploymentId=cmwax345r002km97avs9jgvxa，
    gitRef=@88b7469，与本地构建字节级一致）
  - E2 = `games/myrdplaygrou-3/qa/smoke/report.json`（62s 双视口冒烟 PASS：desktop fps16.4 /
    mobile fps14.2、exceptions=0；终局读数 score=340 goals=3/3 shots=4 collected=8/10 timeLeft=81.1）
  - E3 = 判定器读数 `std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs:416`（audio-unlock
    硬检查要求 `window.__audioDebug` 为 function）+ 对照 PASS 样本 `qa/mobile/report.json`
    （同族游戏 myrdplaygrou 11 项检查全 pass）
  - E4 = `games/myrdplaygrou-3/qa/playtest/playtest-node.md`（上一节点注记：未搭 ?tuning 桥、
    内核无页面侧快照钩子）

## 具名改进点（每条：玩家可感问题 + 证据出处）

| id | 玩家可感问题 | 出处 | 归属轮次 |
|---|---|---|---|
| IP1 | 纵深感缺失：近垂直俯视（俯角≈84°），开球→中场全部取证帧里球门/横梁/守门员不入画，「3D 实况足球」的目标物全程缺席，射门虚线贴画面上缘 | E1 steps/04-摇杆区滑动.png、video/frames/0130.jpg（上缘止于 z≈8） | 轮 1 |
| IP2 | 构图浪费：竖屏画幅底部 ≈20% 是场外深绿空带（apron），画面重心偏低 | E1 steps/04、frames/0260.jpg | 轮 1 |
| IP3 | 带球时足球不可读：球贴玩家侧后 + 玩家底部蓝色光晕（scale 2.2，半径 1.1m）加性混色把球染进光斑，取证帧里球几乎不可见 | E1 steps/04-摇杆区滑动.png | 轮 1 |
| IP4 | 金币辨识度弱：近垂直俯视下金币呈细短橙条（躺倒薄圆柱），不像「金币」；收集瞬间无视觉反馈（仅音效+HUD 数字跳变） | E1 frames/0130.jpg、0260.jpg | 轮 2 |
| IP5 | 进球/扑救无画面爆点：goal/save 仅顶部横幅+音效，画面零庆祝/零闪光，正反馈单薄 | E1 pack.json 8 步全响应无视觉反馈帧 + src/render/hud.js 事件路径 | 轮 3 |
| IP6 | Title 屏说明行孤字换行：「金币捡到即补」的「补」字孤行（max-width 340px 过窄） | E1 steps/02-初始画面.png | 轮 2 |
| IP7 | 移动门禁音频契约缺位：`window.__audioDebug` 不存在 → mobile-web-smoke audio-unlock 硬检查必 FAIL（音频静默类故障移动端不可诊断） | E3 判定器 :416 + 对照样本 qa/mobile/report.json | 轮 3 |
| IP8 | 内核状态不可观测：页面无内核快照钩子，sessiond probe 拿不到确定性状态，跨轮快照 diff 只能靠 ?smoke 载荷 | E4 playtest-node.md 注记 + src/main.js 仅 ?smoke 协议 | 轮 2 |
| IP9 | **操控方向与相机倒置（高优先级）**：上推摇杆/按 W，球员向画面下方（本方底线）跑，与「画面上方=进攻方向」的相机几何完全相反，射门操作要反着拉——触屏新玩家第一分钟必然困惑 | E5=round-0 基线取证 live-02→live-04（上推×4 后球员抵本方底线贴白线）+ src/render/touch.js:13 注释「屏幕上推 = -Z（远离相机）」与 src/render/scene.js cameraPose（机位在玩家 -Z 侧、视线朝 +Z）矛盾；键盘 main.js keyboardIntent 同映射 | 轮 1 |

## 数值改动通道声明

- 轮 1 的 `CAM_AHEAD 2.7 → 8`：numeric.js 手感类参数（注释原文「手感类，需试玩校准」），平台
  spec v1（cmwarhr9y000zm9ri2yf159t2）numeric 段**未登记任何 CAM_*键**（亲查 GET
  /api/v1/game-design-specs/cmwarhr9y000zm9ri2yf159t2，numeric 仅 ball/defender/difficulty/
  goalkeeper/match/palette/player 八组），不属 spec.numeric 定稿数值 → 走 numeric.js 通道合法。
- **玩法平衡数值本轮一律不动**（PLAYER_SPEED/KEEPER_*/GOALS_TO_WIN/ROUND_SECONDS/COIN_* 等）：
  无用户试玩回填依据，不凭空调难度；?smoke 载荷的确定性字段（score/goals/shots/collected/
  timeLeft）跨轮必须逐位一致，作为「只改表现层、没碰内核」的回归绊线。

## 轮次分配

- 轮 0：基线取证（无改动）——固定动作序列 ×2 条路（?smoke 确定性回放 + liveUrl 交互序列）
- 轮 1：IP9 + IP1 + IP2 + IP3（方向对齐相机；相机重取景 CAM_AHEAD → 纵深/构图；光晕收口 → 球可读）
- 轮 2：IP4 + IP6 + IP8（金币立体化 + 收集飘字底座；title 文案；__footballProbe 钩子）
- 轮 3：IP5 + IP7（进球门区脉冲/扑救白闪；__audioDebug 音频契约）
