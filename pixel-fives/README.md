# 像素街机足球 Pixel Fives · M1「核心循环可玩」

两名球员、一颗球、两个球门：追球、射门、进球，90 秒内比谁进球多。
GameDesignSpec v1.2（**approved**，2026-09-12 主策划盖章，批准记录 = `docs/spec/v1.2-approval-record.md`）→ 机器可读导出 `../.myrd/spec/design-spec.json`。
M2（微信/抖音小游戏）预排：`docs/roadmap/m2-preplan-wechat-douyin-v1.md`。

## 快速开始（零 npm 依赖，node ≥16）

```bash
# 玩（浏览器直开即纯占位精灵可玩；静态服务下自动加载 .grid 美术资产）
python3 -m http.server 8000 --directory .   # 或任意静态服务器
# 浏览器访问 http://localhost:8000/pixel-fives/ （以服务根为准）
# 键位：移动 WASD/方向键 · 射门 空格/J · 模式 1/2/3 · R 再来一局 · F FPS

# 冒烟门禁（acc-01：完整对局 90s，fps_min/frame_time_p95/errors 结构化指标）
node pixel-fives/tests/smoke/full-match.test.mjs

# 红线（acc-02：射门输入同 tick 即时判定 ≤50ms）
node pixel-fives/tests/red-line/input-to-shot.test.mjs

# 进球链路（acc-06：el-10 逐拍断言）
node pixel-fives/tests/goal-flow.test.mjs

# bot-sim 门禁 + 报告契约（acc-03/04：R-08 冻结接口，seeds 42..141 双方同一套）
node pixel-fives/tests/qa/bot-sim-contract.test.mjs
node pixel-fives/tools/bot-sim.mjs --seeds 42..141 --json   # runner 本体（headless 对局入口）

# 资产管线（acc-08，美术线接线）
node pixel-fives/tools/gen-assets.mjs && node pixel-fives/tools/gen-audio.mjs

# 契约检查（acc-07：读 .myrd/spec/design-spec.json；spec 已 approved → 强制模式）
node scripts/contract-check.mjs
```

## 结构

```
pixel-fives/
├── index.html                 # Web build 入口（占位精灵先行，不等美术）
├── src/
│   ├── core/constants.js      # 玩法数值单源（PENDING_APPROVED_SLOTS 契约槽位）
│   ├── core/rng.js            # mulberry32 确定性随机（sim 内禁 Math.random）
│   ├── core/world.js          # 60Hz 确定性物理 + 进球判定（球心越线）
│   ├── core/match.js          # 对局流程：开球/进球 el-10/终局/重开
│   ├── entities/{player,ball,goal}.js   # 实体（spec 落点 R-07）
│   ├── levels/pitch.js        # Fives Arena（el-01..el-10 稳定 id）
│   ├── ai/bot.js              # 确定性 bot（同 seed 派生双方，与人类同入口）
│   └── app/                   # Web 层：input / gridSprites / renderer / main
├── tools/bot-sim.mjs          # headless 对局 runner（R-08 契约报告）
├── tests/                     # acc-01/02/03/04/06 可执行检查
└── docs/                      # spec / art / dev 证据
```

## 契约槽位

spec v1.2 已 **approved**（2026-09-12 主策划盖章）：`src/core/constants.js` 的 `PENDING_APPROVED_SLOTS`
由程序线逐条翻转 `pending-approved → approved`（acc-09，constants.js 唯一改动点），翻转后回报主策划。
别名：`bot.goal_range` / `bot.duration_in_range_s` ⇔ spec `bot_sim.goal_range` / `bot_sim.duration_in_range_s`。
