# SFX 轮 playtest 节点独立复核与试玩验收包（2026-09-27）

- 运行：workflow `cmuiepudp0023m9gyqlknrtbv` run `cmuishbx900c1m9l6dkz2zvyj`（iterate startNodeId=implement，验收标准 6 音效）
- 节点：scaffold ✓ → implement ✓ → deploy ✓（v11）→ **playtest（本文）**
- 分支：`myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta`，HEAD `1e1c2fe`

## 一、本轮独立复核（playtest 节点亲自取证，非转抄）

| 项 | 结果 | 证据 |
|---|---|---|
| SFX 实现 | ✓ | `autoload/sfx.gd`：collect/hit/game_over/restart 四键，每键 1 个 `AudioStreamPlayer` + 程序化 16-bit PCM 22050Hz `AudioStreamWAV`（`_render` 分段合成，无二进制音频资产）；`scripts/main.gd:182/195/232/268` 四处接线（收集/受击/结算/重开）；`tests/smoke.gd` G 段契约断言（Sfx 注册、播放器结构、play_counts） |
| 门禁 | ✓（preHook 复跑全绿） | implement/deploy 节点均挂 `preHook: godot-smoke`（params gamePath=games/game-2, smokeFrames=240；reject→scaffold maxLoops=5）。判定脚本来自仓库内 `std-skills/godot-game-dev/scripts/`（preflight.py/smoke.sh/input-fuzz.sh/resolve-godot.sh 均在），`.myrd/routines.yaml` 含 id=godot-smoke。deploy 节点复跑：PREFLIGHT PASS + GODOT_SMOKE PASS(240帧) + GODOT_FUZZ PASS |
| 部署 v11 | ✓ | hostedAppId=`cmuiepuda001xm9gyecrisk7n`，deploymentId=`cmuisxkxr00cam9l654pg9uwm`，gitRef=`myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta`，commit `0fc434a`（从 HEAD 913d9af 重导出） |
| 线上=HEAD | ✓ 逐字节一致 | `GET /apps/game-2/api/public/assets/index.pck`（base64→gunzip）= 2530512B，sha256 `4ca3c417047cd39006e1825e7460e98dc9cb335318669cb4e37e0e014d459b85` == 本地 `games/game-2/export/web/index.pck`（playtest 节点现场重算） |
| 线上可达 | ✓ | `/apps/game-2` 200（标题「星尘收集者」）、`/gw` 200 |
| 远端同步 | ✓ | `origin/myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta` = `1e1c2fe` = 本地 HEAD |

注：分支名勘误沿用 deploy 节点结论——本 goal 实际功能分支为 `myrd/game-2-goal-<goalId>`；任务文本中 `myrd/games-goal-<goalId>` 属另一目标，远端虽存在但非本 goal 产物线。

## 二、试玩验收包（发给用户试玩用）

**试玩入口**：https://leomac-studio.tail49399e.ts.net/apps/game-2/
**调参工作台**：https://leomac-studio.tail49399e.ts.net/apps/game-2/?tuning=1

### 怎么玩（对照 config/gameplay.cfg 当前值）

- 操作：拖拽画面 / 虚拟摇杆移动飞船（桌面鼠标拖拽即可）。
- 目标：吃星尘晶体 +1 分/颗（`score_per_crystal=1`），撞陨石 -1 护盾（`damage_per_hit=1`，初始 3 盾 `initial_shield=3`，受击后短暂无敌帧防同颗连扣 `invincibility_seconds=1.0`）。
- 结算：盾归 0 弹结算面板（本局得分 + 历史最高分，`user://stardust_save.cfg` 持久化，刷新不丢）；「重新开始」立即开新一局。
- 进阶：每 10 分里程碑横幅（`milestone_step=10`）；得分达 20（`score_target=20`）切「目标达成 · 胜利！」终局；难度随分梯度上升（陨石上限/速度逐级上调）。

### 本轮新增：四类音效「听什么」

| 场景 | 听感 | 合成 |
|---|---|---|
| 吃到星尘 | 上行双音「叮」 | sine 987.77→1318.51Hz，-8dB |
| 撞上陨石 | 下行锯齿「闷响」+ 噪声颗粒 | saw 220→62Hz + 25% 白噪声，-4dB |
| 结算面板弹出 | 下行三连音「落幕」 | triangle 440/329.63/261.63Hz |
| 点重新开始 | 上行扫频「启动」 | sine 523.25→1046.5Hz |

### 结构化试玩量表（四问，逐条作答，勿合并）

| # | 问题 | 回答 |
|---|---|---|
| ① | 首分钟能否看懂目标与操作？（是/否 + 卡点） | **待用户试玩** |
| ② | 结束时想不想再来一局？（1-5 分 + 原因） | **待用户试玩** |
| ③ | 手感与反馈（1-5 分：打击感/音效/画面响应） | **待用户试玩**（本轮四类音效已上线，请重点评第 3 小项） |
| ④ | 节奏有没有明显断档或无聊段？（有/无 + 第几秒） | **待用户试玩** |

> 纪律：以上四问只能由用户试玩后回填；agent 不代填、不推测。

### 调参回填

- 打开 `?tuning=1` → 右上调参面板拖滑杆即时生效（17 键，TUNING_META 量程钳制）→ 点「复制调参 URL」→ 把带 `?tuning=<JSON>` 的链接回贴频道「星尘收集者 · 试玩反馈」（`cmuiseju600brm9l6z7xh107f`）或直接发给目标执行者。
- 回填后走 GameDesignSpec `cmuinva4t002xm9l6bwjcnyy6` revisions 通道落新版本（带溯源）再 approve 拍板；未知键忽略并在 diff 标注。

### 遗留

- `playtest.sh` 仍缺（模板仓库未预置，Bug `cmuimz29u0014m9l6t0cp1hpt`）——自动化试玩门禁维持 blocked，不自造判定器。
- iOS 真机听感复测：待用户开启 `sudo safaridriver --enable` + Safari 网页检查器两开关（见 `qa/real-device-ios-20260927.md` 与 `qa/round-20260927-express-unlock-push.md`）。
