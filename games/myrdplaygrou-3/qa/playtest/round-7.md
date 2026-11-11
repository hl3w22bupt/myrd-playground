# round-7 · IP-2 球门无网、射门目标辨识弱：程序化网格贴图三面网装配（改 → 玩 → 看）

## 观察

- **球门只有两柱一梁，远看像场地标线**：改前 `qa/smoke/smoke-desktop.png`（round-6 后版本）与 `qa/experience/2026-11-11T05-36-47-deploy/steps/02-初始画面.png` 实读——球门结构感为零，「网感」为零，射门目标的视觉分量不足。
- **根因（代码级定位）**：`src/render/scene.js` buildArena 球门只建 post/bar（两柱一梁），无任何网面几何。
- 实局手感观察（seq/goal-watch 期间）：平缓难度下闲置/轻操作对局 0:0 属常态（round-1 平衡修固后的合理形态），进球瞬间的画面反馈除横幅+音效外无画面爆点（→ 记 IP-3，round-8 处理）。
- 门禁纪律留痕：browser-smoke 与其它任务并行跑时出现过一次尾部 stack 残迹（资源竞争），串行复跑 exit=0 全 PASS —— 门禁一律串行执行。

## 动作

- `src/render/textures.js` 新增 netTexture()：64px canvas 透明底白网格（网眼 16px → 世界 0.18m），RepeatWrapping 按面尺寸铺贴（零外部资源，单文件契约不变）。
- `src/render/scene.js` buildArena 球门装配扩为：柱/梁 + 背网（竖面）+ 顶网（横梁拉到背网顶的水平面）+ 双侧网——每门 4 网面 × 2 门 = 8 mesh；Basic 材质零光照成本、depthWrite=false 防透明排序伪影、opacity 0.6；不碰进球判定（内核球门几何零改动，纯表现层）。
- 复跑：build + stage（590,320 字节 ×2）+ tests/run-all 7/7 + browser-smoke 双视口（串行）。
- 实局抓拍：goal-watch.sh（轮询 HUD 比分变化即连拍）+ 主动操玩（连续摇杆推进至门前 → 射门），球门+网在画面内取证。

## 截图

- qa/playtest/steps/round7-goal-net-approach.png （带球推进至北门前：白柱+横梁+半透明网格背网/顶网+门将驻守）
- qa/playtest/steps/round7-goal-net-after-shot.png （射门后同视角：网面结构保持，球门辨识度显著高于改前灰条形态）
- games/myrdplaygrou-3/qa/smoke/smoke-desktop.png （改后双视口冒烟桌面帧，门禁证据）

## 改进点

- **IP-2 球门无网、射门目标辨识弱**（出处：round-6 后 qa/smoke/smoke-desktop.png + qa/experience v7 部署包 02 初始画面——球门呈灰白线框/扁条，无网面结构）。

## 改动

- src/render/textures.js（netTexture 程序化网格贴图）
- src/render/scene.js（buildArena 球门三面网装配）
- qa/playtest/goal-watch.sh（本轮新立：进球监测抓拍脚本）

## 复玩对比

- **球门辨识度**：改后实局帧球门呈「白柱+横梁+半透明网格背网/顶网」完整结构（round7-goal-net-approach.png），对比改前灰条——射门目标读数显著提升（保留）。
- **附带发现**：近机位（round-6 IP-1）下球衣背号清晰可读（蓝 3/5/2、橙 2/4/5 在帧），号码辨识维度随取景改善自然达成。
- 机判：tests 7/7 PASS；browser-smoke 双视口 PASS（desktop fps=12.2 / mobile fps=10.8 ≥10；exceptions=0；inputProbe.ok=true、playersOnField=10、teams=2 在链；consoleErrors=0）；drawCalls 182→208（+8 网面，几何 26→34、贴图 30→31，预算内）、triangles 6220→6922。
- 产物：dist/web/index.html = landing.html = 590,320 字节（STAGE PASS，逐字节一致）。
