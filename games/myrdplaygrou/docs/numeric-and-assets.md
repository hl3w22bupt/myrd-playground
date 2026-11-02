# 《植物人大战僵尸-网页版》数值表与资产治理（spec v3）

> 对应策划案契约（spec.numeric / spec.assets，链 `cmvy3ccqq0010m9y06sz653gh` 上最新 approved 版
> = v3 八关机制差异化/难度曲线上调/真实出声机判）的工程内镜像。改数值 = 先改策划案（产生新版本）
> 再同步这里与 `autoload/game_state.gd`，禁止两头各改各的。
>
> 试玩调参的新入口：调参工作台（`?tuning=1`）内嵌「试玩反馈四问」回填面板 —— 用户亲手点选
> 四问后生成 spec.numeric 修订建议，经目标 owner 拍板 tuning_applied 才走 revisions 入链并
> 同步本文件与 `autoload/game_state.gd` 默认值；契约与数据流见
> `docs/tuning-feedback-four-questions.md`（冒烟第 19 项机判，默认值不许面板/映射层直接改）。

## 1. 内容表（spec.entities / numeric.plants / numeric.zombies）

### 1.1 出战卡（5 张；键位 1-5，造价为卡片绝对值）

| # | id | 名称 | 造价 | 血量 | 行为 | 射击间隔 | 特性 | 布防冷却 |
|---|---|---|---|---|---|---|---|---|
| 1 | sunflower | 阳光花 | 50 | 300 | 生产（25 阳光 / 10s，点按收集） | — | — | 7.5s |
| 2 | peashooter | 豌豆射手 | 100 | 300 | 单发射手 | 1.5s（×1.0） | 伤害 20 | 7.5s |
| 3 | frostpea | 寒冰射手 | 175 | 300 | 单发射手 | 1.5s（×1.0） | 命中冻结：速度 ×0.6，持续 2s | 8.0s |
| 4 | repeater | 双发射手 | 200 | 300 | 双发射手 | 0.75s（×0.5） | 一次两弹 | 8.0s |
| 5 | wallnut | 坚果墙 | 50 | 1200 | 肉盾（不攻击） | — | — | 20.0s |

- 弹丸伤害/速度为全局调参（combat.pea.damage=20 / speedPxPerSec=480），三射手共用。
- 布防成功 = 扣费 + 卡片进入冷却 + 自动取消选卡（spec input.place-plant「放置即消费」）；
  再点已选卡或点已占格位 = 取消选择。阳光不足 / 冷却中 = 禁用态并显示原因。

### 1.2 僵尸（5 类；绝对数值，spec.numeric.zombies）

| id | 名称 | 血量 | 速度 | 识别件（头饰，2px 描边） | 击杀掉落 |
|---|---|---|---|---|---|
| walker | 普通僵尸 | 100 | 18 px/s | 无（浅灰基底） | 15 |
| runner | 疾跑僵尸 | 70 | 36 px/s | 暗红束带 + 前倾姿态 | 20 |
| conehead | 路障僵尸 | 220 | 18 px/s | 橙色三角锥 | 25 |
| buckethead | 铁桶僵尸 | 400 | 14 px/s | 深灰铁桶 | 35 |
| gargantuar | 坦克巨尸（boss） | 2400（固定） | 12 px/s | 肩部装甲板 + 危险色碾压巨锤，体型 1.55× | 100 |

- 僵尸统一浅灰基底 #bdc3c7，类型识别色只上头饰（对比度规范，见 §4）。
- **难度曲线上调（v3）**：出生血量 = 基准 × 本关 hpScale（1.00→2.85 逐关严格递增），
  出生速度 = 基准 × 本关 speedScale（1.00→1.42）；唯一例外 = gargantuar（boss）：
  血量固定 2400 不参与 hpScale，速度照常吃 speedScale（spec difficulty.curveRule）。
- 坦克巨尸 = 碾压型（spec combat.crush）：接触植物立即摧毁（无视血量，含坚果墙），
  不进入啃食循环，随后继续前进；音效复用 hit + zombie_die，寒冰减速照常生效。
- 啃咬 = 离散节拍：每 1s 一口、每口 30 伤害（combat.bite）；冻结只减速移动不改啃咬节奏。

## 2. 关卡表（v3 八关扩容 + 难度曲线上调：hpScale/speedScale 逐关严格递增，禁止整体难度回落）

| 关卡 | 名称（机制） | 波数 | 总僵尸 | 起始阳光 | hpScale | speedScale | 首波延迟 | 波间隔 | 出怪间隔 | 加权血量 | 加权速度 | 章节 | 编制要点 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 前院晨光（教学） | 4 | 12 | 100 | 1.00 | 1.00 | 15s | 20s | 6.0s | 100.0 | 18.0 | 晨绿 | 单一种类教学（全 walker）：2/3/3/4 + 首布防引导 |
| 2 | 后院黄昏（标准） | 6 | 23 | 150 | 1.10 | 1.05 | 12s | 16s | 5.0s | 133.0 | 22.2 | 暮橙 | +疾跑/路障：斜率抬升第一道台阶（总数 +91.7%） |
| 3 | 屋顶疾风（快速波次） | 7 | 29 | 150 | 1.30 | 1.10 | 10s | 12s | 4.5s | 160.9 | 25.9 | 暮橙 | 全表最短波间隔 12s + 双发射手入卡槽 |
| 4 | 温室正午（阳光紧缩） | 8 | 36 | 100 | 1.50 | 1.22 | 12s | 15s | 5.0s | 190.0 | 26.8 | 正午暖黄 | 天降节流 24s/15 + 卡槽禁双发（4 张） |
| 5 | 后院深夜（夜幕迷雾） | 8 | 40 | 150 | 1.75 | 1.25 | 11s | 13s | 4.5s | 249.8 | 27.2 | 夜蓝 | 第 4 列及以右夜幕遮罩（alpha 0.6）、遮罩内剪影预显示；+铁桶 |
| 6 | 屋顶风暴（混合高压） | 9 | 52 | 200 | 2.05 | 1.30 | 10s | 12s | 4.0s | 299.6 | 29.2 | 夜蓝 | 存在单波 ≥3 类同屏（末波 4 类） |
| 7 | 屋顶巨影（boss） | 9 | 54 | 250 | 2.40 | 1.35 | 10s | 11s | 4.0s | 400.0 | 30.0 | 夜蓝 | 坦克巨尸 ×2 于第 4/9 波登场，接触即碾压（含坚果） |
| 8 | 终局夜幕（无尽压力） | 10 | 63 | 250 | 2.85 | 1.42 | 10s | 11s | 3.5s | 449.9 | 33.0 | 夜蓝 | 10 波全兵种 + 巨尸压轴（第 7/10 波）；通关解锁无尽模式 |

难度曲线核对（spec v3 curveRule：单调性机判见 `tests/smoke.gd::_check_level_table`，锚点 = 本表
spec.numeric.difficulty 数值）：
- hpScale 1.00→1.10→1.30→1.50→1.75→2.05→2.40→2.85 严格递增；speedScale 1.00→1.05→1.10→
  1.22→1.25→1.30→1.35→1.42 严格递增
- 加权平均血量 100→133→160.9→190→249.8→299.6→400→449.9 严格递增（第 7 关因巨尸入场
  台阶式 +33.5%，属 boss 编制、曲线已声明）；加权平均速度 18→22.2→25.9→26.8→27.2→29.2→30→33
- 僵尸总数 12→23→29→36→40→52→54→63 严格递增；波数 4→6→7→8→8→9→9→10 单调不减；
  平均每波 3→3.83→4.14→4.5→5→5.78→6→6.3 严格递增
- 起始阳光 100/150/150/100/150/200/250/250 为玩家侧增益补偿，不参与敌方难度校验
  （spec player.note；L4 阳光紧缩压回 100 属关卡机制）
- 无尽模式（通关第 8 关解锁）：借末关节奏/倍率作底座，血量按 1.08^波 复合递增，
  坦克巨尸自第 5 波起隔波混编；波次无限、仅失败终局

无头可判定代理：`tests/smoke.gd::_check_level_table`（八关锚点 + 单调性机判）+ **八关逐关通关扫描**
（`tests/smoke.gd` SWEEP 相位）：第 1→8 关逐关走到胜利，逐关断言「关卡推进（第 1 关走真实输入链
结算浮层下一关 → level_index 前进/波次归零；第 2-7 关直选推进）、逐关胜利判定（真实击杀清场 →
game_ended(true)、主按钮 next/replay 语义）、难度数值逐关生效（真实出生路径探针 = 基准×hpScale/
speedScale）、机制探针（L4 卡槽减员 / L5 夜幕剪影显形 / L7 坦克巨尸碾压 + 音效复用）」、
星级结算入档 + 第 8 关通关解锁无尽（入口可见 + 波次无限 + 1.08^波 复合 + 巨尸混编）；
冒烟移动断言保持四轴方向断言。机器人试玩侧由 `main.gd` 装配钩子 + `GameState.playtest_level_cursor`
把 3 局种子逐局对准关卡表前 3 关（证据行 `[main] playtest run -> level N` 进 playtest 门禁日志）
——契约详见 `docs/spec-acceptance-mirror.md` §3。

## 3. 阳光经济（v2：只经三途径产出，全部点按收集入账）

| 途径 | 产出 | 说明 |
|---|---|---|
| 天降 | 25 / 12s（L4 节流 15 / 24s） | 随机格落下，点按收集 |
| 向日葵 | 25 / 10s/株 | 落在生产株脚下，点按收集 |
| 击杀掉落 | 15~35 按种类（坦克巨尸 100） | 落在倒地处，点按收集 |

- 拾取物判定半径 44px（触屏友好）；停留 8s 后 2s 淡出消失，无惩罚；收集播 score 音效 + 「+N」飘字。
- 细流（trickle）产出在 v2 废除；score 语义 = 玩家点按收集的阳光总收入。
- 布防扣费唯一入口 `GameState.spend_sun`；阳光不足/冷却中由 `card_block_reason` 统一给禁用原因。

全局调参区（`autoload/game_state.gd`，键名 ↔ spec.numeric）：

| 键 | 默认 | 范围 | 说明 |
|---|---|---|---|
| projectile_damage | 20 | 5~60 | combat.pea.damage |
| projectile_speed | 480 | 120~900 | combat.pea.speedPxPerSec |
| fire_interval | 1.5s | 0.15~3 | 射击间隔基准（repeater ×0.5） |
| bite_interval / bite_damage | 1.0s / 30 | 0.4~3 / 10~90 | combat.bite |
| freeze_duration / freeze_factor | 2.0s / 0.6 | 0.5~5 / 0.2~0.95 | combat.freeze |
| sky_drop_interval / sky_drop_yield | 12s / 25 | 4~24 / 5~60 | economy.skyDrop |
| sunflower_interval / sunflower_yield | 10s / 25 | 1~20 / 5~60 | economy.sunflower |
| sun_expire_sec / sun_fade_sec / sun_tap_radius | 8s / 2s / 44px | — | economy.clickCollect |
| cursor_move_speed | 520 px/s | 120~900 | 键盘布防光标速度 |
| hint_show_seconds | 3.0s | 0.5~6 | 开局操作提示停留时长（超时淡出，不常驻） |

对局常量：初始生命 5（player.lives）；突破防线 -1 生命、移除僵尸（combat.breakthrough）。

单局时长（spec.difficulty.estimatedDurationSec 上限口径）：八关 131.9→146.2→133.7→163.6→160.5→
162.3→161.2→169.1 秒，均落在 1-3 分钟带内；`content.sessionSeconds = 180`。

## 4. 对比度规范（spec.numeric.visual.contrast，acc-contrast 机判）

- 草坪格底 = 低饱和深绿棋盘双档：`#2b5436`（深）/ `#31603f`（浅）按格交替 —— 替换 v1 高饱和亮绿。
- 前景主体（植物/僵尸/阳光/弹丸）统一 2px 描边 `#1e3b25` + 投影 rgba(0,0,0,0.25)（偏移 2px）。
- HUD 深底 `#22313f` + 浅字 `#ecf0f1`；阳光计数数字 `#f1c40f`；UI 主色件 `#3498db`（仅 UI，不作草坪前景）。
- WCAG 2.x 相对亮度公式逐对复算 ≥3:1，机判双保险：色对表常量（`tests/smoke.gd` CONTRAST_PAIRS）
  + 渲染常量与声明色值一致（FlatUI 是取色唯一来源）。共 12 对：植物体/向日葵盘/僵尸基底/阳光
  拾取物 × 草坪双档 + 阳光计数/正文/主色件 × UI 深底 + 夜战关剪影 `#6b7f94` vs 夜幕遮罩
  `#0d1626`（实测 4.39，v3 新增，spec levelMechanics.nightFog）。
- 回归教训：v1 植物主体 #2ecc71 落在高饱和亮草地上（同色相低对比）是「植物不可见」缺陷根因；
  本闸防复发。

## 5. 战场几何（1024×640 设计视口，spec.numeric.grid：9×5、96px 格，canvas_items 拉伸自适应）

- HUD 条：y 0~64；草坪：y 72~552（5 行 × 96px）；底部提示条：y 552~640
- 房子防线：x 0~104，防线 x = 112（僵尸头部越过即扣 1 生命）
- 布防网格：9 列 × 96px（x 112~976）；出怪口：x 984~1024（僵尸出生 x=1056 画面外走入）

## 6. 资产治理（spec.assets 契约面）

全部资产工程内程序化生成（source=generated），无外部素材、无位图贴图（除模板 CC0 粒子件，
本工程配置为不使用）：

| 资产 | 落点 | 生成器 | 备注 |
|---|---|---|---|
| BGM 循环 | assets/sfx/bgm.wav | procedural:tools/gen_bgm.gd | ≈55.4s 无缝循环（8 小节曲式 ×3 轮），运行时 LOOP_FORWARD |
| score/confirm/hit/fail/shoot/place/zombie_die/breach/victory/defeat | assets/sfx/*.wav | procedural:tools/gen_sfx.gd | v1 配方保留 |
| wave / produce | assets/sfx/*.wav | procedural:tools/gen_sfx.gd | v2 新增：波次号角 / 向日葵产出 |

音效契约（spec.audio.sfxBindings 全 8 类，机判见 `tests/smoke.gd::_check_audio_contract`）：
射击=shoot、命中=hit、僵尸倒地=zombie_die、放置单位=place、收集阳光=score、波次来袭=wave
（含首波与最后一波）、通关=victory、失败=defeat。工程内补充：按钮=confirm、无效操作=fail、
防线受击=breach、向日葵产出=produce。

⚠️ 新增/变更 .wav 后必须先跑一次无头 `--import` 生成 .import 元数据，再导出与冒烟（知识文档坑①）。

音频解锁契约（spec audio.audioContextUnlock + outputEnergyProbe，v3 升级为真实出声机判）：
- AudioContext 初始 suspended，壳页监听首个手势（touchstart/pointerdown/click/keydown）同步 resume；
  游戏侧兜底：首个人类输入 `Audio.ensure_playing()`（首交互前不发声，BGM 唯一起播入口）。
- BGM 手势后循环播放：运行时 `LOOP_FORWARD`（audio.gd `_ready` 装载时开启），
  音量 = spec audio.bgm.volume 0.4 线性 ≈ -8dB（理论输出 RMS ≈ 0.0265，对机判阈值 0.01 有
  ~2.6× 余量）；bus 音量核查机判见 `tests/smoke.gd::_check_audio_contract`
  （Master 无启动静音、增益 0dB、BGM 音量与声明一致）。
- **真实输出能量探针（v3 新增）**：壳页包 `AudioNode.connect` 把引擎输出改道
  AnalyserNode（fftSize=256，时域 PCM）→ destination，`window.__audioDebug().getOutputEnergy(ms)`
  返回 Promise<{rms, peak, windows, running}>；mobile-web-smoke audio-unlock 升级口径 =
  解锁起播后连续 2 窗 RMS > 0.01（≈-40dBFS）方判真实出声，静音后 RMS ≤ 0.001 判真实静默。
  「状态位 ≠ 真实出声」（总线静音时 bgmPlaying 仍为 true）的取证结论由此收口。
  静态壳（export/web-shell.html）与 AppHost 壳（server/src/game-page.ts）同源同语义。
- `window.__audioDebug()` 同时返回 `{unlocked, muted, bgmPlaying, energyProbe}`：muted/bgmPlaying
  由游戏侧 `Audio._publish_state()` 写 `window.__GAME_AUDIO_STATE__`，壳层合并返回。
- 静音开关：常驻右上角（`scripts/mute_button.gd`，独立 CanvasLayer，选关/对局/结算全程可见），
  ≥44×44px，AudioServer 总线 mute 即时生效，会话内记忆（Audio 单例承载）。

视觉：全场景扁平色块 + 几何造型（Node2D `_draw` / StyleBoxFlat），零渐变、零写实素材，
色板与对比度规则见 `.myrd/style-card.md`（flat-bright-pvz v3）；四章节配色（晨绿/暮橙/
正午暖黄/夜蓝）落在场景提示条/房屋檐口/天空底色，夜战关另叠加夜幕遮罩层
（`field.gd::FogOverlay`，z_index=3 压在僵尸之上）。

## 7. Steam 披露提醒

若将来上架 Steam，需在内容调查表中披露 AI 生成内容（Valve 2024-01 起）：本工程全部
音频/视觉资产为程序化生成（预生成，披露后允许）。
