# 资产清单黑板 — line3-tower-defense（第三产品线）

> 更新时间：2026-10-18（美术复证轮 2 · 重派零新做 · 全量重证绑 HEAD 6fe2c9b5；**同日勘误轮：verify 行补档复跑 @ `72be5f1` + 构建锚面归一回部署锚 `a27ca0e`，见全量门禁行勘误标记**）· 负责人：游戏美术（四要素/方向稿）+ 游戏程序（生成器/manifest）
> 下一步：W-L3-2 主人过目三方向拍板（采纳方向 2/3 须走 spec revision 改 deriveRule）→ 实现轮资产逐件登记（首批 ≤13 件封顶，ac-art-2）
> 判例：与产品线 2 风格卡**分文件**（线 2 = `.myrd/blackboard/wheat-squad/style-card-v1.md`，互不引用互不覆盖）；色值改动必须走 spec revision（沿 wheat-squad 判例）

## 风格卡 v1（2026-10-17 · 美术锁定 · 四要素）

**基调起点**：对标《赵云与阿斗》极简高对比色块（memo v1 §一.⑤，出处 D25）× 治愈系微调——低饱和暖色辅助 + 高对比可读性，正式视觉待主人过目（W-L3-2）。

### ① 调色板（8 色白名单 · 冻结）

| token | hex | 用途 |
|---|---|---|
| bg-deep | `#202A38` | 战场底色 / 全局描边色 |
| field | `#2F4156` | 布防区地面 |
| path-sand | `#E9D8A6` | 敌军路径（暖沙·治愈面） |
| grid-line | `#47617C` | 网格线 / 分隔 |
| core-coral | `#E76F51` | 核心据点 / 警告态 |
| enemy-berry | `#B75D69` | 敌军系 |
| turret-green | `#81B29A` | 炮塔系（治愈绿主色） |
| text-cream | `#F4F1DE` | 文案 / UI 面 / 高亮 |

- **派生规则（唯一允许的色值生成方式）**：炮塔三阶 = turret-green 与 text-cream 按 0%/20%/40% 混合（Lv1→Lv3 渐亮），敌血带 = enemy-berry 与 bg-deep 按 0%/30% 混合（满血/残血）——派生只允许「与白名单两色混合」，混合比例进 theme.ts 常量；**新增色相 = 违例**（ac-art-1 机判口径）。
- 渲染层只读 `theme.ts` token（ac-art-3 单源口径），源码零裸 hex。

### ② 光照

- **无方向光源、无投影**：双层平涂——基色层 + 「bg-deep 12% 混合」暗面层（区分顶/侧，纯色无渐变）。
- 命中反馈光 = 目标本色与 text-cream 按 hitFlash 进度混合 90ms（a4 面锚）。
- **禁用线性/径向渐变与阴影模糊**（确定性渲染零抖动，逐字节契约的渲染面前提）。

### ③ 线条

- 描边：2px `bg-deep`，圆角 4px（建筑/UI 面板统一）。
- 路径箭头：4px 等宽虚线 `text-cream` 60% 透明度，常显（level-1 教学面）/ 敌潮接近时呼吸闪烁。
- 弹道：2px `text-cream` 实线，命末 20ms 淡出。
- 文本：系统无衬线，禁描边字（HUD 16px / 面板 12px）。

### ④ 比例

- 网格：1 格 = 32 逻辑像素；战场 = 20×12 格（640×384 逻辑面，适配缩放交渲染层）。
- 炮塔：Lv1=24px / Lv2=26px / Lv3=28px（同格内心，视觉成长）；占 1 格。
- 敌军三型：小兵 16px / 快速 14px / 重甲 20px。
- 核心据点：2×2 格（64px），受击闪 core-coral。
- 射程圈：半径 = rangeTiles × 32px 虚线圆（选中时显现）。
- UI 安全边：四周 16px；结算面板 = 逻辑面中央 320×200px。

## 视觉签名映射（「需视觉可观察=是」判据逐条对表 · ac-art-4 机判口径）

| 判据/path id | 视觉签名（可机判锚） |
|---|---|
| a1 首布防 | 放置闪光 90ms + 射程圈虚线圆显现 |
| a4 命中反馈 | hitFlash 白混 90ms + 粒子 3 颗 + HUD 击杀数跳动 |
| a5 引导 | hint 浮层（bg-deep 70% 覆层 + text-cream 文案）+ 路径箭头常显 |
| path-place-turret-01 | 落位弹跳 200ms（scale 1.0→1.15→1.0） |
| path-upgrade-turret-01 | 等级星标 +1 + 射程圈扩大动画 200ms |
| path-speed-toggle-01 | 按钮态色块 ×1/×2 切换（grid-line↔turret-green） |
| path-restart-01 | 结算面板淡出 200ms + 全复位帧 |
| path-guidance-dismiss-01 | 引导浮层淡出 200ms |

> 美术核签：上表与 spec v1.0 acceptance/world.operationPaths 逐条对得上（对不上打回策划的口径自查通过，映射表随 ac-art-4 机判）。

## 方向稿（3 张已出稿 · 复证轮修复后定稿 · 不阻塞骨架）

- 生成器：`games/line3-tower-defense/tools/style-sketch.mjs`（确定性 SVG：token 启动自校验 theme.ts 单源，漂移即 fail-closed；重跑逐字节一致——deterministic-asset-pipeline 判例）
- 审计器：`games/line3-tower-defense/tools/style-sketch-audit.mjs`（独立机判：白名单读 approved spec + 派生色独立重算 + hash 逐件实算，零 hex 字面量）
- 落点：`games/line3-tower-defense/assets/style-sketch/`

| 件 | sha256（前 8） | 方向 | 状态 |
|---|---|---|---|
| `direction-1.svg` | `09c4d565` | 方向1 · 治愈绿阶（基线 = theme.ts DERIVE 原阶，实现轮直接可用） | 已出稿·审计 PASS |
| `direction-2.svg` | `7fda59ec` | 方向2 · 亮阶轻快（**候选**） | 已出稿·审计 PASS |
| `direction-3.svg` | `4185b770` | 方向3 · 沉稳原阶（**候选**） | 已出稿·审计 PASS |
| `manifest.json` | `e3df7a2d` | 逐件 file/sha256/seed/turretMixT/label | 随生成器产出 |

- **候选纪律**：方向 2/3 的炮塔混合比（0.1/0.3/0.5、0/0.15/0.35）≠ spec `numeric.palette.deriveRule` 冻结值（0/20/40%）。主人（W-L3-2）若采纳方向 2/3，**必须先走 spec revision 改 deriveRule**，实现层严禁直接采用（ac-art-1 派生规则声明面）。
- **复证轮修复登记**（2026-10-17，证据 `gate-logs/art-sketch-fix-20261017/`）：①Lv3 炮塔出画（cx=688>640）→ 布点 128+176i 画内化；②mix() 小写 hex → 大写规范化（Lv1 基色与白名单逐字符全等）；③token 单源自校验 fail-closed 化。跨线认领：生成器名义共管归程序，美术以视觉合规面直接修、palette 零触碰，**待程序线复签**。

## 复证轮登记（2026-10-18 · 美术 · 任务书同文重派 → 零新做全量重证）

> 现场增量核对：上轮 a623230 后仅 `.myrd-platform/.claude/skills/SKILLS.md` 一行平台自动提交，无他线新事实、无契约层改动 → 按重派协议**复证而非重做**，素材/风格卡/生成器零触碰：

| 项 | 结果 | 取证方式 |
|---|---|---|
| manifest sha256 独立实算 | game-art 6/6 + style-sketch 3/3 与黑板登记前 8 位全等 | `sha256sum` 实机独立比对 |
| manifest 内容级比对 | 9/9 entries 逐条 sha256 全等 manifest.json ↔ 磁盘 | node 逐条核验 |
| 确定性零漂移 | 基线 11 文件 → 重跑 `art-manifest.mjs` + `style-sketch.mjs` → sha256 11/11 OK ∧ `git diff` 空 | 先存基线再重生成 |
| style-sketch-audit | PASS（3 张方向稿 · 色值/光照/画布/构成/文案五面） | 独立机判器实跑 |
| 全量门禁 verify.sh | ~~**VERIFY: PASS（exit 0）**：…构建锚 `gitSha=6fe2c9b5` = 本轮 HEAD（build 仅锚差异，绑当前 HEAD）~~ ⚠️ **原声明被驳回缺陷2 判为不可核销**（gate-logs 无该批次日志原文，违反「门禁证据=含退出码的日志原文」口径）→ **已补档复跑替代实证（2026-10-18 程序线）**：verify 四步全 PASS · VERIFY_EXIT=0 @ HEAD `72be5f1`（统一契约 PASS approved v2 · RUN-ALL 14/14 + a3 单列 · SMOKE 零 console 错 · SCOPE 零违例），原文 `gate-logs/art-round2-recheck-20261018/01-verify.log`；构建锚面已归一：重生成仅锚位差异（`02-build-anchor-diff.log`）后 restore 回**部署锚面 `a27ca0e`**（b81d17b 提交面 = LIVE），提交面/部署面不再漂移 | 本轮实跑（补档） |
| spec 对账 | spec v1.0 `palette` 白名单 8 色与风格卡 v1 逐字符全等 · entities 12 id 与映射表一一对应 · `meta.approval` B6 授权在案 | design-spec.json 读回 |

- 美术四机判本轮重证全绿：ac-art-1（hex 零违例）· ac-art-2（6/13 件 hash+重生成一致）· ac-art-3（PALETTE≡spec≡风格卡 8 行逐值）· ac-art-4（签名映射 8/8）· tex-1（零位图）· inv-1（12/12）。
- 轨道 B 美术侧：线 2 归类「继续打磨 R3」已按零接触纪律落账（`g2-blocks/trackb-sha-answer-20261018.md` 随件动作），无新增素材动作、缺口清单维持。
- 风格卡 v1 不动（冻结面，主人无新方向）；首批资产维持 6/13 不扩表（宁缺毋滥）；W-L3-2 主人拍板三方向仍为下一步唯一美术侧闸门。

## 复证轮 3 登记（2026-10-18 · 美术 · ed25607 后重证 + game-art 首次 desk-check）

> 现场增量：他线 `ed25607`（trackA/B 驳回修复，触及 verify/锚面）→ 按「他线触及测试/契约层必须当前树重证」纪律执行；本轮认领缺陷2/缺陷3 新规：美术复证轮只取证不重绑构建锚，门禁日志一律逐步原文落盘。

| 项 | 结果 | 证据（逐步原文落点） |
|---|---|---|
| game-art 6 件 desk-check（首次） | **DESKCHECK PASS · 0 违例**：hex 全集 ⊆ 白名单 8 色 + deriveRule 独立重算派生 3 色（#98BFA8/#AFCBB5/#8A4E5A 逐字符全等）；零渐变/滤镜/模糊；描边面 stroke-width=2；几何锚命中（炮塔 24/26/28、敌三型 16/14/20） | `gate-logs/art-deskcheck-gameart-20261018/01-deskcheck.log` |
| desk-check 目检补判 | ①battlefield `stroke-width=8` = path-sand 敌军路径色带（非描边线，符合「路径=暖沙色带」语义）；②battlefield 320×192 / settlement 160×96 为缩样对照稿（运行时 1:1 面由 renderer 直绘承担，ac-art-3 单源）——两者均不构成违例 | 同上日志 + 本条判读 |
| 全量门禁 verify.sh @ HEAD `ed25607` | **VERIFY: PASS（VERIFY_EXIT=0）**：统一契约 PASS · RUN-ALL 14/14 + a3 真人面单列 PEND · L3-SMOKE 全链路零 console 错（锚 gitSha=ed25607… 与绑定锚全等）· SCOPE 25 文件零违例；美术六机判 ac-art-1/2/3/4 + tex-1 + inv-1 全绿重证 | `gate-logs/art-round3-recheck-20261018/01-verify.log` |
| 构建锚面纪律 | verify 重建差异**仅锚位 2 处**（业务产物零差异）→ 已 restore 回部署锚面 `a27ca0e`（0 残留），不重绑、不产生提交面/部署面漂移 | `gate-logs/art-round3-recheck-20261018/02-build-anchor-diff.log` |

- 素材/风格卡/生成器仍零触碰（无新做项）；本轮增量 = desk-check 首证 + 他线改动后重证 + 证据纪律归队。

## 资产清单（首批实现资产 · 2026-10-18 N3/N4 落账 · 6/13 件）

> 生成器 `games/line3-tower-defense/tools/art-manifest.mjs`（token 单源派生 · 零位图 · 确定性=重生成逐字节一致）· manifest=`games/line3-tower-defense/assets/game-art/manifest.json`（逐件 生成器行号+sha256 · ac-art-2/tex-1 机判输入）

| # | 件 | sha256（前8） | 状态 |
|---|---|---|---|
| 1 | battlefield-preview.svg | `97ddd5f2` | ✅ 已登记（战场面预览） |
| 2 | turret-lv-sheet.svg | `2e1c654f` | ✅ 已登记（炮塔三阶） |
| 3 | enemy-kind-sheet.svg | `53814e11` | ✅ 已登记（敌三型+血带） |
| 4 | core-hud-sample.svg | `a0d793c4` | ✅ 已登记（核心+HUD 样例） |
| 5 | guidance-overlay.svg | `321bb5cf` | ✅ 已登记（引导浮层） |
| 6 | settlement-panel.svg | `9af8876e` | ✅ 已登记（结算面板） |

- **占位件纪律**：实现资产落 `assets/game-art/`（游戏面），B4 方向稿落 `assets/style-sketch/`（设计面）——分目录、不打资产编号，零混装。
- 代码内可见单元（塔/敌/核心/路径/HUD）由 Canvas 程序化直绘（renderer.ts 只读 theme token）——**零外部贴图**（tex-1 机判：src+tools 23 文件零位图构造）。

## entities id → 文件名映射表（N3 交付 · 策划整包→美术校验→程序落位闭环）

> 对账口径：spec.entities[].script（仓根相对）→ 工程相对（剥 `games/line3-tower-defense/` 前缀）→ inventory 登记行一一对应（inv-1 机判 12/12）

| entities id | kind | 文件（工程相对） | 美术可观察面 |
|---|---|---|---|
| e-kernel-loop | kernel | `src/kernel/loop.ts` | —（确定性之根） |
| e-kernel-sim | kernel | `src/kernel/sim.ts` | —（步进纯函数） |
| e-grid | world | `src/world/grid.ts` | 网格线（grid-line 1px） |
| e-core | world | `src/world/core.ts` | 核心 2×2（core-coral，受击闪） |
| e-turret | player-side | `src/entities/turret.ts` | 塔三阶（turret-green×cream 0/20/40%）+ 星标 |
| e-enemy | hostile | `src/entities/enemy.ts` | 敌三型 16/14/20px + 血带两态 |
| e-projectile | hostile | `src/entities/projectile.ts` | 弹道 2px 实线 + 命末淡出 |
| e-wave-director | system | `src/systems/waveDirector.ts` | HUD 波次 n/8 + 路径箭头常显 |
| e-economy | system | `src/systems/economy.ts` | HUD 军费跳动（killPulse） |
| e-telemetry | system | `src/telemetry/emitter.ts` | —（八键缓冲，零外发） |
| e-render | presentation | `src/render/renderer.ts` | 全部绘制（theme token 单源） |
| e-input | presentation | `src/input/touch.ts` | 选中圈/放置菜单/加速按钮态 |

## P0-3 资产底账盘点（2026-10-23 · 组合推进轮 · 游戏美术署名件 · 零新资产轮）

> 更新时间：2026-10-23 ｜ 下一步：零动作维持（备而不动：反馈未回流不开 R1、不产新资产——本轮任务书口径）；下一轮产出仅在新行为面变更轮/主人视觉拍板后启动

| 盘点项 | 实况（本轮复证） | 判定 |
|---|---|---|
| 可见资产件数 | **6/13**（ac-art-2 封顶口径；build/manifest.json 23 文件含代码件，可见资产 6 件） | 封顶内 ✓ 零新增 |
| 逐件 hash 确定性 | ac-art-2 复跑（v4 基线 `20-post-revision-gates.log`）：「6/13 件逐件带 生成器行号+sha256 · 重生成逐字节一致」 | ✓ 零漂移 |
| 风格卡 token 单源 | ac-art-3 复跑 PASS：PALETTE ≡ spec ≡ 风格卡 8 行逐值一致（8 色冻结 v1.0） | ✓ 零改动 |
| 视觉签名映射 | ac-art-4 复跑 PASS：映射键集合全等 8/8（a1/a4/a5 + 5 path id） | ✓ 零改动 |
| 零外部贴图 | tex-1 复跑 PASS：src+tools 25 文件零位图构造 | ✓ 维持 |
| 方向稿/占位件 | `assets/game-art/` 6 件 + `assets/style-sketch/` 方向稿——本轮零触碰零重绘 | 冻结维持 |
| 零新资产声明 | 本轮美术面仅本盘点落账，未产任何新图、未改接线、未动 numeric.palette | ✓ 纪律遵守 |

- **美术节点独立重证（2026-10-23 收口后 · 跨线认领纪律）**：当前轮末 HEAD `76d7cd4` 下重跑——11/11 件（game-art 6 + style-sketch 3 + 双 manifest）sha256 与上表登记逐件全等；双生成器确定性重生成 11/11 逐字节零漂移（`git status` 工作树净）；`style-sketch-audit` PASS（exit=0，色值/光照/画布/构成/文案五面）。本段各行结论在最新提交上复验成立。机判原文 `../gate-logs/art-node-claim-20261023/00-baseline-hash.txt`

