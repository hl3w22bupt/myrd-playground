# round-2 · 方向键语义钉死 + 冒烟协议修正（改 → 玩 → 看）

## 观察

- 双视口 browser-smoke 首跑：桌面/移动全 PASS 但截图停在 title 遮罩（快进后未刷 showScreen），且判定器要求 payload.score 为有限数值而实现给的是对象 —— 两条都属「证据面失真」；另发现旧缺陷单 sf-bug-controls（左右反向）需要线上可机判的语义锚点。

## 动作

- 新增 src/render/keyboard.js（方向映射唯一真源）+ tests/controls-direction.spec.mjs（键盘/摇杆/内核位移三段断言，箭头键语义逐键钉死）
- smoke payload 增加 inputProbe 方向探针（独立沙盒内核测单位意图位移符号）+ playersOnField/teams 字段；score 改数值口径（分项走 scoreHome/scoreAway）
- 冒烟采样循环内补 hud.showScreen 运行态同步；tests/smoke-payload.contract.mjs 消费 qa/smoke/report.json 机判

## 截图

- qa/playtest/steps/round2-mid-match.png （45s 中盘：受控环+球贴身，无球人盯防对位清晰，0:0 胶着）

## 改动

- src/main.js / src/render/keyboard.js / src/render/touch.js（stickToIntent 提纯）/ tests/*（方向与 payload 契约）

## 复玩对比

- 修复前：截图带遮罩、score 断言 FAIL；修复后双视口 inputProbe.ok=true（leftDx=-1.8/rightDx=+1.8），按左向左机判通过 —— 缺陷单 sf-bug-controls 修复有了可复验证据
