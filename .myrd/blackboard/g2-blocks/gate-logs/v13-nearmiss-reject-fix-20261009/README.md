# V1.3 首批 · QA 驳回修复轮（2026-10-09 · 游戏程序 · 修补③打回全闭）

> 驳回主缺陷：PB=0 边界行为违反链 v8 `e-personal-best.zeroBoundary`（spec：PB=0 → `nm-copy-personal-best-edge`；
> 实现 `settlement.ts` attributionCopy 的 PB<=0 分支误返回通用行 `attributionNone`，首局玩家永远看不到 edge 文案；
> ac-32 契约 55–56 行反向固化偏差；playtest §一.5 记录失实称「符合设计意图」）。
> 修复策略：**spec 是 SSOT**——按驳回指令改实现对齐 spec 文本，不走 v9 修订（主策意图以 spec 链面为准，approve 归主人）。
> 源仓修复 commit：`feat/v1.3-nearmiss-settlement` @ **`ded8e8f`**（16 文件 · 基点 `2738599` · 提审面命中 0）。

## 修复清单（驳回指令逐项）

| # | 驳回点 | 修法 | 落点 |
|---|---|---|---|
| 1 | 主缺陷：PB<=0 分支返回通用行 | 改返回 `NEARMISS_TEXT['nm-copy-personal-best-edge']`（『继续热身，稳住节奏』）；低分边界（score<PB×0.5）同 | `src/render/settlement.ts` attributionCopy |
| 2 | 连带面：rule=null 归因槽 null 整行隐藏 | 分支器补全：常规差值兜底自算（best=PB · gap=PB−score，与 caller bestGap 同式单源）+ record（score≥PB>0）→ 通用归因行；rule=null 且给足 PB/score（视图路径恒给足）**必出归因行** | 同上 |
| 3 | 契约反向固化（55–56 行） | C 节改写为**归因分支矩阵**：PB=0→edge · 低分→edge · gap 兜底 · record→通用行 · survive-to-cool 可见性断言（先红后绿） | `tests/contract/ac-32-settlement-ia.spec.mjs` |
| 4 | 记录失实（playtest §一.5） | 原句划除 + 更正注（如实记载误判与修复证据指针） | `docs/playtest-subjective-round1.md` |
| 5 | 附注①类型债 | `SettlementInputs.rule` 补 `'P3'` | `src/render/settlement.ts` |
| 6 | 附注②纪律瑕疵 | `__G2_NM_FORCE` 时序 `600/2400` 手抄改读 `numeric.nearMiss.weakFeedback.pulseMs/bannerHoldMs`（零玩法路径） | `src/main.ts` |
| 7 | 附注③映射说明 | shot-manifest 增 `stateMapping`（a10 三态枚举 ↔ state id ↔ 归因文案留证口径）+ `determinismNote`（nm-hit 脉冲相位抖动面如实披露） | `tools/shot-v13.mjs` → v13-shots/shot-manifest.json |
| 8 | a10 截图连带 | settle-nomoves 构造真值化：先手得分（seeded 确定性）→ 死局冷却 → 炉冷记账 `updatePersonalBest` 先于 `buildSettlement` → PB=score 走 **record 路径** → 『无可消除』留证语义保真（PB=0 态归因行=edge，由契约机判，不再混淆） | `tools/shot-v13.mjs` + 六张重摄 |

## 先红后绿证据（本目录）

| 件 | 内容 | 结论 |
|---|---|---|
| `01-ac32-red-prefix.log` | 修复前实现 × 新契约（--only ac-32，Mode C spec 钉链 v8 draft） | **RED**（`best=0 边界：必须 edge 降级文案` · EXIT=1） |
| `02-check-v13-green.log` | 修复后全量三态 `node scripts/check-v13.mjs` | **PASS 18 / 25 / 29+1PEND** · EXIT=0 |
| `03-smoke-green.log` | 修复后冒烟 `node tools/smoke.mjs` | **SMOKE PASS** · J1=183.2ms ≤ 400ms · 结算三区块 ✓ · near-miss 构造面 ✓ |
| `04-shot-v13-reshoot.log` | 六张重摄 + 逐张 sha256 前后对比 | settle-nm 两张**逐字节全等**（未涉态零漂移）· settle-nomoves 两张新（分数槽 0→160 · 归因行保『无可消除』）· nm-hit 两张见抖动披露 |
| `05-shot-v13-final.log` | 终摄（带 stateMapping/determinismNote）+ 终批哈希快照 `shots-final.sha256` | **SHOT-V13 PASS** · 新批 `e3481537db9b…` |
| `06-perf-pair.log` | P95 同机双跑对（基线 `/tmp` worktree @`6d3db6a` vs 修复后 HEAD） | 基准 P95 **27.135ms → 27.1ms 零退化** |
| `07-gate-eight.log` | 八门禁 `npm run gate` | **①–⑧ 全 PASS**（20/20 工程前置面） |

## 证据链连带刷新（同批判据维护）

- **a10 六张重摄**：新批 `e3481537db9b…`（settle-nm 与原档逐字节全等 = 未涉态交叉验证；nm-hit 实测三 run 三值 = 脉冲动画相位抖动，manifest `determinismNote` 如实披露，同批判据 = buildSha256 非跨 run 字节稳定）。
- **内测包重出**：`games/g2-blocks/export/web-v13-beta/` 30 件随新 build 逐件 sha256 全等（`SUBMISSION-STATUS-v13.md` §三/§三.1 刷新，前批 `00417238…` 原档留 N5 目录不删）。
- **随复跑刷新件**：`docs/evidence/perf-p95-report.*`（HEAD 侧 27.1ms）· `tests/contract/.j1-evidence.json`（J1=183.2ms）——沿「复检证据随复跑刷新」判例。
- **红线复核**：`git diff 6d3db6a..ded8e8f` 路径面 platform/export/wx/dy **命中 0**；四门槛数值零触碰；全文无「DoD 已达标」措辞。
