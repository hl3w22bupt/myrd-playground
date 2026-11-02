# implement 节点收口（v15）：策划案 v6 三 Bug 修复 —— HUD 单实例/响应式 + 紧张感音画分层

> 本节点：按 approved 策划案 v6（`cmvyol366005wm9y0kzkdz57d`）修复第三轮 3 条用户反馈 Bug。
> 判定脚本一律来自仓库 `std-skills/godot-game-dev/scripts/`（零自造零改写）。
> 详细镜像：`games/myrdplaygrou/docs/spec-acceptance-mirror-v6.md`（Bug→修复→机判证据逐条对照）。

## 1. Bug 核销（3/3，机判证据随 GODOT_SMOKE 日志落盘）

| Bug | 修复 | 机判 |
|---|---|---|
| ① cmvyowgsh… 顶栏按钮重复（P1） | 常驻控件 `_ready` 一次性构建；`rebuild_cards()` 只重建卡槽 | SWEEP level==1 `debug_control_counts()`：常驻 7 类各 ==1、卡槽 ==关卡数（旧实现此处为 2） |
| ② cmvyowgtj… 按钮字体过大重叠（P1） | HUD 响应式布局引擎 + expand 拉伸 + CSS 钳制带 + 两行折行 + 战场让位 | 360/768/1280/1920/2560 五档逐档实例化：12 元素在画布内 + 两两无重叠 + 钳制带真值 + 行距 ≥8 + 顶栏 ≤72（单行）/战场让位成立（两行）；真实 HUD 复跑同核心 |
| ③ cmvyowguf… 音效紧张刺激与代入感（P2） | 双版 BGM 交叉淡入（0.9s ≤1s）+ groan/chomp/danger 三氛围音 + wave 号角（末波急促变体）+ hit 加厚 + zombie_down 尾音 | 真值表 9 组 + 行为探针（chomp/danger/groan 触发 + 切换与回落）+ 配方分层 + 本地能量探针（BGM 持续、confirm/place/wave 尖峰、**静音端到端能量归零**、18 资产在包） |

## 2. 门禁终局（本地，HEAD = 本收口 commit）

证据：本目录 `verify-full.log`（`bash games/myrdplaygrou/verify.sh`，退出码 0）

| 门禁 | 判定 | 实测 |
|---|---|---|
| resolve-godot.sh | Godot 4.3.stable.official.77dcf97d8 | 可用 |
| preflight.py | PREFLIGHT: PASS | 15 类（2661 个工程文件） |
| smoke.sh（600 帧） | GODOT_SMOKE: PASS | 含本轮新增：五档 HUD 布局 / 顶栏单实例守卫 / 紧张感音画探针 |
| input-fuzz.sh | GODOT_FUZZ: PASS | seed=20260913，6 批次 239 帧 |
| playtest.sh | GODOT_PLAYTEST: PASS | 3 局 ×900 帧，fb=226/248/247 |

移动端模拟门禁（mobile-web-smoke.mjs，--project 完全口径，对**本地导出**）：
**MOBILE_SMOKE: PASS 11/11**（网络/console/canvas/render/**animate**/touch-pipeline/touch-response/
joystick 跳过/audio-unlock/viewport/fps）→ `mobile-smoke-local-report.json`。
部署预检能量探针（qa/mobile/audio_energy_probe.mjs）：**AUDIO_PROBE: PASS 9/9** →
`audio-probe-local-report.json`（含 BGM 持续能量、三类音效尖峰、静音端到端归零、18 资产在包）。

## 3. 导出产物（AppHost bundle 输入）

| 文件 | sha256 |
|---|---|
| export/web/index.pck | `7e7ca53dc38421fe461db1a77b1829ea3f07f9af9ab0bb3116c936b45a3ae9a0` |
| export/web/index.js | `8b649683883a8be172e229a0479503d50cd5245ebf87aa71fda70bf720824075`（引擎层不变，与 v14 同哈希） |

资产管线：新增 5 个 .wav（bgm-loop-intense / wave_urgent / zombie_groan / chomp / danger）+
重合成 3 个（hit / wave / zombie_die）→ 无头 `--import` 二次导入（18 个 .import 元数据齐全）→ 导出。

## 4. 边界声明

- **部署**：AppHost（app id `cmvxjyb8a001xm905cnip241e`）部署 API 需应用所有者权限
  （沙箱令牌实测 `POST/GET /api/v1/apphost/apps/cmvxjyb8a001xm905cnip241e/*` = 403
  「仅应用所有者或系统管理员可操作」）→ 部署与 liveUrl/HostedApp/deployment id 回写由
  平台 deploy 节点执行（gitRef = `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`，
  apphost.toml assets_dir 指向不变）；线上 mobile 门禁与能量探针复验随 deploy/playtest 节点。
- **spec**：v6 零改动（三条 Bug 均为实现缺陷）；`acc-hud-layout` / `acc-audio-tension` 的
  auto 机判在本仓库 smoke.gd 落地并与条目 statement 逐句对应（见 docs/spec-acceptance-mirror-v6.md）。


## 5. 合流轮补充（并行实现 v15/v16 合并，2026-11-02 14:2x）

推送时发现目标分支已由并行 implement 轮推进（71b4e5f 同两 Bug 修复 + cfd180d v16 合并留痕）。
按「各自保留对方没有的修复」合流（merge commit，非覆盖）：

| 来源 | 保留内容 |
|---|---|
| 并行轮（71b4e5f） | 字体 oversampling 钉 1.0（文本整行被裁的实测根因）；confirm/fail/score 等全部 wav compress/mode=0（PCM，能量机判不失真）；FlatUI.FONT_BODY 20→18；结算浮层误触窗守卫；选关页 kit 文档 |
| 本轮（599407e） | HUD CSS 钳制带引擎（DPR 感知）+ expand 拉伸 + 战场让位 + 相机对中；五档视口 = spec 原文口径 360/768/1280/1920/2560；顶栏单实例守卫（按功能 key 命名）；紧张感音画（bgm-loop-intense.wav = spec 资产 id、55.4s 同调性无缝交叉淡入、真值表 9 组、行为探针、wave_urgent 末波急促变体）；Audio/Field/Hud 渲染几何回写桥（window.__GAME_VIEW_STATE__） |

被取代的并行面（合流中移除）：bgm-intense.wav（30s，非 spec 资产 id）、
`GameState.intense_bgm_desired()`（规则收敛进 Audio.tension_should_be_intense + 真值表）、
`Zombie.danger_warned`（Field 侧用 danger_signaled）。

**合流态门禁复跑全绿**（HEAD = merge commit）：
- preflight 15 类 PASS（2701 文件）
- GODOT_SMOKE: PASS（600 帧，含五档 HUD 布局 / 单实例守卫 / 紧张感探针）→ `smoke-merge.log`
- GODOT_FUZZ: PASS / GODOT_PLAYTEST: PASS → `playtest-merge.log`
- mobile-web-smoke（--project，本地导出）11/11 PASS → qa/mobile/report.json
- 能量探针 AUDIO_PROBE: PASS 9/9（含静音端到端能量归零、18 资产在包）→ `audio-probe-merge-report.json`

合流导出产物：
- export/web/index.pck sha256 = `76b09d9b94f369547180df1b8908f089e2c35ff57eaa5d9523aa481fcb0095bc`
- export/web/index.js sha256 = `8b649683883a8be172e229a0479503d50cd5245ebf87aa71fda70bf720824075`（引擎层不变）
