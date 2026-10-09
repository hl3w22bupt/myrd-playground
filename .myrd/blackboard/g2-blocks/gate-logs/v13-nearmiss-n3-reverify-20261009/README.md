# V1.3 首批 near-miss + 结算页 IA · N3 收口后美术线独立复证（复证不新做）· 2026-10-09

> 执行：游戏美术（线1）· 对象 = `g2-blocks-v13` 工作树（分支 `feat/v1.3-nearmiss-settlement` @ `2738599`，树净，`git status --porcelain` = 0 行）
> 性质：**复证而非重做**——G-01..G-05 资产面零新增零改动（源仓维持 N5 收尾归位态），本轮只独立实跑门禁证明「绿」可由美术线按文档口径重现，并补齐黑板 v13 证据链的 N3 美术线独立目录（前轮 n1/n2/n4/n5 各有其录、n3 缺录）。
> 判据零变化：全部命令取自已归档 v13-nearmiss-n2 / prog-recheck 各档 README/log 的原文口径；复证器 `03-art-recheck-v13.mjs` 为本轮新增美术自检件（落本目录，不进源仓，判据全部消费源仓单源 import，零手抄第二份）。
> 结论：**三门禁全绿 EXIT=0 · ART-RECHECK-V13 27/27 · 六张实机截图美术目检 PASS · 资产面零 delta 成立（复证后 v13 树仍净）**。

## 证据一行式（口径 = `../evidence-one-line-template.md`）

```
[PASS] | 线1 美术 | 01-check-v13-three-state.log | 2026-10-09 | cd $V13 && node scripts/check-v13.mjs | 三态 18 / 25 / 29+1PEND 计数全符 · CHECK-V13 PASS · EXIT=0（含美术面 ac-31 H 节 / ac-32 派生式 / ac-33 零 diff） | g2-blocks-v13 工作树 @ 2738599
[PASS] | 线1 美术 | 02-gates-eight.log | 2026-10-09 | cd $V13 && G2_SPEC_PATH=<run-ws>/.myrd/spec/g2-blocks/design-spec.json npm run gate | 门①–⑧ 全 PASS 74 PASS / 0 RED · EXIT=0 · 门② 色板 ALL-GREEN 0红/21对 minΔE=26.555 margin=+1.555 selftest=18/18（≡冻结记录） | g2-blocks-v13 工作树 @ 2738599
[PASS] | 线1 美术 | 03-art-recheck-v13.log | 2026-10-09 | node 03-art-recheck-v13.mjs $V13 | ART-RECHECK-V13: PASS 27/27（a08 视听包 6 + a09 结算包 6 + 运行时单源现算 4 + a10 六截图 5 + 生成器纪律 3 + 渲染面硬约束 3）· EXIT=0 | 本证据目录（复证器落本目录不进源仓）
[PASS] | 线1 美术 | （目检 · 六张实机截图） | 2026-10-09 | 美术眼检 assets/release/v13-shots/*.png ×6 | 三态语义正确（nm-hit 边行冷带+冷横幅不抢戏 / settle-nm 三层 IA / settle-nomoves 归因换文）· 两机型档（390×844 / 430×932）同构自适应 · 无构图缺陷 / 无辅助线混入 / 色值全在冻结族（暖=block-02 余烬金主按钮 · 冷=NEARMISS_UI.edge 派生玫瑰灰） | g2-blocks-v13 工作树 @ 2738599
```

## 逐项结论

| # | 门 | 结果 | 关键数字 |
|---|---|---|---|
| 1 | 三态契约 check-v13 | PASS | Mode A 18/0/0 · Mode B 25/0/0 · Mode C 29/0/1PEND（显式挂起）· EXIT=0 |
| 2 | 八门禁 ①–⑧ | PASS | 74 PASS / 0 RED · EXIT=0 · SCOPE-GUARD 168 文件零越界 · 色板 ALL-GREEN 21 对 minΔE=26.555 |
| 3 | ART-RECHECK-V13（美术复证器） | PASS | 27/27 · 见下分组明细 |
| 4 | 六张实机截图目检 | PASS | 三态×两档全对 · 批内零漂移 · buildSha256=00417238… 同批 |

### ART-RECHECK-V13 分组明细（27 断言）

- **a08 near-miss 视听包（6）**：下行尾音 880→440Hz ✓ / 时长减半 160→80ms ✓ / 变参规则 descending·0.5·tier2 ✓ / 零粒子·不震屏·不常亮三声明在包 ✓ / edge 派生复算（`theme.desaturate('#E3B5BF',0.3)` 现算）= `#dcbcb5` ≡ pack ✓
- **a09 结算页槽位包（6）**：六槽 ✓ / 稳定 id `result-slot-{score,chain,moves,attribution,action-restart,action-daily}` 全枚举 ✓ / 三层四段 P0–P3 ✓ / 触达 ≥48px ✓ / 分享卡模板 share-card-v13 ✓ / 文案枚举 6+6 ✓
- **运行时单源现算（4）**：`theme.NEARMISS_UI.edge = #dcbcb5` ✓ / `nearMissSfxSpec()` 现算 880→440Hz·80ms ✓ / 波形·包络·增益·失谐承第二档原值 square·step-up·1.15·35 ✓ / 弱反馈频控 每行1次+全局≤3 ✓
- **a10 六张实机截图（5）**：清单 6 张 ✓ / buildSha256 64hex ✓ / 三态×两档矩阵 + `shot-v13-<态>-<档>.png` 命名挂稳定 id ✓ / IHDR @2x 尺寸 780×1688 / 860×1864 全符 ✓ / 六张字节量 ≡ shot-manifest 逐张相等 ✓
- **生成器纪律（3）**：`gen-nearmiss-pack.mjs` / `gen-settlement-pack.mjs` 零裸 hex、零 rgba 字面量 ✓×2 / 两生成器确定性重跑逐字节一致（漂移 0 件，复证后 v13 树仍净）✓
- **渲染面硬约束（3）**：`drawNearMiss` 驻留窗外零绘制（transient-not-latched 实现面）✓ / 函数体零 particles 写入、零 shake 写入 ✓ / 边行色源 = `NEARMISS_UI.edge` 单源 ✓

## 披露（两处，均非源仓缺陷，登记制）

1. **门2 首跑作废**：取证操作失误——`G2_SPEC_PATH` 误钉 worktree 内路径（`$V13/.myrd/spec/...` 不存在，ENOENT）致 ③④⑤⑥ 假红；用 run 工作区绝对路径重跑即全绿（本目录 `02-gates-eight.log` 为重跑有效件）。判据零变化。
2. **门3 首跑 A08/f 误报**：复证器首版自带亮度混合式 desaturate 近似公式（`#d8b8bf`），与 theme.ts 真源 HSL 降饱和实现不同——同跑 C/a 已证 theme 单源现值 `#dcbcb5` ≡ pack，**派生关系本身无缺陷，错在复证器判据实现**；修正为 import `theme.desaturate` 单源现算后 27/27。首跑原文留档 `04-first-run-correction.log`（零手抄第二份纪律的自查样本）。

## 红线核销

- stack-tower 零接触 ✓ / spec 与 numeric 冻结面零写入 ✓ / 玩法逻辑与数值零改动（源仓 @ `2738599` 复证前后树净）✓
- 本轮产出仅：本证据目录（3 log + 复证器 1 件 + 本 README）+ 黑板 `assets.md` N3 复证台账登记，全部落 run 工作区黑板，不进源仓。
