# levels.md — Pixel Fives 关卡状态（共享黑板）

> 更新时间：2026-09-20（N1 收口 + M1 冲刺日）
> 负责人：主策划（本文件全团队共用，改动请在「变更记录」追加一行）
> 下一步：M1 门禁实跑结果回填本表「门禁状态」列；N1 终裁后如新卡立项，新增「N2 关卡规划」区

---

## 1. 工程基线

| 项 | 值 |
|---|---|
| 工程路径 | `games/game/`（project.godot config/name = 「糖果粉碎传奇」，任务代号 Pixel Fives） |
| 引擎 | Godot 4.3（`config/features=PackedStringArray("4.3")`），gl_compatibility，竖屏 720×1280 aspect=expand |
| 主场景 | `res://scenes/main.tscn`（scenes: main / player / candy 三件套） |
| autoload | `GameState`（autoload/game_state.gd）、`GameAudio`（autoload/audio_manager.gd） |
| 冒烟 | `tests/smoke.gd` + `tests/smoke.tscn`，0–12 阶段断言，`GODOT_SMOKE: PASS` + exit 0 为过 |

## 2. 关卡阶梯（实现状态：已落地，冒烟阶段 8 锁数值）

| 关卡 | 目标分公式 | 步数公式 | 状态 | 机判 |
|---|---|---|---|---|
| L1 | 600（TARGET_SCORE） | 20（START_MOVES） | ✅ 可玩 | smoke 阶段 8/9/10 |
| L2 | 900（+300/关） | 18（−2/关） | ✅ 可玩 | smoke 阶段 9 过关断言（LEVEL 2 + 阶梯重算） |
| L3 | 1200 | 16 | ✅ 可玩 | smoke 阶段 10 败局断言（level=3 抬高构造） |
| … | 600+(n−1)×300 | max(20−(n−1)×2, 12) | ✅ 公式纯函数 | `target_for_level` / `moves_for_level` 单调性断言（L1→L6） |
| L99（MAX_LEVEL 封顶） | — | 12（下限） | ✅ 常量锁定 | 常量断言 |

## 3. M1 里程碑门禁状态

| 门禁 | routine | 状态 | 证据落点 |
|---|---|---|---|
| Godot 无头冒烟 | `godot-smoke`（preflight + headless-smoke + input-fuzz） | ⏳ 待实跑（命令已备好；2026-09-20 下午批次补充：smoke.gd 0-12 阶段静态核对完毕，另新增 audio-same-tick 契约场景命令见 runbook §2 ③） | m1-gate-runbook.md §2（输出占位区待回填） |
| 契约测试 | `game-contract`（scripts/contract-check.mjs --spec .myrd/spec/design-spec.json） | ⛔ 实跑仍挂 B-1；✅ 程序侧静态核对完毕：获批后可全 PASS（2 处假阴性已修复：⑥ 数值扫描清单补 main/audio_manager，⑦ audio-same-tick.gd「待补」已落地） | m1-gate-runbook.md §1.5 |
| 音画同 tick 复核 | （B2/B4） | ✅ 代码层已同 tick（程序独立复核行级证据 + 契约测试文件已落地，首次实跑挂 B-1）；spec 条款待批 | m1-gate-runbook.md §3 |

## 4. 变更记录

- 2026-09-20 主策划：建档；阶梯/门禁状态按当日探查实况填写，M1 实跑输出待有 shell 的执行者回填。
- 2026-09-20 游戏程序（下午批次）：门禁状态三行更新——①契约脚本静态核对完成并修复 2 处获批后假阴性（数值扫描清单 + audio-same-tick.gd 落地）；②冒烟新增 audio-same-tick 契约场景命令；③音画同 tick 程序独立复核完成（行级证据）。实跑动作仍挂 B-1，本会话无 shell，未产生任何实跑输出。
