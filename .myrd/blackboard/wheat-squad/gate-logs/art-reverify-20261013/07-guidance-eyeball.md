# ⑦ 目检面 · §v1.2 引导横幅实现逐项符合性亲审（游戏美术 · HEAD c33a816）

> 依据 machine-then-eyeball：机检四项全绿后逐项目检。受审件 = `games/wheat-squad/src/render/renderer.ts#drawGuidance`（:101-114）+ `game.ts` 接线（:14, :92-94, :124-127）。
> 审核基准 = `style-card-v1.md` §v1.2（引导元素视觉权重规则定稿）。

| §v1.2 规则 | 实现实测 | 判定 |
|---|---|---|
| 底板 panelCream（skyCream α0.96）填充 + wheatDeep 2px 描边 | `fillStyle=THEME.panelCream` · `strokeStyle=THEME.wheatDeep` · `lineWidth=2` | ✅ |
| 文字 inkBrown · 600 · 14px；**禁 accentRed** | `fillStyle=THEME.inkBrown` · `font='600 14px system-ui'`；函数体无任何 accentRed 引用 | ✅ |
| 几何 86% 宽 × 44px，y=12%，文案水平居中 | `w=L.w*0.86, h=44, y=L.h*0.12` · `textAlign='center'` · `fillText(text, L.w/2, …)` | ✅ |
| 时窗 首局 running 前 4s（spec numeric.guidance.hintSec=4）；无淡出动效 | `game.ts:92-94` hint_shown once@atMs=0；drawGuidance 无逐帧 α/位移动画代码（零动画纪律） | ✅ |
| 层级 HUD 之上、scrimInk 遮罩与结算面板之下 | 绘制序：`drawHud`(:124) → `drawGuidance`(:127) → scrim(:139) → panelCream 面板(:164)，后绘者在上，序即层级 | ✅ |
| 文案 G-1 逐字单源 | `GUIDANCE_TEXT='拖动队长移动 · 队员自动作战'`（game.ts:14）= manifest `guidance-hint-banner.copy` = style-card G-1，三方同名 | ✅ |
| 权重自检（不夺焦：引导为轻提示） | 44px 高横条 + α0.96 浅底，无 accentRed、无强描边加粗；红色通道独占归 HP/受击/击杀反馈（drawHud HP 点 :123 用 accentRed 属正通道） | ✅ |

## 排版核对（§v1.2 复算）

- G-1 = 13 全角字符 + 2 间隔点 ≈ 14px 档实测宽 ~180px < 引导条 86% 宽（390×0.86 ≈ 335px）→ 一屏放下，无截断风险。
- 44px 高档内垂直居中（`y + h/2 + 5` 基线补偿），无溢出。

## 目检结论

**PASS** —— §v1.2 七项规则与实现逐项符合，零漂移零超权。目检对 `c33a816` 有效（交付件对 N8 锚 `304dacf` 逐字节零漂移，见 `05-asset-zero-drift.log`，故亦覆盖 N5 QA 互查时的 `c4348e1` 交付态）。
