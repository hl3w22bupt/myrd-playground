# 复现天天酷跑（game-10）

休闲收集跑酷：角色自动前进，跳跃 / 快速下落 / 左右走位，收集金币、拾取加速星提速，
撞障碍即 game over，跑满 500m 通关。桌面键盘 + 移动端虚拟摇杆双输入。

## 本地门禁

```bash
bash games/game-10/verify.sh        # preflight → smoke(240帧) → input-fuzz
```

判定器唯一来源：仓库内 `std-skills/godot-game-dev/scripts/`（本工程不自带判定逻辑）。

## 晃动调参手册（需求：加速降晃 + 终局单晃）

全部晃动参数集中在 `autoload/game_state.gd` 的 `SHAKE_CONFIG`，**改配置即可生效，
不需要动业务逻辑代码**（`scripts/screen_shake.gd` 是唯一消费方，经
`GameState.shake_params()` 取参）：

| 参数 | 当前值 | 改动前基线 | 说明 |
|---|---|---|---|
| `accel.amplitude_px` | 1.2 | 6.0 | 加速特效期间的持续微抖幅度（实测降 80%，验收线 ≤50%） |
| `accel.frequency_hz` | 5.0 | 12.0 | 加速微抖频率（低频不催晕） |
| `game_over.amplitude_px` | 7.0 | — | 终局单晃峰值（线性衰减包络，短促清晰） |
| `game_over.frequency_hz` | 16.0 | — | 终局单晃频率 |
| `game_over.duration_s` | 0.3 | 连晃 3 次 | 单晃时长；结束后相机 offset 精确归零 |

行为保证（由结构保证，不靠参数）：

- game over：`GameState.trigger_game_over()` 先终结加速（`speed_changed(false)` 关微抖），
  再沿状态边沿发 `state_changed(GAME_OVER)`，主场景只在该边沿调
  `camera.request_terminal_shake()`；后者在终局晃动进行中忽略重复请求 ⇒ 精确单次。
- 终局后完全静止：`ScreenShake._process` 每帧显式写入目标偏移，无活动晃动源时恒为
  `Vector2.ZERO`，不存在衰减尾迹或重复触发。
- 两场景互不干扰：加速微抖（rumble）与终局单晃（terminal）在 `_process` 中互斥
  （elif 分支），终局单晃优先、绝不叠加放大。

冒烟断言（`tests/smoke.gd`）已把验收标准翻译为机判：加速峰值 ≤ 配置幅度、
game over 计数恰 +1、峰值不超终局幅度、结束后 ≥3 游戏秒逐帧 `offset == Vector2.ZERO`、
重开后可再次单晃。

## 其它玩法调参（同文件常量区）

`BASE_SPEED_PX_S` / `ACCEL_MULTIPLIER` / `ACCEL_DURATION_S`（≥10s）/ `WIN_DISTANCE_M` /
`COIN_SCORE` 等，见 `autoload/game_state.gd` 顶部「玩法调参」区。
