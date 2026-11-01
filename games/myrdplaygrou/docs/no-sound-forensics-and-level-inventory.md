# 无声音根因取证与关卡难度现状盘点

> 目标：对用户反馈缺陷「无音效」（bug `cmvxruft9005om905eo4govlw` 四条之一）做**双端根因取证**，
> 并盘点当前关卡难度现状，供后续工作流与策划案引用。
> 取证对象（部署版）：liveUrl `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/`
> （v10，deploymentId `cmvxwpgej000zm9z6mepcek2n`，gitRef 绑定目标分支）。
> 证据钉 commit：`55898934a25bab1cb649941083e136be01750261`（分支 `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`）。
> 取证时间：2026-11-02 00:48:37 +0800（report.json checkedAt，UTC 时间戳 2026-11-01T16:48:37Z）。

---

## 0. 结论速览（TL;DR）

1. **当前线上 v10 部署版的音频链路「真实出声」**——不是元素存在、不是状态标志，而是 AnalyserNode 逐窗采到的真实振幅能量：9 项机判全 PASS（§2.3）。用户反馈的「无音效」在当前部署版本上已闭环，本报告把「修好了」从状态断言升级为能量级证据。
2. **双端根因清单逐项核销**（§2）：自动播放策略（手势解锁 ✓）、BGM 起播时机（无 autoplay，仅手势路径 ✓）、导出链路（preset 全量 + pck 13 个音频资产 ✓）、总线状态（唯一静音入口=静音按钮，无启动静音 ✓）、部署一致性（线上 pck/js 与本地导出逐字节一致 ✓）。
3. **门禁盲区实锤**：`__audioDebug().bgmPlaying` 在总线静音后仍为 `true`——状态标志不能证明真实出声。mobile-web-smoke 的 `audio-unlock` 项只判「契约函数在位 + 状态标志」，能量取证填补这一盲区（§3）。
4. **关卡难度现状**：3 关，相邻关波数/僵尸总数/均血/均速/出怪节奏全部增幅 ≤30%（最大 +26.7%），机判无断崖（§4）。

---

## 1. 取证方法：真实音频能量机判（AnalyserNode 插桩）

### 1.1 为什么门禁量不出来

既有两层验证都到不了「真的出声了」这一层：

| 层 | 手段 | 能证明 | 不能证明 |
|---|---|---|---|
| godot-smoke | 无头冒烟 `audio-contract` 断言（Audio autoload / `has_bgm` / SFX_BANK 注册 / 静音往返） | 资产在、接线对 | Web 环境下音频上下文是否解锁、输出链是否真实发声 |
| mobile-web-smoke `audio-unlock` | `typeof window.__audioDebug === 'function'` + 解锁后 `unlocked && bgmPlaying` | 壳层契约在位、状态机到位 | 状态标志为 true 时是否真有声（静音总线时 `bgmPlaying` 仍为 true，§3.1 实证） |

### 1.2 取证工具（已归档，可复跑）

`qa/mobile/audio_energy_probe.mjs`（零 npm 依赖，CDP 直驱 headless Chrome）：

1. **文档创建前注入探针**（`Page.addScriptToEvaluateOnNewDocument`，先于壳层与引擎全部脚本）：
   包一层 `AudioContext` 构造器捕获引擎实例 → 拦截 `AudioNode.prototype.connect`，凡引擎节点连向
   `ctx.destination` 一律改道 `analyser → destination`（引擎侧零感知）；
2. **25ms 逐窗采样**：`getFloatTimeDomainData`（1024 样本窗 ≈ 21ms@48kHz，smoothing=0）→ `{t, rms, peak}`；
3. **移动仿真**：390×844 / DPR 3 / iPhone UA / 触摸注入；**严格自动播放策略**
   `--autoplay-policy=document-user-activation-required`（对齐 iOS Safari：AudioContext 创建即 suspended，
   无手势永不恢复）；
4. **按相位驱动真实交互**：触摸选关 → 点草坪布防 → 等首波自然到点 → 点静音/取消静音，逐相位采样；
5. **部署端一致性页面内复算**：资产通道取线上 pck → base64 → gunzip → sha256 + 13 个音频资产字节核对。

机判阈值（附依据）：

| 阈值 | 值 | 依据 |
|---|---|---|
| 静音 `SILENCE_RMS` | 0.0012（≈ -58 dBFS） | 数字静音 = 精确 0，实测本底即 0 |
| 可闻 `AUDIBLE_RMS` | 0.004（≈ -48 dBFS） | BGM 理论输出 RMS ≈ 0.0149（bgm.wav RMS 0.0666 × 播放音量 -13dB），阈值留 ~3.7× 余量 |
| 持续 `SUSTAIN_RATIO` | ≥35% 窗 > 静音线 | 实测 BGM 窗 sustain = 99.5% |
| 音效尖峰 | 峰窗 ≥ 本底 +1.5dB（或 ≥1.4×）且 ≥0.003 | 实测尖峰 +3.3 ~ +14.4dB，余量充足 |

方法健全性先经最小验证（临时脚本，未归档）：headless Chrome 严格策略下 ① ctx 初始 suspended ✓ ② CDP 派发的 keydown 属用户手势、手势内 resume 生效 ✓ ③ AnalyserNode 拿到真实能量（440Hz 正弦 maxRMS 0.71）✓——排除「测了一条静音管线」的假证据风险。

---

## 2. 双端根因取证

### 2.1 部署端（线上产物是不是含音频修复的构建）

| # | 核查项 | 结论 | 证据 |
|---|---|---|---|
| D1 | 线上 pck 是不是这份代码 | **一致** | 资产通道取线上 `index.pck.gz.b64` → b64 → gunzip → 5,576,736 bytes，sha256 `19c6ae6ef9ea2c1425bdfed1c4c8b838e715f26d06bc6f3b0ae47c5684eb1f7c`，与本地 `export/web/index.pck` 及 v10 部署留档**三方一致**（页面内复算 + curl 复核双通道） |
| D2 | 音频资产是否真实在包内 | **13/13 全在** | `assets/sfx/`{bgm, score, confirm, hit, fail, shoot, place, produce, zombie_die, breach, victory, defeat, wave}`.wav` 逐个字节核对，线上 pck 内全部命中 |
| D3 | 引擎引导脚本一致性 | **一致** | 线上 `index.js` sha256 `8b649683883a8be172e229a0479503d50cd5245ebf87aa71fda70bf720824075` == 本地导出 |
| D4 | audio worklet 是否可达（移动端无声的历史根因 F2：worklet 走浏览器内部加载，不经 window.fetch，M1 资产通道覆盖不到） | **已修且在位** | `api/public/assets/index.audio.worklet.js` → 200（7,298 bytes == 本地）；壳页 `AudioWorklet.addModule` 补丁改写到资产端点 + 失败降级原路径重试 + 二次失败置 `worklet-dead` 标记；本次取证 `addModules: 1`（加载成功），全程无 dead 标记 |
| D5 | 壳层音频解锁脚本是否在部署页 | **在** | 部署页含 `unlockAudio`（5 类手势 capture+passive 监听）、`__audioDebug` 取证出口、`visibilitychange` 再解锁；关键标记与仓库 `server/src/game-page.ts` 逐一对应 |

### 2.2 引擎/源码端（Godot 工程链路逐项）

| # | 核查项 | 结论 | 证据（file:line 钉 commit `5589893`） |
|---|---|---|---|
| S1 | AudioContext 是否在用户手势内 resume | **是（双层兜底）** | ①壳层 `export/web-shell.html:140-155` / `server/src/game-page.ts`：`touchstart/touchend/pointerdown/keydown/click` 任一手势内**同步** `ctx.resume()`（仅非 running 时调，覆盖 suspended 与 iOS interrupted）+ `visibilitychange` 回前台再解锁；②游戏侧 `scripts/main.gd:172-176` 首个按下调 `Audio.ensure_playing()`。运行时实证：手势后 0.3s 内 `statechange → running`（`__audioDebug.log`） |
| S2 | BGM 是否 autoplay/启动即播被自动播放策略静音 | **不存在该根因**：BGM 从不 autoplay | `autoload/audio.gd:47-53` `ensure_playing()` 为唯一起播入口，仅 3 个手势路径调用（`main.gd:100` 选关、`main.gd:144` 重开、`main.gd:176` 首输入）；`_ready()`（audio.gd:20-32）只装载流与循环设置，不起播。取证实证：首手势前 136 窗能量**精确为 0** 且 `bgmPlaying=false`——符合 spec `firstInteractionPolicy`（首交互前不发声），故「启动即播被策略拦」在本工程不可能发生；真实风险面是「手势路径断裂 → 永远无声」，已由 S1 五类手势监听兜底 |
| S3 | 导出 preset 与导出 pck 是否真实包含音频资产 | **是** | `export_presets.cfg:9-11` `export_filter="all_resources"`、include/exclude 均空 → 音频资源全量入包；`assets/sfx/*.wav.import` 元数据 13 份齐全（「新增 .wav 必须先二次导入」坑已满足）；本地 pck 13 资产字节核对全在；运行时 `Audio.has_bgm()` 冒烟断言过 |
| S4 | AudioServer 总线是否被静音 | **无启动静音，唯一静音入口=静音按钮** | 全工程 `set_bus_mute` 仅 `autoload/audio.gd:58`（`MuteButton` 触发）；`project.godot` 无 `[audio]` 总线配置（默认 Master 单总线）、无任何启动 mute 路径。取证实证：进关后 `muted=false`、能量持续；点击静音后尾窗能量精确 0（§2.3 第 6 项） |
| S5 | 部署产物是否含音频修复构建 | **是** | D1–D5 全绿；线上即 v10（含 r3 门禁升级 + 音画契约机判化的构建） |

补充：BGM 循环为运行时开启（`audio.gd:26-29` 设 `LOOP_FORWARD`；导入元数据 `edit/loop_mode=0` 按设计不循环），
资产实测 22050Hz / 16-bit / mono / **55.38s** 无缝循环（`tools/gen_bgm.gd`：8 小节曲式 ×3 轮）。
⚠️ 平台知识产物《Godot Web 导出 × 双门禁 × AppHost 部署经验》中「18.5s 相位累加式循环」为旧版口径（工程内
`docs/numeric-and-assets.md:115` 已是 ≈55.4s），建议该知识文档下轮修订时同步。

### 2.3 运行时取证：9 项机判全 PASS

`node qa/mobile/audio_energy_probe.mjs --url <liveUrl> --expect-pck-sha 19c6ae6e… --expect-js-sha 8b649683… --first-wave-delay 15`
→ `AUDIO_PROBE: PASS`（退出码 0；报告 `qa/mobile/audio-energy-v10/report.json` verdict=PASS）

| # | 机判项 | 结果 | 关键实测 |
|---|---|---|---|
| 1 | AnalyserNode 已串入引擎输出链 | PASS | connect 改道 2 次（引擎输出链两段连向 destination）、采样窗 283、采样错误 0 |
| 2 | 首手势前真实静音 | PASS | **5s/136 窗 maxRMS = 0（精确零）**，ctx `suspended`、`bgmPlaying=false` |
| 3 | 首次触摸手势解锁 | PASS | 手势后 `suspended → running`（0.3s），`unlocked=true` |
| 4 | BGM 真实出声 | PASS | 8s 窗（219 窗）mean 0.0208 / max 0.286、**sustain 99.5%**；理论输出 0.0149 定量吻合 |
| 5 | 音效真实出声 | PASS | confirm 自零本底起跳 0.2515、place +3.29dB、wave **+14.41dB**（3 类尖峰全中） |
| 6 | 静音即时归零 | PASS | 点击前本底 0.0416 → 点击后尾窗（+0.8s 起 27 窗）**maxRMS = 0**，`muted=true` |
| 7 | 取消静音恢复 | PASS | 恢复窗 max 0.5009、sustain 95%，`muted=false` |
| 8 | 部署产物含音频构建 | PASS | 线上 pck gunzip 后 sha256 与本地一致 + 13 音频资产在包内（页面内复算） |
| 9 | console 全程零 error | PASS | 零 error、零未捕获异常 |

### 2.4 能量事件全量归因（指纹 × 时序双确认）

终轮取证全程共 5 个能量事件（rms > 0.06 连续段）+ 1 段静音区间，**全部可归因**：

| 时刻（相对首采样窗） | maxRMS / 时长 | 归因 | 依据 |
|---|---|---|---|
| +9.96s | 0.2515 / 0.10s | `confirm`（选关进第 1 关） | 手势标记 +0.23s；confirm.wav 窗指纹 0.374/0.09s |
| +11.76s | 0.3672 / 0.05s | `place`（布防向日葵） | 点按标记 +0.10s；草坪格 (2,2) 点按坐标换算命中 |
| +21.73s | 0.2856 / 0.15s | `produce`（向日葵第 1 拍） | 布防 +10.07s == `sunflower_interval` 10.0s（周期尖峰 +31.9s 同源） |
| +24.91s | 0.2709 / 0.44s | `wave`（首波来袭） | 进关 +15.2s == `first_wave_delay` 15.0s；时长 0.44s ≈ wave.wav（0.50s）；同刻恰为 first_wave_delay 15.0s 到点（victory/defeat 0.53s+ 仅终局触发，可排除） |
| （静音段 +29.6~31.6s） | **精确 0** | 静音生效 | 27 窗全零（+0.8s 起），期间 `bgmPlaying` 仍为 true（§3.1） |
| +31.91s | 0.5009 / 0.06s | `confirm`（取消静音） | unmute 标记 +0.25s |

音效离线指纹（各 wav 按 21.3ms 窗计算窗 max RMS / >0.06 时长，用于归因比对）：
confirm 0.374/0.09s · place 0.285/0.11s · score 0.270/0.17s · wave 0.214/0.38s · fail 0.268/0.30s ·
produce 0.203/0.15s · hit 0.222/0.06s · shoot 0.207/0.06s · zombie_die 0.235/0.26s · breach 0.339/0.21s ·
victory 0.274/0.53s · defeat 0.268/0.53s（bgm 整体 RMS 0.0666/55.38s，播放音量 -13dB）。

> 备注：工具调试期的中间试跑（终轮之前，其 timeseries 已被终轮覆盖）曾实测 `fail` 音效：点按落在网格外
> → `field.try_place` 出界分支播 fail.wav，能量段时长 0.28s 与 fail.wav 指纹（0.30s，全表唯一吻合）一致——
> 连「无效操作音」都真实出声，进一步佐证 SFX 输出链无死角。该试跑同时暴露并修正了工具自身的三处缺陷
> （部署哈希漏 gunzip、静音窗误取 max、按钮聚类阈值），终轮报告已自洽。

---

## 3. 门禁盲区与「状态标志 ≠ 真实出声」

### 3.1 直接实证

静音段快照：`{"state":"running","unlocked":true,"muted":true,"bgmPlaying":true}` —— **同一时刻 AnalyserNode
采到的能量精确为 0**。即：`bgmPlaying` 报告的是引擎 AudioStreamPlayer 的播放状态，不是耳朵听到的内容；
总线静音时状态全绿而物理无声。这正是「门禁全绿 ≠ 线上没问题」在音频维度的具体形态，
也是用户反馈「无音效」这类缺陷能从状态断言层漏走的机理。

### 3.2 盲区根因链（历史 → 现状）

| 历史根因（v5 前线） | 修复 | 本次复核 |
|---|---|---|
| audio worklet 走浏览器内部加载，M1 网关资产通道覆盖不到 → 移动端全部音效静默且控制台零报错（最难排查的一类，F2） | 壳页补丁 `AudioWorklet.addModule` → 资产端点；失败降级原路径重试；二次失败置 `worklet-dead` 并显式 console.error | `addModules=1`，无 fallback/dead 标记 ✓ |
| iOS AudioContext 创建即 suspended / 打断后 interrupted，引擎状态机不识别 | 壳层手势内同步 resume（覆盖非 running 全态）+ visibilitychange 再解锁 | suspended→running 0.3s ✓ |
| 引擎只在自己输入回调里 resume，自定义壳页缺兜底 = 移动端无声桌面正常 | 静态导出壳（web-shell.html）与 AppHost 壳（game-page.ts）同源同语义双份在位 | 两份壳页标记逐一对应 ✓ |
| 「有类无实例」/ eval 返回形态陷阱（同族缺陷曾两度中招） | 按形态归一 + 装配根挂载 | 本次 `_publish_state` 回传链路实测有效（__audioDebug.muted/bgmPlaying 全程正确）✓ |

### 3.3 建议（不属本任务实施面）

- 可把「能量探针」做成 mobile-web-smoke 的第 12 项判定（`audio-energy`：手势后 5s 窗 maxRMS ≥ -48dBFS）。
  依「判定脚本只来自仓库、不自写不改写」纪律，属门禁增强提案，须走技能包脚本修订流程，本任务只交付
  取证工具与证据，不动门禁脚本。
- 平台知识产物的「18.5s」BGM 口径漂移（实际 55.4s），建议下轮 write_knowledge 修订。

---

## 4. 关卡难度现状盘点

数据源：`autoload/game_state.gd`（机器解析，脚本 `qa/mobile/levels_inventory.py` → `qa/mobile/levels-difficulty.json`，
禁止手抄）。推导口径 = spec.numeric.difficulty：均血/均速按波次编制加权，禁止另行缩放。

### 4.1 当前关卡数：3（满足「至少 3 关 + 选关入口」）

| 关 | 名称 | 章节 | 起始阳光 | 波数 | 僵尸总数 | 种类构成 | 均血 | 均速 | 出怪间隔 | 波间隔 | 首波延迟 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 第 1 关 · 前院晨光 | 晨绿 `d5f0dd` | 100 | 4 | 12 | walker×12 | 100.0 | 18.0 | 6.0s | 20.0s | 15.0s |
| 2 | 第 2 关 · 后院黄昏 | 暮橙 `f7e3c8` | 150 | 5 | 15 | walker×10 + runner×2 + conehead×3 | 120.0 | 20.4 | 5.5s | 18.0s | 12.0s |
| 3 | 第 3 关 · 屋顶夜袭 | 夜蓝 `cfdff2` | 200 | 6 | 19 | walker×9 + runner×4 + conehead×4 + buckethead×2 | 150.5 | 21.4 | 5.0s | 16.0s | 10.0s |

僵尸绝对基准（`ZOMBIE_KINDS`，难度靠编制加重、不乘关卡倍率）：
walker hp100/速18/掉15 · runner hp70/速36/掉20 · conehead hp220/速18/掉25 · buckethead hp400/速14/掉35。

### 4.2 相邻关增幅（验收 acc-difficulty-curve：≤30% 无断崖）

| 维度 | 第1关 → 第2关 | 第2关 → 第3关 | 判定 |
|---|---|---|---|
| 波数 | +25.0% | +20.0% | ✓ |
| 僵尸总数 | +25.0% | +26.7% | ✓ |
| 均血 | +20.0% | +25.4% | ✓ |
| 均速 | +13.3% | +4.8% | ✓ |
| 出怪间隔（负=更密） | -8.3% | -9.1% | ✓ |
| 波间隔（负=更紧） | -10.0% | -11.1% | ✓ |
| 首波延迟（负=更急） | -20.0% | -16.7% | ✓ |

**机判结论：`difficulty_curve_within_30pct = true`（7 维度 × 2 相邻对全部 ≤30%，无断崖）**；逐关起始阳光
100→150→200 递增（对玩家利好方向，不构成难度陡增）；种类 1→3→4 逐关解锁（runner→conehead→buckethead）。
与冒烟门禁 `_check_level_table` 逐项机判、三关逐关通关扫描（GODOT_SMOKE PASS，v10 部署留档）互为印证。

### 4.3 全部波次编制明细（levels[].waves[].groups，策划案引用口径）

- **第 1 关**（4 波，全 walker）：①walker×2 ②walker×3 ③walker×3 ④walker×4
- **第 2 关**（5 波）：①walker×3 ②walker×2+runner×1 ③walker×3+conehead×1 ④walker×1+runner×1 ⑤conehead×2+walker×1
- **第 3 关**（6 波）：①walker×3 ②walker×2+runner×1 ③walker×2+conehead×1 ④walker×1+runner×2 ⑤conehead×2+buckethead×1 ⑥walker×1+runner×1+conehead×1+buckethead×1

---

## 5. 证据索引（`games/myrdplaygrou/qa/mobile/`，.gdignore 区不入包）

| 文件 | 内容 |
|---|---|
| `audio_energy_probe.mjs` | 取证工具（AnalyserNode 插桩 + 9 项机判，可复跑，用法见文件头） |
| `audio-energy-v10/report.json` | 本轮机判报告（verdict=PASS，含相位快照/阈值/部署哈希/checks 全文） |
| `audio-energy-v10/audio-energy-timeseries.json` | 25ms 逐窗能量时序（283+ 窗）+ 全部相位标记 |
| `audio-energy-v10/phase-a-pre-gesture.png` | 首手势前（选关页，静音态）截图 |
| `audio-energy-v10/phase-b-in-game.png` | 手势进关后（对局页）截图 |
| `audio-energy-v10/phase-f-muted.png` | 静音生效态截图（按钮文案「音效 关」） |
| `audio-energy-v10/phase-g-final.png` | 取消静音恢复后截图 |
| `levels_inventory.py` | 关卡难度盘点工具（机器解析 game_state.gd） |
| `levels-difficulty.json` | 盘点产物（3 关数值 + 相邻增幅 + 机判布尔） |
| `audio-contract.json` | （v10 既有）壳层状态机取证：tap 前 suspended → tap 后 running/bgmPlaying |

复跑命令：

```bash
node games/myrdplaygrou/qa/mobile/audio_energy_probe.mjs \
  --url "https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/" \
  --out games/myrdplaygrou/qa/mobile/audio-energy-v10 \
  --expect-pck-sha $(sha256sum games/myrdplaygrou/export/web/index.pck | cut -d' ' -f1) \
  --expect-js-sha  $(sha256sum games/myrdplaygrou/export/web/index.js  | cut -d' ' -f1) \
  --first-wave-delay 15
python3 games/myrdplaygrou/qa/mobile/levels_inventory.py
```
