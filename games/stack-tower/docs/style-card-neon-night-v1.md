# 风格卡 A1 ·「霓虹夜塔」（Neon Night Tower）

> **版本：v1.0（冻结）** · 冻结日期：**2026-09-27** · 冻结人：主策划（代持美术线拍板，全程可追溯）
> 上游：spec v1.2（平台 v4，approved `cmuj5f6ik00hkm9l64r5uickm`）assets a08..a20 / entity e-theme-constants
> **生效资产范围：a08-bg-night-gradient、a09..a14-block-skin-base-01..06、a15-fx-cut-face、a16-fx-ripple-ring、a17-fx-perfect-glow、a18-ui-btn-primary、a19-ui-panel-hud、a20-ui-icon-sound（P0 13 件）+ 渲染换装（backdrop/palette/textures/HUD style）**
> 冻结纪律：**本卡冻结前，任何 r4 新资产不得进验收**；冻结后改色/改构图 → 先升卡版本（v1.1+）再动 theme.ts，禁止改码不改卡。

## §1 光照与材质逻辑

- **霓虹自发光体**：塔块为自发光霓虹体，无环境顶光；三面明度差收窄为 **100 : 88 : 76**（theme.LIGHT，替换旧卡 100:78:55 混凝土光照）——保留「越叠越高」的层读数感，同时维持霓虹的夜间发光语义。
- 层递减保留：`LAYER_SHADE_STEP=0.02 / LAYER_SHADE_MIN=0.55`（沿 v0 卡，读数感不回退）。
- 切面 = 唯一高亮判定物：霓虹白（`CUT_FACE=#ffffff`）发光填充形态（渐隐两翼），**无描边**。
- 掉落碎块 = 霓虹熄灭态（`DEBRIS=#141c26` 低明度蓝黑），与可玩域形成生死对比。

## §2 色板（唯一真源 = src/render/theme.ts NEON 表；本卡与 theme 逐字对应）

| 锚 | 值 | 用途 |
|---|---|---|
| NIGHT_SKY_TOP | `#0b1026` | 夜空渐变顶（深靛） |
| NIGHT_SKY_BOTTOM | `#0d2b33` | 夜空渐变底（暗青；**垂直单向渐变**，a08 查表二值判据） |
| BLOCK_NEON_01..06 | `#00e5ff` `#ff2d95` `#ffb300` `#76ff03` `#b388ff` `#ff6d3a` | 塔块六色循环（青/品红/琥珀/青柠/堇紫/霓橙），a09..a14 同源 |
| CUT_FACE | `#ffffff` | 切面高亮（a15） |
| RIPPLE_RING | `#00e5ff` | 塔身涟漪环（a16，additive） |
| PERFECT_GLOW | `#ffe57f` | 完美命中辉光（a17，additive） |
| UI_BTN_PRIMARY | `#00e5ff` | 主按钮边（a18） |
| UI_PANEL_HUD | `#060c1c` @ α0.72 | HUD 面板底（a19） |
| UI_ICON_SOUND | `#9be7ff` | 声音开关图标（a20） |
| HORIZON | `#1b3a4a` | 夜色地平线（1px，α0.4） |

## §3 构图脚本（基准四联图 = 本文 §3 四面板的程序化实现，`tools/gen-neon-reference.mjs`）

- **P1 开局首屏**：夜空垂直渐变满幅 + 3 道塔吊霓虹熄灭剪影（α0.35）+ 地平线 1px；塔基 + 初始摆位 3–5 块（spec e09）+ 摆动块悬停带（塔顶上方两层高）+ 首局引导虚线（首局 layers<2）。
- **P2 游戏中**：叠至中段（8~12 块可见），六色循环读数清晰，HUD 三项（分数/连击/目标）+ 底部操作按钮。
- **P3 perfect 时刻**：塔顶涟漪环扩散（additive，青）+ 切面白高亮 + 完美辉光（additive，琥珀白心）；**无整屏闪光**（world 规则：禁止整屏 aha 通道）。
- **P4 失败与重开**：game-over 帧——失稳块坠落（熄灭态）+ HUD 重开按钮高亮；同一画面是「重开 ≤1.5s」的取证基准构图。

## §4 资产重量预算

- 单资产 ≤50KB、本轮 P0 13 件总预算 ≤300KB（程序化生成，实测以 manifest 为准）；零外部下载、零第三方素材（source=generated 全量）。

## §5 基准四联图（冻结物证）

- 落点：`assets/reference/neon-night-quad-v1.png`（2×2 四面板拼图）+ `assets/reference/neon-night-quad-v1.manifest.json`（sha256 + 逐面板规格）。
- 复现链：`node games/stack-tower/tools/gen-neon-reference.mjs`（真源 theme.ts，确定性）。
- hash 管理改图：改 theme/构图 → 重生成 → hash 变更 → **必须先升本卡版本**，否则查表拒收。

## §6 冻结登记（写回黑板）

- 冻结当日（2026-09-27）已写回 `.myrd/blackboard/assets.md` §r4 风格卡区；验收入口 = `tests/assets-neon-check.mjs`（13/13）→ contract `acc-a8` 同门。
