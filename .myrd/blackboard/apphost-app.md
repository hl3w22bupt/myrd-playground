# AppHost 部署坞登记 — g2-blocks（熔炉方块）

> 登记时间：2026-10-06 13:1x（DY 平台段轮 · 游戏程序回写）
> 用途：下一轮直接复用同一坑，不要建新坑（坑谱系见 §二）

## 一、本游戏专属坑（唯一合法目标）

| 项 | 值 |
|---|---|
| appId | `cmuqelj2r0046m9zr4emgdgdg` |
| slug | `g2-blocks-2` |
| name | g2-blocks（熔炉方块） |
| sourceId / sourceType | `g2-blocks` / `game-studio`（防挤占绑定，部署时必带 sourceId=g2-blocks） |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/g2-blocks-2/ |
| 游戏入口 | https://leomac-studio.tail49399e.ts.net/apps/g2-blocks-2/gw （裸根自愈跳 /gw） |
| 本轮 gitRef | `myrd/run-cmuvzeu0a0167icrywu8c0k10` @ `57b3d67` |
| 部署清单 | `games/g2-blocks/apphost.toml`（assets_dir=`games/g2-blocks/export/web`） |
| 当前部署 | v12 running（2026-10-06 13:06 切换，v11 superseded） |
| 产物谱系 | `games/g2-blocks/export/web/` 27 件 = 游戏仓 `dy/port-v1.1` @ `023e583` `tools/build.mjs` 输出（QA 复检锚，逐位复制） |

## 二、坑谱系（本轮处置留痕 · 防误挖）

| 坑 | 处置 | 依据 |
|---|---|---|
| `cmuqekaip0044m9zrzod50hgf`（slug=g2-blocks） | **purge** | 2026-10-02 软删残留：suspended + 零部署（restore 409 / deploy 409 死锁态），平台 purge 路由即该态唯一出口（apphost-apps.ts 注释原文「死条目需要一个真删除出口」）；零产物零损失 |
| `cmuw71jef01biicry268cuyvj`（slug=g2-blocks，本轮误建） | **purge** | 本轮 slug 精确检索只命中死坑、漏检 g2-blocks-2（精确匹配不含后缀坑），按模板误建；发现既有在用坑后即清（error 态 + 零部署），命名空间已还原唯一 |
| `cmuqelj2r0046m9zr4emgdgdg`（slug=**g2-blocks-2**） | **在用 · 唯一合法** | sourceId=g2-blocks 绑定 + v6–v8（上轮）→ v10–v12（本轮）连续部署史 |

## 三、本轮部署证据（2026-10-06）

- 门禁（g2 仓 `dy/port-v1.1` @ `023e583` 干净树上取得）：契约 18/18 PASS · DY 三条目查 3/3 PASS · DY 冒烟 PASS（guide 172ms/17 帧 ≤ 400/240 · 613 手自然炉冷 · 零错误）
- 产物一致性：`tools/build.mjs` 重建 24 模块与已提交 build/ 逐位一致（唯 sw.js 构建期缓存版本号，by design）；部署后线上 `main.mjs`/`sw.js` md5 与本地产物全等
- 壳：根壳按上轮 LIVE-SMOKE PASS 实现原样移植（index/boot-script/asset-bytes/game-page 四件，`57b3d67`，tsc --noEmit 过）；health 标识 g2-blocks
- 线上自测：/health 200 `{"ok":true,"app":"g2-blocks"}` · /gw 标题「熔炉方块 g2-blocks」 · SW 注册（assets 通道） · 控制台零错误 · 首屏截图目验 8×8 炉板 + HUD + 引导条在屏（可复跑取证：`node scripts/apphost-live-smoke.mjs`）
- 部署事故留痕：v9 失败（三并发同内容构建争抢，步骤 1 内 defs esbuild 超 10 分钟中断）——同 commit 的 v10 成功上线后 v12（新壳）顶替；v11 为旧壳过渡版（superseded）。**教训：网关 30s 超时但管线继续跑，deploy POST 只发一次，以轮询为准**

## 四、下一轮操作提示

1. 部署目标：`appId=cmuqelj2r0046m9zr4emgdgdg`，请求带 `"sourceId":"g2-blocks"` + `"manifestPath":"games/g2-blocks/apphost.toml"` + `"gitRef":"<当前分支>"`
2. 先更新 `games/g2-blocks/export/web/`（从游戏仓 build/ 逐位复制）再 commit+push，最后才发起部署
3. deploy POST 网关 30s 会 504，属正常：发一次，随后 GET 轮询 currentDeployment 至 running/failed
4. 上线后跑 `node scripts/apphost-live-smoke.mjs` 自测 + 截图目验
