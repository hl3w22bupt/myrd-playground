# 真 WebKit 移动端取证报告（无效交换反馈 + 移动端音频解锁）

取证时间：2026-09-13 · 取证人：目标 cmto0g28w0008m9sq0cyms729 子任务（验收硬标准 3/4）
线上对象：liveUrl `https://leomac-studio.tail49399e.ts.net/apps/game/`
部署：AppHost v13 `cmtymbsr7000am9bu96mf3sq5`（status=running，commit `3d7aaf8b`，mode=bundle）

## 取证环境（真 WebKit 内核）
- 内核：Playwright WebKit 独立构建 **webkit-2359**（非 Chromium shell，真 WebKit 引擎）
- 设备模拟：`devices['iPhone 13']` → UA
  `Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 …`
  `navigator.maxTouchPoints = 5`（hasTouch ✓），视口 390×664 @3x
- 输入：`page.touchscreen.tap()` 真实触摸管线（非 JS 合成事件），
  DOM capture 层计数器证实 5 次 tap 全部到达页面（touchstart/touchend/pointerdown 各 5）

## 四条验收硬标准逐条留证

### ① godot-smoke PASS
`bash games/game/verify.sh` → exit 0：
`PREFLIGHT: PASS 13 类前置一致性检查全部通过（56 个工程文件）`
`godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）`
（240 帧预算，GODOT_BIN=/opt/homebrew/bin/godot，Godot 4.6.1.stable）

### ② 新 deployment id
AppHost deployments API：v13 `cmtymbsr7000am9bu96mf3sq5` status=**running**，
commitHash=`3d7aaf8bf04589e184c6dc0cead708947b748d1f`（= 本地 HEAD `3d7aaf8b`），
`GET /apps/game/health` → 200 `{"ok":true,"app":"candy-crush-legend","env":"development","assets":"lazy/object-storage"}`

### ③ 音频手势解锁器（页面源码 + 行为双断言）
- **源码断言**：线上 HTML 含全部 9 个解锁器标记：
  `__audioDebug` / `unlockAudio` / `WrappedAudioContext` / `touchstart` / `pointerdown` /
  `webkitAudioContext` / `statechange` / `visibilitychange` / `audioAddModules`（page-source.html 存档）
- **行为断言**：真实触摸「开始游戏」按钮（首个用户手势）后：
  `window.__audioDebug()` → `{"state":"running","addModules":2,"log":[{"t":…,"state":"running"}]}`
  **state === 'running' ✓**（AudioContext 已解锁；audio worklet ×2 加载成功），
  且全程保持 running（取证结束时终态仍为 running）→ evidence4.json

### ④ 无效交换触发明显抖动/回弹动画（移动端视口截图 + 视频 + 像素定量）
触摸交换相邻格 (1,3)→(1,4)（无效交换），10fps 抽帧 + 糖果色块质心测量：
- **HUD 大字提示**：`Invalid swap - needs a match of 3`（字号 18→30 加大，停留 2.5s）
  → `frames/frame065_hud-invalid-msg-right-swing.png`、高清版 `screenshot3x_invalid-red-flash-hud-msg.png`
- **红闪框**：光标错误闪烁红框出现在 tapB 目标格 → 同上两图
- **抖动定量轨迹**（质心偏移 CSS px / 色块面积，详见 shake-trajectory.txt）：
  | 帧 | (1,4)红 偏移 | 面积 | 阶段 |
  |---|---|---|---|
  | f_0063 基线 | −0.35 | 921 | 静止 |
  | f_0064 | −2.18 | **632** | 缩小段（面积比 0.69≈0.72²=INVALID_SHRINK_SCALE²）+ 左摆 |
  | f_0065 | **+1.86** | 635 | 右摆（同帧 HUD 提示出现） |
  | f_0066 | −1.14 | 917 | 衰减左摆 + 回弹并行走 |
  | f_0067 | −0.41 | 1076 | 衰减 + TRANS_BACK 回弹 |
  | f_0068 归位 | −0.34 | 1059 | 与基线一致（质心/面积双归位） |
- **不耗步**：MOVES 保持 19；对照有效交换 frame043（SCORE 60、MOVES 20→19）
- **完整动画录像**：`invalid-swap-audio-unlock.webm`（8.48s，含开局、有效交换对照、无效交换全程）

## 取证方法备注（复现要点）
1. Playwright WebKit 旧构建的 iPhone 13 描述符视口为 **390×664**（非 844），所有触摸坐标须按
   scale=664/1280（aspect=expand）换算：棋盘格心 CSS = (70.4+49.8x, 238.6+49.8y)，
   START 按钮中心 ≈ (195,370)。
2. 该 WebKit 构建下，「touch tap 之前连续 page.screenshot」会静默破坏后续触摸进入游戏输入管线
   （DOM 层事件照常派发，Godot 不响应）；取证脚本必须在 tap 前零截图、以 recordVideo 记录画面。
3. 脚本与全部原始帧存档于取证工作区 /tmp/candy-webkit（evidence4.cjs / analyze 系列）。

## 结论
四条验收硬标准全部达标（godot-smoke PASS / 新 deployment id running / audioDebug running 断言 /
无效交换抖动·回弹·HUD·红闪四重反馈截图+视频+像素定量），移动端音频解锁与无效交换反馈修复在线上
真 WebKit 环境验证通过，无需录入缺陷。
