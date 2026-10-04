# V1.2 核心手感轮 · N4 复跑复检（提交前独立实跑）· 2026-10-04

> 执行：游戏程序（提交前置自检，非 QA 代位）· 源仓 `g2-blocks` @ `eab0df0`（核验时点树净）
> 结论：**契约双态 18/18 + 25/25 · 八门禁 ①–⑧ 全 PASS · SMOKE PASS（J1=174.9ms）· 基准 P95=16.7ms（与基线全等）· N4 复检 15/15 APPROVE-READY**
> 附带产出：复检器 1 处环境敏感缺陷（加固前可复现假红）已修复，判据零变化。

## 与上一份 N4 档（`v12-feel-n4-20261004/`）的关系

不是打回、不是新一轮 N4：同一 commit `eab0df0` 的**提交前独立复跑**，目的 = 证明「全绿」可由第三方按文档口径重现。
全部原文在本目录，命令 + 退出码逐条在档。

## 归档清单

| 件 | 内容 | 结果 |
|---|---|---|
| `01-contract-mode-a.log` | 契约 Mode A（approved v1.1 · 默认装载）18 条 | 18/18 · EXIT=0 |
| `02-contract-mode-b.log` | 契约 Mode B（链 v4 draft · `G2_SPEC_PATH` 钉值）25 条（含 ac-22..28） | 25/25 · EXIT=0 |
| `03-gates-eight.log` | 八门禁 ①–⑧（`node tests/run-all.mjs`） | ①–⑧ 全 PASS · EXIT=0 |
| `04-smoke.log` | 冒烟（可开 + 核心循环可玩 + PWA + J1 实测） | SMOKE PASS · J1=174.9ms ≤ 400 |
| `05-recheck-style-a.log` | N4 复检 · 文档口径（只钉 `G2_REPO_ONE_ROOT`） | 15/15 · APPROVE-READY |
| `06-recheck-style-b-env-leak.log` | N4 复检 · 外层残留 `G2_SPEC_PATH=<draft>`（加固前必红） | 15/15 · APPROVE-READY（加固后） |
| `07-independent-checks.log` | 独立核验：锚 / numeric 零漂移 / 顺延零渗漏 / 冒烟判据面 / 一号仓 games/ | 全绿（见下） |
| `perf-p95-report.json` `.md` | T2 采样报告（本 run 重出） | 基准 fps=60 · jank=0 · **p95=16.7ms** |
| `.j1-evidence.json` | ac-10 机器证据（冒烟同批） | measuredMs=174.90000000596046 |

## `07-independent-checks.log` 五项判据

1. **numeric 冻结锚独立重算**（同口径 `sha256(sortKeys(numeric))`）：
   approved v1.1 = `302e63367f3dea63…`（MATCH）· 链 v4 draft = `1720df8ec6ac0d00…`（MATCH）
2. **既有 12 组 numeric 逐字节对比**：approved ↔ 链 v4 零 diff；新增组恰 = `feel` + `daily`（12 → 14 组）
3. **顺延项零渗漏**：`src/` 对 `levelStars|comboMultiplier|firstMinute` 命中 = 0；
   spec 面全文本含 `star` 的 7 处经逐一定位均为 `restart` / `j1_settle_start` 子串误匹配，真实渗漏 = 0
4. **冒烟判据面零变化**：`git diff fe5fd38..HEAD -- tools/smoke.mjs` = 0 行
5. **一号仓本轮区间（`1420510..HEAD`）`games/` 触碰 = 0 文件**（stack-tower 线上零接触成立）

## 事故记录（复检器假红 → 加固）

- **现象**：复跑者按 Mode B 验证习惯在外层设 `G2_SPEC_PATH=<draft>` 后跑 `tools/qa-v12-feel.mjs`，
  R2.a 报 `FAIL`（`合计=25 PASS`，期望 18 条）→ VERDICT: RED。
- **根因**：`sh()` 以 `{...process.env, ...env}` 继承父环境；R2.a 的 Mode A 子调用未显式钉 spec，
  外层 `G2_SPEC_PATH` 泄漏进子进程 → 装载链 v4（25 条）而非 approved v1.1（18 条）。
  **属调用姿势触发的工具缺陷（假红），判据本身无误，非产物缺陷。**
- **修法**（`tools/qa-v12-feel.mjs` R2.a 调用点一处）：`{ G2_SPEC_PATH: APPROVED }` 显式钉 approved 导出件，
  与该检查名「approved v1.1 · 18 条」字面一致；判据零变化（与 R2「零断言拒绝装绿」同一加固纪律）。
- **验证**：姿势 A（文档口径）与姿势 B（环境残留）双跑均 15/15 APPROVE-READY（`05`/`06` 原文）。
- `tools/gen-feel-pack.mjs` 不受影响：它取数走独立的 `G2_SPEC_V13`，不经 `G2_SPEC_PATH`。

## 证据值与健康度

- 基准跑 P95：本轮重出 = **16.7ms**（上一档 16.8ms；基线快照① = 16.7ms）→ 与 v1.1 基线全等，不退化成立。
- J1 实测 174.9ms，处历史族（172.3 / 174.6 / 177.3 / 179.1 / 182.6 / 183.8ms）内，预算 400ms。
- `build/sw.js` 本 run 重建产生的缓存版本号残留已归位（保持与归档双 manifest `buildSha256` 同批一致）。
