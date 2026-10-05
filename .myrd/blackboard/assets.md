# 资产清单黑板 — g2-blocks（熔炉方块）· **WX 移植提审轮**

> 更新时间：2026-10-05 12:50（开工 · 主策划建板）
> 负责人：主策划（整合人）· 美术线维护素材登记 · 程序线维护入包/体积数据 · QA 线维护查表核销
> 下一步：N2-P1 逐资产包体实测数据回写本板；N3 图标规格核对回写本板

## 顶部风格卡（全轮唯一风格源 · 沿 A 轮不变）

- **四要素**：暖色工坊 + 深底金属质感；极简几何色块；零外部贴图；七色矿石色板（唯一真源 = spec `numeric.palette` 冻结块 → `src/render/theme.ts` 生成件，sha256 随件）。
- **派生纪律**：wx 平台素材（图标/分享卡/隐私弹窗视觉稿）全部从本风格卡派生，**风格四要素零漂移，仅规格裁切**；生成链确定性（重跑逐字节一致），逐件 sha256 入 manifest。
- **UI 接线纪律**：资产缺失走程序化 fallback，绝不抛错（沿一号仓 B1 判例）。

## 一、v1.1 基线既有资产（可直接复用 · 实查登记）

| id/件 | 落点（以 g2-blocks 仓库根为基准） | 规格 | 状态 |
|---|---|---|---|
| PWA 图标（含 maskable）/ favicon / OG | `assets/release/`（A-01..A-05，9 件 @ `c425e1f`） | 见 `docs/release-readiness.md` §C | ✅ 美术复核 PASS（A 轮） |
| wx 分享卡 | `assets/release/`（A-06 · 500×400，5:4） | 会话分享主判据配图 | ✅ 美术复核 PASS（A 轮）· wx 轮**直接复用** |
| dy 分享卡 | `assets/release/`（A-07 · 720×1280） | — | ✅（本轮零触碰，仅登记） |
| 实机截图 ×4 | `assets/release/shots/` | 同批 `be310288cff10563` 门四机判 | ✅ 可作提审截图候选源 |
| 色板交付件 | `assets/palette/palette-n1-final.json`（sha256 `7bc2ca03…`） | 21 对双门禁 | ✅ 冻结 |

## 二、本轮 wx 素材产线（N3 落产后逐件登记）

| # | id | 条目 | 落点 | 规格 | optional | 状态 |
|---|---|---|---|---|---|---|
| 1 | wx-icon | wx-submission-kit | 待 N3 定（源 = PWA 图标派生裁切） | 以微信官方文档核对为准（N3 记录条款编号+证据路径） | 否 | ⏳ N3 |
| 2 | wx-share-card（复用 A-06） | wx-share-loop | `assets/release/` 既有件 | 500×400（5:4） | 否 | ✅ 复用 |
| 3 | privacy-popup 视觉稿（一稿三态） | wx-submission-kit | `docs/platform/wx/privacy-popup-visual.md` | 文字规格稿（零新贴图，极简几何 DOM 直绘） | 否 | ⏳ N3 |
| 4 | 商店截图（≥3） | wx-submission-kit | 候选源 `assets/release/shots/` | 以官方核对为准 | 否 | ⏳ N4 选批 |

## 三、入包清单与包体数据（N2-P1 实测后回写 · 对 4MB 主包红线）

> 实测方法披露：`ls -l` 原始字节 + `gzip -9` 可压缩性 + 分包性判定；数据来自 v1.1 基线 `fe5fd38` worktree 实构建产物，**非估算**。明细档：`docs/platform/wx/bundle-size-audit-v11.md`（wx 分支）。

| 项 | 数据 | 状态 |
|---|---|---|
| v1.1 构建产物总原始体积 | ⏳ N2-P1 回写 | ⏳ |
| gzip -9 后总体积 | ⏳ N2-P1 回写 | ⏳ |
| 主包红线余量（4MB） | ⏳ N2-P1 回写 | ⏳ |
| 素材入包决策（哪些进主包/哪些不进） | ⏳ N3↔N2 合议后回写 | ⏳ |
