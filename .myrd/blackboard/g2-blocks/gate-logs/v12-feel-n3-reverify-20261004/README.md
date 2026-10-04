# V1.2 视觉打磨包 · N3 收口后美术线独立复验（复验不新做）· 2026-10-04

> 执行：游戏美术（线1）· 对象 = 源仓 `g2-blocks` @ `01c2f06`（树净，`git status --porcelain` = 0 行）
> 性质：**复验而非重做**——F-01..F-07 资产面零新增零改动，本轮只独立实跑门禁证明「绿」可由美术线按文档口径重现。
> 判据零变化：全部命令取自已归档各档 README/log 的原文口径（palette / 契约双态 / 八门禁 / ART-RECHECK / 生成器确定性）。
> 结论：**六项全绿 EXIT=0 · ART-RECHECK 12/12 · 资产面零 delta 成立**。

## 证据一行式（口径 = `../evidence-one-line-template.md`）

```
[PASS] | 线1 美术 | 01-palette-gate.log | 2026-10-04 | cd $G2 && npm run gate:palette | ALL-GREEN 0红/21对 minΔE=26.555 阈值=25 margin=+1.555 selftest=18/18 | g2-blocks 仓库根 @ 01c2f06
[PASS] | 线1 美术 | 02-contract-mode-a.log | 2026-10-04 | cd $G2 && node scripts/contract-check.mjs | 18 PASS / 0 FAIL · CONTRACT PASS · EXIT=0 | g2-blocks 仓库根 @ 01c2f06
[PASS] | 线1 美术 | 03-contract-mode-b.log | 2026-10-04 | cd $G2 && G2_SPEC_PATH=<run-ws>/.myrd/spec/g2-blocks/design-spec-v1.3-feel-draft.json node scripts/contract-check.mjs | 25 PASS / 0 FAIL（含美术面 ac-22..28 全 PASS）· EXIT=0 | g2-blocks 仓库根 @ 01c2f06
[PASS] | 线1 美术 | 04-gates-eight.log | 2026-10-04 | cd $G2 && G2_REPO_ONE_PATH=<run-ws> node tests/run-all.mjs | 门①–⑧ 全 PASS · EXIT=0（③ theme 单源 PASS，spec 锚 302e6336…） | g2-blocks 仓库根 @ 01c2f06
[PASS] | 线1 美术 | 06-art-recheck.log | 2026-10-04 | cd <本目录> && node 05-art-recheck.mjs | ART-RECHECK: PASS 12/12（美术四门禁 + A-09 认领 + A-13/A-14 文案红线）· EXIT=0 | 本证据目录（复跑器 05-art-recheck.mjs = A 轮 a4 档同件拷贝，判据零改动）
[PASS] | 线1 美术 | 07-asset-determinism.log | 2026-10-04 | cd $G2 && node tools/gen-release-assets.mjs && node tools/gen-theme.mjs && G2_SPEC_V13=<draft> node tools/gen-feel-pack.mjs && node tools/palette-design.mjs && git status --porcelain | 9 件资产 sha256/尺寸零变化 · palette 交付件 sha256=7bc2ca03…（≡链上锚）· 残留仅 manifest gitRef+generatedAt 两行（良性）· 树已复位 0 行 | g2-blocks 仓库根 @ 01c2f06
```

## 逐项结论

| # | 门 | 结果 | 关键数字 |
|---|---|---|---|
| 1 | 色板双门禁（门A） | PASS | ALL-GREEN 21 对 · minΔE=26.555（与冻结记录逐字一致） |
| 2 | 契约 Mode A（approved v1.1） | PASS | 18/18 · anchor=302e63367f3dea63… |
| 3 | 契约 Mode B（链 v4 draft） | PASS | 25/25 · anchor=1720df8ec6ac0d00… · **ac-22..28（F-01..F-07 契约面）全 PASS** |
| 4 | 八门禁 ①–⑧ | PASS | 全 PASS · EXIT=0 · 门③ theme 单源 7 键 ≡ 冻结色板 |
| 5 | ART-RECHECK（美术四门禁） | PASS | 12/12 · 门一.a 生成器零裸 hex/零 rgba 字面量 · 门二.a 9 件 IHDR+sha256 · 门三 maskable 越界 0 · 门四同批可证 |
| 6 | 资产确定性重跑 | PASS | 4 生成器重跑 → 9 件资产零字节变化 · palette sha256=7bc2ca03… ≡ `numeric.palette.sourceSha256` 锚 |

## 两处披露（非缺陷，登记制）

1. **门③ spec 解析跨 run 同内容命中**：门③装载的 approved 导出件落点解析到前轮 run 工作区
   （`run-cmuq9pz86…`），经 `shasum -a 256` 比对与本 run `design-spec.json` **逐字节全等**
   （`ad5d55344761dee4…`），锚 `302e6336…` 一致 → 属同内容命中，非规格漂移。与既有披露
   「env 钉值建议进门禁 README」同一挂账族（G-perf 旁，程序线下轮处理）。
2. **manifest 良性残留**：`assets/release/release-assets.json` 重跑后仅 `gitRef`（`cf57708`→`01c2f06`）
   与 `generatedAt` 两行变动，9 件资产条目（sha256/尺寸）零变化 → 资产像素零改动成立；
   已 `git checkout` 复位，源仓维持树净 `01c2f06`。

## 红线核销（本复验范围）

- stack-tower 零接触 ✅（本轮零触碰其任何路径；改动面仅 `.myrd/blackboard/g2-blocks/`）
- numeric/spec 零改动 ✅（只读装载，零写入；spec 文件 sha256 未变）
- 玩法代码零改动 ✅（源仓树净维持 `01c2f06`；唯一落盘 = 本证据目录 + 黑板登记）
