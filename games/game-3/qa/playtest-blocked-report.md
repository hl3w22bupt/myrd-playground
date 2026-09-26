# playtest 节点 blocked 上报（iterate/rerun · 2026-09-26）

> 节点目标：运维补齐 playtest 套件后 iterate/rerun，仅重跑 playtest 节点交付试玩验收包（GODOT_PLAYTEST）。
> 结论：**status = blocked** —— playtest 套件仍未预置进模板仓库，按「来源不可得 → 立即 blocked」硬约束停止，不自造判定器。

## 一、上报 detail（照纪律模板）

模板仓库未预置门禁脚本：std-skills/godot-game-dev/scripts/playtest.sh（及 playtest_driver.gd）；请运维把模板仓库补上技能资产。

## 二、缺失证据（本轮实测）

| 资产 | 状态 | 证据 |
|---|---|---|
| std-skills/godot-game-dev/scripts/playtest.sh | **缺失** | `test -f` 不存在；直接调用退出码 127（No such file or directory） |
| std-skills/godot-game-dev/scripts/playtest_driver.gd | **缺失** | 同目录无此文件 |

穷尽核验范围（均为 2026-09-26 本轮执行时点）：
1. 本地工作树 std-skills/godot-game-dev/scripts/：仅 preflight.py / smoke.sh / input-fuzz.sh / resolve-godot.sh / input_fuzz_driver.gd / gate-selftest.sh / preflight_selftest.py，无 playtest*。
2. `git ls-tree -r origin/main` 全树 grep playtest：0 命中；origin/main HEAD = a15f66b（2026-09-21，PR #21），运维此后未推送。
3. `git ls-remote` 全部远端分支逐一 `git ls-tree` 扫描：无任何分支含 std-skills/godot-game-dev/scripts/playtest*。
4. 平台注入副本 .myrd-platform/.claude/skills/godot-game-dev/scripts/ **有** playtest.sh + playtest_driver.gd（2026-09-26 23:43 注入）——按门禁纪律它只是阅读副本，不得当判定脚本来源，也严禁复制进仓库充当仓库资产，故不采用。

## 三、在位门禁基线（本轮实测，除 playtest 外全绿）

| 门禁 | 命令 | 结果 |
|---|---|---|
| resolve-godot | `bash std-skills/godot-game-dev/scripts/resolve-godot.sh` | 退出码 0，Godot 在 PATH |
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-3` | **PREFLIGHT: PASS**（13 类全过，47 个工程文件） |
| smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=… smoke.sh games/game-3` | 退出码 0，**godot-smoke: PASS**（断言标记齐全，无脚本错误） |
| input-fuzz | `GODOT_BIN=… input-fuzz.sh games/game-3` | 退出码 0，**GODOT_FUZZ: PASS**（seed=20260913 batches=6 frames=239） |
| playtest | `playtest.sh games/game-3` | **退出码 127（脚本不存在）→ blocked 依据** |

工程本体（games/game-3：场景/脚本/冒烟/导出产物/qa 包）完好，工作树干净，上一轮交付未被破坏。

## 四、解除条件与后续

- 运维把 playtest.sh + playtest_driver.gd 推入模板仓库并合入 main → 本工作区 rebase/merge main 后重跑本节点：
  `GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" bash std-skills/godot-game-dev/scripts/playtest.sh games/game-3`
  以退出码 0 且日志含 GODOT_PLAYTEST: PASS 为通过，随后交付试玩验收包（可在 games/game-3/verify.sh 增补第 4 步调用）。
- 重申红线：不修改/不新建任何门禁判定脚本；不从注入目录复制；不放松断言；不伪造 PASS。
- 注：目标分支 myrd/games-goal-cmuieq51k002cm9gysxbyppv7（部署 gitRef）与本 run 工作分支 myrd/game-3-goal-cmuieq51k002cm9gysxbyppv7 并存，本报告仅提交到当前 run 分支，不动部署分支。

---

## 五、解除记录（2026-09-27，playtest rerun 本轮）

**本 blocked 已解除，套件确已由运维预置进项目仓库**——上一轮 §2 的「穷尽核验」结论需要修正一处：
运维提交 `3a74213f`（2026-09-26 23:18 +0800，早于本报告提交时间 23:48）把 playtest 套件推在了
分支 `myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg-playtest`（game-4 的 playtest 迭代分支，另有同内容的
PR #27 开往 main）——上一轮扫描时该提交已存在但未被纳入核验范围（当时只扫了 main 与既有分支树的
本地引用），特此更正并致意：运维履约在先，核验有盲区在后。

本轮处置（全部合规，未自造/未改判定器）：
1. `git cherry-pick 3a74213f`（commit `278d9af`，作者保留为运维）把 playtest.sh + playtest_driver.gd
   落到权威路径 `std-skills/godot-game-dev/scripts/`；sha256 三方一致（运维 -playtest 分支 = PR #27 =
   平台注入阅读副本），未从注入目录复制任何字节。
2. 工程侧补 §3B 模板协议（autoload Juice + 反馈接线 + tests/playtest.json + 冒烟断言 13/14 +
   verify.sh 第 4 步 + routines.yaml playtest step），过程与负例探针证据见 `PLAYTEST.md`。
3. 复跑结果：`GODOT_PLAYTEST: PASS`（3 种子 × 1200 帧），verify.sh 四步退出码 0。
4. §四的复跑预期已兑现；「可在 verify.sh 增补第 4 步」的建议已落地。
