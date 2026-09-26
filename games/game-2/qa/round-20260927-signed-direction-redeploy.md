# QA 轮次记录 · 有符号方向断言确认 + HEAD 重部署（2026-09-27）

## 本轮范围
1. **implement**：确认 `tests/smoke.gd` 移动相位为有符号方向断言形态（上一轮 4f7dc69 已落地，本轮复核）：
   - `move_right` 10 帧 → 断言 `Δx ≥ +MIN_MOVE_DISTANCE(1px)` 且 `|Δy| ≤ 64px`（smoke.gd `_end_move_phase_begin_left_phase`）；
   - `move_left` 10 帧（反向相位）→ 断言 `Δx ≤ −1px` 且纵向同上界（`_begin_left_move_phase` / `_end_left_phase_begin_collect`）。
   无向 `distance_to` 断言在输入映射镜像（按右往左走）下照样全绿；有符号轴分量断言可识破该缺陷。
2. **deploy**：从分支 HEAD（4f7dc69）重新 Godot Web 导出并部署 AppHost。
3. **playtest**：见下方 blocked。

## 门禁结果（与门禁同源判定脚本，仓库内 std-skills/godot-game-dev/scripts/）
| 步骤 | 判定脚本 | 结果 |
|---|---|---|
| Godot 解析 | resolve-godot.sh | ✅ Godot 4.3.stable.official.77dcf97d8 |
| 前置一致性 | preflight.py | ✅ `PREFLIGHT: PASS`（13 类检查 / 50 文件） |
| 无头冒烟 | smoke.sh（240 帧） | ✅ `godot-smoke: PASS`（退出码 0；含 move_right ≥ +1px 与 move_left ≤ −1px 有符号断言） |
| 输入 fuzz | input-fuzz.sh | ✅ `GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239` |
| 机器人试玩 | playtest.sh | ⛔ **blocked：模板仓库未预置** `std-skills/godot-game-dev/scripts/playtest.sh` |

## playtest blocked 说明（按硬约束上报，不现场自造判定器）
- 判定脚本权威来源 = 项目仓库内 `std-skills/godot-game-dev/scripts/`；其中 **playtest.sh 缺失**
  （`.myrd-platform/.claude/skills/godot-game-dev/scripts/playtest.sh` 是平台注入的阅读副本，不得当判定来源）。
- 请运维把模板仓库补上 `playtest.sh`（可参照注入副本）后重跑：
  `GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" bash std-skills/godot-game-dev/scripts/playtest.sh games/game-2`

## Web 导出（HEAD 4f7dc69）
- 流程：`godot --headless --path games/game-2 --import` → `--export-release "Web" export/web/index.html`（均退出码 0）。
- 产物：index.html / index.js / index.pck(2.5MB) / index.wasm(35.4MB 原始，gzip+b64 走对象存储) / worklet / 图标，与入库版本逐字节一致（确定性导出）。

## 部署（AppHost cmuiepuda001xm9gyecrisk7n · slug game-2）
- deployment id：**cmuilrr0u009ym9gcnlam99c7**（version 7，commit 4f7dc69，gitRef=myrd/games-goal-cmuiepudc001zm9gyyzqgztta，sourceId=cmuiepudc001zm9gyyzqgztta）
- 状态：**running**；v6 为同内容重复触发、已被 superseded（首次 POST 504 超时但实际受理所致）。
- 公网入口：`/apps/game-2` 与 `/apps/game-2/gw` 均 200。

## 冒烟自测结论（公网入口）
| 检查 | 结果 |
|---|---|
| `GET /apps/game-2/health` | ✅ 200 `{"ok":true,"app":"star-dust-collector","assets":"lazy/object-storage"}` |
| `GET /apps/game-2/`、`/apps/game-2/gw` | ✅ 200 壳页（音频手势解锁 + 调参桥 + 相对路径资产加载在位） |
| 资产 `index.js` | ✅ 200 text/javascript 331495B |
| 资产 `index.pck.gz.b64` | ✅ 200 text/plain 3340912B（base64，DecompressionStream 解压） |
| 资产 `index.wasm.gz.b64` | ✅ 200 text/plain 10696408B（base64 文本通道，规避网关 502 UNSUPPORTED_BINARY） |
| 资产 `index.audio.worklet.js` | ✅ 200 text/javascript 7298B |

结论：核心链路（壳页 → 相对路径拉 base64 资产 → 解压实例化 wasm → 引擎加载 pck）全通；
移动方向语义由门禁有符号断言机判通过；playtest 依赖的判定脚本待运维补齐后单独复跑。
