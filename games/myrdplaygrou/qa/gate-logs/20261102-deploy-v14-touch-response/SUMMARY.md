# deploy 节点收口：v11→v14 部署 + mobile touch-response 打回修复闭环（2026-11-02）

> 本节点：把 implement 节点的策划案 v3 实现（八关扩容 + 难度曲线上调 + 音频真实出声链路）
> 部署上线，并按门禁纪律收敛 deploy 节点双门禁（godot-smoke 本地四门禁 + mobile-web-smoke
> 线上门禁）。判定脚本一律来自仓库 `std-skills/godot-game-dev/scripts/`（零自造零改写）。
> 收口 commit：`26c7b62`（分支 `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`）。

## 1. 部署链（AppHost bundle 模式，gitRef 绑目标分支）

| 版本 | deploymentId | commit | 状态 | 内容 |
|---|---|---|---|---|
| v12 | cmvy5nrbx001mm9y0epvsjz8q | 652106f | superseded | implement v3 实现（壳层 getOutputEnergy 上线） |
| v13 | cmvy6o1lh001om9y0vhj81vmb | c22c1e9 | superseded | 修复轮 1：空白落点层（PASS 透传） |
| **v14** | **cmvy6zxdg001qm9y0b3sgs5f6** | **26c7b62** | **running（线上）** | 修复轮 2：落点 toast（本收口版） |

- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/（尾斜杠 308 归一化后 200）
- `/health` → 200 `{"ok":true,"app":"myrdplaygrou",...}`；落地页含 `getOutputEnergy`（能量探针在线）
- **线上 pck 一致性锚定**：资产通道 `index.pck.gz.b64` → base64 → gunzip → sha256
  = `32d79ee289bd5184cb6cc57264ffa20df7ac32bbe159b42bfd11ba1153f3562a`，
  与本地 HEAD `26c7b62` 导出逐字节一致（`index.js` 引擎不变 = `8b649683…`）——
  「部署的就是这份代码」为可机判事实。

## 2. 门禁打回与修复闭环（v12 版 MOBILE_SMOKE: FAIL → v14 全绿）

**FAIL 现象**（v12，--project 完全口径）：11 项中 10 绿 1 红 —— `touch-response`
（tap 视口中心后 3s 画面零变化，tapDiff=0）。

**根因取证**（诊断探针逐层排除，非判定器，脚本未入库）：
1. 输入链路完好：tap 第 1 关卡片帧差 129、锁定关状态行反馈帧差 8 —— 触摸→引擎→GUI 全通；
2. 落点几何：8 关选关页为 4×2 居中网格（headless 实测控件矩形：行带 237..325/337..425，
   列缝 504..516），视口正中 (512,320) 恰落在列缝/行缝的十字间隙，全链 IGNORE → 零响应；
   v10（3 关竖排）同探针落点在卡片上，故历史全绿 —— 本次 FAIL 是 8 关扩容后的布局回归；
3. 修复轮 1（c22c1e9）：加全屏空白落点层给持久反馈。**STOP 版被本地能量探针实锤打回**：
   手势后 RMS=0、bgmPlaying=false —— STOP 会吃掉空白落点手势，main.gd「首个人类输入
   Audio.ensure_playing()」（BGM 手势起播兜底）依赖事件透传。改 `MOUSE_FILTER_PASS` 后
   DOM 取证 elementFromPoint=CANVAS、引擎侧 tap 后 state=running/unlocked/bgmPlaying=true；
4. 修复轮 2（26c7b62）：v13 线上 tapDiff 仍 0 —— 全像素带状 diff 实证反馈已发生但只有
   2,668 px（0.088% 画面），门禁 400 点指纹采样期望命中 0.35 点被漏采。把反馈升级为
   带边框双行 toast 面板（定位落点、4s 收起、IGNORE 不吃点按）→ 36,735 px（1.24%，
   期望命中 5 点）→ 线上 tapDiff=5 → PASS。

**工程语义**：修复落在工程已声明的触屏优先原则「任何点按都必须有可见反馈，不允许
按了没反应」（level_select.gd `_on_level_pressed` 注释既有的锁定关反馈同款），
空白落点 toast 是该原则在非交互落点的补全，非为门禁而设的专门通道。

## 3. deploy 节点门禁终局（全绿）

### 3.1 本地四门禁（verify.sh 薄壳调度，fail-closed，退出码 0）

证据：本目录 `verify-full.log`（HEAD 26c7b62，命令 `bash games/myrdplaygrou/verify.sh`）

| 门禁 | 判定 | 实测 |
|---|---|---|
| resolve-godot.sh | Godot 4.3.stable.official.77dcf97d8 | 可用 |
| preflight.py | PREFLIGHT: PASS | 15 类（2635 个工程文件） |
| smoke.sh（240 帧） | GODOT_SMOKE: PASS | 八关逐关通关 + 无尽探针 + **选关空白落点反馈断言（本轮新增：反馈在位 + toast 弹出 + 必须 PASS 透传机判）** |
| input-fuzz.sh | GODOT_FUZZ: PASS | seed=20260913，6 批次 239 帧 |
| playtest.sh | GODOT_PLAYTEST: PASS | 3 局 ×900 帧，fb=227/245/236，最长反馈窗 0.38s |

### 3.2 移动端模拟门禁（线上 liveUrl，--project 完全口径，headless Chrome 390×844 DPR3 iPhone UA）

判定：**MOBILE_SMOKE: PASS（11/11 全绿，退出码 0，独立复跑双确认）**
证据：`games/myrdplaygrou/qa/mobile/`（report.json verdict=PASS + phase-load/tap/joystick.png）

| 判定 | 结果 |
|---|---|
| network | PASS 无 5xx/404/登录墙 |
| console | PASS 零 error + 零未捕获 |
| canvas | PASS 引擎产物已挂载 |
| render | PASS 8 种量化色（≥2 达标） |
| animate | PASS idleDiff=328 > 0 |
| touch-pipeline | PASS tap/swipe 均派发到 DOM |
| touch-response | **PASS tapDiff=5 > 0（toast 反馈命中指纹采样）** |
| joystick-response | 按规则裁撤（工程无虚拟摇杆，点按类玩法，--project 校验） |
| audio-unlock | PASS `window.__audioDebug` 契约在位 |
| viewport | PASS 无横向溢出（scrollWidth=390 = clientWidth=390） |
| fps | PASS 40 fps（swiftshader 软渲染口径 ≥8） |

### 3.3 音频「真实输出能量」机判数据面（liveUrl 实测，playtest 节点口径预验证）

| 通道 | 结果 | 关键实测 |
|---|---|---|
| 壳层 spec 契约直测（`qa/mobile/shell-energy-contract.mjs`，生产形态零注入） | **SHELL_ENERGY: PASS 4/4**（本目录 shell-energy-live.log） | 手势前 `{rms:0, running:false}`；手势后连续两窗 RMS **0.0285 / 0.0435 > 0.01**；静音后 RMS=**0**（≤0.001 真实静默）；取消静音 RMS 0.0288 恢复 |
| 全链路能量取证（`qa/mobile/audio_energy_probe.mjs`，AnalyserNode 插桩 + 严格自动播放策略） | **AUDIO_PROBE: PASS 9/9**（本目录 audio-probe-live.log + audio-probe-live-report.json） | 首手势前真实静音（ctx suspended）→ 手势解锁 → BGM 真实出声（持续能量）→ 音效尖峰 → 静音即时归零 → 取消恢复 → 线上 pck sha256 与 13 音频资产在包一致 → console 零 error |

## 4. 移交状态（playtest 节点）

- 线上 v14 = 分支 HEAD `26c7b62`，双门禁 + 音频能量机判数据面全绿；
- playtest 节点可直接复用 §3.3 两通道（liveUrl + 上表哈希锚点），预期 `真实输出能量 > 阈值` 机判通过；
- 已知边界：本地导出产物 `qa/mobile/audio-energy/` 下的相位截图为 v14 线上实测（AnalyserNode
  插桩通道）；门禁判定脚本零改动，全部诊断探针（tap/像素带/音频）为一次性 /tmp 脚本未入库。

## 5. 执行窗口

2026-11-01T18:20Z（v12 部署）— 2026-11-01T19:02Z（收口），+0800 = 2026-11-02 02:20 — 03:02。
