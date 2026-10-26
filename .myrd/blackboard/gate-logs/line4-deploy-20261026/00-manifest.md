# line4-unblock-jam 首次真实部署留痕（2026-10-26 · 工作流 deploy 交接执行）

| # | 步骤 | 命令/请求 | 结果 |
|---|---|---|---|
| 0 | 远端 HEAD 对齐 | `git push origin myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` → `bc3cd56..4f8ad15`；`git ls-remote` 实测远端=本地=`4f8ad155c45a5e7d194fb10227ad49a30da56845` | ✅（部署输入=远端 HEAD 判例） |
| 1 | 建坑（绑 projectId） | `POST /api/v1/apphost/apps` `{name:"line4-unblock-jam（挪出一条路）", slug:"line4-unblock-jam", projectId:"cmto0g28j0002m9sqnvjdy8o7", runtime:"sandbox", sourceId:"line4-unblock-jam"}` → **201** | ✅ appId=`cmvollw2z001dm91k4ptf30aw`（slug 无后缀）· `01-app-create.json` |
| 2 | 部署 POST | `POST /api/v1/apphost/apps/:id/deployments` `{gitRef:分支, manifestPath:"games/line4-unblock-jam/apphost.toml", commitHash:4f8ad15…, mode:"bundle", dryRun:false}` → **HTTP 504（代理 30s 截断）** | ⚠️ 按判例不盲重试 → 先 GET 复查 |
| 3 | GET 复查 | `GET …/deployments` → **200**：**恰 1 张单** `cmvolm4s7001fm91knv2x7mci` status=building → 504≠失败判例再证，**零重复部署** | ✅ `03-deployments-recheck.json` |
| 4 | 轮询 | building → **running**（finishedAt=2026-10-26T01:50:04.719Z · errorMessage=null）· running=live（wheat/line3 判例口径） | ✅ |
| 5 | LIVE 主入口对账 | `GET http://localhost:3111/apps/line4-unblock-jam/gw` → **200 · HTML 含本游戏标题「挪出一条路 · line4-unblock-jam」** · 壳引用走 `api/public/assets/src/main.mjs`（landing.html 壳生效，零 game-9 串壳=W-3/B-5 判例过关） | ✅ |
| 6 | 资产面 LIVE 直读 | `/apps/<slug>/api/public/assets/*` 经 :3111 网关 404；**line3 同型对照**（`/apps/line3-tower-defense-2/api/public/assets/src/main.mjs` 亦 404，该部署 10-18 起健康 running）→ 判定为**本地网关面限制非部署缺陷**；tailscale liveUrl 沙箱不可达（HTTP 000） | ⚠️ 环境限制如实登记，不冒领资产面 LIVE 直读 |
| 7 | 构建锚对账（仓内面） | ~~gitSha=4f8ad15 前缀（重建后同值）~~ **〔勘误 2026-10-26 续接核实轮：原记 4f8ad15 系未实读文件的虚记，以实物为准——见下方三锚表〕** specAnchor=`cmvlrc0ma001tm94ialxeykjn@v2:approved` · files 21 含 landing.html；smoke-playable 消费该产物 68 断言 PASS | ✅（勘误后） |

### 构建锚三值对账表（勘误轮补 · 实物为准）

| 锚点 | 值 | 取证 |
|---|---|---|
| 仓内 `export/web/manifest.json:2` | `bc3cd5669e…`（bc3cd56=可玩基线轮构建锚） | `sed -n 2p export/web/manifest.json` 实读 |
| 仓内 `export/web/src/main.mjs:1`（`__L4_BUILD__`） | `bc3cd5669e…`（与 manifest.json 同值） | `head -1 export/web/src/main.mjs` 实读 |
| 续接轮重建（`line4-recheck-20261026-continuation/verify/07-build.log:4`） | `0d40be68`（构建时 HEAD；与仓内产物**仅 gitSha 锚行差异，其余逐字节一致**=确定性零源码漂移，产物已恢复原 build 保持部署字节一致） | 07-build.log 实跑 |
| 部署输入 commit | `4f8ad155…`（部署单 commitHash；**≠构建锚**——4f8ad15 轮仅黑板文档，源码/构建产物自 bc3cd56 零变更，`git diff --stat 4f8ad155..0d40be6 -- games/line4-unblock-jam/src games/line4-unblock-jam/export`=空） | 部署单 + diff 机判 |
| **线上 `main.mjs` 头部 `__L4_BUILD__`** | **待归档（我方沙箱不可达）**——预期=`bc3cd56…`（bundle 模式线上=仓内文件拷贝）。由具备 tailscale 通道一方归档：`curl -s https://leomac-studio.tail49399e.ts.net/apps/line4-unblock-jam/api/public/assets/src/main.mjs \| head -1`（或浏览器 devtools → Network → main.mjs → Response 首行）；**若线上锚∉{bc3cd56,4f8ad155} → 查部署构建输入并重部署** | 本 manifest 追加归档件 |

- **试玩入口**（主人侧）：`https://leomac-studio.tail49399e.ts.net/apps/line4-unblock-jam/`（或 `/gw`）。
- 部署 id：`cmvolm4s7001fm91knv2x7mci`（running @ `4f8ad155`）· app：`cmvollw2z001dm91k4ptf30aw`。
- 请求/响应原件：`01-app-create.json` · `02-deploy-post.json`（504 空体）· `03-deployments-recheck.json` · `04-app-final.json`。
