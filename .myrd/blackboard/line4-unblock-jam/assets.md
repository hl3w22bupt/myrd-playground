# 资产清单黑板 — line4-unblock-jam《挪出一条路（工作名待主人定）》（第四产品线）

> 更新时间：2026-10-25（**10/25 交付包轮 · 链 v2 approved + 资产 id 冻结核验通过**）· 负责人：游戏美术 ｜ 下一步：**过审版落地轮开首批资产生成**（a01–a06 程序化 · manifest 逐件 hash · 重生成 hash 不变机判）；asset id↔落点↔expect 三联冻结维持（a04↔g-01 挂接实证）

---

## 一、风格卡 v1（冻结 · 2026-10-24 · 调色板写死色值 + 光照/线条/比例取值）

> 四要素承 wheat-squad / line3 判例口径；**色值改动必须走 spec revision（palette 块），禁止两头各改各的**。
> 单源=本卡；spec numeric.palette 与本卡逐字一致（机判键集合全等）。

### 四要素（冻结值）

| 要素 | 冻结取值 |
|---|---|
| **调色板（8 色白名单）** | `#F2EFE6` 地面底（米白）· `#D9D2C5` 网格线/障碍（浅灰米）· `#2B2D42` UI 主字/描线（墨蓝）· `#111111` 阴影/文字（黑）· `#EF4444` 目标车/红轮警示（红）· `#F59E0B` 普通车暖档（橙）· `#10B981` 普通车冷档/成功反馈（绿）· `#3B82F6` 普通车冷色档/UI 次（蓝） |
| **光照** | 无光源平面色块（零渐变零高光）；唯一立体暗示=1 档正下投影（`#111111` @ 12% alpha，偏移 0/2px） |
| **线条** | 无描边圆角块（车/障碍）；圆角半径两档冻结：车块 8px、UI/障碍 4px；网格线 1px 实线 `#D9D2C5` |
| **比例** | 俯视 2D 正交；车块 = 1×2 网格（俯视小轿车基准）；网格单元 48px 设计基准（等比缩放适配）；出口门 = 2 格宽开口高亮条 |

### 视觉基调三词

极简 / 高对比 / 轻俯视（承简报 v2 §六候选②「极简色块俯视风：车=圆角块 + 地面网格浅色，拥挤感靠密度不靠描边」）

### 一致性门禁

- 色值白名单外零取色（渲染层只读 theme token，token 单源=`src/platform/theme.ts`，值=本卡调色板）。
- 程序化生成、零外部贴图；manifest 逐件 hash，重生成 hash 不变（确定性判例）。

---

## 二、首批资产清单（宁少勿杂 · 编号 → kebab-case 落点 · 逐个对应 spec id）

> 生成时机=spec 审查通过后；生成前本清单为**规划落点**（零图）。

| # | spec 资产 id | 落点（kebab-case） | 内容 | 生成器 |
|---|---|---|---|---|
| a01 | `a01-lot-tiles` | `games/line4-unblock-jam/assets/a01-lot-tiles.png` | 地面底+网格+障碍块（1 张 48px 平铺图集） | `tools/gen-assets.mjs` |
| a02 | `a02-car-set` | `games/line4-unblock-jam/assets/a02-car-set.png` | 车块 4 色档（红/橙/绿/蓝）×1×2 格，圆角 8px | 同上 |
| a03 | `a03-exit-gate` | `games/line4-unblock-jam/assets/a03-exit-gate.png` | 出口门高亮条（2 格宽，绿/红双态） | 同上 |
| a04 | `a04-guide-hand` | `games/line4-unblock-jam/assets/a04-guide-hand.png` | 引导手指+滑动箭头（首 60s 引导判据 g-01 挂此件） | 同上 |
| a05 | `a05-ui-hud` | `games/line4-unblock-jam/assets/a05-ui-hud.png` | 步数计/连击弹字底板/重开钮（HUD 九宫） | 同上 |
| a06 | `a06-sfx-pack` | `games/line4-unblock-jam/assets/a06-sfx-pack.spec.json` | 音效 3 档（拖动/驶出/通关）规格件 → `tools/gen-audio.mjs` 产 wav | `tools/gen-audio.mjs` |

- 对应关系：a04↔spec 判据 `g-01-first-60s-guide`（引导挂资产编号，QA 缺陷①核销锚点）；a02/a03↔spec entities `e-car`/`e-exit`；a05↔numeric telemetry HUD 读数面。
- 超出本清单的新资产 = 走 revision 增补，不口头扩清单。

---

## 三、对标品风格对照表（四要素参数逐项差异 · 可直接引用进拍板记录差异点栏）

| 四要素 | 《上个了车》（对标1 · 简报 v2 §三候选②行 · D35） | 《挪了下车》（对标2 · 简报 v2 §三候选②行 · D40） | **本作 v1（冻结）** |
|---|---|---|---|
| 调色板 | 高饱和多彩拟物车漆（数十色，3D 材质） | 高饱和多彩 + 场景化地面（停车场主题皮） | **8 色白名单冻结**（上表），单色块无材质 |
| 光照 | 3D 实时光照+阴影 | 3D bake 光照+软阴影 | **无光源平面色块**，仅 1 档 12% alpha 投影 |
| 线条 | 拟物轮廓+高光描边 | 拟物轮廓+描边 | **无描边圆角块**（8px/4px 两档），拥挤感靠密度 |
| 比例 | 3D 透视俯视角（车有体积形变） | 3D 透视俯视角 | **俯视 2D 正交**，车=1×2 格 48px 基准，零形变 |

> 差异点结论（供拍板记录引用）：对标双品均为 3D 拟物路线；本作走 2D 俯视极简色块 = 制作成本降档（零贴图零光照）+ 截图可读性/分享卡卖点 + 与 PL3 高对比判例同构。**风格轴差异成立，非换皮。**

---

## 四、视效预算（按 F4 设备档位 · 首反馈视效 ≤1 帧渲染成本）

> F4 测量口径定死：时钟源=performance.now()（表现层，内核 fixed-step 16ms 累计禁 Date.now）；设备档位=中端机 60fps 基准（stepBudgetMs=16，承 wheat-squad perf-1 / line3 判例）；采样量=冒烟 20 局全量帧 + 真人 5 名（好玩终裁另列）。

| 通道 | 预算（首反馈帧内成本） | 硬顶 |
|---|---|---|
| `vf-car-exit-burst`（首反馈） | 粒子 ≤12 个单色矩形/圆块（零贴图零渐变）+ 1 次出口高亮切换 → **≤1 帧（16ms）内完成发射**，生命 480ms 后出屏裁剪 | 同屏硬顶 24，超限排队丢弃只记遥测 |
| `vf-combo-pop`（连击弹字） | 文字 1 次绘制 + 上浮 240ms；与 burst 同帧时合并批绘 | 每局弹字 ≤10 |
| `vf-level-clear`（通关结算） | 结算页静态色块布局，零粒子 | — |
| 常态帧 | 每帧绘制调用 ≤8、填充 ≤30% 屏、实体峰值 ≤60（车+障碍） | stepBudgetMs=16 |

——游戏美术（风格卡 v1 冻结 · 资产清单 · 对照表 · 视效预算）· 主策划（登记）

---

## 五、美术 desk-check 复证（2026-10-24 · 同文任务书重派轮 · 机判 12/12 全绿）

> 重派协议处置：美术三件已于拍板当日（`4f4053f`）落档，本轮**复证而非重做**——对既有三件 × spec v0（链 v1 draft）× `src/platform/theme.ts`（程序线代写美术 token 件，按跨线纪律逐项复核）做只读机判。**先机判后目检**；机判通过即冻结基准，后续 revision 改色/改清单须重跑本表。

| # | 机判项 | 结果 |
|---|---|---|
| C1 | 风格卡 §一 8 色 ≡ spec `numeric.palette` ≡ `theme.ts PALETTE`（逐字符·保序） | ✅ |
| C2/C2b | 资产清单 6 件 id×file 与 spec `assets[]` 集合全等 + 全 kebab-case | ✅ |
| C3 | 判据 g-01 ↔ 资产 a04-guide-hand 双向挂接 | ✅ |
| C4 | 正反馈三通道名 acc-02 ≡ §四 ≡ e-exit expect | ✅ |
| C5/C5b | F4 三定死（performance.now/中端60fps/N=20）+ 实体帽 60 | ✅ |
| C6/C6b | theme.ts 单源出口在位；渲染/tests 面零裸色 | ✅ |
| C7 | draft 态零图（assets/ 位图数=0 = approval gate 合规态） | ✅ |
| C8/C9 | spec→§一/§三/§四 锚点有效；对标 D35/D40 双源一致 | ✅ |
| F-01 | **发现（P3 · 非阻塞 · 文字面）**：spec acc-02 与 QA 核销表引用「§四 五要素」，§四 无此词条 → 已登记 blockers.md **L4-4**，修订权归主策划（spec 禁覆盖走 revision）；**已核销（2026-10-24 驳回反馈同批）**：链 v2 `cmvlrc0ma001tm94ialxeykjn`（v0.2）acc-02 改「三通道规格（通道/预算/硬顶）」与本节 §四 实际表头对齐 | ✅ 核销 |

- 机判原文：`.myrd/blackboard/gate-logs/line4-art-deskcheck-20261024/`（首跑 C2b 校验脚本自身缺陷已披露留档；**结论以终版 `02-deskcheck-raw.log` PASS=12 FAIL=0 FINDING=1 · exit 0 为准**，黑板编辑后复跑与编辑前一致；中间一次作用域假绿已在 manifest 披露）。
- 本轮零素材产出、零接线：spec draft → 生成前零图（§二 清单为规划落点）；生成器仍为 `tools/gen-assets.mjs`（审查通过轮落地）。

### 链 v2 复证（2026-10-24 · 勘误轮 `17de9b4` 后 · 美术署名）

> 判定前提变化（链 v1 → 链 v2 `cmvlrc0ma001tm94ialxeykjn` v0.2 draft）触发上轮结论重审：desk-check 全表对链 v2 重跑。**PASS=14 FAIL=0 FINDING=0 · exit 0**（终版 `04-deskcheck-chain-v2-final.log`；03 号为校验器提取正则缺陷跑 FAIL，原样留档）。

| # | 复证项 | 结果 |
|---|---|---|
| R1 | **美术五对账面逐字节未漂移**：palette 8 色（C1）/ 资产清单 6 件（C2）/ 三通道名（C4）/ F4 口径+实体帽（C5）/ 对标 D35/D40（C9）在 v0.2 下全绿 —— 印证勘误声明「entities/levels/numeric/assets/world 逐字节不动」 | ✅ |
| R2 | **F-01 解除态机判**（C10）：acc-02=「三通道规格（通道/预算/硬顶）」≡ §四 表头 + QA 核销表 F1 行同步留痕 | ✅ 核销确认 |
| R3 | **生成件锚随链更新**（C11 新增）：`SPEC_ANCHOR.id ≡ spec.id`（cmvlrc0ma…）· 锚 version=2 · build-info sha=`75653d8`（滞后一笔=已披露惯例） | ✅ |
| R4 | **跨线代改复核**（程序 `17de9b4` 改本文件 F-01 行 + QA 表 F1 行）：措辞与 spec v0.2 新文案、L4-4 解除记录三方一致，美术口径成立，本轮认领登记；theme.ts 两 commit blob 哈希全等（`739f1b20`）= 美术 token 件零触碰亲核 | ✅ |
| R5 | draft 态零图合规维持（C7：assets/ 位图数=0）；素材产出仍待 L4-1 对**链 v2** approve | ⏸ 合规态 |

——游戏美术（desk-check 复证）

---

## 六、approved 态复证轮（2026-10-25 · 10/25 交付包任务书重派 · 美术署名）

> 判定前提变化（链 v2 draft → **approved**，主人 2026-10-24T08:43:25.904Z 拍板 · `402919f` 回写状态锚）+ 他线三笔触契约/门禁层（`402919f` 四实体灌实 / `17ed50b` apphost / `ef45565` verify.sh）→ 按跨线重证纪律在当前 HEAD `ef45565` 复证而非重做。**零素材产出、零接线、零源面/spec 触碰**（变更面=本段+证据目录）。

| # | 复证项 | 结果 |
|---|---|---|
| A1 | **desk-check 全表对 approved 态重跑 @ `ef45565`**：PASS=14 FAIL=0 FINDING=0 · exit 0（校验脚本 sha256 对账：v1 原件冻结、本轮 v2 仅 C6b 作用域修正，见下判例行） | ✅ |
| A2 | **前提专检 6/6**：状态锚双 approved（updatedAt=主人拍板时点）· **七段本体对链 v2 入链 payload 逐段深等=上轮结论平移合法** · 跨线头部认领 D3a/b/c · acc-05 语义（engine 零外部贴图 + assets 全件 generated） | ✅ |
| A3 | **verify.sh 全量门禁本机重跑**（WX=1）：12 步全 PASS · exit 0（契约 46 断言 + 8 checks 转真 + 冒烟 + 移植门禁 web/wx）——他线触契约/门禁层后的美术轮重证 | ✅ |
| A4 | **C6b 作用域判例**（发现即披露）：首跑 FAIL=1（car.ts 注释两处 `#EF4444` 引注）→ 目检裁定=注释属可追溯性标注、非渲染取色（可执行面用 `color:'red'`+token 单源；沿「签名/模板字面量不判违规」同构判例）→ v2 剥注释重扫，**非弱检**（可执行面规则零放宽）；v1 首跑原样留档 exit=1，v1/v2 差异全解释 | ✅ 无缺陷登记 |
| A5 | **R5 接替判定**：approved 后零图态语义刷新——「draft 态待审零图」→「**approved 后贴图素材为零仍是合规结论**」（acc-05 验收条原文：源文件零位图构造、资产全部程序化生成入 manifest；勿把 approved 误解为要补产贴图） | ✅ 合规态 |
| A6 | **P1-4 PL3 只读重核对**：game-art 6/6 + style-sketch 3/3 = **9/9 全在位**（basename 归一），与晨间美术署名登记一致零漂移，风格卡 v1 未动 | ✅ |

- **资产 id 冻结态复核**：与 QA 检查点条件④一致——冻结 = 风格卡 v1 四要素 + a01–a06 id↔落点↔expect 三联（a04↔g-01 挂接实证维持）；**冻结 ≠ 已生成**。
- **边界重申**：本轮（10/25 交付包 = spec 质量门锁定）不含首批资产生成；生成 =「过审版落地轮」开工项，届时按 acc-05 走确定性生成器（程序化产出 + manifest 逐件 hash + 重生成 hash 不变），src/ 位图引用持续为零，超出 §二 清单的资产须走 revision 增补。
- 证据目录：`.myrd/blackboard/gate-logs/line4-art-reverify-20261025/`（台账件 manifest-art.txt sha256 前 16 位 `a905ad71eee577ea`；本区约定=工作区本地留存不入 git）（00 HEAD+脚本 sha 对账 · 01/02 desk-check 两跑 · 03 前提专检 · verify/ 13 件门禁原文+manifest · 04 PL3 重核对 · manifest-art.txt 台账）。

——游戏美术（approved 态复证）

### 勘误轮接替复证（2026-10-25 · `c983817` 后 · 美术署名）

> 程序驳回勘误轮（审查意见五项落办）落在本轮 §六 之后：spec **零改动**（链 v2 approved 版本锁不受影响）；五项均程序/文档面，零美术分工项。判定前提未失效 → §六 A1–A6 结论平移，本轮做接替复证三跑 + 一处口径接替认领。

| # | 接替复证项 | 结果 |
|---|---|---|
| B1 | desk-check 全表 @ `c983817` 重跑：PASS=14 FAIL=0 FINDING=0 · exit 0（c983817 未触 assets.md/spec/theme.ts，五对账面零漂移） | ✅ |
| B2 | 前提专检 6/6 · exit 0（QA verdict 被勘误 8 行后，D3b「资产 id 冻结」claim 仍机判成立） | ✅ |
| B3 | verify.sh 全量本机重跑（WX=1）：**13 步全 PASS · exit 0**，含强化后 acc-04 **PASS=10/0**（红轮边界 +2 断言）与 acc-05 **PASS=4/0**（零外部贴图维持） | ✅ |
| B4 | **口径接替认领（驳回项5）**：本文件 §六 A3 行「冒烟」按勘误口径精确化 = SCAFFOLD-SMOKE/门禁套件冒烟，**非工作流 deploy 冒烟**（真实 deploy 冒烟待实现轮 export/web 产出后由工作流 deploy 节点补跑）；美术登记面不含任何部署主张 | ✅ 认领 |

- 证据追加：`…/line4-art-reverify-20261025/`（05 head+desk-check 日志 · 06 前提专检 · verify-c983817/ 13 件门禁原文+manifest；与 05 前跑 verify/（ef45565 锚）分目录并存）。

——游戏美术（勘误轮接替复证）
