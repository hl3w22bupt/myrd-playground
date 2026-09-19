# 三 Bug 修复落地验证与发布收口（v2.2.1-hotzone-hint-fix）

> **定位**：QA 复核报告（RECHECK-REPORT.md，三 Bug 均 unconfirmed/resolved 之前态）的**修复落地验证**。
> 本轮把两项 P1 的修复真正导出成 Web 产物（上轮兜底修复只合了源码、未重导出——线上指纹不变即未修复），
> 并在本地同口径仿真中全部转绿。**部署与 artifacts 回写由持有平台凭据的发布节点执行**，交接参数见 §四。
> 日期：2026-09-19。

---

## 一、三 Bug 核验结论（本构建 = 本地实测）

| # | 缺陷 | 上轮复核结论 | 本轮终态 | 证据 |
|---|---|---|---|---|
| 1 | 选项热区 DPR 换算失效（P1，cmu85yqnf002wm9x5807ozpv2） | unconfirmed（线上 14.7 CSS pt） | ✅ **resolved** | A6-hotzone44 PASS：73 逻辑px × 生效contentScale1.828 = 133 物理px ≥ 44×DPR3=132（= **44.5 CSS pt**） |
| 2 | 壳层 #hint 遮挡选项/对话（P1，cmu85yvsh002ym9x517ufmbrj） | unconfirmed（重叠 3200px²） | ✅ **resolved** | G3-hint-overlap PASS：`{"hidden":true}` —— 触屏环境（含 Playwright 触屏仿真）提示条不再显示，重叠=0 |
| 3 | 冒烟默认帧预算误判 FAIL（P2，cmu85z7k50030m9x54nfnyo7o） | resolved（上轮已修：默认 120→240） | ✅ **resolved（保持）** | 裸跑 `bash std-skills/godot-game-dev/scripts/smoke.sh games/ai` exit=0、PASS 标记齐全 |

**修复后仿真：28/28 通过**（iPhone 13 DPR3 全流程 26 项 + Pixel 7 DPR2.625 冒烟 2 项；v11 基线 26/28）。
复现命令：`cd games/ai/qa/mobile-touch-acceptance && QA_LIVE_URL=<部署后liveUrl> node qa_mobile_touch.mjs`（本地验证时 `QA_LIVE_URL=http://127.0.0.1:8791/`）。

## 二、本轮修复内容（全部在源码层，未动门禁判定脚本）

1. **选项卡布局炸弹（新发现并修复，是 DPR 修复的伴生回归）**
   `games/ai/scripts/main.gd` `_rebuild_options`：Button 自带 autowrap 的最小高度按「最窄换行宽度」估算，
   canvas_items 容器 resize 时序下 combined min 被缓存成 **504 逻辑 px 巨卡**（web 探针 OPTDUMP 实测，
   btn1/2 正常 96）——巨卡吞掉整屏点按热区、中央点按被误选成选项结算。修复：选项文案改走
   **全幅子 Label**（autowrap/居中/裁剪/点击穿透），Button 自身无文本，最小高度恒等于热区契约值。
   冒烟 13c 同步升级：新增「高度 ≤ option_button_max_height 上限」「按钮不携带自带文本」两条断言防回归。

2. **生效内容缩放推导（A6 的根因收口）**
   `main.gd` `_engine_content_scale`：`Window.content_scale_factor` 属性返回**设定值**（默认恒 1.0），
   不是 canvas_items+expand 的**生效缩放**（iPhone 13 探针实测：属性=1、实际=1170/640=1.828）。
   修复：显式设定值 ≠1 才采信属性，否则按「窗口物理尺寸 / 视口逻辑尺寸」推导（disabled/headless 下比值=1，零回归）。
   修复后热区链路：ceil(44×3/1.828)=73 逻辑px → 133 物理px → **44.5 CSS pt**，恰好达标且不过度。

3. **壳层触屏检测盲区（G3 的根因收口）**
   `server/src/game-page.ts`：`maxTouchPoints > 1` 在 Playwright iPhone 仿真与部分单点触控设备不成立
   （实测探针：仿真环境 maxTouchPoints=1 而 ontouchstart=true、pointer:coarse=true）。
   修复：三信号并集 `maxTouchPoints>1 ∪ ontouchstart ∪ pointer:coarse`；桌面（pointer:fine、无 ontouchstart）三者皆假，提示保留，桌面零回归。

4. **QA 工具测量口径修正（E3b 正例误报，非游戏缺陷）**
   `qa_mobile_touch.mjs` `dialogPanelVp`：对话区裁剪框左边界右移到摇杆拖拽包络之外
   （24+80+56+26+4=190 逻辑 px；canvas_items 设计空间缩小 3× 后摇杆钮右缘会扫进原裁剪框，
   把摇杆动画误报成「拖拽误触推进」）。对话框文本区的检出力不变（真实推进仍会翻转裁剪框哈希）。

## 三、门禁与产物指纹

- 门禁：`bash games/ai/verify.sh` → preflight PASS（13 类 173 文件）+ smoke PASS（契约五件 + 演算三链 + 行为十组 + 触摸十三组，退出码 0，日志无脚本错误）。
- 版本：`2.2.1-hotzone-hint-fix`（`server/src/index.ts` APP_VERSION；`/api/healthz` 与 `/health` 可观测）。
- 产物指纹（部署后核对线上是否为本构建）：

| 资产 | md5 | 体积 |
|---|---|---|
| games/ai/export/web/index.pck | `3adbe116a42c07f7ba432486270a5384` | 4,110,448 B（gzip 3.83MB → b64 5.11MB） |
| games/ai/export/web/index.wasm | `af4a8fc2925d992348eb30deeeb54360`（与 v11/v12 同引擎，预期不变） | 35,376,909 B |

- 对照：线上 v12 缺陷版 pck md5 = `acc2804ee4ebccbe97782db00dad4f0a`（2,801,968 B）→ 部署后必须变为 `3adbe116…`。

## 四、发布收口交接（发布节点执行）

1. **部署**：HostedApp 链路（非 PublishedApp），应用 id `cmtoavt8p0006m9y6kzy2u14w`（slug=ai）；
   构建 gitRef = `myrd/games-goal-cmtoavt8w0008m9y6kclb4s19`（**绝不用 main**），commitHash = 本文档所在提交。
2. **部署后线上核对**：
   - `GET <liveUrl>api/healthz` → 200 `{"status":"ok","version":"2.2.1-hotzone-hint-fix"}`；
   - `/apps/ai/api/public/assets/index.pck.gz.b64` base64→gunzip md5 = `3adbe116…`（即新构建）；
   - `QA_LIVE_URL=<liveUrl> node qa_mobile_touch.mjs` → 期望 28/28（重点 A6/G3 两项，上轮线上为 NG）。
3. **artifacts 回写**（目标 `cmtoavt8w0008m9y6kclb4s19`，hosted_app 条目原位更新）：
   - `hostedAppId` = `cmtoavt8p0006m9y6kzy2u14w`
   - `deploymentId` = **<本次新 deployment，由发布节点回填>**
   - `liveUrl` = `https://leomac-studio.tail49399e.ts.net/apps/ai/`
   - `detail` 追加三 Bug 终态：Bug1 resolved（44.5 CSS pt）/ Bug2 resolved（触屏提示条隐藏，重叠 0）/
     Bug3 resolved（帧预算 240），证据 = 本文档 + qa_mobile_touch.mjs 28/28 + 指纹核对。
