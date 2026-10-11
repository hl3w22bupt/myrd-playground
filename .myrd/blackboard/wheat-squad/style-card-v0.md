# 风格参考卡 v0 — 麦浪小队（wheat-squad · N4 美术同批 · 2026-10-11）

> 负责人：游戏美术 · spec 锚：`cmv36ewn8001sm9mxvsyvbvuc`（v1 draft · meta.version=0.1）· assets[0] 落点（本件）
> 纪律：占位资产一律取卡内色值（任务书 N4）；零外部贴图（spec tex-1）——卡片即渲染 token 的色值真源（spec numeric.palette 已同步冻结同名键值）；对标竞品 = 色板取样参考，**非复制**。

## 一、调色板（palette · 8 色带色值 · 与 spec numeric.palette 逐值一致）

| token | 色值 | 用面 | 取样依据 |
|---|---|---|---|
| wheatGold | `#E8B84B` | 队长/麦穗/粒子（主角面） | 麦穗实拍暖金基；对标《超能下蛋鸭》主角暖黄（D7 抖音 TOP10）明度提升 8% 做治愈向 |
| wheatDeep | `#C99530` | 队员/描边/卡片框 | wheatGold 同环深一档（CIEDE2000 ≈ 18 < 阈值 25，同族可辨） |
| fieldGreen | `#7FA65A` | 麦浪底纹层1 | 麦田绿（黄绿相，非纯绿——与「消除线糖果绿」错开色相 30°+） |
| fieldDeep | `#5C7F42` | 麦浪底纹层2 | 同环深档，双层视差用 |
| skyCream | `#F5EDD8` | 天空/结算页底 | 奶油暖白（治愈系包装基调；对标竞品暗底策略的**反向差异化**） |
| pestBrown | `#8A5A3B` | 害虫本体 | 土棕（害虫 = 甲虫隐喻，暖棕避开「丧尸绿/暗黑系」——对标《向僵尸开炮》刻意反向） |
| accentRed | `#D2543E` | HP/受击 flash/重开提示 | 陶土红（警示色，低饱和避免焦躁） |
| inkBrown | `#4A3826` | 文字/HUD | 深咖（可读性锚，对 skyCream 对比度 ≥ 7:1） |

- 对比度双门禁口径沿 g2-blocks ac-12 判例：8 色 28 对全对 ΔE(CIEDE2000) ≥ 25 的对 = 文字/底面对（inkBrown×skyCream、accentRed×skyCream）；同环近似对（wheatGold×wheatDeep、fieldGreen×fieldDeep）有意 < 25（同族层次），门禁实现随下批 perf/色板契约（v0.1 仅冻结色值，门禁 v0.2 入）。
- **对标取样声明**：《向僵尸开炮》（D1）主视觉 = 暗底高饱和弹幕；本卡取其「高识别主角/低杂讯底」的结构原则，色相全部反向（亮底暖色）——《超能下蛋鸭》（D7）暖色休闲向验证了亮底路线在抖音的可行面。两竞品色板取样仅作方向依据，色值全部原创派生，无逐像素复制。

## 二·补、四要素对齐（美术线规范口径 · N5 互查打回补齐 2026-10-11）

> 判例口径：预置件 `art/style-card-template.md` 四要素 = **调色板 / 光照 / 线条 / 比例**（stack-tower C 轮 art-audit 机审判例；2026-10-10 美术线 N3 亲审修订版）。v0 首稿缺光照/线条/比例三要素，美术互查主动打回，本节补齐（原「角色/氛围」降为扩展项 §三/§四，判例同构零删）。

### 2. 光照（Lighting）
- **全局光照**：无方向光系统（几何平涂 + 分层α，零贴图纪律下的「平涂叠层」策略——不做光影仿真）；层次由麦浪双层视差（fieldGreen α0.35 → fieldDeep α0.5）承担。
- **命中反馈光**：hit flash = accentRed 描边圆环扩散（半径 12→22px，α = 剩余寿命线性衰减单峰，90ms）——命中态=最活帧（判例 stack-tower perfect 三锚同帧同构）；受击（队长）= 外圈 wheatDeep→accentRed 呼吸（无敌帧 0.8s 窗口）。
- **氛围层**：skyCream 满底 + 麦浪条带（零 scrim；亮底策略下不需要遮罩）。

### 3. 线条（Line / Stroke）
- **默认**：色块平涂零描边（形状语言 = 圆[友方/柔和] + 椭圆[敌方] + 圆角矩形[UI/拾取]，零尖角、零折线）。
- **显式描边仅四处**（token 化）：队长操作锚外圈（wheatDeep 2px α0.5 常显）/ 三选一卡片框（wheatDeep 2px）/ 结算面板框（wheatDeep 3px）/ hit flash 环（accentRed 2px）。零贴图 textureSampling=none 同红线（g2-blocks ac-13 判例同构）。

### 4. 比例（Proportion / Layout）
- **画布**：390×640 竖屏（build 面固定；index 自适应缩放）。
- **主体占比**：队长 r10（直径 20px ≈ 视口宽 5%）/ 害虫 18×14 / 队员 r14——群像密度优先，单体 ≤5% 宽。
- **触达面**：三选一卡 96×120（≥48dp 等效 ✓ spec level-1/el-first-upgrade）；重开 = 全屏点任意处（结算态）；HP 点 r5 × 5 顶部右缘。
- **HUD 带**：顶部 ~28px（4.4%）+ 底部喘息行 ~18px——中央 ~87% 为战场净区（安全区天然留白策略与 g2-blocks D 轮同构）。

## 二、角色（几何设定 · 零贴图落地）

| 角色 | 几何 | 色值映射 | 动效 |
|---|---|---|---|
| 队长 | 实心圆 r10 + 外圈 r18 描边（操作锚常显——level-1/el-warmup） | wheatGold 本体 + wheatDeep 外圈 | 移动无残影（治愈向不做拖尾）；受击外圈闪 accentRed（invuln 0.8s 呼吸） |
| 队员 | 实心圆 r7 | wheatDeep | 开火无后坐（音效占位）；招募入队时 scale 0→1 一跳 |
| 害虫 | 椭圆 9×7 + 头点 r3.2 | pestBrown 本体 + inkBrown 头；hit flash 整体 accentRed | 击退位移 + flash 圆环扩散（renderer 已实现）；死亡 = 化 3 粒麦穗粒子 |
| 麦粒弹 | 实心圆 r3 | wheatDeep | 直线，无尾迹 |
| 麦穗 pickup | 6×8 矩形（穗形抽象） | wheatGold | magnet 吸附直线飞向队长 |

## 三、氛围（场景与情绪）

- **场景**：单场景「麦浪田」（spec zone-wheatfield）——奶油天 + 双层正弦麦浪条带（程序化，renderer drawField 已实现，视差随 tick 缓移）；无昼夜切换（v0）。
- **情绪曲线**：暖底 + 低饱和警示（accentRed 只出现在受击/HP/重开按钮）——「爽感来自密度与反馈速度，不来自暗黑压迫」（对标反向差异化核心）。
- **文案口吻**：治愈短句（「守住了 N 浪！」「喘息 3s · 下一浪更密」——结算/HUD 已落地）；禁血腥词（害虫「被冲散」不「被消灭」——settlement headline 已对齐）。
- **字体**：system-ui 栈（零字体资产，沿 g2-blocks 零贴图纪律同构）。

## 四、一致性门禁（下批入契约的预告面）

1. 色值一致性：renderer/theme.ts 与本卡与 spec numeric.palette 三方逐值相等（v0 手核一致；v0.2 入机判）。
2. 新增占位资产（icon/分享卡）必须从本卡色值派生，登记进 spec assets（走 revision）。
3. 风格漂移打回线：任何色值改动 = spec revision（红线①）；美术不得手改 theme.ts 逃逸。

## 五、好玩判据四件套的美术备料状态（N5 试玩备料）

| 判据 | 美术面状态 |
|---|---|
| 首 30 秒体验 | 队长高亮圈常显 ✓（操作锚可见性）；首杀 flash 全链首杀即演示 ✓ |
| 单局时长 | HUD 计时 ✓；波次喘息倒计时提示 ✓ |
| 再来一局理由 | 结算页三信息（三强回顾/难度预告/麦仓增量）✓ + accentRed 重开提示 ✓ |
| 反馈手感 | hit flash 90ms + 击退 + 麦穗粒子三件 ✓（150ms 预算机判 0 帧） |
