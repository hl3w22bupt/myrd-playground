# CDP 预检原始记录（非真机口径）

> 所有输出为 2026-09-26 实测逐字记录（略去空行）。工具：gstack browse（CDP）。
> 环境宿主：macOS + Chrome 153（有头，GPU WebGL2 可用）；仿真口径 = 视口 390×844。

## P0 入口健康

```
$ curl -sk https://leomac-studio.tail49399e.ts.net/apps/game-3/health
{"ok":true,"app":"ninja-run","env":"development","assets":"lazy/object-storage"}
```

## P1 首次加载（视口 390×844）

```
$ browse viewport 390x844          → Viewport set to 390x844
$ browse goto .../apps/game-3/     → Navigated ... (200)
$ js 探针（T+12s）
{"title":"疾风忍者跑","canvas":true,"bootHidden":false,"hintShown":"none",
 "tuning":null,"audio":{"state":"no-ctx","addModules":0,"log":[]}}
```

解读：HTML 壳与调参桥脚本先于引擎执行（此时 `__GAME_TUNING__` 未设置 = 无调参 URL，正确）；
音频解锁器已安装（构造器已包装，`state:"no-ctx"` = 引擎尚未创建 AudioContext）。

## P2 反例：无 GPU 无头环境（共享无头 daemon，WebGL2 缺失）

```
进度条 100% 后（T+27s 起稳定复现）：
{"bar":"100%","bootHidden":false,
 "msg":"加载失败：浏览器缺少运行所需特性: WebGL2 - Check web browser configuration
        and hardware support（M1 网关仅支持文本通道，若资源缺失请联系工坊）"}
```

解读：壳页资产通道（wasm.gz.b64 拉取 + gunzip + `WebAssembly.validate`）**全部成功**，
拦截发生在 `Engine.getMissingFeatures` —— 证明失败是**预检环境缺 WebGL2**，非游戏或壳页缺陷。
保留为「仿真环境 ≠ 目标环境」的直接例证。`game-page.ts` 兜底文案正常展示（P2 顺带验证 C2 文案）。

## P3 有头 GPU 环境重跑（本节起为有效预检环境）

```
$ browse disconnect && browse --headed goto .../apps/game-3/   → (200)
轮询：T+12s bootHidden=true（冷启动 ≈12s，含 37MB wasm 拉取与实例化）
```

## P4 启动完成探针 + 点按手势（证据 E2/E4/E5）

```
$ js 探针（点按前）
{"audio":{"state":"suspended","addModules":1,"log":[]},
 "canvasSize":[390,844],"engineBooted":false→true（见 P3 轮询）}

$ browse click "#canvas"          → Clicked #canvas
$ js 探针（点按后 T+1s）
{"audioAfterTap":{"state":"running","addModules":1,
                  "log":[{"t":1790436026991,"state":"running"}]},"canvasW":390}
```

控制台（截取）：
```
[log] Godot Engine v4.3.stable.official.77dcf97d8 - https://godotengine.org
[log] OpenGL API OpenGL ES 3.0 (WebGL 2.0 (OpenGL ES 3.0 Chromium)) - Compatibility
```

网络（截取，全部 200）：
```
GET /apps/game-3/                     → 200  5564B（308 → 无尾斜杠 200，入口归一）
GET /apps/game-3/api/public/assets/index.js → 200（引擎引导）
```

音频链路判读：`addModules:1` = F2 worklet 改写补丁命中（asset 通道加载成功）；
`suspended → running` 且 log 记录 statechange = F1 手势内同步 resume 生效。

## P5 调参桥注入验证（证据 E3）

```
$ browse goto ".../apps/game-3/?tuning=%7B%22run_speed%22%3A600%2C%22max_jumps%22%3A9%2C%22evil_key%22%3A42%7D"
→ Navigated ... (200)；T+10s bootHidden=true
$ js → {"tuning生效注入":{"run_speed":600,"max_jumps":9,"evil_key":42},
        "audio":"suspended"（新页面尚无手势，符合预期）}
```

判读：壳层把对象**原样**写入 `window.__GAME_TUNING__`（含未声明键 `evil_key`）；
过滤与钳制在游戏侧 `GameState._load_browser_tuning()`（`autoload/game_state.gd`）：
`run_speed 600 → 钳到 480`、`max_jumps 9 → 钳到 3`、`evil_key → 丢弃`。
游戏侧数值属引擎内部，CDP 不可观测，其钳制行为由 `tests/smoke.gd` 断言覆盖。

## P6 遗留观察（不阻塞，记录备查）

- 首个无头会话控制台出现过一次 `401 (Unauthorized)` 资源报错（有头复测未复现，
  网络清单中无 401 条目，判定为共享 daemon 首启会话的瞬时探针请求，与游戏链路无关）。
- 截图 01/02/03 中忍者均处于「失败结算」画面：无人值守自动奔跑坠坑所致（16% 进度处），
  恰好证明「移动 → 坠坑 → register_loss → 结算弹层」整链路在真实部署上工作。
