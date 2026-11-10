# 《实况足球》线上终审报告：liveUrl 公网可玩 + 触屏音频取证 + 三项回写核验

- 终审时点：2026-11-11（本机时区），节点=试玩验收（assign_agent 指派）
- 审计对象：liveUrl `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-3/`
- 工作区分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h` @ 2fefd03（终审基线）
- 线上部署：gitRef `myrd/game-3-goal-cmwaqvrng002lm9m2nftdd20h` @ **88b7469**（打磨四轮之前基点）
- 纪律：本报告**只记录不判定**——「好不好玩/音频好不好听」的结论只能来自用户试玩回填

## ① 公网可玩性（终审探活 + fresh 证据包）

| 探活项 | 读数 |
|---|---|
| `GET /` | **HTTP 200**，585,156 字节，单文件游戏本体（`<title>实况足球 · GOAL RUSH</title>`，canvas×1） |
| `GET /health` | **HTTP 200** `{"ok":true,"app":"myrdplaygrou-3","title":"实况足球-GOAL-RUSH"}` |
| `GET /gw` | **HTTP 200**（585,156 字节，与 `/` 同体） |
| 线上页 sha256 | `b04c437895013a36e96fb753f59c67b77ce517f4653226c00cb353ed7e48ce6d` = **部署时锚定值逐字节一致**（SRC_SHA=e3df74b489a5f153） |

fresh 取证包（experience-harness pack，mobile 视口 390×844，场景 `scenario-touch-audio.json`）：
`2026-11-10T18-03-14-final-review-live/`（packBytes=7,215,080）

| 观测 | 读数 |
|---|---|
| canvasPresent / firstColorCount | true / **24**（非纯色，3D 场景已渲染） |
| 输入 6 步（开球/摇杆×2/射门/暂停/恢复） | **全部 inputArrived=true 且 responded=true**（开球与暂停/恢复 frameDiff=400，摇杆 318/305） |
| 玩法循环真实发生 | 金币 ×0→**×2**、得分 0→**10**、时钟 90s→88s→79s→77s 递减；暂停浮层「已暂停/继续」出现后恢复 |
| console | **errors=0**；network 3 项全 200、零失败（单文件产物） |
| FPS（headless mobile） | 25 采样，min 8 / max 14 / **mean 11.3**（无头渲染读数，供对照非判定） |

## ② 触屏音频表现（取证）

**代码契约（线上 commit 88b7469 实读，`src/render/audio.js` + `src/main.js`）**：
- `unlockAudio()` 首次用户手势创建 AudioContext（`window.AudioContext||webkitAudioContext`），suspended 即 `resume()`；总线 gain 0.5 + DynamicsCompressor；
- `main.js` 六处手势入口（键盘/触屏/按钮）均先调 `unlockAudio()`；
- 零音频文件（oscillator+gain 包络程序化合成，BGM 132 BPM）；音频失败不致命（catch 置 null 空转）。

**线上行为取证**：
- 6 次触屏输入全部到达且全部有画面响应 → 触摸→手势→解锁调用链路通；
- console errors=0（无 AudioContext 相关报错）；
- **版本事实**：线上探针 `typeof window.__audioDebug === "undefined"`、`typeof window.__footballProbe === "undefined"` —— IP7 音频诊断契约与 IP8 内核探针属打磨轮产物，**线上 88b7469 无此钩子**（AudioContext 状态模块内私有，线上版无法远程直读音频引擎态）；
- mobile-web-smoke 的 audio-unlock 硬检查（锚 `__audioDebug`）PASS 记录出自打磨版本地构建（games/myrdplaygrou-3/qa/mobile/report.json @ef9654f，checkedAt 2026-11-10T17:47Z，verdict PASS、consoleErrors=[]）；
- **音质/音量/是否好听**：无法也不应由本节点判定 —— 留给用户试玩（打分卡 Q3「BGM/音效是否齐备且不吵」）。

## ③ 三项回写核验（goal artifacts 现状）

| 项 | 值 | 现状 |
|---|---|---|
| HostedApp id | `cmwaqvrnc002jm9m2nqwfsoie` | ⚠️ 仅出现在 requirement[0] 的验收标准引文（部署端点路径）里，**hosted_app 部署记录本体缺失** |
| deployment id | `cmwax345r002km97avs9jgvxa` | ✓ hosted_app[4] + playtest_summary[6]（status=running，mode=bundle，deployedBy=human，createdAt 2026-11-10T16:41Z） |
| liveUrl | `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-3/` | ✓ hosted_app[4] + playtest_kit[5] |

处置：本节点经 `PATCH /api/v1/goals/:id`（goals.ts:749 artifacts 白名单字段）**追加终审产物一条**（读-改-写，原 10 条原样保留），将三项 ID 在单一产物内显式齐备，回写后重读核验 11 条。

## ④ 版本差异警示（试玩交接必读）

1. **线上 = 打磨前基点 88b7469**；打磨四轮成果（方向倒置修复、相机重取景 CAM_AHEAD 2.7→8、金币立体化、粒子爆点、IP7/IP8 诊断钩子）**未部署**，polish_record 已如实披露「新版部署归宿主 deploy_playable」。
2. 代码级实证的线上已知问题：`touch.js:15 intent.moveZ = (dy*k)/MAX_RADIUS`（无取反）——上推摇杆球员倒退；打磨后已改为 `-(dy*k)`。**用户在现线上版试玩时手感方向是反的，属已知已修未部署项，请勿据现线上版对方向手感打最终分**。
3. 试玩打分卡（template=mini_game_playtest，requestKey=playtest_cmwaqvrng002lm9m2nftdd20h）已随试玩验收包发出，四问结论待用户回填；未回填前 ac-human-playtest 记「待回填」。

## ⑤ 终审结论（自动化口径）

- liveUrl 公网可玩：**达成**（探活三路 200 + 页面与部署锚定逐字节一致 + fresh 证据包输入全响应/零 console 错误）；
- 触屏音频：解锁链路代码契约与行为链路**证据齐备**；听感判定移交用户；
- 三项回写：核验发现 HostedApp id 缺失于部署记录 → 本节点回写补齐（见 ③）；
- 试玩打分：**待用户**。

## 产物清单（落盘回读）

| 文件 | 字节 | 说明 |
|---|---|---|
| `scenario-touch-audio.json` | （见 git） | 终审触屏场景（15 步） |
| `2026-11-10T18-03-14-final-review-live/pack.json` | 见目录 | 证据包 manifest（evidenceOnly=true，无判定字段） |
| `…/steps/*.png` | 15 张 | 逐步截图（开球/带球/射门/暂停/恢复） |
| `…/video/frames/` | 250 帧 | 录屏契约形态帧序列 |
| `…/console/errors.json` | errors=[] | console 零错误 |
| `…/perf/fps-series.json` | 25 采样 | FPS 时间序列 |
| `…/network/waterfall.json` | 3 项全 200 | 网络瀑布 |
| `final-review-20261111.md` | 本文件 | 终审报告 |
