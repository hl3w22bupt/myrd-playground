# 阶段5 · 放映页部署与线上自查（DEPLOY）

> 部署对象：AppHost 应用 `cmw8yl0gn000vm9at4fwrzu3z`（slug `myrdplaygrou-2`，视频工坊 · 名「以柔克刚」）。
> 部署时刻：2026-11-09 19:54–20:15（本地时区 UTC+8）；分支 `myrd/video-yiroukegang-goal-cmw8yl0gs000xm9atm3ev9bzc`（线上=分支一一对应，未碰 main）。
> liveUrl：`https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-2/`
> 当前有效部署：**v4 = `cmw97x12n0023m9p0jnzktgq8`，status=running**，commitHash `663d77f` = 分支 HEAD。

## 0. 前置检查（缺一即停，全绿才部署）

| 检查 | 读数 | 结论 |
| --- | --- | --- |
| 分支 | `git branch --show-current` = `myrd/video-yiroukegang-goal-cmw8yl0gs000xm9atm3ev9bzc` | ✓ |
| 成片存在 | `videos/myrdplaygrou-2/renders/myrdplaygrou-2_2026-11-09_19-02-59.mp4` 25,684,079 字节非空（ffprobe 61.600s / 1920×1080 / h264+AAC） | ✓ |
| 仓库可推 | origin=github.com/hl3w22bupt/myrd-playground，部署前远端 HEAD=本地 HEAD（8115450 → 部署后 47c4ffa → 663d77f 逐次核对） | ✓ |
| 应用绑定 | HostedApp sourceId=`cmw8yl0gs000xm9atm3ev9bzc`（本 goal，防挤占匹配通过） | ✓ |
| 鉴权姿势 | 工作流注入 token 的 userId 不存在（身份链断）→ 按项目知识《部署身份链 403 根因谱系与宿主代行解锁》走**宿主代行**：项目属主本人（admin=app owner 同一人）Cookie 会话执行部署 | ✓ |

## 1. 部署姿势（一仓多应用 + 分叉期绑分支）

- 部署请求：`POST /api/v1/apphost/apps/cmw8yl0gn000vm9at4fwrzu3z/deployments`
  `{ gitRef: "myrd/video-yiroukegang-goal-cmw8yl0gs000xm9atm3ev9bzc", manifestPath: "videos/myrdplaygrou-2/apphost.toml", deployedBy: "workflow", goalId: "cmw8yl0gs000xm9atm3ev9bzc" }`
- `manifestPath` 按应用分置（平台「一仓多游戏每游戏一份清单」机制）：仓库根 `apphost.toml`（PvZ 应用，部署自 main）不受本分支影响。
- 显式 `gitRef`：缺省=project.branch(main)，不传就部署 main——按项目知识钉死「线上产物与验收所依据代码一一对应」纪律。
- 部署历史：v1 `cmw97duvj…`（8115450）→ v2 `cmw97n4je…`（c41bdfc）→ v3 `cmw97rjsb…`（47c4ffa）→ **v4 `cmw97x12n…`（663d77f，running）**；每次推进都由线上实证缺陷驱动（§3）。

## 2. 静态壳契约与资产通道（工程目录收敛申报）

- 壳 = 仓库 `server/`（Node20 + Hono）：`GET /` 优先伺服 assets_dir 内 `landing.html`（平台契约）；资产经 `/api/public/assets/:name{.+}` 从对象存储懒加载。
- 放映页 `landing.html`：深色底 + `<video controls>` + 片名/时长/画幅/配音徽章 + 成片与两变体的播放/下载按钮 + 巡礼四段式节拍表 + 工程出处表 + **「示意渲染 · 非真实影像」**标注（中文文案）。
- **偏离申报**：任务字面「assets_dir 指向 videos/myrdplaygrou-2」不可行——平台护栏 `assetsMaxFiles=200`（builder.ts uploadAssets），工程整目录已提交 **519 个文件**（assets/fonts 407 为主）必被 BuildError 拒绝；实际收敛到 `videos/myrdplaygrou-2/apphost/`（**41 文件 / 78MB**，≤200 文件 / ≤200MB 双护栏内）。已在 apphost.toml 注记与产物 detail 同步申报。
- **视频走文本通道**（两层平台边界，均实测钉死）：
  1. M1 资产通道对非 gzip 二进制做 UTF-8 解码（有损）+ 公网网关拦 `video/*`、`application/octet-stream`（502 UNSUPPORTED_BINARY）→ mp4 以 base64 文本资产出库；
  2. 超大单体文本响应（34.2MB / 22.0MB 实测）被平台传输层以 `invocation_stopped` 拒绝（0.16s 秒拒，非超时；17KB 正常；实例直连 34MB 0.05s 正常——故障在引擎传输层）→ 按 **2MB 分片**出库（17/11/12 片），距失败样本 16 倍裕度。
- 完整性机判：三组分片重拼 sha256 与仓库对应 mp4 **逐字节一致**（部署前本地 + 部署后公网各机判一次）：
  - 成片 `95aed34bffaf45d1b4d4316df51b0fed58f6e93d9f34adf65182489ceaae9e7a`
  - v2 `1d752d3c5ef0d4238135ec321e7854d2622664d30fe5a8e9dd4a228ee562a48c`
  - v3 `ae27467c6671719c04c4065d4ef146859818cec2e04c38c28ec9cf173c3ed3a8`

## 3. 线上实证驱动的三轮修复（不带病交付）

| 轮 | 线上症状 | 证据 | 修复 | 提交 |
| --- | --- | --- | --- | --- |
| v1→v2 | 成片单体 b64（34.2MB）公网 500 `invocation_stopped`；22MB 同症 | curl 实录（0.16s 秒拒）+ 实例直连对照（200，0.05s，头字节=mp4 ftyp box） | 2MB 分片 + 页面分片装配器 | `c41bdfc` |
| v2→v3 | webapp-smoke 抓到 tap 后资产 404：`/apps/api/public/assets/...`——无尾斜杠落地时相对路径解析错位 | smoke WARN 404 行 + report.json | BASE 改按 `location.pathname` 构造 `<slug>` 前缀绝对路径（三形态机判等价） | `47c4ffa` |
| v3→v4 | smoke 触摸管线 FAIL：tap 实际命中播放键、装载到 100%（phase-tap.png），但 34MB 同步解码占死主线程、swipe 的 touchmove 被饿死 | phase-tap.png「装载中 100%」+ smoke touch 计数 | 解码改异步分片（1MB 切片、片间让出事件循环）+ 进度分母归位（b64 总字节 / 解码字节数两段报） | `663d77f` |

## 4. 部署后自查（全部通过，v4 线上实测）

| 检查 | 口径 | 读数 | 结论 |
| --- | --- | --- | --- |
| 页面 | `GET liveUrl`（308 归一后） | HTTP 200，17,797 字节，含标题/播放器/下载/「示意渲染 · 非真实影像」 | ✓ |
| 健康 | `GET liveUrl/health` | `{"ok":true,"app":"myrdplaygrou-2","title":"以柔克刚","kind":"video-screening"}` | ✓ |
| 资产面 | 成片 17 分片逐片经公网拉取 | 全 200 · `text/plain; charset=utf-8` · 16×2,097,152 + 691,009 = 34,245,441 字节；404 探针（不存在分片）正确 404 | ✓ |
| 完整性 | 公网分片拼装 → base64 解码 → sha256 | 与仓库母带逐字节一致（95aed34b…） | ✓ |
| 门禁 | 仓库判定脚本 `std-skills/web-app-dev/scripts/webapp-smoke.mjs`（移动仿真 390×844/DPR3/iPhone UA） | **WEBAPP_SMOKE: PASS** 6/6（网络全通/console 零 error/首屏非纯色/DOM 有内容/触摸管线/无横向溢出） | ✓ |
| 播放 | 自查探针 `qa/mobile/video-probe.mjs`（CDP 真实浏览器，非门禁判定源） | **VIDEO_PROBE: PASS**：状态「就绪 · 24.5 MB 已可播放/下载」、readyState=4、**1920×1080 首帧解出**、duration=61.6s、currentTime 3.2s 前进、下载链接=完整 mp4 Blob（文件名 以柔克刚_1080p_61.6s.mp4）、17 分片全 200、console 零错误 | ✓ |
| 帧证据 | `probe-playing.png` | 真实浏览器播放中画面：片头匾额「以柔克刚 / 动量与缓冲·球道巡礼 / 微缩示意模型 · 非真实影像」+ diorama 球道（十瓶/球/气泡膜展台）+ 字幕「一颗按规则最重十六磅的保龄球起步，」 | ✓ |

## 5. 产物回写

- 部署接口 `goalId` 自动回写 4 条 `deploy_playable`（v1–v4，含历史，deployment id 即 artifactId）。
- 手工补充 2 条（PATCH /api/v1/goals/cmw8yl0gs000xm9atm3ev9bzc，回读验证 10 条在账）：
  - `deploy_screening_page`：HostedApp id / deployment id（v4）/ liveUrl / 姿势 / assets_dir 偏离理由 / 自查证据汇总；
  - `video_render_mp4`：成片与变体仓库相对路径 / sha256 / 放映页资产映射。

## 6. 已知边界（如实申报，不掩盖）

1. 播放需先装载 ~34MB 文本并本地解码（数秒级，页面有进度反馈）；Range 流式播放、外链直下 mp4 等待 M2 流式代理（平台已知边界）。
2. 部署 POST 经 30s 网关代理会 504，但部署在后台完成（平台文档化行为）——以 GET deployments 轮询为准。
3. 分片方案是 app 侧收敛，不改平台；若 M2 支持二进制/流式，可退回直链 mp4。

—— 部署 agent · 视频工坊 · 2026-11-09
