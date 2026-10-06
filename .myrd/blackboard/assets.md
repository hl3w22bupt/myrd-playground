# 资产清单黑板 — g2-blocks（熔炉方块）· **DY 平台段轮**

> 更新时间：2026-10-06 11:0x（开工前置 · 主策划建档；美术线 N3 落产后逐件核销回写）
> 负责人：主策划（整合人）· 美术线维护素材登记 · 程序线维护入包/体积数据 · QA 线维护查表核销
> 下一步：N1 tt↔wx 映射表定稿 → N3 按 N1 规格产 dy 素材（未入链前静态资产只出不冻结）

## 顶部风格卡（全轮唯一风格源 · 沿 A 轮不变，本轮零修订）

- **四要素**：暖色工坊 + 深底金属质感；极简几何色块；零外部贴图；七色矿石色板（唯一真源 = spec `numeric.palette` 冻结块 → `src/render/theme.ts` 生成件，sha256 随件）。
- **派生纪律**：dy 平台素材（分享卡/图标/截图标注）全部从本风格卡派生，**风格四要素零漂移，仅规格裁切**；生成链确定性（重跑逐字节一致），逐件 sha256 入 manifest。
- **UI 接线纪律**：资产缺失走程序化 fallback，绝不抛错（沿一号仓 B1 判例）。

## 一、可复用既有资产（实查登记 · 本轮零触碰原件）

| id/件 | 落点（g2-blocks 仓库根） | 规格 | dy 轮用法 |
|---|---|---|---|
| dy 分享卡 A-07 | `assets/release/share/dy-share-720x1280.png` | 720×1280 | 复用为 dy 分享卡源件（A 轮美术复核 PASS） |
| wx 分享卡 A-06 | `assets/release/share/wx-share-500x400.png` | 500×400（5:4） | 冻结只读；tt↔wx 映射对照物 |
| 实机截图 ×4 | `assets/release/shots/` | 同批 `be310288cff10563` | N3 dy 截图选批候选源（N2 冒烟绿后同批出图） |
| PWA 图标族 | `assets/release/`（A-01..A-05） | — | dy icon 派生源（精确复制派生纪律，沿上轮 wx-icon 判例） |
| 色板交付件 | `assets/palette/palette-n1-final.json`（sha256 `7bc2ca03…`） | 21 对双门禁 | 冻结，不触碰 |

## 二、本轮 dy 素材产线（N3 落产态 · 2026-10-06 回写）

| # | id | 规格（来源=N1 映射表） | 落点（与 wx 包物理隔离） | 状态 |
|---|---|---|---|---|
| 1 | dy-share-card | 720×1280 竖版（dy-diff-09；A-07 精确复制 sha256 `c705aaa6…` 全等） | `assets/dy/dy-share-720x1280.png` + manifest；包内同源件 dy-k6 机判 | ✅ N3 |
| 2 | dy-icon | 512×512 正方形（沿官方核对口径；A-01 精确复制 sha256 `8a971534…` 零漂移机判） | `assets/dy/dy-icon-512.png` + `dy-icon-manifest.json`（幂等重跑逐字节一致） | ✅ N3 |
| 3 | dy 商店截图 ×3 | 390×844 @2x 实机帧；同批判据 = build sha256 `c9d7bffb…` @ `0feac16`；state 现读随件（防摆拍） | `assets/dy/shots/dy-shot-01..03.png` + `manifest.json` | ✅ N3（N2 冒烟绿后同批出图 ✓） |
| 4 | dy 素材核对单 | 四列：资产 id ↔ 规格 ↔ 平台条款 ↔ 参考卡条款 | `assets/dy/dy-assets-checklist.md`（全绿 + 可追溯链） | ✅ N3 |
| 5 | compliance-copy（包内文案位） | 4 slot 冻结文本（dk-acc-4 口径①） | `export/dy/compliance-copy.json`（dy-k7 机判） | ✅ N2 组包面 |

- 派生纪律执行：全部自 A 轮风格卡派生、四要素零 diff；`assets/release/` 装配区与 `assets/wx/` 通道零触碰（派生器只读源件 + sha256 全等机判）。
- 提审日待办（dk-acc-4 口径②）：DC-07 人工核对记录回填 `docs/platform/dy/dy-submission-kit.md` §三（主人侧/提审日）。
- **19 号轮复核（2026-10-06 · HEAD 态只读重验，零改交付物）**：icon/share 派生三面 sha256 全等零漂移（`8a971534…` / `c705aaa6…`）· `assets/release|wx|palette` 零触碰机判（diff=∅）· 规格全中（截图 780×1688=390×844@2x、icon 512²、卡 720×1280）· 截图 manifest 逐件对账 3/3 全等。取证：`gate-logs/dy-port-20261006/19-round-index.md`。

## 三、隔离纪律（红线随件）

- `assets/dy/` 为本轮新增目录，与 wx 提审包（`g2-blocks-wx/`、`assets/wx/`、`assets/release/` 冻结件）**物理隔离**；wx 件只读引用（sha256 全等即零漂移），禁止改写。
- 素材入包决策沿 A 轮口径：分享卡入运行时包；图标/商店截图走提审材料通道不占主包——最终以 N1 入链条款 + N2 组包器断言为准。
