# playtest 机判 round2 —— PASS（implement 节点迭代 · 2026-10-06）

- 判定器：`std-skills/godot-game-dev/scripts/playtest.sh`（仓库自带，未改动）
- 被测代码：部署分支 `myrd/games-goal-cmuw2o88z018ricryvpr6v8wn` @ `7a68d1e`
  （= 线上 AppHost v4 deployment `cmuwpdpxw004pm9lgt8rljmsz` 的同源代码，v4 running）
- 环境：本机 Godot v4.3.stable（resolve-godot.sh 解析），阈值来源 `tests/playtest.json`
- 结论：**GODOT_PLAYTEST: PASS，退出码 0**——门禁默认档与全 session 档两档全绿（可复现）

## 指标

### 门禁默认档（3 种子 × 900 帧，`report.log`）

```json
{"frames_per_run":900,"runs":[
 {"run":1,"seed":20260913,"feedback_events":71,"first_reward_seconds":0.067,"max_feedback_gap_seconds":1.317,"outcome":"score=0|fb=71"},
 {"run":2,"seed":20260914,"feedback_events":80,"first_reward_seconds":0.267,"max_feedback_gap_seconds":1.167,"outcome":"score=0|fb=80"},
 {"run":3,"seed":20260915,"feedback_events":76,"first_reward_seconds":0.017,"max_feedback_gap_seconds":0.950,"outcome":"score=0|fb=76"}],
 "thresholds":{"feedback_events_min_per_run":30,"feedback_gap_seconds_max":6,"first_reward_seconds_max":5,"seed_outcomes_min_distinct":2},
 "thresholds_source":"tests/playtest.json"}
```

### 全 session 档（3 种子 × 5400 帧 = 90s/局，`report-full-session.log`）

```json
{"frames_per_run":5400,"runs":[
 {"run":1,"seed":20260913,"feedback_events":517,"max_feedback_gap_seconds":1.317,"outcome":"score=0|fb=517"},
 {"run":2,"seed":20260914,"feedback_events":488,"max_feedback_gap_seconds":1.283,"outcome":"score=0|fb=488"},
 {"run":3,"seed":20260915,"feedback_events":518,"max_feedback_gap_seconds":0.950,"outcome":"score=0|fb=518"}],
 "thresholds_source":"tests/playtest.json"}
```

对照 round1：最长无反馈窗口 **13.2s → ≤1.32s**（约 10× 收敛），反馈密度 **6 次/局 → 71~518 次/局**，
GODOT_PLAYTEST **FAIL → PASS**。

## tests/playtest.json 标定依据（回溯 GameDesignSpec，非放宽）

| 键 | 值 | 依据 |
| --- | --- | --- |
| `frames_per_run` | 5400 | SKILL.md §4.5：60 × 单局目标秒数；本作 easy 局 90s（`start_time_easy=90`）。注意：本版 driver 对 JSON 数值按 float 解析、`is int` 检查不通过，env `GODOT_PLAYTEST_FRAMES` 优先——两档（900/5400）实测均在阈值内 |
| `first_reward_seconds_max` | 5.0 | 实测 0.02~0.43s，余量 ~10×；较内置默认 10s 更严 |
| `feedback_gap_seconds_max` | 6.0 | 实测最差 1.32s，余量 ~4.5×；较内置默认 10s 更严 |
| `feedback_events_min_per_run` | 30 | 实测 71~518；下限钉在「哑游戏」检出量级（900 帧短局实测 ~75 仍满足） |
| `seed_outcomes_min_distinct` | 2 | 开局随机发牌（`types.shuffle()` 无固定种子）= 天然重玩钩子；三局 outcome 签名实测互异 |

## round1 → round2 的修复（implement 节点迭代，commit 7a68d1e）

round1 判读的两条修复输入逐条落地：

1. **点击反馈信号接线（产品缺陷，已修）**——探针实证双重根因：
   - `board._unhandled_input` 读全局鼠标态 `get_global_mouse_position()` 而非事件自带
     position；合成 drag 流（relative ±40 随机）令引擎跟踪的鼠标位 100 帧内漂到
     (6853, 4876)（视口仅 540×960），此后所有指针点击 `cell_from_world` 恒返回界外 →
     `select_cell` 静默 return → 反馈黑洞。**修复**：改读事件 position 并经
     `get_canvas_transform().affine_inverse()` 换算世界系（headless 下根窗口 64×64 +
     stretch 变换把原始注入坐标放大 ~15×，指针路径对 bot 结构性不可达——这也说明
     bot 的可玩通道必须是动作路径）。
   - 玩家光标（confirm 动作的落点）可被方向键走出棋盘，越界后 confirm 落空——round1
     的 6 次反馈（全来自 confirm 路径）1.8s 后归零正因如此。**修复**：player.gd 新增
     `clamp_rect`，main.gd 按当前难度棋盘几何接线（内缩 1px 防 floor 落界外格）。
2. **任意点击必有可见反馈（§3B，已补）**：取消选中（二次点击同格）此前无任何反馈，
   现补 `Juice.sfx(&"confirm", -8.0)`。

## 备注（诚实记录）

- **score=0**：bot 随机游走 + 以 ~4.5 次/s 频率 confirm，配对尝试大多落在同格（deselect）
  或异型邻格（reject），且会按 R 触发重开（重发牌局）；机判协议不断言得分，故不影响判定。
  核心消除闭环另经受控探针实证：满盘 4×4 + 顶行相邻同型，纯输入路径
  （移动光标 → confirm ×2）下 `remaining 16→14、score +10、Juice 反馈齐全`（探针为临时
  场景，实证后删除未入库）。
- 部署后链路：AppHost v4 `cmuwpdpxw004pm9lgt8rljmsz` @ 7a68d1e running；
  `qa/mobile/` 已刷新为 v4 证据（round4，MOBILE_SMOKE PASS 10/10，checkedAt 2026-10-06T13:20Z）。
- 工作流正式结论：调度 API 403（权限）未补齐前，本目录 + `qa/mobile/` 为上一节点 agent
  用仓库自带门禁脚本完成的兜底机判；权限补齐后从 implement 节点补跑工作流即可复现。

## 运行日志

- 门禁默认档：`report.log`（完整 stdout/stderr，含 GODOT_PLAYTEST_METRICS 单行 JSON）
- 全 session 档：`report-full-session.log`

---

## 迭代收尾（implement 节点迭代 · 2026-10-06 13:46Z 补记）

上一轮迭代被打断在「归档未推送」状态，本轮收尾并全程实证：

1. **推送闭环**：`7a68d1e`（修复+重导出）、`62504d0`（round2 归档）已确认在 origin；
   本轮新增 `f0eb771`（冒烟断言升级，见下）一并推送。`git ls-remote` 证实分支 tip。
2. **部署核实（不再重复受理）**：AppHost v4 `cmuwpdpxw004pm9lgt8rljmsz`
   status=running @ `7a68d1e`；线上 `index.pck`（base64+gzip 解码后）sha256
   `f4365b7d…` 与本地修复后导出**逐字节一致**；`/health` 返回
   `app=game-9, title=汽车连连看`。游戏代码与分支 tip 无差异（其后两个提交只动
   qa 文档与测试），按知识库教训（同 gitRef 重复受理白烧排队）**不新建 v5**。
3. **冒烟断言升级（f0eb771）**：新增断言 11「光标钳制」（rect 接线/几何一致/
   甩出视口外被钳回/随难度更新）与断言 12「取消选中反馈」（NO_SELECTION 信号 +
   「已取消选中」文案 + Juice 事件）。负向探针证明拦截力且不误报：
   pre-fix main.gd → FAIL「clamp_rect 未接线」；去掉取消反馈两行 → FAIL「文案未变」
   「Juice.events 为空」。
4. **门禁复跑全绿**（本轮实测）：PREFLIGHT PASS（14 类）+ GODOT_SMOKE PASS（240 帧）
   + GODOT_FUZZ PASS（seed=20260913，6 批 239 帧）+ GODOT_PLAYTEST PASS
   （fb=71/80/76，最长断档 1.32s，指标与上表一致）。
5. **qa/mobile/ 证据再刷新**：MOBILE_SMOKE PASS 10/10（checkedAt 2026-10-06T13:46:36Z，
   tap 响应 pass、37fps），对象仍为 v4 线上部署。
6. **工作流迭代 API 探测（如实记录）**：`POST /api/v1/workflows/runs/:id/iterate`
   对本 agent 凭据返回 **400 VALIDATION_ERROR（缺 startNodeId）**——端点可达、
   鉴权通过，与任务所述「目标大师主体 403」不矛盾（主体不同）。正式迭代仍由
   委派方在权限补齐后补跑；本目录与 `qa/mobile/` 为可复现的兜底机判证据。

---

## 迭代 v5 收尾（deploy/playtest 节点兜底 · 2026-10-06 14:10Z）

本轮把「证据 commit = 线上部署 commit」收敛为严格相等（v4 时代只是"同源代码"）：

1. **PR#33 验收复核证据并入**：cherry-pick `1249b9b` → `97d0565`
   （`qa/ACCEPTANCE_REVIEW.md` + `qa/mobile-round3/` 10/10 PASS 证据 + blackboard），
   分支此后包含主策划复核产物；平台 auto-commit `a4edc0d` 未并入（与游戏无关）。
2. **HEAD 重导出**：`--export-release Web`，`index.wasm` 与 7a68d1e **字节一致**
   （35,376,909 B），`index.pck` 3,968,912 B（并入的 round3 证据图被工程资源带入），
   `index.html` 仅 fileSizes 更新 —— 提交 `2626927`。
3. **v5 部署**：`cmuwqrrl70051m9lgj8v89gh9`，受理 POST 返回 504（网关超时），
   **按知识库教训先查列表**：已受理 building，未重复提交；~6 min 后 running @
   `2626927b`，gitRef=goal 分支，sourceId=goal id。
4. **门禁四连绿（本轮实测，HEAD=2626927）**：PREFLIGHT PASS（14 类）+
   GODOT_SMOKE PASS（240 帧）+ GODOT_FUZZ PASS（seed=20260913，6 批 239 帧）+
   GODOT_PLAYTEST PASS 两档全绿 —— 默认档 900 帧 fb=75/73/76；全 session 档
   5400 帧 fb=517/495/518（`report.log` / `report-full-session.log` 为本轮日志）。
5. **移动门禁刷新到 v5**：MOBILE_SMOKE **PASS 10/10**（checkedAt 2026-10-06T14:10:14Z，
   tapDiff=320 / idleDiff=338 / 37fps / 音频解锁器在位 / 无横向溢出），
   证据 `qa/mobile/`（report.json + phase-* + diag-*）。
6. **环境插曲（如实记录）**：v5 切 running 后公网入口 TLS 握手即断
   （SSL_ERROR_SYSCALL，基础域同挂）—— 根因是本机 **Tailscale 已停止**，
   `tailscale up` 拉起后恢复 200；与部署本身无关。
7. 工作流正式迭代结论仍待调度 API 权限补齐后补跑（本目录与 `qa/mobile/` 为
   可复现兜底机判；判定脚本全部取自仓库 `std-skills/godot-game-dev/scripts/`）。

---

## playtest 节点复跑（本轨迹 · run cmuwnz5e0004im9lgb8z163z4 · 2026-10-06 14:2xZ）

playtest 节点 agent 独立复跑全链门禁，被测代码 = 分支 tip `c1106d7`
（游戏代码与 `2626927` 无差异——其后提交只动 qa 文档；线上即 AppHost v5
`cmuwqrrl70051m9lgj8v89gh9` 的构建源）。判定脚本全部取自仓库
`std-skills/godot-game-dev/scripts/`，未改动任何判定器：

| 门禁 | 命令（routines.yaml 同参） | 结果 |
| --- | --- | --- |
| preflight | `python3 …/preflight.py games/game-9` | **PASS 14 类**（EXIT 0） |
| headless-smoke | `GODOT_SMOKE_FRAMES=240 …/smoke.sh games/game-9` | **PASS 240 帧**（EXIT 0） |
| input-fuzz | `…/input-fuzz.sh games/game-9` | **PASS** seed=20260913，6 批 239 帧（EXIT 0） |
| playtest 默认档 | `…/playtest.sh games/game-9` | **GODOT_PLAYTEST: PASS**（EXIT 0）fb=75/80/76 |
| playtest 全 session 档 | `GODOT_PLAYTEST_FRAMES=5400 …/playtest.sh …` | **GODOT_PLAYTEST: PASS**（EXIT 0）fb=517/483/518 |
| mobile-web-smoke（preHook） | `…/mobile-web-smoke.mjs --url <liveUrl> --out games/game-9/qa/mobile` | **PASS 10/10**（checkedAt 2026-10-06T14:19:33Z，tapDiff=320，37fps） |

- `report.log` / `report-full-session.log` 已由本轮两档实跑刷新（单行 METRICS + 判定行）。
- 机判口径不变：GODOT_PLAYTEST 只判「节奏代理指标下限」（首次奖励/无反馈窗口/反馈密度/
  局间方差），**「好不好玩」仍留给人** —— `qa/playtest-kit.md` 量表保持「待用户试玩」。
