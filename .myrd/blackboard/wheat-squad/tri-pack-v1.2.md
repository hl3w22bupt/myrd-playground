# 三合一包 v1.2（world 段草稿 + entities id 清单 + 首屏文案逐字枚举）· 一次发全

> 更新时间：2026-10-13 · 发件人：游戏策划（主策划代行整合）· 收件人：游戏美术 · 回件截止：当天
> 基线：链 `cmv4q8bng001em9qm5p78do05` v3 approved（meta v1.1）· 本包 = spec v1.2 修订的美术前置件
> 纪律：本包一次发全不拆发（任务书口径）；美术当天回「风格参考卡 v1.2 增量 + 资产 manifest 增量」；
> 冻结面不变：色值唯一真源 = numeric.palette 8 色，零贴图零 atlas（渲染管线结论见 inventory-line2.md 顶部）。

## 一、world 段草稿（v1.2 增量部分 · 其余 world 面沿 v3 不动）

### 1.1 引导元素视觉权重规则（新增 · 美术四要素延伸，回卡时定稿色值/字号档）

| 规则 | 内容 |
|---|---|
| 层级 | 引导浮层 = 信息层最顶（高于 HUD，低于三选一遮罩 scrimInk 与结算面板） |
| 底板 | panelCream（skyCream α0.96）+ wheatDeep 2px 描边——与结算面板同族，弱于 scrim 遮罩 |
| 文字 | inkBrown · 600 weight · 14px 档（HUD 同档，不放大抢焦点——引导是「轻提示」不是弹窗） |
| 位置 | 场上带 y=12% 处横条（宽 86%），不遮队长高亮圈与出怪路径 |
| 时窗 | 首局 running 前 4s 显示（spec numeric.guidance.hintSec），淡出不做动效（v1.2 零动画纪律，反馈资源留给击杀面） |
| 权重禁令 | 引导面禁止使用 accentRed（红色只归击杀/伤害反馈通道——a4 通道语义不稀释） |

### 1.2 既有交互登记（world.uxExisting · 默认收进 spec 标「既有交互」，主策划当天逐条裁）

| id | 交互 | 状态 | 裁决 |
|---|---|---|---|
| ux-ex-drag | 单指拖动/鼠标拖动移动队长（pointer 目标点，松指即停） | 既有（v0 起在 spec e-captain 面） | 收进 spec 标「既有交互」✅ |
| ux-ex-tap-upgrade | 三选一卡点选（≥48dp 等效触达，点选即生效并冻结解除） | 既有（v0 起在 spec e-upgrade-picker 面） | 收进 spec 标「既有交互」✅ |
| ux-ex-tap-restart | 结算态任意点按重开（≤1s 全复位，文案「点任意处再来一局」） | 既有（v0 起在 spec ux-fv-restart 面） | 收进 spec 标「既有交互」✅ |
| ux-ex-hint | 首屏引导浮层展示（hint_shown，4s 窗，不阻断输入） | **本轮新增**（a5 判据载体） | 新条款 ac-a5，非「既有」 |
| ux-ex-freeze | 三选一悬停冻结战局（选择即生效前置） | 既有（v0 起，step 冻结语义） | 收进 spec 标「既有交互」✅ |

### 1.3 tone/styleRef 面零改动声明

治愈系包装 × 割草爽感、暖麦色 + 通透绿、几何色块零贴图、零血腥（v3 原文沿用）；styleRef 继续指向 `.myrd/blackboard/wheat-squad/style-card-v1.md`（v1.2 只增「引导元素视觉权重规则」节，四要素冻结不动）。

## 二、entities id 清单（美术命名对齐面 · 13 件不变，新增遥测字段命名归 e-telemetry）

| entity id | 锚（对齐 inventory-line2.md 逐条核对 ✓） | 美术相关面 |
|---|---|---|
| e-kernel-loop | src/kernel/loop.ts#seededRng | — |
| e-kernel-sim | src/kernel/sim.ts#stepSim | — |
| e-captain | src/kernel/sim.ts#captain | wheatGold 高亮圈常显（操作锚） |
| e-squadmate | src/kernel/sim.ts#Squadmate | wheatDeep 小圆 |
| e-pest | src/kernel/sim.ts#pests | pestBrown 椭圆+inkBrown 头点，flash=accentRed |
| e-bullet | src/kernel/sim.ts#bullets | wheatDeep 3px 圆 |
| e-wheat-pickup | src/kernel/sim.ts#pickups | wheatGold 6×8 麦穗块 |
| e-wave-manager | src/kernel/sim.ts#waveTimerMs | HUD 浪次文案 |
| e-upgrade-picker | src/kernel/sim.ts#offerUpgrades | 三卡 96×120 + scrimInk 遮罩 |
| e-settlement | src/settlement.ts#buildSettlement | panelCream 面板 + 三信息行 |
| e-placement-bank | src/settlement.ts#bankGain | 结算「麦仓收益」行 |
| e-renderer | renderer.ts#drawField + theme.ts#THEME | 全部几何绘制 |
| e-telemetry | src/game.ts#telemetry | **v1.2 埋点字段新增见下表（命名冻结，文案见 §三）** |

**e-telemetry 埋点字段 v1.2 增量（事件名→字段名→类型，命名冻结）**：

| 事件 | 字段 | 类型 | 语义 |
|---|---|---|---|
| first_tap | atMs | number | 会话首次点按的局内相对毫秒（tick×FIXED_STEP_MS） |
| first_loop_complete | atMs | number | 首次升级三选一选择完成时刻（= firstUpgradeTick×stepMs）——首次核心循环闭环 |
| restart_clicked | count | number | 结算页重开点按本地计数（每次点击 +1，从 1 起） |
| restart_clicked | atMs | number | 点按时刻局内相对毫秒 |
| hint_shown | atMs | number | 引导浮层展示时刻（首局 running 起始 = 0） |
| hint_shown | text | string | 展示文案逐字（= §三 G-1） |

## 三、首屏文案逐字枚举（美术排版对齐 · 每字空格标点均冻结，改动走 revision）

| id | 落点 | 逐字文案 |
|---|---|---|
| G-1 | 引导浮层（hint_shown.text 单源 = src/game.ts#GUIDANCE_TEXT） | `拖动队长移动 · 队员自动作战` |
| G-2 | HUD 状态行（模板，N=浪次 X=击杀 Y=秒） | `第{N}浪 · 击杀 {X} · {Y}s` |
| G-3 | 喘息提示（波间） | `喘息 {N}s · 下一浪更密` |
| G-4 | 三选一卡脚标（i=1..3） | `点选 {i}` |
| G-5..G-9 | 强化名（UPGRADE_LABEL 逐字） | `快穗（射速 +25%）` · `硬粒（伤害 +1）` · `召集（队员 +1）` · `轻步（移速 +15%）` · `穗引（拾取范围 +40%）` |
| G-10 | 结算 headline（victory） | `守住了 {N} 浪！` |
| G-11 | 结算 headline（defeat） | `第 {N} 浪被冲散了` |
| G-12 | 结算行（模板） | `本局：{X} 击杀 · {Y}s · 第 {N} 浪` / `三强强化回顾：` / `{i}. {强化名} ×{c}` / `（本局未拾取强化——下一局试试升级路线）` / `下一波次难度预告：生成密度 ×{R}/浪` / `麦仓收益：+{B} 麦穗（离线也在长）` |
| G-13 | 重开提示 | `点任意处再来一局` |

## 四、回件要求（当天）

1. **风格参考卡 v1.2 增量**：§1.1 视觉权重规则定稿（色值/字号档核对 palette 白名单）+ 确认 G-1 文案排版一屏放下（390 宽 × 44 高档内）。
2. **资产 manifest 增量**：a5 存在性 check 素材 = 引导浮层在 manifest 登记一条（id 建议 `guidance-hint-banner`，kind=ui，file 指向参考卡节锚，文案逐字抄 G-1）；命名对齐 entities id（ac-art-2 机判）。
3. wx/dy 分享图本轮不产（任务书口径）。
