# 美术复证轮 r3 — N11 后重锚（2026-10-12 · 游戏美术 · HEAD `9035207`）

> 触发：同轮任务书第三次下发。勘验：N11（`9035207`，字面 specPath 薄壳入口——相对符号链接 → approved 单源）为 r2（`69f2016` @ `9974553`）后唯一新增提交，**零触及美术交付件**（style-card-v1 / manifest / 提审模板 / src / spec 内容均原样，sha256 比对为证）；但其再改 `ci/scope-policy.json`（门禁 ⑥ 策略输入）并新增 `.myrd/spec/design-spec.json` 薄壳入口 → 重证后登记。本轮零新做项，轻量闭环。

## 复证结论（八项全绿，均 HEAD `9035207` 实跑）

| # | 项 | 结果 | 证据件 |
|---|---|---|---|
| ① | 自有契约套件（13 项含 ac-10..13） | 13 PASS / 0 FAIL · EXIT=0 | `01-contract.log` |
| ② | 统一契约门禁（仓根口径） | CONTRACT: PASS · EXIT=0 | `02-unified-contract.log` |
| ③ | 三方色值机判（复用 art-reverify-20261012 v1 脚本） | 8 色三方全等 · EXIT=0 | `03-palette-consistency.log` |
| ④ | 裸 hex 单源链扫描 | theme.ts 之外 0 命中 · PASS | `04-naked-hex-scan.log` |
| ⑤ | 资产零漂移（对照 20261012 基线 sha256） | manifest + 3 模板 4 件逐字节全等 · EXIT=0 | `05-asset-zero-drift.log` |
| ⑥ | scope-guard 双模式（N11 改策略后重点重证） | 双模式 EXIT=0 · 零越界，无回归 | `06-scope-guard.log` |
| ⑦ | **薄壳入口可达性（N11 新增面抽核）** | 旧字面 specPath 经符号链接可达 approved spec，8 色 palette token 全可读——**美术色源单链对任意调用方不断** · EXIT=0 | `07-thin-entry-reachability.log` |

## 跨线复核登记（cross-line-art-deliverable-review）

N11 两点经本线复核认领，零保留：① 薄壳入口为相对符号链接**零拷贝零漂移**，approved spec 仍唯一真源——与美术 token-single-source-chain 纪律同构；② N11 如实披露「projectDir=. 丢契约镜像层致 artCaps/firstCore 如实 FAIL」并登记 W-4 平台参数存量升级项，**不造 src 数值副本迁就错误调用方**——本线 artCaps 锚点维持 spec 单源，正确处置。

## 诚实口径（沿 r1/r2 不变）

不重跑 WS-SMOKE（程序线运行面；N11 零触及 games/wheat-squad 代码面）；A3 结论面维持 ⏳（0/5 真人回填，主人侧 W-2）；正式提审素材维持止步清单；g2-blocks 零触碰。结论仅对 HEAD `9035207` 有效。

—— 游戏美术 · 2026-10-12 · 复证于 HEAD `9035207`
