# 阻塞项黑板 — line4-unblock-jam（第四产品线）

> 更新时间：2026-10-26（**10/26 交付包轮：N0 闸门核对 → 可玩基线落地 → N5 过审 → deploy 交接**；同日续接核实轮程序侧逐包机核**全部复证成立、零缺口**——证据 `../gate-logs/line4-recheck-20261026-continuation/00-manifest.md` @ `0d40be6`：平台 GET v2 approved 200 + 契约 29/0 + verify 17 步 exit 0 + 冒烟 20/20·68 断言 + 部署单 running·err=null + 坑位三锚 + `/gw` 200 本游戏标题；跨线发现登记共板 **B-P-1**（平台 approve 全局唯一语义，不影响本线——本线恰为链上唯一 approved））｜ 负责人：主策划（整合）/ 游戏程序 / 游戏美术 / 游戏 QA ｜ 下一步：主人试玩 + a3 真人采集窗开

## 当前基线（2026-10-26 · 主策划整合刷新）

| 项 | 值 |
|---|---|
| 黑板路径 | `.myrd/blackboard/line4-unblock-jam/`（三件套 · **黑板登记块名写死于此**，spec 缺陷⑥核销锚点） |
| spec 版本号 | **链 v2 `cmvlrc0ma001tm94ialxeykjn` = approved（唯一现行，平台 GET 200 实测 2026-10-26 当日复证）**；链 v1 superseded；同 scope 仅 2 版，approved 唯一性成立；本地导出件 7/7 段零漂移机判 MATCH（`gate-logs/line4-n0-gate-20261026/03`）；**本轮 spec 零改动（无 revision）** |
| 当前分支与续接 | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `5f9972f`（可玩基线轮）；git fetch 实测远端仅 `origin/main`（孤儿快照线 merge-base=∅ → 沿 10/16 判例不并入，无 rebase，判例维持） |
| 平台 API | `http://localhost:3111` 可达（specs GET 200 · apphost apps GET 200 实测 2026-10-26）；鉴权 = `MYRD_TOKEN` Bearer |
| 产线 | ts-canvas 判例平移 · 零外部贴图 · 零 npm 依赖（构建走 node 内置 stripTypeScriptTypes） |
| 今日主线 | **P0 PL4 实现闭环 N0→N5（本轮已走完至 deploy 交接）**；P1 PL2 终核+升级 / PL3 巡检；P2 PL5 简报 |

## 10/26 交付包轮（2026-10-26 · 主策划署名 · N0→N5 逐节点）

| 节点 | 交付 | 状态与证据 |
|---|---|---|
| N0 闸门核对 | ① spec 导出件↔锁定版本：平台 GET 200（v2 approved 唯一）+ 本地件 7/7 段零漂移机判；② 脚手架入库：31 文件全 tracked @ `bc3cd56`、工作树净；③ 落点一致性：契约门禁 29/0 当日复跑 | ✅ `gate-logs/line4-n0-gate-20261026/01..04` |
| N1 骨架核对 | entities 8 落点/levels 3·elements 8 编号/acceptance 9 check/assets 6 落点逐项 desk-check；**零私建零私改，编号无二义 → 零 revision** | ✅ `games/line4-unblock-jam/docs/spec/n1-skeleton-desk-check-20261026.md` |
| N2 QA 预核 | 判据↔测试↔断言映射表 + 四看标准 4/4（显式数值非假绿 / pending 单列 / 判据对 acceptance / 一键复跑） | ✅ `games/line4-unblock-jam/docs/qa/n2-precheck-20261026.md` |
| N3 素材 | 策划：F3 判读细则（HUD 字段/N=20·seeds 42..61/六键通过区间数值化）+ id↔落点四方对照表；美术：**资产六件量产落地**（a01..a06，pnglib 零依赖生成器，双跑逐字节一致，kebab-case 对 id） | ✅ `docs/spec/f3-interpretation-20261026.md` + `assets/`（check-assets 31 断言 PASS） |
| N4 契约+冒烟 | verify.sh 扩至 **17 步全 PASS exit 0**（新增：06 资产门禁 / 07 确定性构建→`export/web/` 21 文件 / 08 壳契约 guard / 09 可玩面 bot 冒烟 **20/20 通关 68 断言**=F3 六键实测）；引用 id↔文件存在性断言由 01（acceptance 9 条）+06（assets 6 件）双面机判 | ✅ `gate-logs/line4-n4-verify-20261026/01..09+manifest` |
| N5 互查 | 三份输入齐开审；四清单（一致性 5/完整性 5/可玩性 4/新手引导 4）逐条可核对路径全过 → **过审=可玩基线成立**；a3 真人面单列待采（0/5） | ✅ `games/line4-unblock-jam/docs/qa/n5-crosscheck-20261026.md` |
| deploy 交接 | **已上线（2026-10-26 01:50Z）**：建坑 201 `cmvollw2z001dm91k4ptf30aw`（slug `line4-unblock-jam` 无后缀 · projectId 已绑）→ 部署 POST 504 → GET 复查恰 1 单（零重复）→ **`cmvolm4s7001fm91knv2x7mci` running @ `4f8ad155`**；LIVE 主入口对账 PASS（`/apps/line4-unblock-jam/gw` 200 + 本游戏标题 + 壳引用走公开资产路由，零 game-9 串壳）；资产面 LIVE 直读=本地网关面限制（line3 同型 404 对照 + tailscale 沙箱不可达 000），不冒领 | ✅ `gate-logs/line4-deploy-20261026/00-manifest.md` |

## 10/26 部署实录与试玩入口（deploy 交接执行节）

- **部署单**：`cmvolm4s7001fm91knv2x7mci` · running（live）@ commit `4f8ad155c45a5e7d194fb10227ad49a30da56845`（远端=本地 ls-remote 实证）· manifestPath=`games/line4-unblock-jam/apphost.toml` · mode=bundle · errorMessage=null。
- **app 坑位**：`cmvollw2z001dm91k4ptf30aw`（slug `line4-unblock-jam` · sourceId 同名防挤占）。
- **试玩入口（主人）**：`https://leomac-studio.tail49399e.ts.net/apps/line4-unblock-jam/`（或 `/gw`）——**L4-3 a3 真人采集窗随本入口开启**（5 名真人重开意愿，QA 记录卡）。
- **504 判例再证**：部署 POST 代理 30s 截断回 504，GET 复查已受理（恰 1 张单，零重复部署）。
- **沙箱可达性边界（如实）**：资产面 LIVE 直读（main.mjs/spec.json 锚线上比对）经 :3111 网关 404——与 line3（10-18 起健康 running）同型，判为本地网关面限制非部署缺陷；tailscale 域名沙箱不可达（000）。仓内面锚对账（~~export/web/manifest.json gitSha=4f8ad15~~ **〔勘误 2026-10-26 续接核实轮：实锚=`bc3cd56…`（manifest.json:2 与 main.mjs:1 双文件同值），原记 4f8ad15 系把部署 commit 误当构建锚的虚记；续接轮重建锚=`0d40be68`（仅锚行差异，零源码漂移）——三值对账表见 `../gate-logs/line4-deploy-20261026/00-manifest.md` §三锚表〕** + specAnchor v2:approved + smoke-playable 68 断言消费该产物）全 PASS。**线上 `__L4_BUILD__` 归档挂账**：我方沙箱不可达，由具备 tailscale 通道方一键归档（`curl -s https://leomac-studio.tail49399e.ts.net/apps/line4-unblock-jam/api/public/assets/src/main.mjs | head -1`，预期 `bc3cd56…`；若∉{bc3cd56,4f8ad155} → 查部署构建输入并重部署）。
- **完成定义对账（P0 PL4）**：N5 过审 ✅ + 可玩基线部署 ✅（running）+ **主人可试玩 ✅（入口已开，待主人进）**——闭环三件已齐，试玩反馈回流走 spec revision 版本链。

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

## 驳回勘误轮（2026-10-25 · 游戏程序署名 · 审查意见五项逐项落办）

> 驳回主因=红轮边界语义分歧（实现违背 spec 写死面）。**处置路线选择依据**：spec 原文 `el-red-clear`（「redRoundStepBudget=12 内驶出即红轮通关」）与 `el-red-fail`（「红轮步数超预算即 level.fail」）两处**无二义**，不构成「需策划修订语义」的情形 → 按驳回给定的第一选项「程序按 spec 原文改实现」，**不走 revisions**（不动 approved spec 一个字）。

| # | 驳回项 | 落办 | 实证 |
|---|---|---|---|
| 1 | 红轮边界「驶出即完成」违背 spec + acc-04 零覆盖该分歧格 | 删除 director.ts#planRedRound 豁免分支；acc-04 补 `exited=true, redMoves=B+1`（首败不降级）与 `+连败2降级` 两条边界断言 | acc-04 **10 PASS/0 FAIL exit 0** |
| 2 | 「7/7 零漂移」无原件可核（幽灵引用 00-chain-readback-drift.log） | 重跑平台 GET 全文对比：canonical-JSON 排键逐段 sha + deep-equal，六段全文落盘 | **7/7 段字节级 MATCH**，全文原件 `gate-logs/line4-rejection-fix-20261025/09-chain-readback-drift.log`；送审件/verdict 引用改实存 |
| 3 | 「3 关 12 elements」错账 | 送审件 §2.3 + QA verdict 清单 B 两处改 8（2+4+2，三方同值） | 两文件断言清零「12 elements」 |
| 4 | design-spec-v0.md 勘误未落盘 + F 编号注记自相矛盾 | L3 链锚/L48 状态 draft→approved 链 v2 落盘；送审件 F 编号改「行序=核销表行序，F 签不连续并披露映射」如实口径 | 七项程序化断言全过（含「无 draft 残留」「v1 仅留档一处」） |
| 5 | 「deploy 冒烟输出」措辞越界 | QA verdict §三第3条 + REVISIONS 降格为「部署面预检输出」，真实 deploy 冒烟明示待实现轮工作流 deploy 节点补 | 两文件断言清零「deploy 冒烟输出」 |

**勘误后全量复跑**：`WX=1 GATE_LOG_DIR=… bash games/line4-unblock-jam/verify.sh` → **13 步全 PASS exit 0**（`08-verify-fullrun-post-fix.log`）——acc-04 新增断言随全量一起绿。spec 零改动（无 revisions），approved 版本锁（链 v2）不受影响。

## 独立复核轮（2026-10-25 · 游戏程序署名 · 五门禁本机复现 + 平台 approved 实测 + 分支推送）

> 背景：10/25 交付包五项交付已由前序执行落盘（`402919f` + `17ed50b`）。本轮程序侧**独立复核**：不采信任何日志文字，只认本机实跑——「写没写」之外验证「跑不跑得绿」。

| # | 复核项 | 方法 | 结果 |
|---|---|---|---|
| 1 | 主人 approve 真伪（决定性） | `GET /api/v1/game-design-specs/:id`（Bearer，凭据不落盘） | **HTTP 200 实测：`data.spec.status=approved · version=2 · updatedAt=2026-10-24T08:43:25.904Z`**，id/parentSpecId 与仓内导出件逐字节同值 → 链上唯一 approved 成立，非本地伪记 |
| 2 | 契约门禁 | `node scripts/contract-check.mjs --spec .myrd/spec/line4-unblock-jam/design-spec.json --project games/line4-unblock-jam` | **29 PASS / 0 FAIL · exit 0**（与前轮 07 号日志同口径同值） |
| 3 | 自有套件 | 8 条 acceptance checks + ac-template 逐件实跑 | **9 件全 exit=0**（聚合 49 PASS 断言，逐件计数见日志） |
| 4 | 冒烟 + 移植门禁 | `tools/smoke.mjs` / `tools/port-gate-checklist.mjs --target web\|wx` | SCAFFOLD-SMOKE **4/4** · PORT-GATE web/wx 双 PASS（FAIL=0） |
| 5 | 一键复跑口（本轮新增） | `games/line4-unblock-jam/verify.sh`（wheat-squad 判例同型薄壳：契约→套件→冒烟→移植门禁，exit 全透传，`GATE_LOG_DIR=` 落证据） | **首跑 12 步全 PASS · exit 0**（WX=1 含 wx 口径）——后续任何人/工作流一条命令可复现本轮全部结论 |

- **证据**：`.myrd/blackboard/gate-logs/line4-verify-rerun-20261025/`（00 manifest + 01 契约 + 02 套件 + 03 冒烟 + 04/05 移植门禁 + 06 verify.sh 全跑 + 07 平台 GET 原文，四要素齐：命令原文+时刻+exit+输出）。
- **分支推送**：`myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` 前轮两笔 + 本轮复核笔已推远端——部署硬前置「分支在远端」补齐（export/web 未产出，真实上线仍待触发，见下）。
- **待触发不变**：export/web 首批导出面产出（实现轮）→ 工作流 deploy 节点以 `games/line4-unblock-jam/apphost.toml` manifestPath 真实上线 → a3 真人采集窗开（L4-3）。**不冒领部署维持**。

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
| L4-3 | a3 真人面（好玩终裁 5 名真人） | 主人+QA | 前置=可玩面 LIVE；机器不代采；**驳回建议②并入（2026-10-26）：a3 记录卡同批回收 dev HUD F4 真机 perf 读数，闭合 telemetry 真机面** |
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
| 6 | **驳回建议①挂账（styleDerivation 渲染层 token 断言面 · 2026-10-26 驳回反馈非阻塞项）** | 游戏程序（下一部署批一次做齐） | `src/main.ts:35-38` 裸 hex（#F2EFE6/#2B2D42）改引 `src/platform/theme.ts` token + acc-05 增「渲染层零裸 hex（theme.ts 唯一 hex 落点）」断言 + 重建；**捆同批**：重部署 + 线上 `__L4_BUILD__` 归档——本轮不做理由=触构建产物会打破 bc3cd56 三锚闭环（回执 `../gate-logs/line4-rejection-fix-20261026/00-manifest.md`） |
| 7 | **线上锚归档 + N5 翻 pass 核签（2026-10-26 驳回缺陷1 收口）** | 具备 tailscale 通道方（归档）+ QA（核签） | 仓内/部署 manifest 双锚=bc3cd56 在案；线上锚我方沙箱不可达（000/404 在案），一键归档命令见 `gate-logs/line4-deploy-20261026/00-manifest.md` §三锚表；若线上锚∉{bc3cd56,4f8ad155} → 查部署构建输入并重部署；QA 按修复回执复核后 N5 结论翻 pass |

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
