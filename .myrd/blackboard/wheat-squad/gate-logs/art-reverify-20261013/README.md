# 美术复证轮 r8 证据包（2026-10-13 · spec v1.2 增量轮 · 游戏美术）

> 结论仅对 HEAD `c33a816` 有效（`00-head.txt`；工作树干净 `00-git-status.txt`）。
> 勘验定性：任务书重发 → **复证而非重做**（redispatch-survey-first）。美术交付面于本轮（N2/N3，`c4348e1`）已收口：style-card-v1 §v1.2 增量 + manifest v2（新增 guidance-hint-banner）+ 机判四件；`304dacf..c33a816` 增量 = 纯黑板文档（`05` 双证零触及美术交付件），主人无新美术方向 → 冻结件零触碰（style-consistency-over-asset-quantity）。

## 检项与结果（全绿）

| # | 检项 | 结果 | 证据件 |
|---|---|---|---|
| ① | 基线留证：7 件美术交付件 sha256 | 留档 | `01-baseline-sha256.txt` |
| ② | **verify.sh 五步全量**（统一契约 + 自有契约 16/0 含 ac-art-1..4·ac-16 + WS-SMOKE + scope-guard 双模式） | 五步逐条 PASS · **VERIFY_EXIT=0** | `02-verify-sh-full.log` |
| ③a | 三方色值机判（style-card-v1 ↔ theme.ts ↔ approved spec） | 8 色逐值全等 · EXIT=0 | `03-palette-consistency.log` |
| ③b | 裸色值单源链扫描（两规则面） | 代码面 src 除 theme.ts 0 hex/rgba；SVG 模板色值 ⊆ 白名单 8 色零清单外；manifest 0 hex · RESULT-EXIT=0 | `04-naked-hex-scan.log` |
| ③c | 零漂移证明（7 件 vs N8 复核锚 `304dacf` git blob 实算 + git diff 路径零触及） | 逐字节全等 · 触及 0 件 · RESULT-EXIT=0 | `05-asset-zero-drift.log` |
| ③d | 三入口 palette 可读亲核（approved 单源 / 门禁适配视图 / slug 薄壳） | 三面 8 色逐值全等 · EXIT=0 | `06-thin-entry-palette.log` |
| ⑦ | 目检面：§v1.2 引导横幅实现逐项符合性亲审 | 七项规则全符合 · PASS | `07-guidance-eyeball.md` |
| — | 机判脚本（沿 20261012 v1 版） | 复用留档 | `check-palette-consistency-v1.mjs` |

## 三合一包 v1.2 索求面回件核对（tri-pack-v1.2.md §五）

| 索求 | 回件 | 判定 |
|---|---|---|
| 风格参考卡 v1.2 增量：§1.1 视觉权重规则定稿（色值/字号档 ⊆ 白名单）+ G-1 排版一屏放下核对 | style-card-v1 §v1.2（七要素表 + 排版核对行） | ✅ 在档 |
| 资产 manifest 增量：guidance-hint-banner（kind=ui，文案逐字 G-1，命名对齐 entities id，ac-art-2 机判） | manifest v2 第 7 条（id/category/copy/copySource/styleRef 齐备） | ✅ 在档 |

## 诚实口径

- 本轮零新产资产（冻结纪律），wx/dy 分享图维持不出（任务书口径）。
- A3 结论面维持 ⏳ 0/5 真人回填（主人侧）；正式提审素材维持止步清单（待主人拍板）。
- 首跑瑕疵如实披露：③c 首版因 zsh 词切分缺陷落空一版（e3b0c44… 空输入 hash），已显式逐件循环修正重跑；③b 初版扫描口径过宽（把白名单内 SVG 色值与 theme.ts token 定义误报），已甄别两规则面后定稿，初扫输出未删改、裁定随件在档。
- g2-blocks / game-9 / 糖果线零触碰。
