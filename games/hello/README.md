# 《hello》

休闲收集小游戏：用最短时间收集完场上的 4 个金色方块。

## 玩法说明（30 秒上手）

- **目标**：把场上 4 个金色方块全部收集到手。顶栏实时显示进度「收集 n/4」。
- **操作**：
  - 键盘：`WASD` 或方向键移动；`空格` / `回车` 重开一局。
  - 触屏（手机/平板浏览器）：左下虚拟摇杆移动，右下「重开」按钮重开一局。
- **一局流程**：移动 → 碰到方块即收集（方块消失 + 计数 +1）→ 集满 4 个弹出「收集完成」→
  按空格 / 回车（或点「重开」）开始下一局，方块按原位复活、分数清零。
- **胜负**：集满 4 个 = 完成一局（无失败惩罚，适合碎片时间反复刷最短用时）。

## 开发

- 引擎：Godot 4.x（工程规则见本目录 `CLAUDE.md`，钉死 Godot 4 / GDScript 2.0）。
- 目录：`scenes/` 场景、`scripts/` 脚本、`autoload/game_state.gd` 计数与胜负状态、
  `tests/smoke.tscn|gd` 无头冒烟自检、`assets/fonts/` 全局中文字体（Web 导出必带）。

### 本地门禁（与 CI 同源，提交前必跑）

```bash
bash games/hello/verify.sh          # resolve-godot → preflight(13 类) → smoke(GODOT_SMOKE_FRAMES=240)
# 输入鲁棒性 fuzz（与 .myrd/routines.yaml godot-smoke 的 input-fuzz step 同源）
GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/input-fuzz.sh games/hello
```

判定协议：退出码 0 且日志含 `GODOT_SMOKE: PASS` / `GODOT_FUZZ: PASS`；退出码 2 = 环境不可用（先装 Godot，别改代码）。
