# r3 门禁升级轮证据（2026-11-01 · pvz-web goal 分支）

## 本轮修复（两个 Bug）

- **cmvxrs3fv005em905y4eouy35** —— 冒烟输入断言「位移量级」→ 四轴「方向」：
  右/左/上/下逐轴校验位移分量方向（≥8px 沿承诺方向 + 本轴支配正交轴），
  拦「上下反/左右反/轴串了/死绑定」；`tests/smoke.gd::_step_move_axis`。
- **cmvxr1f1a004fm905ua2ua9ir** —— 冒烟 + 试玩驱动全部 3 关通关：
  - 冒烟三关扫描（SWEEP_SETUP/KILL/ADVANCE）：每关真实路径「布防双发 → 跳末波 →
    放 walker → 齐射击杀 → game_ended(true)」；结算浮层过 400ms 误触窗（can_accept）
    后 confirm「下一关」；关卡推进（level_index/波次归零/浮层关闭/等待态就绪）、
    逐关胜利判定（主按钮 next/next/replay）、难度数值逐关生效（起始阳光 100/150/200、
    波数 4/5/6、出生行为探针 walker 100/18、击杀掉落 15 面额拾取物）逐关机判；
  - 试玩多关轮换：`main.gd` 装配钩子检测 PlaytestDriver 上下文 →
    `GameState.playtest_level_cursor` 逐局对准第 1/2/3 关（判定器本身零改动）。
- 过程中暴露并修复的真实缺陷：① 扫描在 `_won_seen` 首帧注入 confirm 被结算浮层
  400ms 误触窗吞掉（「下一关」推不动）→ 改等 `can_accept()`；② `_won_seen` 跨关
  不重置导致下一关误判已通关 → 逐关进入清零；③ SWEEP_KILL 帧预算低估击杀+误触窗
  开销（34 帧 → 38 帧）+ 放怪距离 64→48 压飞行帧数，TOTAL=231 < 门禁 240。

## 门禁判定（本目录日志，全部退出码 0）

| 门禁 | 结果 | 证据 |
|---|---|---|
| preflight | PREFLIGHT: PASS（15 类） | verify-full.log |
| godot-smoke | GODOT_SMOKE: PASS（240 帧内，含 `[smoke]` 三关证据行） | verify-full.log / smoke-raw.log |
| input-fuzz | GODOT_FUZZ: PASS（seed=20260913，6 批次 239 帧） | verify-full.log |
| playtest | GODOT_PLAYTEST: PASS（3 局 ×900 帧；`[main]` 三关轮换证据行） | verify-full.log / playtest-rotation.log |

## 部署锚点（deploy 节点核对「部署的是不是这份代码」）

- 构建 commit：本目录所在提交（分支 `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`，绝不用 main）
- `export/web/index.pck` sha256 = `19c6ae6ef9ea2c1425bdfed1c4c8b838e715f26d06bc6f3b0ae47c5684eb1f7c`
- liveUrl（部署后不变）：`https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/`
- HostedApp：cmvxjyb8a001xm905cnip241e（slug: myrdplaygrou）；deploy 节点部署后自动触发
  mobile-web-smoke 移动端门禁
