# Pixel Fives · 资产台账 v1（A01–A08 首批 · approved）

> 状态：**已批准**（2026-09-12 主策划盖章，对象含 spec v1.2 + 风格卡 v1 + A01–A08 规格，
> 记录 = `docs/spec/v1.2-approval-record.md` §1/§2；本台账原「draft-pending-approval」状态行
> 系批准前旧稿遗留，2026-09-22 美术批次按批准记录刷新，规格内容零改动）。
> 真源 = `assets/*.grid` + `assets/manifest.json`；黑板归位区 = `.myrd/blackboard/assets.md`「足球线资产清单」。

## 1. 编号 → 资产映射（主表）

| 编号 | id | 源文件 | 类型 | 帧规格 | 动画 | 用色 | 程序槽位建议 | 状态 |
|---|---|---|---|---|---|---|---|---|
| A01 | `a01-pitch-tileset` | `assets/a01-pitch-tileset.grid` | tileset | 16×16 ×4 | 静态 | 4 | `levels/pitch`（tile 0-3 见 manifest.tile_index） | approved（已接线） |
| A02 | `a02-player-red` | `assets/a02-player-red.grid` | spritesheet | 16×16 ×6 | idle 0-1@4fps / run 2-5@12fps | 8 | `entities/player`（kit=red） | approved（已接线） |
| A03 | `a03-player-blue` | （派生自 A02） | spritesheet | 16×16 ×6 | 同 A02 | 8 | `entities/player`（kit=blue） | approved（已接线） |
| A04 | `a04-ball` | `assets/a04-ball.grid` | spritesheet | 8×8 ×4 | roll 0-3@12fps | 3 | `entities/ball` | approved（已接线） |
| A05 | `a05-goal-net` | `assets/a05-goal-net.grid` | sprite | 32×24 ×1 | 静态 | 3 | `entities/goal` | approved（已接线） |
| A06 | `a06-kick-shot` | `assets/a06-kick-shot.grid` | animation | 16×16 ×9 | **12fps = 0.75s** | 8 | `entities/player`（shoot） | approved（已接线） |
| A07 | `a07-ui-hud` | `assets/a07-ui-hud.grid` | ui-panel | 48×16 ×1 | 静态（九宫格） | 8 | `ui/hud` | approved（已接线） |
| A08 | `a08-sfx-goal-hit` | `assets/a08-sfx-goal-hit.spec.json` | audio | 0.6s / 44.1kHz / 16bit mono | 一次性 | — | `entities/goal`（`goal_sfx_at_s` 触发） | approved（已接线） |

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

### 3.1 接线实况（2026-09-22 美术批次逐项核查，零缺口）

| 资产 | 加载点 | 渲染/播放点 | 回退（fallback） |
|---|---|---|---|
| A01 | `src/app/gridSprites.js` loadAllSprites（a01） | `renderer.js` renderPitch tile 铺设 | 占位平涂亮/暗条纹 |
| A02/A03 | loadGrid `a02-player-red.grid`（swap=true → swapped=蓝版） | renderPlayers kit=red/blue 六帧 | 队色块 + 暗描边 + 朝向白点 |
| A04 | loadGrid `a04-ball.grid` | renderBall roll 按滚动距离采样 | 白圆 + 暗描边 |
| A05 | loadGrid `a05-goal-net.grid` | renderGoals 左门原图 / 右门镜像 | 门柱 1px + 网格线 |
| A06 | loadGrid `a06-kick-shot.grid`（swap=true） | renderPlayers kickAnimT 九帧链 | 占位白描边闪烁 |
| A07 | loadGrid `a07-ui-hud.grid` | renderHud 九宫格面板（比分 = 系统字体） | `PAL.panel` 矩形 + 描边 |
| A08 | `main.js` fetch `assets/out/a08-sfx-goal-hit.wav` | 进球事件即时播放（偏移 0.0s） | WebAudio 同 seed 确定性合成 |

- 回退纪律（spec el 落位双路径约定）：**任何资产加载失败（file:// CORS / 文件缺失）返回 null，
  渲染层回退程序内建占位精灵，游戏不因美术阻塞**；回退色取 manifest.style_lock 调色板（零卡外色）。
- 核查结论：A01–A08 全部接线在位、回退路径全部成立，与本表 §1「程序槽位建议」一一对应。

## 4. 体积预算

| 项 | 值 |
|---|---|
| 资产总量红线 | ≤ 1,572,864 B（1.5MB，微信主包 ≤4MB 预算内让位代码/音频） |
| 体检方式 | `gen-assets.mjs` 自动汇总（.grid 源 + PNG + WAV），超线 exit 1 |
| 当前 | 由脚本回填 `manifest.budget.assets_total_bytes`（本表不手填，避免假数） |

## 5. 待归位清单（黑板恢复后）

- [x] 本台账 + `style-card-v1.md` 挂链入 `.myrd/blackboard/assets.md`「足球线资产清单」区
  （2026-09-22 美术批次：黑板新增足球线清单区，路径/接线点/预算互链，本台账与风格卡不搬家、以链接归位）
- [x] 主策划批准结论回写黑板并同步 manifest.status / approved_by
  （manifest 侧 2026-09-12 批准当日已同步 APPROVED；黑板侧 2026-09-22 归位登记）
- [ ] 若黑板命名表与本表 id 冲突：以黑板为准，改名走一次脚本批量替换
  （黑板 `.myrd/blackboard/levels.md` 与研发空间命名表暂无冲突登记，保留本条作为哨兵）

## 6. 变更记录

- 2026-09-12 游戏美术：建台账 v1（落文待归位版，头部状态 = draft-pending-approval）。
- 2026-09-12 主策划盖章批准（spec v1.2 + 风格卡 v1 + A01–A08 规格），manifest/status 同步 APPROVED。
- 2026-09-22 游戏美术（归位 + 复验批次）：①头部与主表状态 draft → approved（依据批准记录，规格零改动）；
  ②§3.1 接线实况逐项核查落文（A01–A08 全接线 + 回退全成立）；③§5 待归位清单第 1/2 项勾销；
  ④独立复跑证据归档 `.myrd/blackboard/gate-logs/m1-reverify-20260922-104610-art/`
  （足球三件套 4/4 exit 0 + 糖果 verify/契约/fx 契约全绿 + gen-assets 预算闸门 68,496B/1.5MB 且产物字节级一致）。
