# round-1 — IP9 方向对齐相机 + IP1/IP2 相机重取景 + IP3 光晕收口

- 本轮 URL：http://127.0.0.1:8137/index.html（本地伺服 dist/web，构建 SRC_SHA=e74ce6d5d04f73f4，
  GAME-GATES 5/5 PASS；线上仍为 @88b7469 旧版，重部署归宿主 deploy_playable，节点不碰部署 API）
- 对照基准：round-0（同一固定动作序列、同一 seed）

## 观察

- **内核确定性绊线零漂移**：?smoke=8 快照 state=playing score=240 goals=2 shots=3 collected=8
  timeLeft=82.0、?smoke=28 终局 score=340 goals=3 shots=4 collected=8 timeLeft=81.1 —— 与
  round-0 逐位一致（本轮只改表现层：touch.js 输入映射 / main.js 键盘映射 / numeric.js CAM_AHEAD
  / scene.js 光晕，均不进内核）。
- **IP9 修复见效（交互战果质变）**：同一手势序列（右半屏开球 + 上推摇杆×4 + 右半屏点按），
  round-0 终态 0 球 1 币 5 分（球员缩在本方底线），round-1 同刻 2 球 3 币 215 分 —— 上推即向
  画面上方（球门）推进，手势语义与画面方向一致。
- **IP1/IP2 修复见效（构图）**：开球位（live-02）球门+门柱+守门员即入画上缘、射门白虚线
  居画幅中部、底部场外空带消失（画面底缘即本方禁区线）；det-smoke8 同内核状态下（round-0：
  空旷中场、虚线贴上缘、门不可见）→ 本轮门前特写构图，门/网/守门员/球全部清晰。
- **IP3 修复见效**：live-03 带球帧中球体（白底黑斑）在球员身前清晰可辨，不再被蓝色光晕吞没。
- 遗留观察（转后续轮）：金币躺倒薄圆柱在部分机位呈细橙条（IP4 → 轮 2）；门后场外环带在进攻
  三区占画幅上部 ~25% 灰绿死区（scene.js buildArena 注释里的「看台色带」从未实现 → 轮 3 候选）。

## 动作

- 与 round-0 完全一致（跨轮可比）：navigate ?smoke=8 → wait 5000 → screenshot+probe；
  navigate ?smoke=28 → wait 5000 → screenshot+probe；navigate 直连页 → wait 1500 →
  screenshot → tap 320,650 → wait 600 → swipe 60,650:60,430 ×2 → screenshot →
  swipe ×2 → screenshot → tap 320,650 → wait 800 → screenshot → probe #hud innerText

## 截图

- qa/playtest/steps/round-1/det-smoke8.png
- qa/playtest/steps/round-1/det-smoke28.png
- qa/playtest/steps/round-1/live-01-title.png
- qa/playtest/steps/round-1/live-02-kickoff.png
- qa/playtest/steps/round-1/live-03-run-mid.png
- qa/playtest/steps/round-1/live-04-run-attack.png
- qa/playtest/steps/round-1/live-05-shot.png
- qa/playtest/steps/round-1/live-06-final.png

## 改进点

- IP9 触屏/键盘方向与相机倒置（round-0 新立，高优先级）
- IP1 纵深感缺失/球门不可见；IP2 底部场外空带；IP3 带球球被光晕吞没

## 改动

- src/render/touch.js：setIntent moveZ 取反（屏幕上推 = +Z = 进攻方向），注释写明相机几何依据
- src/main.js：keyboardIntent moveZ 翻转（W/↑ = +Z，与触屏同相）
- src/numeric.js：CAM_AHEAD 2.7 → 8（俯角 ≈84°→≈72°，纵向覆盖 [camZ-6.2, camZ+30.1]，
  开球位门线入画；spec.numeric 未登记 CAM_*，走 numeric.js 手感参数通道，见 improvements.md 声明）
- src/render/scene.js：球员底部光斑 scale 2.2 → 1.6（球不再被加性混色吞没）
- 验证：GAME-GATES 5/5 PASS（内核确定性/玩法契约零回归）；构建复现 PASS（SRC_SHA=e74ce6d5）

## 复玩对比

- 比 round-0 更好，保留：①交互战果 5 分→215 分（方向可用性修复的直接证据）；②开球位球门
  入画（原全程不可见）；③带球球可辨（原被光晕吞没）；④内核快照逐位一致（零玩法回归）。
- 无回滚项。
