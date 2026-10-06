# 《汽车连连看》(game-9) 线上版第二轮验收复核报告（v5 部署后）

- 复核角色：主策划（goal cmuw2o88z018ricryvpr6v8wn · 第二轮线上版复核节点）
- 复核时间：2026-10-06T14:49Z（UTC）
- 复核对象：**重新部署后的线上版**（AppHost v5），非本地导出
- 第一轮复核（v3 时代）：`games/game-9/qa/ACCEPTANCE_REVIEW.md`
- 判定脚本：全部取自仓库 `std-skills/godot-game-dev/scripts/`，本轮未改动任何判定器

## 复核结论（先行）

**机器侧验收全绿，线上版 = 最新部署字节级证实：HostedApp `cmuw2o6z4018picry133zwcio` /
deployment v5 `cmuwqrrl70051m9lgj8v89gh9` @ 游戏代码 `2626927` /
liveUrl https://leomac-studio.tail49399e.ts.net/apps/game-9/ 可玩。**
GODOT_PLAYTEST: PASS（两档）+ 移动门禁本轮独立复跑 PASS 10/10。剩余唯一动作 =
owner 人工试玩回填并拍板（本复核不替代，见 §4）。

## 一、liveUrl 可玩且为最新部署（复核项 ①）

| 项 | 值 | 核对方式 |
| --- | --- | --- |
| `/health` 身份 | `{"ok":true,"app":"game-9","title":"汽车连连看"}` | 实测 200 |
| 页面加载 | `/` → 308 → 200（12,227B），标题「汽车连连看」 | 实测 |
| 调参桥在位 | 线上壳 HTML 含 `__GAME_TUNING__`（2 处）+ tuning 面板 | 实测 grep |
| **线上=最新构建** | 线上 `api/public/assets/index.pck`（gzip+base64 文本通道）解码后 **sha256 `ebcb3202…acf2b`（3,968,912 B）＝ 仓库 v5 导出 `export/web/index.pck`（@2626927）逐字节一致** | 下载→b64→gunzip→sha256 |
| 部署归属 | v5 `cmuwqrrl70051m9lgj8v89gh9` running，gitRef=`myrd/games-goal-cmuw2o88z018ricryvpr6v8wn`，sourceId=本 goal id | v5 迭代轨迹 + 部署分支提交链（`2626927` 导出 → `c1106d7`/`d8c6ae8`/`0a45faa` 仅 qa 文档） |

> 口径沿用知识库：liveUrl 不标识版本归属，审计/复现一律认 deploymentId + commit + `/health` 身份。
> 本轮新增**字节级**证据：线上 pck 与 HEAD 导出哈希相等，把「证据 commit = 线上部署 commit」
> 从「同源代码」升级为「同一文件」。

## 二、GODOT_PLAYTEST: PASS 与证据齐全（复核项 ②）

### 2.1 证据目录审计（全部在库，判定行完整）

| 证据 | 位置 | 审计结果 |
| --- | --- | --- |
| playtest 两档日志 | `qa/playtest-round2/report.log`（900 帧）/ `report-full-session.log`（5400 帧） | 单行 `GODOT_PLAYTEST_METRICS` + `GODOT_PLAYTEST: PASS` 判定行齐全；阈值字段 `thresholds_source=tests/playtest.json` 与阈值文件逐键相符 |
| playtest 归档 README | `qa/playtest-round2/README.md` | round1→round2 修复链、阈值标定依据、v5 复跑段在档 |
| 移动门禁（preHook） | `qa/mobile/report.json` | verdict=PASS @14:19:33Z，10/10，对线上 v5 实测 |
| 修复留档 | `qa/mobile/TOUCH_RESPONSE_DIAGNOSIS.md` 等 | round1 tap 空隙失败模式取证在档 |

- **GODOT_PLAYTEST 指标**：默认档 3 种子 × 900 帧 fb=75/80/76；全 session 档 3 种子 × 5400 帧
  fb=517/483/518。阈值（`games/game-9/tests/playtest.json`）：首奖励 ≤5s / 无反馈窗口 ≤6s /
  反馈密度 ≥30 次/局 / 局间结果 ≥2 种——全部满足且余量充足（较内置默认更严，非放宽）。
- 实测最长无反馈窗口 1.32s（round1 为 13.2s，约 10× 收敛）。

### 2.2 本轮独立复跑（非引用旧证据）

`node std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs --url <liveUrl> --out games/game-9/qa/mobile-round5`

- **MOBILE_SMOKE: PASS，10/10 全绿，退出码 0**（checkedAt 2026-10-06T14:49:03Z）
- 指标：tapDiff=320、idleDiff=338、fps=36（swiftshader 口径）、scrollWidth=390=clientWidth、
  零网络失败、console 零 error
- 证据：`games/game-9/qa/mobile-round5/`（report.json + phase-load/tap/joystick 截图）

### 2.3 既有小瑕疵（不阻塞，沿用第一轮记录）

`qa/mobile/report.json`（与 round5 同款生成器）中 render/animate/touch-pipeline 三项
**status=pass 但 detail 残留失败模板文案**，属证据生成器文案清理问题，判定不受影响。
建议后续单独小改 `mobile-web-smoke.mjs` 的 pass 分支文案，不与本验收混提。

## 三、产物标识回写状态（复核项 ③）

- **goal artifacts API 直写被拒（如实记录）**：本轨迹 token 的 `actFor` 与 goal owner 不一致，
  `GET/PATCH /api/v1/goals/cmuw2o88z018ricryvpr6v8wn` 返回 403「无权访问/无权操作」。
- **已落仓库（本轮持久化落点）**：黑板 `.myrd/blackboard/assets.md` 已刷新为 v5 口径；本报告 §首
  即权威标识清单。第一轮已入 goal 卡的 `hosted_app` 产物（v3 `cmuw5ctmf01aoicryv3xjkbzp`）**已过期**，
  需按下表原位更新（合并语义＝同 `artifactType:artifactId` 原位替换，见平台 goal-artifact-merge）。
- **待有 owner 凭据者一键落账**（目标大师审视 / owner 均可，PATCH `/api/v1/goals/:id` 的 artifacts 整组
  替换时保留其余条目、仅原位更新下列两条）：

```json
[
  {"op": "hosted_app", "artifactType": "hosted_app", "artifactId": "cmuw2o6z4018picry133zwcio",
   "status": "completed", "detail": "HostedApp=cmuw2o6z4018picry133zwcio（汽车连连看）；deployment v5=cmuwqrrl70051m9lgj8v89gh9 running @ 游戏代码 2626927（分支 myrd/games-goal-cmuw2o88z018ricryvpr6v8wn，v3/v4 superseded）；liveUrl=https://leomac-studio.tail49399e.ts.net/apps/game-9/；/health 身份实测 game-9；线上 pck sha256=ebcb320298abbeaed9a79f71602c413dc757dccf75a772751e40eeb2b24acf2b 与 HEAD 导出一致（第二轮复核 2026-10-06T14:49Z）"},
  {"op": "playtest_kit", "artifactType": "playtest_kit", "artifactId": "games/game-9/qa/playtest-kit.md",
   "status": "completed", "detail": "试玩验收包已刷新到 v5 口径：GODOT_PLAYTEST PASS 两档（900 帧 fb=75/80/76；5400 帧 fb=517/483/518，阈值 tests/playtest.json）+ 移动门禁 10/10（14:19Z 与复核复跑 14:49Z 双证）；量表四问待用户试玩回填，spec 数值零改动"}
]
```

## 四、给 owner 的试玩指引（复核项 ④）

**唯一剩余动作是人工试玩回填并拍板**（机器侧已全绿，但「好不好玩」只有你能裁）：

1. **玩一局**：打开 https://leomac-studio.tail49399e.ts.net/apps/game-9/ （免登录）——
   建议 4×4 与 6×6 各来一局，走完「开始→消除→通关/失败→重新开始」；移动端直接触屏点，逻辑一致；
2. **按量表四问回填**：`games/game-9/qa/playtest-kit.md` §2——① 首分钟看懂与否+卡点；
   ② 想再来的程度 1-5+原因；③ 手感反馈 1-5+分项；④ 节奏断档有无+第几秒；
3. **数值不对就调**：打开调参工作台 https://leomac-studio.tail49399e.ts.net/apps/game-9/?tuning=1
   拖滑杆（start_time_easy/hard、match_points），点「复制调参 URL」把链接一并发回——
   解析 diff 后走 GameDesignSpec revisions 落账再拍板，不偷改 approved spec；
4. **拍板**：试玩通过 → 人工验收拍板，目标方可关闭；不通过 → 打回并写明改什么。

## 五、遗留清单（复核后）

| # | 事项 | 状态 |
| --- | --- | --- |
| 1 | 人工试玩回填 + 拍板 | ⏳ 唯一阻塞（blackboard B1），责任 @ai-verse-bot（owner） |
| 2 | goal artifacts 的 hosted_app 条目原位更新到 v5 | 待有 owner 凭据者按 §3 JSON 一键落账 |
| 3 | 工作流调度 API 权限（L2） | 待补齐后从 implement 补跑，刷新正式工作流结论 |
| 4 | 移动门禁 pass 分支 detail 文案残留失败模板 | 小瑕疵，不阻塞，建议单独小改 |
