# 美术复证轮 r4 — N12 后重锚（2026-10-12 · 游戏美术 · HEAD `32dc491`）

> 触发：同轮任务书第四次下发。勘验：N12（`32dc491`，root `tests/contract` 薄壳链接 → wheat 契约镜像，thin-proxy 第二件；W-4 仓内闭环降为知情项）为 r3（`4bea7cf` @ `9035207`）后唯一新增提交，**零触及美术交付件**（style-card-v1 / manifest / 提审模板 / src / spec 内容原样，sha256 比对为证）；其再改 `ci/scope-policy.json`（门禁 ⑥ 输入）并新增契约薄壳入口 → 重证后登记。本轮零新做项，轻量闭环。

## 复证结论（九项全绿，均 HEAD `32dc491` 实跑）

| # | 项 | 结果 | 证据件 |
|---|---|---|---|
| ① | 自有契约套件（正典路径，13 项含 ac-10..13） | 13 PASS / 0 FAIL · EXIT=0 | `01-contract.log` |
| ② | 统一契约门禁（仓根口径） | CONTRACT: PASS · EXIT=0 | `02-unified-contract.log` |
| ③ | 三方色值机判（复用 art-reverify-20261012 v1 脚本） | 8 色三方全等 · EXIT=0 | `03-palette-consistency.log` |
| ④ | 裸 hex 单源链扫描 | theme.ts 之外 0 命中 · PASS | `04-naked-hex-scan.log` |
| ⑤ | 资产零漂移（对照 20261012 基线 sha256） | manifest + 3 模板 4 件逐字节全等 · EXIT=0 | `05-asset-zero-drift.log` |
| ⑥ | scope-guard 双模式（N12 改策略后重点重证） | 双模式 EXIT=0，无回归 | `06-scope-guard.log` |
| ⑦a | spec 薄壳入口可达性（N11 面） | 旧 specPath 可达 approved spec，8 色 palette 全可读 | `07-thin-entry-reachability.log` |
| ⑦b | **契约薄壳入口可达性（N12 新增面）** | 经 root `tests/contract` 符号链接直跑美术契约套件 **13 PASS / 0 FAIL · EXIT=0**——美术四条款在新入口下可执行性直接实证 | `07b-root-contract-link.log` |

## 跨线复核登记（cross-line-art-deliverable-review）

N12 三点经本线复核认领，零保留：① root `tests/contract` 为相对符号链接 **realpath 去重零拷贝**，wheat 契约镜像仍唯一真源（⑦b 实证两入口跑同一套件同结果）；② 弱面超集（糖果线遗留 .gd 经 c3 命中冻结件）经插桩实证**不构成假绿**，与美术断言面无交集；③ 守卫拦截面走显式 `exemptTouchPrefixes` 豁免声明而非静默放行——与美术「先机器检查后目检」的留痕纪律同构。W-4 闭环使「任意历史参数组合均可达 wheat 单源全绿」，本线 artCaps 锚点在所有调用口径下保持 spec 单源。

## 诚实口径（沿 r1–r3 不变）

不重跑 WS-SMOKE（程序线运行面；N12 提交前置已带 WS-SMOKE PASS，且零触及 games/wheat-squad 代码面）；A3 结论面维持 ⏳（0/5 真人回填，主人侧 W-2）；正式提审素材维持止步清单；g2-blocks 零触碰。结论仅对 HEAD `32dc491` 有效。

—— 游戏美术 · 2026-10-12 · 复证于 HEAD `32dc491`
