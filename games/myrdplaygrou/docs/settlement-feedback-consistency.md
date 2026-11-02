# 结算反馈一致性轮：两处 HUD 缺陷修复 + 冒烟断言 22/23（2026-11-02 玩法轮）

> 本轮无 spec 条款变更（策划案 v6 = `cmvyol366005wm9y0kzkdz57d` 仍是链上最新 approved，
> 本轮一字未动 spec、未动任何数值默认值）。收口对象 = 玩法走查发现的两处「结算反馈」缺陷：
> 都属于「失败与胜利反馈明确、重开可用」验收面 —— 反馈必须**只属于当局结算态**，
> 不得跨局泄漏、不得在终局瞬间口径漂移。

## 缺陷 ①：败局危险红跨局泄漏（重开不清）

- **现象**：一局打完生命 ≤1 时，HUD 生命数字被置危险红（`#E74C3C`，lives≤1 的失败反馈）。
  点「重开」开新一局后，生命回满 5，但数字**仍是红色**，整局带着上一局的失败色打到结束。
- **根因**（`scripts/hud.gd::_on_lives_changed`）：颜色覆写写在 `if lost:` 分支内 ——
  只有「掉命帧」才刷新颜色。重开时 `lives_changed.emit(5)` 走到同一处理器，
  `lost = (5 < 0) = false`，颜色分支被跳过，上一局末帧（lives=0）置入的红色就地滞留。
- **修复**：颜色覆写按「当前生命值」无条件执行（`lives <= 1 → RED`，否则 `UI_TEXT`）；
  `flash/pop` 抖动反馈仍只在掉命帧触发（反馈语义不变，只修状态残留）。

## 缺陷 ②：无尽模式终局波次号比进行中少 1

- **现象**：无尽模式进行中波次行显示「无尽 第 N 波」（N = wave_index+1，1 起人类计数）；
  被攻破瞬间 `_on_game_ended` 把同一行改写为 `wave_index`（无 +1）—— 终局瞬间波次号**倒退 1**
  （进行中「无尽 第 5 波」→ 终局显示「无尽 第 4 波」）。
- **根因**（`scripts/hud.gd`）：进行中（`_refresh_texts`）与终局（`_on_game_ended`）两处各自
  拼接文案，口径靠人肉对齐 —— 典型的「同义文案多点维护」漂移。
- **修复**：收口唯一出口 `Hud.endless_wave_text(wave_index)`（`wave_index + 1`），
  两处一律调它；紧凑档「∞ N」保持独立（同一 +1 口径，仅格式不同）。

## 机判（tests/smoke.gd 新增断言 22 / 23，负例双向验证）

| 断言 | 相位 | 拦截面 | 负例证据 |
|---|---|---|---|
| 22 重开反馈复位 | RESTART（复用 LOSE→RESULT→RESTART 真实链：本局生命已被打到 0 置红） | 修复回退 → `FAIL 重开不可用：生命数字残留危险红 (0.9059, 0.298, 0.2353, 1)`（neg-lives-color.log） | `qa/gate-logs/20261102-gameplay-settlement-consistency/neg-lives-color.log` |
| 23 无尽波次口径 | ENDLESS（推进 1 波后双口径比对 + 终局回调实跑） | 修复回退 → `FAIL 无尽模式：终局波次文案「无尽 第 1 波」≠ 进行中口径「无尽 第 2 波」`（neg-endless-wave-text.log） | `qa/gate-logs/20261102-gameplay-settlement-consistency/neg-endless-wave-text.log` |

- 断言 22 落在 RESTART 相位天然覆盖「败局置红 → 重开」全链（LOSE 相位刚好把生命打到 0），
  零新增帧预算；断言 23 落在 ENDLESS 相位既有帧内（复用第 3 帧断言组），同样零加帧。
- 机判取数面：`Hud.lives_font_color()` / `Hud.wave_label_text()` / `Hud.endless_wave_text()`
  （与既有 `hint_alpha()` 同款「机判取数口」约定，运行期零调用）。
- 备注：负例日志中 FAIL 行出现两次 = 冒烟 fail-fast（`_physics_process` 在 failures 非空时
  再收口一次 `_report`）与 `_pass_summary()` 末相位双重触发的既有表现，不影响退出码与判定。

## 门禁证据（2026-11-02，本轮全链路复跑）

- `verify.sh`（薄壳，四门禁同源仓库判定脚本）exit 0：
  PREFLIGHT PASS 15 类 / GODOT_SMOKE PASS 240 帧（断言 23 项含新增 22/23，日志零脚本错误）/
  GODOT_FUZZ PASS（seed=20260913）/ GODOT_PLAYTEST PASS（3 局×900 帧）。
- 日志：`qa/gate-logs/20261102-gameplay-settlement-consistency/{verify-full.log, smoke-scene.log,
  neg-lives-color.log, neg-endless-wave-text.log}`。
- 部署边界：AppHost 部署由平台部署节点执行（沙箱令牌无 `/api/v1/apphost/*` 写权限，403 实证）；
  本节点交付含修复的 Web 导出产物（export/web/ 已按 preset 重导出，先无头 `--import` 二次导入）：
  `index.pck` 8,234,432 B / sha256 `82d6303e470dbbc7703afc8d2cedb9da8e8705653b63f061becb02a8dd1dd1f0`
  （较上版 +640 B = 本轮脚本改动；`index.js` sha256 `8b649683…` 与线上引擎引导逐字节同值未动），
  指纹留档 `qa/gate-logs/20261102-gameplay-settlement-consistency/export-sha256.txt`；
  apphost.toml assets_dir 指向不变，push 后由部署节点以
  gitRef = `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv` 出新 deployment 并回写 liveUrl，
  线上一致性复验随 deploy/playtest 节点执行。
