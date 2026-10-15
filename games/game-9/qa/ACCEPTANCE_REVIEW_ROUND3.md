# 《汽车连连看》(game-9) 线上版第三轮验收复核报告（v5 · 独立复验）

- 复核角色：主策划（goal cmuw2o88z018ricryvpr6v8wn · 第三轮线上版复核节点）
- 复核时间：2026-10-07T14:45~14:55Z（UTC）
- 复核对象：**线上版**（AppHost v5 `cmuwqrrl70051m9lgj8v89gh9` @ 游戏代码 `2626927`），非本地导出
- 前轮报告：第一轮（v3）`games/game-9/qa/ACCEPTANCE_REVIEW.md`；第二轮（v5）`games/game-9/qa/ACCEPTANCE_REVIEW_ROUND2.md`（PR #36）
- 判定脚本：全部取自仓库 `std-skills/godot-game-dev/scripts/`，本轮**零改动**；所有结论均来自本轨迹独立实跑/实测，不沿用前轮数字

## 复核结论（先行）

**机器侧验收全绿且可复现：本轨迹在部署分支 tip 独立复跑四门禁全部 PASS，其中
GODOT_PLAYTEST 三局指标（fb=75/80/76）与归档证据逐字一致；对线上 liveUrl 独立复跑
移动门禁 PASS 10/10；线上 pck/js 与仓库 v5 导出逐字节一致。** 剩余唯一动作 =
owner 人工试玩回填（`games/game-9/qa/playtest-kit.md` 四问量表）并拍板——机器侧
任何绿都不替代人工验收（见 §六）。

## 一、liveUrl 公网可访问且为 v5 部署（复核项 ①，本轨迹实测）

| 项 | 值 | 核对方式（2026-10-07 实测） |
| --- | --- | --- |
| 公网免登录 | `https://leomac-studio.tail49399e.ts.net/apps/game-9/` → 308 → **200**（12,227B），`<title>汽车连连看</title>` | curl 实测，无登录墙 |
| `/health` 身份 | `{"ok":true,"app":"game-9","title":"汽车连连看","env":"development","assets":"lazy/object-storage"}` | `GET /apps/game-9/health` 200 |
| 调参桥在位 | 线上壳 HTML 含 `__GAME_TUNING__` ×2（`?tuning=1` 入口可调） | grep 线上 HTML |
| **线上=仓库 v5 导出** | 线上 `api/public/assets/index.pck`（base64+gzip 文本通道）解码后 **sha256 `ebcb3202…acf2b`（3,968,912 B）＝ `git cat-file 2626927:games/game-9/export/web/index.pck` 逐字节一致（cmp 通过）**；`index.js` 同样逐字节一致 | 下载→b64 解码→gunzip→sha256→cmp |
| 部署归属 | HostedApp `cmuw2o6z4018picry133zwcio`（title=汽车连连看）；deployment **v5 `cmuwqrrl70051m9lgj8v89gh9`** running @ 游戏代码 `2626927`（v1–v4 superseded） | 部署分支提交链：`2626927`（导出）→`c1106d7`/`d8c6ae8`/`0a45faa`（仅 qa 文档，不影响产物） |

> 口径沿用知识库：liveUrl 不标识版本归属，审计/复现一律认 **deploymentId + commit + `/health` 身份**。

## 二、GODOT_PLAYTEST: PASS 证据链核验 + 独立复跑（复核项 ②）

### 2.1 归档证据审计（`qa/playtest-round2/`）

- `report.log`（默认档 3 种子 × 900 帧）与 `report-full-session.log`（全 session 档 3 × 5400 帧）：
  单行 `GODOT_PLAYTEST_METRICS` + `GODOT_PLAYTEST: PASS` 判定行齐全；
  `thresholds_source: "tests/playtest.json"`，阈值四键与 `games/game-9/tests/playtest.json`
  逐键相符（`first_reward≤5s / gap≤6s / fb≥30 / 种子结果互异≥2`，均严于 driver 内置默认，非放宽）。
- README 归档了 round1→round2 修复链（点击反馈按事件坐标接线 + 光标钳制 @ `7a68d1e`）
  与阈值标定回溯（GameDesignSpec / SKILL.md §4.5）。

### 2.2 本轨迹独立复跑（2026-10-07，`qa/playtest-round3/verify-full-run.log`）

在部署分支 tip（`0a45faa`，游戏代码与线上 v5 同一文件）跑 `games/game-9/verify.sh`：

```
PREFLIGHT: PASS 14 类前置一致性检查全部通过（87 个工程文件）
godot-smoke: PASS 冒烟场景通过（240 帧，退出码 0）
GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239
GODOT_PLAYTEST: PASS 3 局全部通过（900 帧/局）
verify: PASS preflight + smoke + fuzz + playtest 全部通过
```

GODOT_PLAYTEST 三局：fb=**75/80/76**、首奖励 0.017~0.267s、最长无反馈窗口 0.95~1.32s、
阈值来源 `tests/playtest.json` —— **与归档 `qa/playtest-round2/report.log` 逐字一致**
（同种子确定性复现），证据链可信度从「单次留证」升级为「跨轨迹可复现」。

### 2.3 score 语义核验（复核项「score 达标」）

- 机判阈值四键全部满足且余量大（首奖励 ~20×、断档 ~4.5×、密度 ~2.5~17×），**达标**。
- playtest 日志中 `score=0` 是 bot 随机游走的预期行为（机判协议不断言得分，
  `qa/playtest-round2/README.md` §诚实记录）：计分链路本身由冒烟断言 6 单独机判
  （受控消除后必须收到 `score_changed` 且分数增长，否则 `GODOT_SMOKE: FAIL 计分链路断裂`），
  本轮复跑该断言 PASS——**计分链路无断裂，score 达标口径成立**。

## 三、qa/mobile 移动端机判核验 + 独立复跑（复核项 ③）

- 归档证据：`qa/mobile/report.json` verdict=PASS（10/10，checkedAt 2026-10-06T14:19:33Z，
  对线上 v5 实测）+ 三张分阶段截图；round1 tap 空隙失败模式取证在档
  （`qa/mobile/TOUCH_RESPONSE_DIAGNOSIS.md`）。
- **本轨迹独立复跑**（对线上 liveUrl，headless Chrome 移动仿真 390×844/DPR3/iPhone UA）：
  `qa/mobile-round6/` **PASS 10/10**（checkedAt 2026-10-07T14:50:08Z）——网络全通 /
  console 零 error / canvas / 首帧渲染 / 画面在动 / 触摸管线 / 触摸响应（**tapDiff=320**，
  tap 命中主 CTA 并进局，无 round1 的按钮空隙问题）/ 音频解锁器 / 视口无溢出（390=390）/
  FPS 36（swiftshader 口径）。consoleErrors=0、networkFailures=0。
- 结论：**移动端机判通过**，桌面/移动双端入口同一 URL，触屏与鼠标同语义
  （`emulate_mouse_from_touch`）。

## 四、产物标识回写（复核项 ④，如实记录）

- **goal artifacts API 直写被拒（与前轮一致）**：本轨迹 token 的 `actFor` 与 goal owner
  不一致，`GET /api/v1/goals/cmuw2o88z018ricryvpr6v8wn` 返回 403「无权访问」（本轨迹实测复现）。
- **已落仓库（本轮持久化落点）**：黑板 `.myrd/blackboard/assets.md` 刷新为 v5 + 第三轮复验口径；
  `blockers.md` 入档 L3（artifacts API 403 待 owner 凭据落账）。
- **待有 owner 凭据者一键落账**（PATCH `/api/v1/goals/cmuw2o88z018ricryvpr6v8wn` artifacts，
  保留其余条目、仅原位更新下列两条，合并语义=同 `artifactType:artifactId` 原位替换）：

```json
[
  {"op": "hosted_app", "artifactType": "hosted_app", "artifactId": "cmuw2o6z4018picry133zwcio",
   "status": "completed", "detail": "HostedApp=cmuw2o6z4018picry133zwcio（汽车连连看）；deployment v5=cmuwqrrl70051m9lgj8v89gh9 running @ 游戏代码 2626927（分支 myrd/games-goal-cmuw2o88z018ricryvpr6v8wn，v1–v4 superseded）；liveUrl=https://leomac-studio.tail49399e.ts.net/apps/game-9/；/health 身份实测 game-9；线上 pck sha256=ebcb320298abbeaed9a79f71602c413dc757dccf75a772751e40eeb2b24acf2b 与 v5 导出逐字节一致（第三轮复核 2026-10-07 复测）"},
  {"op": "playtest", "artifactType": "playtest", "artifactId": "games/game-9/qa/playtest-round3",
   "status": "completed", "detail": "GODOT_PLAYTEST: PASS（第三轮独立复跑 2026-10-07：四门禁全绿，playtest 三局 fb=75/80/76 与 round2 归档逐字一致；阈值 tests/playtest.json 四键全满足）+ 移动门禁 round6 PASS 10/10（对线上 v5 实测，tapDiff=320）；试玩量表 games/game-9/qa/playtest-kit.md 待 owner 回填拍板"}
]
```

## 五、遗留（不阻塞验收包）

1. 工作流调度 API 权限（blockers L2）与 goal artifacts API 写回权限（L3）同根
   （token actFor 与 goal owner 项目成员关系），建议运维一次补齐。
2. 移动门禁 pass 分支的 detail 字段会带失败模板文案（如「画面没渲染出来」），
   纯文案瑕疵，判定不受影响（前轮已建议，未处理）。
3. 兜底洗牌分支（剩余 >2 张时）未做二次连通校验——知识库已记为后续加固点，
   现网冒烟/fuzz 未复现死局，不阻塞本轮。
4. `export_presets.cfg` 未设 exclude_filter，`qa/` 取证 PNG（~850KB）被打进 pck
   （3.97MB 中约占 21%）。建议后续迭代加 `exclude_filter="qa/*"` 或在 qa/ 放
   `.gdignore`（知识库 game 系已有先例），可减包体并避免取证产物进玩家侧——纯优化，
   不影响本轮 v5 的字节级结论。

## 六、给 owner 的试玩回填指引（复核项 ⑤）

**即玩入口**：https://leomac-studio.tail49399e.ts.net/apps/game-9/ （免登录）
**调参工作台**：https://leomac-studio.tail49399e.ts.net/apps/game-9/?tuning=1
（可调 start_time_easy / start_time_hard / match_points）
**量表**：`games/game-9/qa/playtest-kit.md` §2 四问（看得懂吗 / 想再来吗 / 手感反馈 /
节奏断档）——回填结论 + 可选调参 URL 发回 goal 会话即可，由主线程经 spec revisions
接口落账并 approve 拍板；**拍板前目标不关闭，机器侧全绿不替代人工验收**。
