# game-9 前置体检报告：仓库可达与门禁脚本预置核对

- 日期：2026-10-02
- 分支：`myrd/game-9-goal-cmupsrc19002sm9dhp5su0zaj`
- 工作区：`run-goal-cmupsrc19002sm9dhp5su0zaj`
- 结论：**通过，不回写 blocked**。仓库可读写、std-skills 门禁脚本在位且自检全部通过；webgame 侧一处门禁工具缺口已在本次就地补齐。

## 1. 核对项与证据

| # | 核对项 | 结果 | 证据 |
|---|--------|------|------|
| 1 | GitHub 仓库可达 | ✅ | `git ls-remote --heads origin` 正常返回（remote `github.com/hl3w22bupt/myrd-playground.git`，exit 0） |
| 2 | 远端功能分支 | ⚠️→✅ | `myrd/game-9-goal-cmupsrc19002sm9dhp5su0zaj` 初始**不存在**于远端；本节点首次推送建立 |
| 3 | std-skills 门禁脚本在位 | ✅ | `std-skills/godot-game-dev/scripts/`：`preflight.py`、`smoke.sh`、`gate-selftest.sh`、`preflight_selftest.py`、`input-fuzz.sh`、`resolve-godot.sh` 齐全，可执行权限正确 |
| 4 | preflight 门禁非空转 | ✅ | `python3 std-skills/godot-game-dev/scripts/preflight_selftest.py …` → **24/24 用例符合预期**，exit 0 |
| 5 | godot-smoke 门禁非空转 | ✅ | `bash std-skills/godot-game-dev/scripts/gate-selftest.sh std-skills/godot-game-dev/templates/minimal-2d` → D1–D5 注入缺陷**全部被拦且原因可读**（D6–D8 按设计 SKIP） |
| 6 | Godot 运行环境 | ✅ | `resolve-godot.sh` → Godot 4.3.stable.official 可用 |
| 7 | 平台 API 回写通道 | ✅ | `PLATFORM_API_URL` / `MYRD_TOKEN` 均已配置（本节点结论为通过，未触发 blocked 回写） |

## 2. 边界发现（不阻塞，记录在案）

1. **`games/game` 对 gate-selftest 的模板层注入不匹配**：以 `games/game` 为参照时 D4/D5 注入失败
   （该工程 `player.gd` 无 `moved.emit` / `const SPEED` 模板契约锚点，注入脚本自身 assert 失败）。
   这是参照工程与模板契约不一致的已知边界，**不是门禁失效**——换官方支持的参照
   `templates/minimal-2d` 后 D1–D5 全部拦截。后续若要让 `games/game` 也作为门禁自检参照，
   需先对齐其 `player.gd` 契约或为它补工程层锚点。
2. **`.myrd/spec/design-spec.json` 尚未导出**：webgame-prototype 契约门禁的输入件不在工作区
   （设计 spec 产物 id `cmupuav5b005gm9dhnpxewwm4` 已完成，导出落盘属实现节点职责）。
   实现节点动手前须先从 approved 版策划案导出到该路径，否则 `contract-check.mjs` 会以
   exit 2（输入不可用）拒绝放行。
3. **`std-skills/` 目前只含 godot-game-dev**：webgame-prototype 仅存在于平台技能目录
   `.myrd-platform/.claude/skills/`（未纳入仓库 std-skills 快照）。当前不影响执行，
   若要统一快照，属仓库级整理（与 PR #21 的 std-skills 迁移同范围）。

## 3. 本次就地补齐的缺口

webgame-prototype 的 SKILL.md §3 引用 `node scripts/contract-check.mjs` 做工程↔spec 一致性
门禁，但该脚本在仓库与技能包中**均不存在** —— game-9 是 webgame，这是后续实现/验收链上
真实会调用的门禁工具。已补齐：

- `​.myrd-platform/.claude/skills/webgame-prototype/scripts/contract-check.mjs`
  断言：实体 `script` / 关卡 `scene` / 验收 `check` 落点文件存在；`entity.id`、`level.id`
  全局唯一；`<level.id>/<element.id>` 关卡内唯一（可视化编辑精确落点的前提）；`spec.numeric`
  非空 → `src/numeric.js` 必须存在。退出码 0 = 通过 / 1 = 契约违约 / 2 = 输入不可用。
- `​.myrd-platform/.claude/skills/webgame-prototype/scripts/contract-check-selftest.mjs`
  合成夹具回归：**10/10 用例符合预期**（3 正例 + 6 负例 + 1 环境负例），exit 0。

## 4. 对后续节点的指引

1. 实现前先导出 `​.myrd/spec/design-spec.json`，再以
   `node .myrd-platform/.claude/skills/webgame-prototype/scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .`
   作为提交前门禁。
2. 推箱子玩法本体（推动/点亮/Undo/Restart/5+ 关卡可解性）的验收口径以需求
   `cmupsx443003om9dh5dwd5w9u` 的 AC1–AC5 为准。
3. 涉及 3D 需求时按 webgame-prototype SKILL.md 转用 `threejs-game-dev`（本需求为 2D，不适用）。
