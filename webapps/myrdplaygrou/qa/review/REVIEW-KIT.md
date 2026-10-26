# 《今日汇率》使用验收包（review_kit）— 趋势卡缺陷修复轮

> 需求 cmvp2c164003em91ku0scqas4：①趋势加载态无终态 ②趋势图无 hover/touch 数值提示 + 附带 t.failed 文案。
> 本包只交付「怎么验收 + 机器可判项的实测证据」；**四问主观结论一律待用户回填**，验收判定权在人。

## 0. 元信息（2026-10-26 18:36–18:41 实测）

| 项 | 值 |
|---|---|
| 应用 | 今日汇率（实用工具 · AppHost HostedApp id `cmvaf7imm000hm94lw6y43t0q`，slug `myrdplaygrou`） |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/ （跟随 308 → 200） |
| 分支 | myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu，本地 HEAD = 远端 FETCH_HEAD = `e9c0055`（已快进同步） |
| 部署版本核验 | 线上 `api/public/assets/app.js` HTTP 200，sha256 `e9072c2e8444…8684de5` ≡ 本地 HEAD `webapps/myrdplaygrou/app.js`（**字节级一致，线上即修复版**） |
| 目标 id | cmvaf7imr000jm94le9x48zfu |
| 取证方式 | experience-harness sessiond/session-step（移动 390×844 + 桌面 1280×800 双会话，只产证据不判定） |

## 1. 前置核验事实链

- 门禁判定脚本来源核验：`std-skills/web-app-dev/scripts/webapp-smoke.mjs` 存在于项目仓库（模板预置），未改写；`.myrd-platform/.claude/skills/web-app-dev/` 同名副本仅作阅读，未参与判定。
- 门禁配置核验：`.myrd/routines.yaml` 存在 `id: webapp-smoke` routine，参数化模板照抄 `std-skills/web-app-dev/references/webapp-smoke-routine.md`，`appPath: webapps/myrdplaygrou` 对齐本工程。
- preHook 门禁证据：`qa/mobile/report.json`（checkedAt 2026-10-26T10:31:52Z，本分支未提交改动即本轮门禁落盘）+ `qa/mobile/phase-load.png` / `phase-tap.png`。

### 1.1 门禁证据完整阅读记录（不只看 verdict）

verdict = **PASS**，6 项 check 全 pass。但按证据全文通读，存在以下**不粉饰的瑕疵**（不影响 PASS 判定的机器口径，但记录在案）：

1. **pass 态却拼接失败提示语（文案缺陷，沿用既有形态）**：render / content / touch-pipeline 三项的 detail 均为「失败时才该出现」的提示文本（如「页面没渲染出来（白屏/黑屏）」「结构没挂载或被壳挡住」「事件没到页面=壳层挡了输入」），与同项的 pass 状态及 metrics 实况（色 11 种非纯色、innerText 628 字、tap/swipe 计数器均已派发）相矛盾。这是报告生成器的模板拼接问题，非应用缺陷。
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
| `qa/mobile/report.json` + `phase-load.png` / `phase-tap.png` | preHook webapp-smoke 门禁证据（本轮落盘，PASS） |
| `qa/mobile/rv-trend-terminal-state-mobile.png` | M1 移动加载终态（无「加载中」残留） |
| `qa/mobile/rv-trend-tooltip-touch.png` | M2 移动触摸 tooltip（日期+汇率） |
| `qa/mobile/rv-trend-tooltip-desktop.png` | M3 桌面输入 tooltip（日期+汇率） |
| `webapps/myrdplaygrou/.myrd/style-card.md` | 风格基准（四问③对照物） |
| `webapps/myrdplaygrou/.myrd/fix-notes-cmvp2c164003.md` | 前置节点根因取证/修复口径 |

## 7. 平台 artifacts 回写状态（本节点增量上报，不粉饰）

- **review_kit 条目未能写入目标 artifacts**：`GET /api/v1/goals/cmvaf7imr000jm94le9x48zfu` 返回 403 `FORBIDDEN「无权访问」`（requestId `req_1793011551206`，2026-10-26 18:47 实测；`/api/v1/goals/:id/artifacts` 端点 404）。与本分支前置提交 e9c0055 上报同因：**workflow 身份无 goal 读写权限**，运维需给该身份补 goal scope。
- 部署三要素已在 artifacts（无需重复回写）：HostedApp id `cmvaf7imm000hm94lw6y43t0q`、deployment id `cmvp3vvbo004bm91kowxtp46j`（v17，mode=bundle，commit `7b7848b`）、liveUrl——由部署 API `POST /api/v1/apphost/apps/:id/deployments` 的 goalId 联动在 deploy 节点写入（见 `qa/mobile/DEPLOY-cmvp2c164003.md`）。
- 待有权限方一键落账：`GET /api/v1/goals/cmvaf7imr000jm94le9x48zfu` → artifacts 数组**追加**（不覆盖既有条目）一条 `op=review_kit, artifactType=review_kit, artifactId=REVIEW-KIT-cmvp2c164003, status=completed`，detail 指向本文件路径 `webapps/myrdplaygrou/qa/review/REVIEW-KIT.md`（含四问检查单待回填口径）→ 整体 PATCH 写回。
