# BLOCKED 上报：模板仓库未预置门禁脚本 playtest.sh

- 日期：2026-10-05
- 节点：scaffold→implement→deploy→playtest 主通道（《汽车连连看》，goal cmuv35n7o0051icry63ndtamn）
- 状态：**blocked（环境缺陷，等待运维补模板仓库）**
- detail：模板仓库未预置门禁脚本：std-skills/godot-game-dev/scripts/playtest.sh；请运维把模板仓库补上技能资产

## 缺失明细

| 缺失文件 | 要求来源 | 仓库实际状态 |
|---|---|---|
| `std-skills/godot-game-dev/scripts/playtest.sh` | 任务书「来源不可得」判定脚本集合（{preflight.py, smoke.sh, input-fuzz.sh, playtest.sh, resolve-godot.sh, mobile-web-smoke.mjs}） | **不存在**（工作区与 origin/main 均无，全历史无提交） |
| `std-skills/godot-game-dev/scripts/playtest_driver.gd` | playtest.sh 的配套驱动（新版技能包成对提供） | **不存在**（同上） |

## 核查证据（可复放）

```bash
# ① 文件系统层：仓库内无任何 playtest 资产
find . -name "*playtest*" -not -path "./node_modules/*" -not -path "./.git/*"
#   → 仅命中 .myrd-platform/.claude/skills/godot-game-dev/scripts/{playtest.sh,playtest_driver.gd}
#     （平台注入的阅读副本，任务书明令不得当判定脚本来源）

# ② git 跟踪层：当前分支未跟踪
git ls-files std-skills/godot-game-dev/scripts/
#   → gate-selftest.sh input-fuzz.sh input_fuzz_driver.gd mobile-web-smoke.mjs
#     mobile_smoke_selftest.mjs preflight.py preflight_selftest.py resolve-godot.sh smoke.sh
#   → 无 playtest.*

# ③ 远端最新基线：origin/main 也没有
git fetch origin && git ls-tree origin/main --name-only std-skills/godot-game-dev/scripts/
#   → 与 ② 相同清单，无 playtest.sh
git log --all --oneline -- "*playtest*"   # → 空（全历史从未有过）

# ④ 功能层：仓库内旧版技能包无任何脚本承担机器人试玩判定
grep -rniE "playtest" std-skills/godot-game-dev/   # → 零命中

# ⑤ 根因佐证：注入副本的 SKILL.md 是新版（资产表含 playtest.sh｜机器人试玩门禁 §4.5），
#    而仓库内同名 SKILL.md 为旧版 → 平台技能包已升级，模板仓库未同步。
git diff .myrd-platform/.claude/skills/godot-game-dev/SKILL.md
```

其余门禁资产校验结论（均满足，供复跑参考）：

- `std-skills/godot-game-dev/scripts/{preflight.py, smoke.sh, resolve-godot.sh, mobile-web-smoke.mjs, input-fuzz.sh}` 均已提交且不在 .gitignore（`git check-ignore` 退出码 1）。
- `.myrd/routines.yaml` 已含 `id: godot-smoke` 与 `id: mobile-web-smoke` 两条 routine → 按任务书要求未做任何改动。
- `std-skills/godot-game-dev/templates/minimal-2d/` 存在且含 assets/fonts 全局中文字体与 [gui] theme/custom_font 配置。

## 为什么立即 blocked 而不是继续 scaffold

1. 任务书硬约束：「缺任何一个 → status=blocked」「立即停止并回写 status=blocked，绝不要自己造」；且明令不得从注入目录复制脚本、不得自写等价判定器（被检方自写判定器 = 门禁失效）。
2. 本通道为 scaffold→implement→deploy→**playtest** 主通道，本地自检命令与判定协议均含 GODOT_PLAYTEST: PASS；缺 playtest.sh 则通道后段必然失败。现在上报比烧完 deploy/打回预算再失败代价小（「blocked 比空烧有用」）。
3. 因此本节点未创建 games/game-15/，避免留下与门禁纪律不一致的半成品。

## 请运维执行

把模板仓库的 godot-game-dev 技能资产同步到最新版，至少补齐：
- `std-skills/godot-game-dev/scripts/playtest.sh`
- `std-skills/godot-game-dev/scripts/playtest_driver.gd`
- 配套文档（references/preflight-checklist.md §4.5 节奏类代理指标等，与注入副本新版对齐）

补齐后重跑本节点即可；scaffold 起点模板 `templates/minimal-2d` 已确认可用。

## 附注：分支命名差异（不影响本上报）

- 任务书写目标分支 `myrd/games-goal-cmuv35n7o0051icry63ndtamn`；
- 工作区实际预置并检出的分支为 `myrd/game-15-goal-cmuv35n7o0051icry63ndtamn`（另一本地分支 `myrd/scaffold-implement-deploy-playtest-cmuv4ic8l0066icryudr7g1u5` 与运行 id 对应）。
- 本上报提交在当前预置分支上；重跑时请以平台实际检出的分支为准核对部署 gitRef。
