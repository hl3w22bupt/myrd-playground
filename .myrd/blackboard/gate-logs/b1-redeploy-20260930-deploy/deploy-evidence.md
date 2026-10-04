# B1 追加部署证据 — version 23 @ 885324a（2026-09-30 01:27 UTC+8 · deploy 节点）

> 背景：B1 收口态（c0a31f6，v22）之后程序线追加 N2 美术线接线增量（59271a2）+ 平台自动提交
> （885324a）。本轮 = 把当前分支 HEAD 发布上坑 `cmugttipt000km9299oej5z9b`（stack-tower-3），
> 流程与 B1 首次发布完全一致（同一坑、同一 manifestPath）。

## 0. 硬前置核对（缺一不部署）

| 项 | 结果 |
|---|---|
| 当前分支 ≠ main | `git branch --show-current` → `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` |
| 分支已推远端且同步 | `git ls-remote --heads origin <branch>` → `885324a8103d…` = 本地 HEAD（无领先提交） |
| 专属部署清单 | `games/stack-tower/apphost.toml` 在档（name/runtime=node20/health=/health/assets_dir=export/web） |

## 1. 导出一致性（产物 ≡ 代码）

- 依赖就绪：`games/stack-tower/node_modules` 在档（跳过 install）。
- `npm run build`（tsc -p tsconfig.json）→ exit 0，无错误。
- `diff -rq build export/web/build` → **空**（逐字节全等）。
- `index.html` / `sw.js` / `manifest.webmanifest` → 逐一 diff 相等。
- `diff -rq assets export/web/assets` → 仅 `bgm/`、`wx/` 两目录不在导出面
  （发布配方口径：bgm 属 wx 链路资产、wx/ 属提审包，PWA 面不含；与 v16 起历轮一致）。
- 结论：**export/web 已与 HEAD 全等，无新增导出提交**（工作区 `git status` 干净）。
- 发布前基线：`node scripts/contract-check.mjs` → **RESULT: PASS**（39/40 可跑，acc-a7 not-runnable 按案单列）。

## 2. 部署通道实录

- 坑位核对（防挤占）：GET `/api/v1/apphost/apps/cmugttipt000km9299oej5z9b` →
  `{name:"Stack Tower", slug:"stack-tower-3", sourceType:"game-studio", sourceId:"stack-tower", status:"ready"}`，
  绑定即本游戏（sourceId=stack-tower），复用不新建。
- `POST /api/v1/apphost/apps/cmugttipt000km9299oej5z9b/deployments`
  body `{mode:"bundle",deployedBy:"workflow",gitRef:"myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d",
  manifestPath:"games/stack-tower/apphost.toml",sourceId:"stack-tower"}`
  → **HTTP 504**（与 B1 首发同形态：代理 30s 截断）。
- 按「504 ≠ 失败」先 GET 复查：**受理成功**，新单
  `cmumy0u0g0134m9lfql75zkkq` · **version 23** · status=building（无重发，避免双单）。
- 轮询：building → deploying → **running**（在服形态，同 v22）；`commitHash=885324a8103d…`（= 本轮 HEAD），
  `currentDeploymentId` 已切 v23，`durationMs=824`，`errorMessage=null`，appStatus=ready。
- v22（cmum141az… @ c0a31f6）被本次 superseded。

## 3. 线上自测（liveUrl `https://leomac-studio.tail49399e.ts.net/apps/stack-tower-3/gw`）

- `GET /health` → **200** `{"ok":true,"app":"stack-tower","env":"development","assets":"lazy/object-storage"}`。
- `GET /`（跟随 308）→ **200** text/html 3861B（出壳）。
- 指纹比对（本地 export/web vs 线上 `/api/public/assets/` 路由，sha256 前 12 位）：
  - JS：`build/ui/meta-daily-card.js`（本轮新增模块）`build/render/assets.js` `build/app/main.js`
    `build/main.js` `build/meta/{claim,daily,save,seed,streak}.js` `build/telemetry/meta.js` `sw.js` → **全等**；
  - 二进制（平台经 base64 文本封装传输，`content-type: text/plain`，解码后比对）：
    `assets/meta/{daily-challenge-card,streak-badge,icon-badge}.png` `assets/icons/icon-192-maskable.png`
    `assets/meta/manifest.json` → **解码后全等**；
  - 合计 **17/17 全等**（此前误报 2 项 mismatch 为未解码 base64 所致，已复核排除）。
- `node tests/live-smoke.mjs <gw-url>` → 核心循环 **7/7 PASS**（画布 480×720 / 分数 0→45 / 重开复位 /
  PNG 字节通道 / M4A / 音频可解码）；FAIL 3 项 = **U6/R2 已立案既有态复现**
  （SW 未控制页面 / 断网 reload / SW scope 壳层成因），与 B1 收口态逐字同形态，非本轮回归，
  沿既有裁定不碰壳、维持升级主人。

## 4. 产物区登记

- `POST /api/v1/agent-teams/$MYRD_TEAM_ID/artifacts` `{hostedAppId, runId}` → **201**，
  artifact `cmugut4ck000vm929ufwgefhl` · hostedAppSlug `stack-tower-3` · status=ready（幂等命中既有条目）。

## 5. 挂账（非本轮新增）

- **META_CACHE_EPOCH 1→2（触达已缓存 v2 的回头用户）**：仍待主策划拍板（blockers.md 美术线增账第 3 条），
  本轮按既有 acc-b8 冻结口径不动 SW 版本。
- **U6/R2 壳层三选一**、**wx 提审拍板**：继承挂账，归主人。
