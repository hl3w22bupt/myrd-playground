# 接苹果（game-11）

《浏览器诊断：做一个接住掉落苹果的小游戏》—— 休闲收集：控制底部果篮接住掉落的苹果，
漏接扣生命，生命耗尽进入结算，可一键重开。Godot 4 工程，从 `std-skills/godot-game-dev/templates/minimal-2d` 起步。

## 玩法闭环（谁 emit、谁订阅、谁改状态）

```
Main (scripts/main.gd)                     控制器：装配 UI、订阅信号、生成苹果
├── SpawnTimer.timeout ──► main._on_spawn_timer_timeout ──► spawn_apple()
├── Apple.caught  ──► main._on_apple_caught  ──► GameState.catch_apple()  (+1 分，best 跟随)
├── Apple.missed  ──► main._on_apple_missed  ──► GameState.miss_apple()   (-1 生命，0 → GAME_OVER)
├── GameState.game_over ──► 结算面板（本局得分 + 历史最高分）
└── GameState.state_changed ──► 面板显隐（MENU 开局 / PLAYING 游玩 / GAME_OVER 结算）

Player (scripts/player.gd, class_name Player)   果篮：底部左右移动
├── 键盘 ←/→ 或 A/D、触摸摇杆 → InputMap 动作 move_left/right（优先级最高）
├── 鼠标水平移动 / 触屏拖动 → PointerFollowZone 信号 → main → set_follow_target(x)
└── moved(position) 信号对外广播
```

## 操作

| 设备 | 操作 |
|---|---|
| 键盘 | ←/→ 或 A/D 移动；Enter / 空格 = 开始 / 重开（`confirm` 动作） |
| 鼠标 | 光标水平移动果篮实时跟随（无需点击） |
| 触屏 | 手指水平拖动果篮跟随；左下摇杆同样可用，右下按钮 = 开始 / 重开 |

## 调参区（玩法参数集中配置）

`autoload/game_state.gd` 顶部常量：果篮速度、苹果初速与每分增速、生成间隔与每分缩短量、
初始生命、计分规则、游戏区宽高与底线。难度曲线 = `apple_fall_speed()` / `spawn_interval()` 随得分递增。

最高分持久化：`user://game_11_highscore.txt`。Web 导出时 `user://` 由引擎落到浏览器
IndexedDB，页面刷新后不丢（等价于纯前端方案里的 localStorage，单实现覆盖原生与 Web）。

## 门禁（与 .myrd/routines.yaml 的 godot-smoke routine 同源）

```bash
bash games/game-11/verify.sh   # preflight + 冒烟(GODOT_SMOKE_FRAMES=240) + input-fuzz
```

判定器只来自仓库 `std-skills/godot-game-dev/scripts/`，本工程不自带判定脚本。

冒烟断言（`tests/smoke.gd`，先跑 30 帧对抗输入噪声相位）：
场景实例化 / autoload 与约定信号 / 键位契约逐键 AND / 注入输入后果篮真的移动 /
开局入口（confirm → PLAYING）/ 接住 +1 分 / 漏接 -1 生命 / 难度随得分递增 /
生命耗尽 → GAME_OVER + 结算面板 + 最高分落盘 / 重开（confirm → PLAYING，分数生命重置）。

## 目录

```
autoload/game_state.gd     全局状态 + 玩法参数 + 最高分持久化
scenes/main.tscn           主场景（背景/果篮/生成器/HUD/开始与结算面板/触摸 UI）
scenes/player.tscn         果篮（CharacterBody2D）
scenes/apple.tscn          苹果（Area2D，重叠果篮 = 接住）
scripts/                   与场景同名成对的脚本 + pointer_follow_zone.gd
tests/smoke.tscn|gd        无头冒烟场景（门禁入口，不得删除）
verify.sh                  本地门禁入口
```
