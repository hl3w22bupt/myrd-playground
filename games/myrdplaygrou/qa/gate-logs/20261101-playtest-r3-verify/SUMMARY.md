# r3 试玩验收节点 · 独立复验记录（playtest_kit 的机判底座，本目录即证据）

- 时间：2026-11-01 22:1x–22:3x +0800（本试玩验收节点执行窗口）
- 分支：`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`；HEAD `0eed76ce1c8c`
- 线上部署：deploymentId `cmvxwpgej000zm9z6mepcek2n`（version=10，status=running，gitRef=`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`，部署 commit=5b38fb8；HEAD 相对部署 commit 仅新增 qa/spec 证据，无工程代码差异）
- HostedApp：`cmvxjyb8a001xm905cnip241e`（slug `myrdplaygrou`，status `ready`）；liveUrl `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/`
- 线上一致性：本地 `export/web/index.pck` sha256=`19c6ae6ef9ea2c1425bdfed1c4c8b838e715f26d06bc6f3b0ae47c5684eb1f7c`；线上同一文件（资产通道 gzip+b64 解码后 5576736 bytes）sha256=`19c6ae6ef9ea2c1425bdfed1c4c8b838e715f26d06bc6f3b0ae47c5684eb1f7c` —— **逐字节一致**（本节点独立复验，非沿用 deploy 节点结论）

## 本节点独立复跑的门禁（判定脚本只来自仓库内 std-skills/godot-game-dev/scripts/，未自写未改写）

本地四门禁（`bash games/myrdplaygrou/verify.sh`，exit 0，fail-closed 薄壳；试玩阈值取自 `tests/playtest.json`）：

```
PREFLIGHT: PASS 15 类前置一致性检查全部通过（2587 个工程文件，不含 .godot/ 导入缓存）
godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）
GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239
godot-fuzz: PASS 输入鲁棒性 fuzz 通过（退出码 0，日志无脚本错误）
GODOT_PLAYTEST: PASS 3 局全部通过（节奏代理指标在阈值内，明细见 METRICS 行）
godot-playtest: PASS 机器人试玩通过（3 局，每局 900 帧，节奏代理指标在阈值内）
verify: PASS preflight + smoke + fuzz + playtest 全部通过
```

冒烟逐关取证行（smoke-raw.log，三关逐关通关 + 关卡推进 + 主按钮语义逐关核对）：

```
Godot Engine v4.3.stable.official.77dcf97d8 - https://godotengine.org
[smoke] 第 1 关通关（game_ended=true，主按钮 next，波次 4/4）
[smoke] 关卡推进 → 第 2 关「第 2 关 · 后院黄昏」（起始阳光 150，波数 5）
[smoke] 第 2 关通关（game_ended=true，主按钮 next，波次 5/5）
[smoke] 关卡推进 → 第 3 关「第 3 关 · 屋顶夜袭」（起始阳光 200，波数 6）
[smoke] 第 3 关通关（game_ended=true，主按钮 replay，波次 6/6）
GODOT_SMOKE: PASS 选关/四轴方向移动/布防/出战卡/提示淡出/射击/掉落收集/失败/重开/下一波/三关逐关通关/关卡推进/逐关难度生效/键位契约/内容表/难度平缓/对比度/音频契约/调参协议 全部通过
[1;33mWARNING:[0;93m ObjectDB instances leaked at exit (run with --verbose for details).
[0;90m     at: cleanup (core/object/object.cpp:2284)[0m
[1;31mERROR:[0;91m 5 resources still in use at exit (run with --verbose for details).
[0;90m   at: clear (core/io/resource.cpp:604)[0m
```

移动端门禁复验（对真实 liveUrl，`--project` 完全口径，headless Chrome 390×844 / DPR3 / iPhone UA）：

- **MOBILE_SMOKE: PASS**（exit 0）：11/11 项全绿；joystick-response=按规则裁撤（工程无 scripts/virtual_joystick.gd，点按类玩法按 SKILL.md §3A），摇杆热区按工程校准（project=games/myrdplaygrou，designViewport=1024x640）
- 指标：fps=44（swiftshader 软渲染口径 ≥8）；console 零 error；触摸管线通；`window.__audioDebug` 契约在位；视口无横向溢出
- 证据：`qa/mobile/report.json`（checkedAt=2026-11-01T14:28:57.665Z）+ phase-load/tap/joystick.png（本轮重跑覆盖，随本节点提交）

## Bug 收口核对（对照 approved spec）

| Bug | 判定 | 证据 |
|---|---|---|
| 冒烟契约缺「移动方向」断言 + spec.acceptance 缺操控语义声明（bug `cmvxrs3fv005em905y4eouy35`） | 已修复并复验 | ① 工程侧 `tests/smoke.gd::_step_move_axis` 四轴方向断言（沿轴 ≥8px + 本轴分量支配正交轴 + Player.moved 逐轴复核）随 GODOT_SMOKE: PASS 执行（见上取证行）；② spec 侧 `acc-input-semantics` 已入链 approved spec v3（specId=`cmvxw290c000wm9z6cec4yg92`，status=approved，acceptance 共 14 条，mode=auto，check=`games/myrdplaygrou/tests/smoke.gd`），仓库镜像 `docs/spec-acceptance-mirror.md` §2 同步 |
| 三关通关性缺机判门禁覆盖（bug `cmvxr1f1a004fm905ua2ua9ir`） | 已修复并复验 | `tests/smoke.gd` SWEEP_SETUP/KILL/ADVANCE ×3 逐关走真实路径（布防→跳末波→击杀→game_ended(true)→结算浮层主按钮语义 next/next/replay→confirm 推进），逐关取证行落盘（见上冒烟输出）；试玩侧 3 局×900 帧按 `tests/playtest.json` 阈值全绿（fb=[227, 245, 240]，阈值={'first_reward_seconds_max': -1.0, 'feedback_gap_seconds_max': 10.0, 'feedback_events_min_per_run': 2, 'seed_outcomes_min_distinct': 1}） |

## 量表状态（如实声明，不伪造）

用户试玩结论（四问量表）与调参 URL **尚未回填**：本节点不伪造任何「好玩/通过」类结论，量表状态=「待用户试玩」；
tuning_applied 步骤（game-design-specs revisions 通道）等用户结论经目标迭代回流后执行。
