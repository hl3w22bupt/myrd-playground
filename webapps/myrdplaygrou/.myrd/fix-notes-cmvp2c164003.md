# fix 修复说明（需求 cmvp2c164003em91ku0scqas4）

> 用户实测反馈的趋势卡两缺陷 + 附带文案语义问题。
> 分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`（HEAD `223ac49`），工程 `webapps/myrdplaygrou`。
> 创作决策不变：清新明亮 #f0f9ff/#0ea5e9/#22c55e、宽松留白、适度交互、localStorage、中文。

## 1. 根因取证（代码证据）

| # | 缺陷 | 根因（修复前 commit 5d8f838） |
|---|------|------|
| ① | 趋势加载态无终态 | `fetchTrend` catch 兜底 `state.trend = cached ? {...cached, stale:true} : {failed:true}`：localStorage 存在**缺 dates 的损坏记录**时 `cached` 为真值被原样透传；`renderTrend` 的 `!t.dates \|\| t.dates.length < 2` 分支按 `t.failed`（undefined）兜底落入「趋势数据加载中…」→ 永久停留。且该校验只查 `dates` 不查 `rates`，缓存有 dates 无 rates 时 `rates.map` 直接 TypeError |
| ② | 趋势图无数值提示 | `renderTrend` 只画静态 SVG（polygon/polyline/circle/text），无任何 pointer/touch 交互 |
| ③ | `t.failed` 文案语义不符 | `t.failed=true` 仅在**无缓存可用**时置位（`cached ? … : {failed:true}`），文案却写「已展示缓存」——与事实相反 |

## 2. 修复口径（commit 223ac49，app.js + styles.css）

- **终态保证（三道防线）**：
  1. 新增 `isValidTrend(rec)`（dates/rates 同为数组、长度≥2 且等长）；catch 兜底仅复用**有效**缓存，无效视同无缓存落 `{failed:true}`；
  2. `renderTrend` 终态判定收紧：仅 `!t`（尚无结果）才显示「加载中」；failed / samePair / 缓存损坏各给出确定终态文案；
  3. `loadTrend` 加 `finally` 保险：`state.trend == null` 时强制落 failed 终态。
- **样式层隐患顺带修**：`.trend-loading{display:grid}` 特异性压过 UA `[hidden]{display:none}`，hidden 属性失效会让加载文案视觉常驻——补 `.trend-loading[hidden], .trend-error[hidden]{display:none}`。
- **tooltip（缺陷②）**：`renderTrend` 成功分支末尾 `mountTrendInteraction(pts)`——
  - PC `pointermove(mouse)` 悬停跟随；触摸 `pointerdown` 点按/按住命中，抬起后**保留显示**，点按图表外收起；
  - 浮层 HTML（`.fx-chart-tip`，不受 `preserveAspectRatio="none"` 拉伸影响）显示「日期 + 1 源币 = 数值 目标币」，贴边内收防裁剪；SVG 竖线 + 放大点高亮（`pointer-events:none` 不拦交互）；
  - 触控命中区 = 整块图表（实测渲染高 ≥130px，远超 44×44px 最小目标）；`touch-action:pan-y` 保留纵向滚动；
  - 同步 `visually-hidden` + `aria-live=polite` 文本供读屏。

## 3. 自检证据（CDP 无头 Chrome，ALL-PASS 10/10）

损坏缓存（缺 dates）终态 / 失败且无缓存终态 / 趋势正常渲染 / 图表命中区 170px≥44 / hover 显示（`2026-10-20 1 CNY = 0.1497 USD`）/ 移出隐藏 / 触摸显示并保留 / 二次触摸更新位置 / 点图表外收起 / 零 console 错误。
自检 harness 为一次性脚本（/tmp，不入仓库）；真实移动端管线由部署后仓库门禁 `webapp-smoke.mjs` 对 liveUrl 机判，证据落 `webapps/myrdplaygrou/qa/mobile/`。

## 4. 部署契约（deploy 节点）

- gitRef：`myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu` @ `223ac49`（绝不用 main）
- manifestPath：`webapps/myrdplaygrou/apphost.toml`（HostedApp id `cmvaf7imm000hm94lw6y43t0q`，slug `myrdplaygrou`；勿动仓库根 apphost.toml——game-9 所有）
- liveUrl：`https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/`（review 节点 preHook `webapp-smoke` 门禁以它为准，不过自动打回 deploy）
- 部署完成把 HostedApp id / deployment id / liveUrl 回写目标 artifacts（goal `cmvaf7imr000jm94le9x48zfu`）

## 5. 复验记录（第 2 轮，2026-10-26，implement 节点重派后独立复验）

> 背景：本修复已由前次执行随 commit `3b1ea65` 推上远端功能分支（现 HEAD `7b7848b`）。重派执行按「不沿用上轮结论」纪律独立复验，**不重复改码**。

- **复验对象**：远端分支 HEAD `7b7848b9c920fff96532833aaa5cd99e872aab52`（与本地一致，`git ls-remote` 核实）。
- **方法**：无头 Chrome CDP 直连（Node 26 内建 WebSocket，零依赖 harness，一次性脚本不入仓库）+ 本地静态伺服复刻壳资产路由（`/apps/myrdplaygrou/api/public/assets/*` 与无前缀双形态，MIME 校验通过）。
- **结果**：**23/23 PASS**（详见 `trend-fix-selftest-r2.json`）。关键项：冷启动 success 后 loading 药丸 computed display=none（根因① CSS 守卫实证）；失败且无缓存 → error 终态 + 重试 82×44px；持续失败重试不悬空；失败有缓存降级 success + 滞后横幅；网络恢复重试闭环 success；快速连切 30→7 终态与最后意图一致；hover/触摸双通道显示日期 + 具体汇率值（如 `2026-10-21 1 CNY ≈ 0.14979 USD`）；390×844 无横向溢出；1440 双列；应用级 console 零 error。
- **附带机审**：全部交互元素命中区 ≥44×44（390 视口 computed 实测，见 evidence meta）。
- **测试口径留痕**（两条 harness 教训，已写进 evidence meta，复测者必读）：① seq 丢弃请求仍会写趋势缓存（设计如此），「失败且无缓存」场景需清缓存后静置再清；② 网络层 ERR_FAILED 是超时中止/故意拦截的预期产物，应用级判据 = 无异常 + 无 console.error。
- **给下游**：部署契约见 §4（gitRef=`myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`，manifestPath=`webapps/myrdplaygrou/apphost.toml`，HostedApp id `cmvaf7imm000hm94lw6y43t0q`）；review 节点 preHook `webapp-smoke` 以 liveUrl 为准，证据归档 `qa/mobile/`。
