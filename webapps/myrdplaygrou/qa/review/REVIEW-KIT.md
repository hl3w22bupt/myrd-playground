# 《今日汇率》使用验收包（review_kit）— 趋势卡缺陷修复轮

> 需求 cmvp2c164003em91ku0scqas4：①趋势加载态无终态 ②趋势图无 hover/touch 数值提示 + 附带 t.failed 文案。
> 本包只交付「怎么验收 + 机器可判项的实测证据」；**四问主观结论一律待用户回填**，验收判定权在人。

## 0. 元信息（首轮实测 2026-10-26 18:36–18:41；验收节点终态复验 18:52–18:56）

| 项 | 值 |
|---|---|
| 应用 | 今日汇率（实用工具 · AppHost HostedApp id `cmvaf7imm000hm94lw6y43t0q`，slug `myrdplaygrou`，status=ready） |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/ （跟随 308 → 200） |
| 分支 | myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu（终态复验时本地 HEAD = `15ba6da`，含发布节点门禁终跑提交） |
| **部署三要素** | HostedApp id `cmvaf7imm000hm94lw6y43t0q` · **deployment id `cmvp3vvbo004bm91kowxtp46j`（v17，createdAt 2026-10-26T10:20:42Z，AppHost API 实查 status=running）** · liveUrl 如上（部署记录见 `qa/mobile/DEPLOY-cmvp2c164003.md`） |
| 部署版本核验（终态复验） | 线上 `api/public/assets/app.js` HTTP 200，sha256 `e9072c2e8444…8684de5` ≡ 本地 HEAD `webapps/myrdplaygrou/app.js`；线上 index.html 同法对拍 `c1953a0b…` 一致（**字节级一致，线上即 v17 修复版**；终态复验 18:52 重做，非沿用首轮结论） |
| 目标 id | cmvaf7imr000jm94le9x48zfu |
| 取证方式 | 首轮：experience-harness sessiond/session-step（移动 390×844 + 桌面 1280×800 双会话，只产证据不判定）；终态复验：版本哈希对拍 + 门禁复跑核读 + 上线文件静态走查 + 三张实测截图目视核对（同一线上版本字节未变，首轮 M1–M5 行为证据继续有效） |

## 1. 前置核验事实链

- 门禁判定脚本来源核验：`std-skills/web-app-dev/scripts/webapp-smoke.mjs` 存在于项目仓库（模板预置），未改写；`.myrd-platform/.claude/skills/web-app-dev/` 同名副本仅作阅读，未参与判定。
- 门禁配置核验：`.myrd/routines.yaml` 存在 `id: webapp-smoke` routine，参数化模板照抄 `std-skills/web-app-dev/references/webapp-smoke-routine.md`，`appPath: webapps/myrdplaygrou` 对齐本工程。
- preHook 门禁证据：`qa/mobile/report.json` + `qa/mobile/phase-load.png` / `phase-tap.png`。**v17 上线后共两轮 PASS**：① 发布节点终跑 checkedAt `2026-10-26T10:49:05Z`（已随 commit `15ba6da` 入库）；② 验收节点 preHook 复跑 checkedAt `2026-10-26T10:51:41Z`（工作区落盘，与 ① diff 仅 checkedAt，判定不变）。本验收以 ② 为本节点前置证据。metrics.textHead 首屏实拉「数据源 open.er-api.com · 数据日期 2026-10-26 · 最后更新 10-26 1…」——生产环境当日数据。

### 1.1 门禁证据完整阅读记录（不只看 verdict）

verdict = **PASS**，6 项 check 全 pass。但按证据全文通读，存在以下**不粉饰的瑕疵**（不影响 PASS 判定的机器口径，但记录在案；**两轮报告 10:49 / 10:51 同样存在**，终态复验已逐项复核确认）：

1. **pass 态却拼接失败提示语（文案缺陷，沿用既有形态）**：render / content / touch-pipeline 三项的 detail 均为「失败时才该出现」的提示文本（如「页面没渲染出来（白屏/黑屏）」「结构没挂载或被壳挡住」「事件没到页面=壳层挡了输入」），与同项的 pass 状态及 metrics 实况（色 11 种非纯色、innerText 628 字、tap/swipe 计数器均已派发）相矛盾。这是报告生成器的模板拼接问题，非应用缺陷。判定以 status+metrics 为准，判定器不改写仅留痕。
2. **tapDiff=1**：tap 后画面量化差异仅 1（tap 点落在页面空白处，无视觉反馈可观测）。本应用为信息工具页，tap 无画面变化属预期事实，此处如实记录供人工复核参考。
3. **content 项 detail 与 metrics 矛盾**：detail 称「无 img/svg/form/button 等内容元素」，而 `hasContentElement: true`（趋势 SVG 实际存在）。同为模板文案问题。

## 2. 机器可判项实测（本验收 agent 亲测，非引用）

| # | 探测 | 方法 | 结果 |
|---|---|---|---|
| M1 | 趋势加载终态 | 移动+桌面会话 probe `document.body.innerText` | 两端 `「趋势数据加载中」` 均**不残留**；趋势卡呈 success 终态（▲ 区间上涨 0.24% + 日期刻度 10/16–10/23 + 走势说明）。证据 `qa/mobile/rv-trend-terminal-state-mobile.png` |
| M2 | tooltip 内容（触摸） | 移动会话 tap 图表中心 (195,518) | tooltip 显示 `2026-10-21 \| 1 CNY ≈ 0.14979 USD`（日期+汇率数值齐全），hidden=false。证据 `qa/mobile/rv-trend-tooltip-touch.png` |
| M3 | tooltip 内容（桌面真实输入） | 桌面会话 tap 图表 (884,331) | tooltip 显示 `2026-10-20 \| 1 CNY ≈ 0.14974 USD`。证据 `qa/mobile/rv-trend-tooltip-desktop.png` |
| M4 | hover 通道（pointermove） | 合成 `PointerEvent(pointerType=mouse)` 于图 70% 处 | tooltip 随位置更新为 `2026-10-22 \| 1 CNY ≈ 0.14983 USD`（**合成事件，证明通道代码路径可达；非 isTrusted 真鼠标，如实体感以 M3 为准**） |
| M5 | 触控目标 ≥44×44px | probe `getBoundingClientRect` | 趋势图 SVG 命中层移动端 324×132px、桌面 517×210px（图表容器 `min-height:200px` 全宽），**远超 44×44**。注：全站其余按钮未逐一实测，静态口径见 style-card「触控目标 ≥44」约束 |
| M6 | t.failed 文案 | 静态走查（HEAD app.js） | error 态文案 `趋势数据获取失败，请检查网络后重试`（retryable=true，语义一致）；另有提示型 `趋势数据不完整，请重试`。**真实网络失败态未做行为触发**（备源链路在真实环境难稳定触发），此为静态核验口径 |
| M7 | 修复代码在位 | 静态走查 | fx-trend-bug-load（四态状态机，任何路径显式关掉其余态）+ fx-trend-bug-tip（pointermove/pointerdown 双通道 + pointercancel 收起 + 读屏同步）+ error 态重试入口，注释与实现一致 |

### 2.1 验收节点终态复验（本节点亲测，2026-10-26 18:52–18:56）

发布节点在首轮验收之后又做过一次门禁终跑并提交（HEAD 前进至 `15ba6da`），故本节点**不沿用首轮结论**，重新取证：

| # | 复验项 | 方法与结果 |
|---|---|---|
| R1 | 线上版本 = 修复版 | 线上 `api/public/assets/app.js` sha256 `e9072c2e…` ≡ 本地 HEAD `webapps/myrdplaygrou/app.js`；index.html 同法对拍 `c1953a0b…` 一致（跟随 308、经壳资产路由，HTTP 200） |
| R2 | 部署三要素 | AppHost API `GET /api/v1/apphost/apps`（token 实查）：HostedApp `cmvaf7imm000hm94lw6y43t0q` status=ready，deployments 含 `cmvp3vvbo004bm91kowxtp46j`（createdAt 2026-10-26T10:20:42Z，status=running），liveUrl 与固定参数一致 |
| R3 | 门禁复跑判定 | preHook 10:51:41Z 报告全 6 项 pass（§1.1 瑕疵项两轮一致，均已留痕） |
| R4 | 状态机/tooltip 标记在上线产物 | 上线 index.html 含 `trendError`×2、`trendTip`×2、`trendRetryBtn`×1；「趋势数据加载中」在 app.js / index.html 各仅 1 处（loading 态渲染分支，非全局残留） |
| R5 | 行为证据图证目视核对 | `rv-trend-tooltip-touch.png`（2026-10-21 · 1 CNY ≈ 0.14979 USD + 竖参考线 + 高亮点）、`rv-trend-terminal-state-mobile.png`（success 终态无加载残留、▲ 红涨三重编码）、`rv-trend-tooltip-desktop.png`（双列布局 + $14.98 大字号 + 溯源行「数据日期 2026-10-26 · 将于 19:10 自动刷新」+ tooltip）三张均已逐张查看，与 M1–M3 记载一致 |

> 复验边界：R1–R5 为版本/静态/证据核对口径；真实网络失败态（error 态重试闭环）仍未做行为触发（同 M6 备注），以静态走查 + 实现自测记录（`.myrd/trend-fix-selftest*.json`，22/22）为据。

## 3. 使用指引（怎么用、看什么）

一句话定位：**人民币、美金和其它主流货币的汇率换算关系和趋势**。打开 liveUrl 后按下面的面核对：

1. **10 秒可懂面**：首屏是否一眼看出「汇率换算工具」——顶部「今日汇率」+ 数据源/日期条、金额输入框、从/到币种下拉、大字号换算结果（$14.98 形态）是否直接可见，无需解释。
2. **核心流程面**（单页闭环，无弹窗遮挡）：改币种 → 改金额 → 看换算结果 → 看下方「常用币种一览」→ 看趋势卡近 7 天/近 30 天切换 → 图上悬停/点按看某日数值。任一步卡住即记缺陷。
3. **趋势 tooltip 面（本轮修复重点）**：
   - PC：鼠标在折线图上左右移动，应出现「日期 + 1 CNY ≈ x USD」浮层，竖参考线与高亮点随动，移出图区收起；
   - 手机：点按图上任意位置应出同一浮层（不被滚动手势误触发/误吞），开始滚动页面时收起。
4. **响应式面（双端自适应）**：手机宽（~390px）单列、无横向滚动条；桌面宽（≥1200px）换算卡与趋势卡并排双列。
5. **数据留存面（localStorage）**：改一次币种/金额 → 刷新页面 → 选择应保留；断网刷新应回退缓存或内置种子并出现「数据可能滞后」提示（琥珀色条）。
6. **界面语言面**：全站中文（含日期、涨跌表述「▲ 区间上涨 x%」中式红涨）。
7. **风格面**（对照工程内 `webapps/myrdplaygrou/.myrd/style-card.md`）：天蓝浅底 #f0f9ff 基底、#0ea5e9 主色、#22c55e 绿点缀；换算结果为全页最大字号；涨跌为「颜色+▲/▼+百分比」三重编码；卡片圆角宽松留白；无暗色大块。

## 4. 结构化使用检查单（四问 —— 逐条作答）

> 机器可判事实已填入；**主观分值与体验结论标「待用户回填」**，本 agent 不代填。

**① 打开 10 秒内能否明白这个应用做什么、怎么用？（是/否 + 卡点）**
- 机器事实：首屏直出「今日汇率」标题、金额输入、从/到币种、大字号换算结果与数据日期条；无弹窗/遮罩。
- 结论：**待用户回填**（是/否 + 卡点：______）

**② 核心流程能否无阻碍走通？（1-5 分 + 卡在哪一步）**
- 机器事实：换算结果实时更新（100 CNY → $14.98）、常用币种一览 8 币种、趋势 7 天/30 天切换渲染正常、tooltip 双通道可用（M2/M3）。
- 结论：**待用户回填**（分数：____ 卡点：______）

**③ 观感与风格统一？（1-5 分：排版层级 / 留白 / 对比度 / 与拍板视觉风格一致性，对照 `webapps/myrdplaygrou/.myrd/style-card.md`）**
- 机器事实：色板令牌与拍板口径一致（--bg #f0f9ff / --primary #0ea5e9 / --accent #22c55e）；换算结果为首要视觉焦点（44–56px）；涨跌三重编码；桌面 1280 双列、移动 390 单列均无横向溢出；截图三张可直查。
- 结论：**待用户回填**（分数：____ 偏离点：______）

**④ 移动端可用性与阻断性缺陷？（有/无 + 缺陷描述与复现路径）**
- 机器事实：preHook webapp-smoke PASS（网络全通 / console 零 error / 首屏有内容 / 触摸管线通 / 视口无溢出，见 `qa/mobile/report.json`）；本 agent 复测 M1/M2/M5 移动端均过。门禁报告自身文案瑕疵见 §1.1（非应用缺陷）。本轮机器实测**未发现阻断性缺陷**。
- 结论：**待用户回填**（有/无：____ 缺陷与复现路径：______）

## 5. 反馈回流说明

把四问作答 + 缺陷清单（每条：现象 / 复现路径 / 期望）发回目标会话（goal `cmvaf7imr000jm94le9x48zfu`），即触发下一轮迭代修复：人在回执里的每一条都会变成下一轮 implement 的输入，修完再回到本验收节点复验，形成「人验收 → 修 → 再验收」闭环。若四问全过且无缺陷，目标可直接收敛。

## 6. 证据索引

| 文件 | 说明 |
|---|---|
| `qa/mobile/report.json` + `phase-load.png` / `phase-tap.png` | preHook webapp-smoke 门禁证据（v17 两轮 PASS：10:49 发布终跑已入库 + 10:51 验收 preHook 复跑） |
| `qa/mobile/rv-trend-terminal-state-mobile.png` | M1 移动加载终态（无「加载中」残留） |
| `qa/mobile/rv-trend-tooltip-touch.png` | M2 移动触摸 tooltip（日期+汇率） |
| `qa/mobile/rv-trend-tooltip-desktop.png` | M3 桌面输入 tooltip（日期+汇率） |
| `qa/mobile/DEPLOY-cmvp2c164003.md` | 部署与门禁留痕（deployment id、gitRef、v16→v17 演进、上线核验） |
| `webapps/myrdplaygrou/.myrd/style-card.md` | 风格基准（四问③对照物） |
| `webapps/myrdplaygrou/.myrd/fix-notes-cmvp2c164003.md` | 前置节点根因取证/修复口径 |
| `webapps/myrdplaygrou/.myrd/trend-fix-selftest.json` / `trend-fix-selftest-r2.json` | 实现节点两轮自测记录（10/10 与 22/22，含重试闭环/竞态连切/降级缓存） |

## 7. 平台 artifacts 回写状态（本节点已亲自写回，2026-10-26 18:5x 实测）

- **前序受阻已解除**：首轮执行时 `GET /api/v1/goals/:id` 曾 403（workflow token 无 goal 权限，见本分支提交 `6ea4765` / `e9c0055` 上报）；本节点复测同端点返回 **200**——运维已补权限，无需再代为落账。
- **本轮回写已成功并回读校验**：`GET → artifacts 数组追加一条 → 整体 PATCH /api/v1/goals/cmvaf7imr000jm94le9x48zfu`，PATCH 200；回读 22 条（原 21 条逐字节无变化，diff 为空），新条目 `op=review_kit, artifactType=review_kit, artifactId=review-kit-cmvp2c164003-trend-fix, status=pending_user_review`，detail 含部署三要素 / 版本哈希对拍 / 门禁两轮 PASS 与瑕疵留痕 / M1–M5 机器可判项 / 四问待回填口径，并指向本文件。
- 部署三要素此前已由 deploy 节点经部署 API goalId 联动在 artifacts（`deploy_tool` 条目 `cmvp3vvbo004bm91kowxtp46j` 等）；本条 review_kit 与其并存，不覆盖。
- 检查单状态：**待用户验收**。收到用户四问作答 + 缺陷清单后，再按「追加不覆盖」纪律回写 `op=review_feedback` 条目；迭代修复走目标下一轮，不在本节点内代改。
