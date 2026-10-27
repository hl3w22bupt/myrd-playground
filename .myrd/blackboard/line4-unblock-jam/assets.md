# 资产清单黑板 — line4-unblock-jam《挪出一条路（工作名待主人定）》（第四产品线）

> 更新时间：2026-10-26（**10/26 交付包轮 · 首批资产六件量产落地 + 同文任务书重派·独立实算复证轮 + 跨线重证轮（程序驳回修复后）**）· 负责人：游戏美术 ｜ 下一步：真人试玩反馈回流后按 revision 口径调资产（拟改先登记本卡，防部署巡检误报）；a01–a06 已在盘，独立实算 hash 9/9 全等（§七）· 19f60ce 后全量门禁 17 步复绿（§八）

## ⓪ 首批量产落地（2026-10-26 · 游戏美术 · 逐件登记）

| spec 资产 id | 落点（kebab-case 对 id） | 规格 | sha256（前 12） | 门禁 |
|---|---|---|---|---|
| a01-lot-tiles | `games/line4-unblock-jam/assets/a01-lot-tiles.png` | 144×48 图集 3 帖（地面+网格/网格单元/障碍 4px 圆角） | c280e58157fd | check-assets PASS |
| a02-car-set | `…/assets/a02-car-set.png` | 384×48 四色档 1×2（8px 圆角 + 12% 投影 offset2） | 1fa47319c7ba | 同上 |
| a03-exit-gate | `…/assets/a03-exit-gate.png` | 192×48 双态（绿=通/红=堵，2 格宽） | bc759363500f | 同上 |
| a04-guide-hand | `…/assets/a04-guide-hand.png` | 96×96 引导手指+滑动箭头（g-01 挂件） | 72db18102666 | 同上 |
| a05-ui-hud | `…/assets/a05-ui-hud.png` | 48×48 九宫底板（8px 边距） | 8c57d16133da | 同上 |
| a06-sfx-pack | `…/assets/a06-sfx-pack.spec.json` + `assets/audio/{drag,exit,clear}.wav` 派生 | 3 档（拖动/驶出/通关 · 波形/时长/增益数值化） | fe5858f718b4 | 同上（派生 hash 同锚） |

- 生成器：`tools/gen-assets.mjs`（pnglib 零依赖 · 色值单源=theme.ts · **零噪声零时钟零随机**）；manifest 逐件 sha256：`assets/manifest.json`。
- 确定性机判：同命令重跑整树 diff 逐字节一致 + check-assets 临时目录重生成 hash 全等（31 断言 PASS，`gate-logs/line4-n4-verify-20261026/06`）。
- 口径披露：a01–a06 为**资产管线件**（清单+manifest 对账）；可玩面渲染为程序化 Canvas 直绘（零位图引用，acc-05 机判），web 音效经 WebAudio 合成（参数镜像 a06 tiers）。

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

---

## 七、同文任务书重派轮 · 独立实算复证（2026-10-26 · 美术署名）

> 10/26 交付包已在 `9166bf5` 前轮收口（N0→N5+deploy+逐包机核零缺口），本轮按重派协议处置：**复证而非重做**。新事实核查=零（工作树净 · `gate-logs/` 最新目录即前轮 `line4-recheck-20261026-continuation` · 各线无新登记）。增量动作=前轮未做过的**独立工具链实算**——前轮 hash 证据出自生成链（node:crypto 自算自比），本轮改用与生成器零共享实现的独立工具重算，不与生成器自证互证。

| # | 复证项 | 结果 |
|---|---|---|
| S1 | **独立 sha256 实算**（`/usr/bin/shasum`）× manifest 台账 9 件（a01–a06 本体 + a06 派生 wav×3）：`diff` 空 = **9/9 逐件全等** | ✅ |
| S2 | **PNG 尺寸独立复测**（`/usr/bin/sips` 读 IHDR）：144×48 / 384×48 / 192×48 / 96×96 / 48×48，与 manifest 及 §⓪ 规格逐件一致 | ✅ |
| S3 | **仓内快门禁 check-assets @ `9166bf5` 重跑**：PASS=31 FAIL=0 · exit 0（与 N4 轮 06 号证据同值） | ✅ |
| S4 | **acc-05 美术面扫描**：`src/` 与 `export/web/src/` 位图引用（.png/.jpg/.webp/new Image/drawImage）**零命中**；位图件仅存 `assets/` 管线面 →「管线件对账 + 运行面程序化 Canvas 直绘」口径维持，**位图接线不做**（approved spec acc-05 零外部贴图为冻结面，改口径走 spec revision，修订权归主策划） | ✅ 合规态 |

- **边界重申**：本轮零素材产出、零接线变更、零 spec/theme/玩法触碰；PL2 视觉物料复核（g2-blocks §二）与 PL3 拟改登记面前轮已署名落盘，本轮无美术侧新拟改项。
- 证据目录：`.myrd/blackboard/gate-logs/line4-art-sha-recheck-20261026/`（00 台账 · 01 独立 shasum 原文 · 02 期望/实算双排序件 · 03 空 diff · 04 sips 尺寸 · 05 快门禁 · 06 零位图扫描）。

——游戏美术（重派轮独立实算复证）

---

## 八、跨线重证轮（2026-10-26 · 程序驳回修复 `19f60ce` 后 · 美术署名）

> 判定前提变化（他线 `19f60ce` 驳回修复轮落盘：部署对账证据面两缺陷勘误 + 挂账项①②登记）→ 按跨线重证纪律三件套处置。**本轮改动面=本段+证据目录，零素材产出、零接线变更、零 spec/theme/src 触碰。**

| # | 复证项 | 结果 |
|---|---|---|
| (a) | **spec 链面专检**：无新 revision/新链 —— status=approved · version=2 · 锚 `cmvlrc0ma001tm94ialxeykjn@v2:approved`（main.mjs 实读） | ✅ 前提未变 |
| (b1) | **程序勘误主张亲核**：export/web/manifest.json:2 与 main.mjs:1 双锚同值 `bc3cd5669e…` ——「原记 4f8ad15 系虚记」勘误成立；共板 blockers.md 部署实录勘误句认领 | ✅ |
| (b2) | **theme.ts 零触碰**：blob @`19f60ce` = `739f1b20…` ≡ 10/25 判例值（末次变更仍是 `4f4053f`） | ✅ |
| (b3) | **挂账项①美术预审**（blockers verdict #6 · owner=程序）：main.ts 4 处裸 hex 全部 token 等值（`#F2EFE6`×2≡`PALETTE.ground` · `#2B2D42`×2≡`PALETTE.ink`），白名单外零取色 → **纯引用替换、零视觉漂移，美术口径预审通过**；执行提示：`'#F2EFE6'}cc` 处 alpha 后缀须随替换保留（token 给色值，alpha 属模板面） | ✅ 预审放行 |
| (c) | **全量 verify.sh @ `19f60ce` 重跑（WX=1）**：17 步全 PASS · exit 0（契约 29/0 + 8 checks + 冒烟 + port-gate web/wx + 资产门禁 31/0 + 构建 + 壳契约 + 可玩冒烟）；跑后 build 重写锚 → `git restore` 恢复产物，锚回 `bc3cd56` · 工作树净（沿前轮「跑门禁恢复产物」惯例，三锚闭环未破） | ✅ |

- 证据目录：`.myrd/blackboard/gate-logs/line4-art-crossline-reverify-20261026/`（00 前提+判定台账 · verify/01..09+manifest.txt）。
- 交接不变项：挂账项①执行仍归程序线下一部署批（本轮不做理由=触构建产物破 bc3cd56 三锚，程序回执已披露）；线上锚归档仍挂账具备 tailscale 通道方；N5 翻 pass 核签待 QA。

——游戏美术（跨线重证）

---

## 九、动效槽位清单 + F1 首屏视觉层级检查（2026-10-27 · PL4 好玩判据验证轮 · 美术署名）

> 性质：**拟改先登记**（防部署巡检误报）。新槽位件属 spec assets 扩充 → 动 spec 需 revision；**revision 窗口 = 首批真人反馈回流后**（与 D-1 时长锚 / PEND-待校准 谱系带同窗，或随 N5 打磨批一次走）。全数从风格卡 v1 派生（8 色白名单 + 圆角两档 + 唯一投影），文件名 kebab-case 对齐 spec 实体 id。

### 动效槽位清单（任务书五槽 ↔ 现有通道面逐槽对账）

| 槽位 | 现状（机判 @ `0675dd7` render.ts） | 拟登记槽位件 | 状态 |
|---|---|---|---|
| 成功反馈 | `vf-car-exit-burst`（spec 写死三通道之一）：≤12 粒子 / 生命 480ms / 同屏硬顶 24 | a07-exit-burst-fx（拟，程序化直绘→贴图件可选） | 通道在位，件待 revision |
| 失败反馈 | **无专属通道**（level.fail 现仅局态切换，红轮超预算无反馈动效） | a08-fail-feedback-fx（拟，需新增 spec 通道+预算行） | **空槽**（D-3 登记，待反馈定优先级） |
| 得分弹出 | 本作步数制**无得分面**；对应物=par/步数读数（F2 HUD） | 不设独立槽（防伪需求）；若真人反馈要求步数弹出 → 并入 combo-pop 通道 | 对账替代 |
| 连击 | `vf-combo-pop`：上浮文字 ≤10/局 · 240ms | 通道在位，现状够用 | 无需新件 |
| 结算庆祝 | `vf-level-clear`（通道名在 spec）：实现=静态色块最简态 | a10-clear-celebrate-fx（拟，升级庆祝动效） | 最简态在位，件待 revision |

### F1 首屏视觉层级检查（desk-check @ `0675dd7` · 绘制序 ①→⑧）

| 层 | 元素 | 色值/白名单核对 | 层级判定 |
|---|---|---|---|
| ① | 地面底 | `#F2EFE6` ✓ | 底层 |
| ② | 网格线 1px | `#D9D2C5` ✓ | 低于一切实体 ✓ |
| ③ | 出口门 2 格宽条 | 通=绿 `#10B981` ✓；**红轮态=红 `#EF4444`** | **D-2 发现：红轮态出口门与目标车同色**——潜在「红车 vs 红门」辨识混淆；不先行动码（零反馈不动码纪律），列入反馈单「美术视觉困惑」候选验证项，真人样本回流后定是否走 revision |
| ④ | 障碍（4px 圆角） | `#D9D2C5` ✓ | 低于车 ✓ |
| ⑤ | 车（8px 圆角 + 投影） | 目标车红 `#EF4444` / 暖橙 / 冷绿 / 蓝档 ✓；投影 12% alpha offset2 ✓ | 目标车与普通车色相对比成立 ✓ |
| ⑥⑦ | 粒子 / combo-pop | 白名单内 ✓ | 生命期出屏裁剪 ✓ |
| ⑧ | g-01 引导层 | a04 语义程序化直绘 ✓ | 最顶层 ✓ |

——游戏美术（动效槽位 + F1 层级检查）· 主策划（登记）· 2026-10-27
