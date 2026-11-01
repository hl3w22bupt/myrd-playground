# 《植物人大战僵尸-网页版》数值表与资产治理

> 对应策划案契约（spec.numeric / spec.assets）的工程内镜像。改数值 = 先改策划案（产生新版本）
> 再同步这里与 `autoload/game_state.gd` 调参区，禁止两头各改各的。

## 1. 关卡表（难度平缓递增，相邻关卡任意一项变化 ≤ 30%）

| 关卡 | 名称 | 波数 | 每波僵尸 | 僵尸血量 | 僵尸速度 | 出怪间隔 | 啃咬 dps | 难度标签 |
|---|---|---|---|---|---|---|---|---|
| 1 | 初春草地 | 5 | 4 | 30 | 26 px/s | 3.2 s | 10 | 悠闲 |
| 2 | 盛夏庭院 | 6 | 4 | 36 | 31 px/s | 2.9 s | 12 | 轻松 |
| 3 | 暮秋防线 | 7 | 4 | 43 | 36 px/s | 2.6 s | 14 | 进阶 |

相邻关卡增幅核对（上限 30%）：
- 波数 +20.0% / +16.7%
- 血量 +20.0% / +19.4%
- 速度 +19.2% / +16.1%
- 出怪间隔 -9.4% / -10.3%（越短压力越大）
- 啃咬 dps +20.0% / +16.7%

无头可判定代理：`tests/smoke.gd::_check_level_table`（冒烟门禁逐项机判）。

## 2. 全局调参区（`autoload/game_state.gd`，键名 = spec.numeric）

| 键 | 默认 | 范围 | 说明 |
|---|---|---|---|
| sun_trickle_interval | 3.0 s | 1~10 | 时间产出：阳光细流周期 |
| sun_trickle_amount | 5 | 0~30 | 细流单次入账 |
| sky_sun_interval | 6.0 s | 2~15 | 天降阳光周期 |
| sky_sun_value | 25 | 5~60 | 天降阳光单次入账（点按收集） |
| defender_cost | 50 | 10~150 | 豌豆射手造价 |
| defender_hp | 100 | 30~400 | 防御单位血量 |
| fire_interval | 0.9 s | 0.15~3 | 射击间隔 |
| projectile_damage | 10 | 2~60 | 弹丸伤害 |
| projectile_speed | 420 px/s | 120~900 | 弹丸速度 |
| cursor_move_speed | 520 px/s | 120~900 | 键盘布防光标速度 |

对局常量：初始阳光 150、初始生命 3、击杀奖励 +10 阳光。

单局时长：第 1 关 5 波 × (出怪 4×3.2s + 清场 + 休整 3s) ≈ 1.5~2.5 分钟，落在「1-3 分钟」目标带内；
第 3 关约 2.5~3 分钟。

## 3. 战场几何（960×540 设计视口，canvas_items 拉伸自适应）

- HUD 条：y 0~64；草坪：y 64~514（5 行 × 90px）；底部提示条：y 514~540
- 房子防线：x 0~88，防线 x = 96（僵尸头部越过即扣 1 生命）
- 布防网格：8 列 × 104px（x 96~928）；出怪口：x 928~960（僵尸出生 x=992 画面外走入）

## 4. 资产治理（spec.assets 契约面）

全部资产工程内程序化生成（source=generated），无外部素材、无位图贴图（除模板 CC0 粒子件，
本工程配置为不使用）：

| 资产 | 落点 | 生成器 | 备注 |
|---|---|---|---|
| BGM 循环 | assets/sfx/bgm.wav | procedural:tools/gen_bgm.gd | 18.5s 无缝循环，运行时 LOOP_FORWARD |
| score/confirm/hit/fail | assets/sfx/*.wav | procedural:tools/gen_sfx.gd | 模板配方保留 |
| shoot/place/zombie_die/breach/victory/defeat | assets/sfx/*.wav | procedural:tools/gen_sfx.gd | 配方 tests/sfx-recipes.json |

音效契约（需求验收 5）：射击=shoot、命中=hit、僵尸倒地=zombie_die、放置单位=place、
阳光与得分=score、防线受击=breach、胜负结算=victory/defeat、无效操作=fail、按钮=confirm。
静音开关（HUD「音效」按钮）走 AudioServer 总线 mute，点击即时生效，覆盖 BGM 与全部音效。

视觉：全场景扁平色块 + 几何造型（Node2D `_draw` / StyleBoxFlat），零渐变、零写实素材，
色板与规则见 `.myrd/style-card.md`（flat-bright-pvz）。

## 5. Steam 披露提醒

若将来上架 Steam，需在内容调查表中披露 AI 生成内容（Valve 2024-01 起）：本工程全部
音频/视觉资产为程序化生成（预生成，披露后允许）。
