# 《今日汇率》数据源选型与部署前置预检简报（fx-today · 2026-10-16 · 前置预检节点产出）

> 结论先行：**主源 = `@fawazahmed0/currency-api`（jsDelivr CDN，免 key、CORS `*`、340 币、逐日历史含周末）；
> 备源 = `open.er-api.com/v6`（免 key、CORS `*`、166 币、当日更新、无历史）；降级 = localStorage 缓存 + 滞后提示。**
> `api.frankfurter.dev` 不推荐：v1 已被官方标弃用，v2 契约劣化（无 timeseries、不可按币种过滤）。
> 全部结论基于 2026-10-16 当日 curl 实测（响应头 / 状态码 / 数据字段均为真实抓取值，非文档转述）。

## 一、候选源实测对比（2026-10-16 实测）

| 维度 | ① jsDelivr currency-api<br>`@fawazahmed0/currency-api` | ② open.er-api.com<br>`/v6/latest/{BASE}` | ③ frankfurter v1 | ④ frankfurter v2 |
|---|---|---|---|---|
| 免 key | ✅ | ✅ | ✅ | ✅ |
| CORS | ✅ `access-control-allow-origin: *`（OPTIONS 预检 200，`expose-headers: *`） | ✅ `*`（GET 带 Origin 即回；OPTIONS 405 但简单 GET 不触发预检，无影响） | ✅ `*` | ✅ `*` |
| 币种覆盖（8 必需） | ✅ 340 币，CNY/USD/EUR/JPY/GBP/HKD/KRW/SGD 全有 | ✅ 166 币，全有 | ✅ ~30 币（ECB），全有 | ✅ 全有 |
| 历史序列 | ✅ **逐日 tag**（`@YYYY-MM-DD`），**周末有数据** | ❌ 无（免费档仅 latest） | ✅ `/v1/{start}..{end}`（工作日） | ❌ 无 timeseries 端点（`/v2/{start}..{end}` → 404） |
| 数据新鲜度 | T-1（实测 2026-10-15） | **当日**（实测 2026-10-16 00:02 UTC 更新） | T-1 工作日 | T-1 工作日 |
| 单次响应体积 | **6.1 KB**（`.min.json`，单 base 全币表） | ~40 KB（全量） | 极小（按 symbols 过滤后） | 大（全币扁平数组，不可过滤） |
| 7 天窗口数据点 | **7 点**（周末不缺） | — | **5 点**（实测仅 10-09、10-12~15） | — |
| 判定 | **✅ 主源** | **✅ 备源** | ⚠️ 弃用中 | ❌ 不推荐 |

## 二、关键实测证据（负面事实不隐瞒）

1. **frankfurter v1 已官方标弃用**：v1 响应头实测含
   `deprecation: @1779103800` 与 `link: <https://api.frankfurter.dev/v2/rates>; rel="successor-version"`。
2. **frankfurter v2 契约劣化**（实测）：`?symbols=` → 422 `unknown parameter: symbols`；
   `?start_date/end_date` → 422；`?currencies=` → 422；日期区间路径 → 404；
   仅 `/v2/rates?base=USD` 可用，返回**全币扁平数组** `[{date,base,quote,rate},...]`，无法按币种过滤，前端体积与解析成本高。
3. **ECB 工作日缺口**：`/v1/2026-10-09..2026-10-16` 实测仅 5 个数据点（缺周末）——
   直接威胁验收标准 2「近 7 天走势数据点完整」。fawaz 源实测周六（10-10）、周日（10-11）均 200 且有值 → **逐日无缺口**。
4. **jsDelivr 当日 tag 404**：`@2026-10-16`（今日）实测 404 —— 当日数据未生成。
   历史窗口必须从 T-1 起倒推，且对 404 日做「跳过该点」容错。
5. **跨源数值不一致**（USD→CNY，2026-10-15/16 实测）：
   fawaz `6.69254618` / frankfurter `6.691` / er-api `6.702985`，最大互差 ~0.18%。
   ⇒ 验收标准 1「换算误差 ≤0.01%」**必须用应用所取同源同快照数据复算**（本地 recompute 断言），
   禁止拿另一家汇率源对拍，否则必然误判。

## 三、落地契约（下游开发节点照单施工）

```js
// 币种小写；数据语义：usd.cny = 6.69 表示 1 USD = 6.69 CNY（以 {base} 币为单位的兑出表）
const FX = {
  latest:  (b) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${b.toLowerCase()}.min.json`,
  histDay: (b, d) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${d}/v1/currencies/${b.toLowerCase()}.min.json`,
  fallback: (b) => `https://open.er-api.com/v6/latest/${b.toUpperCase()}`, // 结构不同：{ result:"success", rates:{CNY:...} } 需适配器归一
};
// 换算（X→Y，基于同一张以 b 为 base 的表）：amountY = amountX * rate[b][y] / rate[b][x]
// 历史：30 天 = Promise.allSettled 逐日并行拉 30 × 6KB ≈ 180KB（实测单次 0.35~0.6s，并行 <1.5s）；7 天 = 7 请求
// 区间涨跌 = (last - first) / first × 100%，窗口取「今天往前 N 个自然日」的可用数据点
```

**容错链（对应需求验收 3 / 5，硬约束）**：
1. 实时汇率：fawaz `@latest` → 失败切 er-api 备源（适配归一为 `{base, rates, date}`）→ 失败读 localStorage 缓存；
2. 任一级成功后**写缓存** `{base, rates, fetchedAt, dataDate}`；命中缓存时必须显示「数据可能滞后（截至 {dataDate}）」；
3. 历史：`allSettled`，404/失败日跳过；可用点 < 窗口天数 60% 时在图上标注「数据不完整」；
4. **禁止未捕获 rejection**：门禁机判 console 零错误，所有 fetch 必须 try/catch + 降级渲染，首屏先出骨架（不依赖网络）再异步填充。

## 四、部署前置预检结论（全部通过）

| 预检项 | 结果 | 证据 |
|---|---|---|
| 仓库可克隆/可推 | ✅ | 本工作区即 clone；`git ls-remote origin` 实测返回全部分支 |
| 门禁脚本预置 | ✅ | `.myrd-platform/.claude/skills/web-app-dev/scripts/webapp-smoke.mjs` 在位；零 npm 依赖、Node≥22、CDP 直驱 Chrome；退出码 0=过/1=门禁失败/2=环境缺 Chrome；配 `webapp_smoke_selftest.mjs` 自测 |
| 部署清单模式 | ✅ | 先例 `games/wheat-squad/apphost.toml`：app 级清单（name/runtime=node20/health=/health/assets_dir），**共享仓库根 `server/` 壳**，平台以 manifestPath 指向 app 清单；**勿改仓库根 apphost.toml**（当前指向 game-9） |
| 起壳模板 | ✅ | `templates/apphost/myrd-app/`（apphost.toml + server/src）可直接复制 |
| 外网直连合法性 | ✅ | 三候选源均 CORS `*`，纯前端 fetch 直连合法，无需自建代理；er-api OPTIONS 405 不构成阻塞（简单 GET 不触发预检） |
| 门禁对取数的含义 | ⚠️ 已约束 | webapp-smoke 打**部署后 liveUrl** 机判「网络全通 / console 零错误 / 首屏有内容」→ 取数失败必须静默降级，不得产生 networkFailures / 未捕获异常 / 白屏 |

**支持币种口径**：默认 8 币种 CNY USD EUR JPY GBP HKD KRW SGD（主源实际可放开至 340 币，UI 首屏仅列 8 币满足验收 1 的「≥8」且不增加复杂度）。
