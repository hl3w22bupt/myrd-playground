# 《Soccer》移动端 Web 无声 · 修复记录（v2.1）

> 需求：修复《Soccer》移动端 Web 无声（音效开启仍无声音，PC 端正常）`cmty5jely000cm9cyvtcd86jq`
> 依据：取证报告 `qa/MOBILE_AUDIO_ROOT_CAUSE.md`（分支 `myrd/goal-cmtx73f9v0005m9zbikqyadww-mobile-audio-forensics`）
> 实现分支：`myrd/games-goal-cmtx73f9v0005m9zbikqyadww`（部署 gitRef，绝不用 main）

## 一、五疑点结论 → 修复映射

| 疑点 | 取证结论 | 本次处置 |
|---|---|---|
| 1. Ogg/decodeAudioData 解码失败 | 不成立（全 PCM WAV；引擎 0 处 decodeAudioData） | **不转码**（F5）：转码只增体积无收益 |
| 2. AudioContext suspended 未在手势内 resume | **部分成立（主根因链）**：ctx 创建即 suspended，全链路仅引擎输入回调 resume，壳页 0 行解锁代码 | **F1 壳页手势解锁器**（document 级手势同步 `resume()`）+ **F3 GDScript 解锁联动** |
| 3. 解锁事件覆盖不全（缺 touchstart） | GDScript 层不成立（已监听 InputEventScreenTouch）/ 壳页层成立 | F1 监听面覆盖 touchstart/touchend/pointerdown/keydown/click，capture+passive 只解锁不消费 |
| 4. threads 导出 / COOP+COEP | 不成立（nothreads + `ensureCrossOriginIsolationHeaders:false`） | **不动**（F5）：no-threads 不需要 SAB，动了反而引入隔离头依赖 |
| 5. Master 总线被静音 | 不成立（无持久化、同源驱动） | 无需处置 |
| 6.【新发现】WebKit interrupted 态被引擎丢弃 | 成立（移动端特有：锁屏/来电/切后台即 interrupted，之后无人再解锁） | F1 手势解锁幂等、`state!=='running'` 一律 resume（suspended 与 interrupted 都覆盖）；回前台仍非 running 时挂「点一下屏幕恢复声音」DOM 提示 |
| 7.【新发现】worklet Blob URL 无 catch 且门控 WAV 起播 | 成立（单一故障点：worklet 链一断全部事件音静默且无报错） | **F2**：addModule 改走资产通道真实 URL（同源 + CORS `*` 实测可达），失败降级 Blob 重试一次，仍失败显式 `console.error` + `__soccerAudioDebug` 留痕 |

## 二、修复清单落点（F1–F5）

| 项 | 文件 | 内容 |
|---|---|---|
| F1 主修复 | `server/src/shell-page.ts` | AudioContext 构造器包装捕获实例；`window.__soccerUnlock` 幂等解锁；5 类手势监听（capture+passive）；visibilitychange 回前台非 running 挂恢复提示；`window.__soccerAudioLog` / `window.__soccerAudioDebug()` 取证出口 |
| F2 防御修复 | `server/src/shell-page.ts` | `installWorkletPatch()` 真实 URL 优先 + Blob 降级重试 + 失败显式报错（Godot 对该 promise 无 catch） |
| F3 双保险 | `games/soccer/autoload/audio_manager.gd` | `unlock_audio()` 末尾 `OS.has_feature("web")` 门控 `JavaScriptBridge.eval("window.__soccerUnlock && …")`；既有记账/信号/静音逻辑零改动（门禁断言不回退） |
| F4 体验补齐 | `games/soccer/scenes/main.tscn` + `scripts/main.gd` | HUD `UnlockHint`（「点按任意处 / 按任意键 开启音效」）随 `AudioManager.unlocked_changed` 显隐；桌面键盘/鼠标按下即解锁，行为不变 |
| F5 不做项 | — | 不转 m4a/AAC、不动导出预设与 COOP/COEP、不动 TouchControls 结构与键位契约 |

## 三、门禁证据（本地实测，2026-09-12）

```text
$ bash std-skills/godot-game-dev/scripts/resolve-godot.sh   → exit 0（godot 在 PATH）
$ python3 std-skills/godot-game-dev/scripts/preflight.py games/soccer
  PREFLIGHT: PASS 13 类前置一致性检查全部通过（87 个工程文件，不含 .godot/ 导入缓存）
$ GODOT_SMOKE_FRAMES=240 GODOT_BIN=$(resolve-godot.sh) bash …/smoke.sh games/soccer
  godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）
  引擎日志：GODOT_SMOKE: PASS …/音效门控与事件音/解锁提示指引/触摸摇杆与按钮与多点触控/ 全部通过
  GODOT_SMOKE: 帧消耗 185（预算 240）；SCRIPT ERROR 计数 0
$ cd server && npx tsc --noEmit                            → exit 0（F1/F2 壳页 TS）
```

新增冒烟断言（零额外帧，寄生既有窗口）：
- 静态：`UnlockHint` 接线存在且 `unlocked=false` 时可见（缺失/不可见即 FAIL）。
- 行为：OOB 冻结窗注入 M 键解锁后提示必须隐藏（`unlocked_changed` 订阅断裂即 FAIL）。
- 既有 v1/v2 断言（角球/球门球/界外球、键位契约、音频记账 B1-B7、触摸 B4-B7）全部保留，无放松。

## 四、部署侧验证清单（deploy/验收节点执行）

1. 重导出：`mkdir -p games/soccer/export/web` 后 Godot Web 导出（`web_nothreads` 模板、
   `variant/thread_support=false`、`gl_compatibility`），产物入库（`.gitignore` 放行 `/export/web/`）。
2. AppHost 部署（app id `cmtx73f9o0003m9zbsyz01ybu`，gitRef = 本分支），liveUrl 复测。
3. **WebKit 自动化**（取证报告 §四.3）：Playwright `webkit` + iPhone UA + `hasTouch`，
   断言首次 `touchscreen.tap` 后 `window.__soccerAudioDebug().state === 'running'`；
   后台↔前台往返 + 再触摸仍 running；`addModules[].mode` 应为 `url`（或 `blob-fallback` 且 `ok:true`）。
4. **真机**（优先）：iOS Safari（先确认静音键关闭）与 Android Chrome —— 首触解锁后
   踢球/传球/抢断/哨声/进球/环境声逐项可闻；切后台回来被 interrupted 时页面出现
   「点一下屏幕恢复声音」，点按后恢复出声。
5. **PC 回归**：桌面 Chrome/Edge 键盘解锁 → 各事件音正常、静音开关立即生效（与 v2 一致）。

> 验证方式备注：本次实现节点完成于 macOS 沙箱（无真机），无头门禁 + tsc 为机判证据；
> WebKit/真机项属 AudioContext 挂起类，headless 无法模拟，按上述清单由部署与验收节点闭环。

## 五、重导出记录（2026-09-12，本节点顺手完成，AppHost 部署由 deploy 节点执行）

`godot --headless --path games/soccer --export-release "Web" export/web/index.html`（exit 0，
web_nothreads 模板 4.6.1.stable）：9 个产物文件齐全，`index.wasm` 37,685,705B 与 v2 逐字节同量级
（引擎层零变化），`index.pck` 2,848,420B → 3,032,296B（**+184KB**）——构成：v2 验收节点补入
仓库的 6 张证据截图被 all_resources 导出打包（v1 的 8 张在 v2 包内本就存在，属遗留现象）+
本次 GDScript/场景变更。远在素材预算内；若日后想省这 ~700KB 包体，可给
export_presets.cfg 加 `exclude_filter="qa/*"`（属导出预设调整，按 F5 本次不做）。

## 六、部署记录（2026-09-12）

- 部署 API：`POST /api/v1/apphost/apps/cmtx73f9o0003m9zbsyz01ybu/deployments`
  body `{"mode":"bundle","gitRef":"myrd/games-goal-cmtx73f9v0005m9zbikqyadww","deployedBy":"workflow"}`
- deploymentId：**`cmty81mdm000em9j2k26jvg8w`**，status=running（健康态），构建日志 `[done]`
- 构建要点：clone 即本分支；route analysis `GET /health|/|/api/public/info|/api/public/assets/:name` 全过；
  资产上传 9 个（原始 39.2MB → gzip 存储 12.2MB，index.pck gzip 2923.8KB）；实例就绪
- liveUrl：`https://leomac-studio.tail49399e.ts.net/apps/soccer/`

线上自测（curl 实测）：

| 检查项 | 结果 |
|---|---|
| 壳页 HTML（iOS UA，200） | 含 `window.__soccerUnlock` / `__soccerAudioDebug` / `audio-hint`（「点一下屏幕恢复声音」）—— F1 已上线 |
| `/api/public/info` | `{"app":"soccer","engine":"Godot 4.6 (Web, nothreads)","assetStore":true}` |
| `/api/public/assets/index.pck` | 200，b64→gunzip 3,032,296B，**md5 `6c2eafe3…` 与本地新 pck 逐字节一致** |
| `/api/public/assets/index.audio.worklet.js` | 200，`text/javascript`，7,298B 与本地一致 —— F2 真实 URL 加载路径线上可达 |

遗留（deploy/验收侧后续）：WebSocket/浏览器内 AudioContext 状态验证需真机或 Playwright webkit
（`window.__soccerAudioDebug()` 取证），见 §四 清单。

## 七、断言负例探针实测（2026-09-12，实现节点复核）

按工坊纪律「断言能拦住各自声称要拦的缺陷、正例不误报」，对 §三 新增的 v2.1 解锁提示断言做双向验证
（与 v2 的 98a5696 同一方法）：临时注入缺陷 → 冒烟必须以明确签名 FAIL（exit 1）→ 还原 → 复绿 PASS。

| 探针 | 注入缺陷（scripts/main.gd 临时改动，已还原） | 冒烟结果（实测日志签名） |
|---|---|---|
| A：订阅断裂 | `_on_audio_unlocked` 置 `pass`（信号连着但处理体不隐藏提示） | `GODOT_SMOKE: FAIL M 键解锁后 HUD 解锁提示未隐藏（unlocked_changed 订阅断裂）`，exit 1 |
| B：初始不可见 | `_sync_unlock_hint` 无条件 `visible = false`（解锁前无指引） | `GODOT_SMOKE: FAIL AudioManager.unlocked=false 时解锁提示应可见（指引未随门控初始化）`，exit 1 |
| 还原复绿 | 两处缺陷全部还原（`git diff` 为空） | `godot-smoke: PASS …（退出码 0，断言标记齐全，日志无脚本错误）`，exit 0 |

同日线上复验（curl 实测，iOS Safari UA）：壳页 200 且含 `__soccerUnlock` / `__soccerAudioDebug` /
`audio-hint`（F1 上线在服）；`/api/public/info` 返回 nothreads 引擎信息；worklet 资产通道 200 +
`text/javascript`（F2 真实 URL 路径可达）。部署 gitRef 始终为本分支（绝不用 main）。

> 结论：v2.1 修复（F1–F4）在仓、在服，门禁三连绿（preflight 13/13 · smoke 240 帧预算 exit 0 ·
> 零 SCRIPT ERROR · server tsc exit 0），新断言「拦得住、不误报」两端实测闭环。
> 剩余项仅为 §四 清单中的真机/WebKit 人工体验确认（AudioContext 挂起类无法在 headless 模拟）。

## 八、deploy 节点重部署记录（2026-09-12，mob-audio-req 工作流 deploy 节点）

- 前置四查全过：分支 `myrd/games-goal-cmtx73f9v0005m9zbikqyadww` ✓ / remote 同步（HEAD==FETCH_HEAD `1970f69d`）✓ /
  仓库内门禁三件套在位 ✓ / Godot 4.6.1.stable ✓
- 门禁三连（与门禁同源）：preflight **PASS**（13/13，97 文件）；smoke **PASS**（exit 0，
  SCRIPT ERROR 计数 0，`godot-smoke: PASS` 标记齐全）
- 重导出验证：`godot --headless --path games/soccer --export-release "Web" export/web/index.html` exit 0，
  产物与已提交版本**逐字节一致**（pck 3,032,296B / wasm 37,685,705B，git status 为空）—— 导出可复现，无需刷新提交
- 部署 API：`POST /api/v1/apphost/apps/cmtx73f9o0003m9zbsyz01ybu/deployments`，
  body `{"mode":"bundle","deployedBy":"workflow","triggeredById":"cmtx73f9v0005m9zbikqyadww",
  "gitRef":"myrd/games-goal-cmtx73f9v0005m9zbikqyadww"}`
- deploymentId：**`cmty8q31s000mm9j2byfnvv32`**，status=running（健康态，前代 cmty81mdm… 已 superseded）
- liveUrl：`https://leomac-studio.tail49399e.ts.net/apps/soccer/`

线上自测（curl 实测，iOS Safari UA）：

| 检查项 | 结果 |
|---|---|
| `/health` | **200** |
| `/`（-L 跟随 308 规范化） | **200**，壳页含 `__soccerUnlock` / `__soccerAudioDebug` / `audio-hint`（「点一下屏幕恢复声音」）—— F1 在服 |
| `/api/public/info` | `{"app":"soccer","engine":"Godot 4.6 (Web, nothreads)","assetStore":true}` |
| `/api/public/assets/index.audio.worklet.js` | 200 `text/javascript` 7,298B，md5 与本地一致 —— F2 真实 URL 路径在服 |
| `/api/public/assets/index.pck` | 200，b64→gunzip 3,032,296B，md5 `6c2eafe3…` 与本地逐字节一致 —— 修复随包上线 |
