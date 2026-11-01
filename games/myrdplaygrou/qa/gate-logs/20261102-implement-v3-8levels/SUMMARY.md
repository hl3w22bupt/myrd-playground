# implement 节点门禁证据 —— v3 八关扩容 + 难度曲线上调 + 音频真实出声链路（2026-11-02）

> 本目录是「实现玩法」（implement）节点对策划案 v3（链 `cmvy3ccqq0010m9y06sz653gh` 最新 approved：
> 八关机制差异化 / 难度曲线上调 / 真实出声机判）实施后的**独立门禁证据**：四门禁在本提交内容集上
> 重跑，全部退出码 0。判定脚本一律来自仓库 `std-skills/godot-game-dev/scripts/`（零自造零改写），
> verify.sh 薄壳调度口径不变。

## 本节点动作（对照任务三条主线）

1. **音频链路修复/收口（真实出声机判数据面）**
   - 壳层能量探针：`export/web-shell.html` + `server/src/game-page.ts` 同源新增
     `AudioNode.connect` 拦截 → AnalyserNode（fftSize=256 时域 PCM）串入引擎输出链，
     `window.__audioDebug().getOutputEnergy(windowMs)` 返回 `Promise<{rms,peak,windows,running}>`
     —— mobile-web-smoke audio-unlock 升级口径（解锁起播后连续 2 窗 RMS > 0.01 判真实出声、
     静音后 RMS ≤ 0.001 判真实静默）的数据面；插桩手法与取证工具
     `qa/mobile/audio_energy_probe.mjs` 同源（AnalyserNode 直通，引擎零感知）。
   - BGM 手势后循环：起播唯一入口保持 `Audio.ensure_playing()`（3 个手势路径：选关/重开/
     首输入；首交互前不发声），运行时 `LOOP_FORWARD` 已开并新增机判断言。
   - bus 音量核查：BGM 音量从 -13dB 对齐 spec `audio.bgm.volume = 0.4 线性 ≈ -8dB`
     （理论输出 RMS ≈ 0.0265，对阈值 0.01 有 ~2.6× 余量）；冒烟新增 bus 审计断言
     （Master 无启动静音 / 增益 0dB / BGM 音量与声明一致 / 循环已开）。
   - 音效齐全：sfxBindings 全 8 类契约音效注册机判保持（shoot/hit/zombie_die/place/score/
     wave/victory/defeat + 工程内 confirm/fail/breach/produce）；坦克巨尸碾压复用
     hit + zombie_die（spec combat.crush.sfx，零新资产）。
   - export preset 核查：`export_filter="all_resources"` + include/exclude 均空 → 13 个
     音频资产 pck 字节级在包核查通过（本轮导出实测）。
2. **八关扩容 + 难度曲线上调**（spec v3 数值逐项落码，锚点经脚本复算核对）
   - `GameState.LEVELS` 3 → 8 关（波次编制与 spec levels[].elements 逐波一致）；
     每关 hpScale/speedScale 严格递增（1.00→2.85 / 1.00→1.42），出生数值 = 基准 × 倍率
     （`zombie_hp_of/zombie_speed_of`），boss 血量固定 2400 不乘 hpScale。
   - 新增坦克巨尸 gargantuar（hp2400/速12/掉落100/碾压/体型 1.55× + 危险色巨锤识别件）；
     碾压 = 接触即毁（含坚果墙）、不进啃食循环。
   - 机制差异化：L1 教学引导（完成态机判 + 常驻引导文案完成后淡出）、L3 波隔 12s、
     L4 天降节流 24s/15 + 卡槽 4 张（roster 按关过滤，键位 1-5 随槽位）、L5 夜幕遮罩
     （FogOverlay z_index=3 + 剪影↔显形）、L6 单波 ≥3 类、L7 巨尸第 4/9 波、
     L8 巨尸第 7/10 波 + 通关解锁无尽模式（入口可见、波次无限、1.08^波 复合、隔波混编巨尸）。
   - 星级结算（spec content.replayHooks：剩余生命 5/3/1 → 3/2/1 星）入档 + 选关页进度展示；
     选关页 8 关两行网格 + 解锁链（通关 n 解锁 n+1）+ 锁定关点按即时反馈。
3. **冒烟断言同步升级**（`tests/smoke.gd` 重写）
   - 关卡表锚点机判：八关波数/总数/起始阳光/hpScale/speedScale/加权血量/加权速度/波间隔/
     出怪间隔/首波延迟全部锚定 spec.numeric.difficulty（LEVEL_ANCHORS 常量表）+ 单调性机判
     （波数不减、总数/倍率/加权值/平均每波严格递增 ——「难度逐关抬升、无整体回落」）。
   - 八关逐关通关扫描：第 1 关真实输入链（结算浮层 → confirm 下一关），第 2-7 关直选推进，
     逐关真实出生路径探针（血量 = 基准×hpScale、速度 = 基准×speedScale）+ L4 卡槽减员 /
     L5 剪影↔显形 / L7 碾压探针；星级入档断言；无尽模式探针（入口可见 → 进入 → 出怪 →
     波次不终局 → 强度复合 → 巨尸混编）。
   - 帧预算纪律：门禁以 GODOT_SMOKE_FRAMES=240 兜底，八关扫描压进 220 帧预算
     （结算误触窗/伤害/产出/提示走测试通道压缩，生产默认不变，见 smoke.gd 文件头披露）。

## 门禁判定（本目录日志，全部退出码 0）

| 门禁 | 结果 | 证据 |
|---|---|---|
| preflight | `PREFLIGHT: PASS`（15 类，2612 个工程文件） | preflight-v3.log |
| godot-smoke | `GODOT_SMOKE: PASS`（240 帧内；`[smoke]` 第 1-8 关通关 + 无尽探针证据行齐全） | smoke-raw-v3.log / smoke-wrapper-v3.log |
| input-fuzz | `GODOT_FUZZ: PASS`（seed=20260913，6 批次 239 帧） | fuzz-v3.log |
| playtest | `GODOT_PLAYTEST: PASS`（3 局 ×900 帧；`[main] playtest run -> level 1/2/3` 三关轮换证据行） | playtest-raw-v3.log / playtest-wrapper-v3.log |

试玩逐局指标（METRICS 行）：fb=227 / 245 / 237，最长无反馈窗 0.38s / 0.35s / 0.37s（阈值 ≤10s），
与 r3 基线（227/245/240）一致 —— 试玩节奏面无回归。

## 导出与部署锚点（deploy 节点核对「部署的是不是这份代码」）

- 分支：`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`（绝不用 main）
- 本轮导出（--export-release "Web"，两次导出哈希一致 = 可复现）：
  - `export/web/index.pck` sha256 = `31716e490805028f0994ae96a8a950b31074e130ed3cab109b362ba74f992d50`
  - `export/web/index.js` sha256 = `8b649683883a8be172e229a0479503d50cd5245ebf87aa71fda70bf720824075`（与 v10 一致）
  - 13 音频资产 pck 字节级在包核查通过；导出壳页含 `getOutputEnergy`（能量探针已进产物）
- liveUrl（部署后不变）：`https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/`
- HostedApp：cmvxjyb8a001xm905cnip241e（slug: myrdplaygrou）
- 壳页同步义务：`server/src/game-page.ts`（AppHost 壳）与 `export/web-shell.html`（静态壳）
  本轮同源新增能量探针 —— **deploy 节点需重新部署以使 getOutputEnergy 上线**，
  否则 playtest 节点的「真实输出能量 > 阈值」机判没有数据面（线上仍是 v10 旧壳）。
  server 侧 `tsc --noEmit` 通过。

## 移交 playtest 节点的机判口径（spec outputEnergyProbe）

```
const debug = await page.evaluate("window.__audioDebug()");
debug.energyProbe === true                              // 探针在位
await debug.getOutputEnergy(250) × 2 次                  // 连续两窗
  → rms > 0.01 两窗均成立                                // 真实出声（audio-unlock 升级口径）
mute 后 rms ≤ 0.001                                     // 真实静默（mute-instant 口径）
```
不通过 → 自动打回 deploy 修复（重导出重部署后再测）。
