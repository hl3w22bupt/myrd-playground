# 《线上抓娃娃机 game-11》线上版验收复核报告（2026-10-06）

- 复核角色：主策划（验收复核节点）· 分支 `myrd/game-11-goal-cmuwf19ee000xm9lg4v7bxybn`
- 结论：**线上版可玩性与双门禁证据复核通过**（机器侧全绿；人工试玩拍板仍待 owner，见 §6）
- 本节点动作：功能分支快进对齐部署分支（`3e5aaa9` → `bffad6b`，纳入移动端修复/重导出/证据归档）+ 独立复跑双门禁 + 回写产物标识

## 1. 线上产物标识（回写目标 artifacts 的三条）

| 项 | 值 | 来源与核验 |
| --- | --- | --- |
| **HostedApp id** | `cmuwf171v000vm9lg2vqldhwy`（slug: game-11） | 平台下发给工作流节点的托管应用参数（权威源）；slug 与公网网关在线状态互证 |
| **deployment id** | `cmuwj6mze0037m9lgdwigdpli` | 工作流运行记录（run `cmuwff9dc002em9lgiiv63fa4`）+ 部署节点黑板 `.myrd/blackboard/game-11-deploy.md` 两源一致；gitRef=`myrd/games-goal-cmuwf19ee000xm9lg4v7bxybn`，构建 commit `155e442` |
| **liveUrl** | https://leomac-studio.tail49399e.ts.net/apps/game-11/ | 本节点实测 200（见 §2）；免登录可玩 |

说明：复核 token 的 apphost 读接口按属主收敛（仅应用所有者/系统管理员），部署记录详情接口 403 属预期权限边界；
标识以「平台下发参数 + 工作流运行记录 + 线上网关实测」三角一致为准，未经任何一方单独声明采信。

## 2. liveUrl 可玩性实测（本节点取证，2026-10-06T12:13Z）

| 检查 | 结果 |
| --- | --- |
| `GET /apps/game-11/` | HTTP 200，壳页 13KB，含 `canvas` / `DecompressionStream`（gzip+b64 资产通道）/ `__audioDebug`（音频手势解锁）/ `__GAME_TUNING__`（调参桥） |
| `GET /apps/game-11/health` | `{"ok":true,"app":"claw-machine-game-11","env":"development","assets":"lazy/object-storage"}` —— 身份归属确认，无模板残留 |
| `index.js` 指纹 | 线上 331,495 B，sha256 `8b649683…720824075` 与仓库 `games/game-11/export/web/index.js` **逐字节一致** |
| `index.pck` 指纹 | 线上经 gzip+base64 文本通道（4,510,968 B），解码后 3,444,848 B，sha256 `87f7ae8e…d32d9148d0` 与仓库导出产物**一致**，`GDPC` 魔数正确 |
| 构建锚定 | 线上构建 = 仓库 `155e442`（其后的 `202dc1d`/`e55a814`/`bffad6b` 仅为 QA 证据与文档提交，不影响游戏产物） |

结论：**线上运行的正是当前分支的导出产物**，壳契约（资产通道/音频解锁/调参桥）全部在场。

## 3. 双门禁证据（复核节点独立复跑，非转抄前序声明）

### 门禁 A：本地四门禁（`bash games/game-11/verify.sh`，Godot 4.3.stable，本次实跑 EXIT=0）

| 门禁 | 结果 | 明细 |
| --- | --- | --- |
| preflight | PASS | 14 类前置一致性，68 个工程文件 |
| GODOT_SMOKE | PASS | headless 240 帧，断言标记齐全，日志无脚本错误 |
| GODOT_FUZZ | PASS | seed=20260913，6 批 239 帧，对抗事件序存活 |
| GODOT_PLAYTEST | PASS | 3 局 × 900 帧：首奖励 2.55 / 9.88 / 2.53 s（≤10s），反馈 212 / 249 / 256 次/局（≥2），最大反馈间隔 ≤0.63s（≤10s） |

### 门禁 B：移动端模拟门禁 MOBILE_SMOKE（headless Chrome，iPhone 17.5 UA / 390×844 / DPR3）

| 轮次 | 结果 | 证据 |
| --- | --- | --- |
| round3（部署节点 @2026-10-06T10:29Z，实跑于部署后 liveUrl） | PASS 10/10 | `games/game-11/qa/mobile/report.json` + 3 张分阶段截图（fps=10，tapDiff=49） |
| **round4（本复核节点独立复跑 @2026-10-06T12:18Z）** | **PASS 10/10** | `games/game-11/qa/mobile-round4/`（report.json + 3 张截图；fps=10，tapDiff=43，console error=0，network failure=0） |

两轮跨 2 小时结论一致 → **移动端可判定可复现**，非单次侥幸。10 项覆盖：网络全通 / console 零 error / canvas 挂载 / 首帧渲染 / 画面在动 / 触摸管线 / 触摸响应 / 音频解锁器 / 无横向溢出 / FPS≥8（swiftshader 口径）。

## 4. 与验收标准（需求 cmuwf7f6d0021m9lgl0bn5yjn）的机器侧对照

| 验收标准 | 机器侧证据 |
| --- | --- |
| 1. ≥3 种可切换夹爪、差异可感知 | 冒烟断言三爪型参数两两不相同（radius/power/speed）；差异倍率见 PLAYTEST_KIT §2.1 |
| 2. 娃娃库 ≥8 种、入背包可查详情 | 冒烟断言 8 只全布货 + 背包/结算明细（名称·稀有度·分数） |
| 3. 全 3D + 抓取全流程物理、≥30fps | 机台/爪/娃娃全代码 3D 网格 + RigidBody3D；真渲染器帧率待 owner 真机走查（门禁 swiftshader 10fps 为软渲染口径，非真机帧率） |
| 4. BGM≥1 + 音效≥5 + 静音开关 | BGM 20s 无缝循环 + 7 种音效注册，`__audioDebug` 解锁器门禁 PASS，静音走 Master 总线 |
| 5. 对局闭环无报错、账务准确 | 冒烟覆盖「布货→移动→下爪→闭合/提起→落洞入账→结算→重开」；playtest 3 局零脚本错误 |

spec ↔ 实现已披露差异（引擎栈/娃娃名单分档/单局时长/开局币/相机限位）见 `games/game-11/qa/playtest/PLAYTEST_KIT.md` §3，不影响上述五条机判结论。

## 5. 复核中发现并已处置的事项

| 事项 | 处置 |
| --- | --- |
| 功能分支 `myrd/game-11-goal-…` 落后部署分支 7 个提交（缺移动端 DPR 修复 / 点按下爪 / Web 导出产物 / QA 证据） | 本节点 `git merge --ff-only` 快进对齐到 `bffad6b`，后续节点不再基于陈旧代码工作 |
| 线上 pck 与仓库产物一致性此前无直接证据 | 本节点以 sha256 指纹比对实证（§2），补齐「线上=仓库」一环 |
| 移动门禁仅部署节点单轮实跑 | 本节点独立复跑 round4 双轮收敛（§3 门禁 B） |

## 6. 移交人工验收（最终裁决，机器不可代判）

@MyRD Admin 机器侧验收已全绿，目标关闭还差你的试玩拍板：
1. 打开试玩入口：https://leomac-studio.tail49399e.ts.net/apps/game-11/ （手机浏览器体验最佳）
2. 按 `games/game-11/qa/playtest/PLAYTEST_KIT.md` 玩 1–2 局，重点感受：三爪型差异 / 视角拖动缩放 / 静音开关 / 背包详情 / 结算重开
3. 回填量表的四问结论（好玩与否 + 最想调的一个数值）；调参工作台：https://leomac-studio.tail49399e.ts.net/apps/game-11/?tuning=1

未拍板前目标不算完成；若试玩结论要求调参/改表现，走 spec 修订（revisions，version+1）→ 重部署 → 再复核。
