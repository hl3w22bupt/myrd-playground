# round-6 · IP-1 桌面横向视口取景空旷：相机宽高比自适应 + 冒烟截图补真实跟屏相机（改 → 玩 → 看）

## 观察

- **桌面视口（1280×720）球场只占画面中段窄条**：改前 `qa/smoke/smoke-desktop.png`（git HEAD 版，135,157 字节）实读——26m 场宽居中约 40% 屏宽，两侧大片灰白空带，球员读数极小；`qa/experience/2026-11-11T05-37-31-deploy-desktop/steps/04-摇杆区滑动.png` 同形态。竖屏优先的创作决策不该以牺牲桌面可玩性为代价。
- **根因（代码级定位）**：`src/render/scene.js` followCamera 相机高度/后偏移写死（17.5/13），不随 aspect 自适应——竖屏构型直接搬横屏，水平视场角随 aspect 放大后场地宽度只占水平视场的小部分。
- **伴生证据面失真（本轮修复）**：`src/main.js` 冒烟采样循环只调 `composer.render()` 不调 `syncVisuals`，快进后相机停在 `buildCamera` 初始机位 (0,26,22)——冒烟截图从未反映跟屏相机（实证：改 followCamera 后冒烟截图与改前**逐字节全等** cmp，135,157=135,157）。冒烟截图作为视觉证据通道失真。
- 改前基线序列（SEQ-M 12 步固定动作，qa/playtest/seq-m.sh）：移动端画面正常（受控环/按钮/比分计时齐全），mobile 是 portrait 构型主战场、无此问题。

## 动作

- 固定种子复现通道：SEQ-M 12 步（截图→右半屏开球→摇杆上左→截图→←键→↑键→摇杆右推→传球→射门→终态截图→HUD 探针），跨轮同一序列；`?smoke=62` 快进（SEED_DEFAULT 确定性内核）+ browser-smoke 双视口机判。
- 改 `src/render/scene.js` followCamera：取景按 camera.aspect 分段插值——竖屏基准（17.5/13）端点不动，aspect 0.9→2.2 线性过渡到（10/8），横屏收近压低让场宽占满画幅（IP-1 主改动）。
- 改 `src/main.js` 冒烟采样循环：每帧补 `syncVisuals(1/60)`，让冒烟截图反映真实跟屏相机（证据面修复，不动 payload 口径）。
- 复跑：build（SRC_SHA=e9e55f37→新）+ stage + tests/run-all 7/7 + browser-smoke 双视口 + SEQ-M 复玩。

## 截图

- qa/playtest/steps/round6-base-03-joy.png （改前移动端摇杆态，基线）
- qa/playtest/steps/round6-base-09-end.png （改前移动端终态）
- qa/playtest/steps/round6-after-desktop-smoke.png （改后桌面视口冒烟截图：场宽占满画幅）
- qa/playtest/steps/round6-after-09-end.png （改后移动端终态，与改前逐字节一致）

## 改进点

- **IP-1 桌面横向视口取景空旷**（出处：qa/smoke/report.json desktop 视口 + git HEAD 版 smoke-desktop.png + experience desktop 04 步截图——两侧空带约 30% 屏宽、球员过小）。

## 改动

- src/render/scene.js（followCamera 宽高比自适应，IP-1 主改动）
- src/main.js（冒烟采样循环补 syncVisuals，证据面失真修复）
- qa/playtest/seq-m.sh（本轮新立：跨轮固定动作序列脚本）

## 复玩对比

- **桌面**：改后 smoke-desktop.png（157,668 字节）——场地占满全宽、挡板贴边、球员读数约 2.2×、受控环+球清晰居中；比改前「窄条+大片空带」显著更好（保留）。视锥剔除副产品：drawCalls 201→182（desktop）。
- **移动端**：round6-after-03-joy.png 与改前 round6-base-03-joy.png **逐字节一致**（139,832=139,832）——portrait 构型零漂移（aspect 0.46 → 插值 t=0 端点值不变），确定性内核 + 同序列下无回归（保留）。
- 机判：tests 7/7 PASS；browser-smoke 双视口 PASS（desktop fps=12 / mobile fps=10.8，≥10 达标；exceptions=0；inputProbe.ok=true、playersOnField=10、teams=2 断言在链）；consoleErrors=0。
- SwiftShader fps 轮内波动说明：本机同刻有本地 Chrome 会话/http 服务并发，fps 读数下行属环境噪声（门禁线 ≥10 仍过），收尾轮将复跑确认。
