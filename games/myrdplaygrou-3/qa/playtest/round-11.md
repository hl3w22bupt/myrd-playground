# round-11：线上实局交互会话（看一步打一步，2026-11-11）

## 观察

sessiond 交互会话 12 步（线上 URL，liveUrl 实局）：跳过路径开局可用（点「跳过」按钮 → 直接进 playing，已读标记同步写入）；键盘/触屏双端输入全部到达且全部画面响应（12 步 inputArrived 全 true，frameDiff 55~400）；摇杆上推受控球员向对方球门推进（受控人从 MF#3 变为 FW#5 持球推进到 z=8.9 进攻半场）；空格射门沿触发画面响应；整场对局抢断/传球触发的自动切换累计 15 次，高亮环全程恒为 1 个实例（switchRingCount=1 恒定，无全队闪烁、无多环并存、无闪烁卡顿）——缺陷单 cmwbumwrj 的「全队快速闪烁」线上不复现；倒计时持续走表无冻结卡死。

## 动作

- sessiond.mjs --url <liveUrl> 起会话（TTL 900s）
- --probe 教学卡在场确认（fresh profile 教学卡展示中）
- --tap 200,650（跳过/开始按钮区）→ inputArrived=true、frameDiff=399、responded=true
- --probe：state=playing、seenMarked=true（localStorage 已写）
- --swipe 70,650:70,500（摇杆上推，按上=屏幕上/朝对方球门）
- --pressKey Space（射门沿）→ frameDiff=289
- --swipe ×2 继续推进 + --pressKey Space 二次起脚
- --probe 中场读数：switches=15、ring=1、ball owner=6（对抗进行中）
- --screenshot 抓拍受控环随行画面 → 归档 qa/playtest/round11-live-controlled-ring.png
- --stop 收会话（12 步全留痕）

## 截图

- qa/playtest/round11-live-controlled-ring.png 线上实局：受控球员单环随行（拼抢人群中仅 1 个高亮环）
- qa/playtest/round11-live-shoot-press.png 线上实局：射门沿触发瞬间画面

## 改进点

- 实局两脚射门均被门将/门框化解未进球（0:0 @ 38s），进球庆祝链的线上实拍以确定性冒烟 ?smoke=69 取证为准（横幅+特写+彩带+弹跳四要素同框，见 round-12 与 qa/smoke/）
- sessiond 无「按住蓄力」长按动作（tap 为瞬时点按），蓄力满槽手感以 ?smoke 协议与代码面（chargeTone 线性升调）为锚，待用户人工试玩回填打分卡

## 复玩对比

- 与 round-10（pack 场景）互证：教学卡两条进入路径（开始/跳过）均写已读标记；切环单实例在两种驱动方式（scenario 批量/交互逐步）下均成立
