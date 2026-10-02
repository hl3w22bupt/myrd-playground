# QA 记录：加速降晃 + 终局单晃 验收与部署证据（2026-10-02）

需求：cmuqk2zhg0018m9bf4er5mxoy（加速特效大幅降晃；game over 单次晃动后完全静止）
分支：`myrd/game-10-goal-cmuqjy7dk000mm9bf5jef68ay`（部署 commit `918fcaa`）

## 1. 门禁（判定器唯一来源：仓库内 std-skills/godot-game-dev/scripts/）

| 步骤 | 结果 |
|---|---|
| preflight.py | PASS（39 个工程文件，13 类检查） |
| smoke.sh（240 帧） | PASS（退出码 0，断言标记齐全，日志无脚本错误） |
| input-fuzz.sh | PASS（seed=20260913 batches=6 total_frames=239） |
| playtest.sh | 未跑 —— 仓库 `std-skills/godot-game-dev/scripts/` 无此文件，
  `.myrd/routines.yaml` 的 godot-smoke 亦不含该步；按「不得自造判定器」约束未补写。 |

## 2. 验收标准 → 机判实测（smoke.gd 无头实测，GODOT_SMOKE: PASS 行原文）

> 加速晃动峰值 1.20px（基线 6.0px，实测降 80%）、过零 10 次；终局单晃 2 次、
> 峰值 5.83px、静止 35 tick（3.5 游戏秒）零残余

| 验收项 | 口径 | 实测 | 结论 |
|---|---|---|---|
| 1. 加速降晃 ≥50%，特效 ≥10s | 幅度 1.2px / 频率 5Hz vs 基线 6.0px / 12Hz；ACCEL_DURATION_S=10 | 实测峰值 1.20px，**降 80%**；过零 10 次/秒 ≈ 5Hz | ✅ |
| 2. game over 精确 1 晃 + 静止 | 计数恰 +1；结束后逐帧 offset==ZERO | 每局计数 +1（两局累计 2）；**3.5 游戏秒零残余**（要求 ≥3s） | ✅ |
| 3. 加速中 game over 无叠加 | 微抖先关（rumble_active=false）再单晃；峰值 ≤ 配置幅度 | 峰值 5.83px ≤ 7.0px 配置上限；观测窗内 rumble 已关 | ✅ |
| 4. 参数集中配置 | `GameState.SHAKE_CONFIG` 唯一参数源，`shake_params()` 唯一取参入口 | 业务代码零晃动魔数；preflight + 冒烟双断言 | ✅ |
| 5. 核心流程回归 | 开局→加速→game over→重开 | 冒烟全链路断言通过，无脚本错误 | ✅ |

真机体感口径（头晕 / 结束感）属人工试玩项，本记录只承载无头可判定代理指标。

## 3. 部署证据

- 部署：`POST /api/v1/apphost/apps/cmuqjy4va000km9bfgc87bkgy/deployments`
  `{mode:"bundle", gitRef:"myrd/game-10-goal-cmuqjy7dk000mm9bf5jef68ay"}` → status **running**
- liveUrl：`https://leomac-studio.tail49399e.ts.net/apps/game-10/`
- 探活：`/health` 200；`api/public/assets/index.js` 200（331495 字节 = 本地导出同值）；
  `index.pck.gz.b64` / `index.wasm.gz.b64` 200 text/plain
- **产物一致性**：线上 pck 解 base64+gzip 后 sha256 `978c8e8253b4493420c87ed2c0161d71039e98d86744082c96ce2e681f7a1c8c`
  == 本地 `games/game-10/export/web/index.pck`（2489776 字节，逐字节一致）

## 4. 部署链路备注（后续节点复用）

- `games/game-10/export/web/` 是 AppHost `assets_dir` 构建输入，必须入库（`.gitignore` 已放行）。
- 导出前先 `mkdir -p export/web`：Godot 不自建目标目录，缺目录报「目标文件夹不存在或无法访问」。
- 平台 `POST .../deployments` 可能回 504（同步响应被网关掐断），部署仍在服务端启动 ——
  先 GET 应用查 deployments 再决定是否重试，**不要盲目重发**（会造出重复构建）。

---

# 发布节点复验与调参桥接通（2026-10-02 第二轮）

## 1. 门禁复跑（两轮，判定器仍只来自仓库内 std-skills/godot-game-dev/scripts/）

| 轮次 | preflight | smoke（240 帧） | fuzz |
|---|---|---|---|
| HEAD `ad61b92`（复验前次修复） | PASS（43 文件） | PASS（退出码 0，断言标记齐全） | PASS（seed=20260913） |
| HEAD `0b5f4bd`（调参桥落地后） | PASS（43 文件） | PASS（含新增 `_check_tuning_bridge` 断言） | PASS（seed=20260913） |

注：冒烟的 `GODOT_SMOKE: PASS` 标记写在脚本内部 mktemp 日志里（trap 删除），stdout 只出
`godot-smoke: PASS` 摘要行 —— 退出码 0 + 「断言标记齐全」即脚本已核过标记，无需自跑 godot 替代判定。

## 2. 本轮新增改动（发布节点职责内，非晃动逻辑变更）

- **调参桥接通**（此前壳与游戏两侧都缺失，违反 §3C 硬契约）：
  - 游戏侧 `GameState`：`TUNING_META` 只暴露晃动 5 键，钳制上界 = 验收上界（加速 ≤3.0px / ≤6Hz、
    终局 ≤0.5s）—— 调参桥覆盖写不出破坏验收标准的值；`apply_tuning` / `clear_tuning` 唯一入口；
    `shake_params` 返回「默认 + 运行期覆盖」副本，`SHAKE_CONFIG` 常量不被改写。
  - 壳侧：引擎加载前解析 URL `?tuning=<JSON>` → `window.__GAME_TUNING__`（非法 JSON 静默忽略）。
  - 冒烟断言覆盖桌面可机判的一半：白名单/类型过滤、钳到上界、未覆盖键不动、常量不可变、复位。
- **壳页模板残留清理**：落地页标题/副标题/按键提示原是上一款游戏（糖果粉碎）文案；`/health`
  的 `app` 字段、server 包名、`[candy-shell]` 日志标签同源残留 → 全部改为本游戏（`game-10`）。

## 3. 本轮部署证据（deployment `cmuqluevu001gm9bx9i2ndqb3`）

- gitRef `myrd/game-10-goal-cmuqjy7dk000mm9bf5jef68ay`，commit `0b5f4bd`，deployedBy=workflow，
  triggeredById=sourceId=`cmuqjy7dk000mm9bf5jef68ay`（应用专属绑定）→ status **running**
- `/health` 200 `{"ok":true,"app":"game-10",...}`；`/` 200（12167B，title=复现天天酷跑，
  含 `__GAME_TUNING__` 与 `__audioDebug`，资产走相对路径 `api/public/assets/*`，candy 残留 0 处）
- 一致性：线上 `index.js` sha256 `8b649683…` == 本地导出；线上 pck（b64+gzip 还原）
  sha256 `62ed35a4…` == 本地 `export/web/index.pck`（2507360B）；`index.wasm.gz.b64` 200 text/plain
- 待验（外部依赖）：调参桥 web 半程（`JavaScriptBridge.eval` 读 `__GAME_TUNING__`）与移动端音效
  需真机/浏览器实测；桌面与无头无法覆盖。晃动手感的「不头晕 / 结束感干脆」仍以主人试玩为准。
