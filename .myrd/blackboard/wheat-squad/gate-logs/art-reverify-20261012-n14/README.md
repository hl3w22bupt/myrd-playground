# 美术复证轮 r6 — N14 后重锚（2026-10-12 · 游戏美术 · HEAD `729ef41`）

> 触发：同轮任务书第六次下发。勘验：N14（`729ef41`，QA 对抗审查 D1/D2 修复——埋点载荷键 `durationMs`→`run_duration_ms` 三方同名真达成 + `endedReason` 枚举按 approved spec 对齐 + 新增 ac-14 剥注释机判）为 r5（`888decc` @ `5360846`）后唯一新增提交。**性质变化：本为他线首次触及代码面**（N10–N13 均配置/文档），故本轮复证加权——verify.sh 全量照跑 + 美术呈现面漂移专项重点复扫。

## 美术面相关性判定（先查绑定再定性）

`git show 729ef41 --stat` 经 render/theme/manifest/assets/style 过滤 **零命中**——N14 改动面 = `game.ts`（埋点键名）/ `sim.ts`（结局枚举与波次）/ `settlement.ts`（枚举）/ 新增 `tests/contract/ac-14`，全部属玩法/遥测面，**美术呈现面（theme.ts 单源、renderer、manifest、提审模板、风格卡）零触碰**；spec 零改动（仍 v3 approved @ 12:03）。

## 复证结论（全绿，均 HEAD `729ef41` 实跑）

| # | 项 | 结果 | 证据件 |
|---|---|---|---|
| ①–⑤ | **verify.sh 五步全量**（r5 口径沿袭） | 五步逐条 PASS · 自有契约 **14/0**（ac-14 自动发现）· 统一门禁 53/0 · **WS-SMOKE PASS（埋点键名变更后 A1/A4 断言面仍全绿）** · VERIFY-EXIT=0 | `00-verify-sh-full.log` |
| ③a | 三方色值机判（复用 art-reverify-20261012 v1 脚本） | 8 色三方全等 · EXIT=0 | `03-palette-consistency.log` |
| ④ | 裸 hex 单源链扫描（**N14 触码后重点复扫**） | theme.ts 之外 0 命中——埋点/枚举改动未引入任何清单外色值 · PASS | `04-naked-hex-scan.log` |
| ⑤a | 资产零漂移（对照 20261012 基线 sha256） | manifest + 3 模板 4 件逐字节全等 · EXIT=0 | `05-asset-zero-drift.log` |
| ⑦ | 三薄壳入口可达性 | 两 spec 入口 8 色 palette 全可读；root `tests/contract` 链直跑套件 **14 PASS / 0 FAIL** · EXIT=0 | `07-thin-entry-reachability.log` + `07b-root-contract-link.log` |

## 跨线复核登记（cross-line-art-deliverable-review）

N14 三点经本线复核认领，零保留：① 埋点定名 `run_duration_ms` 为「策划定名→程序接线→冒烟断言三方同名」的**真达成修复**（剥注释机判 + 弃自算直读真实发射载荷）——QA 对抗审查有效的又一实证，本线 AC-A4 人判面引用的机器输出自此更可信；② `endedReason` 枚举按 approved spec 单源对齐（spec 零改动消解 revision 需求）——与本线「色值唯一真源=spec numeric.palette」同一哲学；③ 新增 ac-14 属断言面加法（检测规则零缩水），本线四条款 ac-10..13 零触碰。

## 诚实口径

- 本轮代码面已变，故 N13 前各轮「代码面零漂移」论证**失效**，一切结论以本轮 verify.sh 全量实跑为准（已跑，五步全 PASS）。
- A3 结论面维持 ⏳（0/5 真人回填，主人侧 W-2）；正式提审素材维持止步清单；g2-blocks 零触碰；D3/W-5（冻结计数器措辞）归策划单行 revision，非美术面。
- 结论仅对 HEAD `729ef41` 有效。

—— 游戏美术 · 2026-10-12 · 复证于 HEAD `729ef41`
