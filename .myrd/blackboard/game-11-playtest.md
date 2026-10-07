# 《线上抓娃娃机》(game-11) 试玩验收节点交接（2026-10-07 · 画质 v2 重跑轮次）

## 本节点交付（v2 轮次）

- **试玩验收包**：`games/game-11/qa/playtest/PLAYTEST_KIT.md`（v2 全量重写：画质三专项看点 / 档位可见性前提 / v2 差异披露 / 四问量表 / 调参工作台）
- **产物已回写**：goal artifacts 追加 `op=playtest_kit` / `artifactType=playtest_kit` / artifactId=`game-11-playtest-kit-v2`（status=completed=「验收包已交付」；**量表状态=待用户试玩**，非试玩结论）
- **调参工作台入口**：https://leomac-studio.tail49399e.ts.net/apps/game-11/?tuning=1
- **移动端门禁（preHook 实跑）**：MOBILE_SMOKE PASS 10 项全绿，证据 `games/game-11/qa/mobile/`（report.json + 3 张分阶段截图，本节点已随仓库提交）

## 门禁前置核实（本节点开头做过，记录结论）

- 判定脚本 6 件套齐（`std-skills/godot-game-dev/scripts/`：preflight.py / smoke.sh / input-fuzz.sh / playtest.sh / resolve-godot.sh / mobile-web-smoke.mjs）→ 未触发 blocked
- `.myrd/routines.yaml` 含 id=godot-smoke 与 id=mobile-web-smoke；references 两份 routine 模板在 → 未触发 blocked
- preHook 证据与结论一致：report.json verdict=PASS、10/10 pass、无 EXEMPTION.md；**checkedAt 04:07:31Z 晚于 version 7 部署创建 04:02:46Z**——测的确实是 v2 部署
- 部署真实性独立复核：线上 `api/public/assets/index.pck.gz.b64` 解码 sha256=`603865ed03dccfb3`（3,459,648 B）与本地 HEAD 构建逐字节一致；/health 200；gitRef=`myrd/games-goal-cmuwf19ee000xm9lg4v7bxybn`（非 main）
- 口径注明（不替红线背书）：report 实测 **fps=17**（deploy 黑板写 15，以 report.json 为准）；门禁阈值 ≥8 是 **swiftshader 软渲染口径**，v2 需求「真机 ≥30fps」红线模拟门禁无法机判，以真机体感为准（建议用户真机试玩时顺带留意卡顿）
- 修复轨迹：round1 FAIL(fps=5，存档 qa/mobile-round1-fail/) → `07bba07` 软渲染探测修复（壳页写 `window.__SOFT_RENDER__`，游戏 JS 桥兜底读）→ round2 PASS(fps=17)

## spec v2 ↔ 实现差异（v2 轮新增核对，全文见验收包 §3）

1. hidpi：spec dpr_max=3 vs 实现真 GPU 钳 2（`?dpr=` 可到 3）；软渲染恒钳 1
2. MSAA：spec desktop 4x/mobile 2x vs 实现统一 2×（gl_compatibility 单值取舍）
3. 画质数值（rendering/materials/modeling/ui_theme）已落代码但**不进 ?tuning 面板**——调参面板只覆盖 7 个游玩键；画质数值修订走 spec revisions
4. 辉光/雾/软阴影在软渲染 LOW 档显式关闭（quality_tier=2 可断言）——「不得无声降级」的等效替代即此显式档位契约；**专项二效果验收以真机/桌面 HIGH 档预览为准**，门禁软渲染截图不能作为辉光/雾效证据
5. v1 差异仍有效（v2 spec 未改这些段）：娃娃名单/布货策略、时长 75 vs 90、开局币 5 vs 10、解锁钩子未实现、相机限位口径、物理参数口径

## 给下一轮（用户试玩结果回流后）

- 收到量表 + 调参 URL → 解析 `?tuning=<JSON>`（只认 TUNING_META 7 键：claw_speed=1.15 / drop_speed=2.6 / grab_radius=0.28 / grab_stability=0.8 / round_seconds=75 / target_dolls=3 / coins_start=5；未声明键忽略并注明）→ 与现值 diff →
  `POST $PLATFORM_API_URL/api/v1/game-design-specs/:id/revisions`（spec.numeric，带 sourceTrajectoryId）→ `POST .../approve` → artifacts 追加 op=tuning_applied → 按新 spec 重部署
- 量表若指向画质问题（如「辉光不够亮」）：数值落点在 spec.numeric.rendering/materials（spec 修订），不在调参面板 7 键内，同样走 revisions 回写
- 未收到用户结果 → 量表保持「待用户试玩」，禁止伪造试玩结论
