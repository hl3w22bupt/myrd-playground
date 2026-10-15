# 风格卡 v1 — 麦浪小队（wheat-squad · 可玩基线轮 · 2026-10-12）

> 负责人：游戏美术（执笔）· 主策划拍板：✅ 2026-10-12（四要素齐备，开产授权）
> spec 锚：链 v2 draft `cmv4pqezm0016m9qm2i2qmywe`（meta.version=1.0）· world.styleRef 指向本件
> 版本链：v0（N4 参考卡，缺三要素 → N5 互查打回补齐）→ **v1（本件，四要素冻结 + 资产清单规范 + 提审素材占位规格）**
> 纪律不变式：零外部贴图（tex-1）；色值唯一真源 = spec numeric.palette（8 色逐字节沿 v0 不动，本卡与 theme.ts 均为派生镜像）；对标取样仅方向依据，色值零复制。

## 要素一 · 调色板白名单（palette whitelist · 8 色）

| token | 色值 | 用面 |
|---|---|---|
| wheatGold | `#E8B84B` | 队长/麦穗/粒子（主角面） |
| wheatDeep | `#C99530` | 队员/描边/卡片框 |
| fieldGreen | `#7FA65A` | 麦浪底纹层1（α0.35） |
| fieldDeep | `#5C7F42` | 麦浪底纹层2（α0.5，双层视差） |
| skyCream | `#F5EDD8` | 天空/结算页底 |
| pestBrown | `#8A5A3B` | 害虫本体 |
| accentRed | `#D2543E` | HP/受击 flash/重开提示（低饱和警示，全卡唯一警示色） |
| inkBrown | `#4A3826` | 文字/HUD（×skyCream 对比 ≥7:1） |

- 白名单纪律：**任何源码/资产/素材色值必须 ∈ 上表**（ΔE(CIEDE2000) ≤ thresholdDeltaE(25) 视为同色；机判 = ac-10，v1 起入契约）。同环近似对（wheatGold×wheatDeep、fieldGreen×fieldDeep）有意 < 25，属同族层次非违例。

## 要素二 · 光照（Lighting）

- 全局：无方向光系统——几何平涂 + 分层 α（零贴图纪律下的平涂叠层策略，不做光影仿真）；层次由麦浪双层视差承担。
- 命中反馈光：hit flash = accentRed 描边圆环扩散（半径 12→22px，α 随剩余寿命线性衰减单峰，hitFlashMs(90ms)）；队长受击 = 外圈 wheatDeep→accentRed 呼吸（无敌帧 0.8s 窗口）。
- 氛围层：skyCream 满底 + 程序化麦浪条带，零 scrim（亮底策略免遮罩）。

## 要素三 · 线条（Line / Stroke）

- 默认色块平涂零描边；形状语言 = 圆（友方/柔和）+ 椭圆（敌方）+ 圆角矩形（UI/拾取），零尖角零折线。
- 显式描边仅四处（token 化）：队长操作锚外圈（wheatDeep 2px α0.5）/ 三选一卡片框（wheatDeep 2px）/ 结算面板框（wheatDeep 3px）/ hit flash 环（accentRed 2px）。

## 要素四 · 比例（Proportion / Layout）

- 画布 390×640 竖屏（build 面固定，index 自适应缩放）。
- 主体：队长 r10（直径 ≈ 视口宽 5%）/ 害虫 18×14 / 队员 r7 / 麦粒弹 r3 / 麦穗 6×8——单体 ≤5% 宽，群像密度优先。
- 触达：三选一卡 96×120（≥48dp 等效）；重开 = 结算态全屏点按；HP 点 r5×5 顶部右缘。
- HUD 带：顶部 ~28px + 底部 ~18px，中央 ~87% 战场净区。

## 资产清单与命名规范（AC-A2 接口 · 资产总数封顶 = entities 数 13）

| 类别 | id 规范 | 本轮件数 | 落点 |
|---|---|---|---|
| 实体资产（核心可视实体，程序化绘制规格） | **必须 = spec entities id** | 5：e-captain / e-squadmate / e-pest / e-bullet / e-wheat-pickup | assets.md 实体资产区 + theme.ts token 面 |
| UI 套件 | `ui-kit-01`（1 件套：HUD 带/三选一卡/结算面板/按钮态） | 1 | assets.md UI 区 |
| 提审素材占位模板 | `sub-icon` / `sub-sharecard-5x4` / `sub-shots-3` | 3 | games/wheat-squad/qa/submission/（模板 + 尺寸 README） |

- 封顶核对：5 + 1 + 3 = **9 件 ≤ 13（entities 数）** ✓；逻辑实体（kernel/wave/upgrade/settlement/bank/renderer/telemetry 8 件）无独立视觉资产，不占清单。
- AC-A2 机判口径：`entity` 类清单件 id 必须 ∈ spec entities ids（逐字）；**清单外源文件出现未登记资产 = 违例**。

## 提审素材占位模板规格（本轮交付 = 模板 + 尺寸 README，正式素材止步清单不产出）

| 件 | 规格 | 体积上限 |
|---|---|---|
| sub-icon 应用图标 | 512×512 PNG，纯色底 + 主体几何（队长圆 + 麦穗） | ≤ singleAssetMaxKB(300KB) |
| sub-sharecard-5x4 分享卡 | 1000×800（5:4），skyCream 底 + 治愈短句位 | ≤ atlasMaxKB(1024KB) |
| sub-shots-3 截图三连 | 3× 1170×2080（390×640@3x），对局早/中/结算各一 | ≤ shotMaxKB(500KB)/张 |

- 平台红线入模板 README：正式提审止步材料清单（本轮不提交）；素材文案走违规标识符扫描（QA 规则清单含素材文案面）；好友数据不出开放数据域、凭证不入库（占位符 only）。

## 一致性门禁（AC-A1..A4 ↔ spec acceptance 映射）

| 条款 | mode | 机判/人判 |
|---|---|---|
| AC-A1 色板白名单 | auto | ac-10：源码/清单色值 ⊆ palette 白名单 |
| AC-A2 命名↔id 一致 | auto | ac-11：清单件 id ∈ entities ids，无清单外资产 |
| AC-A3 体积上限 | auto | ac-12：逐件 ≤ artCaps，build 首包 ≤4MB |
| AC-A4 风格一致 | manual+auto | ac-13 机制面机判（卡+走查清单在档）+ 主策划×美术互查人判 |

## v1.2 增量：引导元素视觉权重规则（定稿 · 2026-10-13 · 回三合一包 tri-pack-v1.2.md）

> 四要素冻结不动（调色板/光照/线条/比例沿上文）；本节 = 任务书「引导元素视觉权重规则」定稿面。
> 实现载体 = `games/wheat-squad/src/render/renderer.ts#drawGuidance`（已在盘，本节为其美术验收依据）。

| 要素 | 定稿 |
|---|---|
| 层级 | 信息层最顶（HUD 之上，scrimInk 遮罩与结算面板之下） |
| 底板 | panelCream（skyCream α0.96）填充 + wheatDeep 2px 描边——与结算面板同族语言，视觉强度低于 scrim |
| 文字 | inkBrown · 600 · 14px（HUD 同档）；**禁止 accentRed**（红色只归击杀/伤害反馈通道） |
| 几何 | 390 宽画布上横条 86% × 44px，y=12%；文案水平居中（G-1 逐字，实现单源 GUIDANCE_TEXT） |
| 时窗 | 首局 running 前 4s（spec numeric.guidance.hintSec=4）；无淡出动效（零动画纪律，反馈资源留给击杀面） |
| 权重自检 | 与三选一卡（96×120+scrim）并现时引导条不夺焦——引导是「轻提示」，a5 玩家首操作（≤5s）是它的成功判据而非停留时长 |
| 排版核对 | G-1 `拖动队长移动 · 队员自动作战`（13 全角字符 + 2 间隔点）14px 档一屏放下 ✓（86% 宽 ≈ 335px > 文字实测 ~180px） |

**a5 存在性 check 素材（manifest 对账面）**：资产 id `guidance-hint-banner`（kind=ui，文案逐字 = G-1，真源 game.ts#GUIDANCE_TEXT）——已同步登记 manifest（见 assets/manifest.json v2）。

---

## R1 复核 + 特效批（2026-10-14 · 游戏美术 · 主策划工作室代行节点）

### §R1.1 风格卡复核（零依赖先行 · 机判三方面）

- **palette 三方全等 PASS**：spec numeric.palette（8 色 + thresholdDeltaE=25）↔ `src/render/theme.ts` ↔ 本卡要素一，逐色值三方机判全等（2026-10-14 实查）。
- **四要素零漂移**：调色板/光照/线条/比例与 v1 冻结面一致；§v1.2 增量（引导视觉权重）继续有效。
- **陈旧锚更正（就地登记，原文保留）**：①卡头「spec 锚 = 链 v2 draft cmv4pqezm（meta 1.0）」已过时 → 现行锚 = **链 v4 approved（meta v1.2 `cmv60scie003hm9qqu91foe7v`；v1.3 入链后为 v5）**；②「封顶核对 5+1+3=9」已过时 → 现行 **13 件 = 封顶 13**（5 entity + 1 ui-kit + 1 guidance + 3 submission + 3 fx，零余量）。
- **AC-A4 机制面走查**：manifest v3 逐件 kind/source/tokenSource 在盘（ac-11 面2 机判）· 色值面 ac-10 全绿（基线 r1-converge-20261014/01）。

### §R1.2 反馈特效批（按操作路径清单 · 视觉通道绑资产 id 供 check 复算）

> 形态纪律：零位图（tex-1）——fx 件 = 程序化绘制规格（procedural-draw-spec），theme.ts token 驱动；复合绑定（3 件覆盖 7 视觉通道）以满足封顶 13。
> 【r10 更正 2026-10-14 · 游戏美术亲审】原「6 视觉通道」系代行笔误：实现面通道全集 = 击杀 4（flash/particles/pickup-spawn/hud-kills，sim.ts:149）+ 受击 3（flash-invuln/knockback/hud-hp，sim.ts:241）= **7**；manifest 三件 feedbackChannels 并集 = 7 ✓（ac-05 面4 机判绿）。原文留档见 gate-logs/art-reverify-20261014-r1b/03。

| 资产 id | feedbackChannels | 操作路径 | 视觉规格（要素二/三派生） | source 锚 |
|---|---|---|---|---|
| `fx-kill-burst` | flash / particles / pickup-spawn | OP-02/OP-03 | accentRed 扩散环 r12→22（hitFlashMs=90ms α 线性衰减单峰）+ wheatGold 方粒 4×4 + 麦穗 pickup 圆角块 6×8 | renderer.ts#drawEffects |
| `fx-hit-shock` | flash-invuln / knockback | OP-05 | 外圈 wheatDeep→accentRed 呼吸（无敌帧 0.8s 窗口）+ 击退位移（载体=实体重绘，无独立特效层） | renderer.ts#drawEffects |
| `fx-hud-channels` | hud-kills / hud-hp | OP-02/OP-05 | HP 点 accentRed r5×5 顶右缘（全卡唯一警示色用面）+ 击杀计数 inkBrown（对比 ≥7:1） | renderer.ts#drawHud |

- **通道覆盖完备性**：实现面 channels 全集 {flash, particles, pickup-spawn, hud-kills, flash-invuln, knockback, hud-hp} ⊆ 3 件 feedbackChannels 并集——ac-05 面4 机判（R1 新增面）。
- **封顶与登记**：manifest v2→**v3**（10→13 件 = 封顶）；spec.assets 同批入 v1.3 修订（B 案 +7：4 补登 + 3 fx）。
- **引导视觉与结算页打包声明（整批替换不拆改）**：引导 = guidance-hint-banner（§v1.2 增量规则，零拆改）；结算页 = ui-kit-01 covers「结算面板」+ world.uxCommitments 既有交互面，本轮以登记面打包（不拆改不重绘），视觉规格沿用要素三「结算面板框 wheatDeep 3px」。

### §R1.3 交接给 check 的复算接口

- 通道↔资产绑定数据面：`assets/manifest.json` fx 件 `feedbackChannels` 字段（ac-05 面4 逐通道复算）。
- 登记集对账：manifest 逐件 id ∈ spec entities ∪ spec.assets（ac-11 面4，B 案扩严）。

### §R2.0 勘误附注（2026-10-15 · W-7 B 案裁决 · 主策划）

- **fx-hit-shock「无敌帧外圈 wheatDeep→accentRed 呼吸」从未构建**（r10 亲审升级项 W-7）：渲染层零读 `invulnUntilTick`（`renderer.ts` 零引用，`sim.ts:237` 仅内核判定），`sim.ts:240` 注释失实。本卡此前「要素二」及 spec v1.3 assets note 对该视觉的声称**更正为真实态**：无敌窗（0.8s）可感知反馈 = 击退位移（knockback 通道）+ HUD HP 扣减，**无独立视觉环**。
- **manifest v4 随本勘误落改**：fx-hit-shock.feedbackChannels `['flash-invuln','knockback']` → `['knockback']`（机判面 ac-05 断言方向 = emitted ⊆ bound，渲染层零发 flash-invuln → 门禁面零影响，复跑 16/0/1PEND 留证）。
- **A 案（补 invuln 呼吸圈）降级为 R2 打磨候选**：若主人试玩反馈指向「无敌窗无感知」，R2 批程序线在 drawSquad 补呼吸圈（连 spec assets note 修订一并走 revision）——归主人反馈触发，不抢跑。
