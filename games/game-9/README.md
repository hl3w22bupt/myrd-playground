# game-9 · 推箱子点亮方块解谜：把箱子推到目标点，点亮所有方块

Godot 4.3 工程脚手架 + 可玩骨架。目标：`cmupsrc19002sm9dhp5su0zaj`；需求：`cmupsx443003om9dh5dwd5w9u`；
策划案：GameDesignSpec v1（`cmupuav5b005gm9dhnpxewwm4`，approved）。分支：`myrd/game-9-goal-cmupsrc19002sm9dhp5su0zaj`。

## 玩法与操作

把**蓄能方块**推上**接线槽**，全部接线槽都有方块驻留（合闸完成）即通关。方块只能推不能拉；
顶到墙体或另一方块则本次移动无效、角色不位移。方块进入接线槽的格子立即点亮且**常亮不灭**；
把方块顶进两面墙的夹角 = 本关已不可通关（角死锁），HUD 会实时给出「按 R 重开（或 Z 撤销）」的失败反馈。

HUD 展示：操作提示 · 关卡名 · 步数 · 目标步数（spec `parMoves`）· 点亮进度 · 最佳步数（本关历史最少）。
通关结算展示：步数、目标步数与评级（≤par ⚡⚡⚡ / ≤par×1.5 ⚡⚡ / 其余 ⚡），空格/回车/N 进入下一关。

| 操作 | 键盘 | 移动端触屏 |
|---|---|---|
| 移动（推箱） | WASD / 方向键（长按每 150ms 步进） | 左下虚拟摇杆，或**任意位置滑动**（越过 24px 触发 1 步） |
| 单步撤销 Undo | Z / 退格 | 右下「撤销」按钮 |
| 重开本关 Restart | R | 右下「重开」按钮 |
| 关卡选择 | N 下一关 / P 上一关（环绕） | 右下「下一关」按钮 |
| 通关后进入下一关 | 空格 / 回车 / N | 「下一关」按钮 |

## 关卡（策划案 levels[] 原样落盘）

| 关卡 | 网格 | 方块/槽数 | 最优步数（求解器实测 = spec parMoves） |
|---|---|---|---|
| 01 · 通电初试 | 7×5 | 1 | 2 |
| 02 · 绕后接线 | 8×7 | 2 | 10 |
| 03 · 双轴调度 | 10×10 | 3 | 18 |
| 04 · 四路合闸 | 10×10 | 4 | 40 |
| 05 · 总控机房 | 9×8 | 5 | 58 |

可解性由本工程自带的推箱求解器离线验证（非门禁、不参与 GODOT_SMOKE 判定）：

```bash
python3 games/game-9/tools/level_solver.py games/game-9
# [PASS] level-01..05 全部可解，最优步数与 spec.parMoves 逐关一致，方块数 1→5 单调递增
```

## 门禁（本工程的自检入口）

```bash
bash games/game-9/verify.sh
```

只**调用**仓库内 `std-skills/godot-game-dev/scripts/` 的判定脚本（preflight / smoke / input-fuzz / resolve-godot），
不重新实现任何检查逻辑。本地实测输出（Godot 4.3.stable.official.77dcf97d8）：

```
==> [1/3] preflight   PREFLIGHT: PASS 13 类前置一致性检查全部通过（27 个工程文件）
==> [2/3] smoke       GODOT_SMOKE: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）
==> [3/3] input-fuzz  GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239
verify: PASS preflight + smoke + input-fuzz 全部通过
```

冒烟断言覆盖（`tests/smoke.gd`，逐条对应验收标准）：
- 模板五项：场景实例化 / autoload 注册与信号 / InputMap 注册 + 键位逐键契约 + 注入输入后角色真的位移 / 信号到达订阅方 / 失败原因可读；
- AC1 推动规则：推动双方各进 1 格；推墙无效角色不位移；顶到另一方块双方不位移；不可拉动（合成棋盘逐情形断言）；
- AC2 点亮与通关：方块入槽同帧点亮且保持常亮；全部接线槽有方块驻留即 `won`（与求解器/spec parMoves 同口径）；通关弹层在 60 帧预算内（≤1000ms 口径）出现，结算展示步数与 ⚡ 评级；
- AC3 撤销与重开：Undo 精确回退一步（角色/方块/点亮/步数四项同步还原）、空历史返回 false；Restart 完整恢复初始布局并清空点亮与历史；死锁局面下 Undo 可脱离死锁态；
- AC4 关卡可解性（引擎内机判）：逐关回放 `sokoban_levels.gd` 落盘的见证解（`tools/level_solver.py --paths` 生成），每关必须通关、步数 == par、回放全程不得误报死锁；外加关卡册断言（≥5 关、方块数 1→5 递增、方块数与槽数一致、next/prev 环绕、通关后 confirm 进入下一关）；
- 失败反馈：角死锁必报 / 在槽角不报 / 开阔局面不报（无假阳性）；真实关卡把方块顶进角后 `deadlock_changed` 通知 UI，HUD 出现卡死警示；
- AC5 响应与兼容：移动输入 → 首次步进 ≤ 12 帧（200ms，`perf.maxInputResponseMs`），HUD 同步刷新步数与目标步数；触屏滑动越过 24px 阈值恰好步进 1 步（`touchSwipeThresholdPx`）。

## 工程结构

```
games/game-9/
├── project.godot            # 主场景 / [autoload] GameState / [input] 动作映射 / 全局中文字体
├── autoload/game_state.gd   # 关卡索引、步数、撤销历史、胜负判定 + spec.numeric 调参区
├── scripts/
│   ├── sokoban_levels.gd    # 关卡数据（策划案 ASCII 布局 + 见证解落盘）
│   ├── sokoban_board.gd     # 棋盘纯逻辑：推动判定 / 点亮 / 死锁 / 快照（无头可直接断言）
│   ├── player.gd            # 网格离散移动 + 长按节流 + 步进动画
│   ├── board_view.gd        # 棋盘渲染（Polygon2D 色块 + 推动补间 + 死锁变红）
│   ├── main.gd              # HUD / 失败反馈 / 通关结算 / 撤销·重开·换关入口
│   ├── virtual_joystick.gd  # 虚拟摇杆（模板内置，触屏移动）
│   ├── touch_swipe.gd       # 触屏滑动 → 单步移动（24px 阈值，spec touchSwipeThresholdPx）
│   └── touch_action_button.gd  # 触屏动作按钮（撤销 / 重开 / 下一关）
├── scenes/{main,player}.tscn
├── tests/smoke.tscn|gd      # 无头冒烟场景（门禁判定层）
├── tools/level_solver.py    # 关卡可解性求解器（开发期证据工具，非门禁）
└── verify.sh                # 门禁入口（preflight + smoke + input-fuzz）
```

## 与策划案的偏差说明（重要）

approved 版策划案 `meta.engine` 声明为「HTML5 Canvas + TypeScript（Vite）」，实体/关卡/验收的
落点路径也写成 `src/entities/*.ts`、`tests/contract/*.spec.ts`。本通道的工坊锁定参数是
**Godot 4 工程目录 `games/game-9` + godot-smoke 门禁**，因此实现按 Godot 栈落地：
- **玩法内容完全对齐 spec**：世界设定与术语（接线槽 / 蓄能方块 / 合闸 / 步数）、5 个 ASCII 布局、
  `numeric`（cellSizePx=48、moveAnimMs=110、keyRepeatIntervalMs=150、historyLimit=1000、
  overlayDelayMs=300、pullable=false、pushDistanceCells=1、onceLitStaysLit=true）逐项落进
  `autoload/game_state.gd` 调参区，键名与 spec.numeric 一一对应；
- **AC 落点改写为 Godot 可执行形态**：AC1–AC4 逐条翻译成 `tests/smoke.gd` 的断言
  （spec 里的 `tests/contract/*.spec.ts` 是 web 栈路径，Godot 工程不适用）；AC5 的输入覆盖
  由「键盘 + 虚拟摇杆 + 触屏按钮」承担，触屏路径与键盘走同一 InputMap 动作；
- 后续若要消除这处偏差，应走策划案修订（`POST /api/v1/game-design-specs/:id/revisions`）把
  `meta.engine` 与落点路径改成 Godot 栈，再同步实现 —— 本节点不动策划案。

## 已知边界（供后续节点参考）

1. **仓库未预置 `std-skills/godot-game-dev/scripts/playtest.sh`**：本节点 godot-smoke 门禁的
   routine 步骤（resolve-godot / preflight / headless-smoke / input-fuzz）不需要它，且前置体检节点
   按「preflight.py、smoke.sh、gate-selftest.sh、preflight_selftest.py、input-fuzz.sh、resolve-godot.sh」
   口径核销过资产在位；但任务下发的本地自检命令里含 `playtest.sh`（机器人试玩）——
   到 playtest 节点会用不上。缺的这份脚本只能由运维补进模板仓库（平台注入目录
   `.myrd-platform/.claude/skills/godot-game-dev/scripts/` 里有同名副本，但那是阅读副本，
   **不得**复制充当仓库判定脚本，否则门禁不再独立）。
2. ~~`.myrd/spec/design-spec.json` 尚未导出~~ 已在实现节点导出（approved 版 v1 原样落盘，
   供 contract-check 与后续验收节点取用）。
3. ~~未实现「滑动步进」~~ 已补 `scripts/touch_swipe.gd`（24px 阈值、一次滑动恰好 1 步、
   摇杆/按钮触点优先），冒烟有对应断言。
4. Web 导出（AppHost 部署）不在本节点范围：`games/game-9/export_presets.cfg` 尚未配置
   （模板不含），部署节点需按 `games/game/` 的 web 导出先例补齐，全局中文字体已随模板保留
   （删了它浏览器沙箱里中文全部变缺字方块）。
