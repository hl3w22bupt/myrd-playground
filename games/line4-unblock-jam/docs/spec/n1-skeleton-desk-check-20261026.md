# N1 骨架核对件 — 锁定 spec 逐项落点 desk-check（line4-unblock-jam · 2026-10-26）

> 锁定版：链 v2 `cmvlrc0ma001tm94ialxeykjn` = **approved**（平台 GET 200 实测 2026-10-26 · 本地导出件 `.myrd/spec/line4-unblock-jam/design-spec.json` 7/7 段零漂移机判 MATCH，证据 `gate-logs/line4-n0-gate-20261026/`）。
> 结论先行：**spec 全部落点在位、编号无二义、零私建零私改 → 无需 spec revision**（编号不合理才走 revision，本轮核对未触发）。

## ① entities 8 → 落点文件（spec 写死路径 ↔ 实存）

| spec id | 落点文件（spec 原文） | 实存 | 本轮状态 |
|---|---|---|---|
| e-kernel-loop | `src/kernel/loop.ts` | ✅ | 前轮在位，零改动 |
| e-session（计数控名人） | `src/kernel/session.ts` | ✅ | 前轮在位，零改动；可玩面经 settleMove/settleExitFrame 结算通道消费（无第二写点） |
| e-car | `src/entities/car.ts` | ✅ | 前轮在位，零改动 |
| e-lot | `src/entities/lot.ts` | ✅ | 前轮在位，零改动 |
| e-exit | `src/entities/exit.ts` | ✅ | 前轮在位，零改动 |
| e-level-director | `src/levels/director.ts` | ✅ | 前轮在位，零改动 |
| e-combo | `src/kernel/combo.ts` | ✅ | 前轮在位，零改动 |
| e-telemetry-hub | `src/telemetry/telemetry.ts` | ✅ | 前轮在位，零改动 |

## ② levels 3 / elements 8 → 编号唯一性与行为落点

| level.id | 元素 | 行为落点（机判位置） |
|---|---|---|
| level-1（首挪·教学关） | level-1/el-g01-guide | `tests/contract/checks/g-01-first-60s-guide.mjs`（20 局 bot 达成率）+ `src/main.ts`（g-01 三步窗口消费）+ `src/web/render.ts`（引导层，判据挂 a04-guide-hand） |
| level-1 | level-1/el-warmup-density | `src/levels/director.ts` LAYOUTS（warmup 帖 · 谱系参数显式 PEND 不编数） |
| level-2（标准局+红轮首现） | level-2/el-standard-band | 同上（standard 帖） |
| level-2 | level-2/el-red-entry | `director.shouldEnterRedRound`（acc-04 断言 + `src/web/game.ts` 会话层透传） |
| level-2 | level-2/el-red-clear | `director.planRedRound` clear 分支（acc-04 断言 + `src/web/game.ts`/`smoke-playable.mjs` 机判） |
| level-2 | level-2/el-red-fail | 同上 fail 分支（超预算无豁免，2026-10-25 驳回勘误口径） |
| level-proc-gen（谱系关） | level-proc-gen/el-daily-seed | `src/main.ts` `dailySeed()`（DEFAULT_SEED ⊕ UTC 日期数，会话层注入，内核零时钟不破） |
| level-proc-gen | level-proc-gen/el-gen-band | `director.LAYOUTS` 谱系带（PEND-待校准显式不编数；首批真人数据回流后走 revision） |

- 元素编号唯一性：统一契约门禁机判「关卡元素编号唯一性核对完成（8 个）PASS」（`gate-logs/line4-n4-verify-20261026/01-contract-unified.log`）。
- `<level.id>/<element.id>` 编号格式与 spec 原文逐字一致，工程侧零私造第二套编号。

## ③ acceptance 9 → check 落点（引用 id↔文件存在性，统一门禁 9 条 PASS）

| acceptance id | mode | check 落点 | 存在性 |
|---|---|---|---|
| acc-01-seeded-determinism | auto | `tests/contract/checks/acc-01-seeded-determinism.mjs` | ✅ |
| g-01-first-60s-guide | auto | `tests/contract/checks/g-01-first-60s-guide.mjs` | ✅ |
| acc-02-exit-feedback-latency | auto | `tests/contract/checks/acc-02-exit-feedback-latency.mjs` | ✅ |
| acc-03-combo-pending-invariant | auto | `tests/contract/checks/acc-03-combo-pending-invariant.mjs` | ✅ |
| acc-04-red-round-boundaries | auto | `tests/contract/checks/acc-04-red-round-boundaries.mjs` | ✅ |
| acc-05-no-external-texture | auto | `tests/contract/checks/acc-05-no-external-texture.mjs` | ✅ |
| acc-06-perf-caps | auto | `tests/contract/checks/acc-06-perf-caps.mjs` | ✅ |
| acc-07-telemetry-key-parity | auto | `tests/contract/checks/acc-07-telemetry-key-parity.mjs` | ✅ |
| acc-a3-restart-willingness | manual | a3 记录卡回收（真人面，机器不代采 · 单列待采不计绿） | 人工 |

## ④ assets 6 → 落点文件（本轮量产，kebab-case 对 id）

| spec 资产 id | 落点 | 生成器 | 门禁 |
|---|---|---|---|
| a01-lot-tiles | `assets/a01-lot-tiles.png` | `tools/gen-assets.mjs` | `tools/check-assets.mjs` ①②③④⑤ 全过（31 断言） |
| a02-car-set | `assets/a02-car-set.png` | 同上 | 同上 |
| a03-exit-gate | `assets/a03-exit-gate.png` | 同上 | 同上 |
| a04-guide-hand | `assets/a04-guide-hand.png` | 同上 | 同上 |
| a05-ui-hud | `assets/a05-ui-hud.png` | 同上 | 同上 |
| a06-sfx-pack | `assets/a06-sfx-pack.spec.json`（+ `assets/audio/{drag,exit,clear}.wav` 派生件） | `tools/gen-assets.mjs`（同文件内 gen-audio 段） | 同上（派生件 hash 同锚） |

## ⑤ 本轮新增（非 spec 落点，公开披露）

web 可玩面与部署链路（spec meta.platform「web 可玩面待审查通过后建工程轮」的工程轮兑现，**零触碰 spec 落点文件**）：
`src/main.ts`（装配入口）· `src/web/{game,render,input,sfx}.ts`（表现层）· `index.html`（壳）·
`tools/{build,check-assets,smoke-playable}.mjs` · `tools/pnglib.mjs` · `ci/guard-landing-shell.mjs` ·
`verify.sh` 扩步 06–09 · `assets/`（六件量产产物）· `export/web/`（构建产物，部署面）。

—— 主策划（N1 拆解与核对）· 游戏程序（落点核对代行 · 限制性核签判例）· 2026-10-26
