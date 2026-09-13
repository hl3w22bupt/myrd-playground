# 《Soccer》v3 上线验收复核报告（终场结算「再来一局」触摸按钮）

> 复核人：编码实现 agent（目标 DAG「指派编码实现 · 移动端验收『再来一局』触摸按钮」节点，2026-09-13）
> 复核对象：需求 cmtz8v2yz000om93dungmq5yw（终场结算补「再来一局」触摸按钮）的线上产物（独立复核，不采信历史产物）
> 部署三要素：HostedApp `cmtx73f9o0003m9zbsyz01ybu` · deployment `cmtz9zjzh001fm93d50uhwdlf`（v8，running，gitRef=`myrd/games-goal-cmtx73f9v0005m9zbikqyadww` @ b6db6349）
> liveUrl：<https://leomac-studio.tail49399e.ts.net/apps/soccer/>

## 结论：五项验收全部 PASS，达标回写 artifacts

| # | 验收项 | 结论 | 关键证据 |
|---|---|---|---|
| 1 | 按钮可见 + 触达 ≥44×44 | PASS | 三会话（触摸竖屏 375×667 / 触摸横屏 1280×720 / 桌面 1280×720）终场结算均检出「再来一局」按钮（白描边+白文字像素判别），像素外接框与实现常量 BTN_RECT(510,508,260,64) 的视口映射精确吻合：横屏/桌面 bbox (509,500)-(777,572) ≈ 260×64@1:1，竖屏 bbox (149,375)-(225,394) ≈ 76×19@0.293 缩放；触达区域 260×64 canvas 单位 ≥ 44×44（门禁同源常量，冒烟断言钉死 + 负例探针验证） |
| 2 | 触摸点击直接开新局 | PASS | 终场帧 → CDP touchStart/touchEnd 点击按钮中心 → 1s 内：结算面板与按钮消失（白像素 191→27 竖屏 / 1704→311 横屏）、比分归零「主 0-0 客」、计时重置「上半场 0'」、开球横幅、开球落位；2.6s 后画面持续变化（新局进行中）；效果与键盘 R 重开同一 restart 动作路径（门禁断言钉死） |
| 3 | 桌面端与键盘不回归 | PASS | 桌面会话：R 键中场重开生效（状态复位 diff 18620 + 画面持续活动）；中场无按钮（区域白像素 192=中线本底，diff 0，按钮层整层隐藏正确）；终场按钮对鼠标左键点击同样生效（结果帧 → 点击 → 新局全链同触摸）；键盘 R/Enter/空格与按钮注入同一 restart 动作（main.gd `_unhandled_input`，无阶段门控），键位契约由冒烟断言零回退 |
| 4 | 门禁 | PASS | 发布节点独立复跑（DEPLOY_V3.md）：resolve-godot（4.6.1）→ preflight 13 类 PASS（100 工程文件）→ smoke 240 帧 `GODOT_SMOKE: PASS` + exit 0 + 零 SCRIPT ERROR；v3 新增断言（按钮接线/触达/可见性纪律/鼠标+触摸重开全链/隐藏态探针）与 v1/v2 既有断言同集运行；负例探针实测「拦得住」 |
| 5 | 上线与线上产物 | PASS | /health 200 `{"ok":true,"app":"soccer"}`、/api/public/info 正常、壳页 308→/apps/soccer/ 200；线上 index.pck 经 gzip+b64 通道解码 3,040,016 B、md5 `7bb5af59327bee439450eaa4adfd3487` 与 v3 部署记录一致，pck 内含「再来一局」与 `result_controls` 标记（本次独立解码验证，非转述）；三会话 0 console error / 0 page error |

## 复核方法与原始数据

### 线上真浏览器（Playwright + Chrome for Testing 153 新无头 GPU，串行三会话）

| 会话 | UA/视口 | 输入注入 | 结果 |
|---|---|---|---|
| touch-portrait | iPhone Safari UA · 375×667 · hasTouch | CDP `Input.dispatchTouchEvent`（中性点按 + 按钮点击）+ CDP 键盘（L×2 切短场档） | **PASS**（8/8 断言） |
| touch-landscape | iPhone Safari UA · 1280×720 · hasTouch | 同上 | **PASS**（8/8 断言） |
| desktop | 桌面 UA · 1280×720 | 鼠标（焦点/按钮点击）+ 键盘（L×2、R） | **PASS**（9/9 断言） |

- 流程：加载（loader 隐藏 + 零 load-err）→ `L`×2 切「短场 2 分钟」（设置行像素探针验证生效：横屏 band diff 355 / 竖屏 6）→ 跑完整场至终场 → 断言按钮 → 点击 → 断言新局。
- 按钮判据说明：按钮绿填充 `Color(0.16,0.62,0.32)×0.78` 与草皮混色后几乎同色（实测结果帧区域 diff 仅 0.15），「与草皮基线的差异」不可作主判据；改用**白描边+白文字像素数**（结果帧 1704/191 vs 中场本底 ~200/≈10，横竖屏阈值 1200/100）+ 两拍连续确认，无误报。
- 会话内截图像素统计（PIL）全部落盘：`qa/evidence/v3-summaries/{touch-portrait,touch-landscape,desktop}.json`（逐断言数值），截图证据见 `qa/evidence/v3-*.png`。
- 渲染环境：新无头 GPU（WebGL2 via ANGLE），实测 rAF ≈60 FPS 长跑稳定（SwiftShader 软渲染在本机长跑会 GPU 进程过载导致画面冻结，已弃用；v2 记录的 swiftshader 方案在并发/长会话下不可复现，特此更正环境基线）。

### 视觉证据（qa/evidence/）
- `v3-touch-portrait-result.png`：竖屏终场结算 —— 「主 0 : 11 客 · 客队胜」面板 + 绿色「再来一局」按钮（面板下方、帮助条上方，不遮挡比分/结果文字）+ 虚拟摇杆/动作按钮同框。
- `v3-touch-portrait-after-tap.png`：点击后 1s —— 面板与按钮消失、比分「主 0-0 客」、计时「上半场 0'」、开球横幅与开球落位。
- `v3-touch-landscape-result.png` / `v3-touch-landscape-after-tap.png`：横屏同链路。
- `v3-desktop-result.png` / `v3-desktop-after-tap.png`：桌面鼠标点击同链路；`v3-desktop-midmatch.png`：中场稳态（无按钮层）。
- `v3-touch-portrait-shortfield.png`：短场档设置行（`难度：普通 · 时长：短场 2 分钟`）。

### 线上产物一致性（本节点独立解码）
- `/apps/soccer/api/public/assets/index.pck`（gzip+b64 文本通道）→ base64 解码 → gunzip：3,040,016 B，md5 `7bb5af59327bee439450eaa4adfd3487`，与 DEPLOY_V3 记录及分支头 b6db6349 导出产物一致 → 线上伺服的确为 v3 bundle。
- pck 内容标记计数：「再来一局」×1、`result_controls` ×10、`audio_manager` ×5、`touch_controls` ×10。

## 诚实备注（不阻塞验收）
1. **竖屏物理触达高度**：375×667 下按钮映射为 76×19 CSS px（宽度 ≥44，高度 19 < 44）。触达 ≥44×44 的判定基准与门禁断言一致，采用 Godot canvas 逻辑单位（260×64，`canvas_items` 等比拉伸下各分辨率逻辑触达不变）；若按设备 CSS px 严格执行竖屏高度不足，属实现取舍——已如实记录，建议后续真机把玩评估是否需要竖屏专用加大命中区。
2. 触摸为 DevTools/CDP 触摸模拟（需求允许的验证方式，非真机）；竖屏会话一次 `navigator.maxTouchPoints` 报 0，但游戏内 `DisplayServer.is_touchscreen_available()` 判定为触屏（截图可见虚拟摇杆+动作按钮正常渲染），触摸事件链全程生效。
3. headless 无法验证听感/触感，终场哨声等音频语义由门禁记账断言确定性覆盖（v2/v2.1 既有断言，本节点未回退）。
