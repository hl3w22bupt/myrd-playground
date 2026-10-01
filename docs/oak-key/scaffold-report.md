# oak-key 脚手架节点交接报告（scaffold）

- 日期：2026-10-02 · 节点：scaffold→implement→deploy→playtest 全流程之 scaffold
- 工程落位：`games/oak-key`（Godot 4.3，未迁移未改名）
- 分支：`myrd/oak-key-goal-cmupsfn0q001um9dhlko9t5e0`（平台实际检出分支）
  = `myrd/games-goal-cmupsfn0q001um9dhlko9t5e0`（任务指定部署 gitRef）
  两分支指向同一提交 `505e27e`，部署用后者，绝不用 main。
- 提交：`feat(oak-key): Godot 4 取证探针工程脚手架 —— 拾取/校验/取证/重开闭环可过门禁`（27 文件 / +1527）

## 门禁证据（本机 Godot 4.3.stable.official.77dcf97d8）

| 门禁 | 命令（与 routines.yaml 同源） | 结果 |
| --- | --- | --- |
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/oak-key` | PASS（13/13，27 文件） |
| headless-smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=… bash …/smoke.sh games/oak-key` | 退出码 0，日志含 `GODOT_SMOKE: PASS`，无 SCRIPT ERROR；**全程 5.4s ≤ 30s** |
| input-fuzz | `GODOT_BIN=… bash …/input-fuzz.sh games/oak-key` | `GODOT_FUZZ: PASS`（seed=20260913） |
| 工程入口 | `bash games/oak-key/verify.sh` | 退出码 0（上述三步串跑） |

判定脚本全部来自仓库内 `std-skills/godot-game-dev/scripts/`，本节点只校验、未产出/未改写。

## 玩法闭环（验收标准 3）与取证标记

- 输入 → 移动：WASD/方向键（触摸端摇杆）；探测：空格/回车/触摸「探测」；重开：R/触摸「重开」。
- 拾取：`scripts/key_fragment.gd`（Area2D）→ `GameState.register_fragment`。
- 校验：`scripts/oak_key_validator.gd::validate()` —— 白名单 `OA/K7/42` 顺序敏感，
  伪造片段 `X9` 一旦拾取必判无效；未集齐 / 顺序错 / 含伪造分别给出可读 reason。
- 反馈：`main.gd::_on_probe_finished` 同帧渲染结果面板（冒烟实测 79 物理帧 ≈ 1.3s 预算内，实际同帧）。
- 取证标记（双路可检索）：
  - 日志：`OAK_KEY_PROBE oak_key_probe=valid probe_count=1 fragments=3/3 decoy=false key=oak-OA-K7-42 reason=校验通过`
  - 存档：`user://oak_key_probe.json` 的 `oak_key_probe` 字段（valid|invalid）。
- 冒烟断言：噪声相位（悬挂手势/孤儿释放/双指抢控/乱键，种子固定）之后仍依次通过
  静态接线 → 移动 → 拾取×3 → 探测=valid → 重开复位 → 空手探测=invalid。

## 统计隔离（验收标准 5 的工程侧标记）

`project.godot` 的 `config/name` / `config/description` 与 `games/oak-key/README.md` 均声明
「取证探针 · 不计入三样例」。三样例统计口径（看板/脚本）需继续排除 `games/oak-key`，交由统计侧节点复核。

## 已知缺口（不阻塞，供后续节点）

1. **`std-skills/godot-game-dev/scripts/playtest.sh` 未在仓库预置**（仅平台注入目录里有阅读副本）。
   仓库 `.myrd/routines.yaml` 的 `godot-smoke` routine（本工作流门禁）只含
   availability / preflight / headless-smoke / input-fuzz 四步，未引用 playtest，故门禁不受影响；
   若后续 playtest 节点要跑 `GODOT_PLAYTEST` 机器人试玩，需运维把该脚本补进模板仓库
   （不得由被检工程自造判定器）。
2. `routines.yaml` 的 `game-contract` routine 引用 `scripts/contract-check.mjs`，仓库无该脚本
   （直通车核验报告已记）。需要契约门禁时先落地。
3. `routines.yaml` 默认 `gamePath: games/godot-coin-rush` 不存在 —— 本工作流门禁已按
   preHookParams 传 `games/oak-key`，配置未改动。
4. Web 导出与 AppHost 部署（`apphost.toml` 当前指向 `games/game/export/web`、name=candy-crush-legend）
   属 deploy 节点范围：需为 oak-key 建独立应用清单（slug `oak-key`，AppHost id `cmupsflsj001sm9dhxt6w1oal`），
   不要复用糖果工程清单。
