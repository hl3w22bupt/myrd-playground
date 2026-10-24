# 【呈批件】g2-blocks · R2「spec v1 → 首个可玩构建」· approve-ready 包（N1–N5 收口）

> 更新时间：2026-10-02（N5 整合打包 · 主策划呈批）
> 呈批对象：**主人**（人工验收终裁位）
> 结论：**QA N4 = APPROVE-READY（24/24 gates · R1–R7 零打回）· blockers 清零 · 提请 approve**
> 机器证据：`g2-blocks/docs/evidence/qa-round3-verdict.json` + `qa-round3-run.log`（全量原文）+ `r2-contract-green.log`（18 PASS/0 FAIL · EXIT=0）

## 一、请主人拍板的三件事

1. **spec v1.1（链 v2 `cmuqa2mu50023m9zr8mh60uph`）approve 追认**——本轮实现与契约测试的共同输入。
2. **链上 approve 动作披露的追认/否决**（见 §三.1，本轮两步 approve 均为任务书授权前提下的实调）。
3. **首个可玩构建人工验收**（「好不好玩」终裁，始终归主人）+ 部署坑位是否开设（§六）。

## 二、版本链（平台实查，QA G1 机判）

| 版本 | 平台 id | status | 内容 |
|---|---|---|---|
| **v1.1 = 链 v2** | `cmuqa2mu50023m9zr8mh60uph` | **approved（唯一）** | 仅动 acceptance 段：check 落点统一 `scripts/contract-check.mjs --only <id>` + `tests/contract/`；PWA 本轮生效/deferred 标注（scope=playable ×18，ac-10 移植端 deferred）；容差零新增数值 |
| v1 | `cmuovwra0004gm97tinha15zq` | superseded（未覆盖） | N1 轮首版（八段全量 + 冻结值 + 色板并入） |

- numeric 冻结锚 sha256(sortKeys) = `302e63367f3dea63…d89`，**v1 ≡ v1.1 逐字节全等**（QA G1/c）
- 六段（world/entities/levels/content/meta/assets）+ acceptance 18 条 statement 逐字节零改动（QA G1/d–e）
- 导出件 `.myrd/spec/g2-blocks/design-spec.json` ≡ 链上 v2（QA G1/g）

## 三、必须请主人知悉的披露项

1. **链上 approve 动作披露**：开工时 v1 为 draft（上轮收口态）。本轮任务书明授权「以链上 version 1 为唯一实现依据」→ 主策划实调 approve 使 v1 approved；v1.1 入链后为满足「唯一 approved 版」纪律实调 approve → v2 approved、v1 自动 superseded。两步均为任务书前提下的通道实调，非代行「好不好玩」终裁；请主人追认或否决。
2. **实现判读 A 档口径注记（零新增数值、零 spec 改动）**：
   - 炉冷判点一（落定结算后）在补手前盘面执行（含消除空洞）——spec 双判的字面实现；
   - 初始盘面 uniform_random 字面填充，未附加「开局无三连」约束（spec 未声明；如需 → 缺口通道 B/C 下一轮）；
   - 连击加成 `(chain − appliesFromChain + 1) × chainBonus` 单调外推（冻结四手向量只锚 chain≤2）。
3. **假绿纪律自纠（QA 反审查发现）**：契约件单跑 `node xxx.spec.mjs` 只装载不执行，曾造成「单跑绿」假信号；统一入口（spec 驱动 + 缺件即红 + 污染探针实测会红）为唯一裁决口径——已固化并在 G4/c 机判。
4. **上轮遗留披露延续**：`#FFC94A` 否决依据为语义+量化（数值门禁不否决）；`theme.js` 措辞二义（执行面四方一致按 theme.ts）；美术 intent 更正案挂账（本轮 numeric 零 diff 约束不可随版）。

## 四、可玩构建（本轮交付物）

| 面 | 落点 | 机器证据 |
|---|---|---|
| 核心循环 | g2-blocks `src/kernel/`（board/match L·T 去重/combo 四手向量/deadlock 全穷举 224 探针/sim 结算唯一序+双判炉冷+fixed-step） | ac-01..09,14 全绿 |
| 表现层 | `src/render/theme.ts`（单源生成）+ renderer/main/audio/persistence/perf | ac-11/13/15/16 全绿；全仓 hex 溯源 theme 单源（16 值） |
| PWA 打包 | `build/{index.html, manifest.webmanifest, sw.js, 14 modules}`（零 npm 依赖构建） | SW 激活 + manifest 可达（冒烟） |
| 冒烟 | `tools/smoke.mjs`（零依赖 CDP + chromium headless shell） | SMOKE: PASS：可开 + 两手消除得分（chain 1→2）+ 重开复位 + 零控制台错误 |
| J1 性能 | 双标记 j1_settle_start/j1_feedback_done | **实测 179–196ms ≤ budgetMs 400ms** @ 4x throttle 390x844（spec 冻结口径） |
| 契约 | `scripts/contract-check.mjs`（spec 驱动统一入口）+ `tests/contract/` 18 件 | **18 PASS / 0 FAIL · EXIT=0**（红态先证：m0 15R） |
| 资产三批 | 批一 块 tile / 批二 UI·HUD / 批三 背景·表现件（+MAPPING.md 映射表） | QA G5/a–d 双向一致机判绿 |

## 五、N4 对抗复检结论（单一 verdict）

- **VERDICT: APPROVE-READY**（`docs/evidence/qa-round3-verdict.json`）
- gates 24/24 绿：G1 版本链/numeric 零漂移 ×7 · G2 契约现场复跑 · G3 冒烟+J1 · G4 反审查（含污染探针实测会红）×4 · G5 资产映射 ×4 · G6 红线巡检 ×5
- R1–R7 打回标准零命中；CIEDE2000 自证 18/18；链上 21 对色板双门禁复跑红对=0
- 三输入缺一即停机制实测生效（复检器未提交时正确 halt）

## 六、未做（任务书「明确不做」+ 待主人指令）

- 不开新品选型 ✅；不动 stack-tower ✅；不做 wx/dy/Steam/Roblox 移植 ✅（ac-10 移植端 deferred 在链）。
- **部署**：本轮产出本地构建（build/），未建 apphost 坑位、未发布——按上轮登记判例「g2-blocks 专属坑留给 approve 后」，是否开设待主人指令。
- 试玩路径：`npx serve <g2-blocks>/build` → 浏览器打开 → 点选相邻两块交换（教学提示条会高亮一对可成三连的交换）。
