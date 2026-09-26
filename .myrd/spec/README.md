# .myrd/spec/ — 策划案导出件索引（分游戏独立路径，2026-09-25 M2.1 起施行）

> 更新时间：2026-09-25（M2.1「有声可装」收口 · 主策划）
> 负责人：主策划（版本链唯一看护；任何内容修订必须走版本链 version+1，禁止覆盖旧版）
> 下一步：主人人工拍板（试玩 + 真机三项 + HTTPS 托管指认）

## 导出件一览（一游戏一文件，终结撞车史）

| 文件 | 游戏 | 版本/状态 | 契约测试调用 |
|---|---|---|---|
| `stack-tower-spec.json` | **Stack Tower 叠塔（`games/stack-tower/`）** | **v3 · approved**（platformSpecId `cmugok2uz000xm9ilx42t8pnl`；v2 `cmugal9ob0013gqlok6dstuyc` superseded；v1 `cmuga6tq90011gqlo3wkh9k7a` superseded） | `node games/stack-tower/tests/contract/run-all.mjs`（runner 自动读本文件） |
| `stack-tower-spec-v1.1-ready.yaml` | 同上（**登记就绪版，纸面终稿，未登记**） | v1.1 · ready（含 QA 三处缺陷修复 D1/D2/D3；任务书口径 v1.1 ≡ 平台链 v3 下一版，登记 = POST revisions version+1 单版落账，不产生 v1.2） | `python3 scripts/spec-v11-emit-yaml.py`（发射 + 5 项就绪校验）；复现链 `node games/stack-tower/tools/build-spec-v11-ready.mjs` → 同脚本发射 |
| `stack-tower-spec-v2.json` | 同上（历史档） | v2 approved（被 v3 取代前快照） | 只读审计 |
| `stack-tower-spec-v3-content.json` | 同上（建版载荷） | v3 内容稿（平台入库键序归一化后以平台版为准） | 只读审计 |
| `stack-tower-spec-v1.json` | 同上（历史档） | v1（T2 初稿） | 只读审计 |
| `design-spec-pixel-fives.json` | 像素街机足球 Pixel Fives（`pixel-fives/`） | v1.2 · approved | `node pixel-fives/tools/contract-check.mjs` |
| `design-spec-pixel-fives-v1.3-draft.json` | 同上（草案） | v1.3 draft（不作契约依据） | — |
| `design-spec.json` | ⚠️ **冻结现状：内容为 stack-tower v2（糖果线导出件被撞丢，git 不可回滚）** | 不可作为任何契约依据 | 糖果线 contract-check 在导出件归位前**不得作为验收依据** |

## 版本链红线（重申）

1. 每个游戏的 approved 版是唯一断言依据；禁止把一个游戏的 acceptance 拿去核另一个游戏。
2. 任何内容修订 → `POST /api/v1/game-design-specs/:id/revisions`（version+1）；旧版不覆盖。
3. approve 只有一个；draft 不作为契约测试依据。
4. 平台入库会把对象键做归一化排序 → 契约侧数值总闸一律**键序无关深比**（`stableStringify`）。

## stack-tower v3 要点（M2.1）

- 22 条 acceptance = 8 条 gameplay 冻结（ac-lvl01-e01~e08）+ 14 条 M2.1 增量（acc-a1~a5b/a6、acc-m1~m4、acc-d1~d2）。
- numeric 追加 audio/mobile/deploy 三组（与 `src/kernel/numeric.ts` 同步增，frozen 四组零改动）；world/levels 零改动。
- entities 追加 5 个：audio-manager / touch-input-layer / sfx-pack-v1 / pwa-shell / rotate-overlay。
- content 追加 sfxPack / mobile / pwa 三段 + towerRipple.restart 事件契约。

## stack-tower v1.1 登记就绪版（2026-09-26，纸面终稿，未登记）

- 产物链：`games/stack-tower/tools/build-spec-v11-ready.mjs`（冻结守卫 + 只增不改）→ `.myrd/spec/stack-tower-spec-v1.1-payload.json`（POST /revisions 载荷 `{spec, detail}`）→ `scripts/spec-v11-emit-yaml.py`（发射 + 5 项就绪校验）→ `.myrd/spec/stack-tower-spec-v1.1-ready.yaml`（全文终稿）。
- 折入内容（QA 三处缺陷修复，一次性）：**D1** `numeric_add` benchmark_device 组（实验室=playwright chromium + 4x CPU throttle + 390x844/360x640；真机单列注明设备型号 + UA，content.benchmark）；**D2** `acceptance_add` acc-a7「冷启动首触即放置」（`tests/audio/events.test.ts`）+ world 实现约束「首触手势内完成 AudioContext 解锁与播放，闸门不得吞掉或延后首次出声（仍受 50ms 约束）」，不设 iOS 豁免条款；**D3** content.evidence 全局证据条款「每条冒烟留文件名+日期+命令+输出摘要」+ BGM 接缝双轨证据（听测留档 + `tests/audio/bgm-loop.test.ts` 调度连续性断言并行，均不可省）。
- 冻结承诺实证：v1 冻结数值七键 v1/v3/v1.1 三方键序无关深比全等（diff 为空）；levels/entities/assets/既有 22 条 acceptance/world 既有规则逐字保留；基线门禁复跑 `run-all` PASS 22 / FAIL 0 / not-runnable 0（2026-09-26，基线导出件未动）。
- 登记前置：游戏 QA 纸面预审通过（仅核 D1/D2/D3 关闭 + 两锚点；该预审不构成 M2.1 核销）。登记动作 = `POST /api/v1/game-design-specs/cmugok2uz000xm9ilx42t8pnl/revisions`，body 取 payload 的 `{spec, detail}` 二键，version+1 单版落账。
- 挂账：① 平台项目面权限不可达（GET `game-design-specs?projectId=` → FORBIDDEN「您不是该项目的成员」，2026-09-26 实查）——环境恢复后按 payload 一键登记；② `tests/audio/events.test.ts` / `tests/audio/bgm-loop.test.ts` 落盘属 D4（主人答复 D5 前冻结），落账前由契约 not-runnable 通道显式挂起；③ 登记 + D4 落盘时需同步 `src/kernel/numeric.ts` 镜像 benchmark_device 组（契约 e07 数值总闸对 spec.numeric 全量深比）。
