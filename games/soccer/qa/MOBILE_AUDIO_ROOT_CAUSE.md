# 《Soccer》移动端无声 · 根因判定 + 修复方案清单（取证报告）

> 需求：修复《Soccer》移动端 Web 无声（音效开启仍无声音，PC 端正常）`cmty5jely000cm9cyvtcd86jq`
> liveUrl：`https://leomac-studio.tail49399e.ts.net/apps/soccer`（Godot 4.6.1 Web · nothreads）
> 取证方式：真 WebKit（本机 Safari 26.3.1）加载线上页实测 + Chromium 对照 + 引擎 JS/源码逐行核对。
> 本文供工坊实现节点**直接执行**，改法均指明文件与落点。

---

## 一、结论速览

| # | 排查疑点 | 判定 | 一句话证据 |
|---|---|---|---|
| 1 | Ogg Vorbis / decodeAudioData 解码失败 | **不成立** | 9 个音效全部为 16-bit PCM WAV（RIFF/PCM/22050Hz/mono）；引擎 index.js 中 `decodeAudioData` 出现 **0 次**——Godot Web 端用自带解码器与原生 Sample 路径，浏览器解码 API 根本不在链路上 |
| 2 | AudioContext suspended 未在手势内 resume | **部分成立（主根因链）** | 实测 WebKit 下 ctx 创建即 `suspended`，且引擎**只**在输入回调里 resume；壳页 **0 行**解锁代码；`AudioManager.unlock_audio()` 只置 GDScript 标志位、从不触碰 AudioContext |
| 3 | 解锁事件覆盖不全（缺 touchstart） | **GDScript 层不成立 / 壳页层成立** | 引擎 4.6 的 keydown/mouse/touchstart/touchend 回调内都会 `resume_audio()`（源码已核）；但整条「壳页→引擎」链没有第二次兜底，且 UI 的 unlocked 与真实音频管线状态**完全脱钩** |
| 4 | threads 导出 / COOP+COEP / SharedArrayBuffer | **不成立** | `variant/thread_support=false` + web_nothreads 模板（线上 info 接口亦报 nothreads）；壳页 `ensureCrossOriginIsolationHeaders:false`，no-threads 不需要 SAB；响应头无 COOP/COEP 属预期 |
| 5 | Master 总线被静音 | **不成立** | `muted` 初始 false、无 ConfigFile 持久化、开关与总线由同一变量驱动（audio_manager.gd:94-105） |
| 6 | **【新发现】WebKit `interrupted` 状态未被引擎映射** | **成立（移动端特有）** | 实测 Safari 26 加载线上页：`suspended → statechange -> interrupted`；引擎状态机 `switch(ctx.state)` 只映射 suspended/running/closed，**interrupted 落入 default 被丢弃**；iOS 上锁屏/来电/切后台/静音键都会把 ctx 打成 interrupted，此后没有任何代码再解锁 |
| 7 | **【新发现】worklet 走 Blob URL 是音频单一故障点** | **成立（风险项）** | 壳页把两个 worklet 以 Blob URL 喂给 `addModule()`，且 Godot 的 promise **无 .catch**；Godot 4.6 的 WAV Sample 起播被 position-worklet `await` 门控（`connectPositionWorklet` 成功后才 `source.start()`）——worklet 链一断，**全部事件音静默且几乎无报错** |

**主根因（一句话）**：移动端 WebKit 的自动播放策略远比桌面 Chrome 严格（ctx 创建即 suspended、后台/打断即 interrupted），而本项目只在 GDScript 层做了「解锁记账」，**从壳页到引擎没有任何一次真正的 `AudioContext.resume()` 由可靠手势路径保证执行、也没有 interrupted 后的再解锁路径**——于是「音效开关显示开（GDScript 标志位），真实音频管线却停在 suspended/interrupted」，全部事件音静默，且控制台无错误（引擎把一切都吞掉了）。

---

## 二、取证过程与证据（全部可复现）

### 2.1 线上资产与配置核验（移动 UA 抓取）
- `GET /apps/soccer`（iOS Safari UA）→ 308 → `/apps/soccer` 200，响应头**无 COOP/COEP/Cross-Origin-Isolation**，`access-control-allow-origin: *`。疑点 4 与壳页 `ensureCrossOriginIsolationHeaders:false` 一致。
- `GET /apps/soccer/api/public/info` → `{"app":"soccer","engine":"Godot 4.6 (Web, nothreads)","assetStore":true}`。
- 线上 `index.js` 与仓库 `games/soccer/export/web/index.js` **md5 逐字节一致**（`108d217fe8f41cace0f64d1d0ba537e5`）。
- worklet 资产通道响应 `content-type: text/javascript` + CORS `*` → **worklet 本可以走真实同源 URL，不需要 Blob**。
- pck 文件表解析：9 个 `res://assets/audio/*.wav` 全部在包内；源文件核验 `RIFF/fmt /WAVE, PCM 16bit, 22050Hz, mono`。

### 2.2 引擎代码逐行核对（index.js 反混淆 + Godot 4.6 源码）
- `_godot_audio_resume()`：`if (GodotAudio.ctx && GodotAudio.ctx.state !== "running") GodotAudio.ctx.resume()`。
- `AudioDriverWeb::resume()`：仅当 C++ 侧 `state==0(suspended)` 才调上面这个。
- 引擎状态映射（index.js）：`switch(ctx.state){case"suspended":state=0;break;case"running":state=1;break;case"closed":state=2;break;default:}` → **"interrupted" 被丢弃**。
- resume 触发点（display_server_web.cpp，4.6）：keydown、鼠标键、**touchstart/touchend**、IME 四处，注释原文 "Resume audio context after input in case autoplay was denied."——**除此之外全链路无人 resume**。
- Sample 起播门控（index.js，Godot 4.6 新音频层）：
  ```js
  connectPositionWorklet(start){ await GodotAudio.audioPositionWorkletPromise; ...
    this._source.connect(this.getPositionWorklet()); if(start){ this.start() } }
  ```
  `getPositionWorklet()` 内 `new AudioWorkletNode(ctx,"godot-position-reporting-processor")`——**position worklet 模块加载失败 ⇒ 所有 WAV 事件音永不 start**。主 worklet 的 promise 链同样无 `.catch`（失败即无声、无错）。

### 2.3 双引擎实测
- **Chromium（Android UA，真线上页）**：ctx 创建即 `running`（桌面级自动播放宽松）；两个 Blob worklet `addModule` 均 OK；4 个 worklet node、1 次 connect；控制台零错误；`scrollY=0`、无缩放。→ 与「PC 端正常」一致。
- **真 WebKit（本机 Safari 26.3.1，反代线上页 + 注入仪表）**：
  - 独立探针：`addModule(blob:)` **OK**、`addModule(data:)` OK、`addModule(同源URL)` OK、`new AudioWorkletNode` OK → **blob 形态本身不是 modern WebKit 的拦截点**；
  - 但 `new AudioContext()` 创建即 **`suspended`**（自动播放策略生效）；
  - 线上页实测时序：`AudioContext created, state=suspended` → `statechange -> interrupted`（后台/音频会话打断即出现）→ 页面重新置前后退回 `suspended`；**全程 `resume()` 被调用 0 次**（没有任何手势/代码触发）。
- 真机补充检查项（环境性，代码不可修）：iOS 的**静音键**会直接静音 WebAudio；来电/闹钟/其它 app 占用音频会话会产生 interrupted。验收时需先确认静音键状态。

---

## 三、失效链（移动端）

```
iOS/Android WebKit 打开页面
  └─ 引擎 init: new AudioContext({sampleRate})  → suspended（自动播放策略）
       └─ 任何后台化/来电/静音键/锁屏 → statechange: interrupted（引擎不识别，C++ state 卡 0）
用户首次触摸（想解锁）
  ├─ GDScript AudioManager._input: unlocked=true ✓（记账层「已解锁」，UI 显示声音开）
  └─ 引擎 touchstart 回调 → resume_audio() → ctx.resume()
       ├─ 若手势栈有效且无持续打断 → running → 出声（PC Chrome 的行为）
       └─ 若处于 interrupted / 手势资格被 WebKit 拒绝 / 用户中断后无第二次解锁路径
            → 停在 suspended|interrupted → 之后所有 play() 全部静默，无任何报错
```

关键不对称：桌面 Chrome 对「sticky user activation」宽松（探针实测创建即 running），WebKit 严格（必须手势内 resume 且打断后需再次手势）——这就是「PC 正常、移动端无声」且无报错的机制。

---

## 四、修复方案清单（供工坊实现节点执行）

### F1【主修复】壳页手势解锁器 —— `server/src/shell-page.ts`
在 `renderShellPage()` 的 `<script>` 起始处（引擎加载**之前**）加入：
1. **捕获引擎的 AudioContext**：包一层 `window.AudioContext` 构造器，把实例存 `window.__soccerCtx`（引擎用 `new(window.AudioContext||window.webkitAudioContext)(opts)` 创建，补丁透明）。
2. **手势解锁函数** `unlockAudio()`（暴露为 `window.__soccerUnlock`）：
   - `const ctx=window.__soccerCtx; if(ctx && ctx.state!=='running') ctx.resume();`
   - 覆盖 `suspended` 与 **`interrupted`** 两种非 running 态；幂等可重复调用。
3. **监听面**（`capture:true, passive:true`，document 级）：`touchstart / touchend / pointerdown / keydown / click` —— 任一事件里同步调 `unlockAudio()`（必须在手势调用栈内同步执行，WebKit 才认）。
4. **打断恢复提示**：`visibilitychange` 回前台时，若已发生过解锁且 `ctx.state!=='running'`，在 help 条旁显示「点一下恢复声音」提示（新的低成本 DOM 元素，用户下一次点按即被第 3 步手势解锁覆盖）。
5. **可观测性**：`ctx.addEventListener('statechange',…)` 往 `window.__soccerAudioLog` 数组追加 `{t,state}`，并暴露 `window.__soccerAudioDebug()` 返回 `{state, addModules, log}`——真机取证不再两眼一抹黑。

### F2【防御修复】worklet 弃用 Blob URL、补失败重试 —— `server/src/shell-page.ts`
1. `installWorkletPatch()` 改为：`addModule` 命中已知 worklet 名时，**直接传资产通道真实 URL** `ASSET_BASE + name`（实测该通道 `text/javascript + CORS *`，同源直达；Blob URL 在旧 iOS/WebView 上是已知风险形态）。
2. promise 加 `.catch`：失败时**降级用现有 Blob URL 重试一次**，仍失败则 `console.error('[soccer-shell] audio worklet 加载失败', name, e)`——消除「静默死」。
3. `loadEngineScript()` 的引擎 Blob `<script>` 保持不变（实测各引擎 OK）。

### F3【双保险】GDScript 解锁联动 web 层 —— `games/soccer/autoload/audio_manager.gd`
- `unlock_audio()` 末尾追加：
  ```gdscript
  if OS.has_feature("web"):
      JavaScriptBridge.eval("window.__soccerUnlock && window.__soccerUnlock();", true)
  ```
  （`JavaScriptBridge` 仅 web 平台可用，须以 `OS.has_feature("web")` 门控，headless 冒烟零影响。）
- 既有记账/信号/静音逻辑一律不动（门禁断言不回退）。

### F4【体验补齐】解锁提示 —— `games/soccer/scripts/main.gd`（HUD）
- 订阅既有 `AudioManager.unlocked_changed`：解锁前在 HUD 显示「点按任意处开启音效」，解锁后隐藏（桌面同样受益，键盘/鼠标按下即解锁，行为不变）。

### F5【明确不做】
- ❌ 音频转 m4a/AAC：素材已是 PCM WAV，且 Godot Web 不走浏览器 decodeAudioData（疑点 1 证据）；转码只增体积无收益。
- ❌ 切 threads 导出 / 补 COOP+COEP 头：no-threads 不需要 SAB，当前配置正确，动了反而引入 SAB/隔离头新依赖。
- ❌ 触摸操作层重构：TouchControls 的 InputMap 生产者结构与键位契约不动。

### 验证方案（工坊节点执行时照做）
1. 门禁：`verify.sh`（preflight + smoke 240 帧）必须 PASS，含 v2 既有音频/触摸断言。
2. 桌面回归：Chrome/Edge 打开线上页，键盘解锁→各事件音正常（与 v2 一致）。
3. **WebKit 自动化**：Playwright `webkit` 引擎 + iPhone UA + `hasTouch`，断言：首次 `touchscreen.tap` 后 `window.__soccerAudioDebug().state === 'running'`；后台再回前台+再触摸仍 running。（注意：本机 playwright webkit 安装曾网络中断，需在有网环境 `npx playwright install webkit` 重跑。）
4. **真机**（优先）：iOS Safari 与 Android Chrome 各一台——先确认 iOS 静音键**关闭**，再按验收标准 1 逐项复测；用 `window.__soccerAudioDebug()` 输出取证。
5. 产物与部署：重导出 `export/web`（.gitignore 继续放行 `/export/web/`），走 AppHost 链路，liveUrl 复测。

---

## 五、取证命令备忘（复现用）
```bash
# 线上头与资产（移动 UA）
curl -sD - -A "<iOS Safari UA>" https://leomac-studio.tail49399e.ts.net/apps/soccer
curl -s https://leomac-studio.tail49399e.ts.net/apps/soccer/api/public/info
# 线上/仓库 index.js 逐字节一致
md5 -q /tmp/live_index.js games/soccer/export/web/index.js
# pck 音频条目 / WAV 编码 / 引擎状态映射
python3 - （pck 文件表解析，见本文件 2.1）
grep -c decodeAudioData index.js   # 0
grep -o 'case"suspended"[^}]*' index.js
```
