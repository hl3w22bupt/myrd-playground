# 《疾风忍者跑》策划案修订说明 · v1 → v2

> - **版本**：v2（version=2，status=**approved**，拍板日期 2026-09-27；v1 自动置 superseded）
> - **数据来源：AI 代理试玩（后续 iOS 真机复核可再覆盖）**
> - 机器可读单一事实源：同目录 `spec.json`（六段：meta / world / entities / levels / numeric / acceptance + revisions）
> - 为什么走仓库直改：平台 `revise_design_spec` 操作类型不受支持（已重试多次失败），经「游戏策划」在仓库内直接完成同等效果（版本 +1、置 approved、修订说明留痕）。

## 一、修订依据（实测记录）

| 证据 | 位置 | 关键实测 |
|---|---|---|
| 机器人试玩门禁（3 种子 × 1200 帧/局，独立复跑复现） | `../qa/PLAYTEST.md` §三/§九 | first_reward 2.65/2.80/2.92s（阈值 ≤10s）、最长无反馈窗口 3.00/3.12/3.42s（阈值 ≤10s）、反馈事件 24/25/28（下限 2/局），`GODOT_PLAYTEST: PASS` |
| 线上代试玩 6 局（解析仿真 + 双源实测锚定，`/health` 核验通过） | 平台轨迹 `cmuio2axi003gm9l6jvynz0k4`（平台体检师） | 过关率 33%（2/6）、死亡分布 深坑:尖刺=4:1、飞镖专家线 17/17 可达、二段跳引擎触发 6/6=100% |
| 调参桥注入链路实测 | `../qa/cdp-precheck/precheck-log.md` §P5 | URL → `__GAME_TUNING__` → 钳制 → live_* 生效 |

## 二、spec.numeric 逐项判定与拍板（v1 → v2）

| 键 | v1 | v2 | 判定 | 依据（实测口径） |
|---|---|---|---|---|
| coyoteFrames | 6 | **12** | **偏差→修订** | 坑2 单跳起跳窗口仅 13.1 物理帧 ≈0.22s，是 6 局中 4 局坑死的直接窗口；放宽到 12 帧 → 窗口 ≈19.1 帧（**+46%**）、土狼容错 0.100s→0.200s；在 TUNING_META 钳制上限 20 内，无力学副作用（体检师推荐定稿候选） |
| jumpBufferFrames | 6 | **12** | **偏差→修订** | 与上项配套：触屏「提前按跳」兑现窗口 0.100s→0.200s；坑2 窗口同步受益，无副作用 |
| runSpeed | 240 | 240 | 达标→固化 | 试玩反例 `run_speed=200` 把坑2 窗口压到 5.6 帧（难度反向上升），240 维持 |
| jumpVelocity | -520 | -520 | 达标→固化 | 6 局解析推演无吞按/幽灵落地；单跳跨距 ≈178px 与 level.gd 跨坑承诺一致 |
| gravity | 1400 | 1400 | 达标→固化 | 拒绝 `1800/560` 组合（会把坑2 调成帧完美、无土狼时窗口为 0）；`1700/600` 仅作真机可选调参 URL，不进默认 |
| maxJumps | 2 | 2 | 达标→固化 | 二段跳触发 100%、跨坑目的达成 5/6（局6 为策略窗口问题非引擎缺陷）；「定稿后改坑宽而不是放段数」 |
| dartScore | 1 | 1 | 达标→固化 | 专家线 17/17 全收可达，收集机制本体无缺陷（冒烟断言 8 另证） |
| winBonus | 10 | 10 | 达标→固化 | 无相关偏差记录 |
| maxFallSpeed | 900 | 900 | 达标→固化 | 安全阀，不开放调参（口径不变） |
| jumpAirTime | ≈0.743s | ≈0.743s | —— | v2 只放宽输入容错，不改力学 |

## 三、其他同步修订

1. **world.track 新增 `pits` 数组**：5 处深坑的 x 区间、宽度与逐坑起跳窗口（量化自代试玩，与 `scripts/level.gd` GROUND_SEGMENTS 逐位一致）。
2. **entities 口径同步**：e-player（12/12 容错）、e-pit（5 处坑宽递增）、e-dart（17 枚/首枚 x=420/专家线可达）；条目 id 不变，可视化编辑页精确落点不受影响。
3. **levels.lvl-01 元素 expect 更新**（id 不变）：spikes 补逐坑窗口口径；darts 补 17 枚与发现④备注。
4. **acceptance 新增 3 条、修订 1 条口径**：
   - `ac-8-playtest-metrics`（pass）：机器人试玩机判指标三条阈值与实测值；
   - `ac-9-restart-guard`（pass）：重开防误触（奔跑中按 R 忽略，smoke 第 14 组断言 + 负例探针 C）；
   - `ac-10-feel-tuning-v2`（**pending**）：v2 拍板手感落地验收（见下节清单），实现节点完成后置 pass；
   - `ac-2-doublejump` 增补二段跳触发率实测口径。
5. **revisions 段留痕**：v1（superseded，含 numeric 快照）+ v2（approved，op=tuning_applied，detail 全量记录改了什么与证据链）。

## 四、拍板后落地清单（交实现节点，先 spec 后代码的既定接口）

| # | 事项 | 落点 | 验收 |
|---|---|---|---|
| 1 | `COYOTE_FRAMES` 6→**12**、`JUMP_BUFFER_FRAMES` 6→**12** | `games/game-3/scripts/player.gd` 常量区 | `bash games/game-3/verify.sh` 四步全绿；spec `ac-10-feel-tuning-v2` 置 pass |
| 2 | 坑5 技巧注释改为「第二跳在回落越过起跳高度后 ≈0.26s 再按」（现注释与力学最优相反，顶点按是最差时机） | `games/game-3/scripts/level.gd:26` | 注释与 player.gd 推导一致 |
| 3 | `tuning-params.md`「跳得太飘」建议组合替换为安全版 `{gravity:1700, jump_velocity_abs:600}`，并标注 `1800/560` 为反例勿用 | `games/game-3/qa/tuning-params.md:61` | 文档组合复跑门禁不劣化 |
| 4 | S1 增设「白给」正反馈镖（y≥160 跑过可收，把首次收集压到 1s 内）——**评估项**，改关卡数据须复算跨坑承诺表 | `games/game-3/scripts/level.gd` DART_SPOTS | 冒烟逐镖可达断言保持全绿 |

## 五、可复现调参 URL（BASE=`https://leomac-studio.tail49399e.ts.net/apps/game-3/`）

| 意图 | 参数 | URL `?` 后拼接 |
|---|---|---|
| v2 拍板默认（触屏容错↑） | coyote 12 / buffer 12 | `%7B%22coyote_frames%22%3A12%2C%22jump_buffer_frames%22%3A12%7D` |
| 更跟手（真机可选） | gravity 1700 / jump 600 | `%7B%22gravity%22%3A1700%2C%22jump_velocity_abs%22%3A600%7D` |
| ⚠️ 反例勿用 | gravity 1800 / jump 560 | `%7B%22gravity%22%3A1800%2C%22jump_velocity_abs%22%3A560%7D` |
| ⚠️ 反例勿降速 | run_speed 200 | `%7B%22run_speed%22%3A200%7D` |

> 注：落地清单 #1 完成前，线上默认仍是 6/6，可用第一条 URL 在线上体验 v2 手感。
