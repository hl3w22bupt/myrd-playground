# 美术复证轮 r11（2026-10-15 · HEAD `fa43539` · R1 复测收口轮收口后重锚）

> 四要素：文件名 / 日期(2026-10-15 UTC+8) / 命令 / 工作区根 = 仓库根（`myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `fa43539da67759521fbf1b87d67d1e50bc41bd41`）
> 勘验定性（redispatch-survey-first）：任务书重发 → **复证而非重做**。N3 美术批（三态清单 13 件 + 视觉基线对账声明 + W-7 B 案）已随 `147f1bc` 收口入黑板；本笔起因 = `fa43539`（程序线收口后复核）**扩了 `games/wheat-squad/ci/scope-policy.json` 白名单——本线 SCOPE-GUARD 门禁输入件**，按 reverify-gates-after-cross-line-changes 须在当前树全量重证。

| # | 文件 | 内容 | 命令 | 结论 |
|---|---|---|---|---|
| 00 | `00-head.txt` / `00-git-status.txt` | HEAD 锚 + 工作树取样 | `git rev-parse HEAD` / `git status --porcelain` | 工作树净（唯一未跟踪 = 本证据目录，取样自污染沿 r9/r10 判例披露） |
| 01 | `01-ac-1x-*.log` ×4 | 美术四条款快速门禁 | `node tests/contract/ac-1{0..3}-*.spec.mjs` | **EXIT=0 ×4**（色值白名单 / 清单对账 / 尺寸封顶 / 风格一致机制面） |
| 02 | `02-palette-consistency.log` + `02a-first-run-mismatch-stale-script.log` | 三方色值机判（风格卡 v1 ↔ theme.ts ↔ approved spec） | `node …/art-reverify-20261013/check-palette-consistency-v1.mjs` | **EXIT=0 · 8 色逐值全等 + 零清单外 token**。首跑失配如实披露：`head -1` 误取 20261011 最老版（内嵌旧工作区 `run-cmv34u4y…` 绝对路径）→ gate-failure-triage 定性门禁失配非色值违例，v1 版重跑 PASS；初跑输出已被重跑覆盖，`02a` 为**同命令复现留档（REPRO_EXIT=1，非初跑原件）** |
| 03 | `03-naked-color-scan.log` | 裸色值单源链两规则面 | `node check-naked-color-v1.mjs`（本目录留档） | **EXIT=0**：src 除 theme.ts 零裸 hex / 零 `rgba(数字`；manifest 零 hex；SVG 模板 28 处色值全 ⊆ 白名单 |
| 04 | `04-sha256-baseline.txt` | 6 关键件 sha256 基线 | `shasum -a 256`（绝对路径逐件） | 落档；manifest.json 另做独立实算比对：`git show 147f1bc:…manifest.json` sha256 ≡ 磁盘现值 `000d8908…` 全等（hash 链交叉一致，非 git diff 单一证据互证） |
| 05 | `05-verify-sh-full.log` | **全量五步门禁**（统一契约→自有契约→WS-SMOKE→SCOPE-GUARD 双模式） | `bash games/wheat-squad/verify.sh` | **VERIFY_EXIT=0**：CONTRACT PASS · 自有契约 **16/0/1PEND**（PEND=ac-a3 结论面 0/5 真人回填，与 QA 证据型裁决同向维持挂起）· tex-1 零位图 · SCOPE-GUARD 双模式 PASS（含 fa43539 扩围后 policy） |

## 目检亲审（机器后逐项目检）

- manifest v4 `fx-hit-shock` 条目 ↔ 风格卡 §R2.0 勘误**同源同口径**：`feedbackChannels=['knockback']`（真实态）、channelNote 记 W-7 B 案裁决、invuln 环从未构建、A 案 = R2 候选主人反馈触发。manifest `spec` 字段保留 spec 字面 = B 案有意设计（statement 字面零改动），非漂移。
- 三态清单 13 id 与 manifest v4 逐一同序全等；缺失计数 0 整件 / 1 声称面（W-7 已裁决）/ 3 提审占位（W-6 归主人）维持。

## 轨道 B（第三线）美术侧

- 0 图维持：候选未收敛，`line3-memo-v0.md` §五挂起件凭证已随 `4f424e5` 在档（风格卡轻量预研挂起，触发条件 = 主人拍板候选）。本轮零新产、零触碰。

## 诚实口径

- A3 结论面 ⏳ 待真人回填维持；正式提审素材止步清单维持；R1 结论 = QA 证据型（未判定·挂起·不烧冻结余量）。
- 02 首跑失配（取错脚本版本）与本目录取样自污染两项如实披露，均按既定判例处置留档。
- **结论仅对 `fa43539da67759521fbf1b87d67d1e50bc41bd41` 有效**；此后任何提交使本结论过期。
