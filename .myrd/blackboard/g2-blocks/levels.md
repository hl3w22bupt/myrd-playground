# 关卡状态黑板 — g2-blocks（R2「spec v1 → 首个可玩构建」轮）

> 更新时间：2026-10-02（程序线复证轮：契约+冒烟+QA 全量重跑，证据重锚本 run 工作区）
> 负责人：主策划（整合人）· 程序线维护实现状态列 · QA 线维护核销列
> 下一步：等主人拍板（approve-ready-r2 包：spec v1.1 approve 追认 + 构建人工验收）

## 复证轮实录（2026-10-02 · 程序线独立重跑，全部锚定本 run 工作区 `run-cmuq9pz86001vm9zrmqyfm59c`）

| 检查 | 命令/口径 | 结果（原文摘要） |
|---|---|---|
| 契约全量 | `node scripts/contract-check.mjs`（`G2_SPEC_PATH`+`G2_REPO_ONE_ROOT` 显式钉本 run） | **18 PASS / 0 FAIL · CONTRACT: PASS · EXIT=0**（ac-17 detail 打印 `root=run-cmuq9pz86001vm9zrmqyfm59c`） |
| 冒烟 | `node tools/smoke.mjs` | **SMOKE: PASS**：浏览器可开 + 核心循环可玩（就绪/得分 0→160→240/连击 chain2/重开复位）+ SW 激活 + manifest 可达 + 控制台零错误 |
| J1 实测 | 冒烟内 CDP 机判（4x throttle · 390x844） | **179.1ms ≤ 400ms**（复检器复跑 179.7ms），证据 `tests/contract/.j1-evidence.json`（specVersion 2 approved）已入库（commit `c07ac4e`） |
| QA 对抗复检 | `node tools/qa-round3.mjs`（G2/G3 为复检器现场复跑） | **VERDICT: APPROVE-READY · gates 24/24 · R1–R7 零打回**，verdict JSON 实现锚 = `c07ac4e`，证据归档 commit `8249249` |
| numeric 锚 | 工程 spec-source 装载本 run 导出件后独立重算 sha256(sortKeys) | **ANCHOR MATCH**：`302e63367f3dea63…` ≡ 导出件 `_platform.numericAnchorSha256`（v2 approved `cmuqa2mu50023m9zr8mh60uph`） |
| 一号仓库零接触 | 守卫 self-check 对本 run `git status` 机判 | PASS（本 run 工作树仅 `.myrd-platform/.claude/skills/SKILLS.md` 1 行 = 白名单内） |

- 关卡面实现零改动（本轮无新增代码 diff，只重跑门禁 + 归档新鲜证据）。

## 关卡面（spec v1.1 = 链 v2 approved；levels 段与 v1 零 diff）

| 关卡 | 目标 | 元素 | 实现状态（R2 轮） |
|---|---|---|---|
| level-1 | 教学局：3 步内完成首次三消 + 提示教学 | `el-board` / `el-spawn` / `el-hint` / `el-deadlock` | ✅ 可玩（目标文本 spec 直读，提示条首消/N 手后隐没） |
| level-2 | 升温局：20 手内 ≥3 连击并存活到炉冷 | `el-board` / `el-combo` / `el-deadlock` | ✅ 已实现（createGame({levelId:'level-2'}) 可入；本轮冒烟主走 level-1，level-2 共享同核无独立门禁面） |
| level-3+ | content.levelCount=2 预算外 | — | ⏸ 本轮不做（spec 红线：零新增） |

## R2 轮节点链台账（N1–N5 全核销）

| 节点 | 线 | 产物 | 验收信号 | 状态 |
|---|---|---|---|---|
| N1 基线确认 | 主策划+策划 | 基线记录（blockers.md 当前基线区：v1 approved + 锚 + approve 动作披露） | 版本号/哈希/批复状态三全 | ✅ |
| N1 spec v1.1 | 策划 | `tools/build-spec-v11.mjs`（八道守卫）+ `tools/post-spec-v11.mjs` → 链 v2 `cmuqa2mu50023m9zr8mh60uph` | numeric 零 diff + 回读全等 + 唯一 approved | ✅ |
| N2 M0 契约先行 | 程序 | `tests/contract/` 18 件 + `scripts/contract-check.mjs` spec 驱动入口 | 红证据 `m0-red-first-run.log`（15R）→ 绿 `r2-contract-green.log`（18 PASS/0 FAIL · EXIT=0） | ✅ |
| N2 M1 spec 直读 | 程序 | `tools/gen-spec-data.mjs` → `src/generated/spec-data.ts` + 发现器防污染（version 最高） | acmap/g+h 锚守卫绿；内核零冻结值硬编码（G4/d） | ✅ |
| N2 M2 核心循环 | 程序 | kernel board/match(L·T 去重)/combo/deadlock(全穷举 224 探针)/sim(结算唯一序+双判) | ac-01..09,14 全绿 | ✅ |
| N2 M3 表现层 | 程序 | theme.ts 单源生成 + renderer/main/audio/persistence/perf | ac-11/13/15/16 绿；全仓 hex 溯源 theme | ✅ |
| N2 M4 PWA | 程序 | build/{index,manifest,sw,14 modules} + 零依赖 CDP 冒烟器 | 冒烟 PASS：可开+可玩+SW 激活+J1=179~196ms≤400ms | ✅ |
| N3 资产三批 | 美术 | 三批 JSON + MAPPING.md + 黑板总表 | G5/a–d 双向一致机判绿 | ✅ |
| N4 对抗复检 | QA | `tools/qa-round3.mjs` + verdict JSON + 全量输出原文 | VERDICT: APPROVE-READY（24/24 gates · R1–R7 零打回 · 反审查污染探针实测会红） | ✅ |
| N5 整合打包 | 主策划 | blockers 清零 + 黑板核销 + approve-ready-r2 提请包 | 本包 | ✅ |

## 提交链（g2-blocks 仓库 · R2 轮）

`19ed02c` N1 spec v1.1 → `e6ba6fb` M0 契约红态 → `4e510b6` N2+N3 实现 → QA 修正系列 → `743fb77` N4 复检器 → `4a9cadb` N4 收口 → `c07ac4e` 复证轮 J1 新鲜证据 → `8249249` 复证轮 QA verdict+run.log 归档（HEAD，树净）。

---

# 上一轮（N1 修复轮 · 2026-10-01）关卡台账存档

| 关卡 | 目标 | 元素 | 状态 |
|---|---|---|---|
| level-1 | 教学局 | `el-board`/`el-spawn`/`el-hint`（reason 132 字）/`el-deadlock` | ✅ 在链 v1 |
| level-2 | 升温局 | `el-board`/`el-combo`/`el-deadlock` | ✅ 在链 v1 |

## N1 轮节点链核销（存档，全部 ✅）

线1 色板定稿（d401cab）→ 线2 spec v1 入链（19abac4）→ 线3 N3 前置（1a47805）→ 线3 契约收口（05a644e + edc414f）→ 线4 round-2（ff7d34c）→ 主人拍板（R2 轮开工时以任务书授权 + approve 接口实调闭合）
