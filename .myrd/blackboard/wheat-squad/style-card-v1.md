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
