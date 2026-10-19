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
