# 《节奏大师》试玩验收包（playtest kit）

- 目标：cmv0xypkw000dm94o58qf3x8j ｜ AppHost：game-10（cmv0xyobv000bm94o6kxqca8z）
- 分支：`myrd/game-10-goal-cmv0xypkw000dm94o58qf3x8j`
- 试玩入口（liveUrl）：https://leomac-studio.tail49399e.ts.net/apps/game-10/
- 调参工作台：https://leomac-studio.tail49399e.ts.net/apps/game-10/?tuning=1
- 包生成时间：2026-10-09（playtest 节点）｜ 试玩人：待定 ｜ **量表状态：待用户试玩回填**

> 本包只提供「怎么玩、看什么、怎么把手感变成数值」。**好不好玩由试玩人说了算**——
> 四问量表未经试玩人回填前，一律视为「待回填」，任何一方不得代填。

---

## 一、开玩前 30 秒须知

- 一局 = **32 秒**：0–3.8s 是谱面等待期（无音符），第 3.8s 起第一颗音符落入，曲末 1s 收尾。
- 四轨从左到右：**蓝 / 青 / 橙 / 粉**，对应键位 **D / F / J / K**；移动端为屏幕底部四个等宽触控分区。
- 音符压到**判定线**（屏幕下方横线）时按键：越准分越高，漏按或按错窗口记 MISS。
- 判定与得分（AC5 可复算口径）：**PERFECT ±50ms = 100 分**，**GOOD ±100ms = 60 分**，超窗 = MISS = 0 分。
- 连续命中（P/G）累计 combo；**一次 MISS 立即清零**（连击里程碑每 10 连有画面震动反馈）。
- 通关线：命中率（(P+G)/总音符）**≥60%** 判「通关！」，否则「未通关」。

## 二、怎么玩

### 桌面浏览器（键鼠）
| 操作 | 键位 | 说明 |
|---|---|---|
| 击打四轨 | `D` `F` `J` `K` | 与四轨颜色一一对应 |
| 重开一局 | `R` | **只在结算页生效**（进行中按 R 无效，防误触） |
| 换难度 | `←` `→` | **只在结算页开放**（进行中切换会打断谱面，故被禁止） |

### 移动端（触屏，真机或浏览器移动仿真）
- 屏幕底部整带为四轨触控分区，**支持多点同时触控**（四指并发各自独立跟踪触点）。
- 判定线与触控带之间有一条工具按钮行（与四轨分区零重叠）：
  - `校准−10` / `校准+10`：延迟校准，步长 10ms、范围 ±300ms，**保存后重启仍生效**（持久化）；
  - `难度‹` / `难度›`：仅结算页出现；
  - `重开`：仅结算页生效。

### 结算页看什么（AC5 人工复算用）
结算面板逐行展示：**总分 ｜ 最大连击 ｜ PERFECT / GOOD / MISS 计数 ｜ 命中率 ｜ 当前难度**。
复算方法：`总分 = PERFECT×100 + GOOD×60`（MISS 不计分），应与面板一致。

## 三、四档难度（对照实现配置表）

同一曲目（固定 32s、种子 20261010+难度号，谱面经 ChartGen.validate 校验）：

| 档位 | 下落速度 px/s | note 最小间隔 s | 体感预期 |
|---|---|---|---|
| Easy | 300 | 1.10 | 稀疏慢落，热身 |
| Normal（默认） | 380 | 0.85 | 中等密度 |
| Hard | 470 | 0.62 | 密集快落 |
| Expert | 560 | 0.46 | 高压连打 |

> 试玩建议顺序：Normal 起手 → 换 Expert 感受密度差 → 回 Easy 校准手感。换档在结算页操作。

## 四、试玩量表（四问，逐条回填，不要合并）

> 回填方式：直接在下面每题的「【回填】」处写结论。四问答完 = 一次完整试玩验收。

**① 首分钟能否看懂目标与操作？**
- 是 / 否：
- 卡点（若否，卡在哪：开局提示够不够、判定线是否好找、键位/分区是否直观）：
- 【回填】待用户试玩

**② 结束时想不想再来一局？**
- 评分（1=完全不想 … 5=立刻再来）：
- 原因：
- 【回填】待用户试玩

**③ 手感与反馈（打击感 / 音效 / 画面响应）**
- 评分（1–5）：
- 分项备注（命中弹跳/闪白、MISS 红闪、连击里程碑震动、音效时机是否跟手）：
- 【回填】待用户试玩

**④ 节奏有没有明显断档或无聊段？**
- 有 / 无：
- 出现在第几秒（可参考锚点：0–3.8s 固定等待期；Easy 档 1.10s 间隔是否会松散；Expert 档 0.46s 间隔是否会过载）：
- 【回填】待用户试玩

## 五、调参工作台（把「手感不对」变成具体数值）

入口：**https://leomac-studio.tail49399e.ts.net/apps/game-10/?tuning=1**

> **⚠️ 面板上线状态（playtest 节点 2026-10-09 实测，如实告知）**：线上部署（commit 2ccb38e）
> 的**调参数值桥已生效**（`?tuning=<JSON>` 启动即应用），但**面板不会出现**——面板脚本有定义、
> 无实例化点（装配缺陷）。本节点已补接线（main.gd，PREFLIGHT+SMOKE 复跑全绿）并重新导出，
> **面板待下一次部署生效**。在那之前调参请直接把 JSON 拼进 URL，例如：
> `https://leomac-studio.tail49399e.ts.net/apps/game-10/?tuning=%7B%22note_speed_scale%22%3A1.3%7D`
> （即 `?tuning={"note_speed_scale":1.3}` 的 URL 编码形；多键在 JSON 内逗号分隔后整体编码）。

1. 打开后画面**右上角**浮出「调参工作台」面板（仅网页环境出现，带 `?tuning=` 任意值即可，`?tuning=1` 亦可）；
2. 四个滑杆**拖动即时生效**，边拖边打几颗音符感受差别；
3. 调到满意 → 点 **「复制调参 URL」** → 把链接发回来 = 一次完整调参结果；
4. 数值协议：只认下表 4 个键（`GameState.TUNING_META`），URL 里出现未声明键会被忽略并在 diff 说明中标注。

### 当前基线（代码默认值 = 部署版本生效值）

| 键 | 含义 | 当前值 | min | max | step |
|---|---|---|---|---|---|
| `perfect_window_ms` | PERFECT 判定半窗 | 50 | 30 | 80 | 5 |
| `good_window_ms` | GOOD 判定半窗 | 100 | 60 | 150 | 10 |
| `note_speed_scale` | 全局下落速度倍率（难度表 × 此值） | 1.0 | 0.5 | 2.0 | 0.05 |
| `calibration_offset_ms` | 延迟校准偏移（持久化） | 0 | −300 | 300 | 10 |

> 调参示例：觉得音符偏慢 → `note_speed_scale` 拉到 1.3；总差半拍 → 微调 `calibration_offset_ms`；
> 觉得 PERFECT 太苛刻 → `perfect_window_ms` 升到 60。

### 调参结果回写协议（收到试玩人的调参 URL 后才执行）
1. 解析 `?tuning=<JSON>`，与上表基线 diff（未声明键列出但忽略）；
2. 数值经 `POST $PLATFORM_API_URL/api/v1/game-design-specs/:id/revisions` 写进 `spec.numeric`
   （产生新版本、带 sourceTrajectoryId 溯源）→ `POST /api/v1/game-design-specs/:id/approve` 拍板；
3. **下一轮工作流按新 spec 重部署**生效——不在本节点直接改代码默认值（spec 是唯一事实源）。

> ⚠️ 前置缺口（2026-10-09 核实）：本 goal（cmv0xypkw000dm94o58qf3x8j）在平台
> `game_design_specs` 表中**尚无任何版本行**，工程内亦无 `.myrd/spec/design-spec.json`
> ——`revisions` 端点对不存在的 spec 返回 404。收到试玩结果后需先经
> `POST /api/v1/game-design-specs`（goalId 维度）建首版 spec 才能走上述回写。

## 六、本包依据（机器侧已核，不代替人的判断）

- **移动端门禁（preHook: mobile-web-smoke）**：`qa/mobile/report.json` verdict=**PASS**，
  10/10 checks 全绿（网络全通 / console 零错 / canvas 挂载 / 首帧非纯色 / 画面在动 /
  触摸到达 / 触摸响应 / 音频解锁器 / 无横向溢出 / FPS 38），url=本包 liveUrl，
  checkedAt=2026-10-09T13:45:38Z；分阶段截图 phase-load / phase-tap / phase-joystick.png 同目录。
- **门禁资产在库核查（本节点）**：判定脚本 6 件套在
  `std-skills/godot-game-dev/scripts/`（preflight.py / smoke.sh / input-fuzz.sh / playtest.sh /
  resolve-godot.sh / mobile-web-smoke.mjs）；`.myrd/routines.yaml` 含 `id=godot-smoke` 与
  `id=mobile-web-smoke` 两条 routine；参数化模板
  `std-skills/godot-game-dev/references/{godot-smoke-routine.md, mobile-smoke-routine.md}` 在库。
- **试玩指引基准**：工程内无 `.myrd/spec/design-spec.json` → 本包「怎么玩/看什么」按实现说明写
  （main.gd / conductor.gd / game_state.gd / chart.gd，数值逐项可溯源）。
- **目标产物回写记录**：本节点以工作流注入的 MYRD_TOKEN（workflow-node 身份）执行
  `PATCH /api/v1/goals/cmv0xypkw000dm94o58qf3x8j`，artifacts 合并结果 = 原 3 条（create_requirement /
  write_document / run_workflow）+ 本包 1 条（op=playtest_kit），共 4 条；PATCH 载荷原样归档于
  `qa/goal-artifacts-patch.json`，回写后逐字段比对一致。
- **回写过程事故与恢复（如实记录）**：2026-10-09T13:55Z 第一次 PATCH 因本地误判「无凭据」，
  以空数组 `{"artifacts":[]}` 探测端点，意外带真实凭据发出 → 原有 3 条产物被清空（数据库即时核得
  count=0）；随即以本会话此前从数据库 dump 的原文重建 3 条 + 追加 playtest_kit 条目重新 PATCH，
  并逐字段比对确认与原内容完全一致（无丢失、无走样）。教训已记：探测性请求必须先核实凭据状态，
  禁止以破坏性载荷试探写端点。
- **真机 AC4 口径**：模拟门禁只证明「移动端能不能玩」的机判下限；四指 1000 次 0 丢触、
  触控到判定延迟中位数 ≤80ms 需真机走查，试玩时可顺手留意丢触/漂移并写进量表④备注。
