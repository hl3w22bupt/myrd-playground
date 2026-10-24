# AppHost 部署壳契约 —— landing.html 与主入口验收（W-3/B-5 判例收口）

> 2026-10-18 立。成因链：line3-tower-defense B-5「/gw 串到 game-9」实为本游戏 build 缺
> `landing.html`；回溯 wheat-squad 当年 W-3 八轮「平台层路由串线」升级同为此成因（靠补
> landing.html 解除，但因果未写回黑板，致 line3 照抄误诊第九次）。本文件把契约固化，
> 新游戏开工即遵守，不再依赖读 wheat 源码找判例。

## 1. 壳解析规则（server/src/index.ts · GET / 的唯一真源）

共享壳 `server/` 对 `GET /` 的伺服顺序：

1. 资产清单里有 **`landing.html`** → 伺服它（本游戏自己的壳，正确形态）；
2. 否则 → 回落内置 `GAME_PAGE_HTML`——那是 **game-9《汽车连连看》的 Godot 壳**（标题硬编码），
   它会去拉 Godot 引导脚本 `api/public/assets/index.js`。纯 Web 游戏资产里没有 index.js →
   404 →「引擎引导脚本加载失败」，且 /health 自报 `app: "game-9"`。

**推论：非 Godot 游戏（build/ 无 index.js+wasm/pck 三件套）缺 landing.html = 主入口必坏**，
而资产面与 LIVE 冒烟可以全绿（绕道直连资产时）——这正是 B-5/W-3 反复漏检的原因。

## 2. landing.html 硬契约（构建期三条）

1. **存在**：`build/landing.html` 必须在产（AppHost assets_dir 即 build/，随部署上传）；
2. **引用一律走 `api/public/assets/*` 相对路径**：如
   `<script type="module" src="api/public/assets/src/main.mjs"></script>`、
   `fetch('api/public/assets/spec.json')`——`/gw` 与裸根 `/apps/<slug>/` 两种入口的相对
   解析都落公开资产路由；**禁止裸 `./xxx` 引用**（会解析到运行时根，运行时只注册
   `/`、`/health`、`/api/public/assets/:name` 三条路由，必 404）；
3. **对账同步**：`build/manifest.json` 的 `files` 必须含 `landing.html`（tools/build.mjs
   步骤③自动收录；构建产物与 manifest 漂移 = 门禁红）。

实现判例：`games/wheat-squad/tools/build.mjs`（landing 生成段）、
`games/line3-tower-defense/tools/build.mjs` 步骤②（index.html 与 landing.html 同源推导，
保证两者永不漂移）。Godot Web 导出（index.js+wasm+pck）走内置 Godot 壳，**不需要**
landing.html。

## 3. 门禁（防复发三道）

| 道 | 位置 | 拦什么 |
|---|---|---|
| 构建日志告警 | 平台 builder：资产上传后无 landing.html 且非 Godot 三件套 → `[assets][warn]` | 部署前最后一眼（需平台版生效） |
| verify 门禁 | 各游戏 `ci/guard-landing-shell.mjs`（line3 已挂 verify.sh ⓪+B 步；其余游戏照抄） | 提交/复跑期，缺文件/裸引用/manifest 漂移即 FAIL |
| N5 验收断言 | 部署后 `GET <liveUrl>/gw` 必须 **200 且 HTML 含本游戏标题**（如「敌潮将至」），而非仅资产面冒烟 | 上线即证主入口，杜绝「资产面可玩但 /gw 串壳」带病收口 |

line3 的门禁脚本可整体复制到其他纯 Web 游戏：`games/line3-tower-defense/ci/guard-landing-shell.mjs`
（零依赖，指向 build/ 目录即跑）。

## 4. 部署操作面判例（顺带收口，源自 line3 N5 实录）

- **建坑先绑项目**：`POST /api/v1/apphost/apps` 若不带 `projectId`，部署会同步被拒
  （「应用未关联 Git 仓库」）。已建的占坑应用用 **`PATCH /api/v1/apphost/apps/:id`
  `{"projectId": ...}`** 补绑后重试即可复用原 slug——**不要重建**（slug 先到先得，
  error 占坑记录会把好 slug 永久挤占，重试被迫 `-2` 后缀，line3-tower-defense 即判例）。
- **平台服务更新**：部署路由、manifestPath（一仓多游戏用 `games/<slug>/apphost.toml`）、
  sourceId 防挤占（认领用 deploy body 传，PATCH 不管它）。

## 5. 历史定谳（读旧黑板前先看这里）

黑板/门禁日志里一切「W-3 页面路由平台层串线」「/gw 壳 md5 ≡ game-9」「/health 自报
game-9」的记录，**真实成因都是缺 landing.html 的壳回落，不是平台转发故障**。平台网关
（`/apps/<slug>/gw` → `?p=` → 反代）自始工作正常。遇到同症状：先查 `build/` 有没有
`landing.html`，再谈平台。
