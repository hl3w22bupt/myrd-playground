# 资产清单黑板 — g2-blocks（熔炉方块）· **WX 移植提审轮**

> 更新时间：2026-10-05 14:3x（N3 补做轮二 · 游戏美术核销回写：**分享环生产接线落地** + 商店截图选批定稿 · 详见 g2-blocks-wx commit `eb9ddab`）
> 负责人：主策划（整合人）· 美术线维护素材登记 · 程序线维护入包/体积数据 · QA 线维护查表核销
> 下一步：等主人拍板（提审与否 + AppID/资质 + 隐私指引填报）；美术线本轮无待办

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
| 1 | wx-icon | wx-submission-kit | ✅ `g2-blocks-wx@0485004` `assets/wx/wx-icon-512.png`（源 = A-01 icon-512 **精确复制派生**，零裁切零改绘 → sha256 全等 `8a971534…` 即零漂移机判；派生器 `tools/gen-wx-icon.mjs` 幂等两遍逐字节一致实测） | 512×512 正方形 PNG · 14,564B；官方原文核对 **5 pass**（1.2.2(1)(2)(3) 清晰度/名实一致/无官方标识 · 3.6.5 有色深底非白底 · 直角无外框圆角）+ **1 残余 🟡** 像素数值后台实时清单勾对（官方文档不载像素数）；逐条证据 `assets/wx/wx-icon-manifest.json` clauses + 自查表 §A-1/§E | 否（提审材料通道，不占主包——组包重跑指纹机判 wx-icon 不在包内） | ✅ N3 补做轮 |
| 2 | wx-share-card（复用 A-06） | wx-share-loop | `assets/release/share/wx-share-500x400.png` → 组包 `export/wx/assets/` 同名（sha256 随 assets-manifest.json） | 500×400（5:4） | 否（入包） | ✅ 复用 + **已功能性接线**（eb9ddab）：接线点 = `tools/build-wx.mjs` game.js 模板（路径字面量单源，shareImageUrl 注入）→ `boot-wx.bootWx(opts)` → `share.wireSharePassive(wx, clock, imageUrl)` → 被动通道 `onShareAppMessage`+`showShareMenu` 同卡同参；接线前包内卡为死重（上轮缺口，本轮修复）· wx-s7/s8/s9 先红后绿 9/9 · ac-13 零贴图门禁保持绿（src 零字面量，红原件 24a 号在档） |
| 3 | privacy-popup 视觉稿（一稿三态） | wx-submission-kit | `docs/platform/wx/privacy-popup-visual.md`（g2-blocks-wx 在盘 · N3 补做轮补官方条款锚 3.6.2/3.4.1） | 文字规格稿（零新贴图，极简几何 DOM 直绘）；三态 + 触发时机（first-frame-interactive · 非阻断 · 非开始玩前置）+ 首启路径示意齐备；机读投影 `export/wx/privacy-popup.json` wx-k5 机判 | 否 | ✅ N3（含补做轮条款锚） |
| 4 | 商店截图（≥3） | wx-submission-kit | ✅ 选批定稿（eb9ddab · kit §四）：**01 首启引导 / 03 连击 ×7 / 04 关卡目标差异** 三张，逐张 3.2.9/清晰度/实机性 pass，sha256 随批 `be310288…`；落选 02（与 03 同关同构）理由随件；主人提审时照单上传，QA/主人可否决改批 | 后台实时清单为准（通行 3–5 张实机）· 残余 🟡 = 后台张数/尺寸勾对 | 否（提审材料通道） | ✅ N3 补做轮二（原 N4 选批项由美术先定建议稿） |

## 三、入包清单与包体数据（N2-P1 实测 + N2-P2 组包终态回写 · 对 4MB 主包红线）

> 实测方法披露：statSync 原始字节 + zlib.gzipSync level 9；机器输出原件 `gate-logs/wx-port-20261005/01-bundle-size-raw.json`（v1.1 web 面 22 件）与 `10-wx-bundle-audit.json`（wx 包逐件）。明细档：`docs/platform/wx/bundle-size-audit-v11.md`。

| 项 | 数据 | 状态 |
|---|---|---|
| v1.1 构建产物总原始体积（web 面 22 件） | 87,213 B（85.2KB）· gzip 35,749 B | ✅ 实测 |
| wx 提审包（export/wx/ 30 件） | **132,607 B（129.5KB）· gzip 73,148 B** | ✅ 实测（N4 复检器独立重跑） |
| 主包红线余量（4MB） | 用量 **3.16%** · 余量 4,061,697 B | ✅ wx-k4 机判 |
| 分包决策 | **不分包**（逻辑面 83.4KB + wx 件；零素材程序化绘制） | ✅ |
| 素材入包决策 | 入包：5:4 分享卡（A-06 复用，32,284B，sha256 随 `assets-manifest.json`）+ privacy-popup.json（机读投影）；不入包：PWA 三件（sw/manifest/index.html，断言机判）+ 商店截图/图标（提审材料通道，不占运行时包） | ✅ N3↔N2 合议定稿 |
