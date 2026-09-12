# 《Soccer》v2 迭代部署记录（音效 + 触摸操作）

> 角色：发布 agent · 日期：2026-09-12 · 结论：**已部署（v2 在役）**
> liveUrl <https://leomac-studio.tail49399e.ts.net/apps/soccer/>
> 部署：`cmtxymgm8000xm9bie2w3v3jo` · mode=bundle · gitRef `myrd/games-goal-cmtx73f9v0005m9zbikqyadww`
> 分支头：`98a5696e`（远端与本地一致）· 需求：cmtxva7ce000cm9birar86be2（音效 + 触摸操作 v2）

## 1. 门禁（本地自检，与 godot-smoke 门禁同源）

| 步骤 | 命令 | 结果 |
|---|---|---|
| 解析引擎 | `resolve-godot.sh` | Godot 4.6.1.stable.official.14d19694e |
| 前置检查 | `preflight.py games/soccer` | `PREFLIGHT: PASS`（13 类全过，81 工程文件）exit 0 |
| 冒烟 | `GODOT_SMOKE_FRAMES=240 smoke.sh games/soccer` | `godot-smoke: PASS`（断言标记齐全）exit 0，`SCRIPT ERROR` 计数 = 0 |

v2 新增断言（音效解锁/静音、触摸动作注入）已包含在 tests/smoke.tscn 断言集内（负例探针实测见提交 `98a5696e`）。

## 2. v2 变更内容（提交 `f980b4e2`）

- **AudioManager**（`autoload/audio_manager.gd`，172 行，autoload 已接线）：
  踢球/传球/抢断/哨声（开球·中场·终场）/进球/人群氛围（欢呼+环境）共 10 个 WAV（合计 ≈480KB，远低于 5MB 预算）；
  浏览器自动播放策略合规：`unlocked=false` 起步，首次交互（点击/按键/触摸）`unlock_audio()` 解锁，解锁前静默不报错不阻塞；
  静音开关走 `AudioServer` Master bus mute，`set_muted` 立即生效，`unlocked_changed`/`mute_changed` 信号供 HUD。
- **TouchControls**（`scenes/touch_controls.tscn` + `scripts/touch_controls.gd`）：
  只认 `InputEventScreenTouch`/`InputEventScreenDrag`；左侧虚拟摇杆（方向+幅度调速，拖动跟随）；
  右侧射门/传球/切换按钮，经 `Input.action_press(action, strength)` 注入与键盘同一 InputMap 动作
  （move_up/down/left/right、shoot、pass、switch），Footballer 的 `Input.get_vector` 零改动；手指停住时保持 `action_press` 状态防丢输出。
- 导出预设不变：Web / `web_nothreads` / `variant/thread_support=false` / `canvas_resize_policy=2` / `export_path=export/web/index.html`。

## 3. 线上产物逐字节核验（部署后实测，非推断）

| 资产 | 通道 | 实测 | 与 HEAD 产物比对 |
|---|---|---|---|
| index.pck | gzip+b64 → decode → gunzip | 2,848,420 B，魔数 `GDPC` | **一致**（v1 为 2,505,024 B，差值即音频素材） |
| index.wasm | gzip+b64 → decode → gunzip | 37,685,705 B，魔数 `\0asm` | **一致**，SHA256 `99962b29…ff1d4f` 两侧相同 |
| index.js | raw | 315,759 B，`text/javascript` | **一致** |
| /health | — | 200 `{"ok":true,"app":"soccer"}` | — |
| /（壳页） | 308→200 | title「Soccer · 11 人制足球」，相对路径资产引用 ×3 | — |
| /api/public/info | — | `assetStore:true` | — |

资产链路结论：wasm/pck 经平台 gzip 存对象存储、实例 `getAsset` 懒加载、`gzip+b64` 文本回传（M1 网关无二进制透传）全链路验证通过；
壳页资源全部相对路径（`api/public/assets/...`），网关子路径 `/apps/soccer` 下解析正确。

## 4. 冒烟结论

- 门禁三连（resolve-godot → preflight → smoke 240 帧）全绿，v2 断言（音频解锁/静音、触摸注入）在断言集内；
- 线上三资产与本地 HEAD 导出产物逐字节一致 → 本次部署伺服的确为 v2 bundle（非 v1 残留）；
- v1 已验收的 22 人同屏 / 跑步动画 / 键位矩阵 / 比赛流程由既有冒烟断言回归钉死（含角球/球门球/界外球规则断言，未回退）。

## 5. 已知环境说明

Godot 4 Web 硬依赖 WebGL2：纯软渲染 headless 环境引擎可启动但画布无输出（v1 QA 已记录，消费级带 GPU 浏览器不受影响）。
