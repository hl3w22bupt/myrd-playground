# 美术复证轮 r5 — N13 后重锚（2026-10-12 · 游戏美术 · HEAD `5360846`）

> 触发：同轮任务书第五次下发。勘验：N13（`5360846`，受测游戏身份门禁收口——新建 **`games/wheat-squad/verify.sh`** 五步真门禁薄壳 + `.myrd/spec/wheat-squad-spec.json` slug 命名薄壳 + routines.yaml 陈旧 gamePath 纠正）为 r4（`a52af04` @ `32dc491`）后唯一新增提交，**零触及美术交付件**（风格卡 v1 / manifest / 提审模板 / theme.ts / spec 内容原样）。

## 本轮口径升级：门禁改走 verify.sh 全量

任务书执行要求「**有 games/*/verify.sh 则跑全量**，否则 node scripts/contract-check.mjs」——wheat 线自 N13 起具备该入口，故本轮美术门禁**升级为 verify.sh 全量实跑（含 WS-SMOKE，门禁口径默认不跳）**。此前 r1–r4 各轮「不重跑 WS-SMOKE（程序线运行面）」的诚实口径，自本轮起被新入口消解：美术侧直接实跑五步全量，不再依赖程序线结论转引。

## 复证结论（全绿，均 HEAD `5360846` 实跑）

| # | 项 | 结果 | 证据件 |
|---|---|---|---|
| ①–⑤ | **verify.sh 五步全量**（统一契约 / 自有契约 13 项含 ac-10..13 / **WS-SMOKE headless 全链路** / 守卫本仓 / 守卫父仓足迹） | **五步逐条 PASS · VERIFY-EXIT=0** | `00-verify-sh-full.log`（102 行原文） |
| ③a | 三方色值机判（复用 art-reverify-20261012 v1 脚本） | 8 色三方全等 · EXIT=0 | `03-palette-consistency.log` |
| ④ | 裸 hex 单源链扫描 | theme.ts 之外 0 命中 · PASS | `04-naked-hex-scan.log` |
| ⑤a | 资产零漂移（对照 20261012 基线 sha256） | manifest + 3 模板 4 件逐字节全等 · EXIT=0 | `05-asset-zero-drift.log` |
| ⑦ | **三薄壳入口可达性**（N11 spec 字面 / N12 契约镜像 / **N13 slug 命名**） | 三入口均达 approved spec，8 色 palette 全可读；root `tests/contract` 链直跑美术套件 13/0 · EXIT=0 | `07-thin-entry-reachability.log` + `07b-root-contract-link.log` |

## 跨线复核登记（cross-line-art-deliverable-review）

N13 四点经本线复核认领，零保留：① verify.sh 为「薄壳调度」——检查逻辑零复制全转发仓内单一实现，exit code 全透传 fail-closed，与本线「确定性生成链 + 门禁不吞错」纪律同构；② slug 命名薄壳（`<slug>-spec.json`）为符号链接零拷贝，approved spec 仍唯一真源（⑦ 实证三入口同源同果）；③ 陈旧 gamePath 纠正属配置对齐，零检测规则改动；④ 守卫两次 fail-closed 拦截均显式登记白名单后转绿，**零静默放行**。

## 诚实口径

- 本轮起 WS-SMOKE 已由美术侧 verify.sh 全量直接实跑（③ PASS），r1–r4 的「冒烟转引程序线」口径就此退役。
- A3 结论面维持 ⏳（0/5 真人回填，主人侧 W-2）；正式提审素材维持止步清单；g2-blocks 零触碰。
- 结论仅对 HEAD `5360846` 有效。

—— 游戏美术 · 2026-10-12 · 复证于 HEAD `5360846`（verify.sh 全量口径首轮）
