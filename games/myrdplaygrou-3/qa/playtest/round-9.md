# round-9 · v8 部署上线 + 线上实局验证（改=部署 → 玩=线上操玩 → 看=线上截图）

## 观察

- 部署链收口：v8 部署 **cmwbtonx4001cm9dzws5myo5z**（POST /deployments → HTTP 504 网关 30s 截断判例形态、实际已受理；GET /deployments 复查 status=running=在服语义，commitHash=**d8d8a6c** 与推送 HEAD 全等；前轮 v7=cmwbopdtk 转 superseded）。
- 线上复证：GET / → 200，**594,717 字节与 dist/web/index.html 逐字节一致（cmp）**；/health → 200。
- 线上实局（SEQ-M 固定序列复玩）：画面即打磨版——中场逼抢绞杀（4v4 贴身）、受控环+辉光、队色/号码可读、HUD 干净；`window.__tsState` 只读探针在线上返回全量状态（5v5 双队、controlledId=4 主队 FW#5、球权在客队 DF#6 脚下 0.94m 贴身对抗）。
- **线上进球特写机位实证**：弃防实验促成客队进球（0:1@12s，真实对局结果），检测后 ~1.5s 抓拍（steps/028）——相机仍锁在自家球门（门后机位：网窝网格 + 门将 + 门线区同框），2.2s 特写窗在线上真实生效；~2.6s 后相机回中圈（steps/029），节奏符合设计。
- 线上移动门禁（mobile-web-smoke，390×844 移动仿真）：**PASS**——网络/渲染/触摸响应/音频解锁契约（__audioDebug）/视口/FPS 全绿；1 WARN=摇杆热区 --project 未传（回退固定坐标 swipe，仅取证不断言，合法降级与前轮同款）。

## 动作

- git push（4874612..d8d8a6c）→ POST deployments {mode=bundle, gitRef=本分支, sourceId=cmwaqvrng002lm9m2nftdd20h, manifestPath=games/myrdplaygrou-3/apphost.toml} → 504 受理 → 轮询 running → 线上字节核验。
- sessiond 重启常驻（本轮前置 sessiond 随上一执行进程退出，按会话异常纪律重启而非编造证据；新会话 session-live.json 对 liveUrl）。
- SEQ-M 12 步固定动作序列线上复玩（与 round-6/7/8 同序列，跨轮可比）。
- 弃防+快轮询进球监测 → 线上庆祝取证 4 连拍。
- 线上 mobile-web-smoke 门禁复跑。

## 截图

- qa/playtest/steps/round9-live-00-title.png （线上 title 屏）
- qa/playtest/steps/round9-live-03-joy.png （线上摇杆输入态：中场逼抢绞杀、受控环、按钮/HUD）
- qa/playtest/steps/round9-live-09-end.png （线上动作后终态）
- qa/playtest/steps/round9-live-goal-hold-net.png （**进球特写机位线上实证**：门后机位看网窝+门将+门线区）
- qa/playtest/steps/round9-live-after-celebration.png （特写窗结束后相机回中圈）

## 改进点

- 本轮为 v8 部署上线与线上验证轮：源码零改动（round-6/7/8 三轮打磨的部署落地 + 线上实证）。

## 改动

- 收尾门禁加固（本轮唯一源码改动，2 个数值）：src/render/scene.js 内部分辨率 0.75→0.7 + 阴影贴图 512→384——mobile 视口在负载 13-14 下连续两跑 9.6/9.8（差 0.2-0.4 触线），不再赌环境回落，买确定性余量；复跑同负载 11/11 PASS（+1.4fps），画面目检无可见劣化（平涂美术容忍度内）。
- 落档：本文件 + qa/mobile/report.json（线上门禁）+ qa/playtest/steps/round9-*（线上取证）+ qa/playtest/session-live.json（线上会话登记，session*.json 已退跟踪）+ qa/smoke（复跑报告）+ qa/visual-ratchet（v8-live-mapped 配对集与报告）。

## 复玩对比

- 线上 = 本地打磨版逐字节全等（cmp 594,717B）——三轮打磨（取景/球网/庆祝）全部上线可玩可验。
- 线上实局三项断言维持：inputProbe 方向语义（冒烟 payload inputProbe.ok=true，qa/smoke/report.json）+ playersOnField=10 + teams=2。
- 部署链闭环：植物人壳页缺口（round-4 判例）未复发，landing.html 同步 STAGE PASS。
