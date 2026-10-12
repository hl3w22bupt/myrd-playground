# 美术复证轮 r7 — N15 后重锚（2026-10-12 · 游戏美术 · HEAD `ed3b99b`）

> 触发：同轮任务书第七次下发。勘验：N15（`ed3b99b`，驳回五到案处置——`.myrd/spec/design-spec.json` 由符号链接**升格为确定性派生 gate-adapter 视图**（新工具 `tools/build-gate-adapter.mjs` 从盘上 approved 单源派生，内容原样 + 仅注入顶层 `id`/`slug` 两键）+ 新增 ac-15 漂移守卫 + routines gamePath 对齐）为 r6（`ce987db` @ `729ef41`）后唯一新增提交。美术源件（风格卡 v1 / manifest / 提审模板 / theme.ts / approved spec 本体）零改动；`assets.md` mtime 经 git log 核实为本人 r6 提交，无跨线代改。

## 美术口径判定（先查绑定再定性）

gate-adapter 视图属**派生镜像非第二真源**（ac-15 机判：注入键外与纯导出件键序无关深等）——与本线「theme.ts 为 spec palette 的派生镜像 + manifest sha256 基线留证」完全同构，认领零保留。但按 hash-chain-cross-consistency 纪律（多处交叉核对一致，不与生成器自身输出互证），本轮 ⑦ 抽核**升级为亲核**：适配视图↔approved 单源 8 色 palette 逐值比对，不转信 ac-15。

## 复证结论（全绿，均 HEAD `ed3b99b` 实跑）

| # | 项 | 结果 | 证据件 |
|---|---|---|---|
| ①–⑤ | **verify.sh 五步全量**（r5 口径沿袭） | 五步逐条 PASS · 自有契约 **15/0**（ac-15 自动发现）· 统一门禁 53/0 · WS-SMOKE PASS · VERIFY-EXIT=0 | `00-verify-sh-full.log` |
| ③a | 三方色值机判（真源面：v1 卡 ↔ theme.ts ↔ approved spec） | 8 色三方全等 · EXIT=0 | `03-palette-consistency.log` |
| ④ | 裸 hex 单源链扫描 | theme.ts 之外 0 命中 · PASS | `04-naked-hex-scan.log` |
| ⑤a | 资产零漂移（对照 20261012 基线 sha256） | manifest + 3 模板 4 件逐字节全等 · EXIT=0 | `05-asset-zero-drift.log` |
| ⑦ | **三入口可达性 + 适配视图↔单源 palette 亲核（本轮升级）** | 形态实证 = 派生文件非符号链接；**单源/适配视图/slug 入口三面 8 色 palette 逐值全等**；adapter 注入 id/slug=wheat-squad 核实；root `tests/contract` 链直跑套件 15/0 · EXIT=0 | `07-thin-entry-reachability.log` + `07b-root-contract-link.log` |

## 跨线复核登记（cross-line-art-deliverable-review）

N15 四点经本线复核认领，零保留：① 适配视图为**零依赖确定性生成**（build-gate-adapter.mjs）+ ac-15 漂移守卫把「视图≡单源」锁进契约，与本线确定性生成链自证手段同一范式；② 注入仅 id/slug 两键、其余内容原样——美术色源面零分叉（⑦ 亲核为证）；③ 冻结线 2 个存量 verify.sh 零触碰；④ 平台门禁 id 读取实现不在仓，W-6 预设如实披露——若平台仅读 `_platform.id` 则属平台侧缺陷，与本线无关但留诊口。

## 诚实口径

A3 结论面维持 ⏳（0/5 真人回填，主人侧 W-2）；正式提审素材维持止步清单；g2-blocks 零触碰；W-5（冻结计数器措辞）归策划。结论仅对 HEAD `ed3b99b` 有效。

—— 游戏美术 · 2026-10-12 · 复证于 HEAD `ed3b99b`
