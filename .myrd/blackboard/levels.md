# levels.md — Pixel Fives 关卡状态（共享黑板）

> 更新时间：2026-09-21（M1 门禁收口冲刺日）
> 负责人：主策划（本文件全团队共用，改动请在「变更记录」追加一行）
> 下一步：美术三态 UI 稿交付后二次复验（RESUME 态从「占位」转正式）；N1（snake-ghost）立项后新增「N1 关卡规划」区

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
| verify.sh（preflight+smoke） | `bash games/game/verify.sh` | ✅ **实跑 PASS**（exit 0：`PREFLIGHT: PASS 13 类…105 个工程文件` + 冒烟 PASS）——B-5 待办就此关闭 | m1-gate-runbook.md §6 |

## 4. 变更记录

- 2026-09-20 主策划：建档；阶梯/门禁状态按当日探查实况填写，M1 实跑输出待有 shell 的执行者回填。
- 2026-09-21 主策划（实跑批次）：M1 三门禁全部实跑转绿（smoke / contract 46 PASS 双口径 / audio-same-tick），原文回填 runbook §1/§2 占位区；snake-ghost spike 桌面口径实证「能」（data/20260921-010252）。⚠️ 本文件主策划上轮两行曾被并行会话覆盖丢失，本轮基于磁盘现状重写——共享黑板文件请改「追加」勿整文件重写。
- 2026-09-21 游戏程序（第三轮驳回处置）：登记 B-5（spike_main.tscn 被回退平铺路径 → 未来 verify.sh/preflight 重跑必 P6 假红；9/21 已绿证据不受影响——冒烟走的直连 smoke.sh；两修复案待改动人择一，程序未擅自回改）；blockers 升级汇总刷新至门禁全绿后五条（追认确认/snake-ghost 终裁/v1.2 未闭环/引导条款建议等）；B-3 与 runbook §4 的口径挑明记录从覆盖事故中恢复。
- 2026-09-21 游戏程序（P5/P6 修复批次）：驳回附实跑失败原文（PREFLIGHT P5+P6 FAIL，exit 1，日志已归档 gate-logs/contract-gate-20260921-012610.log）→ 按 B-5 方案 A 修复：spike_main.tscn 改指向 `res://qa/snake-ghost-spike/spike_main.gd`、run-spike.sh 临时工程镜像结构（保留实跑批次的 ASCII heredoc 防 error 43）、README §2② 同步；games/game 内 `res://spike_main` 平铺引用清零。**待重跑** verify.sh / run-m1-gates.sh 产出新证据目录，预期 PREFLIGHT: PASS → 冒烟 PASS。
- 2026-09-20 游戏程序（下午批次）：门禁状态三行更新——①契约脚本静态核对完成并修复 2 处获批后假阴性（数值扫描清单 + audio-same-tick.gd 落地）；②冒烟新增 audio-same-tick 契约场景命令；③音画同 tick 程序独立复核完成（行级证据）。实跑动作仍挂 B-1，本会话无 shell，未产生任何实跑输出。
- 2026-09-21 主策划（收口冲刺批次）：门禁表新增「反馈/三态/持久化契约」（阻塞#1#2#3 机判落点，FX_SETTLE_PERSIST PASS）与「verify.sh」两行；五份实跑原文归档 gate-logs/m1-recap-20260921-094116/；结算三态口径定为 WIN/LOSE/RESUME（RESUME 依赖 SaveState 存档，UI 占位待美术稿二次复验）。
- 2026-09-21 游戏程序（收口冲刺 · 独立复跑批次）：六门禁全部**本会话亲自复跑**并归档独立证据 `gate-logs/m1-recap-20260921-095257-prog/`（5 份原文）——契约双口径 46 PASS/0 FAIL（两副本 `diff` 为空）、godot-smoke PASS、audio-same-tick PASS、fx-settlement PASS（PERF avg 61.0 / 稳态最差 53.5）、verify.sh PREFLIGHT PASS + smoke PASS，全部 exit 0。实现层核实：SaveState 已注册 project.godot [autoload]、结算栈同 tick 落档（game_state.gd add_score/use_move/advance_level/check_end）、三态 RESUME 双入口（NewGameButton 在 main.tscn + main.gd setup_resume_offer）、VFX 参数区在 main.gd（屏震封顶 10px/0.28s 归零）；fx-settlement 契约断言非空转（逐字段盘档比对 + best_score 跨局 + 阈值守卫）。§1 基线 autoload 行补 SaveState（上轮遗漏，本批修正）。业务代码本批零改动，纯复验批次。
