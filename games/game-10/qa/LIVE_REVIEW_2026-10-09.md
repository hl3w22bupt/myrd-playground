# 《节奏大师》(game-10) 主策划线上复核报告（2026-10-09）

> 复核人：主策划（goal cmv0xypkw000dm94o58qf3x8j 功能线节点「指派主策划线上复核 game-10 并回写 artifacts」）。
> 复核方式：打开 liveUrl 实测 + 平台账册 API 实读 + 线上资产字节级取证 + 独立复跑移动端冒烟门禁。
> 依据：需求 cmv0y4coa000vm94o5w4iwqso（AC1–AC5）；权威基准＝知识文档 7af3a518-f7b0-4165-81b5-174fd349279a。

## 一、线上产物标识（本次复核回写三项）

| 项 | 值 | 核实方式 |
| --- | --- | --- |
| **HostedApp id** | `cmv0xyobv000bm94o6kxqca8z` | `GET /api/v1/apps?projectId=cmv0xyobf0007m94ogyu79h0k` 实读：kind=hosted、slug=game-10、**status=ready**、version=2、publicUrl 与 liveUrl 一致 |
| **deployment id** | `cmv10cg93001jm94of535yg54`（commit=`2ccb38e`，分支 `myrd/game-10-goal-cmv0xypkw000dm94o58qf3x8j`） | 与 run_workflow 产物 cmv0yfaqu0018m94ot8uj5z2d 台账一致；并用线上 pck 字节级取证交叉证实（见 §三） |
| **liveUrl** | https://leomac-studio.tail49399e.ts.net/apps/game-10/ | 实测 200（`/` 308→`/apps/game-10` 200，免登录） |

## 二、线上可用性与壳契约（实测）

- `/health` → 200 `{"ok":true,"app":"game-10","title":"节奏大师","env":"development","assets":"lazy/object-storage"}`，身份无串号。
- 落地页 200（12,211 B）：标题=节奏大师；键位提示 D F J K / ←→ 切难度 / R 重开 / 触屏底部四分区；`PERFECT ±50ms` 文案在页。
- **壳契约两件在位**：①音频手势解锁器（`window.__audioDebug` 出口、AudioContext 包装捕获）；②调参桥（`?tuning=<JSON>` → `window.__GAME_TUNING__`，注释指向引擎侧 `GameState._apply_web_tuning()`）。
- 资产链路全通：`index.js` 200（331,495 B，明文）；`index.wasm` 200（base64 10.7 MB，gzip 通道魔数 `H4sI` 实证）；`index.pck` 200（base64 3.35 MB → 解出 **2,524,032 B**）。懒加载/文本通道设计与 apphost `assets_dir` 声明一致。

## 三、构建一致性取证（本次复核关键发现）

| 对象 | 字节数 | md5 | 结论 |
| --- | --- | --- | --- |
| 线上 `index.pck`（解码后） | 2,524,032 | `a4d5858d17650af0ef1403f35b019c04` | ＝ `2ccb38e` 构建（部署台账 commit 吻合） |
| 仓库 `export/web/index.pck`（HEAD=`b0e8560`） | 2,524,160 | `ee0a7ec673a8874cd9ce4be7f24ed50b` | 与线上差 128 B；提交记录自述「main.gdc +460B 仅含接线差异」 |
| 线上 `index.js` | 331,495 | `4e08904b1b7107858246af44b602067b` | 与仓库 export/web/index.js **逐字节一致** |
| 壳层（server/src/index.html 等） | — | — | `2ccb38e..b0e8560` 零差异 |

**结论：线上落后功能线 HEAD 一个提交，且唯一缺口就是 `b0e8560` 的调参面板接线（main.gd `_maybe_mount_tuning_panel`，9 行）。**
即：线上 `?tuning=1` 仍不出调参面板（脚本有定义、无实例化点的旧缺陷），`?tuning=<JSON>` 直传桥不受影响。playtest-kit 节点预告的「面板待下一次部署生效」本次复核证实**仍未生效**。

## 四、可玩性与节拍判定核验

### 4.1 机判部分（本节点独立复跑，非转抄）

**MOBILE_SMOKE: PASS 10/10**（2026-10-09T14:23:52Z，iPhone 13 档 390×844/DPR3/触摸仿真，对 liveUrl 复跑）：

| # | 检查 | 结果 | 关键数值 |
| --- | --- | --- | --- |
| 1 | 关键资源网络全通 | PASS | 0 失败 / 0 警告 |
| 2 | console 零 error + 零未捕获异常 | PASS | 0 条 |
| 3 | canvas 挂载 | PASS | 引擎产物在 DOM |
| 4 | 首帧非纯色 | PASS | 14 种量化色 |
| 5 | 画面在动 | PASS | idleDiff=399 |
| 6 | 触摸事件到达 DOM | PASS | tap/swipe 均派发 |
| 7 | 触摸后画面响应 | PASS | tapDiff=13（开局等待期为静止谱面入口，非缺陷） |
| 8 | 音频手势解锁器 | PASS | `__audioDebug` 在位 |
| 9 | 无横向溢出 | PASS | scrollWidth=clientWidth=390 |
| 10 | FPS≥8 | PASS | fps=36（swiftshader 软渲染口径） |

证据：`games/game-10/qa/mobile-round2/`（report.json + phase-load/tap/joystick.png）。

### 4.2 节拍判定口径（线上↔工程同源关系）

- 判定逻辑（BeatJudge/Conductor/窗口 50/100ms、权重 100/60、校准 ±300ms/10ms）全部随 `index.pck` 下发；线上 pck＝`2ccb38e` 构建，与工程内四门禁 PASS（PREFLIGHT 14 类 / GODOT_SMOKE 240 帧 AC1–AC5 断言 / GODOT_FUZZ / GODOT_PLAYTEST 380/520/600）**同一构建源**——工程内机判结论对线上版本有效。
- 线上结构核验（本节点）：壳调参桥、音频解锁器、触摸管线、资源通道全部在位，判定所需的「确定性歌曲时钟」契约不受部署链路影响。
- AC1/AC2/AC5 的 100% 一致/0 误差机判结论沿用工程内门禁（知识文档 §二，含变异测试拦截力验证）；AC3 结算页切档已由 GODOT_SMOKE 机判。

### 4.3 不可机判部分（如实标注，与知识文档 §四一致）

- AC4 全量口径（iOS/Android 各 ≥2 台真机、四指并发 1000 次 0 丢触、触控→判定中位延迟 ≤80ms、校准重启生效）**仍待真机实测**；本轮移动仿真只能覆盖结构性子集。
- 「好不好玩」（四问量表）只能由试玩人回填，机器侧全绿不替代人工验收。

## 五、复核结论与待办

**结论：线上版本可用、可玩、判定契约在位（10/10 机判全绿 + 台账/字节级双证实），作为人工试玩入口合格。**

| # | 待办 | 责任 | 说明 |
| --- | --- | --- | --- |
| T1 | 一次重部署使调参面板生效（`b0e8560` 已在分支上，重部署即消掉 §三缺口） | 平台/owner 触发（本节点无部署 API 权限，`GET /api/v1/deployments/<id>` 404、工作流运行 API 不可达） | 重部署后 deployment id 变更，需回填本文件与黑板 |
| T2 | owner 试玩回填 `qa/playtest-kit.md` 四问量表（入口＝liveUrl；调参工作台暂用 §五 T1 后的 `?tuning=1`，此前可用 `?tuning=<JSON>` 直传桥） | @ai-verse-bot（目标 owner） | 人工拍板是最终裁决，拍板前目标不关 |
| T3 | AC4 真机抽查（可并入 T2 试玩） | owner | 指引在 playtest-kit |

## 六、goal artifacts 回写记录

本报告已落账 `PATCH /api/v1/goals/cmv0xypkw000dm94o58qf3x8j`：op=`online_review` / artifactType=`review_report`
/ artifactId=`games/game-10/qa/LIVE_REVIEW_2026-10-09.md`，detail 内含 **HostedApp id、deployment id、liveUrl** 三项与本页结论
（本 goal 的 artifacts API 本轮实测可写，game-9 时代的 403 未复现）。

**⚠️ 端点语义坑（实测，供后续节点避雷）**：该 PATCH 对 `artifacts` 字段是**整体替换**而非追加——首次只带 1 条新记录 PATCH 后，
台账被冲成 1 条；已立即用 PATCH 前的 6 条快照合并回写为 7 条并逐字段核对无丢失。**后续任何节点写 artifacts，必须先 GET 全量、
在完整数组上追加，再整体 PATCH。**
