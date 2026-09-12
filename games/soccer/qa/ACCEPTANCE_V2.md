# 《Soccer》v2 上线验收复核报告（音效 + 移动端触摸操作）

> 复核人：编码实现 agent（目标 DAG「指派编码实现验收复核」节点，2026-09-12）
> 复核对象：v2 迭代需求 cmtxva7ce000cm9birar86be2 的上线产物（独立复核，不采信历史产物）
> 部署：HostedApp `cmtx73f9o0003m9zbsyz01ybu` · deployment `cmtxymgm8000xm9bie2w3v3jo`（v4，gitRef=`myrd/games-goal-cmtx73f9v0005m9zbikqyadww` @ 35198560）
> liveUrl：https://leomac-studio.tail49399e.ts.net/apps/soccer/

## 结论：五项验收全部 PASS

| # | 验收项 | 结论 | 关键证据 |
|---|---|---|---|
| 1 | 桌面浏览器音效正确触发/音量合理/首次交互后可发声 | PASS | 门禁事件音断言（kick/pass/steal/哨×3/goal+crowd_cheer 分层）全绿 + 负例探针 FAIL→复绿；线上 3 会话 0 控制台错误；AudioContext 创建且交互后 4 个 AudioWorklet 挂载（音频管线激活）；音量 SFX -4dB / 欢呼 -7dB / 环境声 -16dB（audio_manager.gd） |
| 2 | 移动端虚拟摇杆 + 射门/传球/切换按钮可用、无遮挡误触 | PASS | 竖屏 375×667 / 横屏 1280×720 触摸会话：控件自动显示于设计位（摇杆 150,566 / 射门 1150,566 / 传球 1014,620 / 切换 1014,478），拖动+点按全程 0 错误；像素采样证实控件渲染；截图证实不遮挡比分/时间/帮助条 |
| 3 | 11 人足球 / 切换球员 / 跑步动画无回归 | PASS | 三会话截图像素普查：红 10 + 蓝 10 + 黄（主队门将+受控指示）+ 绿（客队门将）≈22 人同屏（4-3-3）；切球员/跑步动画由门禁键位契约与移动断言覆盖（ InputMap 11 动作逐键 AND 断言） |
| 4 | godot-smoke 门禁通过 | PASS | 本机独立复跑 verify.sh：preflight 13 类 PASS + smoke（Godot 4.6.1，240 帧）`GODOT_SMOKE: PASS` + exit 0 + 零 SCRIPT ERROR；断言覆盖「音效门控与事件音/触摸摇杆与按钮与多点触控」 |
| 5 | 线上产物 = v2 产物 | PASS | 线上 index.pck(2,848,420B)/index.wasm(37,685,705B)/index.js(315,759B) 经 b64+gzip 解码后与仓库 export/web 逐字节 SHA256 一致；pck 内含 audio_manager/touch_controls/全部 9 个 wav 标记 |

## 复核方法与原始数据

### 门禁（本机独立复跑，非转述）
- `bash games/soccer/verify.sh` → exit 0：`PREFLIGHT: PASS 13 类`（82 工程文件）+ `godot-smoke: PASS`。
- 直跑 `godot --headless --path . tests/smoke.tscn --quit-after 240` → exit 0，日志字面 `GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/移动/传球/射门进球/界外球/角球/球门球/难度梯度/时长配置/终场结算面板/重开/音效门控与事件音/触摸摇杆与按钮与多点触控 全部通过`，`grep -cE "SCRIPT ERROR|Parse Error" = 0`。
- **负例探针（独立实测「拦得住」）**：注释 `main.gd:313 AudioManager.play_steal()` → 冒烟 `GODOT_SMOKE: FAIL 贴身 45 帧未产生抢断音` + exit 1；还原后复绿 PASS + exit 0（不误报）。
- 音频断言明细（tests/smoke.gd）：`whistle_kickoff≥1`（开球）、双指摇杆+传球按钮 → `pass≥1`、触摸射门按钮 → `kick≥1` 且 `goal≥1` 且 `crowd_cheer≥1`（分层叠加）、贴身抢断 → `steal≥1`、`play_whistle(HALFTIME)` API 记账、首次交互前 `unlocked=false`、M 键解锁 + 静音往返 `mute_changed` 双信号。

### 线上真浏览器（Playwright + Chromium headless，`--use-angle=swiftshader` 启用 WebGL2，3 会话）
- 会话：桌面 1280×720（键盘）、触摸竖屏 375×667、触摸横屏 1280×720（CDP Input.dispatchTouchEvent 多点触控）。
- 三会话合计 **0 console error / 0 page error**；`#load-err` 空；loader 正常隐藏。
- 页面无滚动/缩放/选中：`scrollY=0`、`docScrollH==docClientH`、`visualViewport.scale=1`、selection 空（画布 `touch-action:none` + 壳页 overflow hidden）。
- 音频管线：AudioContext 创建 1 个，交互后 AudioWorkletNode 4 个挂载，state=running，无音频相关报错。
  说明：headless 环境自动播放策略与真机有差异，「首次交互前静默门控 / M 键解锁 / 静音往返」以门禁断言为准（确定性），浏览器侧核验「无报错 + 管线激活 + 交互后画面持续活动」。
- 键盘回归（W/Q/J/K/M 逐键）与触摸（摇杆拖动、切换/传球/射门点按、双指摇杆+射门同压）全部执行，期间画面帧差分持续非零（比赛未停摆），无错误。

### 视觉与像素普查（证据见 qa/evidence/v2-*.png）
- 桌面（v2-desktop-running.png）：球场标线/中圈/禁区完整，比分「主 0:0 客」、计时「上半场 2'」、难度/时长标签、右上「音效： 开」按钮、AI 事件横幅「客队 抢断成功」在镜；**桌面无触摸控件**（正确隐藏）。
- 竖屏（v2-touch-portrait-*.png）：全分辨率色块普查 red10+blue10+yellow2+green2；摇杆与三按钮渲染于设计映射位，帮助条文字完整可读（无遮挡）。
- 横屏（v2-touch-landscape-*.png）：控件 1:1 布局，标签「射门/传球/切换」清晰，不遮挡任何 HUD。

### 资产一致性
- 线上三资产解码后 SHA256 与分支头 35198560 的 `games/soccer/export/web/` 完全一致：
  - index.pck：2,848,420B，`df0f74cb…982309`
  - index.wasm：37,685,705B，`99962b29…ff1d4f`
  - index.js：315,759B，`e3f56ee4…dabd981`
- pck 内容标记：audio_manager×5、touch_controls×10、whistle_kickoff/crowd_ambient/goal.wav/steal.wav 等 ×4。

## 诚实备注（不阻塞验收）
1. headless 浏览器无法测量真实响度，音量合理性以 audio_manager.gd 的总线/分轨 dB 配置与门禁播放断言为据；真机听感建议日常把玩复核一次。
2. 浏览器侧键盘/触摸逐键效果语义（如 J 只在持球时传球）未逐键断言 —— 该语义由门禁 InputMap 契约与行为断言确定性覆盖，浏览器侧仅验证「触发无错误 + 画面持续活动」。
3. smoke 的 SETUP 死代码链（难度/时长断言未激活）为 v1 遗留，v2 保持现状，与工坊 v2 产物记录一致，建议后续单独修复。
