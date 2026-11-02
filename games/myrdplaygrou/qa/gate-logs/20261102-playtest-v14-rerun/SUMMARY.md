# playtest 节点重跑收口（run cmvyp0n86006zm9y0ysizzt2t，2026-11-02 12:2x–12:4x +0800）

> 结论先行：**移动端可玩性门禁全绿（preHook 降级口径 + 本节点完全口径复跑）+ 本地四门禁全绿 +
> 试玩验收包已交付（`games/myrdplaygrou/qa/playtest-kit.md`）**；
> **goal.artifacts 回写被平台鉴权链 403 阻断（与本 run 发布节点同一根因），本节点按 fail-closed
> 停手并以仓库内交付 + 本目录取证代替，未伪造回写成功**。量表状态 = **待用户试玩**（未收到
> 用户四问结论与调参 URL，第 3 步 spec revisions 回写跳过，不代答不伪造）。

## 1. 门禁资产来源校验（硬约束第 1/2 类，开工前核验）

- `std-skills/godot-game-dev/scripts/`：preflight.py / smoke.sh / input-fuzz.sh / playtest.sh /
  resolve-godot.sh / mobile-web-smoke.mjs **六件全在**（git 跟踪文件）✓
- `.myrd/routines.yaml`：含 `id: godot-smoke` 与 `id: mobile-web-smoke` routine ✓
- `std-skills/godot-game-dev/references/{godot-smoke-routine.md, mobile-smoke-routine.md}` **两件全在** ✓
- 判定只认仓库内路径；`.myrd-platform/.claude/skills/godot-game-dev/` 注入副本未当判定来源，仓库内脚本零改动 ✓

## 2. 移动端门禁（对线上 liveUrl，双口径）

| 口径 | 结论 | 指标 | 证据 |
|---|---|---|---|
| preHook（节点开工自动跑，未带 --project） | verdict=**PASS**；joystick-target=warn（回退旧版固定坐标 swipe，仅取证不断言） | fps=38，tapDiff=5，idleDiff=328，scrollWidth=390=clientWidth | `prehook-report-legacy.json`（checkedAt=2026-11-02T04:23:52Z，本目录留存副本） |
| 本节点复跑 `--project games/myrdplaygrou`（完全口径） | **MOBILE_SMOKE: PASS 11/11**（joystick-response=按规则裁撤：工程无 scripts/virtual_joystick.gd，点按类玩法按 SKILL.md §3A） | fps=39，tapDiff=5，console 零 error，触摸管线通，`__audioDebug` 在位，视口无溢出 | `qa/mobile/report.json`（checkedAt=2026-11-02T04:34:51Z，mode=skipped）+ phase-load/tap/joystick.png（本轮覆盖提交） |

- 两口径**无矛盾**：完全口径把降级口径唯一的 warn 项收口为「按工程裁撤」的 PASS，其余各项结论一致。
- preHook 结论「移动端能不能玩已机判全绿」与证据相符，本节点据此在试玩指引里写实触屏操作说明。

## 3. 本地四门禁（HEAD 6a9c7f1，工程内容 = aa326d2）

`bash games/myrdplaygrou/verify.sh` → **exit=0**（判定脚本全部来自仓库内 std-skills/，薄壳零复制）：

```
PREFLIGHT: PASS 15 类前置一致性检查全部通过（2674 个工程文件）
godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）
GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239
GODOT_PLAYTEST: PASS 3 局全部通过（fb=227/245/248，最长无反馈窗 ≤0.38s，阈值 tests/playtest.json）
verify: PASS preflight + smoke + fuzz + playtest 全部通过
```

证据：本目录 `verify-full.log`。

## 4. 线上版本锚点（本节点独立复算）

- 线上 `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/` `/health` → 200。
- 线上 `api/public/assets/index.pck`（资产通道 gzip+b64 解码 5,605,248 bytes）
  sha256 = `32d79ee289bd5184cb6cc57264ffa20df7ac32bbe159b42bfd11ba1153f3562a`
  = **v14（commit 26c7b62）**，与 v14 收口提交 7a535ee 记录逐字节一致。
- 本地 HEAD 导出 `export/web/index.pck` sha256 = `bd90d979…`（5,607,360 bytes）≠ 线上
  → **df378c9 的两处修复（HUD 挂件审计 / 结算误触窗覆盖触屏按钮路径）已修未上线**；
  试玩验收包 §0 已把这两条列为「线上已知可见缺陷」，请试玩者如实计入量表。
  解除阻塞动作（平台侧修复鉴权链后）：以有属主权限身份按 gitRef=`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv` 重新部署 + 重跑 mobile-web-smoke。

## 5. 交付物

- **试玩验收包**：`games/myrdplaygrou/qa/playtest-kit.md` —— 试玩指引（30 秒上手 + 八关机制地图 +
  音画契约核对点）/ 四问结构化量表（待回填空表 + 打分参照）/ 调参工作台入口 `?tuning=1`
  （16 滑杆 = TUNING_META 全键 + 回写流程）/ 机判底座与版本锚点。
- 权威策划案锚点：平台 GameDesignSpec **v6 approved = `cmvyol366005wm9y0kzkdz57d`**
  （2026-11-02T03:10:07Z；v1–v5 superseded；本节点 goalId 通道只读核验成功）。

## 6. goal.artifacts 回写：blocked（鉴权链，非本节点可解）

- 本 run 由目标大师代触发，节点 token（workflow-node，userId=cmvtaqy0h000sm9sfukbpdks5，
  **无 actFor**）既非 goal owner（owner=Admin）也非 admin：
  `GET /api/v1/goals/cmvxjycvn001zm905jnwpyliv` → **HTTP 403「无权访问」**
  （requestId=req_1793594223318，本目录 `artifact-writeback-attempt.log`）。
- 读不到现有 artifacts 数组 → 无法安全执行「PATCH 合并、不覆盖已有条目」；**不做盲写**（盲写有覆盖
  丢失既有条目的风险，且同一路由的属主校验必然再 403）。
- 与本 run 发布节点 `qa/gate-logs/20261102-release-blocked-identity/SUMMARY.md` §3 同一根因、同一修复建议：
  ① 目标委派 run 的 `triggeredByUserId` 落成目标 owner；或 ② `workflowNodeTokenPayload` 为目标委派
  run 增发 `actFor=owner`。修复后按 `playtest-kit.md` 的条目对象一键回写：
  `{"op":"playtest_kit","artifactType":"playtest_kit","title":"《植物人大战僵尸-网页版》试玩验收包（线上 v14）","status":"completed","detail":"…指向 qa/playtest-kit.md…","url":"https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/?tuning=1"}`

## 7. 量表状态（如实声明）

- 四问量表**未回填**：试玩结论只能来自用户，本节点不产生任何「好玩/通过」类结论；
- 调参 URL 未收到：第 3 步（spec.numeric revisions + approve + `op=tuning_applied` 回写）**跳过**；
- 本节点自主工作（验收包交付 + 门禁复验取证 + 分支推送）已全部完成，节点收尾。
