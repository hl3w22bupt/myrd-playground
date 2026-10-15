# 场景格式（scenario JSON）与证据包 schema

> experience-harness 的两个契约：**输入**怎么写（scenario），**输出**长什么样（pack.json + 目录布局）。
> 原则：游戏无关——同一 schema 服务 canvas 引擎页（游戏）与纯 DOM 页（web 应用），不得引入引擎专属知识。

## 一、scenario JSON

```json
{
  "name": "my-check",
  "steps": [
    { "id": "load",    "label": "加载后",     "action": "wait",       "params": { "ms": 3000 } },
    { "id": "shot0",   "label": "初始画面",   "action": "screenshot", "params": {} },
    { "id": "tap1",    "label": "点击开始",   "action": "tap",        "params": { "x": 195, "y": 422, "settleMs": 800 } },
    { "id": "joy",     "label": "摇杆右推",   "action": "swipe",      "params": { "from": { "x": 90, "y": 700 }, "to": { "x": 170, "y": 700 } } },
    { "id": "jump",    "label": "按跳",       "action": "pressKey",   "params": { "key": "ArrowUp" } },
    { "id": "state",   "label": "读状态钩子", "action": "probe",      "params": { "expr": "window.__gameState ? window.__gameState() : null" } }
  ]
}
```

### action 一览

| action | params | 说明 |
|---|---|---|
| `navigate` | `url` | 跳转（缺省回到起始 url） |
| `wait` | `ms`（≤120s） | 静置等待 |
| `tap` | `x`, `y`, `settleMs?=800` | 触摸点击（touchStart/End） |
| `swipe` / `drag` | `from{x,y}`, `to{x,y}`, `moveSteps?=10`, `settleMs?=800` | 逐步 touchMove 的滑动 |
| `pressKey` | `key`（ArrowUp/Down/Left/Right、Enter、Space、w/a/s/d） | 键盘按下抬起 |
| `screenshot` | — | 额外静置 200ms 后留证（每步本来都会截图，此动作用于占一个语义标签） |
| `probe` | `expr` | 在页面上下文求值（`returnByValue + awaitPromise`），结果进该步的 `probeResult` |

坐标是 **CSS 像素**（mobile 视口 390×844）。非法场景文件 = 用法错误（退出码 2）。
`default` 场景内置（约 22s：tap×2 + swipe + pressKey + probe + 长尾观察，满足 ≥4 截图 / ≥100 帧 / ≥10 FPS 采样点）。

## 二、证据包布局（schemaVersion 1）

```
<out>/<时间戳>-<label>/
├── pack.json               # manifest（见下）
├── steps/NN-label.png      # 每步截图（PNG，≤720 宽——视口 DPR 1.8 → 702px）
├── video/frames/NNNN.jpg   # screencast 帧序列（JPEG q60，字节预算 16MB 内能存尽存，≤400 帧；录屏的契约形态）
├── perf/fps-series.json    # { method: "rAF-window-1s", samples: [{t, fps}] }
├── network/waterfall.json  # { entries: [{url, status, critical, offsetMs}] }
└── console/errors.json     # { errors: [{offsetMs, kind: "console.error"|"uncaught", text}] }
```

## 三、pack.json 字段

```jsonc
{
  "schemaVersion": 1,
  "kind": "experience-pack",
  "evidenceOnly": true,          // 消费方提醒：无判定字段，怎么解读是判定层/人的事
  "generator": { "name": "experience-harness", "version": "0.1.0", "entry": "scripts/pack.mjs" },
  "url": "…", "startedAt": "…", "finishedAt": "…", "durationMs": 21843,
  "scenario": { "name": "default", "steps": [ … ] },   // 执行过的步骤清单
  "params": { "viewport": {…}, "frameIntervalMs": 200, "maxWidth": 720 },
  "summary": {
    "canvasPresent": true,       // DOM 里有无 canvas（引擎产物挂载的观测）
    "firstColorCount": 37,       // 首步截图 400 点 16 级量化色数（1 ≈ 纯色/没渲染）
    "idleFrameDiff": 0,          // 首个观测段的帧差（加载后静止段）
    "animatedSomewhere": true,   // 任意步骤段画面在动
    "hasRespondedStep": true,    // 存在输入后画面变化的步骤
    "steps": [                   // 逐步观测（截图相对路径、帧差、输入到达、探针结果）
      { "id": "tap1", "action": "tap", "offsetMs": 3120, "durationMs": 921,
        "inputArrived": true, "frameDiff": 143, "responded": true,
        "colorCount": 40, "screenshot": "steps/03-点击开始.png" }
    ],
    "consoleErrorCount": 0, "networkRequestCount": 9, "networkFailures": [],
    "fpsSeriesPoints": 21, "framesSaved": 104, "framesDropped": 3,
    "packBytes": 8_412_337
  },
  "notes": [],                   // 如超 25MB 预算的提示
  "files": [ { "path": "steps/01-加载后.png", "bytes": 81234, "sha256": "…" } ]
}
```

### 观测字段的解读口径（给消费方，不是判定）

- `firstColorCount ≤ 1` → 画面大概率没渲染（黑/白屏）；`≥2` 只说明「有画面」，不说明好看。
- `frameDiff === 0`（全步骤）→ 画面冻结/主循环挂死；`null` → 无法采样（异常页）。
- `inputArrived=true 且 frameDiff=0` → 输入到达但无响应（输入被吞类缺陷的典型签名）。
- FPS 序列看**趋势与谷值**，单点不作结论（swiftshader 软渲染口径偏低是常态）。

## 四、体积预算

单包 ≤25MB、单 PNG ≤5MB（image-read-guard 口径）、帧 ≤400 张。超预算时：调大 `--frame-interval`、
缩短场景、或降低 `--max-width`；manifest 的 `notes` 会记录超限事实。
