# scaffold 节点重跑校验（run cmvyo0q8d004zm9y0qyxgx5st · 2026-11-02）

> 本目录是本轮工作流（run `cmvyo0q8d004zm9y0qyxgx5st`，项目 `cmvqriupu0007m9qphvokoci9`，
> 目标 `cmvxjycvn001zm905jnwpyliv`）**scaffold 节点**的独立证据。
> 该目标的骨架在更早轮次已完整立起并一路推进到 v14（分支
> `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv` @ `aa1781bffd8a128631151d0f360b9742b5c8370a`，
> 工程 `games/myrdplaygrou`）。本轮 scaffold 节点沿用上一轮判例（见
> `../20261102-scaffold-rerun-verify/SUMMARY.md`）：**骨架沿用既有产出、不回退、不重铺、门禁实证** ——
> 对分支 tip 独立重跑全部本地门禁取证；任何一步非绿都会按门禁纪律打回修复，不允许带病交付。

## 1. 为什么不重新从模板复制（含本轮探索过程留痕）

- 任务第 2 步要求「以 `templates/minimal-2d` 为起点复制到 `games/myrdplaygrou/`」的前提是工程不存在；
  本分支上 `games/myrdplaygrou/` 已是 **v3→v14 完整实现**（八关 + 无尽 + 出战卡 + 夜幕剪影 +
  坦克巨尸碾压 + 星级结算 + 音频真实出声链路 + 移动端门禁收敛），且最初就是以同一模板工程为起点搭建
  （工程内 CLAUDE.md 即模板随工程规则原件，未删除）。
- **本轮实际发生并已纠正的过程**：工作区初始 clone 基于 main（`9fbc1dc`），不含目标分支内容；
  节点按字面步骤从模板重铺了一套骨架（commit `9da6a02`，本地保留在 scratch 分支
  `scratch/template-scaffold-run-cmvyo0q8d004`，**未推送**）。推送时被远端拒（非 fast-forward）
  才发现远端已有本目标的成熟分支 —— 对照上一轮同节点判例确认：从模板覆盖 = 把 v3/v14 的
  八关实现回退成 60 秒 demo，属**破坏性回归**，已弃用该探索稿并 `reset --hard` 对齐远端 tip。
  本节点完成标准（project.godot / smoke.tscn / style-card 三段 / 门禁全绿）在既有产出处全部已满足。
- 因此本轮产出 = 门禁资产来源校验 + 四门禁独立复跑取证（本目录），骨架零改动。

## 2. 门禁资产来源校验（只校验、不产出）

| 资产 | 状态 |
|---|---|
| `std-skills/godot-game-dev/scripts/{preflight.py, smoke.sh, resolve-godot.sh, mobile-web-smoke.mjs}` | 仓库内已提交（`git ls-files` 13 个脚本文件全跟踪，未被 .gitignore；注入目录 `.myrd-platform/…` 只是阅读副本，未当判定来源） |
| `std-skills/godot-game-dev/scripts/{input-fuzz.sh, playtest.sh}`（含两个 driver） | 同上 |
| `templates/minimal-2d/` 模板（含 assets/fonts 中文字体 + [gui] custom_font） | 在库；工程内字体与 [gui] 配置原样保留（preflight P13/P13b 绿） |
| `.myrd/routines.yaml`（id=godot-smoke **与** id=mobile-web-smoke） | 在库且两条俱全，本轮**未改动**（gamePath/liveUrl 由工作流 preHookParams 注入） |

## 3. 本地四门禁复跑（分支 tip `aa1781b`，全部独立重跑，零自造判定器）

环境：Godot `4.3.stable.official.77dcf97d8`（resolve-godot.sh → `godot`，exit 0）。

| 门禁 | 命令（与 .myrd/routines.yaml godot-smoke 同源） | 结果 | 证据 |
|---|---|---|---|
| resolve-godot | `bash std-skills/godot-game-dev/scripts/resolve-godot.sh` | exit 0（godot-version.txt） | godot-version.txt |
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/myrdplaygrou` | **`PREFLIGHT: PASS`**（15 类，2654 个工程文件） | preflight.log |
| headless-smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=… bash …/smoke.sh games/myrdplaygrou` | **exit 0 + `godot-smoke: PASS`**（退出码 0，断言标记齐全，日志无脚本错误） | smoke-wrapper.log |
| input-fuzz | `GODOT_BIN=… bash …/input-fuzz.sh games/myrdplaygrou` | **`GODOT_FUZZ: PASS`**（seed=20260913，6 批次 239 帧） | fuzz.log |
| playtest | `GODOT_BIN=… bash …/playtest.sh games/myrdplaygrou` | **`GODOT_PLAYTEST: PASS`**（3 局 ×900 帧，fb=227/245/237，最长无反馈窗 ≤0.38s，阈值 tests/playtest.json） | playtest.log |

smoke 逐关证据行（本次复跑实测，与 `20261102-scaffold-rerun-verify` 轮逐行一致 = 确定性复现）：

```
[smoke] 第 1 关通关（game_ended=true，主按钮 next，波次 4/4，★3，hpScale 1.00）
…（2-7 关逐关通过）…
[smoke] 第 8 关通关（game_ended=true，主按钮 replay，波次 10/10，★3，hpScale 2.85）
[smoke] 无尽模式探针通过（入口可见、波次无限、强度 285.0→307.8、巨尸混编）
GODOT_SMOKE: PASS 选关/选关空白落点反馈/四轴方向移动/教学引导/布防/出战卡/提示淡出/射击/掉落收集/失败/重开/下一波/八关逐关通关/关卡推进/逐关难度生效/夜幕剪影/坦克巨尸碾压/星级结算/无尽模式/键位契约/内容表/难度曲线锚点/对比度/音频契约与bus音量/调参协议 全部通过
```

## 4. scaffold 完成标准对照

| 完成标准 | 状态 |
|---|---|
| 门禁脚本四件套（+fuzz/playtest）在仓库内、非注入副本 | ✅ §2 |
| `games/myrdplaygrou/project.godot` 存在（`config/name="植物人大战僵尸-网页版"`） | ✅ |
| `games/myrdplaygrou/tests/smoke.tscn` 存在（断言覆盖移动/核心交互/胜负/重开，另含八关通关、对比度、音频契约等 25 类） | ✅ |
| `games/myrdplaygrou/.myrd/style-card.md`：palette / ui / 形状语言 / 反例（禁忌）俱全 | ✅（v3 卡 `flat-bright-pvz`；风格参考图=无，按固定参数不设参考图段） |
| 工程根 `verify.sh` 薄壳门禁入口（只调用仓库判定脚本，零自造逻辑） | ✅ |
| 本地门禁命令退出码 0 且日志含 `GODOT_SMOKE: PASS` | ✅ §3 |
| `.myrd/routines.yaml` 含 godot-smoke 与 mobile-web-smoke | ✅ 未改动 |

## 5. 分支纪律与证据钉扎

- 本轮全部产出落在目标功能分支 `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`
  （部署 gitRef 即此分支；不触碰 main）。工作区初始被置于 run 分支，已切回目标分支后作业。
- 本 SUMMARY 证据钉扎 commit：`aa1781bffd8a128631151d0f360b9742b5c8370a`（复跑时的分支 tip）。
- 门禁判定脚本本轮**零编写、零改写、零等价替代**；证据采集用的
  `godot --headless --path games/myrdplaygrou --quit-after 240 tests/smoke.tscn`
  为技能包 SKILL.md §4.1 的标准运行形态，仅作日志取证，判定一律以 smoke.sh/fuzz/playtest
  的退出码与标记为准。
- 弃用的模板探索稿 `9da6a02` 只存在于本地 scratch 分支（未推送、未合并），不在本分支历史中 ——
  防止任何形式的破坏性回归进入共享分支。
