# material-matrix.md — 《物料代差清单》（封版就绪冲刺 N5 · 游戏美术 · 2026-10-08）

> 平台 × 包版本 × 用途矩阵，逐格标注 **沿用 / 重制 / 冻结候审**；来源 commit 可回溯（源仓 g2-blocks 分支@sha）。
> 三态口径：**沿用**=零改绘直接复用（挂同源 manifest）；**重制**=按平台规格派生（挂 derivedFrom）；**冻结候审**=等链 v7 approve 后再动（本轮零投入）。
> 树锚：web=`main@6d3db6a`（v1.2 部署 r3 发布源，冲刺后=main@`1e3eff4`〔复核轮守卫修复后，效力边界见 `../freeze-sprint-r1-recheck-20261008/`〕）；wx=`wx/port-v1.1@4fba03a`；dy=`dy/port-v1.1@023e583`。

## 一、平台 × 用途矩阵

| 用途 | web v1.2（主线） | wx port-v1.1 | dy port-v1.1 | 代差判定 |
|---|---|---|---|---|
| 风格卡（四要素） | `assets/style-card.json` @ `6d3db6a`（F-03 粒子色源定稿版） | `assets/style-card.json` @ `4fba03a`（分叉时点同步） | `assets/style-card.json` @ `023e583`（同） | **沿用**（v1.2 实测口径 = 定稿；平台线分叉副本与主线四要素零冲突，sync 时随线更新） |
| 冻结色板 | `assets/palette/palette-n1-final.json` @ 主线（7 hex 真源 = spec numeric.palette） | 同源沿用 | 同源沿用 | **沿用**（冻结 token，任何平台不得改绘） |
| 应用图标 512 | `assets/release/icons/icon-512.png` @ `4f67806` 批（A-01 门禁在档） | `assets/wx/wx-icon-512.png` = **沿用（exact-copy 落位）**（derivedFrom icon-512 零裁切零改绘，sha256 `8a971534…` 三向全等，manifest `wx-icon-manifest.json` @ `0485004`）〔复核轮 F-A1 更正：原标「重制派生」，两份 manifest 实为 exact-copy〕 | `assets/dy/dy-icon-512.png` = **沿用（exact-copy 落位）**（同上口径，manifest `dy-icon-manifest.json` @ `a303ccf`） | wx/dy=沿用（exact-copy 提审通道件，不占运行时包）；web=沿用（定稿源） |
| 会话分享卡 | `assets/release/share/wx-share-500x400.png`（A-06，5:4）@ `6fec4a6` 轻更新 | **沿用** web 件（build-wx.mjs 组包断言④绑定复用） | `assets/release/share/dy-share-720x1280.png`（A-07，9:16）→ `assets/dy/dy-share-720x1280.png` = **沿用 exact-copy**（零改绘，sha256 `c705aaa6…` dy 树内双处全等，manifest `dy-share-manifest.json`；= A-07 原批 @`4f67806`，web 主线 F-07 后已更新为 `fe5a20d1…`——**rebase v1.2 后 dy 卡随动，manifest sha256 须重出并按 §二 骨架复验 → 挂 G3〔复核轮 F-A2〕**） | web=定稿源；wx=沿用；dy=exact-copy 沿用（分叉时点版） |
| 朋友圈/落地 1:1 | （wx 1:1 归提审材料通道，本轮**冻结候审**） | 冻结候审 | — | **冻结候审**（渠道业务参数挂 G-Q2，主人拍板后随链修订定稿） |
| 商店截图 | —（web 无商店面） | 商店截图选批定稿 @ `eb9ddab`（N3 补做轮二） | `assets/dy/shots/dy-shot-01..03` @ `a303ccf`（同批实机 ×3 + 四列核对单） | wx/dy=沿用（提审材料，版本随包） |
| 实机截图（同批证据） | `assets/release/shots/01..04` @ `4f67806` 同批（shot-manifest.json sameBatchCriterion=buildSha256） | 分叉时点同批副本 | `assets/dy/shots/` @ `a303ccf`（dy 同批） | **沿用**（跨平台不混批：每平台挂自己的 shot-manifest） |
| PWA favicon ×3 | `assets/release/favicon/` @ `4f67806` 批 | — | — | **沿用**（web 专属） |
| OG 分享卡 1200×630 | `assets/release/share/og-1200x630.png` | — | — | **沿用**（web/PWA 专属） |
| 手感 pack 四件（a04..a07 数据源） | `assets/feel/{motion,particle,ui-feel,daily-entry}-pack.json` @ `6d3db6a`（F-01..F-07 校样 + gen-feel-pack 同源重出） | 未含（分叉早于链 v4） | 未含（同） | web=沿用定稿；平台线 **冻结候审**（随下轮 sync 携入，数值取链 numeric.feel） |
| SFX 计划件 | `assets/a03-sfx-plan.json`（三档 + 变参） | 同源沿用 | 同源沿用 | **沿用** |
| 描述件（board-tiles/backdrop/ui-tokens/MAPPING） | `assets/e-*.json` + `MAPPING.md` @ `c425e1f` 批（A-12/13/14 修复后） | 同源沿用 | 同源沿用 | **沿用** |

## 二、三平台共用分享卡模板骨架（模板 = 版式契约，非成图）

```
share-card-template（单源版式 → 平台尺寸派生）
├─ 画布：主视觉 62%（上 5/8）＋ 信息区 38%（下 3/8）；安全边距 8%
├─ 背板：BACKDROP 三停靠渐变（bgDeep→bgPanel，token 单源，零裸色）
├─ 主视觉区：炉板 8×8 局部（block-02/block-04 暖区主 K）+ accentWarm 单色粒子点缀（F-03 口径）
├─ 信息区三行：
│   ① 标题行「熔炉方块」（textPrimary，样式取 typeScale.title 派生）
│   ② 一句话「连击不断火就越旺」（textDim）
│   ③ 行动行「立即开炉」（accentWarm 底 + 深字）
└─ 平台派生：wx 500×400(5:4) / dy 720×1280(9:16，主视觉上移至 52%) / og 1200×630(主视觉左置 55%)
```
- 派生纪律：改模板 = 改本骨架 → 重出三平台件并更新各自 manifest sha256；**分享卡上的玩法数值/文案零承诺**（G-Q2 渠道业务参数归主人）。

## 三、wx 侵权比对（克制口径 · 美术面自查）

| 比对项 | 现状 | 结论 |
|---|---|---|
| 名称/标识 | 「熔炉方块 / g2-blocks」自创命名；icon 为自绘几何块派生（非任何第三方标识） | 无冲突 |
| 官方条款核对 | wx 提审轮已做官方条款原文拉取（1.2.2/3.6.5/3.6.2/3.2.9/3.6.6 @ `0485004`）+ wk-acc-3 隐私弹窗运行时落地（`ed172e1`） | 已核，随包提审 |
| 视觉素材 | 零外部贴图（ac-13 契约面）；色板/版式均为自研 token 派生；分享卡无第三方 IP 元素（角色/商标/授权字体） | 无冲突 |
| 音频 | 合成器程序化生成（a03 计划件，无采样第三方音乐） | 无冲突 |
| 遗留风险 | 分享卡文案若含渠道业务话术（落地页等）→ G-Q2 挂主人 | **候审**（不阻塞） |

## 四、dy 克制版分享文案（候选三选一，随包提审用；终稿归主人/运营拍板）

1. 「在 8×8 的炉板上凑三连——连击不断，火就越旺。」
2. 「差一步就炉冷了，来替我接手这炉。」（near-miss 向，与候选池 1 联动）
3. 「今天的第一炉，趁热。」（daily 向）

- 克制纪律：零夸张词、零数值承诺（「+999」类禁用）、零竞品对比；不含渠道业务参数（落地页/标语归 G-Q2）。

## 五、登记回写

- 本矩阵结论已回写黑板 `assets.md`「封版冲刺物料矩阵登记区」与顶部风格卡（V1.2 实测固化口径注记）。
- 素材归档挂来源 commit：见矩阵「来源」列（全部可 `git -C <树> show <sha>:<path>` 回溯）。
- 本轮零新绘/零改绘（红线：物料矩阵轮零新风格线投入）；分享卡模板骨架为版式契约文档，非成图交付。

## 六、美术线复核轮增记（2026-10-08 · 游戏美术 · 不采信台账实跑复核）

> 触发：任务重派后的实跑复核纪律（同程序线复核轮口径）。复核器 = `gate-logs/freeze-sprint-r1-art-recheck-20261008/art-trace-check.mjs`（本目录在档可重跑）。
> 结论：**物料回溯机判 11/11 PASS EXIT=0**（T-01..T-11：风格卡/色板锚/双图标 manifest 三向全等/分享卡血缘/商店截图选批/手感 pack/发布面 9 件零漂移/模板-侵权-文案红线/world-tone 同源）+ 机器门禁自跑全绿（palette ALL-GREEN 21 对 · Mode A 契约 18/18 · 三树红线 6/6 @ web `1e3eff4`/wx `4fba03a`/dy `023e583`）。

| 编号 | 发现 | 处置 |
|---|---|---|
| F-A1 | 矩阵 M-02/M-03 三态标「重制」，但 `wx-icon-manifest.json` / `dy-icon-manifest.json` 均写 `exact-copy（零裁切零改绘，sha256 全等）`——按本矩阵自身三态定义（沿用=零改绘直接复用）应标「沿用」 | ✅ 已更正（§一 应用图标行 + 黑板登记行同步）；sha256 链不受影响（三向全等 `8a971534…` 机判） |
| F-A2 | dy 包分享卡 = A-07 原批 `c705aaa6…`（v1.1 分叉时点）；web 主线 F-07 轻更新后 = `fe5a20d1…`。rebase v1.2 后 dy 卡将随 merge 更新 → `dy-share-manifest.json` sha256 须重出 + 按 §二 骨架复验版式 | 挂 G3（平台线对齐 gate）美术面输入；rebase 执行时由美术线随动复验 |
| 观察项 | wx 商店截图「选批定稿」= `docs/platform/wx/wx-submission-kit.md` 决策记录（@`eb9ddab`），非独立 PNG 落 assets/——矩阵口径与实物一致，登记备查 | 无需处置 |
