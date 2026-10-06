# ACCEPTANCE-REVIEW 复核报告：《汽车连连看》线上版验收复核 + 产物标识回写（goal cmuv35n7o0051icry63ndtamn）

- 日期：2026-10-06
- 复核人：主策划（验收复核节点 · 人机回环前置机判层）
- 分支：myrd/game-15-goal-cmuv35n7o0051icry63ndtamn（本报告所在分支）
- 结论：**机判复核 PASS —— liveUrl 真可玩、门禁证据齐全；产物标识已落盘本文件；平台目标卡片回写被平台侧数据事件阻塞（见 §4），人工试玩拍板仍未完成，目标不得标记 completed**

## 1. 产物标识（权威三元组，供下游节点与人工验收直接引用）

| 项 | 值 | 证据来源 |
|---|---|---|
| HostedApp id | `cmuv35lla004zicrydn7bsuls`（slug `game-15`） | 部署棒 `.myrd/deploy-blocked-report.md`（run 工作区 run-cmuv4ic8l0066icryudr7g1u5）；平台 DB 现查无此行（§4） |
| deployment id | `cmuvbkpnv006xicryrqltdvb2`（v5 部署成功） | 同上 + AppHost runtime 目录 `$TMPDIR/apphost/runtime/cmuvbkpnv006xicryrqltdvb2/`（app.log：`app listening on :41022`）实际存在且在跑 |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/game-15/ | 本节点实测（§2） |
| 部署 commit | `f6cf093d` | 部署棒核验 commitHash 一致；已验证 `f6cf093d` 是部署分支 HEAD `bd6e5a9` 的祖先（部署版本 ⊆ 分支谱系） |
| 部署 gitRef | `myrd/games-goal-cmuv35n7o0051icry63ndtamn`（HEAD bd6e5a9） | 本节点 fetch 实测；坑 5 分支漂移以此为准 |

## 2. liveUrl 真可玩 · 实测证据（2026-10-06 本节点复测）

1. `GET /apps/game-15/health` → **200** `{"ok":true,"app":"car-lianliankan","env":"development","assets":"lazy/object-storage"}`。
2. 落地页壳三要素齐（对照坑 3「零部署」失败指纹逐项排除）：`__audioDebug` 调参桥 ✓、canvas ✓、`<title>汽车连连看</title>` ✓、音频手势解锁器（unlock 逻辑在壳内）✓ —— 非网关占位页。
3. 资产通道 4 路全通：`index.js` 331KB、`index.wasm`（gzip 预压缩）10.5MB、`index.pck` 3.3MB 均 **200**，经壳页 `api/public/assets/` 相对基准加载。
4. 引擎侧网关直证：`GET http://127.0.0.1:3111/apps/game-15/gw?p=health` → 200 同上（AppHost 网关动态路由在伺服 :41022 bundle，与公网 Funnel 链路 leomac-studio→:3001→引擎 一致）。

## 3. 门禁证据齐全 · 核验清单

| 门禁 | 终态 | 证据落点 | 本节点核验 |
|---|---|---|---|
| preflight（13 类静态） | PASS | implement-report.md（判定器 = 仓库 std-skills/godot-game-dev/scripts/preflight.py） | 报告在案 ✓ |
| godot-smoke（240 帧） | PASS（复跑稳定） | implement-report.md + smoke 断言升级说明 | 报告在案 ✓ |
| input-fuzz（seed=20260913） | PASS | implement-report.md | 报告在案 ✓ |
| mobile-web-smoke（390×844 移动仿真） | **PASS 10/10（fps 27）** | `games/game-15/qa/mobile/report.json`（verdict=PASS，checkedAt=2026-10-05T14:07Z）+ 3 张分阶段截图，**已随仓库提交（bd6e5a9 谱系）** | 本节点读库核实 ✓；checks[].detail 为判定器固定失败文案，PASS 以 status/metrics 为准（playtest-report 已辨析） |
| playtest.sh（机器人试玩） | 未跑（模板仓库缺失，既有 blocked 上报沿用，未伪造 GODOT_PLAYTEST） | .myrd/blocked-report.md + playtest-report.md 遗留声明 | 挂账在案，不阻塞本节点 ✓ |
| 部署谱系 | 部署 commit ⊆ 分支 HEAD | `git merge-base --is-ancestor f6cf093d bd6e5a9` PASS；后继 3 commit 均为 docs/证据 | 本节点实测 ✓ |
| apphost.toml（构建步骤 1 清单） | name=car-lianliankan / assets_dir=games/game-15/export/web | 部署分支根 apphost.toml（fetch 实读） | ✓ |

变异测试 ×2（禁洗牌清选中 → FAIL「洗牌失效」；禁 Juice 接线 → FAIL「反馈缺失」，恢复后全绿）在案于 implement-report.md，断言有效性已证。

## 4. 平台目标卡片回写：**被阻塞，升级上报**

- 事实链：本节点会话开始时 `GET /api/v1/goals/cmuv35n7o0051icry63ndtamn` 返回 **403**（记录在、非我所有）→ 数分钟后同端点返回 **404**，此后稳定 404；`GET /api/v1/workflows/runs/cmuv4ic8l0066icryudr7g1u5` 同样「首查成功（返回完整数据）→ 后续稳定 Prisma No record found」。
- 直查引擎实读的 Postgres（localhost:5432/myrd，经对照实验确认：库里另一目标经 API 返回 403、本目标 404）：`goals` / `workflow_runs` / `hosted_apps` / `app_deployments` / `game_design_specs` 中**本目标全谱系 0 行**（design spec cmuv3lyz0005vicryanq7ej03 亦无）。而同为《汽车连连看》主题的新目标 cmuw2o88z018ricryvpr6v8wn 与 hosted_app game-9 于 2026-10-06 10:41（本地）写入正常。
- 判定：平台业务库在会话期间发生**数据丢失/重置事件**，昨日 playtest 棒还能 GET+PATCH 目标 artifacts（bd6e5a9 记录「GET 现状 5 条 + 追加 1 条」成功），今日记录已不可达。这是平台侧事件，非游戏工程缺陷；线上部署与 AppHost 运行时不受影响（网关/进程/对象存储均在伺服）。
- 处置（已做）：产物标识三元组落盘本文件（黑板），下游从分支读取；API 侧重试预算 2 次已用尽，不再空转。
- **补射载荷**（平台恢复本目标记录后，按 playtest 棒同款「GET 现状 + 追加 + 整体 PATCH，不覆盖既有条目」执行）：

```json
{
  "op": "acceptance_review",
  "title": "验收复核：liveUrl 真可玩 + 门禁证据齐全（主策划）",
  "status": "passed",
  "artifactType": "hosted_app_ref",
  "artifactId": "cmuv35lla004zicrydn7bsuls",
  "hostedAppId": "cmuv35lla004zicrydn7bsuls",
  "deploymentId": "cmuvbkpnv006xicryrqltdvb2",
  "liveUrl": "https://leomac-studio.tail49399e.ts.net/apps/game-15/",
  "deployCommit": "f6cf093d",
  "deployGitRef": "myrd/games-goal-cmuv35n7o0051icry63ndtamn",
  "detail": "机判复核 PASS（health 200 / 壳三要素 / 资产 4 路 200 / mobile smoke 10/10 / 部署 commit ⊆ 分支 HEAD）；人工试玩四问量表仍待回填，拍板前目标不得 completed"
}
```

  补射命令：`PATCH /api/v1/goals/cmuv35n7o0051icry63ndtamn`，body 为 `{ "artifacts": [ ...既有条目, 上例 ] }`。

## 5. 验收状态（对齐红线：机器不替人判断「好不好玩」）

- 机判层（连通算法/提示/洗牌/图鉴/关卡推进 + 双门禁 + 线上可玩性）：**全部 PASS**，本节点复核确认。
- 人工层：playtest 棒四问量表（试玩指引 + 调参工作台入口 `liveUrl?tuning=1`）**仍待用户试玩回填**；拍板（approve）未发生。
- 因此：本节点只确认「机判复核通过 + 产物标识固化」，**不宣布目标完成**。待办归 owner：
  1. 打开 https://leomac-studio.tail49399e.ts.net/apps/game-15/ 完成一局（选块/消除/提示/洗牌/过关）；
  2. 回填四问量表（入口见 .myrd/playtest-report.md，iOS Safari / Android Chrome 任一真机尤佳）；
  3. 对平台 DB 数据丢失事件给出恢复/核查结论，使 §4 补射载荷可执行。
