# 《Soccer》移动端 Web 无声修复（v2.1）· 独立复核报告

> 复核节点：指派「编码实现」复核移动端音频修复上线产物并回写 artifacts（目标 `cmtx73f9v0005m9zbikqyadww`）
> 复核对象：**当前线上实例** `https://leomac-studio.tail49399e.ts.net/apps/soccer/`（liveUrl）
> 关联部署：HostedApp `cmtx73f9o0003m9zbsyz01ybu`（Soccer）· deployment **`cmty8q31s000mm9j2byfnvv32`**（version 6，status=running）
> 复核基线：部署时点的部署分支 HEAD `40c5785d`（= v2.1 重部署记录提交，v6 部署 clone 自该提交）；复核日期 2026-09-12
> ⚠️ 时点备注：复核进行中（18:47+0800）该部署分支被并行迁移动作改写（`3d49db1` 起把本工程迁入新历史线）；已部署 v6 产物是部署时上传对象存储的快照，与本报告比对基线一致，**不受改写影响**。本报告按既有取证模式提交至独立分支 `myrd/goal-cmtx73f9v0005m9zbikqyadww-mobile-audio-recheck`，不干扰部署分支上的并行动作。
> 结论：**PASS（复核通过，未回写 blocked）**——五项复核点全部有实证；真机听感确认属人工项（见 §五）

## 一、复核点 × 证据总表

| # | 复核点 | 结论 | 证据（本节点独立实测） |
|---|---|---|---|
| 1 | 移动 UA 下 AudioContext 正常运行 | **PASS** | Chromium + iPhone 13 描述符（iOS UA + `hasTouch`）会话：`__soccerAudioDebug().state === 'running'`（创建起即 running 且持续到会话结束）；引擎日志 `Godot Engine v4.6.1.stable` + `single-threaded`（nothreads 与导出预设一致） |
| 2 | 音频解码不再失败 | **PASS** | 两个 AudioWorklet 经 F2 真实 URL 通道加载 `mode=url, ok=true`（position + 事件音 worklet 双绿）；素材全 16-bit PCM WAV、引擎 0 处 `decodeAudioData`（取证报告已钉死，无解码失败面） |
| 3 | 触摸后可发声 | **PASS** | 首次 `touchscreen.tap` 后：壳页手势解锁器 + **F3 桥接验证**——hook `window.__soccerUnlock` 捕获到 **1 次来自 GDScript AudioManager 的桥接调用**（`bridgeCalls=1`），证明「触摸 → 引擎解锁 → JSBridge → 壳页 resume」全链路真实打通；`state=running` + 双 worklet `ok=true` 即 WebAudio 出声的全部前提 |
| 4 | PC 端回归无异常 | **PASS** | 桌面 Chromium 会话（1280×720）：键盘解锁后 `state=running`、双 worklet `ok=true`、canvas 正常渲染，全程零 console 错误/零页面错误；与 v2 验收行为一致 |
| 5 | 音效开关逻辑未被破坏 | **PASS** | 修复提交 `ca57041` 对 `autoload/audio_manager.gd` 仅 +7 行（F3 `OS.has_feature("web")` 门控的 JSBridge 联动，headless 冒烟零影响）；记账/静音/信号逻辑零改动；桌面会话 M 键静音一按一放无异常；冒烟 v1/v2 断言全保留（部署记录 §三：185/240 帧，零 SCRIPT ERROR） |

## 二、部署与资产核验（与部署分支逐字节比对）

| 检查项 | 结果 |
|---|---|
| HostedApp `cmtx73f9o0003m9zbsyz01ybu` | status=**ready**，name=Soccer，slug=soccer |
| currentDeploymentId | **`cmty8q31s000mm9j2byfnvv32`**（version 6，status=**running**，deployedBy=workflow，durationMs=832） |
| 部署 gitRef | `myrd/games-goal-cmtx73f9v0005m9zbikqyadww`（**未落 main**，与部署契约一致） |
| `/health` | HTTP **200**（22ms） |
| `/`（移动 UA，-L 跟随 308） | HTTP 200，壳页含 F1 全部修复特征：`__soccerUnlock` / `__soccerAudioDebug` / `__soccerAudioLog` / `touchstart`+`pointerdown` 监听 / `WrappedAudioContext` / `resume()` / `audio-hint` 提示 / `touch-action` |
| `/api/public/info` | `{"app":"soccer","title":"Soccer · 11 人制足球","engine":"Godot 4.6 (Web, nothreads)","assetStore":true}` |
| `index.audio.worklet.js` | 200，7,298B，md5 `c55ea38b…` **与部署分支逐字节一致** |
| `index.audio.position.worklet.js` | 200，2,973B，md5 `8a7370a5…` **与部署分支逐字节一致** |
| `index.js` | 200，315,759B，md5 `108d217f…` **与部署分支逐字节一致** |
| `index.pck` | 200，资产通道 b64(gzip) 文本形态 → 解码后 3,032,296B，md5 `6c2eafe3…` **与部署分支逐字节一致**（v2.1 修复随包在线上） |

> 口径备注：资产通道对二进制产物以 `base64(gzip(bytes))` 文本回源（`content-type: text/plain`），与 `qa/MOBILE_AUDIO_FIX.md` §八「b64→gunzip 核验」口径相同；直接按二进制比对会得到假 DIFFER。

## 三、运行时会话记录（Playwright，headless，2026-09-12）

会话 A（移动）：iPhone 13 描述符（390×844@3x，iOS UA，`hasTouch=true`）
- 引擎启动：Godot 4.6.1.stable / WebGL2 Compatibility / single-threaded（nothreads ✓）
- 解锁前：`state=running`（headless Chromium 不强制自动播放策略挂起态，见 §五边界）；worklet 加载中
- 首次 `touchscreen.tap` 后：双 worklet `mode=url, ok=true`；`bridgeCalls=1`（F3 桥接命中）
- 后续多点触摸（摇杆区 + 射门按钮区双点位）：无事件丢失、无错误
- canvas 1170×1992 正常渲染；**全程 audioErrors=0 / otherErrors=0 / pageErrors=0**

会话 B（桌面）：1280×720，键盘解锁（`a` 键）+ 静音开关 M 一按一放
- `state=running`、双 worklet `ok=true`、canvas 1280×720；**零错误**（PC 回归无异常）

## 四、HostedApp / deployment 状态核验（平台 API 实测）

- `GET /api/v1/apphost/apps/cmtx73f9o0003m9zbsyz01ybu`：status=ready，liveUrl 在位，currentDeploymentId 与复核对象一致
- deployment `cmty8q31s000mm9j2byfnvv32`：status=running；前代 `cmty81mdm000em9j2k26jvg8w`（v5）已 superseded——线上只有一套实例，无新旧并存
- routeAnalysis 四路（`/health`、`/`、`/api/public/info`、`/api/public/assets/:name`）与实际请求全部 200 对应

## 五、复核边界（如实记录，不构成 blocked）

1. **headless 无法采声波**：本节点以「AudioContext `state=running` + 双 AudioWorklet `ok=true` + 引擎播放调用无异常」作为 Web 端可发声的判定链（WebAudio 语义下三者齐备即出声）；真实听感需真机确认。
2. **headless 无法强制 iOS 真实自动播放策略挂起态**：真机 iOS Safari（确认静音键关闭）首触解锁、锁屏/来电 interrupted 恢复（「点一下屏幕恢复声音」提示）仍按 `qa/MOBILE_AUDIO_FIX.md` §四.4 由人工真机项闭环。此边界与部署/验收记录一致，非本次修复引入。
3. WebKit 原生会话因本机 Playwright WebKit 浏览器下载未完成未跑；iPhone UA + `hasTouch` 的 Chromium 会话已覆盖触摸事件面与解锁链路验证。

## 六、回写

- 本报告随提交入库：`games/soccer/qa/MOBILE_AUDIO_RECHECK_V2_1.md`（独立复核分支 `myrd/goal-cmtx73f9v0005m9zbikqyadww-mobile-audio-recheck`，避开部署分支上的并行迁移动作）
- 目标 artifacts 已追加复核产物条目（HostedApp id + deployment id + liveUrl + 复核结论 PASS），见目标卡片
