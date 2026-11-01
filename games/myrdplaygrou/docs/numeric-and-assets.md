# 《植物人大战僵尸-网页版》数值表与资产治理（spec v2）

> 对应策划案契约（spec.numeric / spec.assets，版本 2 approved）的工程内镜像。改数值 = 先改策划案（产生新版本）
> 再同步这里与 `autoload/game_state.gd` 调参区，禁止两头各改各的。

## 1. 内容表（spec.entities / numeric.plants / numeric.zombies）

### 1.1 出战卡（5 张；键位 1-5，造价为卡片绝对值）

| # | id | 名称 | 造价 | 血量 | 行为 | 射击间隔 | 特性 | 布防冷却 |
|---|---|---|---|---|---|---|---|---|
| 1 | sunflower | 阳光花 | 50 | 300 | 生产（25 阳光 / 10s，点按收集） | — | — | 7.5s |
| 2 | peashooter | 豌豆射手 | 100 | 300 | 单发射手 | 1.5s（×1.0） | 伤害 20 | 7.5s |
| 3 | frostpea | 寒冰射手 | 175 | 300 | 单发射手 | 1.5s（×1.0） | 命中冻结：速度 ×0.6，持续 2s | 8.0s |
| 4 | repeater | 双发射手 | 200 | 300 | 双发射手 | 0.75s（×0.5） | 一次两弹 | 8.0s |
| 5 | wallnut | 坚果墙 | 50 | 1200 | 肉盾（不攻击） | — | — | 20.0s |

- 弹丸伤害/速度为全局调参（combat.pea.damage=20 / speedPxPerSec=480），三射手共用。
- 布防成功 = 扣费 + 卡片进入冷却 + 自动取消选卡（spec input.place-plant「放置即消费」）；
  再点已选卡或点已占格位 = 取消选择。阳光不足 / 冷却中 = 禁用态并显示原因。

### 1.2 僵尸（4 类；绝对数值，spec.numeric.zombies）

| id | 名称 | 血量 | 速度 | 识别件（头饰，2px 描边） | 击杀掉落 |
|---|---|---|---|---|---|
| walker | 普通僵尸 | 100 | 18 px/s | 无（浅灰基底） | 15 |
| runner | 疾跑僵尸 | 70 | 36 px/s | 暗红束带 + 前倾姿态 | 20 |
| conehead | 路障僵尸 | 220 | 18 px/s | 橙色三角锥 | 25 |
| buckethead | 铁桶僵尸 | 400 | 14 px/s | 深灰铁桶 | 35 |

- 僵尸四类统一浅灰基底 #bdc3c7，类型识别色只上头饰（对比度规范，见 §4）。
- 啃咬 = 离散节拍：每 1s 一口、每口 30 伤害（combat.bite）；冻结只减速移动不改啃咬节奏。

## 2. 关卡表（波次脚本化，难度平缓递增：相邻关任意一项增幅 ≤ 30%）

| 关卡 | 名称 | 波数 | 总僵尸 | 起始阳光 | 首波延迟 | 波间隔 | 出怪间隔 | 章节 | 编制要点 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 前院晨光 | 4 | 12 | 100 | 15s | 20s | 6.0s | 晨绿 | 单一种类教学（全 walker）：2/3/3/4 |
| 2 | 后院黄昏 | 5 | 15 | 150 | 12s | 18s | 5.5s | 暮橙 | +runner/conehead：3；2+1疾；3+1路；1+1疾；2路+1 |
| 3 | 屋顶夜袭 | 6 | 19 | 200 | 10s | 16s | 5.0s | 夜蓝 | +buckethead：3；2+1疾；2+1路；1+2疾；2路+1桶；1+1+1+1 |

难度增幅核对（上限 30%；加权口径 = 波次编制 × 种类绝对值，机判见 `tests/smoke.gd::_check_level_table`）：
- 波数 +25.0% / +20.0%；僵尸总数 +25.0% / +26.7%
- 加权平均血量 +20.0% / +25.4%（100 → 120 → 150.5）
- 加权平均速度 +13.3% / +4.9%（18 → 20.4 → 21.4）
- 出怪间隔 -8.3% / -9.1%；波间隔 -10.0% / -11.1%；首波延迟 -20.0% / -16.7%
- 种类数 1 → 3 → 4（逐关不减，只增）
- 起始阳光为玩家侧增益补偿，不参与敌方难度增幅校验（spec player.note）

## 3. 阳光经济（v2：只经三途径产出，全部点按收集入账）

| 途径 | 产出 | 说明 |
|---|---|---|
| 天降 | 25 / 12s | 随机格落下，点按收集 |
| 向日葵 | 25 / 10s/株 | 落在生产株脚下，点按收集 |
| 击杀掉落 | 15~35 按种类 | 落在倒地处，点按收集 |

- 拾取物判定半径 44px（触屏友好）；停留 8s 后 2s 淡出消失，无惩罚；收集播 score 音效 + 「+N」飘字。
- 细流（trickle）产出在 v2 废除；score 语义 = 玩家点按收集的阳光总收入。
- 布防扣费唯一入口 `GameState.spend_sun`；阳光不足/冷却中由 `card_block_reason` 统一给禁用原因。

全局调参区（`autoload/game_state.gd`，键名 ↔ spec.numeric）：

| 键 | 默认 | 范围 | 说明 |
|---|---|---|---|
| projectile_damage | 20 | 5~60 | combat.pea.damage |
| projectile_speed | 480 | 120~900 | combat.pea.speedPxPerSec |
| fire_interval | 1.5s | 0.15~3 | 射击间隔基准（repeater ×0.5） |
| bite_interval / bite_damage | 1.0s / 30 | 0.4~3 / 10~90 | combat.bite |
| freeze_duration / freeze_factor | 2.0s / 0.6 | 0.5~5 / 0.2~0.95 | combat.freeze |
| sky_drop_interval / sky_drop_yield | 12s / 25 | 4~24 / 5~60 | economy.skyDrop |
| sunflower_interval / sunflower_yield | 10s / 25 | 1~20 / 5~60 | economy.sunflower |
| sun_expire_sec / sun_fade_sec / sun_tap_radius | 8s / 2s / 44px | — | economy.clickCollect |
| cursor_move_speed | 520 px/s | 120~900 | 键盘布防光标速度 |
| hint_show_seconds | 3.0s | 0.5~6 | 开局操作提示停留时长（超时淡出，不常驻） |

对局常量：初始生命 5（player.lives）；突破防线 -1 生命、移除僵尸（combat.breakthrough）。

单局时长（spec.difficulty.estimatedDurationSec 上限口径）：132 / 141 / 163 秒，落在 1-3 分钟带内；
`content.sessionSeconds = 180`。

## 4. 对比度规范（spec.numeric.visual.contrast，acc-contrast 机判）

- 草坪格底 = 低饱和深绿棋盘双档：`#2b5436`（深）/ `#31603f`（浅）按格交替 —— 替换 v1 高饱和亮绿。
- 前景主体（植物/僵尸/阳光/弹丸）统一 2px 描边 `#1e3b25` + 投影 rgba(0,0,0,0.25)（偏移 2px）。
- HUD 深底 `#22313f` + 浅字 `#ecf0f1`；阳光计数数字 `#f1c40f`；UI 主色件 `#3498db`（仅 UI，不作草坪前景）。
- WCAG 2.x 相对亮度公式逐对复算 ≥3:1，机判双保险：色对表常量（`tests/smoke.gd` CONTRAST_PAIRS）
  + 渲染常量与声明色值一致（FlatUI 是取色唯一来源）。共 11 对：植物体/向日葵盘/僵尸基底/阳光
  拾取物 × 草坪双档 + 阳光计数/正文/主色件 × UI 深底。
- 回归教训：v1 植物主体 #2ecc71 落在高饱和亮草地上（同色相低对比）是「植物不可见」缺陷根因；
  本闸防复发。

## 5. 战场几何（1024×640 设计视口，spec.numeric.grid：9×5、96px 格，canvas_items 拉伸自适应）

- HUD 条：y 0~64；草坪：y 72~552（5 行 × 96px）；底部提示条：y 552~640
- 房子防线：x 0~104，防线 x = 112（僵尸头部越过即扣 1 生命）
- 布防网格：9 列 × 96px（x 112~976）；出怪口：x 984~1024（僵尸出生 x=1056 画面外走入）

## 6. 资产治理（spec.assets 契约面）

全部资产工程内程序化生成（source=generated），无外部素材、无位图贴图（除模板 CC0 粒子件，
本工程配置为不使用）：

| 资产 | 落点 | 生成器 | 备注 |
|---|---|---|---|
| BGM 循环 | assets/sfx/bgm.wav | procedural:tools/gen_bgm.gd | ≈55.4s 无缝循环（8 小节曲式 ×3 轮），运行时 LOOP_FORWARD |
| score/confirm/hit/fail/shoot/place/zombie_die/breach/victory/defeat | assets/sfx/*.wav | procedural:tools/gen_sfx.gd | v1 配方保留 |
| wave / produce | assets/sfx/*.wav | procedural:tools/gen_sfx.gd | v2 新增：波次号角 / 向日葵产出 |

音效契约（spec.audio.sfxBindings 全 8 类，机判见 `tests/smoke.gd::_check_audio_contract`）：
射击=shoot、命中=hit、僵尸倒地=zombie_die、放置单位=place、收集阳光=score、波次来袭=wave
（含首波与最后一波）、通关=victory、失败=defeat。工程内补充：按钮=confirm、无效操作=fail、
防线受击=breach、向日葵产出=produce。

⚠️ 新增/变更 .wav 后必须先跑一次无头 `--import` 生成 .import 元数据，再导出与冒烟（知识文档坑①）。

音频解锁契约（spec audio.audioContextUnlock）：
- AudioContext 初始 suspended，壳页监听首个手势（touchstart/pointerdown/click/keydown）同步 resume；
  游戏侧兜底：首个人类输入 `Audio.ensure_playing()`（首交互前不发声）。
- `window.__audioDebug()` 返回 `{unlocked, muted, bgmPlaying}`：muted/bgmPlaying 由游戏侧
  `Audio._publish_state()` 写 `window.__GAME_AUDIO_STATE__`，壳层合并返回 —— mobile-web-smoke
  audio-unlock 项的机判依据。静态壳（export/web-shell.html）与 AppHost 壳（server/src/game-page.ts）同语义。
- 静音开关：常驻右上角（`scripts/mute_button.gd`，独立 CanvasLayer，选关/对局/结算全程可见），
  ≥44×44px，AudioServer 总线 mute 即时生效，会话内记忆（Audio 单例承载）。

视觉：全场景扁平色块 + 几何造型（Node2D `_draw` / StyleBoxFlat），零渐变、零写实素材，
色板与对比度规则见 `.myrd/style-card.md`（flat-bright-pvz v2）；三章节配色（晨绿/暮橙/夜蓝）
落在场景提示条/房屋檐口/天空底色。

## 7. Steam 披露提醒

若将来上架 Steam，需在内容调查表中披露 AI 生成内容（Valve 2024-01 起）：本工程全部
音频/视觉资产为程序化生成（预生成，披露后允许）。
