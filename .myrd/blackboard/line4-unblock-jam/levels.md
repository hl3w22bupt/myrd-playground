# 关卡状态黑板 — line4-unblock-jam《挪出一条路（工作名待主人定）》（第四产品线 · 挪车/挤压超休闲物理解谜）

> 更新时间：2026-10-25（**10/25 交付包轮 · 链 v2 approved 版本锁生效**）· 负责人：主策划（整合）/ 游戏策划（执笔）/ 游戏程序 / 游戏美术 / 游戏 QA ｜ 下一步：**链 v2 `cmvlrc0ma001tm94ialxeykjn` approved（主人 10-24 拍板，实测回写）** → 四实体已灌实（lot/car/exit/director）· 契约 8 checks 转真 29/0 全绿 · a3 真人 5 名待采（终裁归主人）；谱系参数 PEND-待校准随首批真人数据 revision 校准

## 线状态（本轮开工时点）

| 项 | 值 |
|---|---|
| 选型 | 拍板 B ≡ 简报 v2 候选②「超休闲解压·物理小解谜（挪车/切开/挤压类）」（三轴 12 分 · 次推位，主人点名生效） |
| 品类避让双出处 | ①PL3 spec `meta.genre` 原文＝「单场景塔防（炮塔防守 · 波次切面 · IAA 主导 · 微肉鸽）」②简报 v2 候选②条目原文＝「超休闲解压·物理小解谜（挪车/切开/挤压类）」——品类不同轴不撞线，**拍板 B 有效**（核对全文见 `../next-line/decision-record-v1-20261024.md`） |
| spec | **v0.2（链 v2 `cmvlrc0ma001tm94ialxeykjn`）= approved 唯一现行**（主人 2026-10-24T08:43:25.904Z 平台侧拍板；10/25 复核轮 GET 200 实测 status/version/updatedAt 三锚，证据 `../gate-logs/line4-verify-rerun-20261025/07-platform-spec-get.log`）；v1 superseded。首审驳回 1 件 P3（g-01 二义）已核销=达成率口径 ≥0.90（≥18/20）+ L4-4/F-01（acc-02「五要素」→「三通道规格」）；六段零漂移机判在档 |
| 工程 | `games/line4-unblock-jam/`：五件脚手架 @ `aff6fd0` + **approve 后四实体灌实（lot/car/exit/director @ `402919f`，谱系 20 局 seeds 42..61 全可解机判）+ 8 条 checks 转真**；telemetry 6 键≡spec 三列机判 / 计数控名人+pending 恒等 / HUD F1~F4 / sha 重锚，历史证据 `.myrd/blackboard/gate-logs/line4-continuity-20261024/` |
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
| 驳回勘误轮（2026-10-25） | 五项驳回逐项落办（证据 `../gate-logs/line4-rejection-fix-20261025/`）：① 红轮边界语义按 spec 原文改实现——删除「驶出即完成（预算只影响评价面）」豁免分支（`el-red-clear/el-red-fail` 写死面：超预算即 fail，驶出不豁免），acc-04 补 `exited=true & redMoves=B+1` 边界断言 ×2 → **10 PASS/0 FAIL**；② 零漂移补证重跑：canonical-JSON 六段 **7/7 字节级 MATCH + deep-equal 结构级 MATCH** 全文原件在档 `09-chain-readback-drift.log`（旧幽灵引用作废）；③ 「12→8 elements」两处勘误（送审件 §2.3 + QA verdict 清单 B）；④ `design-spec-v0.md` L3 链锚 + L48 状态落盘勘误（draft→approved 链 v2）+ 送审件 F 编号映射披露更正；⑤ QA verdict「deploy 冒烟输出」降格「部署面预检输出」+ REVISIONS 同口径（真实 deploy 冒烟待实现轮补）。勘误后全量门禁复跑 verify.sh（WX=1）**13 步全 PASS exit 0**（08 号日志）。 |
| 好玩终裁 | **归主人**（a3 真人面；机器不代行，措辞守 fun-verdict 模板规范） |

> 证据四要素（命令原文 + 时刻 + exit 码 + 输出摘要）逐条落盘两目录：续接核实轮 `../gate-logs/line4-continuity-20261024/`（@ `aff6fd0` · SELF_CHECK PASS）；驳回勘误轮 `../gate-logs/line4-p3-erratum-20261024/`（@ `75653d8` · 链 v2 · SELF_CHECK PASS 五断言：冒烟 4/4 + 移植门禁 web/wx + 契约 fail-closed + 6 键全等）。结论仅对取证时点 HEAD 有效；其后提交仅黑板文档与证据目录（源码面除生成件锚外零变更）。
