# N1 修复轮 · 程序线（线3）契约收口证据 — 2026-10-01

- 负责人：游戏程序（线3 · N3 前置工单）
- 结论：**六件门禁全绿（骨架态，theme 显式 PENDING-APPROVE 非装绿）+ 三路反向探针实测会红**
- g2 仓库 commit：`05a644e`（此前链：d401cab → 19abac4 → 1a47805 → ff7d34c）
- 一号仓库：零接触保持（`09-repo-one-zero-touch.log` 仅开工前已存在的平台预置 SKILLS.md M 态）

## 0. 本轮发现并修复的缺陷（与 spec 不一致项）

- **缺陷**：spec `acceptance.ac-14` 的 check 声明落点 `g2-blocks/tests/kernel-purity.spec.mjs` **缺位**，
  断言寄生在 `tests/framework.spec.mjs`（声明路径与实际文件不一致）。
- **证据（修复前）**：`08-acceptance-checkmap-audit.log` 中该条为 `MISSING`（ac-11/12/17/18 之外唯一
  非冻结面缺位项；其余 13 条缺位属冻结值玩法面，approve 前红线禁写，见 `06-acmap-pass.log` 白名单）。
- **修复**：新建声明落点并扩为 8 条子断言（R2 后，含 ac-14/h 零硬编码自证）；framework.spec 职责让渡；
  rng.ts 尾注同步；run-all 扩六件门禁；CI 增两步。g2 仓库 commit `05a644e`（首轮收口）+ `edc414f`（R2 驳回①②修复）。
- **防复发**：新增契约守卫 `tests/acceptance-map.spec.mjs` 机判「18 条声明落点必须存在或显式在冻结
  白名单」，并反向断言白名单无过期/幽灵条目（防白名单变永久豁免）。

## 1. 证据清单（四要素：文件名 + 日期 + 命令 + 输出摘要）

| # | 文件名 | 日期 | 命令（g2-blocks 仓库根执行） | 输出摘要 |
|---|---|---|---|---|
| 01 | `01-run-all-six-gates.log` | 2026-10-01 | `node tests/run-all.mjs` | 六件门禁台账：①守卫 ②色板 ③theme(PENDING-APPROVE) ④零冻结值面 ⑤ac-14 ⑥acmap 全 PASS；退出码 0 |
| 02 | `02-guard-pass.log` | 2026-10-01 | `node ci/guard-repo-scope.mjs` | `SCOPE-GUARD PASS 本仓库 N 文件零越界引用` |
| 03 | `03-guard-reverse-red.log` | 2026-10-01 | 临时写入越界引用文件后 `node ci/guard-repo-scope.mjs`（探针后即删） | `SCOPE-GUARD RED`，退出码 1 → 守卫真会咬 |
| 04 | `04-acmap-reverse-red.log` | 2026-10-01 | 临时移走 `tests/kernel-purity.spec.mjs` 后 `node tests/acceptance-map.spec.mjs`（探针后复位） | `RED acmap/c`，报文精确指向 ac-14 声明落点缺位；退出码 1 |
| 05 | `05-kernel-purity.log` | 2026-10-01 | `node tests/kernel-purity.spec.mjs` | **8/8 PASS**（纯净巡检/同 seed 逐字节一致/默认 seed≡spec 真源/异 seed 必异/纯函数隔离/uniformInt 值域边界/rng 值域类型/**ac-14/h 本件零冻结 seed 字面量自证**） |
| 06 | `06-acmap-pass.log` | 2026-10-01 | `node tests/acceptance-map.spec.mjs` | 5/5 PASS；18 条声明落点：5 存在 + 13 冻结面显式 PENDING-APPROVE，0 漂移 |
| 07 | `07-repo-one-contract-check.log` | 2026-10-01 | `node scripts/contract-check.mjs`（一号仓库根，只读） | `RESULT: PASS（spec ↔ 工程一致）`；B 段 39/40 实跑 PASS（not-runnable 1 单列不计绿） |
| 08 | `08-acceptance-checkmap-audit.log` | 2026-10-01 | `node /tmp/g2-audit-checkmap.mjs`（18 条声明落点逐条比对文件系统） | 修复后 EXISTS=5（ac-11/12/17/18 + ac-14），冻结面 MISSING=13（显式待批） |
| 09 | `09-repo-one-zero-touch.log` | 2026-10-01 | `git status --porcelain` + `git diff --stat <工程路径集>`（一号仓库根，结构化采集：记录采集时点 HEAD） | **行数以日志实况为准（本件不再写死行数）**；零接触判据 = 「tracked 工程文件 diff 为空」+「status 行全部落在守卫白名单（g2 黑板区 / g2 spec 区 / 平台预置 SKILLS.md）」。R2 纠偏：首轮摘要写「仅 1 行」与被引日志 2 行实况不符（采集时证据件未提交属预期，非越界），已改为按实记录 |
| 10 | `10-repo-one-flaky-rotate-pause.log` | 2026-10-01 | 终验聚合门禁偶现后的单件复跑统计（`games/stack-tower/tests/contract/m21-acc-m3-rotate-pause.spec.mjs`，20 连跑） | 一号存量低频 flaky（约 2/20 次失败，时序/视口竞态特征）；聚合门禁重跑自愈（连续 3 次 PASS）；**非本轮产物、本线不代修**，已移交一号线（blockers.md 台账行） |

## 2. 附加验证：AC-11 断言机首度实跑（/tmp 合成树，两仓库零接触、零落盘残留）

骨架态下 `tests/theme.spec.mjs` 只走 PENDING 分支，其键名/值/单源断言从未真正执行过。本轮在
`/tmp/g2-theme-probe` 合成树上（`G2_SPEC_PATH` 指向真实导出件）端到端验证，验证后整树删除：

| 场景 | 结果 |
|---|---|
| theme.ts 七色与 spec 冻结块全等 | PASS 3/3，退出码 0 |
| `#C89C19` 改回被否决的 `#FFC94A` | `RED ac-11/b 值逐字相等 {"drift":["block-02 期望 #C89C19"]}`，退出码 1 |
| `src/render/fx.ts` 额外塞 hex（破坏单源） | `RED ac-11/c 单源 {"multiSource":["fx.ts"]}`，退出码 1 |

→ approve 后 codegen 生成 `src/render/theme.ts` 时，该门禁即刻具备咬合力（不被装绿）。

## 3. 红线自检（本轮 · R2 修后口径）

- 不写冻结值相关代码 ✅：**R2 纠偏**——首轮 `kernel-purity.spec.mjs` b) 项曾硬编码
  `const seed = 20261001`（恰为 spec `numeric.DEFAULT_SEED`），与「零硬编码」声明矛盾，属**虚假声明**；
  R2 已改为 `defaultSeed()` 派生（文件内已无任何 seed 字面量），并新增 `ac-14/h` 机判
  「冻结 DEFAULT_SEED 不得以字面量出现在本件」把该缺陷类变成永久门禁。
  现口径：seed/色值/阈值一律 spec 现读；`src/render/theme.ts` 仍缺位（PENDING-APPROVE 在档）。
- 不改一号任何文件 ✅：tracked 工程文件 diff 为空；本轮唯一一号落点 = 黑板 g2 子目录（守卫白名单内）。
- 不代拍 approve ✅：链上 v1 维持 draft，全程零 approve 调用路径。

## 4. R2 驳回修复记录（2026-10-01 · 非阻断 5 条 + 备忘 1 条）

| # | 归属 | 缺陷 | 处置 | 状态 |
|---|---|---|---|---|
| ① | 程序线 | `kernel-purity.spec.mjs:36` 硬编码 `20261001`（= spec DEFAULT_SEED），与「零硬编码」声明矛盾 | 改 `defaultSeed()` 派生（b/d/e 三处 seed 全部派生，零字面量）+ 新增 `ac-14/h` 自证门禁；05/01 号日志刷新（8/8 PASS） | ✅ 已修 |
| ② | 程序线 | `palette-gate.mjs:6-7` 头注释写废弃档 0.18/0.15，实际生效 0.10/0.08 | 注释更正为生效值，并注明判据真源=palette JSON gate 块（实查 GATE 常量在 27-30 行被 JSON gate 块覆盖，门禁结论不受影响） | ✅ 已修 |
| ③ | 线2 | 链上 ac-11 statement/note 写 `theme.js`，与同文档 `assets.a01`、`entities.e-renderer.script`（均 `theme.ts`）及 `tests/theme.spec.mjs` 断言不一致 | **实查平台 `PUT`/`PATCH` /game-design-specs/{id} 均 405** → 无 draft 原位更正通道，改措辞只能产生 v2（违反一次成链纪律）→ 走呈批件披露项登记交主人裁定（执行面无歧义：断言与实体/资产声明均按 theme.ts） | ⏸ 披露待主人裁定 |
| ④ | 程序线 | 本 README 09 行摘要「仅 1 行」与被引日志 2 行实况不符 | 09 号改结构化采集（记录采集时点 HEAD + 零接触判据），摘要不再写死行数、以日志实况为准；本轮另发现并纠正「采集自引用」假象（采集时证据件未提交属预期） | ✅ 已修 |
| ⑤ | 美术线 | `palette-n1-final.json` block-02 intent 写 `L*≈64`，实测 L*=66.6（05-lstar / assets.md / 04-rejected 三处一致） | **不可静默改文件**：`tools/build-spec-v1.mjs:37-38` 强制校验 spec `sourceSha256` == 该文件哈希，且链上 v1 已锚定 `7bc2ca03…`；改注记即破坏链上锚 → 走呈批件披露项 + assets.md 注记，待 spec 修订轮随 `sourceSha256` 一并更正（归美术线） | ⏸ 披露待 spec 修订 |
| 备忘 | QA | round-2 回执出具于线3 契约收口（05a644e）之前 | 未动链上 spec 内容，27 断言仍有效；回执已补「05a644e 后门禁复跑」索引行（QA 回执 §六 · 程序线补记） | ✅ 已补索引 |
