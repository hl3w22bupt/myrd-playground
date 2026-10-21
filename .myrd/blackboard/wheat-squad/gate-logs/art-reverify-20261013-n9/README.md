# 美术复证轮 r9 证据包（2026-10-13 · N9 驳回修复轮跨线认领 · 游戏美术）

> 结论仅对 HEAD `7c570ec` 有效（`00-head.txt`）。任务书再次重发 → 勘验发现 N9 驳回修复轮两笔新提交（`a0929c2` 契约断言层 + `7c570ec` 证据收口），**他线触及测试/契约层且断言直指美术交付件** → 按 reverify-gates-after-cross-line-changes 全量重证 + cross-line-art-deliverable-review 逐项认领。

## 检项与结果（全绿）

| # | 检项 | 结果 | 证据件 |
|---|---|---|---|
| ① | verify.sh 五步全量（含 WS-SMOKE + scope-guard 双模式） | 五步逐条 PASS · **VERIFY_EXIT=0** · ac-art-1..4 全绿 · ac-16 新断言（a5 statement 谓词 + 文案三方同名）绿 | `01-verify-sh-full.log` |
| ②a | 三方色值机判（卡↔theme.ts↔spec） | 8 色逐值全等 · EXIT=0 | `03-palette-consistency.log` |
| ②b | 零漂移：7 件美术交付件 vs r8 基线（`e99a4d2`） | 逐字节全等（N9 两笔提交零触及美术交付件，git diff 复证） | `02-art-specific-checks.log` §b |
| ②c | 裸色值面（src 除 theme.ts） | 0 hex / 0 裸 rgba(数字 | `02` §c |
| ②d | 文案三方同名独立复算（跨线认领配套） | spec.copy ≡ manifest.copy ≡「拖动队长移动 · 队员自动作战」 · EXIT=0 | `02` §d |

## N9 跨线改动逐项认领（cross-line-art-deliverable-review）

| N9 条 | 改动 | 美术口径复核 | 认领 |
|---|---|---|---|
| ① | ac-16 补 a5 statement 谓词逐字断言 + 窗值改 approved statement 机器解析（fail-closed，弃「numeric.guidance.windowMs」不存在的第二真源） | 判定参数非视觉参数，美术面无涉；fail-closed 单源方向与本线 token-single-source-chain 纪律同构 | ✅ 认领零保留 |
| ② | ac-16 补文案三方同名逐字机判（spec.copy ≡ manifest.copy ≡ GUIDANCE_TEXT ≡ hint_shown.text，双变异先红后绿） | 直接约束本线 manifest `guidance-hint-banner.copy` 字段：三方同值实测 ✓；文案面自「人工目核」升「逐字机判」，与风格卡 §v1.2「G-1 逐字单源」同向加强 | ✅ 认领零保留 |
| ③ | ac-11（本线机判件 ac-art-2）知情窄面披露：机判仅查 entity 类，四件非 entity id（ui-kit-01/sub-icon/sub-sharecard-5x4/sub-shots-3）不在 entities∪assets；判据不变，升级主策划裁决 | 披露属实（guidance-hint-banner 已在 spec.assets 故不在四件内，自洽）；**美术线立场**：选项 A（statement 改「id ∈ entities∪assets 登记集」）更契合——manifest 类别学（entity/ui-kit/ui/submission）本就源自风格卡 v1 清单规范，而 entities 是逻辑实体口径（13 件含 8 件无视觉件）；选项 B（spec.assets 补登四件）将致 spec.assets 与 manifest 双登记、增漂移面。**两选项下 manifest 10 件均零字节变更，本线冻结面不动，裁决归主策划** | ✅ 立场登记，不擅改 |
| ④⑤ | 证据取码口径落死（禁隔管道）+ README 悬空行 | 与本线证据纪律一致 | ✅ 认领 |

## 诚实口径（本轮自身瑕疵披露）

1. `00-git-status.txt` 初版自污染：建证据件后才取样 status，`?? 证据目录/` 被误录为他线残留——已复取修正留档（排除自身后残留=0，工作树实质干净）。
2. `02` §a 首版 `PALETTE_EXIT` 经 `\| tail` 隔管道取码（取到 tail 码）——**N9-④ 刚落死红线的同型违例**，即刻按「紧邻直取·重定向非管道」重取修正（`03`，EXIT=0 可信），初版未删改随档。
3. 本轮零新产资产、零风格面改动；wx/dy 分享图维持不出；A3 结论面 ⏳ 待真人回填；正式提审素材止步清单维持。
