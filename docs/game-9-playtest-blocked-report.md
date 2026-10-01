# game-9 playtest 节点 blocked 报告：模板仓库未预置门禁脚本 playtest.sh

- 日期：2026-10-02
- 目标：cmupsrc19002sm9dhp5su0zaj（《推箱子点亮方块解谜：把箱子推到目标点，点亮所有方块》）
- 节点：scaffold→implement→deploy→playtest 主通道 · playtest（试玩验收）
- 结论：**status = blocked**（回写目标 artifacts，op=playtest_kit / artifactType=playtest_kit / status=blocked）

## 一、blocked 判定原文

> 模板仓库未预置门禁脚本：std-skills/godot-game-dev/scripts/playtest.sh；请运维把模板仓库补上技能资产。

## 二、判定依据（本节点硬约束）

playtest 节点开工前置要求以下判定脚本**全部由项目仓库（模板仓库）预置**，缺任何一个 → status=blocked，
且严禁现场自造、拷贝注入副本或用等价命令替代（它们是判定器，被检方自己写门禁即失去独立性）：

```
std-skills/godot-game-dev/scripts/{preflight.py, smoke.sh, input-fuzz.sh, playtest.sh, resolve-godot.sh}
```

实测：前 4 个在位，`playtest.sh` 缺失 → 触发 blocked。

## 三、证据链

1. **工作区仓库（分支 myrd/games-goal-cmupsrc19002sm9dhp5su0zaj @ 19a6d59）**：
   `std-skills/godot-game-dev/scripts/` 实际清单 = gate-selftest.sh、input-fuzz.sh、input_fuzz_driver.gd、
   preflight.py、preflight_selftest.py、resolve-godot.sh、smoke.sh —— **无 playtest.sh / playtest_driver.gd**。
2. **远端模板仓库**（origin/main，WORKSHOP_GAME_TEMPLATE_REPO=hl3w22bupt/myrd-playground，已 `git fetch` 后核对）：
   同样无 playtest.sh —— 排除「本地分支落后于模板仓库」的可能，属模板仓库本身未预置。
3. **历史**：`git log --all -- std-skills/godot-game-dev/scripts/playtest.sh` 为空（从未存在过）。
4. **全仓库搜索**：`find . -name '*playtest*'` 仅命中 `.myrd-platform/.claude/skills/godot-game-dev/scripts/`
   （playtest.sh + playtest_driver.gd）——该目录是**平台注入的阅读副本**，按硬约束不得作为判定脚本来源；
   本次未拷贝、未改写仓库内任何脚本。
5. **前序节点旁证**：deploy 产物（goal artifacts[3]）已记录「playtest.sh 未在仓库 std-skills/godot-game-dev/scripts/
   预置（门禁 preHook 不含该步，未现场补写）」。

## 四、根因：平台技能包与模板仓库版本差

- 平台注入副本（较新版技能包）含**机器人试玩门禁** playtest.sh + playtest_driver.gd：
  协议 `GODOT_PLAYTEST: PASS / FAIL <原因>`（退出码 0/1，2=环境不可用）、`GODOT_PLAYTEST_METRICS: <JSON>`，
  跑 bot 多局游玩输出节奏代理指标（首次奖励 / 无反馈窗口 / 反馈密度 / 局间方差）——
  「好玩下限」的机器可判部分；阈值由工程内 tests/playtest.json 覆盖。
- 模板仓库预置基线（v1）只有四脚本，仓库内 `references/godot-smoke-routine.md` 与 `.myrd/routines.yaml`
  的 id=godot-smoke routine 也只有 resolve-godot → preflight → headless-smoke → input-fuzz 四步，无 playtest 步。
- 结论：模板仓库技能资产落后于平台技能包，需**运维补模板仓库**（运维动作，非 agent 现场自造）。

## 五、影响面

- **受影响**：playtest 节点机判前置（机器人试玩门禁）不可执行；按「立即停止」纪律，
  本轮**不交付**试玩验收包（试玩指引 + 四问量表 + 调参工作台入口），目标停下等运维补资产后重跑本节点。
- **不受影响**：deploy 产物有效——liveUrl=https://leomac-studio.tail49399e.ts.net/apps/game-9/
  （deploymentId=cmupxibnn0087m9dhz3cfhap4，gitRef=myrd/games-goal-cmupsrc19002sm9dhp5su0zaj，app.status=ready），
  游戏本体仍可访问；godot-smoke 门禁（四步版）此前已全过。

## 六、修复路径

1. 运维把模板仓库技能资产补齐：`std-skills/godot-game-dev/scripts/playtest.sh`、`playtest_driver.gd`
   （建议连同 SKILL.md 对应章节与 godot-smoke-routine.md 模板同步，保持脚本/文档/routine 三者一致）。
2. 模板仓库更新后，同步进项目仓库的 `std-skills/godot-game-dev/scripts/`（仍由模板预置链路带入，不得手抄注入副本）。
3. 重跑 playtest 节点 → 交付 op=playtest_kit 试玩验收包（含 `<liveUrl>?tuning=1` 调参工作台入口）。

## 七、试玩量表与 spec 回写状态

- 四问量表：**待用户试玩（未回填）**。
- 第 3 步（试玩结果 → GameDesignSpec revisions 回写 + approve 拍板）：**跳过**——本节点未收到任何用户试玩结论，
  未做任何 spec 数值变更，未伪造任何试玩结论。
