# round-10：v3 上线 + 线上新手引导/切环取证（2026-11-11）

## 观察

v10 部署（cmwc10na3000qm9bh18cu3lvp @ c906e96f，running 在服）线上取证全绿：开屏教学卡真实展示（四操作「移动/传球/射门/切换」图示齐全，「开始比赛」主按钮 +「跳过」次按钮在场）；对局中 HUD 常驻标签「移动/传球/射门」全部可见（摇杆旁 + 按钮文字）；开始比赛后 localStorage 已读标记 gr-tutorial-seen-v3=1 写入（同档案不再展示）；倒计时真实走表（88.4s → 80.1s → 72.5s 三读数递减）；控制权切换高亮环全程单实例（switchRingCount=1，switchCount=5 真实切换发生）；首次被抢断气泡文案在链（「被抢断啦 —— 即将自动切换到离球最近的队友（脚下光环）」）；consoleErrors=0。取证包 summary.firstColorCount=37、animatedSomewhere=true、hasRespondedStep=true。

## 动作

- experience-harness pack.mjs（线上 URL，mobile 视口 390×844）跑 v3 专用场景 qa/playtest/scenario-v3-mobile.json 共 14 步：wait→截图教学卡→probe 教学卡/标签/气泡/再来一局 DOM→pressKey Enter 开始→probe 对局态（标签可见+已读标记+倒计时）→摇杆右推→摇杆上推→点传球钮→点射门钮→probe 操作后状态→截图→长尾观察→probe 收尾
- 三次 probe 读数：教学卡 tutorialVisible=true/ops=4 项/双按钮在场 → playing 态三标签 visible=true/joyTagVisible=true/tutorialSeenMarked=true → 切换计数 5、环数 1、球权易手进行中
- 部署核验：POST deployments → 504 受理（网关 30s 截断判例形态）→ 轮询 GET /deployments → running @ commitHash=c906e96f=推送 HEAD 全等；线上 GET / 200=606,863B 与 dist/web/index.html 逐字节一致（cmp）；/health 200

## 截图

- qa/experience/2026-11-11T11-23-13-v3-playtest-mobile/steps/02-开屏教学卡.png 开屏教学卡四操作+双按钮实拍
- qa/experience/2026-11-11T11-23-13-v3-playtest-mobile/steps/05-对局开始-HUD.png 对局开始 HUD（常驻标签在场）
- qa/experience/2026-11-11T11-23-13-v3-playtest-mobile/steps/11-操作后状态-气泡-切换计数-球权-.png 中场拼抢单环随行实拍

## 改动

- 源码零改动（本轮为部署+线上取证轮；implement 修复见 round-12 门禁复跑所锚提交 c906e96）

## 复玩对比

- v9（c8146ba，v2 收尾版）→ v10（c906e96，v3 版）：新增教学卡/常驻标签/气泡/单环脉冲/庆祝冻结/再来一局；线上 mobile 门禁 10 PASS + 1 WARN（摇杆热区 --project 读 Godot 字段，three.js 工程按设计无，合法降级仅取证，与 v9 同形态）
