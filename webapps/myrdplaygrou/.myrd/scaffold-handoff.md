# scaffold → implement 移交（迭代 run cmveiw7540013m9vqlgj9t6ul）

> 分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`，工程 `webapps/myrdplaygrou`。
> 本节点为 scaffold：工程已由前序 run 建成并上线过，本 run 复用，不重建、不推翻。

## 1. 脚手架现状（全部就位，implement 直接在其上迭代）

| 资产 | 状态 |
|---|---|
| index.html | ✅ viewport meta / lang=zh-CN / title / 页头-核心区-页脚齐全；`<base href="/apps/myrdplaygrou/">` 锚定子路径 |
| styles.css | ✅ CSS 变量与 `.myrd/style-card.md` 逐项一致（薄荷绿 #14b8a6 + 天蓝 #38bdf8，清新明亮方向） |
| app.js | ✅ 零依赖 ESM；8 币种换算 + frankfurter 7/30 天趋势 + localStorage 留存 |
| landing.html | ✅ 与 index.html **逐字节相同**（壳 server `GET /` 伺服它，见 §4） |
| apphost.toml | ✅ runtime=node20 / health=/health / assets_dir=webapps/myrdplaygrou（带 manifestPath 部署） |
| 门禁 | ✅ `std-skills/web-app-dev/scripts/webapp-smoke.mjs` 在仓且未被 ignore；`.myrd/routines.yaml` 已含 `id=webapp-smoke`（appPath=webapps/myrdplaygrou），本 run 勿改 |

## 2. 「多天不更新」根因定位基线（需求 cmveivn9n 验收项 5 要求留痕）

**已排除**：工程内无静态写死的汇率常量（`grep -rnE '"USD": *[0-9]|rates *= *\{|SEED' *.js *.html` 为空）。HEAD 的 app.js 每次加载都会 fetch `open.er-api.com`，且最后一次代码变更（4c82fd0）早于活跃部署 13dec1c —— **部署态与 HEAD 同版**，用户所见即以下缺口：

| # | 缺口 | 证据（app.js 行号） |
|---|---|---|
| 1 | **缓存无 TTL 过期判定**：`fx-latest-v1` 存了 `fetchedAt` 但全文件无任何过期比较；缓存只在 fetch 抛错时被读取 | LS_KEYS 定义（L20-24）、fetchLatest catch（L204-213） |
| 2 | **无 interval 定时刷新**：整个生命周期只在 init 拉一次，停留期永不更新 | init（L311-332） |
| 3 | **无手动刷新按钮**：index.html 无刷新控件 | index.html 全文 |
| 4 | **无内置种子兜底**：断网 + 缓存缺失 → `state.latest=null`，换算区显示"--"，无数据日期可标 | fetchLatest else 分支（L210-212） |
| 5 | **兼容性风险**：`AbortSignal.timeout(8000)` 在旧 Safari/WebView 同步抛 TypeError，fetch 根本不发出 → 永远落到旧缓存且无感知 | L197、L228 |
| 6 | **鲜度展示错位**：页头显示的是「本地获取时刻 fetchedAt」，不是数据本身的日期（`time_last_update_utc` 已存未用） | renderFreshness（L118-126） |

implement 按需求 cmveivn9n 七条补齐即可：进入即拉取 + 30 分钟 TTL 过期判定 + interval 定时刷新 + 手动刷新按钮 + localStorage 带时间戳 + 种子兜底 + 数据源与最后更新时间（精确到分钟）常显。

## 3. 用户显式要求的回应口径

「更新逻辑放到前端」：本工程本就是零后端纯前端（fetch 免 key CORS API），无需任何架构变动 —— implement 只在 app.js 内补齐更新/过期/兜底逻辑即可，不改部署形态。

## 4. ⚠️ 部署契约（implement 改动时必须遵守，违反即线上破版）

1. **index.html 引用资产必须保持 `./api/public/assets/<file>` 相对路径**：壳 server（`server/src/index.ts`）把 `/api/public/assets/:name{.+}` 映射回 assets_dir（= 工程根）里的真实文件名。不要改成 `./styles.css` 直引（在线上会 404）。
2. **改 index.html 必须同步 landing.html**（两文件保持一致）：`GET /` 由 landing.html 伺服，不同步则用户从根路径进来的永远是旧页面。
3. 本地自检不能用纯静态伺服直接开工程根（`./api/public/assets/*` 会 404）：需加一条 `/api/public/assets/* → 工程根` 的映射，或直接以 liveUrl 为准（部署后 review 节点实跑门禁）。
4. 判定器唯一来源：`std-skills/web-app-dev/scripts/webapp-smoke.mjs`（仓库内）。任何自造检查不得替代它。
