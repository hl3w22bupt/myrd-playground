# CDP 移动仿真预检证据归档（非真机口径）

> 采集时间：2026-09-26 23:18–23:22（本地）
> 采集方式：gstack browse（共享 Chromium，CDP 驱动）→ 视口 390×844（iPhone 15 Pro 逻辑分辨率）
> 目标：`https://leomac-studio.tail49399e.ts.net/apps/game-3/`（`/health` = `{"ok":true,"app":"ninja-run"}`）
> 原始命令与逐条输出：见 `precheck-log.md`。

## ⚠️ 口径红线（必读）

**本目录全部证据来自桌面 Chromium 的移动仿真（viewport 模拟），不是真机。**
它证明的是「壳页 → 资产通道 → 引擎启动 → 输入/音频/调参桥」这条**链路在 Web 环境下工作正常**，
不能证明真机触控延迟、iOS 音频打断恢复、真机帧率与发热。真机结论唯一有效来源是
`../ios-safari-checklist.md` 的执行结果（归档于 `../artifacts/`）。

直接例证：同一 URL 在**无 GPU 的无头 Chromium** 里因缺 WebGL2 被引擎拒绝启动（`precheck-log.md`
§P2），而有 GPU 环境正常——环境差异会直接改变结论，这正是仿真不能替代真机的原因。

## 证据清单

| # | 证据 | 内容与结论 | 文件 |
|---|---|---|---|
| E1 | 启动渲染 | 引擎启动完成、画面正常渲染（HUD 四行、赛道/飞镖/结算弹层可见）。截图里「失败」弹层系无人值守自动奔跑坠坑所致，恰好证明胜负状态机与结算 UI 工作正常 | `01-boot-before-tap.png` |
| E2 | 点按手势 | 对 canvas 派发点按后，`__audioDebug()` 由 `{state:"suspended"}` 变为 `{state:"running", log:[{state:"running"}]}` —— 壳页 F1 手势解锁补丁在 Web 层生效 | `precheck-log.md` §P4 |
| E3 | 调参桥注入 | 带 `?tuning=` 的 URL 加载后 `window.__GAME_TUNING__` = `{run_speed:600, max_jumps:9, evil_key:42}`：壳层原样透传（含未声明键），过滤与钳制由游戏侧 `TUNING_META` 负责 | `03-tuning-url.png` + §P5 |
| E4 | 引擎日志 | 控制台出现 `Godot Engine v4.3.stable` 与 `OpenGL ES 3.0 (WebGL 2.0 …) Compatibility`，渲染器为 gl_compatibility，与导出预设一致 | `precheck-log.md` §P4 |
| E5 | 资产通道 | `api/public/assets/index.js` 等 HTTP 200；worklet `addModules=1`（F2 补丁改写生效） | `precheck-log.md` §P3/P4 |
| E6 | 反例：无 WebGL2 环境 | 无头无 GPU 环境：资产与壳页全部正常，但 `Engine.getMissingFeatures` 拦截启动，报「浏览器缺少运行所需特性: WebGL2」——环境限制，非游戏缺陷 | `precheck-log.md` §P2 |

## 已知边界（本预检未覆盖，留给真机清单）

- 触控延迟/二段跳手感（CDP 派发的是合成事件，无真实触控采样延迟）→ 真机 C4–C7
- iOS 音频打断（锁屏/来电/静音键）→ 真机 C8–C9
- 真机帧率/发热/省电模式降频 → 真机 C10–C11
- Safari 具体版本行为差异 → 真机清单 §0 环境登记
