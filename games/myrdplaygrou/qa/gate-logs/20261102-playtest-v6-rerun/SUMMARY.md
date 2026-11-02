# playtest 节点重跑收口 · v6 三 Bug 修复态重验（run cmvypf21o0076m9y0zcjjpol1，2026-11-02 14:4x–15:1x +0800）

> 结论先行：**移动端可玩性门禁全绿（preHook 降级口径 + 本节点完全口径复跑，双口径对线上实测）+
> 本地四门禁全绿 + 三 Bug 机判证据本节点新鲜复现 + 能量探针 9/9（哈希绑定）+ 试玩验收包已更新交付
> （`games/myrdplaygrou/qa/playtest-kit.md`，v6 修复态口径）**；
> **goal.artifacts 回写与部署仍被平台鉴权链 403 阻断（与本 run 发布节点同一根因，本节点复测新鲜取证），
> 按 fail-closed 停手并以仓库内交付 + 本目录取证代替，未伪造回写成功**。
> 量表状态 = **待用户试玩**（未收到用户四问结论与调参 URL，第 3 步 spec revisions 回写按纪律跳过，
> 不代答不伪造）。

## 1. 门禁资产来源校验（硬约束第 1/2 类，开工前核验）

- `std-skills/godot-game-dev/scripts/`：preflight.py / smoke.sh / input-fuzz.sh / playtest.sh /
  resolve-godot.sh / mobile-web-smoke.mjs **六件全在**（git 跟踪文件）✓
- `.myrd/routines.yaml`：含 `id: godot-smoke` 与 `id: mobile-web-smoke` routine ✓
- `std-skills/godot-game-dev/references/{godot-smoke-routine.md, mobile-smoke-routine.md}` **两件全在** ✓
- 判定只认仓库内路径；`.myrd-platform/.claude/skills/godot-game-dev/` 注入副本未当判定来源，仓库内脚本零改动 ✓

## 2. 移动端门禁（对线上 liveUrl，双口径，均实测线上 v14）

| 口径 | 结论 | 指标 | 证据 |
|---|---|---|---|
| preHook（节点开工自动跑，未带 --project） | verdict=**PASS**；joystick-target=warn（回退旧版固定坐标 swipe，仅取证不断言） | fps=40，tapDiff=5，idleDiff=328，scrollWidth=390=clientWidth，console 零 error | `prehook-report-legacy.json`（checkedAt=2026-11-02T06:58:51Z，本目录留存副本）+ 三张分阶段截图 |
| 本节点复跑 `--project games/myrdplaygrou`（完全口径） | **MOBILE_SMOKE: PASS 11/11**（joystick-response=按规则裁撤：工程无 scripts/virtual_joystick.gd，点按类玩法按 SKILL.md §3A） | fps=40，tapDiff=5，console 零 error，触摸管线通，`__audioDebug` 在位，视口无溢出 | `games/myrdplaygrou/qa/mobile/report.json` + phase-load/tap/joystick.png（本轮覆盖提交） |

- 两口径**无矛盾**：完全口径把降级口径唯一的 warn 项收口为「按工程裁撤」的 PASS，其余各项结论一致。
- preHook 结论「移动端能不能玩已机判全绿」与证据相符；**注意该结论受测对象是线上 v14**（版本锚点见 §4），
  不代表 v6 修复态已上线 —— 本节点已在验收包 §0 如实区分。

## 3. 本地四门禁 + 三 Bug 机判证据（HEAD 7a79216，工程内容 = f0b3dd3）

`bash games/myrdplaygrou/verify.sh` → **exit=0**（判定脚本全部来自仓库内 std-skills/，薄壳零复制）：

```
PREFLIGHT: PASS 15 类前置一致性检查全部通过（2757 个工程文件）
godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）
GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239
GODOT_PLAYTEST: PASS 3 局全部通过（fb=226/253/238，最长无反馈窗 ≤0.383s，阈值 tests/playtest.json）
verify: PASS preflight + smoke + fuzz + playtest 全部通过
```

证据：本目录 `verify-full.log`；`godot-bin.txt`（4.3.stable.official.77dcf97d8）。

冒烟 600 帧全量断言（本目录 `smoke-evidence.log`，本节点新鲜产出）逐条核对三条 Bug：

| Bug（用户反馈） | 机判断言 | 本 run 证据行（逐字） |
|---|---|---|
| ① cmvyowgsh006sm9y05qblbd70（P1 顶栏按钮重复） | SWEEP level==1（过关进第 2 关）→ `debug_control_counts()`：常驻 7 类各 ==1、卡槽 ==关卡数 | `[smoke] 顶栏单实例守卫通过（第 2 关常驻控件 sun/next_wave/wave/lives/back/restart/mute 各 1，卡槽 5 张）` |
| ② cmvyowgtj006um9y0lxb19hyt（P1 按钮与字体过大重叠） | 360/768/1280/1920/2560 五档 SubViewport 逐档实例化：12 元素在画布内 + 两两无重叠 + 钳制带（按钮高 44~56 css）+ 行距 ≥8 + 顶栏 ≤ 草坪首行 | `[smoke] HUD 布局 360×740：两行 12 元素在界无重叠（按钮高 44 css，行距 8，战场让位 50 px）` … `2560×1440：单行 …`（5 档 5 行全过） |
| ③ cmvyowguf006wm9y0cf7fbxk3（P2 音效紧张刺激与代入感） | 静态：18 资产在盘在册 + 紧张版循环 + 切换真值表 + 配方分层；行为：groan/chomp/danger 触发 + 双版切换与回落 + 末波急促号角 | `[smoke] 音频紧张感探针通过（groan/chomp/danger 触发、双版 BGM 切换与回落、末波急促号角在册）` |

真实出声兜底：能量探针 `audio_energy_probe.mjs`（本地导出 :8123，绑定
`--expect-pck-sha 76b09d9b…` / `--expect-js-sha 8b649683…`）→ **AUDIO_PROBE: PASS 9/9**
（首手势前真实静音→手势解锁→BGM 持续能量≥-48dBFS→音效尖峰→静音即时归零→恢复→18 音频资产在包→console 零错误）。
证据：本目录 `audio-probe.log` + `audio-probe/`（report.json + timeseries + 相位截图）。

冒烟断言 ↔ 策划案 v6 验收条目一一对应（`games/myrdplaygrou/docs/spec-acceptance-mirror-v6.md`，本节点 re-read 无漂移）：
`acc-hud-layout`（check=games/myrdplaygrou/tests/smoke.gd）↔ `_step_hud_layout`/`_assert_hud_rects`/SWEEP 单实例守卫；
`acc-audio-tension`（check=tests/acceptance/audio-tension.spec.js，工程侧实现在 smoke 紧张感探针 + 能量探针）↔
`_check_audio_tension_static`/`_step_audio_tension`。spec v6 只读核验 HTTP 200（id=cmvyol366005wm9y0kzkdz57d，
status=approved，version=6）。

## 4. 版本锚点（本节点独立复算）

- 线上 `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/health` → 200（`live-health.txt`）。
- 线上 `api/public/assets/index.pck`（gzip+b64 解码 5,605,248 bytes）sha256 =
  `32d79ee289bd5184cb6cc57264ffa20df7ac32bbe159b42bfd11ba1153f3562a` = **v14（26c7b62）**
  （`live-pck-forensics.txt`）—— **v6 三 Bug 修复未上线**。
- 本地 HEAD 导出 `export/web/index.pck` sha256 = `76b09d9b94f369547180df1b8908f089e2c35ff57eaa5d9523aa481fcb0095bc`、
  `index.js` = `8b649683883a8be172e229a0479503d50cd5245ebf87aa71fda70bf720824075`
  —— 与 r5 发布轮留档逐字节一致 = **零漂移**，部署输入就绪。
- 调参工作台入口在线上 v14 可用（`is_enabled` 修复 `2e84342` 是 v14 祖先，本节点 merge-base 核验）。

## 5. goal.artifacts 回写：blocked（鉴权链，非本节点可解）

- GET `/api/v1/goals/cmvxjycvn001zm905jnwpyliv` → **HTTP 403**（req_1793603386418，本节点新鲜复测，
  `goal-get.json` / `goal-get-http.txt`）—— 读不到现有 artifacts 数组，按「合并不覆盖」纪律 fail-closed，
  不做盲 PATCH；部署 POST 不再重复尝试（同 run 发布节点已单次尝试 403 req_1793602423611，机制性拒绝）。
- 根因与解除路径（平台侧，任一）：换 Admin 触发身份重跑 / workflow-node token 补 actFor=应用属主 /
  属主迁移 / Admin 人工代发部署 —— 详见 `20261102-release-r5/SUMMARY.md` §4–5。
- 通道恢复后的一键回写内容（playtest_kit 条目对象、三 Bug 核销、新 deployment id）已备好：
  `artifact-writeback-attempt.log`。

## 6. 交付物

- **试玩验收包（v6 修复态口径）**：`games/myrdplaygrou/qa/playtest-kit.md` —— §0 版本锚点与三条
  「已修未上线」如实清单；§1 30 秒上手；§2 八关机制地图 + 音画契约（线上 v14 现状 vs v6 差异分列）；
  §3 四问结构化量表（**待用户试玩**空表 + 打分参照）；§4 调参工作台（16 键全表 + 回写流程）；
  §5 机判底座（本节点全新鲜证据）；§6 结果交回方式。
- 本目录全部证据文件。
- **未交付（blocked，非工程缺陷）**：goal.artifacts 回写、AppHost 新 deployment、liveUrl/deployment id
  刷新、线上 v6 修复态复验 —— 全部随 r5 §5 任一解锁路径执行。
