# levels.md — Pixel Fives 关卡状态（共享黑板）

> 更新时间：2026-09-22（M1 收口验证 + M2 立项冲刺）
> 负责人：主策划（本文件全团队共用，改动请在「变更记录」追加一行）
> 下一步：糖果线占位项 9/26 真机窗口复验；足球线 M2（W1）按 v1.3 批准后开工；N1 snake-ghost 待主人点头

---

## 1. 工程基线

| 项 | 值 |
|---|---|
| 工程路径 | `games/game/`（project.godot config/name = 「糖果粉碎传奇」，任务代号 Pixel Fives） |
| 引擎 | Godot 4.3（`config/features=PackedStringArray("4.3")`），gl_compatibility，竖屏 720×1280 aspect=expand |
| 主场景 | `res://scenes/main.tscn`（scenes: main / player / candy 三件套） |
| autoload | `GameState`（autoload/game_state.gd）、`GameAudio`（autoload/audio_manager.gd）、`SaveState`（autoload/save_state.gd，9/21 阻塞#3 新增：`user://pixel-fives-save.json` 本地持久化 + RESUME 续玩快照） |
| 冒烟 | `tests/smoke.gd` + `tests/smoke.tscn`，0–12 阶段断言，`GODOT_SMOKE: PASS` + exit 0 为过 |

## 2. 关卡阶梯（实现状态：已落地，冒烟阶段 8 锁数值）

| 关卡 | 目标分公式 | 步数公式 | 状态 | 机判 |
|---|---|---|---|---|
| L1 | 600（TARGET_SCORE） | 20（START_MOVES） | ✅ 可玩 | smoke 阶段 8/9/10 |
| L2 | 900（+300/关） | 18（−2/关） | ✅ 可玩 | smoke 阶段 9 过关断言（LEVEL 2 + 阶梯重算） |
| L3 | 1200 | 16 | ✅ 可玩 | smoke 阶段 10 败局断言（level=3 抬高构造） |
| … | 600+(n−1)×300 | max(20−(n−1)×2, 12) | ✅ 公式纯函数 | `target_for_level` / `moves_for_level` 单调性断言（L1→L6） |
| L99（MAX_LEVEL 封顶） | — | 12（下限） | ✅ 常量锁定 | 常量断言 |

## 3. M1 里程碑门禁状态

| 门禁 | routine | 状态 | 证据落点 |
|---|---|---|---|
| Godot 无头冒烟 | `godot-smoke`（preflight + headless-smoke + input-fuzz） | ✅ **实跑 PASS**（exit 0，`godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）`，2026-09-21） | m1-gate-runbook.md §2 占位区（已回填原文） |
| 契约测试 | `game-contract`（scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .） | ✅ **实跑 46 PASS / 0 FAIL**（双口径：projectDir=. 与 games/game 均绿，exit 0；spec v1 已追认代记 approved）——三轮驳回（MODULE_NOT_FOUND→SPEC_NOT_APPROVED→覆盖事故）全部闭环 | m1-gate-runbook.md §1 占位区（原文已回填） |
| 音画同 tick 复核 | （B2/B4） | ✅ **契约实跑 PASS**（exit 0：`AUDIO_SAME_TICK: PASS 交换音/消除音/胜负音与结算同帧 + 无效交换反馈同帧 + 消除FX同帧入队`）+ 代码层行级复核一致；spec v1 条款已随追认生效 | m1-gate-runbook.md §2/§3 |
| 反馈/三态/持久化契约（阻塞#1#2#3，9/21 新增） | `godot --headless --path games/game tests/contracts/fx-settlement-contract.tscn` | ✅ **实跑 PASS**（exit 0：`FX_SETTLE_PERSIST: PASS …`；PERF avg 61.1fps / 稳态最差 53.4fps）——三态 UI 为**占位**，美术稿落地后二次复验 | m1-gate-runbook.md §6 |
| verify.sh（preflight+smoke） | `bash games/game/verify.sh` | ✅ **实跑 PASS**（exit 0：`PREFLIGHT: PASS 13 类…` + 冒烟 PASS；文件数随资产入库 105→110，美术稿接线后批次的最新证据见 gate-logs/m1-recap-20260921-110550-prog-signoff/）——B-5 待办就此关闭 | m1-gate-runbook.md §6/§6.3 |

## 4. 变更记录

- 2026-09-20 主策划：建档；阶梯/门禁状态按当日探查实况填写，M1 实跑输出待有 shell 的执行者回填。
- 2026-09-21 主策划（实跑批次）：M1 三门禁全部实跑转绿（smoke / contract 46 PASS 双口径 / audio-same-tick），原文回填 runbook §1/§2 占位区；snake-ghost spike 桌面口径实证「能」（data/20260921-010252）。⚠️ 本文件主策划上轮两行曾被并行会话覆盖丢失，本轮基于磁盘现状重写——共享黑板文件请改「追加」勿整文件重写。
- 2026-09-21 游戏程序（第三轮驳回处置）：登记 B-5（spike_main.tscn 被回退平铺路径 → 未来 verify.sh/preflight 重跑必 P6 假红；9/21 已绿证据不受影响——冒烟走的直连 smoke.sh；两修复案待改动人择一，程序未擅自回改）；blockers 升级汇总刷新至门禁全绿后五条（追认确认/snake-ghost 终裁/v1.2 未闭环/引导条款建议等）；B-3 与 runbook §4 的口径挑明记录从覆盖事故中恢复。
- 2026-09-21 游戏程序（P5/P6 修复批次）：驳回附实跑失败原文（PREFLIGHT P5+P6 FAIL，exit 1，日志已归档 gate-logs/contract-gate-20260921-012610.log）→ 按 B-5 方案 A 修复：spike_main.tscn 改指向 `res://qa/snake-ghost-spike/spike_main.gd`、run-spike.sh 临时工程镜像结构（保留实跑批次的 ASCII heredoc 防 error 43）、README §2② 同步；games/game 内 `res://spike_main` 平铺引用清零。**待重跑** verify.sh / run-m1-gates.sh 产出新证据目录，预期 PREFLIGHT: PASS → 冒烟 PASS。
- 2026-09-20 游戏程序（下午批次）：门禁状态三行更新——①契约脚本静态核对完成并修复 2 处获批后假阴性（数值扫描清单 + audio-same-tick.gd 落地）；②冒烟新增 audio-same-tick 契约场景命令；③音画同 tick 程序独立复核完成（行级证据）。实跑动作仍挂 B-1，本会话无 shell，未产生任何实跑输出。
- 2026-09-21 主策划（收口冲刺批次）：门禁表新增「反馈/三态/持久化契约」（阻塞#1#2#3 机判落点，FX_SETTLE_PERSIST PASS）与「verify.sh」两行；五份实跑原文归档 gate-logs/m1-recap-20260921-094116/；结算三态口径定为 WIN/LOSE/RESUME（RESUME 依赖 SaveState 存档，UI 占位待美术稿二次复验）。
- 2026-09-21 游戏程序（收口冲刺 · 独立复跑批次）：六门禁全部**本会话亲自复跑**并归档独立证据 `gate-logs/m1-recap-20260921-095257-prog/`（5 份原文）——契约双口径 46 PASS/0 FAIL（两副本 `diff` 为空）、godot-smoke PASS、audio-same-tick PASS、fx-settlement PASS（PERF avg 61.0 / 稳态最差 53.5）、verify.sh PREFLIGHT PASS + smoke PASS，全部 exit 0。实现层核实：SaveState 已注册 project.godot [autoload]、结算栈同 tick 落档（game_state.gd add_score/use_move/advance_level/check_end）、三态 RESUME 双入口（NewGameButton 在 main.tscn + main.gd setup_resume_offer）、VFX 参数区在 main.gd（屏震封顶 10px/0.28s 归零）；fx-settlement 契约断言非空转（逐字段盘档比对 + best_score 跨局 + 阈值守卫）。§1 基线 autoload 行补 SaveState（上轮遗漏，本批修正）。业务代码本批零改动，纯复验批次。
- 2026-09-21 游戏程序（B-#1 程序确认签字批次）：美术 536fc0d「只改数值/换资源、不改结构」签字落账（main.tscn 机核：节点树/信号连接/文案三 diff 为空、新增行 100% 呈现值、.gd 零触碰，明细见 assets.md §1.6.1）；当前 HEAD（含 B-8 修复）七项复跑全绿——契约双口径 46 PASS/0 FAIL、smoke、audio-tick、fx-settlement 连续两跑（第 2 跑吃第 1 跑测试态仍 PASS，B-8 幂等关闭）、verify PREFLIGHT 110 文件 + smoke，原文 gate-logs/m1-recap-20260921-110550-prog-signoff/（7 份）。§3 门禁表 verify 行文件数口径更新（105→110，美术资产入库）。业务代码本批零改动；B-#1 三态维持占位待核销，剩真机触摸复跑一项。
- 2026-09-21 游戏程序（新 HEAD 无回归核实批次）：当前 HEAD（92bdbb8）六门禁复跑全绿（契约双口径 46 PASS/0 FAIL + smoke + audio-tick + fx-settlement PERF 61.0/53.6 + verify PREFLIGHT 110 文件），原文 gate-logs/m1-recap-20260921-124403-prog-noRegression/；§3 门禁表各行结论维持，无新待办（程序侧动作已全清，剩余项均归真机批次/主人拍板）。

## 变更记录（追加式）

- 2026-09-22 主策划（M1 收口验证 + M2 立项冲刺）：双线 M1 门禁复验全绿（糖果六门禁 + 足球七门禁首次实跑即收口，原文 gate-logs/m1-recap-20260922-*）；足球线 acc-05 当日交付闭环（tests/ui/onboarding-hint.test.mjs 8/8）；acc-09 槽位翻转完成。关卡内容零改动。M1 终态判定 = pass（m1-gate-verdict.json，待主人拍板）。
- 2026-09-22 游戏程序（复验三件套批次 · 足球线）：①补缺口——「局末→结算→重开」全链路此前零测试覆盖（`Match.restart()` 全工程仅 match.js:81 定义、无任何断言），新增 `pixel-fives/tests/smoke/fulltime-restart.test.mjs` **27/27 PASS**（局末冻结 5 + 结算终态 5 + restart 复位 9 + 重开可玩 4 + 同 seed 复现 3，比分 5:2 逐 tick 一致）；②落一键复跑入口 `pixel-fives/tools/m1-reverify.sh`（三件套 = 契约测试 + 两件冒烟 + bot-sim 100 场，命令可整段粘贴，日志自动归档）；③本会话亲自复跑**四件全 exit 0**：契约 43 PASS/1 WARN/0 FAIL、full-match 9/9、fulltime-restart 27/27、bot-sim 100 场两比率=1.0 且同 seed 复跑 diff 为空——逐场比分清单 `4-bot-sim-100-scoreboard.txt` 归档；证据原文 `gate-logs/m1-reverify-20260922-103720-prog/`（15 件），批次明细 `pixel-fives/docs/dev/evidence-prog-m1.md` §9。业务代码零改动、spec 零改动；糖果线本会话同步复跑（godot 已解析可用）：契约双口径 46 PASS/0 FAIL ×2 + godot-smoke PASS，原文 `gate-logs/m1-reverify-20260922-candy-prog/`（5 件）——双线 M1 复验自此均为本会话亲手实跑证据支撑。
