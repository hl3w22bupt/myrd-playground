# round-15：IP-P1+IP-P3 修复轮（改→玩→看 第 1 轮，本地构建复玩，2026-11-11）

- 分支 `myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；改动面 = src/kernel/world.js（受控人切换稳定化 + 客队出手通道）+ tests/football-contract.spec.mjs（8 个新契约用例）
- 改动源码 SHA：SRC_SHA=80a809458f5f9c12（单文件产物 607,060B，两次构建逐字节一致）

## 观察

- **IP-P1 生效（线上基线 -59%）**：同序列 SEQ-P 同窗探针 switchCount：基线 82/44.4s（r14b，v14 在服）→ 本地新构建 34/42.5s（r16）——抖振减半以上；单次控制权持有时长（内核模拟）maxHoldSecMean 11.2s → 15.8s（+37%）；攻门数据不降反升：shotsMean 22.2→23.2、firstShotSecMean 13.6→9.8（推进更连贯的旁证）。
- **IP-P3 生效（通道打开）**：契约场景断言——客队前锋小禁区未贴脸（distPress≈0.8）即转身起脚（修前必不触发）；贴脸远射（distPress≈0.35 且非小禁区）仍不起脚（平缓难度门槛保留）。全集模拟客队射门 0→1（autopilot 掌控球权下客队进禁区次数本就少，线上长持球场景才会显影；见 round-16 线上复测）。
- **内核行为零回归**：tests/run-all 7/7 PASS（controls-direction/football-contract/kernel-determinism/singlefile/smoke-payload/state-machine/构建复现）；preflight 21 项 0 WARN；browser-smoke 双视口 PASS；asset-triple-check PASS。
- 契约用例脚手架两轮返工如实记录：①首版把候选摆进抢断半径（1.4m）→ 泊松抢断+捡球走了「切持球人」合法路径；②次版把对手摆进传球门槛（distPress<1.6）→ 持球人出球触发飞行窗冻结（IP-P1 ②的正确行为）。终版几何避开三道门槛，纯测切换分支。
- 过程失误如实记录：本地复玩 r15 步骤截图（tmp xh-session-CGm8iz）在拷贝前被会话回收，0 张留存；r16 同序列复跑截图即时拷贝（r16-016/r16-028），观察与探针读数以两轮记录文本留存。

## 动作

- 改 src/kernel/world.js 受控人切换：①我方非门将持球→立即切持球人（离散事件不变）；②ball.cooldown>0 飞行窗→冻结不重算；③其余→最近重算加迟滞（候选须近出 1 个 CONTROL_RADIUS 才接管）。零新增数值（复用 CONTROL_RADIUS 与既有 ball.cooldown），不触碰 spec.numeric 定稿值
- 改 src/kernel/world.js 客队出手门槛：小禁区（closeRange）起脚条件 distPress>1.2 → >0.5（远射 1.8 门槛不变；AWAY_SHOT_RANGE_Z=8 语义不变；AI 决策阈值属实现层）
- 改 tests/football-contract.spec.mjs：+8 用例（飞行窗冻结/接球切换契约/迟滞保持/迟滞正向对照/前置守卫/小禁区起脚/贴脸远射不起脚）
- 新建 switch-sim.mjs 逐队射门/进球归账 → switch-sim-after-ip1-ip3.json；seq-p.sh 固定序列脚本
- 本地 serve dist/web → sessiond 起会话 ×2（r15/r16）→ SEQ-P 全序列复玩 + 探针
- 门禁全量复跑：build/verify-reproducible/stage-dist/tests 7-7/preflight/asset-triple-check/browser-smoke

## 截图

- qa/playtest/steps/r16-016-after-ip3.png（IP-P1+IP-P3 后本地实局：两处小组对抗、球与控制环清晰可读，较基线人堆松散）
- qa/playtest/steps/r16-028-final.png（同窗终态：受控 MF#3 环随行，客队持球但推进受组挡）
- （r15 轮截图 0 张留存——tmp 回收失误，见「观察」末条；读数以探针 JSON 文本留存于本记录）

## 改进点

- IP-P1 切换抖振稳定化（round-14 实锤，本轮修复）
- IP-P3 客队出手通道（round-14 实锤，本轮修复）

## 改动

- src/kernel/world.js：切换三分支（持球事件/飞行窗冻结/迟滞重算）+ 客队小禁区起脚通道
- tests/football-contract.spec.mjs：+8 契约用例
- qa/playtest/switch-sim.mjs / seq-p.sh / switch-sim-{before,after-ip1-ip3}.json：机判仪器

## 复玩对比

- 比上一版更好（保留）：同窗 switchCount 82→34（-59%，live vs 新构建同序列）；内核 maxHold +37%；射门/首射时间不劣化；契约 8 用例 + 全门禁绿
- 客队威胁仍待线上长持球场景复测（round-16 部署后线上复玩验证）
