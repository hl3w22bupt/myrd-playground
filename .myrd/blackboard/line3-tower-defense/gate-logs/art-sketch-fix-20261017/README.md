# 美术复证轮：B4 方向稿缺陷修复 + 独立零漂移实证（2026-10-17 · 游戏美术）

## 轮次定位

双轨轮后的美术线复证轮（redispatch 差异核查结论：两轨主线已由程序线在 `476090c` 收口，本轮零主线重做；本目录为美术线名下此前**无落盘证据**的方向稿交付做实补证 + 目检发现的缺陷修复）。

## 目检发现与处置（3 项）

| # | 发现 | 定性 | 处置 |
|---|---|---|---|
| 1 | Lv3 炮塔出画：布点 `cx=240+224i` → 第三座 cx=688 > 画布 640，三阶成长对比（方向稿核心目的）实际只显示 2 座 | 方向稿视觉硬伤（美术面） | 布点改 `128+176i`（128/304/480），射程圈 r=56 全画内且右缘 536 < 核心左缘 544 无重叠 |
| 2 | `mix()` 输出小写 hex（如 `#81b29a`），与 spec 白名单 `#81B29A` 逐字符比对存在机判误报隐患 | 机判一致性隐患 | 输出大写规范化；修复后 Lv1 基色与白名单逐字符全等 |
| 3 | 生成器 token 为静默镜像 theme.ts，无漂移拦截；且方向 2/3 候选混合比（0.1/0.3/0.5、0/0.15/0.35）与 theme.ts DERIVE（0/0.2/0.4）不同源声明 | 风格漂移隐患（token-single-source 口径） | 生成器启动自校验（PALETTE 8 色 + 基线混合比对 theme.ts 逐值比对，漂移即 exit 1 fail-closed）；方向 2/3 标注「候选」，图内标签加（候选）标记 |

## 确定性实证（不与生成器 stdout 互证）

- 旧稿基线（git `0ac1fcf` 版）：`117d9680…` / `10e706e1…` / `984f056c…`（00 号日志 git show 实算）
- 修复后连续两次重跑 sha256 逐字节一致：`09c4d565…` / `7fda59ec…` / `4185b770…`（00 号日志）
- 独立审计 23 项全 PASS（02 号日志）：manifest sha256 逐件实算对拍 + 色值 ∈ 白名单∪独立重算派生集 + 零渐变零滤镜 + 全元素画布内 + 构成件尺寸（炮塔 24/26/28·敌军 14/16/20·核心 64×64）+ HUD 样例值 ≡ spec numeric（coreLives 10 / startGold 120 / victoryWaves 8）
- 新增件：`assets/style-sketch/manifest.json`（逐件 file/sha256/seed/turretMixT/label，ac-art-2 转真形态预演）+ `tools/style-sketch-audit.mjs`（独立审计，零 hex 字面量）

## 跨线认领登记（cross-line 纪律）

`games/line3-tower-defense/tools/style-sketch.mjs` 在黑板 assets.md 头部分工中名义归游戏程序（生成器/manifest）。本轮美术线以「美术交付件视觉合规面」名义直接修复（判例：presentation-layer-jurisdiction），**palette 8 色与派生规则零触碰**（既有 hex 字面量逐值未动，仅加自校验与注释），改动面=布点常量/mix 大写化/自校验块/manifest 输出。**请游戏程序线下轮复签**；如有异议走黑板回退。

## 范围外声明（轨道 A 美术面）

- 轨道 A 线 2 A3 互斥判定 = 红 0 且非全绿 → **「固化+提审就绪」分支不触发**，icon/截图/演示素材**本轮不产**（a2-verdict-20261017.json branchDecision.A3 原文为据）；提审素材止步口径维持升级主人（W-6 线）。
- 实现轮首批资产（≤13 件封顶）维持 0 件：方向稿 3 张 + manifest 属 B4 设计件，**不计入** ac-art-2 首批封顶口径（登记于 assets.md 资产清单备注）。

## 证据清单

| 文件 | 内容 |
|---|---|
| `00-sha-baseline-and-regen.log` | 旧稿 git show 实算 sha + 修复后两次重跑输出 + shasum 独立实算 |
| `02-audit.log` | 独立审计全量输出（23 PASS · AUDIT_EXIT=0） |
