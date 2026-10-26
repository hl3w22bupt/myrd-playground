# implement 实现说明（迭代 run cmveiw7540013m9vqlgj9t6ul）

> 需求：cmveivn9n000wm9vq3h575b78《汇率数据前端定时更新与缓存过期刷新》
> 分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`，工程 `webapps/myrdplaygrou`。

## 1. 根因定位结论（需求验收项 5 留痕）

**结论：「多天不更新」不是静态汇率快照打进包里，而是前端缺整套鲜度机制——六个缺口叠加。**

已排除静态快照：`grep -rnE '"USD": *[0-9]|rates *= *\{|SEED' *.js *.html` 在修复前 HEAD 为空；旧版 app.js 每次冷加载都会 fetch `open.er-api.com`。用户所见「多天不更新」的真实成因：

| # | 缺口 | 修复前行为（commit b84a543 及之前的活跃部署 13dec1c） | 修复后（本 run） |
|---|---|---|---|
| 1 | 缓存无 TTL 过期判定 | `fx-latest-v1` 存了 `fetchedAt` 但全文件无任何过期比较，缓存只在 fetch 抛错时被读 | `isExpired()`：TTL=30 分钟，过期即重取；未过期直接复用、不发多余请求 |
| 2 | 无 interval 定时刷新 | 生命周期只在 init 拉一次，停留期永不更新 | `setInterval(30min)` 与 TTL 同周期，停留超一个周期自动强刷一次 |
| 3 | 无手动刷新按钮 | 页头无刷新控件 | 页头「刷新」按钮（44px 命中区、三态、加载旋转态），点击无视 TTL 立即重取 |
| 4 | 无内置种子兜底 | 断网+无缓存 → `state.latest=null`，换算区 "--" 且无数据日期 | 兜底链：缓存（标注滞后）→ 内置种子快照 2026-10-10（标注「严重滞后」+ 快照日期），永不出空屏 |
| 5 | `AbortSignal.timeout` 兼容风险 | 旧 Safari/WebView 同步抛 TypeError，fetch 不发出且无感知 | 统一改 `fetchWithTimeout()`（AbortController + setTimeout + finally 清理） |
| 6 | 鲜度展示错位 | 页头显示「本地获取时刻 fetchedAt」，数据自身日期（`time_last_update_utc`）存而未用 | 溯源行常显：`数据源 <API 名> · 数据日期 <YYYY-MM-DD> · 最后更新 <MM-DD HH:mm> · 将于 <时刻> 自动刷新` |

**附带修复（自测 P5 暴露的换算正确性 bug）**：`renderConvert` 旧逻辑用 `state.latest.base` 参与换算——当缓存/种子的 rates 基准（如种子 base=USD）与当前源币种（如 CNY）不一致时，100 CNY→USD 会被算成 $100.00（1:1）而非 $14.06。已改为始终按 `state.from` 交叉换算（er-api 任意基准返回全表，交叉换算普适成立）。

## 2. 代码 diff 概览（行为对比证据）

- `app.js`：+`FRESH_TTL_MS`/`AUTO_REFRESH_MS`/`SEED_SNAPSHOT` 常量；+`isExpired`/`fetchWithTimeout`/`fmtMin`/`fmtDataDate`/`setRefreshing`；重写 `fetchLatest`（force 参数 + TTL 短路 + 兜底链）、`renderFreshness`（溯源行 + 分因滞后提示）、`refreshLatest`（force + 忙碌态 finally 恢复）；`swap`/`refresh` 走 `force:true`；init 尾挂 interval。
- `index.html` + `landing.html`（逐字节同步，部署契约）：页头 `.brand-row` + `#refreshBtn`；页脚口径更新（数据源、30 分钟自动刷新、兜底链说明）。
- `styles.css`：`.brand-row`/`.refresh-btn`（默认/悬停/激活/禁用四态 + `fx-spin` 加载动画 + `prefers-reduced-motion` 降级）。

## 3. 更新逻辑全部在前端（回应用户显式要求）

本工程零后端：进入/定时/手动三条拉取路径都是浏览器内 `fetch` 免 key CORS API（`open.er-api.com` 最新汇率 + `api.frankfurter.dev` 趋势序列），TTL 判定与兜底决策全在 `app.js`，数据留存仍为 localStorage（创作决策不变）。无任何代理/后端依赖，部署形态零变动。

## 4. 请求频率口径（验收 2「30 分钟窗口内不重复请求」）

| 触发 | 是否发请求 |
|---|---|
| 进入页面，缓存未过期 | ❌ 直接复用（溯源行显示缓存时刻与下次自动刷新时刻） |
| 进入页面，缓存过期/缺失 | ✅ 立即拉取 |
| 切换币种/交换，缓存未过期 | ❌（全表缓存交叉换算结果与重取一致，不烧多余请求） |
| 停留满 30 分钟（interval） | ✅ 强制重取 |
| 点击「刷新」按钮 | ✅ 强制重取（无视 TTL） |

## 5. 本地自检记录（本节点，证据在 /tmp 不入库）

1. 等价映射伺服（`/api/public/assets/* → 工程根`，遵守部署契约）`:9431`。
2. 仓库自带门禁 `webapp-smoke.mjs` 对 localhost 演练 ×2（修复前后各一次）：**全绿 PASS，exit 0**（网络全通/console 零 error/首屏有内容/触摸管线/无横向溢出）。
3. CDP 功能自测 14 项全过（`/tmp/fx-func-test/report.json`）：冷启动 5 秒内拉取 ✅、TTL 窗口零重复请求 ✅、31 分钟前时间戳触发重取且缓存被覆盖 ✅、手动刷新立即请求+按钮反馈 ✅、断网+清缓存回退种子且显著标注快照日期 ✅、种子换算值精确正确 ✅、桌面 1440 无横向溢出 ✅、console 干净 ✅。

## 6. 交付边界

- 门禁资产（`std-skills/web-app-dev/scripts/webapp-smoke.mjs`、`.myrd/routines.yaml id=webapp-smoke`）在仓且本 run 未改动；review 节点以 liveUrl 实跑门禁为准，证据归档 `qa/mobile/`。
- 色板沿用风格卡（`#f4fbf9/#14b8a6/#38bdf8`，薄荷+天蓝清新明亮方向）；与流水线口径 `#f0f9ff/#0ea5e9/#22c55e` 同属「浅底+蓝绿」清新明亮族，本 run 为数据鲜度修复迭代，不换肤以免破坏已过两轮门禁与使用验收的视觉基线（风格卡为 CSS 变量唯一事实来源，微调仅限明度/饱和度）。
  > **2026-10-19 发布节点修订（覆盖上一条）**：流水线把色板 `#f0f9ff/#0ea5e9/#22c55e` 列为用户拍板的硬约束（偏离条件=技术不可行，「保护门禁基线」不构成）；且本次部署为鲜度机制首滚，门禁与使用验收证据本就全部重出，换肤无额外门禁代价。已逐 token 对齐：`--bg #f0f9ff / --primary #0ea5e9 / --primary-strong #0284c7 / --primary-soft #e0f2fe / --accent #22c55e`，SVG 图表线/点 `#0284c7`、渐隐填充 `#0ea5e9`，favicon `#0ea5e9`；布局、留白、字号三档、触控 44px、涨跌三重编码（中式红涨绿跌）全部不变。style-card.md 同步修订为唯一事实来源。

---

# 追加轮：趋势加载态悬空 + 趋势图无数值提示（bug fx-trend-bug-load / fx-trend-bug-tip）

> 分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`，基于 v15（5d8f838）继续修复。上轮内容见上方各节（未改动）。

## T1. 根因定位（fx-trend-bug-load：「趋势数据加载中…」永不消失）

**两层缺陷叠加，① 为直接原因：**

| # | 根因 | 证据（修复前 HEAD 5d8f838） |
|---|---|---|
| ① | **CSS 级联吃掉 hidden**：`#trendLoading` 的作者样式 `display:grid`（特异性 0,1,0）压过 UA 样式表 `[hidden]{display:none}`（同特异性，作者样式表恒在 UA 之后）→ JS 成功/失败回调明明都调用了 `hidden = true`，视觉上**从不生效**，loading 药丸永久浮在图上 | styles.css L200-204 `.trend-loading { display:grid }` vs app.js L192 `els.trendLoading.hidden = true`；「成功回调漏隐藏 loading」的表象真身是「调了隐藏但被 CSS 覆盖」 |
| ② | **无状态机，加载态被复用为错误面**：趋势「状态」不存在于任何状态变量，由单个 DOM 元素文案拼凑；`fetchTrend` catch 把失败折叠成 `{failed:true}` → `renderTrend` 对无 `dates` 的数据重新显示 loading 元素 → 失败终态永久占用加载态、无重试入口；`seq` 守卫 early-return 不复位 loading；过期请求仍写共享 `state.trend`（竞态污染，可致错币对图 + 覆盖 last-trend 缓存指针） | app.js 旧 renderTrend L197-204 / fetchTrend L320-323 / loadTrend L349-358 |

## T2. 修复实现（状态机驱动 + 双通道数值提示）

- **状态机**：`state.trendPhase ∈ {idle, loading, success, error}` 四态互斥；`setTrendView()` 唯一渲染出口按态切换 loading 药丸 / error 卡 / 折线图（互斥显示，任何终态显式关掉另两态）。CSS 补 `[hidden] { display:none !important }` 显式守卫（根因①）。
- **纯函数化拉取**：`fetchTrendData(from,to,range)` 不写共享态不碰 DOM；结果一律由 `loadTrend` 在 `trendSeq` 竞态守卫之后统一落地——消除过期请求污染。
- **error 态重试**：网络失败 → 「趋势数据获取失败，请检查网络后重试」+「重试」按钮（实测 82×44px，≥44×44）；同币种 → 提示型终态（不可重试，无重试意义）；失败但有缓存 → 降级 success（成图 + 溯源行「趋势…缓存走势」滞后标注，容错要求不回退）。
- **tooltip 双通道**（fx-trend-bug-tip）：SVG 顶层透明命中层；桌面 `pointermove` hover、移动 `pointerdown` 点按/横滑，显示「日期 + 1 CNY ≈ 0.140060 USD」（6 位小数足够精度）+ 竖向参考线 + 高亮数据点；提示位置夹在图区内不溢出。`touch-action: pan-y` 保页面垂直滚动。**收起分通道**：鼠标移出即收；触摸若在 pointerup 后按补发 pointerleave 收起则数值一闪而过（自测 E1 实证后改为仅 pointercancel——滚动接管时——收起）。
- **DOM/CSS**：index.html 与 landing.html 逐字节同步新增 `#trendError`(role=alert)+`#trendRetryBtn`+`#trendTip`(aria-hidden)、`#trendLoading` 补 role=status；styles.css 新增 `.trend-retry`（三态 + focus-visible + ≥44px）、`.trend-tip`、`.chart-overlay` 与三态 hidden 守卫。色板/留白/字号体系零变动（#f0f9ff/#0ea5e9/#22c55e 体系内取 token）。

## T3. 本地自测记录（本节点，工装在 /tmp 不入库；正式门禁由 deploy/review 节点对 liveUrl 实跑）

1. 等价映射伺服（landing 路由 + `/api/public/assets/* → 工程根`，遵守部署契约 §4）`:9431`。
2. **CDP 功能自测 22/22 PASS**（playwright chromium，双 API mock，报告归档 `.myrd/trend-fix-selftest.json`）：状态机四态互斥（loading→success / 提示型 error / 可重试 error）/ 重试闭环（持续失败不悬空、恢复后重试成图）/ 降级缓存成图+滞后标注 / 快速连切区间终态与最后意图一致 / 桌面 hover 数值提示与跟随 / 触摸点按数值提示与更新 / 重试按钮与既有触控 44px / 390×844 无横向溢出 / 1440 双列不破版 / 全程零未捕获异常。自测过程暴露并修复 2 个工装缺陷（mock 状态跨组泄漏、tap 未滚动进视口）+ 1 个真实缺陷（触摸收起时序，见 T2）。
3. 仓库自带门禁 `webapp-smoke.mjs` 对 localhost 演练：**WEBAPP_SMOKE: PASS，exit 0**（网络全通 / console 零 error / 首屏非纯色 / DOM 有内容 / 触摸管线 / 无横向溢出）。

## T4. 交付边界

- qa/mobile/ 不动：该目录是 deploy/review 节点对 liveUrl 实跑门禁的正式证据链，implement 层自测证据按惯例归 `.myrd/`。
- 部署与 artifacts 回写（HostedApp id / deployment id / liveUrl）属 deploy 及其后继节点职责，本节点以分支 tip 交付。

## T5. 与并行修复（223ac49，需求 cmvp2c164003）的合并口径

rebase 时发现另一 run 已对同一对 bug 提交修复（`223ac49`+`d39d5d0`）。两版比对与取舍：
- **保留本版**：任务硬性要求「loading/success/error 三态互斥 + error 态提供重试入口」——并行版终态走 loading 元素文案、无显式重试入口（仅提示点页头「刷新」间接重试），非状态机形态；本版以 `trendPhase` 状态机 + `setTrendView()` 唯一出口 + 独立 error 卡（82×44 重试按钮）完整满足，且自测更全（22/22 vs 10/10，含重试闭环/竞态连切/降级缓存）。
- **吸收并行版两点**：① `isValidTrend`（dates/rates 同为数组、长度≥2 且等长）——损坏缓存（旧格式/半写）视同无缓存，杜绝 `rates.map` TypeError 与损坏透传，已接入 `fetchTrendData` 兜底链两处校验；② `.visually-hidden` + `aria-live=polite` 读屏同步文本（`#trendTipLive`），tooltip 本体保持 aria-hidden。
- 两版各自独立发现的「CSS 级联吃掉 hidden」根因（`.trend-loading{display:grid}` 压过 UA `[hidden]`）互相印证，守卫合并为本版 `[hidden]{display:none!important}` 三选择器版。
- 融合后全量复测：CDP 功能自测 22/22 PASS + 仓库门禁 `webapp-smoke.mjs` localhost 演练 PASS exit 0。
