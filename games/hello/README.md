# 《hello》

休闲收集小游戏：在倒计时结束前收满本关目标数的金色方块，一关一关往下闯。

## 玩法说明（30 秒上手）

- **目标**：场上摆 6 个金色方块，每关要求收集其中一部分。顶栏实时显示
  「第 N 关 · 收集 x/y · 剩余秒数」。
- **操作**：
  - 键盘：`WASD` 或方向键移动；`空格` / `回车` 在结算画面推进。
  - 触屏（手机/平板浏览器）：左下虚拟摇杆移动，右下按钮推进结算。
- **难度梯度**：第 1 关 30 秒收 4 个；之后每关目标 +1、时限 -4 秒
  （第 2 关 26 秒收 5 个，第 3 关 22 秒收 6 个，之后保持 18 秒收 6 个的封顶难度）。
- **一局流程**：移动 → 碰到方块即收集（方块消失 + 计数 +1）→ 限时内收满弹出
  「第 N 关完成」→ 按空格进入下一关，方块按原位复活、分数清零、时限按新关卡重置。
- **失败与重来**：倒计时归零仍未收满即「时间到」，按空格从第 1 关重来，
  关卡、时限、分数全部复位。

## 开发

- 引擎：Godot 4.x（工程规则见本目录 `CLAUDE.md`，钉死 Godot 4 / GDScript 2.0）。
- 目录：`scenes/` 场景、`scripts/` 脚本、`autoload/game_state.gd` 关卡梯度与胜负状态、
  `tests/smoke.tscn|gd` 无头冒烟自检、`assets/fonts/` 全局中文字体（Web 导出必带）。

### 本地门禁（与 CI 同源，提交前必跑）

```bash
bash games/hello/verify.sh          # resolve-godot → preflight(13 类) → smoke(GODOT_SMOKE_FRAMES=240)
# 输入鲁棒性 fuzz（与 .myrd/routines.yaml godot-smoke 的 input-fuzz step 同源）
GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/input-fuzz.sh games/hello
```

判定协议：退出码 0 且日志含 `GODOT_SMOKE: PASS` / `GODOT_FUZZ: PASS`；退出码 2 = 环境不可用（先装 Godot，别改代码）。
