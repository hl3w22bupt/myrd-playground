# 《星尘收集者》真机验收清单（iOS Safari / Android Chrome）

桌面自动化门禁（`verify.sh` 三段 PASS）与桌面浏览器只能覆盖**代码路径与逻辑正确性**；
触控手感、手势解锁音频、安全区、真机帧率必须在**真机**上验收。本清单是真机侧的唯一验收入口，
配套文档：桌面可实测项见 `measured-evidence.md`，真机结果回填见 `real-device-pending.md`。

## 适用范围与环境等级

| 等级 | 含义 | 本清单归属 |
|---|---|---|
| `desktop-headless` | 本仓库 verify.sh 可实跑（preflight/冒烟/fuzz） | 见 measured-evidence.md |
| `desktop-simulated` | 桌面浏览器 DevTools 触摸模拟 —— 只证明布局与事件路径，**不证明触控手感** | 仅限 D1 布局预检 |
| `real-device` | iOS Safari 16+ / Android Chrome 最新两个大版本，手指实触 | 本清单全部 P0 项 |

**红线：`desktop-simulated` 的任何结果不得写成真机结论。** 真机项只能填 `pass / fail / 待验`。

- 游戏入口：`https://leomac-studio.tail49399e.ts.net/apps/game-2`
- 每台设备约 10 分钟：A 摇杆（3 min）→ B 确认（2 min）→ C 音频（2 min）→ D 安全区/横屏（2 min）→ E 帧率（1 min）

## A. 虚拟摇杆触控（P0）

代码路径：`scripts/virtual_joystick.gd`（`_unhandled_input` 收 `InputEventScreenTouch/Drag` →
注入 `move_left/right/up/down` 动作强度）；显示条件：`main.gd` 里 `DisplayServer.is_touchscreen_available()`。

| # | 步骤 | 通过标准 |
|---|---|---|
| A1 | 打开游戏，观察左下角 | 摇杆圆盘**自动出现**（真机有触摸屏 ⇒ TouchUI 可见）；桌面才显示「WASD」提示文案 |
| A2 | 手指按住摇杆圆心，缓慢向右拖出约 1/4 半径（≈14px） | 拖动超过死区（`DEADZONE_RATIO=0.25`）后飞船才开始移动；圆心内微动**不**导致漂移 |
| A3 | 向右拖到圆盘边缘再拖更远 | 飞船右移且速度有渐变（强度 0→1 随半径线性）；拖出圆盘外输出被钳制不突变 |
| A4 | 松手 | 飞船**立即**停止输入（动作强度归 0；惯性滑行 ≤ 半个机身算过） |
| A5 | 按住后手指**滑出摇杆矩形**继续拖动 | 轨迹不丢失、方向持续跟随（实现走 `_unhandled_input` 而非 `_gui_input`，就是为此） |
| A6 | 一指拖摇杆时，另一指点屏幕任意处 | 移动不被第二触点打断/钳死；抬起摇杆手指后飞船停 |
| A7 | 斜向 45° 拖动 | 飞船沿对角移动，斜向合速度不明显快于正向（`Input.get_vector` 归一化） |
| A8 | 快速连点摇杆区域 | 无卡死：抬起后飞船必停，无「残留 pressed」漂移 |

证据：录屏（A3-A7）+ 机型/系统版本记录。

## B. 触摸确认按钮（P0）

代码路径：`scripts/touch_confirm_button.gd`（`TouchScreenButton` + 圆形热区 r=44 → 注入 `confirm`）；
结算面板「重新开始」是普通 `Button`（GUI 触摸路径）。

| # | 步骤 | 通过标准 |
|---|---|---|
| B1 | 进入一局，把护盾撞到 0（或达到目标分）弹出结算面板 | 右下角圆形「确认」按钮可见、不与面板重叠 |
| B2 | 点按「确认」圆钮 | 等效键盘 confirm：立即重开，分数归 0、护盾回 3、面板消失 |
| B3 | 点按结算面板内「重新开始」按钮 | 同样立即重开（GUI 触摸路径） |
| B4 | 结算面板未弹出时（游戏中）点「确认」圆钮位置 | 无副作用：不误触重开、不改变移动状态 |
| B5 | 点按热区**边缘**（距圆心 ≈40px） | 仍可命中（r=44 热区），但视觉圆与热区一致、无「看着没点中却触发」的违和 |

证据：录屏 B2-B4。

## C. 首次用户手势解锁音频（P0，iOS 特有风险）

壳页已内置「移动端音频手势解锁器」（`server/src/game-page.ts`）：包裹 `AudioContext` 构造器捕获引擎实例 +
`touchstart/touchend/pointerdown/keydown/click` 五类手势内同步 `resume()`（capture+passive，不消费事件）+
`window.__audioDebug()` 取证出口。iOS/Android WebKit 的 AudioContext 创建即 `suspended`、来电/切后台后
`interrupted`，引擎自身不识别这两种态 —— 缺壳页兜底 = 移动端无声而桌面正常。

**如实说明**：当前版本游戏内**没有任何 AudioStreamPlayer / SFX 节点**（2026-09-27 全量 grep 证据见
`measured-evidence.md` §5）。本项验收降级为「音频上下文健康」：确认解锁器工作、控制台无音频报错；
**未来加入音效后必须复测**，并用 C4 确认真的听到了声音。

| # | 步骤 | 通过标准 |
|---|---|---|
| C1 | 冷加载页面，**不碰屏幕**，开控制台（iOS 需连 Mac Safari Web Inspector） | 无 `AudioContext was not allowed` / worklet 加载报错；`__audioDebug()` 显示 AudioContext 已创建 |
| C2 | 屏幕任意处**点一下**（首次手势），再查 `window.__audioDebug()` | AudioContext state = `running`（创建即 `suspended` → 首手势内 resume 成功） |
| C3 | 播放中切后台/来电（或锁屏 3 秒）再返回，点一下屏幕 | 状态恢复 `running`（`interrupted` 态同样被兜底），无持续报错 |
| C4 | （加音效后）首次手势后收一颗星尘 | 能听到收集音效；横竖屏切换、切后台往返后音效仍响 |

取证命令：控制台输入 `window.__audioDebug()`，把返回 JSON 原样贴进回填记录（字段含创建次数/resume 次数/state）。

## D. 安全区与横屏（P0 / P1 混合）

布局事实：视口 640×360、`stretch/mode=canvas_items` + `aspect=keep`（横屏 letterbox）；摇杆锚左下、
确认按钮锚右下，**距 canvas 底边 24 逻辑像素**；HUD 顶部 offset 12。壳页 `touch-action: none` +
`user-scalable=no` 已禁双击缩放/手势缩放。

| # | 等级 | 步骤 | 通过标准 |
|---|---|---|---|
| D1 | P1（desktop-simulated 预检 + 真机确认） | 横屏持机，看四角与 HUD | HUD 文字不被刘海/Dynamic Island 遮挡；分数/护盾完整可读 |
| D2 | P0 | 检查摇杆与「确认」按钮 | 两个控件完整在**手指可达且不被系统手势条遮挡**的位置；iPhone 底部 home indicator（≈34pt）不压住按钮热区 |
| D3 | P0 | 竖屏打开 → 旋转到横屏 | 画面重排无崩溃、无黑屏；letterbox 黑边对称；触控仍正常 |
| D4 | P1 | 游戏中旋转 3 次以上（各方向） | 无输入丢失/卡死；摇杆状态正确复位（无残留移动） |
| D5 | P1 | 双指捏合 / 双击快速 | 页面不缩放、不触发 Safari 双击缩放（`user-scalable=no` + `touch-action:none` 生效） |
| D6 | P2 | iOS「添加到主屏幕」打开 | 可接受降级：记录打开形态（Safari 标签 or 主屏窗）与视口差异即可，不作为阻断 |

## E. 帧率（P0 观测、P1 判定）

期望：主流机型（A12 / 骁龙 855 及以上）横屏稳定 ≥ 30fps，理想 60fps；难度 10 级（陨石封顶 10 颗）时
最低帧不低于 24fps。测量方式（二选一）：

- iOS：Mac Safari「开发 → [设备] → [页面]」Web Inspector → Timelines 抽样 60 秒；
- Android：`chrome://inspect` 远程调试 → Performance 面板录 30 秒。

| # | 步骤 | 通过标准 |
|---|---|---|
| E1 | 开局挂机 60 秒（难度 0 级）记录平均/最低帧 | 平均 ≥ 50fps，最低 ≥ 40fps |
| E2 | 故意玩到分数 20+（难度 ≥ 2 级，陨石变多变快）再测 60 秒 | 平均 ≥ 30fps，最低 ≥ 24fps，无可感知卡顿（>100ms 掉帧） |
| E3 | 收集/受击瞬间（飘字 + 震屏同帧）观察 | 无明显帧尖峰；反馈动画不丢帧 |
| E4 | 发热后（连续玩 5 分钟）再测一次 E2 | 帧率下降 ≤ 30%，不触发 Safari 页面重载 |

## 判定与回填

- **P0 项（A1-A8、B1-B4、C1-C3、D2-D3、E1-E2）全部 pass ⇒ 真机验收通过**；任一 fail ⇒ 记录机型+复现步骤，按 `real-device-pending.md` 回填，工程侧修复后复测失败项。
- 结果回填：把 `real-device-pending.md` 的模板复制填写，连同录屏/`__audioDebug()` JSON 一起回贴到试玩记录。

