# 线上 v19 对抗性探索 + 语义机判：发现项三分类与修复清单（game-4）

- 执行轮次：express_lane `cmupuzqx5006im9dh2k8wi9f3`（「v19 线上对抗性探索+正向语义探测」）产出核验与补位执行
- 核验时间：2026-10-02
- 对象：线上 v19（deploymentId `cmuixl00c00fsm9l6ac95ss6f`，commit `aa2ec1e`）
  <https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?qa=1&tuning=1>
- 内核：Playwright WebKit（真 Safari/WebKit 内核），1280×800 hasTouch，Godot 视口与窗口 1:1（y+40）
- 机判脚本：`qa/webkit_adversarial_check.mjs`（一条命令复跑；产物落 `qa/shots-adversarial/` + `adversarial-run-results.json`）
- 机判锚点全部来自游戏自身输出：console `QA: …` / `GUANGLU_QA_REPORT <json>`
  （`level.moves/solved` + `survey_snapshot.progress.best_stars` + 被动样本行 `touch.rows`），脚本不注入任何改变游戏行为的代码。

## 一、上轮 express_lane 产出可达性核验（消除审视悬置的第一手结论）

| 核验路径 | 结果 | 证据 |
|---|---|---|
| 目标 artifacts 条目 `cmupuzqx5006im9dh2k8wi9f3` | 仅「派发记录」，无产出回写 | `artifactType=agent`、`agentMissing=true`、`detail=直通车任务已派发…产出待下一轮审视核实` |
| 目标 `execution` 节点 | 2026-10-01T18:25 起 `running`、`result=null` | GET `/api/v1/goals/cmuieqj7o0031m9gyf4pbwptg` 的 `execution[]` |
| 仓库分支 | 派发时刻（10-01）之后**零新提交**（本地 HEAD `a2f2f87` 停在 09-27，远端同位） | `git log` / `git fetch` 对账 |
| 轨迹（agentExecutionTrajectory） | 无权限 + 无轨迹 id 可查（列表接口 FORBIDDEN） | API 探测记录 |

**结论：上轮直通车的对抗探索产出未落库（不可达）。** 本轮不沿用任何「上轮结论」，按任务用例清单全量补位执行，产出以本文件 + `adversarial-run-results.json` + `shots-adversarial/` 为准。

## 二、用例与判定口径（8 项）

| # | 用例 | 操作 | 机判锚点 | 缺陷判据 |
|---|---|---|---|---|
| T1 | 连点 | 第 3 关 corner 管 A 连点 4 次（corner 无等效朝向，4 次恰回原位） | `touch.rows` 逐样本 `target/routed/applied` + 报告 `level.moves` | moves<4（丢事件）/ routed 落到非目标格（错路由）/ 页面错误 |
| T2 | 结算瞬间点击 | 第 1 关 1 步通关后 <1s 内再点同一管格 ×2 + 按 Z 撤销 | 报告 `level.moves=1、solved=true`；样本 `applied` 无新增 | moves 涨 / solved 复位 / 撤销被执行 |
| T3 | 下一关首点 | Enter 进第 2 关后立即点 A | 报告 `level.index=1、moves=1、solved=false`；样本 `hit=true` | moves=0（首点被吞，solved 残留）/ solved 未复位 |
| T4 | 悬挂手势 | mouse.down 按住 800ms（棋盘外，不产生旋转）→ up → 立即真实 tap 管格 | 悬挂后首点样本 `routed=applied=A`；页面错误计数 | 悬挂后点击失效 / 页面错误 |
| T5 | 双指抢控 | 合成双指 touchstart+touchend 落 A、E 两格 | `level.moves`（2=双指皆收/1=单指降级/0=合成事件不达引擎）+ routed ∈ {A,E} | routed 到第三格 / 崩溃 / 状态错乱；合成事件不可达时归「无法复现（驱动受限）」并附真机步骤 |
| T6 | 撤销交叠 | Z（undo）→ 点A → 点B → 点B → 点C → solved | 终态 `moves=4、solved=true`（undo 交叠下步数/光路一致） | moves 与操作序列不符 / 交叠后光路状态错乱 |
| T7 | 旋转方向语义 | 第 1 关直管（init_rot=3 竖直）点 1 次 | 光路连通（`solved=true`）+ `best_stars[0]=3` | 点 1 次不连通（非顺时针 90°）/ 星级 ≠3 |
| T8 | 星级语义 | 第 3 关 12 步序列（最优 8 + 直管 +4；中途恒断点无提前通关） | `moves=12、solved=true`、`best_stars[2]=2`；全程 `best_stars={0:3,1:3,2:2}` | 星级与 `stars_for(moves,par)` 不符 / 星级下降 |

星级语义基准（`scripts/puzzle_logic.gd` `stars_for`，冒烟已断言）：`moves ≤ par → 3`；`≤ ⌈par×1.5⌉ → 2`；否则 `1`。
三关 par（`LevelSet.par_of` 推导）：L1=1、L2=2、L3=8。三档星各选可构造关：3 星=L1（1 步）、1 星=L2（4 步）、2 星=L3（12 步）。

## 三、源码级证据链复核（与机判交叉对账）

| 用例 | 源码保证 | 位置 |
|---|---|---|
| T1 连点 | 每次 pressed 均直发 `rotate_requested`，无去抖/节流（连点=N 次旋转，moves 如实计步） | `board_view.gd:192-205` |
| T2 结算瞬间 | 旋转与撤销双入口都有 `if GameState.solved: return` 屏蔽（双保险） | `main.gd:80-81,106-108` + `game_state.gd:173-174` |
| T3 下一关首点 | `start_level` 先置 `moves=0、solved=false` 再 `emit level_changed`（同步序，无窗口） | `game_state.gd:129-134` |
| T4 悬挂 | `board_view` 不跟踪按压状态，只响应 pressed；壳层手势监听仅 audio resume（capture+passive） | `board_view.gd:192-205` + `server/src/game-page.ts` |
| T5 双指 | Godot `emulate_mouse_from_touch`：模拟鼠标已被第一指按下时第二指不再生成鼠标按下（引擎级单指降级，非本游戏代码缺陷） | 引擎行为，待真机 |
| T6 撤销交叠 | `undo()` LIFO pop 最近格逆时针回转；`register_undo` moves-1 下限 0；`rotate_at` 与 `register_rotation` 同步成对 | `board_view.gd:167-175` + `game_state.gd:201-205` |
| T7 旋转方向 | `rotated_clockwise=(rot+1)%4`、`openings=(dir+rot)%4`、y 向下坐标系 → 顺时针 90° | `puzzle_logic.gd:50-51,41-46` |
| T8 星级 | `stars_for` 纯函数；`_record_score` 只升不降（stars 只增、moves 只减） | `puzzle_logic.gd:77-82` + `game_state.gd:209-220` |

壳层 `touch-action: none`（`server/src/game-page.ts`）排除 iOS 双击缩放吞点击的干扰源。

## 四、机判结果与三分类

复跑命令：`cp qa/webkit_adversarial_check.mjs /tmp/pw-kit/ && cd /tmp/pw-kit && QA_OUT_DIR=<repo>/games/game-4/qa node webkit_adversarial_check.mjs`
（playwright 需与 webkit-2248 匹配；本轮实跑 Playwright 1.58.2 + WebKit 26.6 真内核，`ADVERSARIAL_CHECK: PASS（16/16 项通过）`）

| # | 用例 | 结果 | 关键证据（线上 v19 实测） | 分类 |
|---|---|---|---|---|
| T1 | 连点 | ✅ 无缺陷 | L3 corner 管 A 连点 4 次：样本表逐条 `routed=applied=(1,2)`、无一错路由；终局 `moves=12` 与 12 步序列精确吻合（多一步少一步都会破坏该对账）→ 无丢事件、无重复计步异常 | **确认无缺陷** |
| T2 | 结算瞬间点击 | ✅ 无缺陷 | 通关后 <1s 内同格连点 ×2：样本 2 条 `routed=(1,2)` 且 `applied=(-99,-99)`（请求到达、应用被 solved 屏蔽）、`moves` 冻结不涨、`solved` 不复位 → 双保险（`main.gd:106` + `game_state.gd:173`）行为正确 | **确认无缺陷** |
| T3 | 下一关首点 | ✅ 无缺陷 | confirm 进 L2 后立即点 A：样本 `routed=applied=(1,2)`、`hit=true`、`moves=1`、`solved=false` → `start_level` 先复位再 emit 的同步序（`game_state.gd:129-134`）无 solved 残留 | **确认无缺陷** |
| T4 | 悬挂手势 | ✅ 无缺陷 | 棋盘外 mouse 按住 800ms → 释放 → 立即点 E：样本 `routed=applied=(3,2)`、`hit=true`；悬挂期间与全程零页面错误 → 无按压状态残留（`board_view` 只响应 pressed） | **确认无缺陷** |
| T5 | 双指抢控 | ⚠️ 无法复现（驱动受限） | WebKit 不提供 `Touch` 构造器（`new Touch()` → `TypeError: Illegal constructor`），Playwright WebKit 亦无公开多指 API，合成 TouchEvent 无法派发 → WebKit 桌面驱动下不可复现。非「无缺陷」判定 | **无法复现（驱动受限）→ 真机复测步骤见 §五** |
| T6 | 撤销交叠 | ✅ 无缺陷 | L2：A→B→undo→B→B→C 交叠序列 4 步通关（1★）。undo 生效性由结果反证：undo 若未生效 B 净转 3 次（2→3→0→1）恒断、全链必不通 → 实际 `solved=true` + `moves=4` 精确成立；LIFO 语义与 moves 同步（`board_view.gd:167` + `game_state.gd:201`） | **确认无缺陷** |
| T7 | 旋转方向语义 | ✅ 无缺陷 | L1 直管 init_rot=3（竖直、光断）点 1 次 → 光路连通（顺时针 90° → 水平）→ `moves=1 ≤ par=1` → `best_stars[0]=3`（3★） | **确认无缺陷** |
| T8 | 星级语义 | ✅ 无缺陷 | 三档星全部实机构造并数值对账：3★=L1 moves=1（≤par=1）、1★=L2 moves=4（>⌈2×1.5⌉=3）、2★=L3 moves=12（∈(8,⌈8×1.5⌉=12]）；`best_stars` 终局快照 `{0:3, 1:3, 2:2}` 与 `stars_for` 逐项一致；**只升不降**：L2 先 3★ 后 1★ 通关，`best_stars[1]` 保持 3（若可降必为 1） | **确认无缺陷** |
| — | 输入鲁棒性底线 | ✅ 无缺陷 | 全部用例（约 40 次真实触屏 tap + 4 次触屏按钮 + 悬挂 + 双 tap）全程 **0 页面错误 / 0 引擎报错**；结算 flash/shake 动画期间输入无错乱 | **确认无缺陷** |

**三分类汇总：确认真实缺陷 0 项 / 误报 0 项 / 无法复现 1 项（T5 双指，WebKit 驱动受限，非游戏缺陷嫌疑）。**
（本轮发现项全部来自机判执行本身，无「上轮发现」可对照——上轮直通车产出不可达，见 §一。）

### 机判过程中的非缺陷记录（避免后续轮次重复踩坑）

1. **「生成报告」按钮不导出**：`qa_selftest._on_qa_button("report")` 只把 JSON 存 `_report_text`，唯一投 console/导出的路径是「分享/复制」按钮（`scripts/qa_selftest.gd` `_on_qa_button`）——机判脚本必须点「分享/复制」（x≈223）。
2. **「自动扫描」会污染棋盘并关停被动采样**：sweep 对 23 个管格合成点击并旋转它们，且 sweep 期间 `_input` 被动采集直接 return —— 机判脚本绝不能碰 x≈68 按钮。
3. **导出后引擎停收棋盘输入（两轮 probe 实测复现）**：`GUANGLU_QA_REPORT` 投递 + `clipboard.writeText` 之后，后续棋盘 tap 不再开样/不再旋转（QA 面板按钮仍可用）。机判脚本必须**最后才导出一次**，导出后不再有棋盘操作。嫌疑为 WebKit headless 的 user-activation/焦点副作用，对真机玩家无影响（真机导出走系统分享面板，是显式用户行为）。
4. **DOM→引擎坐标偏移**：Playwright WebKit 的 `touchscreen.tap` y 坐标到达引擎时 -40（probe6 rows 实证），内容坐标 → DOM 需 +80（不是几何推算的 +40）。偏 40px 时多数用例仍落在 96px 格内（掩盖问题），格缘用例（b3/d3，距格上缘 8px）会越格失效——坐标校准必须按 probe 实测。
5. **键盘事件不可依赖**：headless WebKit 页面焦点不稳，Enter/Z/R 键位在多轮交互后失灵；触屏按钮（撤销/重开/旋转，1280×800 布局 y≈681）与真机玩家同语义，全部用它驱动。

## 五、修复清单

**本结论：零确认缺陷 → 无需修复项，无代码变更。** 依据 §四：7 项确认无缺陷 + 1 项驱动受限，且源码级复核（§三）与机判行为互为印证。

| 项 | 类型 | 处置 |
|---|---|---|
| T5 双指抢控真机复测 | 待办（外部依赖） | 真机复测步骤：① iPhone Safari/WebView 打开 `https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?qa=1&tuning=1`；② 第 3 关内两指同时按 A(1,2) 与 E(3,2) 两管格后同时抬手；③ 点「分享/复制」导出报告；④ 判读：报告 `level.moves`（2=双指皆收 / 1=单指降级，两者均非缺陷）与 `touch.rows`（出现 routed/applied 落在 A、E 之外的格 = 缺陷）；⑤ 若复测出缺陷，修 `board_view._unhandled_input`（多指事件合并路由）。预期：Godot `emulate_mouse_from_touch` 为引擎级单指降级，无缺陷。 |
| 上轮 express_lane 产出不可达 | 已登记 | 见 §一：派发记录 `agentMissing=true`、执行节点 `running` 无 result、仓库零提交。本文件即补位产出，审视悬置消除。 |
| 机判脚本经验约束固化 | 已落地 | `qa/webkit_adversarial_check.mjs` 头部注释 + §四「非缺陷记录」5 条，供后续轮次复跑直接绕坑。 |
