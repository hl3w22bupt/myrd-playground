# 美术复证轮台账 — wheat-squad + g2-blocks 美术面（2026-10-11 · 游戏美术）

> 触发：任务书重发（D 轮六节点）。按 redispatch-survey-first 纪律勘验后定性：D 轮六节点已于同日全部收口（HEAD `d4eeea2`）+ 程序线复跑轮独立复验两线成立。本轮美术线 = **复证而非重做**：不重复造资产、不扩范围，在当前 HEAD 重证美术侧门禁与一致性，如实登记。
> 基准：一号仓 HEAD `d4eeea2`（工作树干净）· 源仓 main `cee0135` / sync/dy-v1.3 `9c27438`（与黑板声称一致）

## 复证项与结论（三步全绿）

| # | 复证项 | 方法 | 结果 | 证据件 |
|---|---|---|---|---|
| 1 | wheat-squad 契约（声称 9/0） | 当前 HEAD 实跑 `node tests/contract/run-all.mjs` | **9 PASS / 0 FAIL · EXIT=0**（含 tex-1 零位图、fv-4 flash=90ms 与参考卡光照节声明一致） | `01-contract.log` |
| 2 | 色值三方一致性（上轮 N5 为手核，本轮升机判） | `node check-palette-consistency.mjs`：style-card-v0.md ↔ theme.ts ↔ spec numeric.palette | **8 色逐值三方全等 · EXIT=0**，无清单外 token | `02-palette-consistency.log` |
| 3 | g2-blocks 美术面（只读核对） | 源仓 `git show sync/dy-v1.3` + 复跑轮证据件 | 四要素归零台账 `docs/art-settlement-dy-adapt-d1-20261011.md`（@`1fdd787`）在链；双档渲染留证（390×844 + 360×640 · score 逐字节一致 9432750）；材料清单 dy 段 v3「**已同步·提审就绪**」（`docs/platform/dy/dy-submission-kit.md:1,10`）；复跑轮终态 `gate-logs/dy-rerun-20261011/06`（DY-SMOKE PASS · contract v9/v10 29/0+1PEND） | 见「证据指针」 |

## 参考卡四要素逐项核对（N5 口径在当前 HEAD 重证）

| 要素 | 参考卡条款 | 实现核对 | 判定 |
|---|---|---|---|
| 调色板 | 8 色带色值（卡 §一） | 三方机判全等（复证项 2） | **PASS（机判）** |
| 光照 | hit flash = accentRed 环扩散 90ms（卡 §2） | `renderer.ts:40` `flashing ? THEME.accentRed : THEME.pestBrown`（token 引用）；fv-4 契约 flash=90ms PASS | **PASS** |
| 线条 | 显式描边四处 token 化（卡 §3） | `renderer.ts:53` `strokeStyle = THEME.wheatDeep`（token 引用）；tex-1 零贴图 PASS | **PASS** |
| 比例 | 画布 390×640 竖屏（卡 §4） | `game.ts:35` `field:{w:390,h:640}` + `game.ts:49` 默认参数同值 | **PASS** |

## 如实登记偏差（不掩盖 · 已有挂账归属）

- **`src/game.ts` 存在 5 处裸 hex 字面量**（99/101/104/117/120 行附近：`#F5EDD8`/`#C99530`/`#4A3826`）。定性：色值与参考卡三方全等 = **零风格漂移，当前视觉面正确**；但绕过 theme.ts 单源链，属单源链收口面。**归属：N5 回执 `docs/qa-n5-recon.md:20` 已以「手核放行 + v0.2 入机判门禁」口径显式挂账**（主黑板 blockers.md:43 同），非漏报缺陷。本轮按「复证轮不扩范围 + 已挂账按台账排期」不改动；v0.2 色值机判门禁落地时统一收口（game.ts 字面量改 THEME 引用 + 裸 hex 扫描入契约）。
- 材料清单诚实口径：g2-blocks 四要素中「安全区」HUD 顶行真机核对**维持挂账**（主人侧 devtools/真机档，AppID 未下发；观测口 `__G2_DY_SAFEINSET` 已备）——不默认补齐，待回填保持待回填。

## 证据指针（本轮未重跑 g2-blocks 源仓门禁的理由）

g2-blocks dy 门禁（11+6+10）与 wx 反扫属程序线管辖面，复跑轮已在本轮前置提交（`9c27438`）三样一致取证；美术面为其**子集消费方**（四要素归零登记 + 渲染留证文档 + 材料清单口径），本轮以只读方式核对其存在性与内容一致性（源仓分支 `git show` 原文 + 黑板证据件比对），不在源仓 worktree 重复跑门禁制造树污染。

—— 游戏美术 · 2026-10-11 · HEAD `d4eeea2` 复证有效（后续他线提交使本结论过期时须重证）
