# 测试连点防重的极简计数页（game-12）

休闲收集 · 单页极简计数应用。验证点击类小游戏的基础交互质量：**点击计数、连点防重、移动可玩**。

## 玩法

- 点中央「+1」按钮（或按空格/回车，移动端点右下触摸确认钮）计数 +1；
- **连点防重**：300ms 防重窗口内的重复点击只计一次，被拦截时状态栏提示剩余毫秒、按钮闪红；
- 窗口结束后恢复正常累加；计数达到 **10** 即胜利（本游戏按需求为极简计数页，无失败态）；
- 「重开」按钮或 R 键重置：计数归零、回到进行中（刷新页面/重开即从 0 开始，无持久化）；
- WASD/方向键（移动端摇杆）可移动指针方块（脚手架保留的可控角色，不影响计数）。

## 工程

```
project.godot        # Godot 4.3 · 主场景/autoload/[input]（move_*、confirm、restart）/竖屏 720×1280/全局中文字体
autoload/game_state.gd   # 计数 + 防重纯逻辑（try_count(now_ms) 时间可注入 → 无头可判）
scenes/main.tscn     # 极简布局：CountLabel / CountButton / StatusLabel / RestartButton + Player + TouchUI
tests/smoke.tscn|gd  # 无头冒烟：实例化/键位契约/移动/计数/防重/胜负/重开 全断言
verify.sh            # 门禁入口（只调用仓库 std-skills 判定脚本）
```

## 本地门禁

```bash
bash games/game-12/verify.sh        # preflight + smoke(GODOT_SMOKE_FRAMES=240) + input-fuzz
```

判定协议：退出码 0 且日志含 `GODOT_SMOKE: PASS`（冒烟）/ `GODOT_FUZZ: PASS`（fuzz）；
退出码 2 = 环境不可用（先装 Godot，不要改判定脚本）。

## 验收标准 → 冒烟断言映射

| 验收标准 | 冒烟断言（tests/smoke.gd） |
|---|---|
| 1. 正常节奏连点 10 次恰好计 10 | 相位六：合成时间 >300ms 节奏点到 TARGET_COUNT，count 恰好 10 |
| 2. 300ms 窗口内连点 5 次只 +1 | 相位六：窗口内 100/200/250/299ms 连点全部拦截 + click_rejected |
| 3. 窗口结束恢复累加无跳变 | 相位六：+400ms 恢复计数，恰好 +1 |
| 4. 移动可玩（触摸/≥44px/375 无横滚） | 竖屏 720×1280 canvas_items+keep（375 宽按 0.52 缩放无横滚）；+1 按钮 560×240、确认钮 r=44；相位三/五：动作事件与按钮 pressed 两条真实路径均计数 |
| 5. 刷新归零无残留 | 相位七：restart 动作 + RestartButton 均归零回 PLAYING，按钮 disabled 复位 |
