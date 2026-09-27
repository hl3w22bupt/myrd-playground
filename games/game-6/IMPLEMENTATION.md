# 《复刻天天酷跑》实现节点交付说明（[CHECKPOINT]）

> 工程目录 `games/game-6`（Godot 4.3 · GDScript 2.0 · Web 导出目标）
> 需求基线：cmuj6vls40010m9hcmj2lscuh ｜ 策划案：cmuj78cxu0017m9hc6fixc96i（v1 approved，`.myrd/spec/design-spec.json`）
> 实现分支：`myrd/game-6-goal-cmuj6p1q2000em9hc4srodpkt`（见文末「部署侧注意事项 1」）

## 一、门禁结果（与门禁同源命令，2026-09-27 本机实测）

| 步骤 | 命令（同源） | 结果 |
|---|---|---|
| godot-availability | `bash std-skills/godot-game-dev/scripts/resolve-godot.sh` | OK（Godot 4.3.stable） |
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-6` | **PASS**（13 类，57 文件），退出码 0 |
| headless-smoke | `GODOT_SMOKE_FRAMES=320 … smoke.sh games/game-6` | **GODOT_SMOKE: PASS**，退出码 0，日志无脚本错误 |
| input-fuzz | `… input-fuzz.sh games/game-6` | **GODOT_FUZZ: PASS**（seed=20260913），退出码 0 |
| playtest | `… playtest.sh games/game-6` | **环境缺口，见文末「环境缺口 1」** |

帧预算：冒烟阶段流需 ~290 物理帧，`.myrd/routines.yaml` 的 `godot-smoke.params.smokeFrames` 与 `games/game-6/verify.sh` 已同步调为 **320**（模板明示的每工程参数，两处同值）。

## 二、实现范围（对照需求与 spec）

- **核心循环**：自动奔跑 + 跳跃/二段跳 + 滑铲；碰撞/坠坑死亡 → 弹飞 + 慢动作 0.3s → 结算页 → 一键重开（按钮 / R / 确认键，无重启加载）。
- **操作双通道**（acc-01）：键盘 ↑/W/空格=跳跃（二段跳封顶）、↓/S=滑铲、R=重开；触屏点按/上滑=跳跃、下滑=滑铲（`touch_swipe.gd` 只生产 InputMap 动作，右下跳跃按钮保留）。
- **程序化赛道**（acc-03）：`chunk_defs.gd` 逐元素固化 spec l1/l2/l3 三预制件（含元素 id），`track_builder.gd` 按距离权重抽取、9 实例对象池循环复位（只实例化 levels 声明的 3 个场景）；速度曲线 v(m)=320+0.3m（封顶 720）。
- **收集与道具**（acc-04）：金币成串/成弧线；磁铁（8s/200px 吸附）、护盾（挡 1 次+1s 无敌帧）、冲刺坐骑（4s×1.8 倍速无敌碾怪 +30 分）——数值全部走 `game_state.gd` 调参区。
- **结算与成长**（acc-05/06）：得分 = ⌊距离⌋×2 + 金币×10 + 碾怪×30；结算页展示距离/金币/得分/最高分/累计金币/最远距离；ConfigFile 存 `bestScore/totalCoins/bestDistance`（key=game6_save_v1）。
- **表现**：Q 版几何角色跑/跳/滑/死姿态动画、三层视差（云 0.1x/山 0.2x/街区 0.5x）、金币拾取飘字 +10、道具/碾怪/破盾反馈（HUD 飘字，订阅 `GameState.feedback`）；UI 全部独立 CanvasLayer（Hud layer=5 / Overlay 6 / TouchUI 10），中文文案走全局内嵌字体（未动字体与 `[gui] theme/custom_font`）。

## 三、冒烟断言 ↔ 验收标准映射

`tests/smoke.gd` 阶段流：噪声相位（确定种子对抗输入）→ 负向局（不输入撞怪判负）→ 按钮信号链重开清零 → 正向局（越障/延迟实测/二段跳封顶/滑铲时长/磁铁吸附/护盾破盾/冲刺碾怪/坠坑结算）→ 8 契约全量。

| 验收 | 机判落点 |
|---|---|
| 1 操作与手感 | `input_contract`（InputMap+键位逐键+零 KEY_ 扫描+触屏节点）、`input_latency_contract`（实测 ≤3 帧）、冒烟噪声相位 |
| 2 赛道与难度 | `track_passability_contract`：布局四硬约束机判 + **10 固定种子（1..10）机器人实跑 ≥1000m**（时间轴判定：决策窗 ≥0.2s、坑宽 < 当地速度单跳距离、落地缓冲，与游戏物理同源常量）；速度/密度爬升由 `GameState.chunk_weights_for_distance` + 生成器实测 |
| 3 收集与道具 | `powerup_contract`（数值=spec.numeric + 冒烟实测吸附/破盾/碾怪计分）、`score_settle_contract`（金币账实一致：run_ended 携带值 == 实际拾取） |
| 4 死亡与结算 | 冒烟负向局（撞怪 hazard）+ 坠坑（fall）双死因 + 结算页展示 + 重开即时清零 |
| 5 数据持久化 | `save_contract`（写→改→重载回环 + end_run 落盘路径，测试后恢复原档） |
| 调参协议 | `tuning_contract`（TUNING_META 键集 == spec.numeric 39 键；apply_tuning 生效/钳制/拒绝） |

新增玩法面均有新断言覆盖；正例（跳跃/收集/道具）与负例（撞怪/坠坑/未达预算）双向可拦。

## 四、关键推导（碰撞包络余量，注释与常量一致）

- 低飞怪盒 56×88、中心 hover_y：hover_y=96 → 盒离地 [52,140]：站立顶 64 必撞、滑铲顶 36 必过、单跳顶点盒底 168.75 可越；hover_y=208 → [164,252]：贴地过、单跳撞、二段跳 308.75 越（spec §四语义逐条吻合）。
- 坑宽上限 192 < 最低速单跳水平距离 320×0.75=240（裕度 20%）；满速决策窗 224/720=0.311s > 输入预算 0.15s。
- 冒烟起跳线 380：落地 620 > 障碍右沿 592（裕度 28px）；二段跳测试在滞空前段完成，滑铲结束点与低飞怪的暴露帧由冲刺无敌帧罩住。

## 五、遗留与移交

1. **环境缺口（上报运维）**：模板仓库 `std-skills/godot-game-dev/scripts/` 未预置 `playtest.sh`（及配套 `playtest_driver.gd`），本节点无法跑机器人试玩门禁；注入目录 `.myrd-platform/.claude/skills/` 里有新版脚本但属阅读副本，未按规范用作判定器。请运维把模板仓库技能资产补齐到与注入目录同版本，后续节点再挂 playtest 步。因无 playtest，`Juice` 单例/SFX 银行未接入（fail-closed 口径），反馈走工程内 `GameState.feedback` + HUD 飘字。
2. **spec 口径备注**：`pitLandingBufferPx` 的「落地缓冲」按策划案 §四算术采用「坑右沿 → 下一威胁点中心」（l3：500−372=128）；若按威胁盒左沿算 l3/e3 处为 96。建议策划案下次修订时把口径写明。
3. **部署侧注意事项**：① 远端实际分支名为 `myrd/game-6-goal-cmuj6p1q2000em9hc4srodpkt`（任务文本中的 `myrd/games-goal-…` 在远端不存在，goal id 一致，命名符合 game-2..6 惯例），部署 gitRef 请用它，勿用 main；② 门禁 `godot-smoke` 的 `params.gamePath` 已指向 `games/game-6`、`smokeFrames=320`。
4. 真机 FPS 记录（acc-08 人工项：中端机 ≥30FPS）与 iOS Safari 取证留待试玩/部署节点回填 `games/game-6/qa/`。

---

# 迭代交付说明 v2：磁吸/冲刺全链路可见 + 主角美术精美化（需求 cmujj72du0016m99irdzh37qt）

## 〇、根因排查（需求前置项：道具为什么「没刷出来」）

1. **道具盒没有碰撞形状（致命）**：三个 powerup_*.tscn 声明了 `CircleShape2D_pickup` 子资源但
   没有任何节点引用它 —— Area2D 无形状永不触发 `body_entered`，玩家跑过道具毫无反应。
   旧冒烟直调 `apply_powerup` 从未走过真实拾取链，因此门禁没有拦住。已补 CollisionShape2D 修复，
   并把冒烟 MAGNET 步骤改为「真实道具盒压到玩家身上碰撞拾取」，负例探针实测可拦（注释掉碰撞
   形状 → `GODOT_SMOKE: FAIL 磁铁…吸附失效`，还原复绿）。
2. **出生点压在首格道具盒上**：拾取修好后暴露 —— 出生 (140,268) 与 l1/e2 道具盒（圆心 120,254、
   r22）天生重叠，每局第 1 帧白捡一个随机道具（捡到护盾/冲刺会破坏负向局确定性）。
   出生点右移到 (190,268)，首格道具盒不再被白捡。
3. **生成池种类锁死**：`chunk_base._build_powerup` 用 `randi()%3` 在首次 build 定死种类，
   对象池复位不复掷 → 池内 9 个 chunk 实例的种类整局不变，磁铁/冲刺可能整局不出。
   现改为 track_builder 每次铺设用局种子 rng 重掷（`GameState.POWERUP_KIND_WEIGHTS`：
   磁铁 0.40 / 冲刺 0.35 / 护盾 0.25，可复核；不进 TUNING_META，39 键契约保持与 spec.numeric 一致）。
   l3 段无道具点位属 spec levels 固化（契约逐项机判），不动 spec，靠重掷分布保证可感知频率。

## 一、迭代实现范围

- **拾取反馈三件套**（迭代需求 ①）：`FxBank.flash`（扩散光环+六向星火，纯代码节点）+
  `SfxBank.play`（AudioStreamWAV 运行时合成：coin/powerup/shield/dash/smash/death 六音，
  零二进制资产，headless 安全）+ HUD 道具槽点亮（hud.tscn PowerupBar + hud.gd 代码拼装三槽位，
  熄→亮弹跳 + 倒计时字）。三者由同一次 `PickupBox.collect` 触发。
- **生效期表现**：`player_fx.gd`（PlayerFx）—— 磁吸期旋转虚线光圈（∝ magnetRadiusPx，呼吸脉动）、
  冲刺期身后速度线组 + 渐隐拖影；visible 直接由计时器驱动，归零当帧与增益同步消失
  （player 到期补发 `powerup_changed(kind, 0)`）。金币吸附计分链路不变（coin.gd）。
- **场上辨识**（迭代需求 ①）：三道具独立剪影（磁铁马蹄 U / 护盾盾形 / 冲刺闪电）+ 描边层 +
  呼吸光环 + 出场弹跳；与金币（小金圆+高光）一眼区分。
- **主角美术**（迭代需求 ②）：`player_art.gd`（PlayerArt）多部件卡通角色（橙卫衣×蓝短裤×肤色脸
  ×红发带+飘带，全部部件带深色描边层与半透明高光块），帧表驱动：跑步 8 帧（帧率随移速）、
  跳跃 3 姿态（升/顶/落）、滑铲滚动 6 帧；player.tscn 移除三个占位多边形节点。
- **场景提亮**（迭代需求 ②）：chunk 三主题地形提亮一档（夜段→亮暮色）、金币加白高光块、
  障碍/翅膀提亮、三层视差（云/山/街区+屋顶）提亮；视差滚动逻辑未动。

## 二、门禁结果（与门禁同源命令，2026-09-27 本机实测）

| 步骤 | 结果 |
|---|---|
| preflight | **PASS**（13 类，64 文件） |
| headless-smoke（320 帧） | **GODOT_SMOKE: PASS**（10 契约：原 8 + powerup_pool + feedback） |
| input-fuzz | **GODOT_FUZZ: PASS**（seed=20260913） |
| playtest | 环境缺口不变（模板仓库仍未预置 `playtest.sh`，见 v1「环境缺口 1」，未伪造结果） |

新增契约：`powerup_pool_contract`（权重可复核/seeded 分布/同实例重掷可变/chunk 接线四断言，
含「种类锁死」负例语义）、`feedback_contract`（拾取闪光+音效+HUD 点亮+光圈/拖尾+归零同步熄灭
六证据 + FxBank/SfxBank 银行本体断言）。帧预算 290→305（EXPIRE 步骤 +5 帧，仍 < 门禁 320）。

## 三、遗留

1. playtest.sh 模板缺口未闭合（延续 v1 上报，请运维补齐模板仓库技能资产）。
2. `GameState.powerup_changed` 信号目前仅 player 侧同名信号在用，autoload 上的定义暂无发布方
   （历史遗留，未删以免破坏潜在订阅；后续如接 Juice 单例再统一）。

---

# 迭代交付说明 v3：复核轮实机取证揪出两个潜伏缺陷并修复（本轮 run）

> 本轮以上一轮（v2）产物为基线做独立复核：三门禁复跑全绿后，用「离屏逐帧抓帧 +
> PNG 像素取证 + 临时物理探针」对线上同版画面做实测，发现两个 v2 门禁没拦住的缺陷，
> 修复后断言同步升级（负例探针验证「拦得住」、修复复跑验证「不误报」）。

## 一、缺陷 ①：每局开屏「幽灵拾取」白捡随机道具（迭代需求 ① 根因的残留形态）

- **实机取证**：无输入开局 0.1s（距离 1m）HUD「冲 4.0s」点亮 +「冲刺！」飘字 + 速度线；
  下一局开屏则变成磁铁 8s。玩家没碰到任何道具。
- **物理探针**：`body_entered` 在 physics frame=2 触发，此时玩家 (195.3, 267.9) 与道具圆心
  (120, 254) 相距 **76.6px**（圆 r22 + 玩家半宽 22 = 最大接触距离 44px）—— 形状不相交仍发事件。
- **根因**：`main.tscn` 玩家**场景授权位 (140,268)** 落在首个道具圆（世界 x∈[98,142]）内；
  v2 只把 `PLAYER_SPAWN` 常量改到 190、没改场景授权位。物理服务端对「同帧授权位置入树 +
  _ready 传送」的配对状态同步滞后 1~2 步，过期的重叠配对在玩家跑开后才补发事件。
- **修复**：场景授权位对齐出生点 (190,268) —— 任何时刻形状都不相交，配对无从建立。
- **断言升级**：`tests/smoke.gd` 新增 `_check_no_phantom_pickup`（开局噪声局 + 负向局全程
  不允许任何道具状态 > 0）。**负例探针**：把 main.tscn 临时改回 140 → 冒烟以
  `FAIL 负向局未拾取任何道具却出现道具状态（幽灵拾取/出生点压盒回归）：magnet=8.00 … frame=2`
  精确签名 FAIL；还原 190 → 复绿 PASS。

## 二、缺陷 ②：主角躯干被「错位的头部描边层」盖成暗棕团（迭代需求 ② 美术缺陷）

- **实机取证**：帧像素直方图显示躯干区域主色是 `(96,52,21)` —— 恰为 OUTLINE(0.28,0.18,0.12)
  × 冲刺调制 (1.35,1.15,0.7) 的精确匹配；橙卫衣主色 `(255,182,45)` 一像素都不存在。
- **探针实验**：把描边层临时染成半透明绿重渲染 → 整块躯干暗影随描边层变绿，
  证明暗团 = 错位的描边层本体。
- **根因**：`PlayerArt._build_block` 只把位移设在了**返回的填充层**上，描边层留在 holder
  原点 —— 头部描边圆（r≈16.6 深色）整个叠在躯干 z=0 的橙卫衣上把它盖死；发带/头发描边同病。
- **修复**：`_build_block` 增加 `at` 参数，位移统一落在 holder（描边+填充的共同父节点）；
  头部锚点固化为 `HEAD_POS` 常量，眼睛/高光/发带/头发全部从它派生。
- **断言升级**：`player_move_contract` 新增美术结构断言 —— 遍历 Art 层每个 Outline 节点，
  其局部位移必须与同 holder 的 Main 一致（错位即 FAIL），并要求描边层数 ≥6。

## 三、门禁结果（与门禁同源命令，2026-09-27 本机实测）

| 步骤 | 结果 |
|---|---|
| preflight | **PASS**（13 类，76 文件） |
| headless-smoke（320 帧） | **GODOT_SMOKE: PASS**（10 契约全过 + 新增幽灵拾取回归断言每局把关；美术结构断言并入 player_move_contract） |
| 负例探针（幽灵拾取） | main.tscn 改回 140 → FAIL（签名见上）→ 还原复绿 |
| input-fuzz | **GODOT_FUZZ: PASS**（seed=20260913） |
| playtest | 模板仓库仍缺 `playtest.sh`（延续 v1 上报，未伪造结果） |

## 四、视觉取证（离屏抓帧）

- 开局帧（距离 1m）：HUD 三槽全灭、无飘字 —— 幽灵拾取消失；闪电道具盒带呼吸光环留在身后。
- 角色特写：棕发 + 红发带 + 肤色脸 + 眼睛高光 + **橙色卫衣（描边+高光可读）** + 蓝短裤 + 白鞋。
- 无输入负向局 ~100 帧撞怪 → 慢动作 → 结算页 → 一键重开，链路完好。

## 五、迭代 v3 部署与回写（本轮收口）

- 重导出：`index.pck` 2677200 字节（sha256 `c1cd0342…`），Web 红线不变（nothreads + gl_compatibility）。
- 部署：`cmujm2j2d002am99iv7qtd572`（v6）@ commit `50e90df`，分支 `myrd/games-goal-cmuj6p1q2000em9hc4srodpkt`，
  liveUrl `https://leomac-studio.tail49399e.ts.net/apps/game-6/`，HostedApp `cmuj6p1py000cm9hcmqje9khr`。
- 线上核验：`/health` 200；线上 pck 与本地 HEAD 导出逐字节一致。
- 过程性冗余 v4/v5（同 commit）已被 v6 superseded。
