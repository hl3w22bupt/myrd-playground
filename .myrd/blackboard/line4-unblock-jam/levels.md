# 关卡状态黑板 — line4-unblock-jam《挪出一条路（工作名待主人定）》（第四产品线 · 挪车/挤压超休闲物理解谜）

> 更新时间：2026-10-25（**10/25 交付包轮 · 链 v2 approved 版本锁生效**）· 负责人：主策划（整合）/ 游戏策划（执笔）/ 游戏程序 / 游戏美术 / 游戏 QA ｜ 下一步：**链 v2 `cmvlrc0ma001tm94ialxeykjn` approved（主人 10-24 拍板，实测回写）** → 四实体已灌实（lot/car/exit/director）· 契约 8 checks 转真 29/0 全绿 · a3 真人 5 名待采（终裁归主人）；谱系参数 PEND-待校准随首批真人数据 revision 校准

## 线状态（本轮开工时点）

| 项 | 值 |
|---|---|
| 选型 | 拍板 B ≡ 简报 v2 候选②「超休闲解压·物理小解谜（挪车/切开/挤压类）」（三轴 12 分 · 次推位，主人点名生效） |
| 品类避让双出处 | ①PL3 spec `meta.genre` 原文＝「单场景塔防（炮塔防守 · 波次切面 · IAA 主导 · 微肉鸽）」②简报 v2 候选②条目原文＝「超休闲解压·物理小解谜（挪车/切开/挤压类）」——品类不同轴不撞线，**拍板 B 有效**（核对全文见 `../next-line/decision-record-v1-20261024.md`） |
| spec | **v0.2（链 v2 `cmvlrc0ma001tm94ialxeykjn` draft，v1 superseded）**：主人首审驳回 1 件 P3（g-01「全部完成」vs「≥0.90」二义）→ 定死**达成率口径 ≥0.90（≥18/20）**（驳回 Option A，冻结 target 不动）+ 同批核销 L4-4/F-01（acc-02「五要素规格」→「三通道规格」）；五段 entities/levels/numeric/world/assets 机判逐字节零变更；`POST /revisions` 201 实证（原件 `../../spec/line4-unblock-jam/spec-v0.2-revision-response.json`） |
| 工程 | `games/line4-unblock-jam/` 中性脚手架五件（单局制模板）——**玩法逻辑与 contract-check 断言零**，只认审查通过版；五件 @ `aff6fd0` 续接复核成立（telemetry 6 键≡spec 三列机判 / 计数控名人+pending 恒等机制面 / HUD F1~F4 / sha 重锚 `aff6fd08b5e8` / 移植门禁脚本），证据 `.myrd/blackboard/gate-logs/line4-continuity-20261024/` |
| 产线 | ts-canvas 判例平移（零外部贴图 · 零 npm 依赖 · 确定性内核 mulberry32 + fixed-step） |

## 关卡谱系（v0 结构冻结 · 数值见 spec numeric）

| 关 | id | 结构 | 状态 |
|---|---|---|---|
| 教学关 | `level-1` | 首 60s 三步引导（首次拖动 → 首次驶出 → 首次通关），判据编号挂资产编号（g-01→a04-guide-hand） | **已实装**（deriveLot/solveLot 灌实 · bot 面 20/20 达成率）结构冻结，谱系参数 PEND 显式 |
| 标准关 | `level-2` | 标准布局 + **红轮首现**（三红轮边界全数值写死） | **已实装**（planRedRound 三边界执行者 · acc-04 逐条机判过） |
| 谱系 | `level-3+` | seed 派生程序化布局（每日挑战公平谱系判例复用） | **已实装**（seeds 42..61 全可解 · acc-01 逐字节双跑）；谱系参数 PEND-待校准 |

## 门禁/验收状态

| 项 | 状态 |
|---|---|
| contract-check | **fail-closed 机判复现 @ `aff6fd0`**：`node scripts/contract-check.mjs --spec .myrd/spec/line4-unblock-jam/design-spec.json --project games/line4-unblock-jam` → `SPEC_NOT_APPROVED · exit 1`（draft 态契约面拒绝执行=红线成立的机判证据，非缺陷；approve 后同口径转真） |
| 冒烟 | `node tools/smoke.mjs` → **SCAFFOLD-SMOKE: PASS（4/4 面）· exit 0** @ `aff6fd0`（内核确定性双跑逐字节 / 计数控名人+pending 零增量 / telemetry 单一出口 6 键全等+旁路键拒绝 / sha 指纹 `aff6fd08b5e8` 在位） |
| 移植门禁 | `node tools/port-gate-checklist.mjs` → **PORT-GATE(web): PASS（硬检 FAIL=0）· exit 0**；`--target wx` P-06-wx 预检列表正常（P-02 draft=GATE-NOTE 非缺陷）· **本轮缺陷修复**：`--target` 缺省解析错位（未传参时把 node 二进制路径当 target，标签失真）已修 + 两口径复跑验证 |
| 好玩终裁 | **归主人**（a3 真人面；机器不代行，措辞守 fun-verdict 模板规范） |

> 证据四要素（命令原文 + 时刻 + exit 码 + 输出摘要）逐条落盘两目录：续接核实轮 `../gate-logs/line4-continuity-20261024/`（@ `aff6fd0` · SELF_CHECK PASS）；驳回勘误轮 `../gate-logs/line4-p3-erratum-20261024/`（@ `75653d8` · 链 v2 · SELF_CHECK PASS 五断言：冒烟 4/4 + 移植门禁 web/wx + 契约 fail-closed + 6 键全等）。结论仅对取证时点 HEAD 有效；其后提交仅黑板文档与证据目录（源码面除生成件锚外零变更）。
