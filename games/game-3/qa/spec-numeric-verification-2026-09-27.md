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

## 五、线上核验（v7 现役部署，补齐本节）

> 资产通道为 **M1 网关文本契约**：壳页 `fetchAsset()` 以 `r.text()` 取
> `/apps/game-3/api/public/assets/<name>`，内容是 base64(gzip(产物))——
> 直接对响应做二进制哈希比对会得到假阴性（实测响应 3,387,472B ≠ 产物 2,557,296B），
> 必须 b64 解码 + gunzip 后再比对。

| 检查 | 方法 | 结果 |
|---|---|---|
| 入口 | `GET /apps/game-3/`（跟随 308 尾斜杠重定向） | 200，壳页《疾风忍者跑》（调参桥 + 引导脚本按 BASE_PATH 注入） |
| index.wasm / index.js / index.pck / index.html | `GET …/api/public/assets/<name>` | 全部 200 |
| index.pck 内容一致性 | 响应 b64 解码 + gunzip → SHA-256 | `c79d6f28…14f0b10e`，与提交产物**逐字节一致** |
| 平台侧现役 | `GET /api/v1/apphost/apps/cmuieq51i002am9gyfxqx06rl` | `currentDeploymentId=cmuip8rqw005cm9l6l2d0ohu1`（v7，status=running，commit d09aab8，gitRef=目标分支，triggeredById=目标 id） |
| Goal.artifacts 回写 | `GET /api/v1/goals/cmuieq51k002cm9gysxbyppv7` | `deploy_playable` 条目在位（index 16）：hostedAppId + deploymentId(v7) + liveUrl 三要素齐全，detail 与平台实况一致 |

## 六、节点重入复验（2026-09-27 第二次执行，幂等再确认）

> 本节点被重入执行。重入时零代码改动（HEAD 仍为 c1a0dae，工作区干净，与 origin 同步），
> 按幂等分支口径**全量重验**而非盲信本记录前文：

| 复验项 | 方法（判定脚本均为仓库内 std-skills/godot-game-dev/scripts/） | 结果 |
|---|---|---|
| spec.numeric 权威源 | `GET /api/v1/game-design-specs/approved?goalId=…`（id=cmuiiofl4004tm9gcmaz3sstp，v1，approved）直取 numeric+world，与 §一 对照表重比 | 15 项仍逐项一致，判定幂等 |
| preflight | `preflight.py games/game-3` | `PREFLIGHT: PASS`（56 文件）exit 0 |
| smoke | `GODOT_SMOKE_FRAMES=240 … smoke.sh games/game-3` | `godot-smoke: PASS`，日志 0 处 SCRIPT ERROR，exit 0 |
| input-fuzz | `input-fuzz.sh games/game-3` | `GODOT_FUZZ: PASS` seed=20260913 batches=6 frames=239，exit 0 |
| playtest | `playtest.sh games/game-3` | `GODOT_PLAYTEST: PASS` 3 局×900 帧：score=3/0/6，first_reward 2.65~2.92s，max_gap 3.00~3.42s（阈值 10s），反馈事件 17/17/18 |
| 导出幂等 | `--export-release Web` 至 /tmp/export-check 后逐文件 SHA-256 | 7/8 与提交产物一致；index.pck 字节数相同（2,557,296B）仅 pck 头 mtime 抖动；`git status` 干净 |
| 线上现役 | §五 同口径复测（入口 200、资产全 200、pck 解码哈希一致、v7 running） | 与 §五 结论一致，无漂移 |
| artifacts 回写 | Goal.artifacts `deploy_playable`（v7）三要素复核 | 在位且准确，无需改写 |

**重入结论：无任何数值/代码/产物变更，不产生新部署**——线上 v7 即本节点部署（内容与当前
HEAD 逐字节一致），重复重建只会制造冗余部署（见知识文档 §「504 冗余部署处置」）。
本轮增量 = 本节与 §五 的落盘补全（上轮记录在 §五 处被截断，引用悬空）+ 门禁新证。

## 七、节点第三次执行复验（2026-09-27，全量重验 → 幂等成立，v7 留任现役）

> 本节点再次重入（HEAD=bc6f839，工作区干净，与 origin 同步，0 领先 0 落后）。
> 按幂等分支口径再次全量重验（不盲信 §一~§六 前文），判定脚本均为仓库内
> `std-skills/godot-game-dev/scripts/`，本轮全部退出码 0：

| 复验项 | 方法 | 结果 |
|---|---|---|
| spec.numeric 权威源 | `GET /api/v1/game-design-specs/approved?goalId=…` 直取（id=cmuiiofl4004tm9gcmaz3sstp，v1，status=approved，updatedAt 2026-09-26T15:00:44Z 未变） | 15 项（runSpeed 240 / jumpVelocity −520 / gravity 1400 / maxFallSpeed 900 / maxJumps 2 / coyote 6 / buffer 6 / dartScore 1 / winBonus 10 / jumpAirTime 同式派生 / FALL_LIMIT_Y 420 / goalX 4800 / trackEndX 5060 / spikeXs 7 项同序）逐项一致 → **幂等，零数值改动** |
| preflight | `preflight.py games/game-3` | `PREFLIGHT: PASS`（13 类，56 文件）exit 0 |
| smoke | `GODOT_SMOKE_FRAMES=240 … smoke.sh games/game-3` | `godot-smoke: PASS` exit 0，日志 0 处 SCRIPT ERROR |
| input-fuzz | `input-fuzz.sh games/game-3` | `GODOT_FUZZ: PASS` seed=20260913 batches=6 frames=239，exit 0 |
| playtest | `playtest.sh games/game-3` | `GODOT_PLAYTEST: PASS` 3 局×900 帧：score=3/0/6，first_reward 2.65~2.92s，max_gap 3.00~3.42s（阈值 10s），反馈事件 17/17/18（与 §六 同种子同结果，确定性复现） |
| 导出幂等 | `--export-release "Web"` 至 /tmp/export-check，逐文件 SHA-256 | 7/8 与提交产物一致；index.pck 字节数同（2,557,296B）仅 pck 头 mtime 抖动；导出后 `git status` 干净 |
| 漂移检查 | `git diff --name-only d09aab8..HEAD`（v7 部署基线 → HEAD） | 唯一差异 = 本核验文档自身（qa/*.md）；`export/`、`scripts/`、`autoload/`、`scenes/`、`project.godot` 零漂移 |
| 线上现役 | `GET /api/v1/apphost/apps/cmuieq51i002am9gyfxqx06rl` + deployments 列表 | status=ready，currentDeploymentId=`cmuip8rqw005cm9l6l2d0ohu1`（v7，running，gitRef=目标分支，triggeredById=目标 id，createdAt 2026-09-26T18:04:30Z）；v5/v6 superseded |
| 线上健康 | `GET /apps/game-3/health`、`GET /apps/game-3/` | /health 200 `{"ok":true,"app":"ninja-run","assets":"lazy/object-storage"}`；入口 200 壳页《疾风忍者跑》 |
| 资产通道 | `GET /apps/game-3/api/public/assets/index.pck` → b64 解码 + gunzip → SHA-256 | 200（wire 3,387,472B）→ 解码 `c79d6f28…` 与提交产物逐字节一致（MATCH） |

**第三次执行结论：spec.numeric 幂等成立且实现侧零改动；线上 v7 的工程内容与当前 HEAD
逐字节一致（漂移检查 + 资产解码双证），故维持 v7 现役、不发起重复部署（冗余部署处置纪律）。
本节点交付 = 本节落盘 + artifacts 回写引用 v7 现役部署。**

## 八、节点第四次执行复验（2026-09-27，幂等成立，v7 留任现役 + 双帧预算 playtest 交叉验证）

> 本节点第四次重入（HEAD=9c40898，工作区干净，HEAD 与 origin/FETCH_HEAD 同步，零领先零落后）。
> 仍按幂等分支口径全量重验（不盲信 §一~§七 前文），判定脚本均为仓库内
> `std-skills/godot-game-dev/scripts/`，本轮全部退出码 0：

| 复验项 | 方法 | 结果 |
|---|---|---|
| spec.numeric 权威源 | `GET /api/v1/game-design-specs/cmuiiofl4004tm9gcmaz3sstp` 直取 | version=1，status=**approved**，updatedAt=2026-09-26T15:00:44Z（无新 revision：两次 revise_design_spec 节点失败于「未支持的操作类型」，spec 仍为 v1 基线） |
| 数值对照 | spec.numeric + spec.world ↔ player.gd / game_state.gd / level.gd 常量 | 15 项逐项一致（runSpeed 240 / jumpVelocity −520 / gravity 1400 / maxFallSpeed 900 / maxJumps 2 / coyote 6 / buffer 6 / dartScore 1 / winBonus 10 / jumpAirTime 同式派生 / FALL_LIMIT_Y 420 / START_POSITION(60,150) / goalX 4800 / trackEndX 5060 / spikeXs 7 项同序）→ **幂等，零数值改动** |
| 四门禁 | `bash games/game-3/verify.sh`（HEAD 9c40898 上） | `verify: PASS` exit 0：preflight PASS（13 类 56 文件）/ smoke PASS（240 帧）/ input-fuzz PASS（seed=20260913 batches=6 frames=239）/ playtest PASS（3 局×1200 帧，routine 默认帧预算） |
| playtest 双帧预算 | routine 默认 1200 帧 + 前两轮口径 900 帧各复跑一次 | 1200 帧：fb=24/25/28，first_reward 2.65~2.92s，max_gap 3.00~3.42s（阈值内）；900 帧：**score=3/0/6、fb=17/17/18 与 §六/§七 确定性复现**（帧预算不同只改变种子化输入时间线的得分轨迹，节奏指标两口径均绿，无回归） |
| 导出幂等 | `--export-release "Web"` 至 /tmp/export-check4，逐文件 SHA-256 | 7/8 与提交产物一致（html/js/wasm/png/icon/touch-icon/audio-worklet）；index.pck 哈希不同但字节数同（2,557,296B）= pck 头 mtime 抖动；导出后 `git status` 干净 |
| 漂移检查 | `git diff --name-only d09aab8..HEAD` | 唯一差异 = qa 核验文档自身；工程目录零漂移（与 §七 结论一致） |
| 线上健康 | `GET /apps/game-3/`（跟随 308）、`GET /apps/game-3/gw/health` | 入口 200 壳页《疾风忍者跑》（title 实测）；/health 200 |
| 资产通道 | `GET /apps/game-3/api/public/assets/{index.pck,index.wasm,index.js}` | 全 200（pck wire 3,387,472B / wasm 10,696,408B / js 331,495B=提交产物同字节数）；pck b64 解码+gunzip → 2,557,296B，SHA-256 `c79d6f28e177463e…` 与提交产物**逐字节 MATCH** |

**第四次执行结论：幂等第三次复验成立，实现侧零改动；线上 v7（deploymentId=
`cmuip8rqw005cm9l6l2d0ohu1`，HostedApp `cmuieq51i002am9gyfxqx06rl`，liveUrl
`https://leomac-studio.tail49399e.ts.net/apps/game-3/`）资产通道解码与当前 HEAD 导出逐字节
一致 → 维持 v7 现役、不发起冗余部署。试玩量表仍为「待用户试玩」（用户结论未回填，
不伪造）；spec 无新拍板 revision，无 tuning_applied 可回写。**
