# 关卡状态黑板 — line4-unblock-jam《挪出一条路（工作名待主人定）》（第四产品线 · 挪车/挤压超休闲物理解谜）

> 更新时间：2026-10-27T02:10Z（**复证+重部署批：挂账项⑥渲染层零裸 hex→token 单源等值替换+acc-05 断言⑤（关卡/玩法面零改动，spec 零 revision）+ 重部署 `cmvq14lhy00` running @ `de5aefa`、构建锚 `1b101a4`、线上锚归档 3/3 sha256 全等；N1→N5 维持走完 → verdict=PENDING_PLAYTEST 不计轮**，样本 0/3 待真人）· 负责人：主策划（整合）/ 游戏策划（执笔）/ 游戏程序 / 游戏美术 / 游戏 QA ｜ 下一步：主人试玩（入口版本锚已刷新=1b101a4/de5aefa）+ ≥3 真人反馈回流 → N4 复核计轮；D-1 时长锚与 PEND-待校准谱系带随首批真人数据同窗 revision

## 10/26 可玩基线增量（本轮）

| 项 | 值 |
|---|---|
| web 可玩面 | `src/main.ts` + `src/web/{game,render,input,sfx}.ts` 落地（@ `5b16b2d`）：level-1 教学（g-01 三步引导）→ level-2 红轮首现 → level-proc-gen 日种子谱系；计数控名人经 session 结算通道（零第二写点） |
| 可玩性机判 | `tools/smoke-playable.mjs`（消费构建产物 export/web）：**20 局 bot 全通关（seeds 42..61 逐局 WIN）· 68 断言 PASS exit 0**——g-01 达成率 1.00、combo 违例 0（逐局审计 55 帧）、红轮接线 2 断言、同帧延迟机制面 0.05ms |
| 部署面 | `export/web/` 21 文件（确定性构建 · landing.html 壳契约 guard PASS · spec.json 直拷 · manifest.json 对账面）；apphost `assets_dir` 定死落点 |
| 门禁 | verify.sh **17 步全 PASS exit 0**（新增 06 资产/07 构建/08 壳契约/09 可玩冒烟）；证据 `../gate-logs/line4-n4-verify-20261026/` |
| 关卡链会话层 | 红轮进入=前关步数 ≤ par（director 谓词透传）；红轮预算 12 步耗尽即 level.fail（超预算无豁免）；连败 2 降级回标准轮（数值全读生成件零手抄） |

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
