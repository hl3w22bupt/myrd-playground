# 部署轮 r3 · 2026-10-04（v1.2 手感轮产物上 AppHost · workflow deploy 节点）

> 执行：游戏程序（deploy 节点）· 源仓 `g2-blocks` @ `6d3db6a`（v1.2 D1–D6 驳回修复轮收口态，树净）
> 一坞一游戏：复用专属坑 `cmuqelj2r0046m9zr4emgdgdg`（slug `g2-blocks-2` · sourceId `g2-blocks`），**未新建坑**
> 结论：**LIVE-SMOKE: PASS · 部署完整性 DEPLOY-INTACT · stack-tower 线上零接触**

## 结果一览

| 项 | 值 |
|---|---|
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/g2-blocks-2/ |
| 玩法入口 | `/apps/g2-blocks-2/gw`（裸根 308/壳自愈 → /gw） |
| gitRef | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `caaaba2`（`git ls-remote` 与远端全等） |
| manifestPath | `games/g2-blocks/apphost.toml` |
| 产物 | `games/g2-blocks/export/web/` 25 文件（22 → 25：新增 `daily.mjs` / `render/feel.mjs` / `generated/feel-data.mjs`） |
| deployment | `cmuta82oz001cics1ppn9syak` · version **5** · current · running · 零 errorMessage |
| 产物区 artifactId | `cmuqewt4u004jm9zreo1yw2ue`（POST 201 · 幂等复用同一 id） |

## 归档清单

| 件 | 内容 | 结果 |
|---|---|---|
| `01-contract-mode-a.log` | 部署前契约（Mode A · approved v1.1 · 默认装载） | 18 PASS / 0 FAIL · EXIT=0 |
| `02-build.log` | `node tools/build.mjs` | BUILD 22 modules → build/ · EXIT=0 |
| `03-smoke.log` + `.j1-evidence.json` | 部署前冒烟（同批证据对，D3 纪律：先 log 后同批 cp） | SMOKE: PASS · EXIT=0 |
| `04-live-smoke.log` | 线上真浏览器 CDP 冒烟（判据面同源仓 smoke：可开/满员/可玩/粒子上屏/重开/零错误） | **LIVE-SMOKE: PASS** · J1=151.2ms ≤ 400ms · EXIT=0 |
| `05-artifact-bytewise.log` | 线上 25 文件逐一与提交件字节比对 + 差异归因 | 23 字节全等 + 2 件壳注入/改写 → **DEPLOY-INTACT** |
| `06-live-endpoints.log` | `/health` `/` `/gw` + v1.2 三新模块 + sw precache | 全 200 · precache 含三新模块 |

## 关键判定

1. **产物一致性**：`diff -rq` 源仓 `build/` ↔ 部署面 `export/web/` 逐字节相等（导出时点）；线上复验 23/25 文件字节全等，`index.html`（壳注入 base href + 自愈脚本）与 `manifest.webmanifest`（`start_url`/`scope` 挂载路径改写）为平台壳文档化行为，游戏代码零漂移。
2. **v1.2 特征在线上可验证**：`render/feel.mjs` / `daily.mjs` / `generated/feel-data.mjs` 均 200；真浏览器冒烟实测**消除粒子上屏 drawn=8**（= `numeric.feel.particles.perClearBase`）——即 D1 修复的视觉面确已上线。
3. **零接触**：本轮 git 变更 10 条路径全部位于 `games/g2-blocks/export/web`（7 改 + 3 增）；`games/stack-tower` / `games/game` / 根 `apphost.toml` 零触碰。
4. **受理纪律**：单次 POST（吸取 r2 网关 504 重复受理教训），本轮 504 后只轮询不重发 → 服务端仅受理一条（version 5，无重复）。
5. **J1 三跑**：部署前本地 173.8ms（`03`）· 线上 153.6ms / 151.2ms（两次 `04`），均 ≤ 400ms 预算，处于历史族带宽内。
