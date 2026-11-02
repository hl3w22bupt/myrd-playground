# 《植物人大战僵尸-网页版》v6 验收镜像：HUD 响应式布局契约 / 紧张感音画分层（Bug ③轮收口）

> 权威基准：平台 GameDesignSpec **v6 = `cmvyol366005wm9y0kzkdz57d`（approved，updatedAt 2026-11-02）**，
> 本轮三条用户反馈 Bug 的实现收口镜像。纪律：spec 未改一字（三条 Bug 均为实现缺陷而非 spec 缺陷），
> v6 的 `acc-hud-layout` / `acc-audio-tension` 两条 auto 验收在本仓库 smoke.gd 落了对应机判实现。

## 0. Bug → 修复 → 机判证据 三段对照（逐条核销）

### Bug ① cmvyowgsh006sm9y05qblbd70（P1 顶栏按钮重复）

- **缺陷面**：`hud.gd::rebuild_cards()` 复用 `_build_card_buttons()`，后者把「下一波/波次/生命/返回/
  重开/操作提示」常驻控件与卡槽混在一起构建 —— 每次 `start_level`（选关进入/通关推进/失败重开）
  都把常驻控件重复追加一遍（`_wave_label`/`_skip_wave_button` 等引用被覆盖指向新实例，旧实例留在
  树上不可控），第 2 关起顶栏同类按钮成倍叠加（与已核销的 cmvyognpc… 同根因、不同触发链）。
- **修复面**：常驻控件只在 `_ready → _build()` 一次性构建；`rebuild_cards()` 只清重建卡槽按钮
  （跨行搬移用 `_order_in()` 收口，remove_child 从真实 parent 取）；音效开关对局中由 HUD 卡槽行
  接管（单实例），选关/结算态切回右上角常驻件（`main.gd` 显隐互斥）。
- **机判证据**（tests/smoke.gd::_step_sweep_setup，SWEEP level==1 即「进入第 2 关」）：
  `Hud.debug_control_counts()` 按功能 key 归类计数 —— `sun/next_wave/wave/lives/back/restart/mute`
  各 ==1、`card` == 本关卡数；断言失败即 GODOT_SMOKE: FAIL。日志证据行：
  `[smoke] 顶栏单实例守卫通过（第 2 关常驻控件 … 各 1，卡槽 5 张）`。
  对应 acc-hud-layout 的「关卡切换三链路后同类功能按钮实例数 == 1」子句（三链路由八关扫描的
  真实推进链覆盖：第 1 关结算浮层 confirm 推进、2-7 关直选推进、末关 replay）。

### Bug ② cmvyowgtj006um9y0lxb19hyt（P1 按钮与字体过大重叠 / 宽屏裁切）

- **缺陷面**：布局钉死 1024×640 设计坐标 + keep 拉伸 —— 宽屏等比放大让按钮/字号物理尺寸失控，
  右上角静音开关（独立 CanvasLayer）与 HUD 右端控件重叠、音效按钮被裁切。
- **修复面**（spec.numeric.visual.hudLayout 全条目）：
  ① `project.godot` stretch aspect `keep → expand`：设计画布随窗口比例外扩，宽屏不再放大 HUD；
  ② `hud.gd` 响应式布局引擎：CSS 宽 = 视口设计宽 × 拉伸比 ÷ devicePixelRatio（Web 窗口是设备
  像素，不除 DPR 会把 390 CSS 宽算成 1170 —— 本轮部署预检实测抓到并修复）；
  ③ 钳制带：按钮高 44~56 / 正文字号 18~24 / 辅助字号 12~16 / 间距 8~12（窄视口触点 ≥44 底线、
  超宽不放过大限）；④ CSS 宽 <960 折两行（第 1 行状态区，第 2 行卡槽区+音效开关，行距=间距带≥8），
  紧凑文案档（<640）保窄屏整行放得下；⑤ 单行顶栏总高 ≤68 设计 px < 草坪首行 y=72；两行时战场
  整体下移（`main.gd::field_y_offset`，间隙 8px）且战场全高仍在画布内；⑥ 相机对准可见画布中心
  （expand 画布外扩后取景随 visible_rect 更新，实测 FIXED_TOP_LEFT 会把世界甩出画面）。
- **机判证据**（tests/smoke.gd::_step_hud_layout + _assert_hud_rects）：360/768/1280/1920/2560 五档
  SubViewport 逐档实例化 HUD，断言 12 元素（阳光/下一波/波次/生命/返回/重开/5 卡/音效）
  包围盒完全在画布内 + 两两无重叠 + 钳制带真值 + 折行档位 + 两行行距 ≥8 + 单行顶栏 ≤72 +
  战场让位偏移成立；另在真实运行 HUD（1024×640）复跑同一断言核心。日志证据行（5 条）：
  `[smoke] HUD 布局 360×740：两行 12 元素在界无重叠（按钮高 44 css，行距 8，战场让位 50 px）` …
  `[smoke] HUD 布局 2560×1440：单行 12 元素在界无重叠（按钮高 56 css，正文 24，间距 12，顶栏高 68 ≤ 草坪首行 72）`。
  线上/本地预检的视觉确认：390×844 移动仿真 in-game 截图两行 HUD 无重叠无裁切（qa/mobile/phase-*.png）。

### Bug ③ cmvyowguf006wm9y0cf7fbxk3（P2 音效紧张刺激与代入感）

- **修复面**（spec.numeric.audio.tension 全条目，全部程序化合成、CC0、扁平取向）：
  ① 双版 BGM：`tools/gen_bgm.gd` 一次跑双版 —— 基础版逐字节不变（sha1 复验 33e05e47…），紧张版
  `bgm-loop-intense.wav` 同长（55.4s）同调性同曲式 + 八分音符贝斯脉冲/16 分 hat/每拍低鼓/五度伴声；
  `Audio` 双播放器交叉淡入 0.9s（≤1s 契约），切换规则 = 已出场波次 ≥ ceil(总波次/2) 或末波，
  无尽模式取第 4 波起（八关线折半口径），开局/结算/回落切回基础版；
  ② sfx-zombie-groan 低吼（saw 98→66Hz + vibrato 11Hz + 呼吸噪声，RMS 0.10，播放 -12dB 低于
  BGM 有效响度 0.0265），僵尸在场 4~8s 随机间隔调度（场上无僵尸静默）；
  ③ sfx-chomp（噪声瞬态+低频咀嚼双层，进入啃食沿 + 每口触发）；
  ④ sfx-danger（双上行方波+噪声+70Hz 低鼓，僵尸进最左 2 列 DANGER_X 或生命被扣触发一次/只）；
  ⑤ sfx-wave 号角式（saw 220→330 swell + 294→440 伴声 + 62Hz 低鼓）+ wave_urgent 末波急促变体
  （0.55s 双音更紧）；
  ⑥ sfx-hit 加厚（95Hz 正弦 thud + 噪声瞬态双层）；⑦ sfx-zombie-down 加倒地闷响尾音（62Hz 长衰减层）。
  响度基准：normalize_rms 0.10~0.22（-20~-13dBFS 级），实测逐资产 RMS 0.0666(BGM)~0.2546(confirm)，
  全部高于能量探针阈值 0.01（2.6~25 倍余量）。
- **资产管线纪律**：新增 5 个 .wav 先无头 `--import` 二次导入（18 个 .import 元数据齐全）再导出。
- **机判证据**：
  - tests/smoke.gd::_check_audio_tension_static：18 资产在盘在册（SFX_BANK + FileAccess）、
    紧张版循环已开、切换规则真值表 9 组、配方分层机判（hit 含 <120Hz thud 层 / zombie_die 含
    尾音层 / wave 含 ≥2 层 / 4 个新名在配方）；
  - tests/smoke.gd::_step_audio_tension：行为探针 —— 僵尸进啃食 → `sfx:chomp`、进最左 2 列 →
    `sfx:danger`、低吼计时提速 → `sfx:zombie_groan`，双版切换（第 4/6 波 intense_active +
    intense_playing + 基础版音量离开基准 = 交叉淡入已启动）与回落断言；
  - 本地部署预检 qa/mobile/audio_energy_probe.mjs（AnalyserNode 真实输出能量取证）：BGM 持续能量
    ≥-48dBFS、confirm/place/wave 三类触发后能量尖峰、**静音开关端到端能量即时归零（HUD 卡槽行
    音效开关，非仅 muted 标志）**、首手势前真实静音、18 音频资产在包 —— AUDIO_PROBE: PASS。
    对应 acc-audio-tension ②「逐一经能量采样实测连续两窗 RMS >0.01」与 acc-mute-instant 的
    真实出声口径（线上复验随 deploy 节点执行）。

## 1. 门禁 ↔ 验收条目映射（v6 增量面）

| 验收条目 | 机判位置 | 本轮改动 |
|---|---|---|
| acc-hud-layout（HUD 响应式无溢出无重叠 + 单实例守卫） | `tests/smoke.gd::_step_hud_layout` / `_assert_hud_rects` / SWEEP 单实例守卫 | 新增：五档视口逐档实例化机判 + 过关常驻控件计数（Bug①②） |
| acc-audio-tension（双版 BGM/氛围音效/号角/加厚命中） | `tests/smoke.gd::_check_audio_tension_static` / `_step_audio_tension` | 新增：真值表+行为探针+配方分层（Bug③） |
| acc-audio-unlock / acc-audio-complete / acc-mute-instant | 壳层 `__audioDebug().getOutputEnergy()` + smoke 音频契约 | audio.gd 双 BGM 播放器；探针覆盖 18 资产 |
| acc-playable-loop / acc-difficulty-curve / acc-level-mechanics / acc-input-semantics | 既有 smoke 相位（v3 线） | 保持全绿（本轮改布局引擎后回归复验） |
| acc-flat-palette / acc-contrast / acc-resource-loop / acc-no-placeholder / acc-touch-only / acc-session-duration / acc-spec-consistency / acc-mute-instant | 既有 smoke 断言 | 保持全绿 |

## 2. 本轮工程侧附带修正（部署预检实证的隐性缺陷）

- Web DPR 口径：HUD 度量除以 `window.devicePixelRatio`（Web 窗口 = 设备像素；不除则 390 CSS 宽
  手机按 1170 布局 → 单行溢出）。
- `main.gd` 无头/桌面窗口尺寸钉回设计分辨率（headless 虚拟窗口 64×64 在 expand 下会把设计画布
  撑成 1024×1024）；`SMOKE_WINDOW_DEBUG=宽,高` 调试通道可钉任意几何复现移动端画布。
- 战场让位 + 相机对中（expand 高画布下战场垂直居中，视野 = visible_rect 全域）。
- Field 点按坐标 `to_local()` 化（战场节点下移后布防/收集判点仍准）。
- 选关页首卡呼吸 CTA（缩放 1.04 + modulate 0.72~1.0，1.1s）与转动小太阳装饰 —— 选关页唯一的
  idle 动效来源：既引导「从这里开始」，也让 mobile-web-smoke 的 animate（1.5s 双时点帧差）在
  秒开的本地加载下有确定性信号（线上加载动画是其更大的天然信号源）。

## 3. 部署与门禁边界声明

- 本地四门禁（verify.sh 薄壳）+ mobile-web-smoke（--project 完全口径，对本地导出）全绿；
  证据：qa/gate-logs/20261102-v6-tension-hud/。
- AppHost 部署（app id `cmvxjyb8a001xm905cnip241e`）由平台部署节点执行（沙箱令牌对
  `/api/v1/apphost/apps/*` 无所有者权限，403 实证）：本节点交付 Web 导出产物（export/web/，
  pck sha256 见 SUMMARY）+ apphost.toml assets_dir 指向不变，push 后由部署节点以
  gitRef = `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv` 出新 deployment 并回写 liveUrl；
  线上能量探针复验随 deploy/playtest 节点执行。
