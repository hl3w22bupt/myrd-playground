# 阻塞项黑板 — g2-blocks（**R2「spec v1 → 首个可玩构建」轮 · 收口**）

> 更新时间：2026-10-02（N1–N5 全链核销 · 主策划）
> 负责人：主策划（整合人）· 每次整合后更新；阻塞超一轮未解 → 升级主人，不空转
> 下一步：**等主人拍板**（approve-ready-r2 包）；blockers 清零，无未闭环项

## 当前基线（R2 轮收口 · 2026-10-02）

- **黑板路径**：`.myrd/blackboard/g2-blocks/`（levels.md / assets.md / blockers.md 三件套 + approve-ready-r2.md + gate-logs/）
- **spec 版本号**：**v1.1 = 链 v2 · approved（唯一）**，平台 id `cmuqa2mu50023m9zr8mh60uph`；v1 `cmuovwra0004gm97tinha15zq` superseded 未覆盖
  - 链上流转披露（N1 时点）：开工时 v1 为 draft（上轮收口态）→ 主策划按本轮任务书授权实调 approve → v1 approved → v1.1 经 `POST /revisions` version+1 入链（draft）→ 实调 approve → **v2 approved（唯一）**、v1 自动转 superseded。两步 approve 均已在提请包中显式披露供主人追认/否决。
- **numeric 冻结锚**：sha256(sortKeys) = `302e63367f3dea63212ad689a33703d83886d145862db0d724df98e97fea2d89`（v1 ≡ v1.1 逐字节全等，QA G1/c 机判）
- **导出件**：`.myrd/spec/g2-blocks/design-spec.json`（= 链上 v2 回读全等，QA G1/g 机判）
- **g2-blocks 仓库**：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks`
  R2 轮提交链：`19ed02c`（N1 v1.1）→ `e6ba6fb`（M0 红态）→ `4e510b6`（N2+N3）→ `743fb77`（N4 复检器）→ `4a9cadb`（N4 收口）→ `c07ac4e` + `8249249`（复证轮）→ `a8a0c90`（R3 F1+F2）→ `b819be1`（R3 F3+F4+加固）→ `46a85b0`（R3 N4 复检归档，HEAD 树净）
- **复证轮实录（2026-10-02 · 程序线）**：契约 18/18 EXIT=0 + 冒烟 SMOKE: PASS（J1=179.1ms）+ QA round-3 重跑 VERDICT: APPROVE-READY（24/24 gates · R1–R7 零打回）+ numeric 锚独立重算 ANCHOR MATCH——全部显式钉本 run（`G2_SPEC_PATH`/`G2_REPO_ONE_ROOT` = `run-cmuq9pz86001vm9zrmqyfm59c`），原文见 levels.md 复证轮实录与 `g2-blocks/docs/evidence/qa-round3-run.log`
- **一号仓库**：零接触（R3 修后守卫 self-check 对本 run `git status` 机判 PASS：tracked 工程面 diff 空，黑板更新走 `allowedNewPaths` 白名单路径，不触 `games/` 等禁区；ac-17/framework 定位已根治误锚，不设 env 自动锚本 run）

## 阻塞项（R2 轮 · 全部闭合 ✅）

| id | 内容 | 归属线 | 解除判据 | 状态 |
|---|---|---|---|---|
| B3 | spec v1.1 未入链 | 策划 | revisions version+1 入链 + numeric 零 diff + 六段零 diff | ✅ 闭合（QA G1/c–g） |
| B4 | 可玩构建未产出 | 程序 | contract-check 绿（18/18 EXIT=0）+ 冒烟绿（可开+可玩+SW+J1 达标）+ 原文落档 + 提交 | ✅ 闭合（QA G2/G3） |
| B5 | 资产三批未交付 | 美术 | 三批 kebab-case + 映射表 + assets.md 总表 | ✅ 闭合（QA G5/a–d） |
| B6 | QA round-3 未跑 | QA | 单一 verdict JSON | ✅ 闭合（VERDICT: APPROVE-READY，24/24 gates · R1–R7 零打回） |

## R3 驳回轮（QA round-1 打回 F1–F4 · 全部闭合 ✅ 2026-10-02）

| id | 内容 | 归属线 | 解除判据 | 状态 |
|---|---|---|---|---|
| B7 | F1+F2 炉冷双判退化单点 + trace 重排无效机判 + 披露与代码相反（拍板依据失真） | 程序 | sim.ts 判点一真实前移（重力落定后/补手前，含空洞盘）；trace 如实记录；ac-07/ac-08 改真实时点机判 | ✅ 闭合（`a8a0c90`；机判 filled=61/64 · QA G2/a 现场复跑绿） |
| B8 | F3 renderer 7 处 rgba 盲区（辉光值漂移 rgb(210,160,40)≠token #C89C19） | 程序 | 全部接线 theme 单源；美术规格补录 tint/innerStroke/topHighlight/coolScrim；ac-11 扫描扩展 rgba/rgb 形态（红验必咬） | ✅ 闭合（`b819be1`；ac-11 17 色溯源 PASS） |
| B9 | F4 level-2 玩家不可达 + parseGoals/goalEval/el-hint 零测试覆盖 | 程序 | level-2 三入口（键盘 1/`?level=`/`__G2_SET_LEVEL`）+ HUD spec 现读；levels.spec.mjs 入 run-all ⑦；smoke 补 level-2 面 | ✅ 闭合（`b819be1`；冒烟 level-2 入口可达可玩+切换回路） |
| B10 | 附带：ac-17/framework 一号仓库定位字母序误锚旧 run（上轮已披露坑） | 程序 | 共享定位件 repo-one.mjs（spec 导出件 updatedAt 最新优先），两处统一接入 | ✅ 闭合（`b819be1`；不设 env 自动锚本 run） |

- **R3 修后 N4 复检：VERDICT: APPROVE-READY（gates 24/24 · R1–R7 零打回 · J1=177.3ms）**，证据 `g2-blocks/docs/evidence/qa-round3-run.log`（commit `46a85b0`）。
- 挂账注记①（炉冷判点一含空洞盘）随 B7 修复**与代码一致**，原披露不再失真；缺口通道未动用（spec 零改动，numeric 锚 `302e6336…` 全程不变）。

### 挂账（非本轮动作，防丢失）

- **美术线 intent 更正案**：继续挂账顺延下一轮 spec 修订（本轮「仅动 acceptance 段 + numeric 零 diff」硬约束不可随版；6 步执行序见 assets.md）。
- **美术线门禁 env 钉值登记建议**（2026-10-02 复证轮新增）：`tests/framework.spec.mjs` ac-17 自检在缺
  `G2_REPO_ONE_PATH` 时按兄弟目录扫描取首个 `run-*`，多 run 并行会误锚他线工作区；建议下轮 spec 修订时
  由程序线把钉值口径写进门禁 README（复证证据 `gate-logs/r2-art-reverify-20261002/`，钉本 run 后 5/5 PASS）。
- **缺口通道 A 档口径注记（本轮实现判读，随包披露）**：
  ① 炉冷判点一（落定结算后）在补手前的盘面上执行（含消除空洞），spec「落定结算后+补手后各判一次」的字面实现（ac-07 机判双探针在档）；
  ② 初始盘面为 uniform_random 字面填充，不附加「开局无三连」约束（spec 未声明；若需约束走缺口通道 B/C）；
  ③ 连击加成按 `(chain − appliesFromChain + 1) × chainBonus` 单调递增（冻结四手向量只锚 chain≤2，外推一致）。
  三条均零新增数值、零 spec 改动；如主人裁定不同口径 → 下一轮 spec 修订闭合。

## 升级条款

- B3–B6 全部本轮闭合，未触发升级。主人侧待拍板见 approve-ready-r2 包。

## 红线（任务书原文，全程有效）

- numeric 零漂移 ✅（锚全等机判）；代码零裸 hex ✅（全仓 hex 逐一溯源 theme 单源，G4/d+ac-11）；不动 stack-tower 一号仓库 ✅（G6/a）；不开新品选型 ✅；不做 wx/dy/Steam/Roblox 移植 ✅（G6/c 无移植面 + ac-10 deferred 注记）；missions 不激活 ✅（G6/d）；scope_gate 挂起 ✅。

## 提请主人拍板

1. **spec v1.1（链 v2）approve 追认** + 链上 approve 动作披露的追认/否决。
2. **首个可玩构建人工验收**（「好不好玩」终裁归主人）：本地构建 `build/`，冒烟已机判可玩；人工试玩路径 = `npx serve g2-blocks/build`（或任意静态服务器）→ 浏览器打开 → 点选相邻两块交换。
3. 部署坑位（是否为 g2-blocks 建 apphost 坑并发布）：待主人指令，本轮未部署。

---

# 上一轮（N1 修复轮 · 2026-10-01）台账存档

## 当前基线（N1 修复轮 · 2026-10-01 收口态）

- **黑板路径**：`.myrd/blackboard/g2-blocks/`（levels.md / assets.md / blockers.md / approve-ready-n1.md
  / evidence-one-line-template.md + gate-logs/{n1-palette-20261001, n1-round2-20261001}）
- **spec 版本号**：**v1 · draft（当时待主人 approve）**，平台 id `cmuovwra0004gm97tinha15zq`
- **导出件**：`.myrd/spec/g2-blocks/design-spec.json`（wrapped 形状，回读与链上 sortKeys 全等）
- **numeric 冻结锚**：sha256(sortKeys) = `302e63367f3dea63212ad689a33703d83886d145862db0d724df98e97fea2d89`
- **g2-blocks 新仓库**：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks`（独立 git 仓库）
- **一号仓库**：开工至收口 `git status --porcelain` 仅 3 行且全部白名单内

## N1 轮 B1/B2（✅ 已闭合，存档）

| id | 内容 | 解除判据 | 状态 |
|---|---|---|---|
| **B1** | 色板未定稿：余烬金占位 hex `#FFC94A` 非真值；暖区缺第 6/7 色 | 7 色齐 + 21 对双门禁全绿 + 证据四要素落档 + assets.md 定稿 | ✅ 解除（`#C89C19` + `#4B2B25`/`#E3B5BF`；ALL-GREEN minΔE 26.555 / 阈值 25） |
| **B2** | spec 未入链：五处修法 + 色板未落成 version 1 | v1 经接口入链（一次成链）+ round-2 无新红 + approve-ready 提请主人 | ✅ 解除（v1 `cmuovwra0004gm97tinha15zq`；round-2 27 断言无红） |

## N1 轮遗留移交（存档）

- 【移交一号线·非本轮产物】stack-tower 聚合门禁存量低频 flaky（2 项）：`m21-acc-m3-rotate-pause`、`acc-j1`——本线不代修（红线：不改一号任何文件），已留痕移交。
