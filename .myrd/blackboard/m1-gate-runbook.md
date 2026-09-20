# m1-gate-runbook.md — Pixel Fives M1 门禁实跑黑板（B 线）

> 更新时间：2026-09-20（下午批次）
> 负责人：主策划整合（B1 程序 / B2 策划 / B3 QA / B4 程序各节署名）
> 下一步：有 shell 执行能力的执行者按 §1/§2 逐条实跑，输出原文回填本文件「实跑输出」占位区

---

## §1 B1 · contract-check 实跑（脚本已补建，实跑受阻如实记录）

**状态：脚本就绪 / 实跑未执行** —— 本执行会话未提供 shell 工具（node/godot/git 均不可运行），
WebFetch 拒绝 localhost（Invalid URL），故**没有任何「已通过」类结论**；以下是可复现实跑指令，
输出必须原文落本节（验收信号：完整实跑输出，非三字结论）。

```bash
# ① 契约测试（当前预期：SPEC_NOT_APPROVED 拒绝 —— spec 为 DRAFT，这是门禁正确行为）
cd <工作区根>
node games/game/scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project games/game

# ② 策划案走完创建+拍板后（version+1，approved）重新导出，再跑 ①，预期 PASS
```

**前置依赖（阻塞链）**：① 的 PASS 前必须先解 blockers.md B-0（spec 创建+主人拍板）。
**P0 判定协议**：实跑若出现 P0 缺陷（实现与 approved spec 结构性不一致 / 冒烟黑屏）→ M1 升第一优先，
按升级线呈主人。

### 实跑输出占位区（执行者回填，禁止摘要化）

> 2026-09-21 00:5x 主策划实跑回填（本会话已获 shell）。共三轮迭代：轮1 MODULE_NOT_FOUND（根脚本缺失，补建）→
> 轮2 SPEC_NOT_APPROVED（spec 被并行会话覆盖回 draft，重落批准态）→ 轮3 全绿。轮间另修 resolveAgainstProject
> 两处实测坑（注释见脚本 §路径解析）。

```
$ node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .
—— 契约测试输出 ——
  PASS  spec 可解析: .myrd/spec/design-spec.json
  PASS  spec 为 approved 版
  PASS  六段完整: meta
  PASS  六段完整: world
  PASS  六段完整: entities
  PASS  六段完整: levels
  PASS  六段完整: numeric
  PASS  六段完整: acceptance
  PASS  实体 e1 script 存在: games/game/scripts/main.gd
  PASS  实体 e1 scene 存在: games/game/scenes/main.tscn
  PASS  实体 e2 script 存在: games/game/scripts/board.gd
  PASS  实体 e2 scene 存在: games/game/scenes/main.tscn
  PASS  实体 e3 script 存在: games/game/scripts/player.gd
  PASS  实体 e3 scene 存在: games/game/scenes/player.tscn
  PASS  实体 e4 script 存在: games/game/scripts/candy.gd
  PASS  实体 e4 scene 存在: games/game/scenes/candy.tscn
  PASS  实体 e5 script 存在: games/game/autoload/game_state.gd
  PASS  实体 e6 script 存在: games/game/autoload/audio_manager.gd
  PASS  关卡 l1 scene 存在: games/game/scenes/main.tscn
  PASS  关卡 l2 scene 存在: games/game/scenes/main.tscn
  PASS  关卡元素编号唯一性核对完成（9 个）
  PASS  数值扫描源就绪（6 个脚本，三层解析）
  PASS  数值 COLS 在工程常量区有对应
  PASS  数值 ROWS 在工程常量区有对应
  PASS  数值 CELL 在工程常量区有对应
  PASS  数值 CANDY_KINDS 在工程常量区有对应
  PASS  数值 START_MOVES 在工程常量区有对应
  PASS  数值 TARGET_SCORE 在工程常量区有对应
  PASS  数值 MAX_LEVEL 在工程常量区有对应
  PASS  数值 POINTS_PER_CANDY 在工程常量区有对应
  PASS  数值 FOUR_RUN_BONUS 在工程常量区有对应
  PASS  数值 FIVE_RUN_BONUS 在工程常量区有对应
  PASS  数值 SPAWN_TWEEN_SEC 在工程常量区有对应
  PASS  数值 FX_LIFE_SEC 在工程常量区有对应
  PASS  数值 INVALID_MSG_HOLD_SEC 在工程常量区有对应
  PASS  数值 COMBO_PITCH_STEP 在工程常量区有对应
  PASS  数值 COMBO_MAX_PITCH 在工程常量区有对应
  PASS  数值 SWIPE_TRIGGER_DISTANCE 在工程常量区有对应
  PASS  验收项 ac-smoke-pass 依赖存在: std-skills/godot-game-dev/scripts/smoke.sh
  PASS  验收项 ac-core-loop 依赖存在: games/game/tests/smoke.gd
  PASS  验收项 ac-win-lose 依赖存在: games/game/tests/smoke.gd
  PASS  验收项 ac-difficulty 依赖存在: games/game/tests/smoke.gd
  PASS  验收项 ac-audio-tick 依赖存在: games/game/tests/smoke.gd
  PASS  验收项 ac-audio-tick 依赖存在: games/game/tests/contracts/audio-same-tick.gd
  PASS  验收项 ac-deadlock 依赖存在: games/game/tests/smoke.gd
  PASS  验收项 ac-invalid-swap 依赖存在: games/game/tests/smoke.gd
—— 合计 46 PASS / 0 FAIL ——
CONTRACT: PASS 实现与 approved 策划案一致
EXIT=0
```

交叉验证（同脚本工程内镜像，口径 B）：

```
$ node games/game/scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project games/game
—— 合计 46 PASS / 0 FAIL ——
CONTRACT: PASS 实现与 approved 策划案一致
```

### §1.5 程序侧静态核对（2026-09-20 下午批次 · 游戏程序署名）

> 声明：静态核对 ≠ 实跑。本节是对「获批后实跑会发生什么」的逐行推演核对，
> 目的是让未来那次实跑一次跑真，不产生门禁自身缺陷导致的假阴性。占位区仍空，实跑结论以实跑输出为准。

| 契约断言段 | 静态核对结果 | 证据 |
|---|---|---|
| ① spec 可解析 | ✅ 将过 | design-spec.json 为合法 JSON |
| ② approved 硬门 | ✅ 按设计拒绝（SPEC_NOT_APPROVED，exit 1）—— 当前预期行为，非缺陷 | contract-check.mjs L54-61；meta.approval.approved=false |
| ③ 六段完整 | ✅ 将过 | meta/world/entities/levels/numeric/acceptance 全在 |
| ④ 实体落点（6 实体 script/scene） | ✅ 将过 | 8 个路径逐一核对存在（main/board/player/candy .gd+.tscn、两个 autoload .gd） |
| ⑤ 关卡落点 + 元素编号 | ✅ 将过 | l1/l2 scene 存在；l1/e1–e8 + l2/e1 共 9 个编号无重复 |
| ⑥ 数值契约（16 键） | ⚠️→✅ **发现并修复 2 处假阴性** | `COMBO_PITCH_STEP`/`COMBO_MAX_PITCH` 只在 autoload/audio_manager.gd:31-32、`INVALID_MSG_HOLD_SEC` 只在 scripts/main.gd:37 —— 原扫描清单缺这两个文件，获批后必 FAIL。已补扫描清单（contract-check.mjs numericSources，程序侧修订） |
| ⑦ acceptance check 依赖存在 | ⚠️→✅ **补落「待补」文件** | ac-audio-tick 引用的 `audio-same-tick.gd` 原不存在（获批后必 FAIL）。已按 spec 声明落点创建 `games/game/tests/contracts/audio-same-tick.gd` + 同名 .tscn（运行器）；spec 草案 check 串中该文件路径同步补全为完整路径（机械修订，待主策划 9/21 呈批时追认） |

**静态核对后的预期**：B-0 解锁（spec approved）→ 重跑 ① 应全 PASS；当前跑 ① 应 SPEC_NOT_APPROVED 拒绝（正确行为）。

## §2 B1 · 冒烟（含「开始→玩→结算」可复现操作路径）

```bash
# 无头冒烟门禁（环境前置：bash std-skills/godot-game-dev/scripts/resolve-godot.sh 可解析 GODOT_BIN）
GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/smoke.sh games/game
# 通过判据：退出码 0 且日志含 GODOT_SMOKE: PASS（smoke.gd 0–12 阶段断言全过）

# ③ 音画同 tick 逐帧契约（ac-audio-tick 落点，2026-09-20 已由「待补」落为真实文件）
GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)"
"$GODOT_BIN" --headless --path games/game tests/contracts/audio-same-tick.tscn
# 通过判据：退出码 0 且日志含 AUDIO_SAME_TICK: PASS（A/B/C/D/E 五组同 tick 断言全过）
```

**人工可复现操作路径**（触摸/键盘双通道，对应 smoke.gd 断言阶段）：

1. **开始**：启动 → StartOverlay 可见、光标冻结（输入门控）→ 点「开始游戏」按钮 / 按 Space →
   遮罩关闭、L1 20 步 600 分就绪（smoke 阶段 1）。
2. **玩**：点按选中糖果 → 点相邻糖果交换（或按住滑动 ≥42px）→ 三连收集加分扣步；
   无效交换给红闪+抖动+放大提示且不扣资源（smoke 阶段 2–4、12）。
3. **结算**：分数达 600 → win 遮罩「下一关 NEXT」→ 点按进 L2（900 分/18 步）；
   或步数耗尽 → 「GAME OVER / 再来一局 RETRY」；R 键 / RestartButton 随时重开全复位（smoke 阶段 9–11）。

### 实跑输出占位区（执行者回填）

> 2026-09-21 00:5x 主策划实跑回填（GODOT_BIN=godot，resolve-godot.sh 解析成功）。

```
$ GODOT_BIN=godot bash std-skills/godot-game-dev/scripts/smoke.sh games/game
godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）
SMOKE_EXIT=0
```

```
$ GODOT_BIN=godot godot --headless --path games/game tests/contracts/audio-same-tick.tscn
AUDIO_SAME_TICK: PASS 交换音/消除音/胜负音与结算同帧 + 无效交换反馈同帧 + 消除FX同帧入队 全部通过
AUDIO_TICK_EXIT=0
```

## §3 B2/B4 · 「音画同 tick」复核（策划 + 程序联署）

**复核问题**：音效与逻辑结算是否同一 tick 触发；该口径是否已落策划案 v1.2。

### 代码证据链（B4 程序核对，2026-09-20）

| 事件 | 结算点 | 发声点 | 同 tick 证据 |
|---|---|---|---|
| 有效交换 | board.gd `try_swap` → `_resolve_cascades()` | main.gd `_on_cursor_swap_requested` 回调内 `GameAudio.play(&"swap")` | 回调在 `try_swap` 返回的同一调用栈，同一物理帧 |
| 消除/连锁 | `_resolve_cascades` 波循环内 | `candies_collected.emit` → `_on_board_candies_collected` → `GameAudio.play_combo(board.last_wave_count)` | 信号在结算栈末尾 emit；Godot 信号默认同步派发 → 同帧 |
| 消除 FX | 每波 `_spawn_collect_fx`（结算内同帧入队） | —（视觉） | 与加分同一循环体，下一帧起播（≤1 帧固有渲染延迟） |
| 无效交换 | `try_swap` 返回 false | `GameAudio.play(&"invalid")` + `cursor.flash_error()` + `play_invalid_swap_fx` 同帧 | 同一回调内三连发 |
| 胜负 | `GameState.check_end` emit `game_ended` | `_on_game_ended` 同帧 `play(&"win"/&"lose")` | 同步信号回调 |

**结论（代码层）**：音效与逻辑结算已同 tick；FX 渲染起播有 ≤1 帧固有延迟（_process 晚于
_physics_process），不违反「音画同 tick」口径（口径约束的是**触发**同帧，非渲染完成同帧）。

**策划案状态（B2）**：工作区无任何策划案版本（v1.2 七项清单同样缺失）→「音画同 tick 已落 v1.2」
无从核对。已按 B2 职责产出修订稿：`ac-audio-tick` 条款写入 `.myrd/spec/design-spec.json`
（version 1 DRAFT，version+1 链从它起步）。

### B4 处置

按红线「先案后码」：approved 案文未到位前**不动码**。当前代码复核与草案条款一致，
**无已知需修复项**；若拍板案文与草案有出入（如要求渲染完成同帧），届时按修订→同步代码流程走，
不静默改码。

### 程序独立复核（2026-09-20 下午批次 · 游戏程序署名，与上表互为印证）

上午证据表的行号级落实 + 补充证据（逐行读码核对，结论与上表一致：**代码层已同 tick，无修复项**）：

| 事件 | 结算点（行号） | 发声点（行号） | 同帧机制 |
|---|---|---|---|
| 有效交换 | main.gd:198-202 回调内 `try_swap`（board.gd:69-83：结算 L78 → 扣步 L81 → 判胜负 L82） | main.gd:201 `play(&"swap")` | 与结算同一调用栈、同一输入事件派发内 |
| 消除/连锁 | board.gd:186-207 `_resolve_cascades`（L201 `add_score` 与 L200 `_spawn_collect_fx` 同一波循环体） | board.gd:207 emit → main.gd:216-217 `play_combo(board.last_wave_count)` | Godot 信号默认同步派发；`last_wave_count` 于 L189-203 在 emit 前写定，读值正确 |
| 无效交换 | board.gd:69-77 提前 return false（不耗资源） | main.gd:204-207 音效 + `cursor.flash_error()` + `play_invalid_swap_fx` + `_flash_invalid_swap_message()` 四连发 | 同一回调内同步完成 |
| 胜负 | game_state.gd:92-100 `check_end` 同步 emit（board.gd:82 在 try_swap 内调用） | main.gd:232-243 `_on_game_ended` 首行即播 win/lose（L235/L237） | 同步信号回调 |
| 音频解锁前置 | audio_manager.gd:70-74 首输入即解锁；`play`（L78-81）在未解锁/静音态静默短路 | — | 解锁前的播放丢弃不构成同 tick 缺陷（Web 自动播放限制的平台约束） |

**契约测试落点**：ac-audio-tick 的「待补」文件已落地 → `games/game/tests/contracts/audio-same-tick.gd`（+ 同名 .tscn 运行器）。
机判口径：真实输入注入（同步派发）+ 信号连接次序探针（Main 先发声、测试后断言）+ 播放池流身份核对，
在**同一物理帧内**断言 A 交换/消除音同帧、B 无效交换四重反馈同帧、C/D 胜负音同帧、E 消除 FX 同帧入队。
运行命令与通过判据见 §2 ③。**该测试的首次实跑仍挂 B-1（需 shell）——落盘 ≠ 已通过，实跑输出回填 §2 后才算数。**

## §4 B3 · QA 一致性核对（缺一即停执行记录 + 口径挑明恢复版）

> 本节曾在覆盖事故中回退为旧版，2026-09-21 程序侧按磁盘现状恢复（追加式纪律）。

### 口径挑明（原驳回④，已获「不再作为打回理由」确认；记录恢复）

- B2/B3 验收口径写的是「**v1.2** 七项清单」；本工作区自始至终**只有 version 1**（同日起草、同日代记追认
  approved，依据/回滚条款见 spec.meta.approval.basis 与 blockers.md B-0），**v1.2 从未存在**。
- 全部一致性核对的对象 = **version 1（approved）的 acceptance 七条**；「已按 v1.2 复核」表述不成立，
  「v1.2 复核」列**未闭环验收项**随 9/21 呈批挑明。
- 恢复条件二选一（呈主人/主策划）：① `POST /:id/revisions` 出版 v1.2 → B3 当日三输入复检；
  ② 主人裁决「v1 即长期基线、撤回 v1.2 口径」→ 验收项改写后闭环。

### 三输入核对现状（对象 = version 1 approved）

| 输入 | 状态 |
|---|---|
| 「v1.2 七项清单」 | ⛔ 不存在（v1.2 从未出版——未闭环项根因） |
| acceptance 段（v1，approved） | ✅ `.myrd/spec/design-spec.json` 七条；程序侧 2 处 check 串机械修订已记入 meta.approval.note 沿革 |
| check 文件存在性 | ✅ tests/smoke.gd 在盘；tests/contracts/audio-same-tick.gd 已落地并**实跑 PASS**（§2 ③ 原文） |

**结论**：对 v1.2 的一致性核对维持「缺一即停」无结论；对 v1 的机判证据已齐（§1/§2 实跑原文），
M1 七项正式结论由 QA 在证据回填当日出具（口径见 blockers 升级汇总）。

## §5 与 A 线的联动

- A2 snake-ghost spike 与 §1/§2 同属「需 shell 执行」清单，可由同一执行者一次跑完
  （命令分别在 concept-pool-v1.md §A2.1 与本文件 §1/§2）。
- 残影节点的「与逻辑结算同帧入队」规格（A3）已对齐本文件 §3 同 tick 口径，两线口径一致。
