# N1 部署证据 — run `cmuouq3u0003im97tyhjci0kc`（2026-10-01）

> 本轮部署面 = 当前续接分支上**已可玩的游戏产物**（stack-tower 线，本分支历轮发布的同一坑位）。
> g2-blocks 本轮为 spec 轮（v1 draft 待主人 approve），**无可玩产物、未建坑、未部署**——
> 红线「approve 前零冻结值实现投入」生效中；g2-blocks 专属坑留给 approve 后实现轮按 slug 精确检索/新建。

## 1. 硬前置核对（三过三）

| # | 项 | 结果 | 证据（命令 → 输出摘要） |
|---|---|---|---|
| 1 | 分支非 main | ✅ | `git branch --show-current` → `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` |
| 2 | 分支已推远端、无领先提交 | ✅ | `git ls-remote --heads origin \| grep pixel-fives-m0-m1` → `25b541d` = 本地 HEAD；显式 fetch 后 `FETCH_HEAD = 25b541d`（refspec 仅 main，故无 origin/<branch> 跟踪引用，以 ls-remote+FETCH_HEAD 为准） |
| 3 | 专属部署清单在档 | ✅ | `games/stack-tower/apphost.toml`：name="Stack Tower" / runtime=node20 / health="/health" / assets_dir="games/stack-tower/export/web"（仓库根 apphost.toml 属糖果线，未触碰） |

## 2. 导出（产物 ≡ 代码）

- `git diff --name-only 5ed680b..HEAD -- games/stack-tower`（排除 export/docs/tests/tools/assets/tt/wx）→ **空**：web 输入面自上次导出提交后零变化。
- 重建复核：`npm install`（typescript@~5.9.3，1 包）→ `npm run build`（tsc，exit 0）
  → `diff -rq build export/web/build` → **BYTE-EQUAL**；`index.html` / `manifest.webmanifest` / `sw.js` 三件 **EQUAL**。
- 结论：`games/stack-tower/export/web` 与 HEAD 代码一致，**无需新导出提交**（本轮零游戏代码改动：
  `git diff --stat b7b22ae..HEAD` = 34 files 全部 `.myrd/` 文档面，games/stack-tower 段为空）。
- 工作区收口：`git status --porcelain` → **0 行**；一号 tracked 工程面 diff → **空**。

## 3. 坑位核对（防挤占）

- slug 精确检索 `GET /api/v1/apphost/apps?slug=stack-tower` → 命中 `cmugts0ip000gm929wcnap4x9`
  （status=**suspended**、软删占位、零部署）→ 按黑板「appId 优先」**避开**。
- 实查既定坑 `GET /api/v1/apphost/apps/cmugttipt000km9299oej5z9b` →
  `{name:"Stack Tower", slug:"stack-tower-3", status:"ready", sourceType:"game-studio", sourceId:"stack-tower"}`
  → 绑定即本游戏，**防挤占校验通过**；部署前 current = v24 `cmuo5gf3h01d1m9lfogqku3s9`（commit b7b22ae，2026-09-30）。

## 4. 发起部署

```
POST /api/v1/apphost/apps/cmugttipt000km9299oej5z9b/deployments
{"mode":"bundle","deployedBy":"workflow",
 "gitRef":"myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d",
 "manifestPath":"games/stack-tower/apphost.toml","sourceId":"stack-tower"}
```

- 首发响应 **HTTP 504**（代理 30s 截断）→ 按台账既定处置**先 GET 复查**，非盲目重试：
  复查见新单 `cmup4pal9000am94pplui7hwo` version 25 status=building（**已受理**）→ 无需重发。
- 轮询（仅看部署单自身状态；appStatus=ready 不作终止判据——首轮脚本误判已纠正）：
  building ×4 → **running**（2026-10-01，durationMs 842，errorMessage null，commitHash `25b541d`，已切 current）。

## 5. 线上自测（liveUrl `https://leomac-studio.tail49399e.ts.net/apps/stack-tower-3/gw`）

| 检查 | 结果 |
|---|---|
| `/health` | **200** `{"ok":true,"app":"stack-tower","env":"development","assets":"lazy/object-storage"}`（壳身份正确） |
| `/` | 308（去尾斜杠）→ `-L` 后 **200** text/html 3861B，壳 index.html 含 `<base href="api/public/assets/">` |
| 新版本指纹 4 件（`/api/public/assets/` 路由） | `sw.js` / `build/main.js` / `build/app/boot-tt.js` / `manifest.webmanifest` 全 **200** |
| 逐字节比对 | 线上 `sw.js` sha256 `e0e6eb640dd0182e`（5368B）≡ 本轮 HEAD 导出件；线上 `build/main.js` ≡ 本轮 HEAD 导出件 → **线上即本轮 HEAD，非旧缓存** |

## 6. 登记回执

- 团队产物区入口：POST `/api/v1/agent-teams/$MYRD_TEAM_ID/artifacts`（hostedAppId=`cmugttipt000km9299oej5z9b`，runId=`cmuouq3u0003im97tyhjci0kc`）→ 幂等登记，回执见 blockers.md 台账行。
- 目标卡片入口：run 输出末行 `[CHECKPOINT] {"op":"deploy_playable",…}`。
- 黑板：`.myrd/blackboard/g2-blocks/blockers.md`「N1 部署登记」节（本 run 产品区新增，一号顶层三件零覆盖）。
