# 冒烟愿晶：一闪即逝的流星，收集三颗即胜

休闲收集 · Godot 4 工程（模板 `std-skills/godot-game-dev/templates/minimal-2d` 派生）。

## 玩法

- 流星在场景内随机位置**限时闪现**（调参区 3~5 秒，硬上界 5 秒），超时自动消失、愿晶计数不变。
- 闪现期间收集一路流星 = +1 愿晶，三路收集任选：
  1. **点按/点击**流星（判定热区 48px）；
  2. **玩家角色触碰**流星（走到流星上）；
  3. **confirm（空格/回车）许愿波**：以玩家为圆心 200px 范围内全部收集。
- 集齐 **3 颗愿晶立即判定胜利**（`game_won` 单局仅一次，不可重复触发），展示胜利结算。
- 结算后**重开**（confirm 或「重新开始」按钮）：愿晶归零、流星重新生成。

## 操作

| 动作 | 桌面 | 移动端 |
|---|---|---|
| 移动 | WASD / 方向键 | 左下虚拟摇杆 |
| 许愿波 / 重开 | 空格 / 回车 | 右下「许愿」按钮 |

## 验收标准 → 机判映射（tests/smoke.gd）

| 需求验收 | 冒烟断言 |
|---|---|
| 1. 限时闪现 ≤5s、消失无残留 | 调参上界机判 + 0.5s 短寿命流星超时后 `is_instance_valid == false` |
| 2. 点击收集 +1 且有反馈 | 触摸/鼠标两路点按收集 +1，`Juice.events` 非空 |
| 3. 点空/超时不误判 | 点空用例与超时用例后计数不变 |
| 4. 3 颗即胜、不可重复 | `game_won` 触发数 ==1、胜利后再计分被忽略、WinPanel 展示、停止生成 |
| 5. 重开归零、重新生成 | confirm 重开后计数 0、门闩复位、计时器武装、生成路径可用且寿命合规 |

## 自测门禁

```bash
bash games/10/verify.sh          # resolve-godot → preflight → smoke（GODOT_SMOKE_FRAMES=240）
```

判定脚本唯一来源：仓库内 `std-skills/godot-game-dev/scripts/`（本工程不自带判定器）。

## 可调数值（autoload/game_state.gd 调参区）

`move_speed` / `meteor_lifetime_min,max` / `meteor_spawn_interval` / `max_alive_meteors` /
`pulse_radius` / `tap_radius` —— 与 `TUNING_META` 成对声明；网页部署后可用
`?tuning=<JSON>`（或游戏内调参面板）即时试调，定稿回写 spec 后更新默认值。
