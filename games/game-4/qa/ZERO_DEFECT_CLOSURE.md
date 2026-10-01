# 《光路谜阵》exp-verify 零缺陷核销归档（game-4 · iterate 节点）

- 核销时间：2026-10-02
- 输入：exp-verify 修复清单 = `qa/ADVERSARIAL_FINDINGS.md`（线上 v19 对抗性探索 + 语义机判）
- 结论：**零确认缺陷（0 缺陷 / 0 误报 / 1 项驱动受限）→ 本节点降级为零缺陷核销归档 + 门禁复跑，不做代码变更、不重导出重部署**
- 分支：`myrd/game-4-goal-cmuieqj7o0031m9gyf4pbwptg`（部署 gitRef 同名，线上构建基线即此分支）
- 线上版本：**v19 running**（deploymentId `cmuixl00c00fsm9l6ac95ss6f`，构建基线 commit `aa2ec1e`）
  <https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?qa=1&tuning=1>

## 一、exp-verify 结论核销（对照 ADVERSARIAL_FINDINGS §四/§五）

| 项 | 上轮分类 | 本轮核销处置 |
|---|---|---|
| T1 连点 / T2 结算瞬间点击 / T3 下一关首点 / T4 悬挂手势 | 确认无缺陷（源码级 + 真内核机判互证） | 核销，无需修复项 |
| T6 撤销交叠 / T7 旋转方向语义 / T8 星级语义（三档 + 只升不降） | 确认无缺陷（`stars_for` 纯函数 + `_record_score` 只升不降实测） | 核销，无需修复项 |
| 输入鲁棒性底线（约 40 次真实触屏 tap 全程 0 页面错误） | 确认无缺陷 | 核销，无需修复项 |
| T5 双指抢控 | **无法复现（WebKit 驱动受限，非缺陷嫌疑）** | 维持「待办（外部依赖）」归位：真机复测步骤见 `ADVERSARIAL_FINDINGS.md` §五，本轮无可执行的真机环境，不得伪装成已复测 |
| 上轮 express_lane 产出不可达 | 已登记 | 已由 `ADVERSARIAL_FINDINGS.md` 本体补位产出，悬置消除，核销 |

修复清单原文口径：**「零确认缺陷 → 无需修复项，无代码变更」**。本节点据此不产生任何 gameplay/脚本/场景改动。

## 二、本轮四门禁复跑（同源判定脚本，仓库内 `std-skills/godot-game-dev/scripts/`）

| 门禁 | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 前置一致性 | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-4` | `PREFLIGHT: PASS 13 类前置一致性检查全部通过（123 个工程文件）` | 0 |
| 无头冒烟 | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=$(resolve-godot.sh) bash smoke.sh games/game-4` | `godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）`<br>（smoke.sh 内部已断言引擎日志含 `GODOT_SMOKE: PASS` 且零 SCRIPT ERROR） | 0 |
| 输入 fuzz | `GODOT_BIN=… bash input-fuzz.sh games/game-4` | `GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239` | 0 |
| 机器人试玩 | `GODOT_BIN=… bash playtest.sh games/game-4` | `GODOT_PLAYTEST: PASS 3 局全部通过`<br>METRICS：3 局 score=6/6/6，feedback_events=156/147/173，first_reward=1.45s/—/11.5s，最大反馈间隔 0.95s（阈值 10s），seed 成绩 distinct 达标 | 0 |

环境：Godot 4.3.stable.official.77dcf97d8（`resolve-godot.sh` 实测解析）。
判定脚本零改动（只读调用）；`.myrd/routines.yaml` 的 `godot-smoke` 条目未触碰。

## 三、线上 v19 复验（门禁复跑 + 公网真内核双证，全绿）

### 3.1 版本一致性（零漂移证明）

| 核验 | 结果 |
|---|---|
| `GET /apps/game-4/gw/health` | 200 `{"ok":true,"app":"light-path-labyrinth","env":"development","assets":"lazy/object-storage"}` |
| HEAD 相对 v19 构建基线 `aa2ec1e` 的 diff 范围 | **仅 `games/game-4/qa/` 新增取证文档与机判脚本，游戏代码/场景/导出产物零改动**（`git diff --name-only aa2ec1e..HEAD -- ':!games/game-4/qa'` 为空） |
| 线上 `index.js` vs 仓内 `export/web/index.js` | 字节数一致（331,495B）且 **sha256 完全一致**：`8b649683883a8be172e229a0479503d50cd5245ebf87aa71fda70bf720824075` |

→ 线上 v19 就是仓内当前产物的同字节构建。既无代码变更、产物又零漂移，重导出重部署属于无意义改动，按任务降级路径**跳过**。

### 3.2 WebKit 真内核公网复跑（复用 `qa/webkit_qa_live_check.mjs`）

- 复跑：`QA_OUT_DIR=<repo>/games/game-4/qa QA_FILE_SUFFIX=-zd0 node webkit_qa_live_check.mjs`（Playwright 1.58.2 + WebKit 真内核）
- 结果：**`WEBKIT_QA_LIVE_CHECK: PASS（27/27 项通过）`，全程零页面错误**（exit 0）
- 覆盖：iPhone 形态 390×844 DPR3 触屏链接可开 + 引擎可启；1280×800 真实点按「自动扫描 → 分享/复制导出 → 四问点选 → 提交回传」全链路；报告 `samples=24 hit_rate=0.958`、旋转时延 p95=51ms、音频 running；量表 7 项必答齐全、channel=share 回传成功
- 本轮新增取证（不覆盖旧证据，`-zd0` 后缀）：`shots-webkit-verify/{qa-report-live-zd0.json, survey-live-zd0.json, webkit-b-*-zd0.png, webkit-iphone-390x844-zd0.png}`，console 全文见本轮记录

### 3.3 非缺陷口径备注（如实记录，避免下轮误读）

`GUANGLU_QA_REPORT` 内部 `verdict.touch_hit_ok=false / pass=false` 属 QA 自检器**自动扫描（sweep）模式**的已知口径：sweep 对棋盘合成点击期间，`_input` 被动采样直接 return（`qa/ADVERSARIAL_FINDINGS.md` §四非缺陷记录 #2），故 sweep 产生的样本不计入 `touch_hit_ok`。真实触屏命中由机判脚本独立断言（`hit_rate=0.958`，27/27 中的独立项）并 PASS，两者不矛盾。真机（非 sweep）场景下 `touch_hit_ok` 才是有效指标（见 `qa/ios-safari-realdevice-qa.md` §四 待真机回填）。

## 四、本节点收口结论

1. **零缺陷核销归档**：本文件 + 上轮 `ADVERSARIAL_FINDINGS.md`（修复清单 §五）即为核销载体，无修复项可执行。
2. **门禁复跑全绿**：preflight / smoke(240) / input-fuzz / playtest 四门禁 exit 0（§二）。
3. **线上 v19 仍全绿**：health 200 + WebKit 真内核 27/27 + 线上产物与仓内 sha256 零漂移（§三）。
4. **无代码变更**：本轮仅新增 qa/ 取证（本文档 + WebKit 复跑产物），`games/game-4` gameplay 资产不动，无需重导出、无需新部署。
5. **遗留待办（外部依赖，不阻塞本节点）**：T5 双指真机复测（步骤归档于 `ADVERSARIAL_FINDINGS.md` §五）；iPhone 实测卡已发用户频道（`qa/IPHONE_QA_CARD.md`），真机回填后按 `ios-safari-realdevice-qa.md` §四登记。
