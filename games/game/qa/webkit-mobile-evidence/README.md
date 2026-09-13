# 真 WebKit 移动端取证报告 v5（无效交换反馈 + 双页面音频手势解锁）

取证时间：2026-09-13 · 取证人：目标 cmto0g28w0008m9sq0cyms729 子任务（分支历史重写后于 HEAD 重建）
线上对象：liveUrl `https://leomac-studio.tail49399e.ts.net/apps/game/`
部署：AppHost **v16** `cmtypp8k20011m9k7oa8pp5s8`（status=running，commit `d7ba6cd5660726f1d3bb7b7ee7227e07fe827d99` = 本地 HEAD，mode=bundle）

> 相比 v4 取证（旧历史 989be18，已随分支重写不可达），本版新增**静态导出页相位**：
> 解锁器已随自定义导出壳（`export/web-shell.html`）内嵌进 `export/web/index.html`，
> 取证不再只覆盖 AppHost 壳页，而是「壳页 + 静态导出页」双页面双重断言。

## 取证环境（真 WebKit 内核）
- 内核：Playwright WebKit 独立构建 **webkit-2359**（非 Chromium shell，真 WebKit 引擎）
- 设备模拟：`devices['iPhone 13']` → UA `Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 …`，
  `navigator.maxTouchPoints = 5`（hasTouch ✓），视口 390×664；3x 截图相位 `deviceScaleFactor=3`
- 输入：`page.touchscreen.tap()` 真实触摸管线（非 JS 合成事件）；
  DOM capture 层计数器证实全部 tap 到达页面（touchstart/touchend/pointerdown 最终各 5/5/5）
- 静态导出页相位：本地 `python3 -m http.server` 伺服 `games/game/export/web/`（`http://127.0.0.1:8123/index.html`）

## 验收硬标准逐条留证

### ① godot-smoke PASS
`bash games/game/verify.sh` → exit 0：
`PREFLIGHT: PASS 13 类前置一致性检查全部通过（70 个工程文件）`
`godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）`
（240 帧预算，GODOT_BIN=/opt/homebrew/bin/godot，Godot 4.6.1.stable；判定器唯一来源 std-skills/godot-game-dev/scripts/）

### ② 新 deployment id
AppHost deployments API：**v16 `cmtypp8k20011m9k7oa8pp5s8`** status=**running**，
commitHash=`d7ba6cd5660726f1d3bb7b7ee7227e07fe827d99`（= 本地 HEAD），
`GET /apps/game/health` → 200 `{"ok":true,"app":"candy-crush-legend","env":"development","assets":"lazy/object-storage"}`

### ③ 音频手势解锁器（双页面 源码 + 行为 双断言）
- **线上壳页源码断言**：HTTP 200，HTML 含全部 9 个解锁器标记：
  `__audioDebug` / `unlockAudio` / `WrappedAudioContext` / `touchstart` / `pointerdown` /
  `webkitAudioContext` / `statechange` / `visibilitychange` / `audioAddModules`（page-source-live.html 存档）
- **线上行为断言**：真实触摸「开始游戏」按钮（首个用户手势）后：
  `window.__audioDebug()` → `{"state":"running","addModules":2,…}` **state === 'running' ✓**
  （audio worklet ×2 加载成功），取证全程保持 running
- **静态导出页源码断言**（新增）：伺服出的 `export/web/index.html` 含同样 9 个标记（page-source-static.html 存档）
- **静态导出页行为断言**（新增，本版最强证据）：引擎在自定义导出壳上正常启动（worklet ×2），
  AudioContext 创建即 **suspended**（复现 iOS 无声根因）→ 首次触摸后 **running**
  （statechange 日志：`worklet×2 → running`）→ 自定义壳的内嵌解锁器真实有效

### ④ 无效交换触发明显抖动/回弹动画（视频 + 抽帧 + 像素定量 + 3x 截图）
触摸交换相邻格 (x1,y3)→(x1,y4)（无效交换，video t≈7.93s），10fps 抽帧 + 参照系质心测量：
- **HUD 大字提示**：`Invalid swap - needs a match of 3`（字号 18→30 加大，停留 ~2.5s 后自动清除）
  → HUD 带差异像素 781px 于 tap 帧出现，**+2.57s 归零**（停留期结束）→ `frames/frame_0082_fx-right-swing-hud-msg.png`、
  `frame_0106_hud-cleared-settled.png`
- **红闪错误框**：光标错误闪烁红框出现在 tapB 目标格 → `screenshot3x_invalid-red-flash-hud-msg.png`（3x 真机截图，
  同帧可见 HUD 大字提示、中文 UI 全部正常渲染 = 内嵌中文字体 Noto Sans SC 生效、MOVES 保持 20 不耗步）
- **抖动定量轨迹**（参照系=动画后稳定帧，质心偏移 CSS px / 差异面积，详见 shake-trajectory.txt 与 trajectory-fx.json）：
  | 帧 | dt(s) | B 格面积 px | B 格质心 dx | A 格质心 dx | 阶段 |
  |---|---|---|---|---|---|
  | f_0081 | +0.07 | 688 | **−0.87**（左摆） | −0.49 | 缩小段 + 左摆 |
  | f_0082 | +0.17 | 529 | **+2.32**（右摆） | +3.56 | 衰减右摆（HUD 提示同帧在屏） |
  | f_0083+ | +0.27 起 | 328 恒定 | −0.63 恒定 | — | 动画结束，仅剩选中光环 |
- **归位证明**（trajectory-fx.json homeCheck）：tap 前基线 vs 提示清除后帧，A/B 两格差异仅剩
  选中光环（328/372px 小而稳定），无错位残留 = 糖果回弹归位
- **不耗步**：MOVES 保持 20（3x 截图可见）
- **完整动画录像**：`invalid-swap-audio-unlock.webm`（11.68s，含开局、两次无效交换全程、HUD 停留与清除）

## 取证方法备注（复现要点）
1. Playwright WebKit 旧构建的 iPhone 13 描述符视口为 **390×664**（非 844），触摸坐标按
   scale=664/1280（aspect=expand）换算：棋盘格心 CSS = (70.4+49.8x, 238.6+49.8y)，START 按钮中心 ≈ (195,370)。
2. 该 WebKit 构建下，「touch tap 之前连续 page.screenshot」会静默破坏后续触摸进入游戏输入管线
   （DOM 层事件照常派发，Godot 不响应）；取证脚本必须在 tap 前零截图、以 recordVideo 记录画面；
   3x 截图用独立 context（开局遮罩截图不需要触摸，故可先截）。
3. 录像尾部必须留足 **3.4s**（FX 0.5s + HUD 停留 2.5s + 归位），否则视频在动画结束前截断、
   帧序列尾部出现冻结帧（v5 首跑即踩此坑，已修正重跑）。
4. 脚本与全部原始产物在本目录：`scripts/evidence5.cjs`（双相位主取证）、`scripts/evidence5b.cjs`（3x 截图）、
   `scripts/analyze5.py`（抽帧+HUD 定量）、`scripts/analyze5b.py`（参照系 FX 定量+归位检查）。
   复现：`WEBKIT_EXEC=<webkit>/pw_run.sh NODE_PATH=<global node_modules> node scripts/evidence5.cjs`。

## 结论
四条验收硬标准全部达标（godot-smoke PASS / 新 deployment v16 running / 双页面音频解锁源码+行为断言
（静态导出页 suspended→running 实录）/ 无效交换抖动·回弹·HUD·红闪四重反馈 截图+视频+像素定量），
移动端音频解锁与无效交换反馈修复在线上与静态导出页双通道的真 WebKit 环境验证通过，无需录入缺陷。
