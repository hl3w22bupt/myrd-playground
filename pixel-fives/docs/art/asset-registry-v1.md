# Pixel Fives · 资产台账 v1（A01–A08 首批 · draft-pending-approval）

> 状态：待主策划批准。批准前不启动量产。真源 = `assets/*.grid` + `assets/manifest.json`。
> 黑板 `.myrd/blackboard/assets.md` 不可达，本台账为落文待归位版。

## 1. 编号 → 资产映射（主表）

| 编号 | id | 源文件 | 类型 | 帧规格 | 动画 | 用色 | 程序槽位建议 | 状态 |
|---|---|---|---|---|---|---|---|---|
| A01 | `a01-pitch-tileset` | `assets/a01-pitch-tileset.grid` | tileset | 16×16 ×4 | 静态 | 4 | `levels/pitch`（tile 0-3 见 manifest.tile_index） | draft |
| A02 | `a02-player-red` | `assets/a02-player-red.grid` | spritesheet | 16×16 ×6 | idle 0-1@4fps / run 2-5@12fps | 8 | `entities/player`（kit=red） | draft |
| A03 | `a03-player-blue` | （派生自 A02） | spritesheet | 16×16 ×6 | 同 A02 | 8 | `entities/player`（kit=blue） | draft |
| A04 | `a04-ball` | `assets/a04-ball.grid` | spritesheet | 8×8 ×4 | roll 0-3@12fps | 3 | `entities/ball` | draft |
| A05 | `a05-goal-net` | `assets/a05-goal-net.grid` | sprite | 32×24 ×1 | 静态 | 3 | `entities/goal` | draft |
| A06 | `a06-kick-shot` | `assets/a06-kick-shot.grid` | animation | 16×16 ×9 | **12fps = 0.75s** | 8 | `entities/player`（shoot） | draft |
| A07 | `a07-ui-hud` | `assets/a07-ui-hud.grid` | ui-panel | 48×16 ×1 | 静态（九宫格） | 8 | `ui/hud` | draft |
| A08 | `a08-sfx-goal-hit` | `assets/a08-sfx-goal-hit.spec.json` | audio | 0.6s / 44.1kHz / 16bit mono | 一次性 | — | `entities/goal`（`goal_sfx_at_s` 触发） | draft |

id 命名：小写 kebab-case；`A<编号>` 为讨论层编号，`a<编号>-<名>` 为文件层 id，两层层号一一对应。

## 2. 本轮两条终裁变更（详情）

### A06：12→? → 锁定 9 帧@12fps = 0.75s
- 依据：2026-09-12 例会主策划终裁（原稿帧数记录随黑板不可达无法回溯，以终裁为准，本台账为唯一真源）。
- 落地：9 帧姿态链 `f0蓄势 → f1后摆 → f2支撑深蹲 → f3触球 → f4随前 → f5高摆 → f6回收 → f7回收 → f8回位`。
- **contact_frame = 3**（0 基，≈250ms）：仅为视觉触球帧；出球判定由程序在输入后即时触发（红线 `input_to_shot_latency_ms ≤ 50`），动画不阻塞判定。此约定随本表送批。
- 双队共用骨架：霜蓝版 = 同网格 `r→b / R→B / x→y` 换色（程序侧运行时换色或双 PNG，二选一由程序定）。

### A08：新增 `sfx-goal-hit`
- 依据：2026-09-12 例会主策划终裁（音效不删、变可测）。
- 落地：三层合成（网摩擦 2400Hz 带通噪声 / 球闷响 90→60Hz 下扫正弦 / 观众声浪 900Hz 低通渐强），0.6s，44.1kHz 16bit mono，归一 -3dBFS，seed=20260912 确定性输出。
- 触发：`goal_sfx_at_s` 字段归属 spec v1.2（策划线落文）；美术侧默认偏移 0.0s。
- 试听：`preview.html` 内置 WebAudio 同参合成；交付产物 = `node tools/gen-audio.mjs` 的 WAV。

## 3. 程序接线约定（给游戏程序线）

1. **构建命令**（零 npm 依赖，node ≥16）：
   - `node pixel-fives/tools/gen-assets.mjs` → 解析 .grid → 校验 → 导出 `assets/out/*.png`（spritesheet 横排）→ 回填 manifest bytes → 强校验总量 ≤1.5MB（超线 exit 1）
   - `node pixel-fives/tools/gen-assets.mjs --scale 4` → 整数倍放大导出（`@4x` 后缀），禁非整数缩放
   - `node pixel-fives/tools/gen-audio.mjs` → `assets/out/a08-sfx-goal-hit.wav`
2. **动画播放参数**以 manifest 为准：`anims[].range/fps`、`contact_frame`；spritesheet 布局一律横排等宽帧。
3. **接地投影**由程序绘制（`#1A1626` 50% alpha 椭圆），精灵内不含投影（风格卡§2）。
4. **朝向**：角色/球门素材默认朝右（球门为左向），反向一律水平镜像，禁止运行时旋转。
5. 如落点/命名与本表冲突：走黑板 blockers（不可达期间回给主策划），**不要单方改资产 id**。

## 4. 体积预算

| 项 | 值 |
|---|---|
| 资产总量红线 | ≤ 1,572,864 B（1.5MB，微信主包 ≤4MB 预算内让位代码/音频） |
| 体检方式 | `gen-assets.mjs` 自动汇总（.grid 源 + PNG + WAV），超线 exit 1 |
| 当前 | 由脚本回填 `manifest.budget.assets_total_bytes`（本表不手填，避免假数） |

## 5. 待归位清单（黑板恢复后）

- [ ] 本台账 + `style-card-v1.md` 迁入 `.myrd/blackboard/assets.md`（或按黑板既定结构挂链）
- [ ] 主策划批准结论回写黑板并同步 manifest.status / approved_by
- [ ] 若黑板命名表与本表 id 冲突：以黑板为准，改名走一次脚本批量替换
