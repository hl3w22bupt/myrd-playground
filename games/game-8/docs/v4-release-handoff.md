# 《牛牛打游戏》game-8 · v4 体验重做 发布交接（部署上线 + 门禁全绿证据）

> **发布日期**：2026-10-14 ｜ **执行**：工作流主通道（scaffold→implement→deploy→playtest）本轮节点
> **需求绑定**：v4 需求 `cmv7hnfx3000ojofistqwry8l` × 策划案 v3 approved（GameDesignSpec `cmv7i4txk000zjofi5vrdcrvk`）
> **本文定位**：v4 的部署元数据落账与门禁证据索引。上一轮工作流 run 被取消导致 playtest 缺失，本轮已闭环。

## 一、部署元数据（artifacts 口径）

| 项 | 值 |
|---|---|
| HostedApp | `cmujpmjsy006pm99ip9yws3wl`（slug `game-8`，name 牛牛打游戏） |
| deployment id | **`cmv7kzwbl001yjofids0eyoc0`**（status=running，mode=bundle） |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/game-8/ |
| 部署 gitRef | `myrd/game-8-goal-cmujpml1e006rm99i9hc33huu` @ `f6e4443`（未落 main ✓） |
| artifacts 回写 | 部署 POST 带 `goalId=cmujpml1e006rm99i9hc33huu` 自动写入 goal artifacts：`cmv7kzwbl001yjofids0eyoc0 | playable | completed | 可玩：牛牛打游戏`（REST/open API 的显式 artifacts 写入对本轮身份 404/405，与往轮口径一致） |
| 冗余部署 | 3 条 superseded（`cmv7kwz76`/`cmv7kxt4f`/`cmv7kyt1w`，同 commit 同 gitRef，POST 网关 504 但服务端已受理所致，无害） |

## 二、门禁证据链（全绿）

| # | 门禁 | 结果 | 证据 |
|---|---|---|---|
| 1 | preflight（仓库判定脚本） | PASS | 15 类前置一致性检查 × 69 工程文件，exit 0（含 P13b 实测拦截 🏆 emoji 缺字风险后修复） |
| 2 | smoke（仓库判定脚本） | PASS | 320 帧预算（工程基线，v3 交接文档已论证 240 不足非缺陷），exit 0 + 零 SCRIPT ERROR + 断言标记齐全 |
| 3 | input-fuzz | PASS | seed=20260913，6 批次 239 帧，exit 0 |
| 4 | playtest（机器人试玩，上轮缺失本轮闭环） | PASS | 3 种子 × 3600 帧（=60s 单局口径，tests/playtest.json 落账），fb=243/249/247，无反馈窗口 ≤2.1s，run2 机器人真实收集 score=3 |
| 5 | 产物自跑冒烟 | PASS | `godot --headless --main-pack export/web/index.pck --quit-after 320 res://tests/smoke.tscn` → exit 0 + `GODOT_SMOKE: PASS` |
| 6 | 线上资产一致性 | 一致 | 线上 `index.pck` sha256 `6ed6411f83547e5c05112231fea6f4345c9f7d77dabba275de27bbc8219f04dc` = 本地 v4 导出（2,641,072B，逐字节无版本漂移） |
| 7 | **线上 pck 自跑门禁（最高等级）** | PASS | 拉线上 pck → 本地引擎 `--quit-after 320` 跑冒烟 → exit 0 + `GODOT_SMOKE: PASS` + 零 SCRIPT ERROR |
| 8 | mobile-web-smoke（线上移动仿真） | PASS | 10 项全绿（网络/console 零错误/渲染/帧差/触摸管线/音频契约/视口/FPS），证据 `games/game-8/qa/mobile/` |
| 9 | 壳页契约 | 在位 | `__GAME_TUNING__`×2 / `__audioDebug` / 资产相对路径 + v4 触控卫生（gesturestart/dblclick preventDefault、touch-callout/overscroll）实测在壳页 |

## 三、v4 落账范围（实现 commit `ac2edd5`，导出 `f6e4443`）

- **②画面**：牛牛多帧动画 3 组 8 帧（idle×2 / move×4 / collect×2，SVG 帧入库 `assets/sprites/cow/`）+ 动画状态机（位移切换/面朝翻转/收集庆祝）；UI 主题对齐风格卡（#2c3e50 底 / #2ecc71 描边 / #f39c12 强调 / 圆角 24）
- **③操控**：`restart=R` 键入 InputMap（键位契约逐键 AND 同步）；壳页触控卫生（iOS 捏合/双击缩放/长按选中全防）
- **④反馈**：五类事件映射补全（收集/连击里程碑/道具/波次/胜负）+ Camera2D 落位使震屏真实生效 + 暂停/恢复/确认 UI 双音；结算页重做（新纪录金色高亮 + 一键重开按钮/R 双入口 + 返回合集入口）
- **①玩法深度**：v3 结构保留（5 类目标物 / 磁铁+加速 / Combo / 3 波次），零回退

## 四、遗留与等待项（不阻塞本轮）

1. **iOS Safari 真机音效实测**（D1，责任方：用户/环境）：桌面仿真通过 ≠ 移动端出声，历史双重踩坑区；恢复后按收口清单 §3.1 取证。
2. **真人试玩结论与调参 URL 回填**（D3，责任方：用户）：线上 `?tuning=1` 入口可用；结论回写经策划案 revisions（禁止散点改代码对数值）。
3. **goal artifacts 显式 report 条目**：REST/open 写入对 agent 身份 404/405，部署自动 playable 条目已承载；如需明细条目请由有权限方按 §一 表补写。

## 五、input-fuzz 门禁复现排查记录（2026-10-14，供门禁侧对照）

- **现象**：门禁 runner 侧 input-fuzz 退出码 1（反馈无明细）；本机同命令多次复跑 PASS。
- **排查矩阵（全部 PASS，零 SCRIPT ERROR）**：同工作区 ×30+ 连跑（含 20 次连续循环）；10 个独立种子（1/7/42/99/12345/20260914/20260915/555555/88888888/31415926）；`taskpolicy -c background` 慢机模拟；origin 分支 fresh clone 冷缓存；Godot 4.3 与 4.6.1 双引擎；`override.cfg` 扫频 application/run/max_fps ∈ {5,10,15,30,45,60,90,120,240,1000}（系统性扫过事件帧/物理 tick 交错空间）；串行全电池 ×2（preflight+smoke@240+fuzz）。
- **结论**：当前 HEAD（67059d5）在本机全部可复现维度下无缺陷迹象；门禁侧失败为环境性瞬态（runner 负载/执行时点工作区状态）的可能性最高。门禁日志在本机 user://logs 无对应记录（Godot 日志落盘证明门禁 runner 在另一宿主），失败明细需门禁侧提供（input-fuzz.sh 失败时本会打印 `godot-fuzz: FAIL <原因>` + 日志末尾 20 行，可作为索取模板）。
- **精确根因（见 commit `c6f3ae9`，并行实例的独立诊断，与本矩阵互证）**：共享工作区并发伪失败——门禁例程与 agent 实例同 Workspace 执行，input-fuzz.sh 的暂存路径 `tests/.fuzz/` 为共享可变路径（rm -rf + 重暂存），并发时一方清理拆掉另一方正在加载的驱动场景，精确产出「Cannot open res://tests/.fuzz/fuzz_driver.tscn → 退出码 1」。加固：暂存目录入 .gitignore（瞬态残留永不入库）；处置约定：例程运行窗口内不对同一工程并发跑引擎命令。

## 六、工作流主通道重跑（2026-10-14 下午）：playtest 门禁结构性补齐 + 全链路复跑

> **本轮定位**：v4 需求 `cmv7hnfx3000ojofistqwry8l` × 策划案 v3 approved（`cmv7i4txk000zjofi5vrdcrvk`）绑定下的 implement 节点复跑。v4 实现零改动（`f6e4443..HEAD` 玩法代码零差异，见 §六.3），本轮产出是**门禁配置的结构性修复**与**全链路一手复跑证据**。

### 6.1 「playtest 缺失」的结构性根因与修复

- **根因**：`.myrd/routines.yaml` 的 `godot-smoke` routine 缺 `playtest` 步（对照权威模板 `std-skills/godot-game-dev/references/godot-smoke-routine.md`，标准步序为 availability → preflight → headless-smoke → input-fuzz → **playtest**）。工作流 preHook 挂的是 `godot-smoke`，routine 里没有的步门禁永远不会跑——上轮「节点被取消导致 playtest 缺失」除取消外，即使不取消 preHook 也只会跑四步。
- **修复（照抄模板，非自造）**：按模板补 `playtestFrames` 参数与 `playtest` 步（`GODOT_PLAYTEST_FRAMES={{playtestFrames}}`，timeout 600），`playtestFrames: "3600"` = 模板红线「≈ 60 × spec.content.sessionSeconds」= 60 × 60s 单局口径。此后每轮 preHook 都会机判 playtest，不再依赖节点存活。

### 6.2 `tests/playtest.json` 的 `frames_per_run` 是死配置（模板侧缺陷，工程侧已绕行）

- **一手实测**：`playtest_driver.gd` 的 `_load_config()` 用 `config.get("frames_per_run") is int` 判型，而 Godot 4.3 的 `JSON.parse_string` 对一切数字返回 **float**（本机实测 `3600` → `typeof=3(TYPE_FLOAT)`、`is int=false`）——该分支恒假，json 的 3600 从不生效，driver 恒用默认 900（15s/局）。§二.4 的「3600 帧」实测值为当时显式传 `GODOT_PLAYTEST_FRAMES=3600` 所致，json 本身从未驱动过局时长。
- **口径**：判定脚本（仓库 std-skills）不得改写 → 工程侧唯一合规通道是 env 显式传入，本轮已固化进 routine 的 `playtestFrames` 参数。阈值（`thresholds` 键）不受此缺陷影响（赋值路径只查键名不判 `is int`），json 里的阈值覆盖仍然有效。
- **模板侧待修**（供技能包维护方认领，工程不代修）：`playtest_driver.gd` 应以 `int(config.get("frames_per_run", 0))` 或显式 float 转换判型。

### 6.3 本轮全链路复跑证据（2026-10-14，与 routine 同源命令）

| # | 门禁 | 结果 | 一手证据 |
|---|---|---|---|
| 1 | preflight | PASS | 15 类 × 81 工程文件，exit 0 |
| 2 | smoke @240 帧 | PASS | exit 0 + `GODOT_SMOKE: PASS` + 零 SCRIPT ERROR（冒烟套件 67059d5 后实测 ~200 帧，240 兜底内完整跑完） |
| 3 | smoke @320 帧（routine 默认 = verify.sh 同值） | PASS | exit 0 + `GODOT_SMOKE: PASS` |
| 4 | input-fuzz | PASS | seed=20260913，6 批次 239 帧，exit 0 |
| 5 | **playtest @3600 帧（本轮核心）** | PASS | 3 局 fb=185/222/217，无反馈窗口 ≤2.83s，run3 机器人真实收集 score=2（`GODOT_PLAYTEST_METRICS` 单行 JSON 在门禁日志） |
| 6 | 线上资产一致性 | 一致 | 线上 pck sha256 复核 = `6ed6411f…9f04dc`（2,641,072B，与 `f6e4443` 导出逐字节一致，无版本漂移） |
| 7 | **线上 pck 自跑冒烟（最高等级）** | PASS | 线上拉回 pck → 本机引擎 `--quit-after 320` → exit 0 + `GODOT_SMOKE: PASS` + 零 SCRIPT ERROR，签名含方向符号/v2手感/v3扩展全部断言 |

- **部署处置**：`f6e4443..HEAD` 仅 docs / qa 证据 / `.uid` 元数据 / `tests/smoke.gd`（测试套件），**玩法代码零差异** → 线上 version `cmv7kzwbl001yjofids0eyoc0` 对玩法而言仍是 HEAD，**不重部署**（避免门禁经验 v3 已实证的「504 冗余部署」反模式）。若后续轮次改动 `scripts/`、`autoload/`、`scenes/` 或壳页，须重导出 + 重部署并回写新 deployment id。
- **artifacts 回写口径**：HostedApp `cmujpmjsy006pm99ip9yws3wl`、deployment `cmv7kzwbl001yjofids0eyoc0`、liveUrl `https://leomac-studio.tail49399e.ts.net/apps/game-8/` 三要素已落本文 §一；goal artifacts 的 playable 条目由部署 POST（带 goalId）自动承载（REST 显式写入对本身份 404/405，同 §四.3 口径）。

### 6.4 playtest 指标语义的如实说明（不遮掩，供后续轮次对照）

- `first_reward_seconds`（本轮实测 0.083/0.3s）由 `GameState.reset()/start_run()` 的 `score_changed.emit(0)` 触发，**不是机器人真实收集**；真实收集只体现在 `outcome` 的 `score=` 字段（本轮 run3=2，其余局 0——随机游走 bot 在 60s 内收不到是 bot 能力边界，非玩法缺陷：确定性收集正确性由 smoke 的「50 连击一致性」阶段机判）。此语义为 `game_state.gd` 模板协议注释明示的既有设计（`games/game` 参照工程在 `advance_level` 同样发归零信号）；如实落账，不改判定脚本、不放松阈值、也不为「好看」的 first_reward 数字去改玩法。
- 局间结果签名（score|fb 组合）3 局互不相同，`seed_outcomes_min_distinct=1`（默认只记录）下无重玩性硬判风险。
