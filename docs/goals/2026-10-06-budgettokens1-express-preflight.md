# 直通车前置校验报告：仓库可用与门禁脚本预置（budgetTokens1）

- 日期：2026-10-06
- 结论：**PASS —— 未触发 blocked**，`games/budgettokens1` 落地任务可继续
- 校验对象：`hl3w22bupt/myrd-playground` @ `std-skills/godot-game-dev/scripts` 三件套
- 执行环境：macOS（darwin 25.3.0），Godot 4.3.stable.official.77dcf97d8（PATH 解析），python3 内置

## 一、仓库可达性 —— PASS

| 检查项 | 证据 |
| --- | --- |
| 远端可达 | `git ls-remote --heads origin` 退出码 0，能列出全部远端分支 |
| 工作区完整 | HEAD = `a592ea2`（与 `origin/main` 同位），无缺文件 |
| 目标路径存在 | `std-skills/godot-game-dev/` 含 SKILL.md + references(4) + scripts(8) + templates/minimal-2d 全套 |

## 二、门禁脚本三件套齐备性 —— PASS

`std-skills/godot-game-dev/scripts/` 下 8 个文件全部在位，且与 git HEAD 一致（无缺失、无未提交漂移）：

| 脚本 | 角色（SKILL.md §文件清单） | 状态 |
| --- | --- | --- |
| `preflight.py` | 13 类前置一致性静态检查，无需 Godot 即可机判 | ✅ 在位 |
| `smoke.sh` | 无头冒烟门禁：`godot --headless` + 退出码/日志双断言 | ✅ 在位 |
| `resolve-godot.sh` | Godot 可执行文件解析唯一实现（GODOT_BIN > PATH > 常见安装位置） | ✅ 在位 |
| `preflight_selftest.py` | preflight 自身回归用例（门禁自己的门禁） | ✅ 在位 |
| `gate-selftest.sh` | 负例注入自检：证明门禁「不空转」 | ✅ 在位 |
| `input-fuzz.sh` / `input_fuzz_driver.gd` / `mobile-web-smoke.mjs` / `mobile_smoke_selftest.mjs` | 扩展门禁件 | ✅ 在位 |

## 三、功能级验证（实跑取证）—— 全部 PASS

| # | 验证 | 命令 | 结果 |
| --- | --- | --- | --- |
| 1 | Godot 解析 | `bash scripts/resolve-godot.sh` | 退出码 0 → `godot`（4.3.stable.official） |
| 2 | preflight 自身回归 | `python3 scripts/preflight_selftest.py` | **24/24 用例符合预期**，退出码 0 |
| 3 | 静态前置检查 | `python3 scripts/preflight.py templates/minimal-2d` | `PREFLIGHT: PASS 13 类前置一致性检查全部通过（23 个工程文件）`，退出码 0 |
| 4 | 无头冒烟门禁 | `bash scripts/smoke.sh templates/minimal-2d` | `godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）`，退出码 0 |
| 5 | 负例注入自检 | `bash scripts/gate-selftest.sh templates/minimal-2d` | 退出码 0：D1 场景实例化断裂 / D2 autoload 未注册 / D3 InputMap 缺动作 / D4 信号未到达 / D5 静默逻辑 bug(SPEED=0) **五类必然缺陷全部被拦且根因可读**；D6-D8 锚点不在模板上，自动 SKIP（预期行为） |

> 第 5 项是关键证据：门禁不仅能给绿灯，还能把注入的必然缺陷拦下来 —— 证明下游 budgetTokens1 的「未过门禁禁止部署」约束有真实牙齿。

## 四、需上级知悉的非阻塞项（版本漂移）

`.myrd-platform/.claude/skills/godot-game-dev/` 平台副本存在**未提交**的增强改动，`std-skills` 版本尚无：

1. `preflight.py` 多一条 **P14**（脚本引用 `Juice.` 反馈单例时 `[autoload]` 必须注册 Juice），检查数 13 → 14；
2. 多出 `playtest.sh` / `playtest_driver.gd` 两个脚本；
3. `gate-selftest.sh` D5 注入器升级为双锚点（`GameState.move_speed` 或 `player.gd const SPEED`）。

处置建议：这是另一条工作线的在途产物，本次校验**不代为合入、不回滚**；待其落地后由该线负责人同步到 `std-skills`，避免双副本长期漂移。

## 五、对下游的放行意见

- `games/budgettokens1/` 工程创建后，门禁调用方式（固定三步）：
  1. `python3 std-skills/godot-game-dev/scripts/preflight.py games/budgettokens1`
  2. `GODOT_BIN=<godot> bash std-skills/godot-game-dev/scripts/smoke.sh games/budgettokens1`
  3. `bash std-skills/godot-game-dev/scripts/gate-selftest.sh games/budgettokens1`（工程成型后跑，负例注入基底换成真实工程）
- 参照工程 `games/godot-coin-rush` 当前不存在，`gate-selftest.sh` 缺省参数会以退出码 2 失败 —— 需显式传工程目录（本次已验证模板可作注入基底）。
