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
