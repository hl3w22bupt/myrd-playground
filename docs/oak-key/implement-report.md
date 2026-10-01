# oak-key 实现节点交接报告（implement）

- 日期：2026-10-02 · 节点：scaffold→implement→deploy→playtest 全流程之 implement
- 工程落位：`games/oak-key`（Godot 4.3，未迁移未改名；改动全部在本目录内，未触碰三样例工程）
- 分支：本节点提交在 `myrd/oak-key-goal-cmupsfn0q001um9dhlko9t5e0`，
  并同步推送到任务指定的部署 gitRef `myrd/games-goal-cmupsfn0q001um9dhlko9t5e0`
  （两分支同源同提交；部署用后者，绝不用 main）。
- 基线：scaffold 节点交付的单波最小闭环（preflight/smoke/fuzz 三绿）。

## 本节点做了什么

### 1. 玩法升级：单波最小闭环 → 三波难度梯度的取证收集

- **核心循环可反复玩**：拾取 `OA→K7→42` → 探测 → 过波 +100 分（含剩余时间奖励）→ 片段重新布点；
  3 波全过 = 胜利结算；`R`/触摸「重开」随时重开一局（胜利/失败面板均可重开）。
- **难度有梯度**（`game_state.gd::WAVES`，冒烟机判递增/递减不变式）：
  第 1 波 25s/1 个静止伪造片段 → 第 2 波 20s/2 个巡逻伪造片段 → 第 3 波 15s/3 个更快巡逻伪造片段。
- **失败与胜利反馈明确**：探测无效 → 闪红 + 音效 + 信度 -1（已拾片段保留可重试）；
  超时 → 震动 + 音效 + 信度 -1 + 本波重铺（拾取进度清零、分数保留）；
  信度归零 → 失败结算；三波全过 → 胜利结算（面板含到达波次/总分/探测次数统计 + 取证标记指引）。
- **UI 按场景组织规范挂独立 CanvasLayer**：`UI` 层 = HudLabel（操作提示）+ StatusLabel（波次/倒计时/信度●○/分数，每物理帧刷新）
  + KeyLabel（组装进度 + 目标顺序）+ ResultPanel（探测/超时反馈）+ SettlementPanel（终局结算）；
  `TouchUI` 层（layer=10）触摸摇杆 + 探测/重开按钮不变。
- **取证标记（验收标准 3）**：保留并增强 —— 日志行
  `OAK_KEY_PROBE oak_key_probe=valid|invalid probe_count=N wave=N/3 fragments=K/3 decoy=bool credibility=N key=... reason=...`
  + 存档 `user://oak_key_probe.json`（新增 wave / credibility_after 字段）。

### 2. 补齐模板协议（SKILL §3B/§3C，模板 CLAUDE.md 固定接线，脚手架缺失）

- `autoload/juice.gd`（Juice 反馈单例）：所有结果性事件挂反馈 —— 拾取=pop+score 音效、
  有效=confirm 音效、无效=fail 音效+闪红、超时=hit 音效+震动、结算=pop+音效；注册进 `[autoload]`。
- 程序化音效资产：`assets/sfx/{score,confirm,hit,fail}.wav`（含 .import）+ `tools/gen_sfx.gd`
  + `tests/sfx-recipes.json`，随模板整体移植，`Juice.SFX_BANK` 已注册。
- 调参工作台：`game_state.gd` 调参区（`move_speed`/`wave_time_scale`/`decoy_speed`/`probe_credits`
  + `TUNING_META` + `apply_tuning` + `__GAME_TUNING__` web 桥）+ `scripts/tuning_panel.gd`
  （网页 `?tuning=` 即时生效，桌面/无头零成本）；`wave_time_scale` 应用时即时重推当前波剩余时限。
- `player.gd` 改读 `GameState.move_speed`（消除散落魔数）。

### 3. 冒烟断言同步升级（tests/smoke.gd，229 物理帧 / 预算 240）

静态：键位契约（逐键 AND）+ autoload 信号（新增 wave_changed/credibility_changed/run_finished）
+ 难度梯度不变式（3 波、伪造片段数逐波递增、时限逐波递减）+ 调参协议（应用/拒绝未知键/max 钳制/恢复原状）。
行为（相位机）：噪声相位（对抗输入，结束后重开净局）→ 超时路径（`wave_time_scale=0.05` 驱动
计时归零 → 信度 3→2 + 片段重铺）→ 三波路线拾取（每波 3 段 × 11 帧 = 40.3px，拾取包络 28px 推导见文件头）
+ 有效探测/过波/「有效」反馈断言 → 胜利结算 → 重开复位 → 连续三次空手探测（信度 2→1→0）→ 失败结算
→ Juice.events 非空。路线帧数推导：220px/s ÷ 60Hz = 3.667px/帧；布点间距 41px 与包络 28px 的
关系已写进注释并经 229 帧实测闭环。

### 4. 实测修复的缺陷（均由升级后的冒烟抓出）

1. **噪声相位从未注入**（脚手架遗留）：`_inject_noise_frame()` 只有定义没有调用 —— 已接入 NOISE 相位。
2. **超时重铺不拾取进度残留**：Main 只清 `_chunks`，`GameState.collected_fragments` 残留 →
   新增 `GameState.reset_pickup()`（只清拾取、保留分数），超时重铺调用。
3. **无效探测被去重签名吞掉**：`_probed_signature` 不含信度时，同状态下第二次探测被丢弃 →
   签名含信度（无效必扣信度 → 签名必变 → 可重试），并在拾取/过波/超时重铺时清空签名。
4. **生成瞬间重叠误拾取**：重开/过波传送前新片段已与玩家 overlap（0.3px）→ 拾取在传送结算前注册 →
   KeyFragment 出生与 `restore()` 同款 2 物理帧武装延迟（先关监控）。

## 门禁证据（本机 Godot 4.3.stable.official.77dcf97d8，判定脚本全部来自仓库内 std-skills/）

| 门禁 | 命令（与 routines.yaml 同源） | 结果 |
| --- | --- | --- |
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/oak-key` | PASS（13/13，42 文件） |
| headless-smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=… bash …/smoke.sh games/oak-key` | 退出码 0，`godot-smoke: PASS`，日志无 SCRIPT ERROR；场景自报 229 帧 ≤ 240 预算 |
| input-fuzz | `GODOT_BIN=… bash …/input-fuzz.sh games/oak-key` | `GODOT_FUZZ: PASS`（seed=20260913，6 批 239 帧） |
| 工程入口 | `bash games/oak-key/verify.sh` | 退出码 0（上述三步串跑） |

取证标记实测输出（headless 冒烟内 grep OAK_KEY_PROBE，valid/invalid 双路均可达）：

```
OAK_KEY_PROBE oak_key_probe=valid probe_count=1 wave=1/3 fragments=3/3 decoy=false credibility=2 key=oak-OA-K7-42 reason=校验通过
OAK_KEY_PROBE oak_key_probe=valid probe_count=2 wave=2/3 fragments=3/3 decoy=false credibility=2 key=oak-OA-K7-42 reason=校验通过
OAK_KEY_PROBE oak_key_probe=valid probe_count=3 wave=3/3 fragments=3/3 decoy=false credibility=2 key=oak-OA-K7-42 reason=校验通过
OAK_KEY_PROBE oak_key_probe=invalid probe_count=4 wave=1/3 fragments=0/3 decoy=false credibility=3 key=oak-??-??-?? reason=片段不足（0/3）
GODOT_SMOKE: PASS 移动/三波拾取/有效探测/过波/超时扣信度/胜利结算/重开/无效探测/失败结算/取证标记/反馈/调参协议 全部通过（229 帧，位移 40.3px，取证记录 6 条，波次 1）
```

## 验收标准对照

1. 合法 Godot 4 工程：`project.godot` features=`4.3`，headless 打开无解析错误 ✅（冒烟退出码 0）
2. godot-smoke 门禁通过：headless 启动主场景正常退出、日志无 ERROR/SCRIPT ERROR、229 帧 ≈ 3.8s ≤ 30s ✅
3. 最小可玩闭环：探测反馈同帧渲染（≪2s），取证标记双路可检索（日志 + JSON 存档）✅
4. AppHost 部署：属 deploy 节点范围（见已知缺口 3）
5. 统计隔离：`config/name`/`config/description` 与本 README 均带「取证探针 · 不计入三样例」标记；
   工程路径 `games/oak-key` 唯一，统计侧按路径排除即可 ✅（工程侧标记齐备）

## 已知缺口（不阻塞本节点，供后续节点/运维）

1. **`std-skills/godot-game-dev/scripts/playtest.sh` 未在仓库预置**（仅平台注入目录有阅读副本）。
   仓库 `.myrd/routines.yaml` 的 `godot-smoke` routine 只含 availability/preflight/headless-smoke/input-fuzz
   四步，本工作流门禁不受影响；但工作流第 4 步 playtest 节点要跑 `GODOT_PLAYTEST` 机器人试玩，
   需运维把 `playtest.sh` + `playtest_driver.gd` 补进模板仓库（不得由被检工程自造判定器）。
   本地自检清单里的 playtest 命令因此无法执行，本节点如实上报，不做等价替代。
2. `routines.yaml` 的 `game-contract` routine 引用 `scripts/contract-check.mjs`，仓库无该脚本（沿袭自 scaffold 报告）。
3. **deploy 节点注意**：仓库根 `apphost.toml` 当前指向 `games/game/export/web`（name=candy-crush-legend），
   需为 oak-key 建独立应用清单（slug `oak-key`，AppHost id `cmupsflsj001sm9dhxt6w1oal`），并做 Web 导出
   （含壳页面的音频手势解锁，headless 全绿 ≠ 移动端有声音）；部署 gitRef 必须 `myrd/games-goal-cmupsfn0q001um9dhlko9t5e0`。
4. 工作区未见 approved 版 GameDesignSpec 导出件（`.myrd/spec/design-spec.json` 不在仓库）；
   本节点按需求正文 + 固化结论（休闲收集）实现。调参键（`move_speed`/`wave_time_scale`/`decoy_speed`/`probe_credits`）
   即 spec.numeric 对接面，若策划案 revisions 落了不同数值，改 `game_state.gd` 默认值即可对齐（禁止两头各改各的）。
