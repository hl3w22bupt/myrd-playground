# 关卡状态黑板 — line4-unblock-jam《挪出一条路（工作名待主人定）》（第四产品线 · 挪车/挤压超休闲物理解谜）

> 更新时间：2026-10-24（**续接核实轮 · 程序侧门禁复跑取证**）· 负责人：主策划（整合）/ 游戏策划（执笔）/ 游戏程序 / 游戏美术 / 游戏 QA ｜ 下一步：spec v0 已入链（链 v1 draft）+ QA 七条缺陷 7/7 核销 → **等主人正式审查 approve**；**approve 前零玩法逻辑零 contract 断言**（任务书红线，本轮机判复证）

## 线状态（本轮开工时点）

| 项 | 值 |
|---|---|
| 选型 | 拍板 B ≡ 简报 v2 候选②「超休闲解压·物理小解谜（挪车/切开/挤压类）」（三轴 12 分 · 次推位，主人点名生效） |
| 品类避让双出处 | ①PL3 spec `meta.genre` 原文＝「单场景塔防（炮塔防守 · 波次切面 · IAA 主导 · 微肉鸽）」②简报 v2 候选②条目原文＝「超休闲解压·物理小解谜（挪车/切开/挤压类）」——品类不同轴不撞线，**拍板 B 有效**（核对全文见 `../next-line/decision-record-v1-20261024.md`） |
| spec | v0 执笔中（schemaVersion v0 六段；经 game-design-specs 接口入链为链 v1 **draft**，禁覆盖；approve=主人正式审查，团队不代行） |
| 工程 | `games/line4-unblock-jam/` 中性脚手架五件（单局制模板）——**玩法逻辑与 contract-check 断言零**，只认审查通过版；五件 @ `aff6fd0` 续接复核成立（telemetry 6 键≡spec 三列机判 / 计数控名人+pending 恒等机制面 / HUD F1~F4 / sha 重锚 `aff6fd08b5e8` / 移植门禁脚本），证据 `.myrd/blackboard/gate-logs/line4-continuity-20261024/` |
| 产线 | ts-canvas 判例平移（零外部贴图 · 零 npm 依赖 · 确定性内核 mulberry32 + fixed-step） |

## 关卡谱系（v0 结构冻结 · 数值见 spec numeric）

| 关 | id | 结构 | 状态 |
|---|---|---|---|
| 教学关 | `level-1` | 首 60s 三步引导（首次拖动 → 首次驶出 → 首次通关），判据编号挂资产编号（g-01→a04-guide-hand） | v0 结构冻结，数值 PEND 显式标注 |
| 标准关 | `level-2` | 标准布局 + **红轮首现**（三红轮边界全数值写死） | v0 结构冻结 |
| 谱系 | `level-3+` | seed 派生程序化布局（每日挑战公平谱系判例复用） | v0 结构冻结，谱系参数 PEND-待校准 |

## 门禁/验收状态

| 项 | 状态 |
|---|---|
| contract-check | **fail-closed 机判复现 @ `aff6fd0`**：`node scripts/contract-check.mjs --spec .myrd/spec/line4-unblock-jam/design-spec.json --project games/line4-unblock-jam` → `SPEC_NOT_APPROVED · exit 1`（draft 态契约面拒绝执行=红线成立的机判证据，非缺陷；approve 后同口径转真） |
| 冒烟 | `node tools/smoke.mjs` → **SCAFFOLD-SMOKE: PASS（4/4 面）· exit 0** @ `aff6fd0`（内核确定性双跑逐字节 / 计数控名人+pending 零增量 / telemetry 单一出口 6 键全等+旁路键拒绝 / sha 指纹 `aff6fd08b5e8` 在位） |
| 移植门禁 | `node tools/port-gate-checklist.mjs` → **PORT-GATE(web): PASS（硬检 FAIL=0）· exit 0**；`--target wx` P-06-wx 预检列表正常（P-02 draft=GATE-NOTE 非缺陷）· **本轮缺陷修复**：`--target` 缺省解析错位（未传参时把 node 二进制路径当 target，标签失真）已修 + 两口径复跑验证 |
| 好玩终裁 | **归主人**（a3 真人面；机器不代行，措辞守 fun-verdict 模板规范） |

> 证据四要素（命令原文 + 2026-10-24T09:42Z 时刻 + exit 码 + 输出摘要）逐条落盘：`.myrd/blackboard/gate-logs/line4-continuity-20261024/`（manifest 含 SELF_CHECK: PASS 五断言机判）。结论仅对取证时点 HEAD `aff6fd0` 有效；其后提交仅黑板文档与证据目录（源码面零变更）。
