# spec.numeric 幂等核验记录 · 2026-09-27

> 节点：specnumeric → implement → deploy → playtest（AppHost cmuieq51i002am9gyfxqx06rl）。
> 输入：已拍板策划案 v1（game_design_specs.id=`cmuiiofl4004tm9gcmaz3sstp`，goal
> `cmuieq51k002cm9gysxbyppv7`，version=1，status=**approved**，source=`games/game-3@c679aa2`）。
> 结论先行：**spec.numeric 与工程实现逐项一致 → 判定幂等，未改任何数值与玩法代码**；
> 本节点产出 = 四项门禁在部署 commit 上复跑全绿 + Web 导出幂等校验 + 同 commit 重新部署（v7）+ 本记录。

## 一、数值对照表（spec.numeric ↔ 实现常量）

| spec.numeric 键 | 拍板值 | 实现落点 | 现值 | 判定 |
|---|---|---|---|---|
| `runSpeed` | 240 | `scripts/player.gd` `RUN_SPEED` | 240.0 | ✅ 一致 |
| `jumpVelocity` | -520 | `scripts/player.gd` `JUMP_VELOCITY` | -520.0 | ✅ 一致 |
| `gravity` | 1400 | `scripts/player.gd` `GRAVITY` | 1400.0 | ✅ 一致 |
| `maxFallSpeed` | 900 | `scripts/player.gd` `MAX_FALL_SPEED` | 900.0 | ✅ 一致 |
| `maxJumps` | 2 | `scripts/player.gd` `MAX_JUMPS` | 2 | ✅ 一致 |
| `coyoteFrames` | 6 | `scripts/player.gd` `COYOTE_FRAMES` | 6 | ✅ 一致 |
| `jumpBufferFrames` | 6 | `scripts/player.gd` `JUMP_BUFFER_FRAMES` | 6 | ✅ 一致 |
| `dartScore` | 1 | `autoload/game_state.gd` `DART_SCORE` | 1 | ✅ 一致 |
| `winBonus` | 10 | `autoload/game_state.gd` `WIN_BONUS` | 10 | ✅ 一致 |
| `jumpAirTime` | 2×520/1400≈0.743s | `player.gd` `JUMP_AIR_TIME`（派生常量） | 同式派生 | ✅ 一致 |
| world: `FALL_LIMIT_Y=420` | — | `player.gd` `FALL_LIMIT_Y` | 420.0 | ✅ 一致 |
| world: `START_POSITION(60,150)` | — | `player.gd` `START_POSITION` | Vector2(60,150) | ✅ 一致 |
| world: `goalX=4800` | — | `scripts/level.gd` `GOAL_X` | 4800.0 | ✅ 一致 |
| world: `trackEndX=5060` | — | `scripts/level.gd` `TRACK_END_X` | 5060.0 | ✅ 一致 |
| world: `spikeXs` 7 处 | 1000/1750/2020/2650/2920/3580/4550 | `level.gd` `SPIKE_XS` | 同 7 项同序 | ✅ 一致 |

补充：tip 相对 spec 生成点（c679aa2）新增的 §3C 调参工作台（`reset()` 重读
`__GAME_TUNING__`）是**运行时覆盖通道**，不改常量默认值；URL 只覆盖 `live_*`，
缺省合并回常量 —— 与 `tuning-params.md` 声明的「调参永不破坏冒烟口径」一致，
因此不影响幂等判定。派生量 `SINGLE_JUMP_GAP_MAX` 等由常量推导，随源常量一致而一致。

## 二、门禁复跑（部署 commit d09aab8 上，与本节点门禁同源脚本）

| 门禁 | 命令（脚本均为仓库内 std-skills/godot-game-dev/scripts/） | 结果 |
|---|---|---|
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-3` | `PREFLIGHT: PASS`（13 类检查，55 文件）exit 0 |
| smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=… smoke.sh games/game-3` | `godot-smoke: PASS`（断言标记齐全，无脚本错误）exit 0 |
| input-fuzz | `input-fuzz.sh games/game-3` | `GODOT_FUZZ: PASS` seed=20260913 batches=6 frames=239，exit 0 |
| playtest | `playtest.sh games/game-3` | `GODOT_PLAYTEST: PASS` 3 局 ×900 帧；score=3/0/6，first_reward≤2.92s，max_gap≤3.42s（阈值 10s） |

（spec.ac-5 口径的 GODOT_SMOKE_FRAMES=400 加严跑法此前已由 playtest 节点验证，本节点按门禁正式值 240 复跑。）

## 三、Web 导出幂等校验

- 命令：`godot --headless --path games/game-3 --export-release "Web" /tmp/export-check/index.html`
  （导出到临时目录，不覆盖仓库产物；导出前 `mkdir -p` 父目录）。
- 结果：8 个产物中 7 个 SHA-256 与已提交 `export/web/` **完全一致**
  （index.wasm / index.js / index.html / index.png / index.icon.png / index.apple-touch-icon.png / index.audio.worklet.js）。
- `index.pck`：字节数完全一致（2,557,296），哈希不同 —— pck 头部记录源文件 mtime，
  本工作区 checkout 时间不同所致，属元数据抖动；`git status` 干净证明仓库产物未被改动，
  部署侧继续使用已提交 pck（即线上 v6 已验证可玩的同一份）。
- 判定：**导出可复现，无产物变更需要提交**。

## 四、部署记录（本节点新增）

| 项 | 值 |
|---|---|
| HostedApp id | `cmuieq51i002am9gyfxqx06rl`（slug `game-3`，name 疾风忍者跑） |
| 本次 deployment id | `cmuip8rqw005cm9l6l2d0ohu1` |
| version | **v7**（部署后 HostedApp status=ready，current_deployment_id 指向 v7） |
| gitRef | `myrd/games-goal-cmuieq51k002cm9gysxbyppv7`（部署铁律：绝不用 main） |
| commit | `d09aab8`（与线上 v6 同 commit，幂等重建） |
| liveUrl | `https://leomac-studio.tail49399e.ts.net/apps/game-3/` |
| 部署后核验 | 入口与资产通道 200（见 §五）；Goal.artifacts 已回写 `deploy_playable` 条目（artifactId=deployment id） |
