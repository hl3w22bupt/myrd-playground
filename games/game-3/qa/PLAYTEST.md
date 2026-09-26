# 《疾风忍者跑》机器人试玩验收包（qa/PLAYTEST.md）

> 2026-09-27 由「实现玩法」节点（playtest rerun）交付。前置：上一轮该节点因
> 「playtest 套件未预置」blocked（见 `playtest-blocked-report.md`）；本轮运维套件已落仓库，解除阻塞。
> **结论先行：`GODOT_PLAYTEST: PASS`（3 种子 × 1200 帧/局全部通过），四步门禁全绿。**

## 一、套件来源与合规声明（门禁纪律）

| 事项 | 口径 |
|---|---|
| 判定器 | `std-skills/godot-game-dev/scripts/playtest.sh` + `playtest_driver.gd` |
| 来源 | 运维提交 `3a74213f`（2026-09-26 23:18 +0800，「逐字节复制 + sha256 校验」）cherry-pick 落库（本仓 commit `278d9af`，**作者保留为运维**） |
| 一致性三方验证 | 运维 -playtest 分支 = PR #27 = 平台注入阅读副本，`playtest.sh` sha256 `23c3051a…`、`playtest_driver.gd` sha256 `191411e5…` 完全一致 |
| 红线 | 未自造、未改写任何判定器；未把注入目录当来源（本轮起套件已是仓库资产，无需触碰注入副本）；阈值取内置默认，无放松 |

## 二、门禁结果（2026-09-27 实测，`bash games/game-3/verify.sh` 退出码 0）

| 步骤 | 判定器 | 结果 |
|---|---|---|
| preflight | `preflight.py games/game-3` | **PASS**（13 类，53 文件） |
| smoke | `smoke.sh games/game-3`（240 帧） | **PASS**（14 组断言，含本轮新增「Juice 反馈总线」「重开防误触」，无脚本错误） |
| input-fuzz | `input-fuzz.sh games/game-3` | **PASS**（seed=20260913，batches=6，无脚本错误） |
| playtest | `playtest.sh games/game-3`（1200 帧/局） | **PASS**（3 局全部通过，指标见下） |

## 三、试玩指标明细（`GODOT_PLAYTEST_METRICS` 原始单行 JSON 见门禁日志）

| 局 | 种子 | 首次得分事件 | 最长无反馈窗口 | 反馈事件数 | 终局得分 |
|---|---|---|---|---|---|
| 1 | 20260913 | 2.80s | 3.12s | 24 | 0 |
| 2 | 20260914 | 2.65s | 3.42s | 25 | 0 |
| 3 | 20260915 | 2.92s | 3.00s | 28 | 0 |

阈值（`tests/playtest.json`，与判定器内置默认一致 = 显式钉住不放松）：
`first_reward_seconds_max=10s`、`feedback_gap_seconds_max=10s`、`feedback_events_min_per_run=2`、
`seed_outcomes_min_distinct=1`（只记录不硬判；策划案经 revisions API 定稿 replayHooks 后可设 2）。

局时长 1200 帧 = 60 tick × 20s（赛道全程 4800px ÷ 240px/s，`run_speed` 默认值），
由 `.myrd/routines.yaml` 的 `playtestFrames: 1200` 与 `verify.sh` 默认同值下发。
注：`tests/playtest.json` 未写 `frames_per_run`——判定器对 JSON 数值做 `is int` 门控而
Godot JSON 解码恒为 float，写了也会被静默忽略；局时长一律走参数/环境变量（判定器未改，行为如实记录）。

## 四、本轮试玩真实发现与修复（不是空跑：门禁抓出了一个真缺陷）

**修复前实测**：bot 三局 `score=0`、`first_reward=0.42s`、反馈事件 89-91/局。追因：
bot 的随机输入流约 0.6s 就按到一次 R，而旧版 `restart_run()` 在奔跑中无条件受理——
**角色刚跑出 144px 就被静默拽回出生点**，20 秒内从未到达第一枚飞镖（x=420）。
`first_reward=0.42s` 是重开触发的 `score_changed(0)` 伪事件，反馈密度全靠重开音效调用点。
这在真实玩家侧是同款 UX 缺陷：自动跑酷不控方向，键盘误触 R = 进度全丢且无任何确认。

**修复**（跑酷惯例：结算界面才提供重开）：`scripts/main.gd` 的 restart 受理条件加
`GameState.state != PLAYING`；结算弹层「按 R / 回车 重开一局」文案与之配套；
触摸「重开」按钮走同一 `_unhandled_input` 路径，行为一致。
冒烟新增第 14 组断言钉死该语义（奔跑中按 R 必须被忽略）。

**修复后实测**（上表）：bot 每局真实推进 ≈2.4s 到坑1 坠落 → 结算反馈（flash+音效）→ 重开，
循环反复可玩且全程无静默窗口；`first_reward 2.65-2.92s` 为死亡→重开循环的真实节奏。

**如实记录的边界**：终局得分 0 是**随机 bot 的技术上限**，不是收集玩法缺陷——
bot 不会像人一样「贴边小跳」收低空飞镖，且高频乱跳使其长期处于飞镖可达带之外；
收集机制本体由冒烟断言 8 单独证明（传送玩家到飞镖上 → 加分 + score_changed 到达 + 收集反馈在播）。
「好不好玩」按 §4.5 边界留给人 + 调参工作台（`tuning-params.md`）。

## 五、负例探针证据（断言「拦得住」，还原后「不误报」）

| 探针 | 注入缺陷 | 门禁结果（签名） | 还原后 |
|---|---|---|---|
| A | project.godot 注释掉 `[autoload] Juice` 注册 | smoke exit 1：`FAIL autoload Juice 未注册（§3B 反馈协议 / playtest 门禁模板协议缺失）`；playtest exit 1：`FAIL autoload Juice 未注册（反馈单例缺失…）`（fail-closed） | smoke / playtest 复绿 PASS |
| B | 注释 main.gd 全部 7 处 `Juice.` 反馈接线（单例保留） | playtest exit 1：`FAIL 第 1 局反馈事件 0 < 下限 2 —— 反馈密度不足（玩起来是哑的）`＋`FAIL 最长无反馈窗口 20.0s > 阈值 10s —— 节奏断档` | 复绿 PASS |
| C | 拆掉 restart 的「结算后受理」条件 | smoke exit 1：`FAIL 奔跑中按 restart 触发了重开（x 228.0 → 68.0）：进度被静默清掉…`（抓现行） | 复绿 PASS |

探针全部针对**工程代码**注入，判定器零改动；三探针的中间产物未入库（工作树已还原干净）。

## 六、复跑方式

```bash
# 单跑 playtest（判定器唯一来源 = 仓库 std-skills/）
GODOT_PLAYTEST_FRAMES=1200 GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/playtest.sh games/game-3

# 四步门禁一把跑（preflight → smoke → fuzz → playtest）
bash games/game-3/verify.sh
```

门禁配置：`.myrd/routines.yaml` 的 `godot-smoke` routine 已增补 `playtest` step
（片段照抄仓库内 `references/godot-smoke-routine.md`，本轮已把该模板同步到含 playtest 步的版本；
`playtestFrames` 默认 1200，preHookParams 可按工程覆盖）。

## 七、工程侧为接入 playtest 补的模板协议（§3B / §4.5）

| 交付物 | 内容 |
|---|---|
| `autoload/juice.gd`（新增） | 模板反馈单例：`feedback_fired` 信号 + `events` 环形记录 + `pop/flash/shake/hit_stop/sfx` API；`SFX_BANK` 留空 = 调用点先钉、音效资产后补（`&"score"/&"fail"/&"confirm"` 三处调用点已落） |
| `project.godot` | `[autoload]` 注册 `Juice`（模板固定接线项） |
| `scripts/main.gd` | 四类结果事件挂反馈：收集 → HUD 弹跳+score 音效；失败 → 结算弹层闪红+fail 音效（震屏仍由原 `_start_shake` 驱动，冒烟断言依赖）；胜利 → 弹层弹跳+confirm 音效；重开受理 → confirm 音效 |
| `tests/playtest.json`（新增） | 阈值显式钉住（= 内置默认，不放松） |
| `tests/smoke.gd` | 第 13 组（Juice 协议面 + 收集/失败反馈窗口非空）、第 14 组（重开防误触） |
| `verify.sh` | 增补第 4 步 playtest + `playtest.sh` 存在性守卫（缺失 = 退出码 2 环境不可用） |

## 八、遗留与后续

1. **音效资产**：`SFX_BANK` 留空（headless 全绿 ≠ 有声）。资产后补 = 注册表加行即全局出声；
   Web 端记得壳页音频手势解锁已具备（`server/src/game-page.ts`）。
2. **重玩性方差**：`seed_outcomes_min_distinct` 暂为 1（只记录）。当前三局结果签名已互异
   （fb=24/25/28）；若策划案定稿「每局赛道随机化」类 replayHooks，把该阈值设 2 硬判。
3. **调参联动**：playtest 的 METRICS 行是调参轮的机判底座——URL `?tuning=` 改手感参数后
   复跑 playtest 对照指标，定稿走策划案 revisions API 回写（口径见 `tuning-params.md`）。

## 九、rerun 复跑记录（2026-09-27 · 发布节点 iterate/rerun）

运维补齐套件后的**独立复跑**（新 worktree，从分支 `myrd/games-goal-cmuieq51k002cm9gysxbyppv7` @ `a89235f`
检出，零代码改动、判定器零改动），逐项对照上轮记录：

| 步骤 | 本轮结果 | 与上轮对照 |
|---|---|---|
| `resolve-godot.sh` → `godot --headless --version` | 4.3.stable.official.77dcf97d8 | 一致 |
| preflight（13 类） | PASS（55 文件，含本轮 qa 归档增量） | PASS |
| smoke（240 帧） | PASS，日志零 `SCRIPT ERROR` | PASS |
| input-fuzz | PASS（seed=20260913，batches=6，239 帧） | PASS |
| playtest（900 帧/局，判定器默认） | PASS：fb=17/17/18，first=2.80/2.65/2.92s，gap≤3.42s，score=3/0/6 | 参数不同，指标同量级 |
| playtest（**1200 帧/局，门禁参数**） | **PASS：fb=24/25/28，first=2.80/2.65/2.92s，gap=3.12/3.42/3.00s，score=0/0/0** | **与第三节表格逐位一致** |

复跑命令与判定协议同第六节；`GODOT_PLAYTEST_METRICS` 单行 JSON 明细：

```json
{"frames_per_run":1200,"runs":[{"feedback_events":24,"first_reward_seconds":2.8,"max_feedback_gap_seconds":3.11666666666667,"outcome":"score=0|fb=24","run":1,"seed":20260913},{"feedback_events":25,"first_reward_seconds":2.65,"max_feedback_gap_seconds":3.41666666666667,"outcome":"score=0|fb=25","run":2,"seed":20260914},{"feedback_events":28,"first_reward_seconds":2.91666666666667,"max_feedback_gap_seconds":3,"outcome":"score=0|fb=28","run":3,"seed":20260915}],"thresholds":{"feedback_events_min_per_run":2,"feedback_gap_seconds_max":10,"first_reward_seconds_max":10,"seed_outcomes_min_distinct":1},"thresholds_source":"tests/playtest.json"}
```

（run3 的 `outcome` 在 900 帧局为 `score=6`、1200 帧局为 `score=0`——bot 的 6 枚飞镖都在
前 15 秒内收齐后坠坑，20 秒局末分归零属结算语义，非缺陷；`first_reward`/`gap`/`fb` 三项两参数完全一致。）

**复跑结论**：验收包（§1–§7）在独立环境可复现，`GODOT_PLAYTEST: PASS` 稳定成立，
试玩验收正式通过；工程产物 `export/web/`（pck 2557296 字节）自 `a89235f` 起已含
Juice 反馈协议与重开防误触，本轮随部署分支 `myrd/games-goal-cmuieq51k002cm9gysxbyppv7` 重新发布。
