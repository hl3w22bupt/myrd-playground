# 资产清单黑板 — line3-tower-defense（第三产品线）

> 更新时间：2026-10-17（美术复证轮 · 方向稿缺陷修复 + 独立零漂移实证）· 负责人：游戏美术（四要素/方向稿）+ 游戏程序（生成器/manifest）
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

## 资产清单（首批实现资产 · 状态：0 件落盘，规划 ≤13 件封顶）

| # | 件 | 状态 | 备注 |
|---|---|---|---|
| — | — | 0/13 | 实现轮逐件登记（id/hash/生成器行号）。**方向稿 3 张 + manifest 属 B4 设计件，不计入本封顶口径**（spec.ac-art-2 口径=「首批可见资产」=实现轮交付物） |
