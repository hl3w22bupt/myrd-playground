# AppHost 应用登记 — g2-blocks（熔炉方块）

> 更新时间：2026-10-05（WX 提审轮部署 · 复用同一坑 `cmuqelj2r0046m9zr4emgdgdg`，发布 wx/port-v1.1 线 Web 产物）
> 用途：一坞一游戏，下一轮**复用同一坑**（不要新建、不要挤占别的游戏的应用）

## 专属坑（2026-10-02 建档 · 沿用）

| 项 | 值 |
|---|---|
| appId | `cmuqelj2r0046m9zr4emgdgdg` |
| name | `g2-blocks（熔炉方块）` |
| slug | `g2-blocks-2`（sourceId 仍 = 游戏 slug `g2-blocks`；`?slug=g2-blocks` 命中的是已删首建坑 `cmuqekaip0044m9zrzod50hgf`，勿用） |
| sourceType / sourceId | `game-studio` / `g2-blocks` |
| status | `ready` |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/g2-blocks-2/ |
| 玩法入口 | `/apps/g2-blocks-2/gw`（壳回源 index.html + 注入 `<base href="api/public/assets/">`，裸根 308 归一到 /gw） |
| health | `/apps/g2-blocks-2/health` → 200 `{"ok":true,"app":"g2-blocks",...}` |
| 产物区 artifactId | `cmuqewt4u004jm9zreo1yw2ue`（kind=app · ready · 幂等复用同一 id） |

## 本轮部署（2026-10-05 · WX 提审轮 · 当前生效）

| 项 | 值 |
|---|---|
| gitRef（分支） | `myrd/run-cmuuk3zvg002oicrykuhulees` |
| 部署提交 | `6b2dce2`（= 远端同名分支 HEAD；v7 current · running · 零 errorMessage） |
| manifestPath | `games/g2-blocks/apphost.toml`（本轮新建：name/runtime/health/assets_dir，一坞一游戏） |
| 导出产物 | `games/g2-blocks/export/web/`（**28 文件**，= 源仓 `g2-blocks-wx@wx/port-v1.1@4fba03a` `build/` **逐字节相等**，`diff -rq` 核对；基线 v1.1 @ fe5fd38 + wx 平台件，v1.2 冻结面零接触） |
| deployment id | `cmuv0ylky004jicryo9x3anbl`（version 7 · current） |
| 线上自测 | **LIVE-SMOKE: PASS**（真浏览器 CDP 直指线上 /gw：可开 + 盘面 64 满员 + 核心循环 0→160→240 chain=1,2 + J1≈170ms ≤ 400ms + 重开复位 + 零控制台错误；原件 `gate-logs/live-smoke-g2-20261005.log`） |
| 资产面 | 28 项 sw.js precache 清单逐一 HEAD **全 200**；`sw.js`/`main.mjs`/`game.mjs` 与仓内导出件 sha256 全等；模块 `.mjs` Content-Type=text/javascript ✓ |

- **产物一致性**：本地构建后先跑 `tools/smoke.mjs`（SMOKE: PASS）再导出，导出件与源仓 build/ `diff -rq` 全等。
- **本轮壳修正披露**：本分支误承糖果硬编码壳（/ 与 /health 写死 candy-crush-legend），首刷 v6 部署「资产对、页面错」（/gw 伺服糖果落地页）。已把 r2/r3 两轮 LIVE-SMOKE PASS 的同一通用壳原样移植进本分支 `server/`（/ 回源 export/web/index.html + base/boot 注入），标识面 stack-tower→g2-blocks（`6b2dce2`）；v6→v7 即修正后重部署。
- **504 受理语义披露**（沿 r2 判例）：两次 POST 网关 504 但服务端均受理 → 产生 v7（现 current）+ v8 冗余重复；v8 构建 failed（无 errorMessage），不影响线上（v7 服务同一 gitRef/manifest，已 LIVE-SMOKE 实证）。纪律：504 后先查受理再决定是否重发，勿盲重。
- **stack-tower 线零接触**：本轮 git 变更只落 `games/g2-blocks/**`、`server/**`、`.myrd/blackboard/**`；`games/stack-tower`、`games/game`、仓库根 `apphost.toml`（candy 线）零触碰；部署目标坑为 g2-blocks 专属坑，未触碰其他游戏应用。
- **与提审包的关系**：本部署 = g2-blocks Web 线（浏览器可玩）当前成果发布；wx 提审包（`g2-blocks-wx` `export/wx/` 30 件 132,607B）独立走微信开发者工具提审，二者不互相替代。

## 上轮存档（2026-10-04 · 部署轮 r3 · v1.2 手感轮）

gitRef `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` · 部署提交 `caaaba2` · 25 文件（v1.2 六项手感 + daily 钩子）· deployment `cmuta82oz001cics1ppn9syak`（v5，已被本轮 v7 supersede）· LIVE-SMOKE PASS（档：上轮 run-cmut4m9ww blackboard/g2-blocks/apphost-app.md）
