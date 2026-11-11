# round-4 · v2 重跑部署链收口：线上回归游戏本体 + 双视口线上取证 + 缺陷单核销（改 → 玩 → 看）

## 观察

- v3 部署（cmwbntj0g009vm97atcpfek0i，gitRef 正确）后线上 GET / 返回 16,325 字节植物人壳页（内置 GAME_PAGE_HTML 回落）而非 589KB 游戏单文件 —— 部署成功但游戏没上线；共享壳 server/src/index.ts GET / 优先伺服资产通道 landing.html，缺文件回落壳页，dist/web 此前只有 index.html。
- 部署前线上 running 部署（cmwb0v7xb）仍绑旧分支 myrd/game-3-goal-*（源已丢失的 v1 构建，SRC_SHA=f530de90）。

## 动作

- tools/stage-dist.mjs 补 landing.html 字节一致同步（wheat-squad 判例 tools/build.mjs:85-90：壳伺服落地页文件名=landing.html；本工程单文件零外链，无需改写引用路径）→ STAGE: PASS 589,387 字节 ×2
- 重部署 v5（cmwbo2fhz00a1m97agackpvpz）：POST deployments {gitRef=本分支, manifestPath=games/myrdplaygrou-3/apphost.toml}，commitHash=f2e8ac8 与推送 HEAD 全等，status=running
- 线上复证：GET / 200（589,387 字节，SRC_SHA=bfd6df248a4846bb，与 dist/web/index.html 逐字节一致）/ /health 200
- 线上 mobile-web-smoke（390×844 触摸仿真 + 移动 UA）11 项 PASS：网络全通/console 零 error/画面在动/触摸到达且响应/音频手势解锁器 window.__audioDebug 在场/无横向溢出/FPS≥8（WARN 1 条：摇杆热区校准读 project.godot，three.js 工程按设计无此文件 → 合法降级仅取证，不阻断）
- 线上 experience-harness 双视口取证包归档 qa/experience/（mobile 390×844 + desktop 1280×720，各 8 步：加载/截图/点中心/摇杆滑动/按上键/点上半屏/状态钩子/收尾；输入步骤 inputArrived 全 true，console errors=0，fps 点 26/25）
- 缺陷单 sf-bug-controls（cmwbl6h4h0085m97aimmadl04）核销 closed：证据链=keyboard.js 语义锚 + tests/controls-direction.spec.mjs 机判 + 双视口 smoke payload inputProbe.ok=true（leftDx=-1.8/rightDx=+1.8/upDz<0/downDz>0）+ 线上构建与该已验证构建逐字节一致
- 本轮断言面升级（任务书要求）：输入方向与多球员在场数量两项断言已在链 —— tests/smoke-payload.contract.mjs 机判 inputProbe.ok=true 且 playersOnField=10、teams=2（qa/smoke/report.json 双视口留痕）

## 截图

- qa/playtest/steps/round4-live-mobile-first.png （线上初始画面：390×844 移动视口，title 屏+球场+HUD 在画）
- qa/playtest/steps/round4-live-mobile-swipe.png （线上摇杆滑动步：移动视口输入到达）
- qa/playtest/steps/round4-live-desktop-swipe.png （线上桌面视口 1280×720 同步取证）

## 改动

- tools/stage-dist.mjs（landing.html 同步）/ dist/web/landing.html（新增，589,387 字节）/ .gitignore（平台本地密钥配置防再入库 + qa/experience 豁免）

## 复玩对比

- 修复前：线上 / = 16KB 植物人壳页（不可玩），部署「绿了但没上线」；修复后：线上 / = 589,387 字节游戏本体（与已验证构建逐字节一致），双视口 8 步输入全到达、console 零错误 —— 部署链闭环，v2 三项（方向键修复 / 5v5 实况 / 关节人形）在线上真实可玩可验。
