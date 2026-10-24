# 阻塞项黑板 — line4-unblock-jam（第四产品线）

> 更新时间：2026-10-24（续接核实轮）｜ 负责人：主策划（整合）/ 游戏程序（本轮门禁复跑）｜ 下一步：spec v0 已转主人正式审查（**approve 归主人，唯一待决**）

## 当前基线（2026-10-24 · 续接核实轮刷新）

| 项 | 值 |
|---|---|
| 黑板路径 | `.myrd/blackboard/line4-unblock-jam/`（三件套 · **黑板登记块名写死于此**，spec 缺陷⑥核销锚点） |
| spec 版本号 | 链 v1 `cmvlpx0uf0019m94iyuroz578` **draft**（禁覆盖）· QA 七条缺陷 7/7 核销 → **转主人正式审查**；审查通过前不作契约输入（fail-closed 已机判复现） |
| 当前分支与续接 | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `aff6fd0`（本轮门禁取证 HEAD）；远端仅 `origin/main`（孤儿快照线 merge-base=∅ → 沿 10/16 判例不并入，无 rebase） |
| 平台 API | `http://localhost:3111`（上轮实测可达；本轮未触碰链面，零写入） |
| 产线 | ts-canvas 判例平移 · 零外部贴图 · 零 npm 依赖 |

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
| L4-1 | **spec v0 正式审查（approve）** | 主人 | QA 七条缺陷核销后转正式审查即升级；approve 前零玩法逻辑零 contract 断言（红线） |
| L4-2 | 工作名与视觉方向拍板（W-L4-1/W-L4-2） | 主人 | 《挪出一条路》为工作名占位；风格卡 v1 已冻结（拍板可改，改动走 revision） |
| L4-3 | a3 真人面（好玩终裁 5 名真人） | 主人+QA | 前置=可玩面 LIVE；机器不代采 |

> 无团队侧阻塞。以上三项均主人侧动作，带证据升级不催办。
