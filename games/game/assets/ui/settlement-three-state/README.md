# settlement-three-state — 结算三态 UI 稿（9/21 收口冲刺 · 美术批次）

> 三态口径（主策划 9/21 定义）：**WIN 达标过关 / LOSE 步尽判负 / RESUME 局中离开后续玩**。
> 对应 spec 元素：`l1/e5`（胜负遮罩 Overlay，WIN/LOSE 双态）+ `l1/e3`（开始遮罩 StartOverlay，RESUME 态）。
> 交付标准（任务原文）：程序确认可「只改数值/换资源、不改结构」接线。
> 本稿 = **数值规格 + 视觉稿**；接线只动 `games/game/scenes/main.tscn` 的呈现属性，
> **节点结构、控件名、unique name、文案常量（main.gd TEXT_*/BTN_*）全部不动**（契约 E 组锁文案）。

## 0. 风格卡引用（派生来源，见黑板 assets.md §0）

| 要素 | 本稿取值 | 派生关系 |
|---|---|---|
| 色彩 | 遮罩底 = `Color(0.065, 0.055, 0.12, 0.9)` | 深紫底板 `Color(0.13,0.11,0.24)` 对半压暗 + alpha 0.9（棋盘残影可辨，聚焦结算层） |
| 反馈色 | 主按钮/标题 = 金 `Color(1, 0.85, 0.35)` | 与消除粒子/飘分 `FX_COLOR_GOLD` 同源 —— 结算与局内反馈同一奖励语言 |
| 线条 | 次按钮 = 金描边 2px 幽灵样式，无投影无渐变 | 极简几何（Polygon2D 色块），不引入贴图与描边风格漂移 |
| 比例 | 竖屏 720×1280；圆角半径 14 | 糖果半径 38 / 格 96 的圆几何语言的小尺度缩放 |

## 1. 层级与间距（每态）

### WIN / LOSE（共用 Overlay，竖排四层）

| 层 | 控件（已存在） | 锚位 | 字号 | 颜色 | 间距语义 |
|---|---|---|---|---|---|
| L1 标题 | OverlayTitle | anchor_y 0.34 | 60 | 金 `Color(1,0.85,0.35,1)` | 视觉焦点，占视口上 1/3 |
| L2 分数 | OverlayScore | anchor_y 0.455 | 26 | 白 90% | 标题下 0.115 视口 |
| L3 提示 | OverlayHint | anchor_y 0.50 | 19 | 白 75% | 分数下 0.045 视口 |
| L4 主按钮 | OverlayActionButton | anchor_y 0.55 | 26 | 深紫字 + 金底 | 320×104（≥96 热区） |

### RESUME（StartOverlay 变体，竖排四层）

| 层 | 控件（已存在） | 锚位 | 字号 | 颜色 | 间距语义 |
|---|---|---|---|---|---|
| L1 标题 | StartTitle | anchor_y 0.33 | 56 | 金 | 与 WIN 标题同带位（±0.01 视口内） |
| L2 副标题 | StartSubtitle | anchor_y 0.42 | 17 | 白 70% | 含 SCORE 恢复值，等宽信息行 |
| L3 主按钮 | StartButton（继续） | anchor_y 0.52 | 30 | 深紫字 + 金底 | 320×110（≥96 热区） |
| L4 次按钮 | NewGameButton（新开） | 主按钮下 12px | 22 | 金字 + 金描边 | **320×96（原 60 → 已改，热区达标）** |

## 2. 按钮 StyleBoxFlat 数值（主/次各三态外观，共 6 个 sub_resource）

| 样式 | bg | 描边 | 字色 | 用途 |
|---|---|---|---|---|
| primary_normal | 金 `Color(1,0.85,0.35,1)` | 无 | 深紫 `Color(0.13,0.11,0.24,1)` | NEXT / RETRY / CONTINUE |
| primary_hover | 金+亮 `Color(1,0.9,0.52,1)` | 无 | 深紫 | 同上悬停 |
| primary_pressed | 金−暗 `Color(0.85,0.72,0.28,1)` | 无 | 深紫 | 同上按下 |
| ghost_normal | 透明 `Color(1,1,1,0)` | 金 2px | 金 | NEW GAME |
| ghost_hover | 白 5% `Color(1,1,1,0.05)` | 金 2px | 金 | 同上悬停 |
| ghost_pressed | 白 10% `Color(1,1,1,0.1)` | 金 2px | 金 | 同上按下 |

公共值：`corner_radius = 14`（四角）；`content_margin = 18/14/18/14`。

## 3. 程序接线清单（本批已接，二次复验只需核对）

| # | 落点（main.tscn 唯一改值处） | 改动 | 性质 |
|---|---|---|---|
| 1 | `UI/Overlay` color | `0.82→0.9` alpha + 底板同源色 | 呈现值 |
| 2 | `UI/StartOverlay` color | 同上 | 呈现值 |
| 3 | `UI/Overlay/OverlayActionButton` | +字体色 ×4 +样式 ×3（primary） | 呈现值 |
| 4 | `UI/StartOverlay/StartButton` | +字体色 ×4 +样式 ×3（primary） | 呈现值 |
| 5 | `UI/StartOverlay/NewGameButton` | +字体色 ×3 +样式 ×3（ghost）+ `offset_bottom 182→218`（热区 60→96） | 呈现值 |

**未动**：节点树、控件名、`unique_name_in_owner`、main.gd 全部常量与逻辑、HUD/Restart/Mute 按钮样式（后者不在三态范围，留待后续批次按同卡派生，避免本批扩面）。

## 4. 验收口径对照（assets.md §1.6 四条）

1. **三态各有标题/按钮/层级/间距设计** → §1 两表 + `preview/` 三张视觉稿。
2. **触摸热区 ≥96 设计像素** → 主按钮 104/110，次按钮 96（本批修正），全部达标。
3. **文案进子集字体覆盖范围** → 三态文案未改（契约锁 `BTN_NEXT/BTN_RETRY/BTN_CONTINUE` 与
   `TEXT_WIN/TEXT_LOSE/TEXT_RESUME_*`），中文「下一关/再来一局/继续游戏/新的一局/开始游戏/糖果粉碎传奇」
   均为现网已在跑字符，NotoSansSC 子集已覆盖（preflight P13 机判工程级保障）。
4. **程序确认「只改数值/换资源」成立 + 复跑 FX_SETTLE_PERSIST 通过** → 本批接线后复跑：
   契约 PASS（见黑板 gate-logs 9/21 美术批次目录）+ 契约 46 PASS + verify.sh preflight/smoke PASS；
   「程序确认」与真机触摸复跑归程序侧二次复验，本稿不代出。

## 5. 每态差异化（可选接线值，程序二次复验时自决）

- LOSE 标题可切暖橙 `Color(1,0.62,0.35,1)`（HUD 行内消息同色族，判负语义）。WIN/LOSE 共用
  OverlayTitle 控件，静态场景值只能取一份 —— 若接，需在 `_show_overlay` 按态切色（一行呈现层代码），
  属程序改动面，美术本批不动码。
- RESUME 主按钮文案「继续游戏 CONTINUE」与 WIN/LOSE 按钮同 primary 样式（续玩的正反馈语义归金色系，
  不另设第三套色）。

## 6. 动效纪律（文档值，本批不接线）

三态遮罩沿用现有 `visible` 瞬时切换（0 帧延迟）。若后续加入场动效，**只允许**风格卡动效行既有语言
（TRANS_BACK 0.16s 缩放），禁止新增长动效 —— 局末节奏与契约 A 组「反馈同帧」纪律的 UI 侧对应。

## 7. 视觉稿清单（`preview/`，引擎零导入）

| 文件 | 对应 spec 元素 | 态 |
|---|---|---|
| `preview/l1-e5-overlay-win.svg` | l1/e5 胜负遮罩 | WIN |
| `preview/l1-e5-overlay-lose.svg` | l1/e5 胜负遮罩 | LOSE |
| `preview/l1-e3-startoverlay-resume.svg` | l1/e3 开始遮罩 | RESUME |

> `preview/` 目录含 `.gdignore`：Godot 不扫描不导入，工程运行时保持「无外部贴图依赖」为真；
> 视觉稿仅供人工验收（主人 M1 终验）与二次复验比对，不是运行时资产。

## 8. 换资源口径

若未来允许贴图化（需先改 approved spec 的 `world.art_style`，当前禁止）：以 §2 的 6 个样式槽位为
换资源接缝（StyleBoxFlat → StyleBoxTexture，槽位同名同义），控件结构与本表数值不动 —— 与黑板
assets.md §1.5「换资源口径」同一条纪律。
