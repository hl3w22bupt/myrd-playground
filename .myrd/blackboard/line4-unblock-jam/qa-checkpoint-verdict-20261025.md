# QA 检查点核验结论 + 审查报告 — PL4 spec v0.2（2026-10-25 · 游戏 QA 署名件 · 14:00 检查点）

> 检查点口径：任务书 10/25 四条件「①v0 已交 ②仓库已注册 ③实跑输出 ④资产 id 已冻结」；
> **四齐即开正式审查（一致性/完整性/可玩性/新手引导四清单逐条过）**；过审 → 主策划 approve 锁版本 → deploy 冒烟。
> 本件只判「可测/可判/一致」；**好玩终裁归主人（acc-a3 真人 5 名，机器不代采）**。

## 一、四条件核验

| # | 条件 | 核验证据 | 判定 |
|---|---|---|---|
| ① | v0 已交（六段全文+条目 id+F1–F7 行号+四方对照表） | 送审齐套件 `games/line4-unblock-jam/docs/spec/v0.2-review-submission-20261025.md`（F1–F7 行号表 7/7 + 四方对照表 entities 8/acceptance 9/assets 6 + 六段全文=契约件单源）；契约件 `.myrd/spec/line4-unblock-jam/design-spec.json` 链 v2 `cmvlrc0ma001tm94ialxeykjn` **approved（平台 GET 200 实测，六段零漂移 7/7 段 MATCH）** | ✅ 齐 |
| ② | 仓库已注册（QA/美术可达） | 注册=黑板登记制（判例同型）：子黑板 `.myrd/blackboard/line4-unblock-jam/`（三件套+本 QA 件+QA 七条核销表）+ 顶层 README 产品线表 PL4 行 + 工程 `games/line4-unblock-jam/`（README 转真顺序备忘）。QA/美术前两轮已凭同一批锚点交付（七条核销表 / desk-check 14/14）——**通道在位且已被两方实际使用** | ✅ 齐 |
| ③ | 实跑输出（契约断言实跑随审） | `gate-logs/line4-gate-20261025/`：01 draft 锚 fail-closed（SPEC_NOT_APPROVED exit 1 红线实证）→ 05 解除态过渡 → 06 **8 条 checks 转真实跑 46 断言全 PASS exit 0** → 07 **契约门禁 29 PASS / 0 FAIL exit 0（approved 一致）** → 08 smoke 4/4 → 09/10 port-gate web/wx 硬检 0 FAIL + **P-02 转 ✓**。两态对照（draft 拒绝/approved 放行）即「pending 单列不计绿」红线的完整机判留痕 | ✅ 齐 |
| ④ | 资产 id 已冻结 | 风格卡 v1 四要素冻结（黑板 assets.md §一：8 色白名单/光照/线条/比例）+ 资产 id 清单 a01–a06（id↔落点路径↔expect 三联）；theme.ts ≡ spec palette ≡ 风格卡**三面同值机判**（acc-05 断言 + port-gate P-04）；a04-guide-hand ↔ g-01 判据编号挂接（送审件四方表 2.4 行） | ✅ 齐 |

**检查点结论：四条件 4/4 齐 → 正式审查开启。**

## 二、四清单审查（逐条过）

### 清单 A｜一致性（spec ↔ 工程一致面）— 全过
- 契约门禁 **29 PASS / 0 FAIL exit 0**（数值 11 键工程对应 · 8 条 check 依赖在位 · a3 命令型）。
- telemetry 6 键三面全等（spec 三列 ≡ 生成件 ≡ hub；旁路键 fail-closed 实证）。
- palette 8 色三面同值（spec ≡ theme.ts ≡ 风格卡 v1）。
- 四实体实存核对：lot/car/exit/director 四件落点=spec 路径写死位（`src/entities/*.ts`、`src/levels/director.ts`），与四方对照表 2.2 逐条对名。

### 清单 B｜完整性（六段+条目+齐套件）— 全过
- 六段齐备（meta/world/entities/levels/numeric/acceptance + assets 段）· schema v0 校验（入链 201 实证）。
- 条目 id 全集：entities 8 / levels 3 关 12 elements / acceptance 9（8 auto+1 manual）/ assets 6——四方对照表逐条带文件路径+测试文件+资产 id。
- 链面：v1 superseded + v2 **approved 唯一**（同 scope 仅 2 版，无旁支）。

### 清单 C｜可玩性（玩法成立面 · 机器可判部分）— 全过（真人面单列）
- 谱系 20 局（seeds 42..61）**全部可解机判**（BFS 解序列稳定 · acc-01 逐字节双跑）。
- 红轮三边界机制面成立（enter/clear/fail + 连败 2 降级，acc-04 三谓词逐条过）。
- 计数控名人+pending 恒等：acc-03 五断言 + 20 局事件流审计 violations=0。
- **边界注明**：「好不好玩」不在本清单判定范围——acc-a3 重开意愿（真人 5 名 ≥4）**终裁归主人**，样本 0/5 待采，样本不足=未判定·待采（不烧冻结余量）。

### 清单 D｜新手引导（首 60s 面）— 全过
- g-01 三步判据（首次拖动→首次驶出→通关）+ 60s 窗口=3750 帧换算机判。
- bot 面 20 局达成率 **20/20 ≥0.90**（判据 ≥18/20）。
- 判据编号挂资产编号（g-01→a04-guide-hand）spec.assets 原文锚实证。
- dev HUD F1~F4 读数面在位（scaffold 交付件 · F 面=first60s 读数）。

## 三、QA verdict（检查点结论）

1. **四条件 4/4 齐 → 正式审查通过**：一致性/完整性/可玩性(机器面)/新手引导四清单逐条过，零打回项。
2. **approve 已成立**：链 v2 `cmvlrc0ma001tm94ialxeykjn` 平台侧 approved（2026-10-24T08:43:25.904Z，主人拍板；本轮 GET 200 实测回写本地账面）——**版本锁生效**。
3. **过审后链条已走**：契约 29/29 全绿 → smoke 4/4 → port-gate web/wx PASS（P-02 ✓）= deploy 冒烟输出（gate-logs 11 件原始输出随审）。
4. **单列待采（不计绿不阻塞）**：acc-a3 真人 5 名（0/5 · 终裁归主人）；wx 宿主面 host-wx/（移植轮落地件，P-06-wx 预检提示）。

——游戏 QA（检查点核验 + 四清单审查签）· 2026-10-25
