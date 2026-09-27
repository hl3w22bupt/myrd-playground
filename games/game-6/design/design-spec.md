# 《复刻天天酷跑》玩法调研与 MVP 策划案

> 需求基线：《复刻天天酷跑（game-6 休闲收集跑酷）》（id=cmuj6vls40010m9hcmj2lscuh）
> 结构化单一事实源：`.myrd/spec/design-spec.json` = 平台策划案 `cmuj78cxu0017m9hc6fixc96i`（v1，approved，schemaVersion v0）
> 工程：`games/game-6`（Godot 4 · Web 导出 · AppHost liveUrl `/apps/game-6`）
> 版本 v1.0 ｜ 2026-09-27 ｜ 状态：已拍板（数值改动必须走 revisions API 产生新版本，禁止只改代码默认值）

---

## 一、调研：天天酷跑核心循环拆解

对照原作（腾讯天美，2013-09 上线）拆出 6 层循环，并标注 MVP 取舍依据：

| 层 | 原作机制 | 对本作的价值 | MVP 取舍 |
|---|---|---|---|
| L1 操作层 | 自动奔跑 + 跳跃/二段跳（部分角色多段跳）/滑铲（滑翔） | 全部手感来源，缺一不可 | **保留**（二段跳封顶 2 段） |
| L2 即时反馈层 | 金币成串/成弧线、道具（磁铁/护盾/冲刺/变大）、踩怪得分 | 「收集」类型的核心多巴胺 | **保留**，道具收敛为 3 种 |
| L3 单局结构层 | 距离/分数增长、障碍密度与速度随距离爬升、死亡即结算 | 单局节奏与重开冲动 | **保留** |
| L4 结算成长层 | 金币/钻石结算 → 角色、坐骑、宠物、精灵、宝物升级 | 长线留存引擎 | **裁剪**（P2）：无养成也能闭环 |
| L5 社交层 | 好友排行、超越好友奖励、PK | 病毒传播 | **裁剪**（P2）：无账号体系 |
| L6 模式层 | 经典/极速/进击（下滑变攻击 + BOSS）/闯关 | 内容厚度 | **裁剪**（P2）：只做经典单模式 |

**调研结论（直接指导实现）**：
1. 原作粘性来自 L1+L2+L3 的 30–120 秒闭环，与目标「休闲收集跑酷 + 一键重开」一致 —— MVP 只做 L1–L3 即可成立；
2. 原作速度曲线是「慢起步、长尾加速」，玩家在 1000m 前感受不到压迫感 —— 本作数值基线按此设计（见 §三）；
3. 原作无必死来自「预制障碍组合」而非纯随机摆放 —— 本作用 **chunk 预制件池 + 距离难度权重** 复刻该保证（见 §四）；
4. 下滑在原作经典模式 = 滑铲（进击模式才是攻击），本作按滑铲实现，语义不冲突。

## 二、MVP 范围

**做（scopeIn）**：自动奔跑；跳跃/二段跳/滑铲（键盘 ↑/空格/↓ + 触屏点按/上滑/下滑双通道）；程序化无限赛道（地面/浮空平台/坑洞/地面障碍/低空与高空飞行怪）；金币成串与成弧线；磁铁/护盾/冲刺 3 道具；结算（距离/金币/得分/最高分）+ 一键重开；最高分、累计金币、最远距离本地持久化；Q 版卡通三层视差 + 拾取动效 + 飘字；`?tuning=1` 数值调参工作台（数值唯一来源 spec.numeric）。

**不做（scopeOut，P2/P3）**：坐骑/宠物/精灵/时装养成；角色与坐骑升级、钻石付费货币；好友排行与分享；进击模式与 BOSS 战；账号与云存档。

**单局与耐玩度预算**：目标单局 sessionTargetSeconds=90（1000m 约需 85–110s，见 §三演算）；重玩钩子 = 最高分追赶 + 道具组合变奏（冲刺期碾怪刷分）+ 难度分段解锁（0/500/1500m 三段新元素）。

## 三、数值基线（spec.numeric 39 键，键名 = `game_state.gd` TUNING_META 键名）

坐标系约定：chunk 内局部坐标以左下角为原点、地面线 y=0、向上为正；`pixelsPerMeter=40`。

### 3.1 速度与难度曲线
| 键 | 值 | 调参区间 (min/max/step) | 依据 |
|---|---|---|---|
| pixelsPerMeter | 40 | 20/80/5 | 1 坑洞宽 ≈ 4.8m，符合跑酷直觉 |
| runSpeedBasePxPerSec | 320 | 240/480/10 | 起步 8 m/s，慢起步（调研结论 2） |
| runSpeedGainPerMeter | 0.3 | 0.1/0.6/0.05 | 500m→470、1000m→620 px/s |
| runSpeedMaxPxPerSec | 720 | 560/960/20 | 封顶 18 m/s，1333m 触顶 |
| chunkWidthPx | 1280 | 960/1920/64 | 32m/chunk，≈2.7s 满速视野 |
| chunkSafetyMarginPx | 96 | 64/192/16 | chunk 首尾安全区，接缝无瞬时威胁 |

**1000m 用时演算**：v(m)=320+0.3m px/s ⇒ 8→15.5 m/s，平均 ≈11.75 m/s ⇒ 1000m ≈ 85s；叠加跳跃弧线与坑洞损失，实际 90–110s，与 sessionTargetSeconds=90 对齐。

### 3.2 跳跃与手感
| 键 | 值 | 调参区间 | 演算 |
|---|---|---|---|
| gravityPxPerSec2 | 2400 | 1800/3600/100 | — |
| jumpVelocityPxPerSec | -900 | -1200/-700/10 | 单跳高度 900²/(2×2400)=168.75px；滞空 0.75s |
| doubleJumpVelocityPxPerSec | -820 | -1100/-650/10 | 累计高度 ≈308.8px；二段跳滞空 +0.68s |
| coyoteTimeSeconds | 0.08 | 0/0.2/0.01 | 离台宽容 |
| jumpBufferSeconds | 0.1 | 0/0.25/0.01 | 落地前预输入 |
| slideDurationSeconds | 0.6 | 0.3/1.2/0.05 | — |
| hitboxStandWidthPx / HeightPx | 44 / 64 | — | 站立碰撞盒 |
| hitboxSlideHeightPx | 36 | 24/48/2 | 滑铲盒（低于低飞怪 hoverY=96） |
| inputLatencyBudgetFrames | 3 | 2/6/1 | 60FPS 下 50ms ≤ 需求 100ms 上限 |

**可达性校验**：浮空平台顶面 y=150 < 168.75（单跳可上）；平台顶再跳 150+168.75=318.75 > 金币弧顶 280（全额可收）。

### 3.3 赛道可通行性硬约束（无必死的机器判据）
| 键 | 值 | 约束含义 |
|---|---|---|
| pitWidthMinPx / MaxPx | 96 / 192 | 坑宽上限 192 < 最低速单跳水平距离 320×0.75=240px（裕度 20%） |
| pitLandingBufferPx | 128 | 坑沿到下一威胁的最小距离（落地缓冲） |
| reactionGapMinPx | 224 | 相邻威胁点最小间距 ⇒ 满速 720px/s 下 ≥0.31s 决策窗 |
| chunkSafetyMarginPx | 96 | 坑洞/障碍不得进入 chunk 首尾 96px |

以上 4 条由 `track_passability_contract.gd` 对全部 chunk 逐元素机判，另用 10 个固定种子机器人实跑 ≥1000m 验证（acceptance acc-03）。

### 3.4 收集、道具与结算
| 键 | 值 | 调参区间 |
|---|---|---|
| coinValue | 1 | 1/5/1 |
| scorePerMeter / scorePerCoin / scorePerObstacleSmash | 2 / 10 / 30 | — |
| magnetDurationSeconds / magnetRadiusPx | 8 / 200 | 4/16/1、120/320/10 |
| shieldCharges / hurtInvincibleSeconds | 1 / 1.0 | — |
| dashDurationSeconds / dashSpeedMultiplier | 4 / 1.8 | 2/8/0.5、1.2/2.5/0.1 |
| powerupBoxCooldownChunks | 1 | 1/4/1 |
| deathFallPx / deathSlowMotionSeconds | 200 / 0.3 | — |

**得分公式**：`score = ⌊distanceM⌋×2 + coins×10 + smashes×30`。示例：1000m、280 金币、3 次碾怪 ⇒ 2000+2800+90 = **4890 分**。

### 3.5 工程与存档
| 键 | 值 | 说明 |
|---|---|---|
| fpsTarget / fpsFloor | 60 / 30 | 中端设备 ≥30FPS 为硬下限（需求验收 1） |
| sessionTargetSeconds | 90 | 单局时长目标 |
| acceptanceDistanceMeters | 1000 | 机器人实跑验收线 |
| passabilitySampleSeeds | 10 | 固定种子数（1..10） |
| saveKey | "game6_save_v1" | 本地存档键：bestScore / totalCoins / bestDistance |

## 四、关卡（chunk）与生成规则

生成器 `track_builder.gd` 只实例化下列 3 个预制 chunk（可通行性由构造保证），按距离权重抽取并循环回收，实现「程序化 + 无必死」：

| id | 名称 | 距离区间 | 进池权重 | 威胁点布局 |
|---|---|---|---|---|
| l1 | 糖果街区 · 新手段 | 0–500m | 1.0→0.55（1.0 − d/1000） | 障碍×1 + 低飞怪×1，无坑 |
| l2 | 黄昏屋顶 · 提速段 | 500–1500m | clamp((d−300)/700)×0.8 | 坑×1 + 浮空平台 + 障碍×1 + 低飞怪×1 |
| l3 | 夜色高速 · 高强度段 | ≥1500m | clamp((d−1200)/800) | 坑×2 + 障碍×1 + 低飞怪×1 + 过桥金币 |

**逐元素落点（元素 id 即可视化编辑页/契约测试的编号，坐标 = chunk 局部 px）**

- **l1 糖果街区**（`games/game-6/scenes/chunks/chunk_candy_street.tscn`）
  - `l1/e1` ground x=0 w=1280（整段无坑）
  - `l1/e2` powerup_box x=120（开局教学位，三选一）
  - `l1/e3` obstacle_ground x=560 w=64 h=56
  - `l1/e4` coin_arc x=680 起 5 枚 弧顶 y=140（跨过 e3 的奖励）
  - `l1/e5` obstacle_air low x=1040 y=96（滑铲通过）
- **l2 黄昏屋顶**（`games/game-6/scenes/chunks/chunk_dusk_rooftop.tscn`）
  - `l2/e1` ground x=0 w=1280 ｜ `l2/e2` powerup_box x=120
  - `l2/e3` pit x=280 w=160（≤192 ✓，左沿 ≥96 ✓）
  - `l2/e4` platform x=520 y=150 w=240 h=24（单跳 168.75 > 150 可直接跳上）
  - `l2/e5` coin_arc x=540 起 5 枚 弧顶 y=280（站平台再跳收取）
  - `l2/e6` obstacle_ground x=900 ｜ `l2/e7` obstacle_air low x=1140 y=96（与 e6 间距 240 ≥224 ✓）
- **l3 夜色高速**（`games/game-6/scenes/chunks/chunk_night_highway.tscn`）
  - `l3/e1` ground x=0 w=1280
  - `l3/e2` pit x=180 w=192（满速单跳 540px，裕度 348px）
  - `l3/e3` obstacle_ground x=500（距 e2 右沿 128 = 落地缓冲下限 ✓）
  - `l3/e4` obstacle_air low x=800（与 e3 间距 300 ✓）
  - `l3/e5` pit x=1024 w=160（与 e4 间距 224 = 达标下限；右沿 1184 = 接缝安全上限）
  - `l3/e6` coin_line x=1024 y=60 3 枚（悬在坑口上方的过桥奖励）

空中障碍两种参数实例共用 `obstacle_air.tscn`：低空型 hoverY=96（滑铲可过，站立 64 会被撞）与高空型 hoverY=208（贴地跑过、跳跃会撞）；l1–l3 仅使用低空型，高空型留 P2 扩展，实现时以同一场景不同导出参数提供。

## 五、素材清单（美术/音频派生自 world.artDirectives，禁止另编世界观）

| # | 资产 | 落点（相对项目根） | 规格 | 来源与许可 |
|---|---|---|---|---|
| 1 | 角色帧动画（跑×4/跳/二段跳/滑铲/死亡） | `games/game-6/assets/sprites/player/` | 128×128/帧，SpriteFrames | 首选 Kenney CC0 平台包改色；离线则程序化占位（Polygon2D + AnimationPlayer），提示词从 world.character 派生 |
| 2 | 金币旋转 8 帧 | `games/game-6/assets/sprites/coin/` | 64×64/帧 | 同上（色板 coin #FFC93C） |
| 3 | 道具图标 ×3（磁铁/护盾/冲刺） | `games/game-6/assets/sprites/powerups/` | 64×64 | 同上 |
| 4 | 地面障碍 / 飞行怪（低空、高空） | `games/game-6/assets/sprites/hazards/` | 64×56、56×40 | 同上（obstacle #7B5E3B、accent #FF5A5F） |
| 5 | 三主题 chunk 地形块（地面/浮台/坑沿） | `games/game-6/assets/tilesets/` | 128×128 tile | 程序化绘制可接受（ColorRect+圆角），色板见 world.palette |
| 6 | 视差背景 4 层 | `games/game-6/assets/sprites/bg/` | 2048×720 无缝 | 云 0.1x / 糖果山 0.2x / 街区 0.5x / 地面前景 1.0x |
| 7 | 音效 8 条（跳/二段跳/滑铲/金币/道具/破盾/碾怪/死亡） | `games/game-6/assets/audio/sfx/` | WAV/OGG ≤100KB/条 | Kenney CC0 音效包或程序合成 |
| 8 | BGM 循环 1 条 | `games/game-6/assets/audio/bgm/` | OGG 60–90s loop ≤2MB | CC0 旋律，禁止使用受版权保护的天天酷跑原曲 |
| 9 | 中文字体 | `games/game-6/assets/fonts/` | OFL 字体，子集化 ≤200KB | 思源黑体/OFL |
| 10 | 死亡/拾取粒子（星星、金圈、飘字） | 代码内 CPUParticles2D | 无贴图依赖 | 程序化（无资产文件） |

**体量红线（导出后实测回填本节）**：wasm + pck ≤ 40MB；桌面首屏可玩 ≤ 8s、移动 ≤ 15s；实测值由 deploy 节点回填，未实测不得写「符合」。

## 六、验收映射（9 条全部配可执行 check）

| id | 验收点 | check（相对项目根） | 需求映射 |
|---|---|---|---|
| acc-01-input-map | InputMap 动作化，零 KEY_ 常量，键/触屏双通道 | `games/game-6/tests/contracts/input_contract.gd` | 验收 1 |
| acc-02-controls-semantics | 二段跳仅 1 次、滑铲盒 36、coyote/缓冲生效 | `games/game-6/tests/contracts/player_move_contract.gd` | 验收 1 |
| acc-03-track-passability | 4 条硬约束机判 + 10 种子机器人 ≥1000m | `games/game-6/tests/contracts/track_passability_contract.gd` | 验收 2 |
| acc-04-powerups | 三道具效果与 numeric 一致 | `games/game-6/tests/contracts/powerup_contract.gd` | 验收 3 |
| acc-05-score-settle | 得分公式、金币账实一致、一键重开 | `games/game-6/tests/contracts/score_settle_contract.gd` | 验收 3/4 |
| acc-06-persistence | 存档跨会话保留 | `games/game-6/tests/contracts/save_contract.gd` | 验收 5 |
| acc-07-smoke-gate | preflight / smoke（含噪声相位）/ fuzz 门禁 | `std-skills/godot-game-dev/scripts/smoke.sh` | 目标 AC1/2/3 |
| acc-08-feel-budget | 输入延迟 ≤3 帧（自动化）；真机 FPS 回填 qa 记录（人工） | `games/game-6/tests/contracts/input_latency_contract.gd` | 验收 1 |
| acc-09-tuning | TUNING_META 键集 == spec.numeric 键集；apply_tuning 钳制与未知键拒绝 | `games/game-6/tests/contracts/tuning_contract.gd` | 目标 AC8 |

人工项（自动化不可替代，实现/试玩节点回填）：真机 iOS Safari 操作与音效取证归档 `games/game-6/qa/`；中端机 FPS 记录 `games/game-6/qa/device-notes.md`。

## 七、施工红线（下游 implement 节点必读）

1. 落点与 id 以本 spec 为准：entities[].script/scene、levels[].scene、acceptance[].check 声明的路径必须真实建出，元素用 `l1/e3` 这类编号，禁止私改；
2. 数值只认 spec.numeric：`game_state.gd` 常量 + TUNING_META 成对声明，键名与本表 §三 完全一致；改数值 = revisions API 新版本 → 同步代码，禁止两头各改各的；
3. 生成器只允许实例化 levels 声明的 3 个 chunk 场景 —— 新增地形 = 先改 spec 再加 chunk，否则 acc-03 的机判覆盖面被绕过；
4. 逻辑零 KEY_ 常量（键位进 project.godot [input]），键位契约层例外；
5. 障碍/金币/道具一律对象池 + 离屏回收（fpsFloor=30 的硬前提）。

---

*版本 v1.0 ｜ 2026-09-27 ｜ 游戏策划产出，平台策划案 id=cmuj78cxu0017m9hc6fixc96i（v1 approved）。调研来源：公开资料（腾讯官方页/维基/小米社区/4399/18183/百度百科 对天天酷跑玩法与系统的描述），数值基线为本作原创设计值，非原作泄露数值。*
