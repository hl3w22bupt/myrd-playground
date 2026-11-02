# v9 部署与双门禁证据摘要（spec v2 迭代轮）

> 本轮：implement（spec v2 全量对齐）→ deploy（AppHost v9）→ playtest（mobile-web-smoke 全绿）。
> 证据随仓库提交：本目录 report.json + 三张分阶段截图 + audio-contract.json。

## 部署身份（2026-11-01）

- deployment id：`cmvxu498j000gm9z6f6dtftuy`（**v9 running**，supersede v8 `cmvxpxci90049m905f47jfkaz`）
- commit：`4b34bf1` @ 分支 `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`（部署 gitRef 绑定目标分支）
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/（免登录直开；/health 返回
  `{"ok":true,"app":"myrdplaygrou","title":"植物人大战僵尸-网页版"}`）
- **字节级证实**：线上 `index.pck`（资产通道 gzip+b64 解码）5,571,392 B，
  sha256 `529f441ca044e9bad9cfccfd7543860d49234d9665c1fcc170e25f527e9e42aa`
  ＝ 仓库构建（games/myrdplaygrou/export/web/index.pck @4b34bf1）逐字节一致。
- 体积基线：index.wasm 35.4MB（release 未压缩）+ index.pck 5.57MB（v8 3.9MB → +1.6MB，
  来源 = BGM 18.5s→55.4s 无缝循环重生成）+ index.js 331KB + worklet 7.1KB。

## 本地门禁（verify.sh 四件套，全绿）

| 门禁 | 结果 | 明细 |
|---|---|---|
| preflight | PASS 15 类 | P13b 拦下静音按钮 ♪ 字形缺字（已改文案）—— 机判有效样本 |
| GODOT_SMOKE | PASS 240 帧内 216 帧 | 17 项断言：内容表/难度平缓/WCAG 对比度逐对/音频契约/布防扣费/冷却/取消选卡/射击/掉落收集/向日葵生产收集/失败(5 命)/重开/下一波/胜利/键位 1-5/提示淡出/调参协议 |
| GODOT_FUZZ | PASS seed=20260913 | 6 批 239 帧对抗输入，零脚本错误 |
| GODOT_PLAYTEST | PASS 3 局×900 帧 | fb=227/248/238，最长反馈窗 0.38s（阈值 10s） |

## 阈值校准披露（tests/playtest.json）

`first_reward_seconds_max` 10 → **-1（显式关闭）**：v2 阳光经济改为「只经天降(12s)/向日葵(10s)/
击杀掉落三途径、全部点按收集」，score 事件语义 = 玩家主动收集；**最早可得阳光在 10s**，
原 10s 阈值对人类玩家也结构不可达（设计性不可达，非玩法缺陷）。正反馈及时性改由
`feedback_gap ≤10s`（实测 0.38s）与 `feedback_events ≥2`（实测 227+）继续硬判。
bot 随机点按不保证命中拾取物，score=0 属预期（三局一致，非回归）。

## 移动端门禁（mobile-web-smoke，MOBILE_SMOKE: PASS 11 项全绿）

- 口径：headless Chrome 移动仿真 390×844 / DPR 3 / iPhone UA，`--project` 完全口径
- checkedAt = 2026-11-01T13:01:24Z；fps 45（软渲染口径 ≥8）；tapDiff=117；视口零溢出；
  console 零错误；网络全通；渲染/动画/触摸管线/触摸响应全绿；摇杆按规则裁撤（点按类玩法）
- 音频解锁契约（spec machineCheck 实证，audio-contract.json）：
  `window.__audioDebug()` = `{unlocked: true, muted: false, bgmPlaying: true, addModules: 1,
  state: "running"}` —— 手势解锁后 AudioContext running、BGM 起播、worklet 经资产通道加载成功。
  inputProfile 同步取证：uaTouch=true → 触屏措辞路径生效。

## 本轮修复的 4 条用户反馈缺陷对应

| 缺陷（create_bug） | 对应实现 | 机判 |
|---|---|---|
| 无音效 | BGM 55s 循环 + 8 类契约音效齐 + 常驻静音开关 + 手势解锁契约实证 | smoke 音频契约 + mobile audio-contract |
| 植物与背景同色不可见 | 格底低饱和深绿棋盘 + 主体 2px 描边 + 投影 | smoke WCAG 对比度逐对 ≥3:1（回归闸） |
| 僵尸种类不足 | 4 类 spec 绝对数值（walker/runner/conehead/buckethead）+ 逐关编制加重 | smoke 内容表 + 难度平缓断言 |
| 植物种类不足且缺向日葵 | 5 张卡（+阳光花/坚果墙），向日葵生产+点收 | smoke 生产/收集/冷却/取消选卡断言 |
