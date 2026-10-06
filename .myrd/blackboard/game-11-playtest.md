# 《线上抓娃娃机》(game-11) 试玩验收节点交接（2026-10-06）

## 本节点交付

- **试玩验收包**：`games/game-11/qa/playtest/PLAYTEST_KIT.md`（试玩指引 / spec↔实现差异披露 / 四问量表 / 调参工作台说明）
- **产物已回写**：goal artifacts 追加第 4 条 op=playtest_kit / artifactType=playtest_kit（status=completed=「验收包已交付」；**量表状态=待用户试玩**，非试玩结论）
- **调参工作台入口**：https://leomac-studio.tail49399e.ts.net/apps/game-11/?tuning=1
- **移动端门禁（preHook 实跑）**：MOBILE_SMOKE PASS 10 项全绿，证据 `games/game-11/qa/mobile/`（report.json + 3 张分阶段截图，本节点已随仓库提交）

## 门禁前置核实（本节点开头做过，记录结论）

- 判定脚本 6 件套齐（`std-skills/godot-game-dev/scripts/`：preflight.py / smoke.sh / input-fuzz.sh / playtest.sh / resolve-godot.sh / mobile-web-smoke.mjs）→ 未触发 blocked
- `.myrd/routines.yaml` 含 id=godot-smoke 与 id=mobile-web-smoke；references 两份 routine 模板在 → 未触发 blocked
- preHook 证据与结论一致：report.json verdict=PASS、10/10 pass、无 EXEMPTION.md，与「门禁全绿」口径相符

## spec ↔ 实现差异（已如实写进验收包 §3，供下一轮决策）

1. spec.meta.engine=Three.js+cannon-es，实现=Godot 4.3 Web 导出（流水线锁定，建议在 spec 下一版修订 engine 段）
2. 娃娃名单与稀有度分档不同（数量均 8）：spec 普通3/稀有3/传说2 vs 实现 普通4/稀有3/隐藏1
3. 单局 90s(spec) vs 75s(实现默认，调参键 round_seconds)；开局币 10(spec) vs 5(实现默认，coins_start)
4. spec.content 的回访钩子/收集解锁未实现（长线设计，本版三爪开局全开、无持久化图鉴）
5. 相机限位口径不同（spec ±45°/15–65°/2.2–8.0 vs 实现 ±24°/18–53°/1.7–3.1m）

## 给下一轮（用户试玩结果回流后）

- 收到量表 + 调参 URL → 解析 `?tuning=<JSON>`（只认 TUNING_META 7 键：claw_speed/drop_speed/grab_radius/grab_stability/round_seconds/target_dolls/coins_start，未声明键忽略并注明）→ 与现值 diff →
  `POST $PLATFORM_API_URL/api/v1/game-design-specs/cmuwfezv40028m9lg07fd4zs3/revisions`（spec.numeric，带 sourceTrajectoryId）→ `POST .../approve` → artifacts 追加 op=tuning_applied → 按新 spec 重部署
- 引擎段修订（差异 1）属 spec 修订而非调参，走 revisions 的 spec 字段，不要混进 numeric diff
