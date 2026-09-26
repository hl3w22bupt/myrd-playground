# iOS Safari 真机实测归档状态 · 《光路谜阵》（game-4）

> 归档轮次：2026-09-27（assign_agent「实机实测 JSON 落库 games/game-4/qa/ 并归档量表答案」）
> 分支：`myrd/game-4-goal-cmuieqj7o0031m9gyf4pbwptg`
> 回传入口（保持敞开）：<https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?qa=1&tuning=1>
> 回收频道：「光路谜阵 · 试玩反馈」（id `cmuilmi19009im9gcqjh5yuns`）

## 一、本轮结论（TL;DR）

**本轮尚无真机（iOS Safari 实体设备）回传** —— 回收频道截至 2026-09-27 仅有 2 条出站邀请
（2026-09-26T16:23 试玩回填邀请、2026-09-26T21:18 iPhone 一键实测邀请 v4），无任何用户粘贴的
`guanglu-qa-report/1` / `guanglu-survey/1` JSON。因此按预案走「**待回收位**」分支：

| 应交付物 | 状态 | 落位 |
|---|---|---|
| 一键实测操作卡 | ✅ 已入库（前序 WebKit 核验轮产出，v1.1） | `qa/IPHONE_QA_CARD.md` |
| 待回收位（?qa=1 报告） | ✅ 本轮落位 | `qa/ios-safari-report-PENDING.json` |
| 待回填位（四问量表） | ✅ 本轮落位 | `qa/ios-safari-survey-PENDING.json` |
| WebKit 对新自检链路的等价性验证记录 | ✅ 已入库（真 WebKit 内核 27/27 PASS） | `qa/WEBKIT_LIVE_VERIFY.md` |
| 真机实测记录 `ios-safari-*.{json,md}` | ⏳ **待回传**（本文件即状态登记处） | 数据到达后按 §三 固化 |

回传入口健康度（本轮实测）：`GET /apps/game-4/gw` = 200、`/gw?qa=1&tuning=1` = 200 —— **入口敞开**。

## 二、真机数据到达前的可信替代证据（WebKit 等价性验证）

真 iOS 设备数据缺位期间，能背书「新自检链路本身是好的」的证据是 **Playwright WebKit 26.6
（真 Safari/WebKit 内核，UA `AppleWebKit/605.1.15`，非 Chromium 模拟）** 的全链路实测，
详见 `qa/WEBKIT_LIVE_VERIFY.md`，要点：

- **27/27 项 PASS**：iPhone 形态（390×844 DPR3）引擎启动、`?qa=1` 激活、被动采样、
  自动扫描 23 目标/24 样本、报告 JSON 生成并经 `share` 通道导出、报告 schema
  `guanglu-qa-report/1` 可解析、触屏命中率 0.958、旋转时延 p95=51ms（预算 120ms）、
  四问量表 7/7 必答可点选可提交（`GUANGLU_SURVEY`）、全程零页面错误。
- **该轮复现并修复 3 个只有真浏览器才暴露的 UI/输入层缺陷**（`_resolve_board` 把 Main 当
  Board → 自动扫描恒 0 目标格；量表提交按钮落在引擎视口外不可达；`?tuning=1` 下触屏点按
  被遮挡旋转无效），修复已入库（`scripts/qa_selftest.gd` / `scripts/survey_panel.gd`，
  commit `33b37cc`）。
- **等价性边界（如实声明）**：桌面 WebKit 与 iOS Safari 同内核家族，可等价验证 UI 布局、
  输入路由、导出通道与 JS 桥；**不可等价验证**真机多点触控、真机扬声器/振动、真机性能
  （发热降频）、iOS 系统分享面板真实行为 —— 这四项仍必须由真机回传数据闭环，故待回收位
  保持敞开，**真机验收结论在本轮不升格为「已验」**（目标验收标准第 6 条口径不变）。

## 三、真机回传到达后的固化流程（预登记）

1. 从频道取出用户粘贴的 JSON（`{` 开头、含 `"schema":"guanglu-qa-report/1"`）。
2. 原样落库：`games/game-4/qa/ios-safari-<UTC日期>-<机型>.json`
   （如 `ios-safari-20260928-iphone15.json`；量表答案另存 `ios-safari-survey-<UTC日期>.json`）。
3. **删除**对应 `ios-safari-*-PENDING.json` 占位文件（避免占位与实测并存混淆）。
4. 在本文件 §四 登记实测结论：触控命中（`touch.summary.hit_rate` / `verdict.touch_hit_ok`）、
   旋转响应（`rotation_latency.stats.p95_ms` / 预算 120ms）、音效状态
   （`audio.audio_context_state`，`running`=出声；`suspended`=待手势解锁）、设备信息
   （`device.*`：UA/DPR/屏幕/触摸点数）、机判总结论（`verdict.pass`）。
5. 机判口径复用 `qa/QA_SELFTEST.md` §一：管格 = 路由到位且真的旋转；非管格 = 路由到位且
   正确地不旋转；`pass = 命中率达标 ∧ p95 ≤ 120ms ∧ 音频可出声`。
6. 四问答案若与已拍板 `spec.numeric`（v2，`tuning_applied=true`）冲突 → 按平台流程
   `POST /api/v1/game-design-specs/:id/revisions` 追平并重新 approve，不得只改代码默认值。
7. `godot-smoke` 门禁复跑 + commit + push + 目标 artifacts 回写结论。

## 四、真机实测记录（待回传，数据到达后填写在此）

| 回传时间 | 设备/系统 | 触控命中率 | 旋转 p95 | 音效状态 | verdict.pass | 记录文件 |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | ⏳ 待回传 |

四问量表结论（待回传）：① 目标可懂 — / ② 再来一局 — / ③ 手感四维 — / ④ 节奏断档 —。

## 五、已知差距与跟进项（如实登记）

1. **线上 v18 尚未包含 3 缺陷修复**：最新部署 `cmuisxou100ccm9l6wv2gpynx`（2026-09-26T19:47Z）
   早于修复提交 `33b37cc`（2026-09-26T21:17Z）。当前线上行为 = 操作卡「⚠️ 当前线上状态」段
   所述（链接可玩、报告可生成可分享；自动扫描 0 目标格、量表提交按钮不可达），**最低门槛
   回传方式（粘贴 QA 报告 JSON / 打字回四问）依然有效**。需下一轮部署节点把含修复的
   `games/game-4/export/web/` 产物随部署线分支重导出重部署，链接即成完整 5 下回传路径。
2. 修复后的仓内导出产物已入库（`33b37cc` 重导出 `export/web/index.pck` 2,609,840B），
   部署线分支（`myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`，HEAD `e83190b`）尚待推进到含
   `33b37cc` 的提交后再触发部署。

## 六、本轮门禁取证（与门禁同源，2026-09-27 实跑）

| 门禁 | 命令（判定脚本来源 = 仓库内 std-skills，未改动） | 结果 |
|---|---|---|
| resolve-godot | `bash std-skills/godot-game-dev/scripts/resolve-godot.sh` | `godot`（4.3.stable.official.77dcf97d8） |
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-4` | `PREFLIGHT: PASS 13 类前置一致性检查全部通过（96 个工程文件）`，exit 0 |
| smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=$(resolve-godot.sh) bash std-skills/godot-game-dev/scripts/smoke.sh games/game-4` | `godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）`，exit 0 |
| input-fuzz | `GODOT_BIN=$(resolve-godot.sh) bash std-skills/godot-game-dev/scripts/input-fuzz.sh games/game-4` | `GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239`，exit 0 |

> smoke 判定协议三条件核对：退出码 0 ✅；内层断言标记齐全（`GODOT_SMOKE: PASS`，由
> smoke.sh 内层日志 grep 判定，通过后按设计清理临时日志）✅；日志零 `SCRIPT ERROR`/`Parse Error` ✅。
> 本轮新增文件均在 `qa/`（含 `.gdignore`，不入 Godot 导入面），不触碰场景/脚本/导出产物。

## 七、相关文件索引

| 文件 | 作用 |
|---|---|
| `qa/IPHONE_QA_CARD.md` | 一键实测操作卡（5 下回传 + 四问 + FAQ，v1.1） |
| `qa/ios-safari-report-PENDING.json` | ?qa=1 报告待回收位（键面 = `guanglu-qa-report/1`） |
| `qa/ios-safari-survey-PENDING.json` | 四问量表待回填位（键面 = `guanglu-survey/1`） |
| `qa/WEBKIT_LIVE_VERIFY.md` | WebKit 真内核等价性验证记录（27/27 PASS + 3 缺陷根因/修复） |
| `qa/QA_SELFTEST.md` | 自检/量表实现与机判口径（门禁断言面） |
| `qa/shots-webkit-verify/qa-report-live.json` | WebKit 桌面实测报告样例（schema 参照，非真机数据） |
| `qa/shots-webkit-verify/survey-live.json` | WebKit 桌面量表回传样例（agent 代答，非用户作答） |
| `qa/PLAYTEST_KIT.md` | 试玩验收包 v3（含真机自检试玩者指引） |
