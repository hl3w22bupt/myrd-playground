# 阻塞项黑板 — line4-unblock-jam（第四产品线）

> 更新时间：2026-10-25（**10/25 交付包轮：链 v2 approved 实测回写 + 审查链开审**）｜ 负责人：主策划（整合）/ 游戏程序 / 游戏美术 / 游戏 QA ｜ 下一步：链 v2 `cmvlrc0ma001tm94ialxeykjn` **链上已 approved（主人 2026-10-24T08:43:25Z 实测）** → 本轮四清单开审 + 本地账面回写 + deploy 冒烟；灌实玩法轮随 approve 解锁

## 当前基线（2026-10-25 · 主策划整合刷新）

| 项 | 值 |
|---|---|
| 黑板路径 | `.myrd/blackboard/line4-unblock-jam/`（三件套 · **黑板登记块名写死于此**，spec 缺陷⑥核销锚点） |
| spec 版本号 | **链 v2 `cmvlrc0ma001tm94ialxeykjn` = approved（唯一现行，平台 GET 200 实测 2026-10-25）**；链 v1 `cmvlpx0uf0019m94iyuroz578` = superseded（同 GET 实测）；同 scope（projectId `cmto0g28j0002m9sqnvjdy8o7`）链上仅此 2 版，**approved 唯一性成立**。approve 动作发生于上轮 run 收口（02:13Z）之后、平台侧 `updatedAt=2026-10-24T08:43:25.904Z`（北京时间 16:43）——判定为**主人亲自链上拍板**；本地导出件此前停留在 draft 锚，本轮回写（spec 六段本体逐字节零漂移机判 PASS，仅 status/updatedAt 两锚更新） |
| 当前分支与续接 | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `6b51102`（本轮开工 HEAD）；git fetch 实测远端仅 `origin/main`（孤儿快照线 merge-base=∅ → 沿 10/16 判例不并入，无 rebase，判例维持） |
| 平台 API | `http://localhost:3111` 本轮实测可达（/api/v1/health 200 · projects 21）；鉴权 = `MYRD_TOKEN` Bearer + cookie 双通道（/api/v1/auth/me 200 · admin 代行身份）；GET 回查 200 留痕 |
| 产线 | ts-canvas 判例平移 · 零外部贴图 · 零 npm 依赖 |
| 今日主线 | P0-1 PL4 审查链（四条件核验 → 四清单开审 → approve 已成立回写 → deploy 冒烟）；P0-2 主人升级件×2；P0-3 PL2 收口跟踪；P1-4 PL3 仓库注册+资产核对；P1-5 轮末登记 |

## 10/25 交付包轮（2026-10-25 · 主策划署名 · 逐节点落盘）

| 节点 | 交付 | 状态 |
|---|---|---|
| N0 开工前置 | 黑板开工登记 + 链面实测（approve 成立实证 + 六段零漂移）+ 分支续接核实 | ✅ 本区段 |
| N1 P0-1 策划件 | 四方对照表（条目 id→文件路径→测试文件→资产 id）+ F1–F7 原文行号表 | ✅ `games/line4-unblock-jam/docs/spec/v0.2-review-submission-20261025.md` |
| N2 P0-1 程序件 | 契约断言两态实跑（draft fail-closed exit1 → approved 解除）+ 仓库注册登记（黑板登记制） | ✅ gate-logs/line4-gate-20261025/01..07 |
| N3 P0-1 QA 件 | 检查点四条件 **4/4 齐** + 四清单逐条过（零打回） | ✅ `qa-checkpoint-verdict-20261025.md` |
| N4 P0-1 approve 回写 | REVISIONS.md 补第 3 行（approve 已成立·version 不变）+ design-spec.json status 锚 draft→approved + spec-data 重生成 | ✅ |
| N5 P0-1 过审后链条 | 四实体灌实（lot/car/exit/director）+ 8 条 checks 转真（46 断言 PASS）+ 契约门禁 **29/0 exit 0** + deploy 冒烟（smoke 4/4 + port-gate web/wx P-02 ✓） | ✅ gate-logs 08..10 |

> **14:00 检查点结论：四条件 4/4 齐 → 正式审查通过 → 链 v2 approved 版本锁生效 → 过审链条（灌实+门禁+冒烟）当日走完。**
> 单列待采（不计绿不阻塞）：a3 真人 5 名（0/5 · 终裁归主人）· wx 宿主面 host-wx/（移植轮落地件）。

## 续接核实轮（2026-10-24 · 游戏程序署名件）

前轮（`4f4053f` 包1五件+美术三件 / `aff6fd0` 包2包3+轮末收口）产物逐项机核，**全部复核成立，零重复实现**：

| # | 核实项 | 结果 | 证据 |
|---|---|---|---|
| 1 | spec 契约件 ↔ 生成件单源 | `src/generated/spec-data.mjs` 6 键 ≡ `numeric.telemetry` 三列逐键全等；锚 `cmvlpx0uf0019m94iyuroz578@v1:draft` | `02/03-port-gate-*.log` P-05 ✓ |
| 2 | 计数控名人 + pending 恒等机制面 | `src/kernel/session.ts` 唯一所有权 + `settleExitFrame()` 唯一连击增量通道，pending/cancel 零增量 | `01-scaffold-smoke.log` 面② ✓ |
| 3 | dev HUD F1~F4 读数面 | F1 事件/g-01 三步 + F2 局态/红轮预算 + F3 判读证据（N=20/seeds 42..61）+ F4 测量口径，数值锚全走生成件零手抄 | `src/dev/hud.ts` 静态核对 |
| 4 | 构建 sha 指纹 | 首笔锚 `8d345e6` → 本轮重锚 `aff6fd08b5e8`（自指单行滞后=已披露惯例） | `00-build-info-reanchor.log` |
| 5 | 契约 fail-closed 红线 | draft → `SPEC_NOT_APPROVED · exit 1` 机判复现（预期正确行为） | `04-contract-draft-failclosed.log` |

**本轮修复（1 项，工具面）**：`tools/port-gate-checklist.mjs` `--target` 缺省解析错位（未传参时 `indexOf+1=0` 把 node 二进制路径当 target，门禁标签失真）→ 已修 + web/wx 两口径复跑验证（PORT-GATE PASS exit 0）。

**零新增阻塞**；审查通过版落地轮（玩法转真 + 8 条 auto check 转真 + 20 冒烟局）待 L4-1 approve 后开工。

## 阻塞登记（编号制）

| # | 事项 | 负责人 | 状态/解除判据 |
|---|---|---|---|
| L4-1 | **spec v0.2（链 v2）正式审查（approve）** | 主人 | **已解除（2026-10-25 实测回写）**：主人 2026-10-24T08:43:25.904Z 平台侧拍板 approve（GET 200 实证）；10/25 检查点四条件 4/4 齐 + 四清单零打回 + 契约门禁 29/0 全绿 = 审查链当日走完；版本锁=链 v2 approved 唯一 |
| L4-2 | 工作名与视觉方向拍板（W-L4-1/W-L4-2） | 主人 | 《挪出一条路》为工作名占位；风格卡 v1 已冻结（拍板可改，改动走 revision） |
| L4-3 | a3 真人面（好玩终裁 5 名真人） | 主人+QA | 前置=可玩面 LIVE；机器不代采 |
| L4-4 | **P3 文字面指代缺陷（美术 desk-check 发现，非阻塞）**：spec acc-02 statement 与 QA 核销表 F1 行引用「assets.md §四 五要素」，但 §四 无「五要素」词条（表头=通道/预算/硬顶） | 主策划（登记）· 程序（按主人驳回反馈②代办执行，措辞取登记件 Option A） | **已解除（2026-10-24）**：链 v2 `cmvlrc0ma001tm94ialxeykjn`（v0.2）取「acc-02 改三通道规格」选项落链（POST /revisions **201** 实证）+ QA 核销表引用行同步。证据 `.myrd/spec/line4-unblock-jam/spec-v0.2-revision-response.json` |

> 无团队侧阻塞。L4-1/L4-2/L4-3 三项均主人侧动作，带证据升级不催办；L4-4 已解除（勘误落链，同批驳回反馈②）。

## QA verdict 五条 + owner（2026-10-25 · 检查点核验产出 · 明日晨会逐条对）

| # | verdict 项 | owner | 状态/解除判据 |
|---|---|---|---|
| 1 | PL4 acc-a3 真人面（0/5 · 好玩终裁归主人） | 主人（圈定 5 名）+ QA（记录卡） | 待采；样本不足=未判定·待采，不烧冻结余量 |
| 2 | PL4 谱系参数 PEND-待校准（par 带/密度带） | 游戏策划（revision 提案） | 前置=首批真人冒烟数据回流 → 走 revisions 校准（数值链五处一次同步） |
| 3 | PL4 wx 宿主面 host-wx/（移植轮落地件 · P-06-wx 预检提示） | 游戏程序 | 移植轮开工项；web/wx port-gate 硬检已 0 FAIL |
| 4 | PL3 试玩反馈 + 5 局真人样本（升级件①已发） | 主人（已升级） | 入口存活；回流走既定版本链，PL4 主线不受影响 |
| 5 | **PL2 wx 门禁复跑记录 pending（独立跟踪 · P0-3 QA 结论）** | 游戏程序（R3 复跑批一次做齐） | 10/18 后 wx 侧复跑记录**不存在**（QA 核原文：dy 口径四段 + 终审件 L20「G-4 维持」+ 本仓 git 零命中）；pending 登记，解除=R3 复跑批产出 wx 口径实跑档案；凭证（G-2）未到位前止步材料清单 |

## PL5 预研触发器（2026-10-25 登记 · 状态：**已触发第一步**）

| 步 | 动作 | 触发条件 | 状态 |
|---|---|---|---|
| T1 | PL4 过审 | 链 v2 approved | ✅ **已成立**（2026-10-24 主人拍板，10-25 实测回写） |
| T2 | 次日（10/26）带数据出处新鲜简报 | T1 成立 | ⏳ 晨会交付（主策划） |
| T3 | 策划先写调研问题清单 | T2 简报在手 | ⏳ 排 T2 后 |
| T4 | 选型三问（差异点/成本/变现三列） | T3 清单在手 | ⏳ |
| T5 | QA 对最新款二次会签避让（排除区核对） | T4 选型候选出 | ⏳ |

> 节奏纪律：预研不开题不立新游戏（主人立项权红线）；PL4 过审后主线=灌实轮收尾 + 真人样本采集，PL5 预研并行不占工程面。

## 工作流 deploy 节点交接面（2026-10-25 · 主策划→工作流）

- **契约件已预置**：`games/line4-unblock-jam/apphost.toml`（name/runtime=node20/health/assets_dir=export/web 四键，stack-tower 判例同型）；**部署通道预检在位**：`PLATFORM_API_URL=http://localhost:3111` + `MYRD_TOKEN`/`MYRD_TEAM_ID`/`MYRD_RUN_ID` 均实测可用（本轮 API 通道全程 200）。
- **deploy 冒烟输出（今日）**：smoke 4/4 + port-gate web/wx 硬检 0 FAIL（gate-logs 08..10）——部署面健康证据绑 HEAD `402919f`。
- **待触发**：export/web 首批导出面产出（实现轮）→ 工作流 deploy 节点以本件 manifestPath 真实上线 → 喂 a3 真人样本采集窗开。**apphost 预置不冒领部署**（脚手架期零 UI 无线上面）。
