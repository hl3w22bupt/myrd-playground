# round-8 · IP-3 进球瞬间缺画面爆点：彩带粒子池 + 镜头 FOV 冲击 + 进球特写机位（改 → 玩 → 看）

## 观察

- **进球只有横幅文字+音效，画面无爆点**：代码级定位 `src/main.js` handleEvents goal 分支只调 `sfx.goal()+flashBanner`；实局观察（round-7 期间 goal-watch/主动操玩多局 0:0）进球瞬间核心正反馈画面力度不足。
- **实局进球取证困难（诚实留痕）**：平缓难度下主动操玩多轮 0:0（带球被围抢、远射被没收）；最终以「受控人弃防」实验促成客队进球（0:1，真实对局结果），但轮询检测延迟 ~1.5-2s > 粒子寿命 1.25s，三次实局抓拍均晚于开球重置（782 帧：横幅已消、相机已回中圈）。
- **取证链路发现的真问题（转为本轮主改动）**：进球瞬间相机立即被开球重置拽回中圈——玩家来不及读「球入网窝」的瞬间；这是核心正反馈时刻的观感缺陷，不只影响取证。
- **冒烟模式事件被丢弃**：`?smoke=` 快进循环不调 handleEvents，进球横幅/彩带/特写机位在冒烟证据链路全部缺席（与 round-6 发现的「冒烟截图停初始机位」同类的证据面失真）。
- **帧率余量刀口**：受控 A/B 实验隔离——环境负载（load avg 13.8-17.1，178 个 Chrome 进程）是 fps 波动主因（无庆祝改动也掉到 9.4），庆祝粒子自身成本 ~0.8-1.4fps；mobile 视口在门禁线（≥10）附近抖动。

## 动作

- 新增 `src/render/celebrate.js`：彩带粒子池（THREE.Points 单 drawCall，POOL=96，加法混合 + 径向光斑贴图，队色 #3498db/#f39c12/白按进球队配色；重力+落地反弹+寿命渐隐）；空闲路径零成本（无活跃粒子 → 零缓冲上传 + Points.visible=false 零绘制）。
- 新增 `createPunch()`：镜头 FOV 冲击（半正弦包络峰值 5°，0.5s；仅活动窗口内动 updateProjectionMatrix）。
- `src/main.js`：goal 事件 → burst + punch.fire + goalHold（进球特写机位计时器 1.2s→2.2s 两迭代，锁被进球方球门 mouth，覆盖粒子 1.9s 寿命）；冒烟快进循环补 `handleEvents(events)`（事件→反馈在冒烟证据链路同样在链）。
- `src/render/scene.js`：followCamera 增 hold 参数（特写机位锁门，内核零改动、确定性不受影响）；Bloom 分辨率 1/4→1/8（低频辉光视觉无损，全屏 pass 像素量 ↓75%，买帧率余量）。
- 性能预算收口：粒子池 A/B 实测 + 空闲零成本改造；`window.__tsState` 只读状态钩子（v1 轮 IP7/IP8 判例同款）支撑实局受控人/球位探针（图证据 213 帧环内橙人疑云借此排除：受控环主人 p4（主队#5）与持球客队 p6 相距 0.94m，画面重叠致读数混淆，内核 controlledId 语义正确）。
- 确定性取证：`?smoke=69`（SEED_DEFAULT=333，内核仿真预知 s=60/68 两粒进球）→ 双视口冒烟帧捕获庆祝：横幅 + 特写机位锁门 + 网窝 + 彩带同框。

## 截图

- qa/playtest/steps/round8-celebration-session.png（?smoke=69 会话帧：「进球！主队」横幅 + 特写门 + 网窝 + 彩带粒子 + 门将）
- qa/playtest/steps/round8-celebration-desktop-smoke.png（桌面视口 1280×720 冒烟帧，同上全要素）
- qa/playtest/steps/round8-celebration-mobile-smoke.png（移动视口冒烟帧）
- qa/playtest/steps/round8-live-goal-capture-late.png（实局抓拍诚实留痕：检测延迟晚于特写窗，横幅已消——该缺口由 2.2s 特写窗延长收口）

## 改进点

- **IP-3 进球瞬间缺画面爆点**（出处：src/main.js handleEvents goal 分支代码面 + round-7 期间实局观察多局 0:0 进球反馈单薄）。
- 伴生：冒烟事件丢弃（证据面失真）+ 进球瞬间相机被开球重置拽离（观感缺陷）+ 帧率余量刀口（门禁风险）——三者均在本轮一并收口。

## 改动

- src/render/celebrate.js（新增：粒子池 + FOV 冲击）
- src/main.js（goal 事件接线 / goalHold 计时 / 冒烟 handleEvents / __tsState 钩子）
- src/render/scene.js（followCamera hold 参数 / Bloom 1/4→1/8）
- qa/playtest/goal-watch.sh、session-local.json（取证脚本与会话文件，会话文件不再跟踪）

## 复玩对比

- **庆祝画面**：改前进球=横幅+音效两项；改后=横幅+音效+彩带粒子+特写机位（2.2s 锁门读「球入网窝」）+FOV 冲击五通道——比上一版更好（保留）。
- **确定性取证**：?smoke=69 双视口帧全部呈现庆祝全要素（2:0@22s 与内核仿真 s=60/68 两球全等）——跨轮可复现。
- **机判**：tests 7/7 PASS；browser-smoke 双视口 PASS（负载 17.1 下 fps 10.3/10.5——Bloom 1/8 余量生效；A/B 锚点：无庆祝改动同负载 9.4 FAIL）；产物 dist/web/index.html = landing.html = 594,717 字节（STAGE PASS 逐字节一致）。
- **实局捕获缺口（如实）**：3 次实局抓拍因轮询延迟错过特写窗（round8-live-goal-capture-late.png 留痕）；特写窗已延至 2.2s，后续实局取证窗口充足，本轮以确定性冒烟取证为准。
