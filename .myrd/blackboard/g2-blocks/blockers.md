# 阻塞项黑板 — g2-blocks（**N1 修复轮闭合**：色板双门禁定稿 + spec v1 一次入链 + N3 前置工单 + round-2 复检）

> 更新时间：2026-10-01（**R2 驳回修复 · 程序线主导**：非阻断 5 条中 ①②④ 已修 + 备忘索引已补；
> ③⑤ 因「平台无 draft 原位更正通道 / 改文件破坏链上 sourceSha256 锚」走呈批件披露项挂账交主人裁定；
> B1/B2 维持解除，approve-ready 不变，仍等主人拍板）
> 负责人：主策划（整合人）· 每次整合后更新；阻塞超一轮未解 → 升级主人，不空转
> 下一步：**等主人拍板 approve**（呈批件 `.myrd/blackboard/g2-blocks/approve-ready-n1.md`）；团队不代拍，
> v1 未 approve 前零冻结值实现投入。B1/B2 本轮内闭合 ✅，升级条款未触发。

## 当前基线（N1 修复轮 · 2026-10-01 收口态）

- **黑板路径**：`.myrd/blackboard/g2-blocks/`（levels.md / assets.md / blockers.md / approve-ready-n1.md
  / evidence-one-line-template.md + gate-logs/{n1-palette-20261001, n1-round2-20261001}）
- **spec 版本号**：**v1 · draft（待主人 approve）**，平台 id `cmuovwra0004gm97tinha15zq`
  （project `cmto0g28j0002m9sqnvjdy8o7`；链上 g2-blocks 仅此一条，一次成链零空转；approve 归主人，团队不代拍）
- **导出件**：`.myrd/spec/g2-blocks/design-spec.json`（wrapped 形状，回读与链上 sortKeys 全等；
  契约测试与 QA 共同输入）。**显式偏差**：任务书要求的 `.myrd/spec/design-spec.json` 是一号仓库
  （stack-tower v1.5 approved 镜像）在用件 → 按红线「一号零接触」改落 g2 子目录（沿 B4 冻结撞车件判例）。
- **numeric 冻结锚**：sha256(sortKeys) = `302e63367f3dea63212ad689a33703d83886d145862db0d724df98e97fea2d89`
- **g2-blocks 新仓库**：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks`（独立 git 仓库，
  仓外落点 = 一号仓库树之外；4 commits：色板 / spec / 脚手架 / QA 复检器）
- **一号仓库**：开工至收口 `git status --porcelain` 仅 3 行且全部白名单内（g2 黑板区新增 / g2 spec 区新增 /
  平台预置 `.myrd-platform/.claude/skills/SKILLS.md`——开工前已存在的 M 态，非本轮产物）；
  tracked 工程文件 diff 为空；一号 spec/导出包/游戏工程零触碰。
- **前轮记录缺口（如实登记）**：本 run 工作区与全部兄弟 run 目录未检索到 g2-blocks 前轮台账
  （检索词：g2-blocks / 余烬金 / FFC94A / 炉冷 / 暖区 / uniform_random / guard-repo-scope / AC-06..AC-18 / block-0x）→
  「已冻结 4 色（01/03/04/05）」「5+1 裁决表」「B1/B2」的数值原文不可恢复；本轮以任务书口径为唯一裁决来源，
  冻结 4 色基线值由美术线一次性登记冻结（已披露于 assets.md 与呈批件 §五.1）。

## 阻塞项（B1 / B2 · ✅ 本轮闭合）

| id | 内容 | 归属线 | 解除判据 | 状态 |
|---|---|---|---|---|
| **B1** | 色板未定稿：余烬金占位 hex `#FFC94A` 非真值；暖区缺第 6/7 色 → 21 对双门禁无法全绿 | 线1 美术 | 7 色齐 + 21 对双门禁全绿 + 证据四要素落档 + assets.md 定稿 | ✅ **解除**（`#C89C19` + `#4B2B25`/`#E3B5BF`；ALL-GREEN minΔE 26.555 / 阈值 25；证据 `gate-logs/n1-palette-20261001/`） |
| **B2** | spec 未入链：五处修法 + 色板未落成 version 1 | 线2 策划 | v1 经接口入链（一次成链）+ round-2 无新红 + approve-ready 提请主人 | ✅ **解除**（v1 draft `cmuovwra0004gm97tinha15zq`；round-2 27 断言无红；呈批件已出） |

## 节点链核销台账（2026-10-01 收口）

| 节点 | 线 | 产物 | 验收 | 状态 |
|---|---|---|---|---|
| 线1 色板定稿 | 美术 | `tools/color.mjs`(18/18 自证) + `tools/palette-design.mjs` + `tools/palette-gate.mjs` + `assets/palette/palette-n1-final.json`（sha256 7bc2ca03…） | 21 对双门禁 ALL-GREEN；弃用值反证留痕；确定性重跑逐字节一致；g2 仓库 commit d401cab | ✅ |
| 线2 spec v1 | 策划 | `tools/spec-content.mjs` + `build-spec-v1.mjs`(八道守卫) + `post-spec-v1.mjs`(幂等防线) + 平台 v1 + 导出件 | 一次成链；回读全等；numeric 锚落账；commit 19abac4 | ✅ |
| 线3 N3 前置 | 程序 | 脚手架 + `ci/scope-policy.json`+`guard-repo-scope.mjs`(AC-18/AC-17) + CI job + `tests/harness.mjs` + `src/kernel/{spec-source,rng}.ts` + `tests/theme.spec.mjs` + `tests/run-all.mjs` | run-all 绿（①②④ PASS + ③ PENDING-APPROVE 非装绿）；守卫反向探针实测会红；零冻结值硬编码；commits 1a47805 | ✅ |
| 线3 契约收口 | 程序 | `tests/kernel-purity.spec.mjs`（**ac-14 spec 声明落点补位**，7 断言）+ `tests/acceptance-map.spec.mjs`（18 条 `acceptance.check` 落点契约守卫：存在或显式冻结白名单，白名单反过期/反幽灵）+ run-all 扩六件门禁 + CI 增两步 + package.json `test:kernel`/`test:acmap` | **缺陷发现并闭合**：ac-14 声明落点 `tests/kernel-purity.spec.mjs` 此前缺位（断言寄生 framework.spec.mjs）→ 补位；六件门禁全绿；反向探针三路实测会红（守卫越界/acmap 落点缺位/AC-11 错值与多源）；一号 `node scripts/contract-check.mjs` PASS；commit **05a644e**；证据 `gate-logs/n1-prog-contract-20261001/`（9 log + README） | ✅ |
| 线4 round-2 | QA | `tools/qa-round2.mjs`(27 断言) + 证据 `gate-logs/n1-round2-20261001/` + 回执 QA-G2-N1-R2-20261001-01 + 证据一行式模板 | 五项关闭逐条核对 + 无新红 → **approve-ready**；判据自纠 1 条留痕；commit ff7d34c | ✅ |
| 主人拍板 approve | 主人 | — | 人工验收最终裁决 | ⏸ **等拍板** |
| R2 驳回修复（非阻断 5 条 + 备忘） | 程序线主导 | ① `kernel-purity.spec.mjs` 硬编码 seed（= DEFAULT_SEED）→ 改 `defaultSeed()` 派生 + 新增 `ac-14/h` 零硬编码自证门禁（8/8 PASS）；② `palette-gate.mjs` 门 A 注释 0.18/0.15 → 更正为生效值 0.10/0.08；④ 证据 README 09 行摘要与日志实况对齐（改结构化采集，不写死行数）；备忘：QA 回执补 §六 门禁复跑索引 | ①②④✅ 已修（见 `gate-logs/n1-prog-contract-20261001/README.md` §4）；③ ac-11「theme.js」措辞二义（平台 PUT/PATCH 405，无 draft 原位更正通道）→ 呈批件披露 §五.5 交主人裁定；⑤ palette intent「L\*≈64」vs 实测 66.6（改文件破坏链上 `sourceSha256` 锚）→ 呈批件披露 §五.6 待美术线下轮 spec 修订更正 | ✅ 修毕（③⑤披露挂账） |

## 升级条款（主策划已定，本轮生效）

- B1/B2 拖过本轮未闭合 → **直接升级主人，不派第三轮**。→ **未触发**（本轮闭合）。

## 红线（任务书原文，全程有效）

- 不代拍 approve ✅（v1 维持 draft，无 approve 调用路径）；不写冻结值相关代码 ✅（theme.ts/board.ts 等缺位，
  QA 断言在档）；不改一号任何文件 ✅（diff 为空留证）；不出 wx/dy 包 ✅；missions 不激活 ✅；scope_gate 挂起 ✅。

## 待主人拍板 / 主人侧挂账

1. **approve g2-blocks spec v1**（本轮唯一拍板位）。
2. 「好不好玩」人工验收终裁（本轮不可玩，approve 后实现轮交付原型再裁）。
3. 若主人所指「g2-blocks 前轮台账」存于本工作区之外（其他仓库/平台），请指认路径 → 冻结 4 色基线值即可对账校准（当前以本轮登记值为准）。


- **黑板路径**：`.myrd/blackboard/g2-blocks/`（levels.md / assets.md / blockers.md + gate-logs/）
  - 为什么不是 `.myrd/blackboard/` 顶层三件：顶层三件是一号仓库（stack-tower 线）在用且历史台账不可覆盖；
    g2-blocks 是独立产品线，按「同一份结构、独立目录」落区，避免覆盖一号台账（红线：不改一号任何文件）。
- **一号仓库**：本 run 仓库（`git rev-parse --show-toplevel` = run 目录）＝ stack-tower 线工程，
  **全程零接触**（零文件修改 / 零 spec 触碰 / 零导出触碰）；开工时点 `git status --porcelain` 仅
  平台预置改动 `.myrd-platform/.claude/skills/SKILLS.md`（本轮开工前已存在，非本轮产物）。
- **g2-blocks 新仓库**：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks`（独立 git 仓库，
  在一号仓库树之外 —— 工作区根经实查 `not a git repository`，此路径天然不进一号 `git status`）。
- **spec 版本号**：g2-blocks 链**尚无任何版本**（平台实查：project `cmto0g28j0002m9sqnvjdy8o7` 下现存
  版本全为 Stack Tower v1..v7，无 g2-blocks 条目）→ 本轮由线2 一次性 POST 创建 **version 1**；
  **approve 是主人拍板位，团队不代拍**（本轮任务书红线，与 stack-tower 早期「代持判例」不同，
  本任务书显式写死「不代拍」）。
- **前轮记录缺口（如实登记，非阻塞但须主人知悉）**：本 run 工作区与全部兄弟 run 目录中**均未检索到**
  g2-blocks N1 修复轮的前轮台账（检索词：g2-blocks / 余烬金 / FFC94A / 炉冷 / 暖区 / uniform_random /
  guard-repo-scope / AC-06..AC-18 / block-0x，命中仅平台 verification 技能文档）→ 任务书所称
  「已冻结 4 色（01/03/04/05）」「5+1 修法裁决表」「B1/B2 阻塞」的数值原文在本工作区不可恢复；
  本轮处置＝以任务书给出的口径为唯一裁决来源，冻结 4 色基线值由美术线在本轮一次性登记进
  `assets.md`（登记后即冻结，后续轮不得改），并在 approve-ready 包内向主人显式披露此缺口。

## 阻塞项（B1 / B2 · 本轮目标＝解除）

| id | 内容 | 归属线 | 解除判据 | 状态 |
|---|---|---|---|---|
| **B1** | 色板未定稿：余烬金占位 hex `#FFC94A` 非「余烬金」真值（偏柠檬、过浅，非余烬色相带）；暖区缺第 6/7 色（block-06/07 未产）→ 21 对双门禁矩阵无法全绿 | 线1 美术 | 7 色齐 + 21 对双门禁全绿（HSL 三选二逐对 + ΔE(CIEDE2000) ≥ 策划校准阈值）+ 证据四要素落档 + assets.md 定稿 | 🔄 本轮闭合 |
| **B2** | spec 未入链：五处修法（spawn.orientation / AC-06 四手 combo 向量 / AC-07 炉冷双判 + 全穷举 / level-1 el-hint / AC-10 J1 定义 + perf 标记名）与第 6 项（色板并入）未落成 version 1 → 契约测试与实现无共同输入 | 线2 策划 | spec v1 经接口入链（version 1，一次成链零空转）+ round-2 复检无新红 + approve-ready 包提请主人 | 🔄 本轮闭合 |

## 升级条款（主策划已定，本轮生效）

- B1/B2 拖过本轮未闭合 → **直接升级主人，不派第三轮**。
- 主人侧待拍板（团队不代行）：① spec v1 approve（唯一拍板位）；②「好不好玩」人工验收终裁。

## 红线（任务书原文，全程有效）

- 不代拍 approve；不写冻结值相关代码（线3 只做零冻结值依赖件）；不改一号任何文件；
  不出 wx/dy 包；missions 不激活；scope_gate 挂起不激活。
