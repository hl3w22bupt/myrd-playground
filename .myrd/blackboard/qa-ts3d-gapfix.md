# 运输船3D · 四项验收差距补齐（A–D）证据索引

- **需求**：《运输船3D四项验收差距补齐（构建复现/移动触摸/边界断言/仿真证据）》 id=`cmuf2tdfo002tm987jfvhdq65`
- **基线纪律**：本分支 `myrd/ts3d-gapfix-goal-cmuewc8rr0023m987wdzz4dcu` 自基线 **pr-25（commit `0659452`）快进展开**，
  A→B→C→D 四个单项提交依次叠加，diff 可整段追溯至基线（`git diff 0659452..HEAD`）
- **采集环境**：macOS + Node v26 + esbuild 0.28.2（钉版）+ 本机 Chrome 153（CDP headless，移动仿真 390×844）
- **证据时间戳**：批次1 `20260924-135518`（四项初版证据 @ 603cbcd）；批次2 `20260924-150742`（worktree 分支合并 + 残留差距补齐后 @ 合并后 HEAD，见文末第二轮章节）

## A 构建复现

| 口径 | 结果 | 证据 |
|---|---|---|
| 固定依赖版本 | `three@0.185.1`、`esbuild@0.28.2` 精确钉版（lockfile 仅增根声明） | `package.json` / `package-lock.json` |
| 一键复现 | `npm ci → npm run game:verify`（基线 checkout `0659452`） | README「构建复现（验收口径 A）」 |
| 连续两次构建产物哈希一致 | 主产物 = 导出产物 = `cd1b896439c1c9fe…`（sha256 全同） | `gapfix-a-reproducible-build-20260924-135518.log` |
| SRC_SHA 源指纹复核 | `c84939840483fe3b` 与 `tools/src-sha.mjs` 复算一致 | 同上 |

机判门禁：`tools/verify-reproducible.mjs`（`npm run game:verify`），任何不一致非零退出。

## B 移动触摸（双端一致）

| 口径 | 结果 | 证据 |
|---|---|---|
| 拖拽（瞄准） | yawDelta = **-1.8462 rad**（单指右扫 300px） | `gapfix-b-touch-20260924-135518.log` |
| 捏合缩放 | fov **78° → 27.3°**（zoom 1 → 0.35 钳制下限） | 同上 |
| 点按（选择/开火） | shotsFired **0 → 1**（单发语义） | 同上 |
| 无 300ms 点击延迟 | 点按确认时延 **ackMs = 2ms**（<100ms 口径）；`touch-action:none` + `user-scalable=no` 机判通过 | 同上 |
| 手势冲突消除 | 三态互斥（press→drag/pinch，进入捏合作废拖拽与点按）；浏览器滚动/双击缩放被禁 | `src/render/touch.js` + 用例 |
| 双端一致 | 拖拽灵敏度按视口短边归一（`lookSensitivity`），与桌面鼠标同量级标定 | 同上 |
| 移动仿真截图 | 390×844 视口：HUD/准星/枪模/雷达齐全，弹药 29/150（点按已开火）、视角已拖拽偏转 | `gapfix-b-touch-mobile-390x844.png` |

机判用例：`tools/touchcheck.mjs`（CDP 移动仿真 + 合成 TouchEvent，10/10 PASS，零未捕获异常）。

## C 边界断言（常驻 CI）

| 口径 | 结果 | 证据 |
|---|---|---|
| 空场景 | 初始无敌兵/零事件；休整期推满后首波完整生成（wave=1，4 名） | `gapfix-c-boundary-20260924-135518.log` |
| 超界坐标 | 1e9 米级极端意图 600 tick 恒在甲板围栏内；clampToDeck 6 组对抗输入；敌兵追击全程在界内 | 同上 |
| 极端缩放 | clampZoom 12 组输入（NaN/±Infinity/0/负/超界）全部收敛合法域；缩放不进内核 | 同上 |
| 0/负值参数 | frame(0/-1/NaN/∞) 零推进且累加器不污染；seed 回绕双跑确定；0 弹药开火无死循环 | 同上 |
| 通过率 | **25/25 PASS（100%）** | 同上 |
| CI 常驻 | `games/transport-ship-3d/ci/game-gates.yml`：push/PR 跑 `npm ci → game:verify → game:test(含 boundary) → touchcheck`（启用 = 拷入 `.github/workflows/`，一条命令；当前推送凭据缺 workflow scope，故以仓库内真源存放） | workflow 文件 |

配套内核加固（`src/kernel/loop.js`）：非有限数值回退、俯仰钳制、dt/快进守卫 —— 只改非法输入路径。

## D 仿真证据（本目录归档）

| 证据 | 文件 |
|---|---|
| A 构建复现日志（两次哈希 + REPRODUCIBLE-BUILD JSON） | `gapfix-a-reproducible-build-20260924-135518.log` |
| B 触屏手势机判日志（10 PASS） | `gapfix-b-touch-20260924-135518.log` |
| B 移动仿真截图（390×844） | `gapfix-b-touch-mobile-390x844.png` |
| C 边界断言日志（25 PASS） | `gapfix-c-boundary-20260924-135518.log` |
| D 全量门禁日志（7/7，81 断言 PASS） | `gapfix-d-full-suite-20260924-135518.log` |
| D 桌面游戏内截图（冒烟快进 8s 后） | `gapfix-d-ingame-desktop.png` |

齐全率：A–D 四项各有可追溯机判日志 + 截图证据，**100%**。

## 提交清单（基线 `0659452` → HEAD，逐项单项提交）

1. `09239d1` fix(games): 验收口径A 构建复现 —— esbuild钉版 + 连构两次哈希一致门禁 + 门禁聚合入口
2. `ea4031b` feat(games): 验收口径B 移动触摸 —— 拖拽/捏合/点按三类手势 + 消除300ms点击延迟与手势冲突
3. `e6c141e` test(games): 验收口径C 边界断言 —— 四类边界自动化断言 + 内核加固 + CI常驻
4. `603cbcd` chore(games): 验收口径D 仿真证据归档

---

# 第二轮补齐：worktree 分支合并 + 残留差距（批次 20260924-150742）

- **体检师核实的两个 worktree 补齐分支已合并**（B 与 C 改动分属 render/kernel 不同区域，零冲突合入）：
  - `worktree-agent-aa6041653c0235366` → `8bfe482`（B：虚拟摇杆/按钮热区/pointer 降级通道）
  - `worktree-agent-a8e83924bf247023a` → `dff6338`（C：状态机对抗断言 65 项 + 内核状态机补全）+ `b2ade8d`（A：游戏目录独立 package.json）
- **合并后逐项自检发现并补齐的错位**（接线缺口，几何不变只通链路）：
  1. 摇杆轴死输入：`inputState.moveX/moveY` 无人消费 → `player.js read()` 与键盘 WASD 同轴合并钳 [-1,1]
  2. 触屏无暂停入口：`attachTouch` 未挂 `onPause` → 与桌面 pointerlock 丢失同一状态机路径
  3. 控件样式缺失：`#ui` 是 `pointer-events:none` 层，控件无 `position:absolute`/`pointer-events:auto` → 全部摸不到；摇杆底盘漏 `position:absolute` 落左上角（首跑实测 rect=(0,0) 抓出）→ 修复后左下 center=(84,760)
  4. `package.json` 增 `"type": "module"`（消 Node 模块类型重解析告警）

## 第二轮证据（批次 20260924-150742 @ 合并后 HEAD）

| 口径 | 结果 | 证据 |
|---|---|---|
| A 游戏目录独立复现 | `cd games/transport-ship-3d && npm install --no-fund --no-audit && npm run build`：3 包/4s 装毕，连构两次 sha256 **一致（`75bd24cd6cb2ac00…`）**，SRC_SHA=`10cd8d11bf75530c` 复算一致 | `.myrd/blackboard/gate-logs/build-repro.log`（含 REPRODUCIBLE-BUILD JSON） |
| B 手势① 拖拽 | yawDelta = **-1.8462 rad** | `gapfix-b-touch-20260924-150742.log` |
| B 手势② 捏合 | fov **78° → 27.3°**（zoom → 0.35 钳制下限） | 同上 |
| B 手势③ 点按 | shotsFired **0 → 1**，ackMs = **9ms**（<100ms） | 同上 |
| B 手势④ 摇杆（新增） | 左下摇杆区落指上推 → 位移 **1.5m**（(0,8)→(1.44,8.41)），抬指意图清零 | 同上 |
| B 控件热区 DOM 实测 | 摇杆 112×112 @(28,704) 左下半屏 ✓ · 开火 64×64 @(302,716) ✓ · 换弹/暂停 44×44（Apple HIG 下限）✓ · 全部在 390×844 视口内 | 同上（`window.__game.touchRects` 机判口） |
| B 帧率采样（新增） | rAF 连采 60 帧：平均 56.39ms/帧 ≈ **17.7fps**（SwiftShader 软渲染口径 ≥5fps，链路存活） | 同上 |
| B 热区截图 | 移动仿真 390×844+touch+dpr2：摇杆底盘/旋钮、FIRE、R、II 四控件可见，弹药 29/150 | `gapfix-b-touch-mobile-390x844-20260924-150742.png` |
| B pointer 降级 | touch 主通道 + pointerdown/move/up/cancel 降级通道（无 TouchEvent 环境兜底），触摸类 pointer 去重 | `src/render/touch.js`（纯函数区 qa-audit ⑦ 机判） |
| C 状态机对抗断言 | 65 项六组对抗（连按暂停恢复/结算瞬间输入/重开连点/暂停后重开/无幽灵状态/内核缺口回归） | `tests/state-machine.spec.mjs` + 全量门禁日志 |
| C 边界断言 | 25 项四类边界（既有），CI 常驻不变 | `gapfix-c-boundary-20260924-135518.log` |
| QA-AUDIT 移动仿真关（新增第⑦关） | 纯几何机判：44px 热区下限 / 摇杆区矩形 / 死区归零 / 满行程钳 1 / 极端视口钳制 5 组（含 1×1 退化视口「热区下限优先」口径） | `tests/qa-audit.mjs` ⑦ |
| D 全量门禁 | **GAME-GATES 8/8 全过（构建复现 + 6 spec 套件 + qa-audit 七关），156 条 PASS，exit 0** | `gapfix-d-full-suite-20260924-150742.log` |

第二轮齐全率：A–D 四项证据在合并后 HEAD 重新采集归档，**100%**。

## 第二轮提交清单

1. `448f48b` merge: worktree 分支②（B 移动控件）
2. `541f937` merge: worktree 分支①（C 状态机 + A 构建口径）
3. `5db4c57` fix(games): B 摇杆/按钮接线补全（意图合并·暂停钩子·控件样式落位）
4. （本提交）test(games): B 取证扩展 + QA-AUDIT 第⑦关 + D 证据刷新

---

# 第三轮（红队复验残余差距修复）：批次 20260924-155606 @ 终稿 HEAD

红队复验暴露的非 pass 残余差距逐项修复后，A–D 证据在终稿 HEAD 全量重采（此前两批证据保留作沿革）。

## 本轮修复清单（逐项单项提交）

| # | 红队发现 | 处置 | 提交 |
|---|---|---|---|
| 1 | 卫生级副作用：`.claude/worktrees/agent-*` 两个 gitlink 被误提交入树 | `git rm --cached` 移出 + `.gitignore` 忽略 `.claude/`，仓库树零 gitlink | `5039314` |
| 2 | CI 未激活：`.github/workflows` 缺失（C 项要求 CI 常驻） | 已尝试镜像激活 → **push 被远端拒绝**（`refusing to allow an OAuth App to create or update workflow ... without workflow scope`；gh token scopes 实测=`gist, read:org, repo`）→ 环境凭据不可抗，按纪律退回：仓库内真源 `ci/game-gates.yml` + 一键启用口径，待具备 workflow scope 的凭据一条命令激活（不伪造激活） | 尝试留痕，未落库 |
| 3 | 次级观察点：pointer 降级通道无 setPointerCapture，按住移出画布抬指失联 → 登记表泄漏 → 多指针场景误入捏合 | pointerdown 即 `setPointerCapture`（try/catch 兼容旧环境）+ `pointerleave`/`lostpointercapture` 兜底收尾 + dispose 卸载；新增 `tests/pointer-fallback.spec.mjs` 四组对抗 12 断言（TDD 先红后绿：修复前 5 项 FAIL） | `4defae9` |
| 4 | 取证脚本自身缺陷：touchcheck 固定 5.2s 单次读取，冷启动/高载下误报「报告未产出」（实测抓出：同环境复跑 t≈3s 即落报告 ok=true） | 单次读取 → 400ms 步进轮询至 15s 截止（覆盖驱动 10s 预热上限），断言集合与阈值零改动 | `b90cff5` |

## 第三批证据（批次 20260924-155606 @ 终稿 HEAD，每文件 sha256 摘要供第三方复核）

| 口径 | 结果 | 证据（sha256 前 16 位） |
|---|---|---|
| A 构建复现 | 连构两次主产物=导出产物 sha256 **全同（`e79b6577c35c67ea…`）**，SRC_SHA=`3d6b765d300d115b` 复算一致 | `gate-logs/build-repro.log`（`105abaf494d2febf…`，含 REPRODUCIBLE-BUILD JSON） |
| B 四类手势 | 拖拽 yawDelta=**-1.8462 rad** · 捏合 fov **78°→27.3°**（zoom 0.35 钳下限）· 摇杆位移 **1.524m** · 点按 shots **0→1** ackMs=**9ms** | `gapfix-b-touch-20260924-155606.log`（`7168c740bdd5cd54…`） |
| B 热区 DOM 实测 | 摇杆 112×112 @(28,704) 左下半屏 · 开火 64×64 · 换弹/暂停 44×44（HIG 下限）· 全部在视口内 | 同上 |
| B pointer 降级健壮性 | 四组对抗 **12 断言全 PASS**（leave 兜底/捕获接线/捕获异常不致命/隐式释放零副作用），`GAME-GATES 9/9` 纳入常驻 | `gapfix-d-full-suite-20260924-155606.log`（`800d47e2b6c38877…`）+ `POINTER-FALLBACK: PASS` |
| B 帧率采样 | rAF 连采 61 帧，平均 55.83ms/帧 ≈ **17.9fps**（SwiftShader 软渲染 ≥5fps 口径） | `gapfix-b-touch-20260924-155606.log` |
| B 移动仿真截图 | 390×844+touch+dpr2，摇杆底盘/旋钮 + FIRE/R/II 四控件可见 | `gapfix-b-touch-mobile-390x844-20260924-155606.png`（`d5838b1ebc88a853…`） |
| C 边界断言 | 四类边界全过（空场景/1e9 超界坐标/clampZoom 对抗/frame(0,±∞,NaN)/seed 回绕/0 弹药） | `gapfix-c-boundary-20260924-155606.log`（`536948e8cc373443…`） |
| C 状态机对抗 | 65 项六组对抗全过（连按暂停恢复/结算瞬间输入/重开连点/暂停后重开/无幽灵状态/内核缺口回归） | `gapfix-d-full-suite-20260924-155606.log`（state-machine.spec 套件节） |
| D 全量门禁 | **GAME-GATES 9/9 全过（构建复现 + 7 spec 套件 + qa-audit 七关），170 PASS，exit 0** | `gapfix-d-full-suite-20260924-155606.log` |

第三轮齐全率：A–D 四项证据在终稿 HEAD 重采归档并附 sha256 摘要，**100%**。

## 第三轮提交清单

1. `5039314` chore: 移除误提交 worktree gitlink（红队卫生级副作用收口）
2. `d4d9705` ci: 激活 .github/workflows 常驻门禁（C 项 CI 口径收口）
3. `68de399` fix(games): pointer 降级通道抬指兜底 + pointer-fallback.spec 对抗断言（红队次级观察点收口）
4. `b0e4db3` fix(games): touchcheck 报告读取 15s 轮询（消取证计时 flake）
5. `1d044bb` test(games): D 证据第三批重采（ci 镜像激活因凭据缺 workflow scope 未落库，真源留仓库内）
6. （本提交）docs(myrd): 证据索引如实记录 CI 激活受凭据不可抗 + 哈希修订

---

# 第四轮（红队 D 项三环对抗核验 partial → 五项收口）：批次 20260924-172811 @ 终稿 HEAD

红队验证官对 D 项「开火命中/暂停/重开」三环（批次 20260924085533）出具 **partial**：7 项 Confirmed、
3 项反例攻击全部被推翻，移交 5 项收口（F1/F2/F3 + U1/U2）。本轮逐项闭环如下，无一项搁置。

## 本轮收口清单（逐项单项提交）

| # | 红队移交 | 级别 | 处置 | 提交 |
|---|---|---|---|---|
| F3 | 接线绕过内核复位：`resetMatch` 自建世界 `Object.assign` 替换，未调 `game.restart()`，内核 `acc=0` 修复未跟 | P3 | 内核 `restart(nextSeed)` 扩展可选 seed 覆盖（`Number.isFinite` 边界加固：NaN/±∞ 回退创建 seed、`>>>0` 整数化、负值回绕）；表现层 `resetMatch` 改为唯一入口 `game.restart(seed)`（对局内随机语义保留）——波次计时复位 + 累加器清零 + world 逐键重建一次内核调用完成，不再绕过内核 | fix(games) |
| F3⁺ | （配套断言）`restart(nextSeed)` 三性无机判 | — | `tests/state-machine.spec.mjs` ⑥ 组新增 5 断言：注入 seed 重建 + 计时归零直接 playing；累加器清零（残留半 tick + 5ms 不补帧，time 仍 0）；非整数 `>>>0` 取整；NaN 回退创建 seed；负值无符号回绕。套件 65→**70 断言全 PASS** | 同上 |
| F2 | 探针伪值：`restartShown` 读元素级 `style.display`，hud 置 `""` 后不复位，父级 `#ts-screen` display:none 下出伪 true（不影响断言结论） | P3 | `tools/cdp-mobile-chain.mjs` 探针改 **getBoundingClientRect 实测口径**：元素或任一祖先 display:none 时布局盒 0×0 → false；元素级 style.display 不再作为判据 | fix(games) |
| U1 | 重放复现未执行（红队会话无执行工具），仅一批运行记录 | Uncertain | 重放 `node tools/cdp-mobile-chain.mjs` 落**第二批** batch `20260924092524`：28/28 断言与第一批逐条**结论一致、全 PASS**（两报告 label+outcome 全同），A 项式两批一致实证闭环；分环截图×5 + 报告 JSON 落盘 | test(games) |
| U2 | digest 未复算（第三批 sha256 前缀 + mobile-chain 批次） | Uncertain | `shasum -a 256` 全量复算：第三批 6 件 + 两批五环 15 件 + 本轮刷新 A–D 4 件逐一对照入表（见下）；第三批 C 项日志复算值 `536948e8cc373443…` 与索引登记**逐位一致**（跨运行确定性佐证） | docs(myrd) |
| F1 | mobile-chain 五环批次（最新最强 D 项证据）未登记入证据索引 | P2 | 本章节即登记：两批报告/日志/分环截图 + sha256 全清单 + 两批一致性结论入索引 | docs(myrd) |

## 五环链两批证据 digest 对照（U2，sha256 前 16 位）

| 证据件 | 批一 20260924085533（12fbf8f） | 批二 20260924092524（本轮 U1 重放） |
|---|---|---|
| mobile-chain-report JSON | `6550fb7624b89581` | `99cb5bc073ab9bfe` |
| mobile-chain-run log | `d84601441cf73f5f` | （批二运行输出由报告 JSON 承载，无独立 run log） |
| ring1-start PNG | `efae48bbf13fda09` | `468216994c11a53e` |
| ring2-move PNG | `83c147b198932bd5` | `9d151a44cf66aff6` |
| ring3-fire-hit PNG | `b8a4d93c93a45abe` | `eb667ddab0b35466` |
| ring4-paused PNG | `7cfb6043efd9b50d` | `54f7d0ee5564dbec` |
| ring5-restarted PNG | `addf35f63cff4e29` | `c3ffa895c631567b` |

两批断言结论一致性：28/28 条 label+outcome 全同、两报告 `ok=true`（第一批报告 `6550fb7624b89581`、
第二批 `99cb5bc073ab9bfe`）。批二环⑤在**内核 restart 新接线**下复位口径全对上：HP 93→100、ammo 29→30、
reserve 150、score 35→0、shotsFired/shotsHit 1→0、wave 1(active)→0(rest)、敌兵 3→0、time 9.683s→0.9s；
F2 新口径下 `restartShown=true` 为布局盒实测真值。

## 第四批 A–D 证据（批次 20260924-172811 @ 终稿代码态，sha256 前 16 位）

| 口径 | 结果 | 证据（sha256 前 16 位） |
|---|---|---|
| A 构建复现 | 两次构建主产物=导出产物 sha256 全同，`SRC_SHA=0442d7522f58a247`（含本轮 src 改动）复算一致，`REPRODUCIBLE-BUILD` 单行 JSON | `gate-logs/build-repro.log`（`d1dae98ee4ac65af`，= stamped `gapfix-a-reproducible-build-20260924-172811.log` 逐字节同） |
| B 四类手势 + 热区 + 帧率 | TOUCHCHECK: PASS（拖拽/捏合/摇杆/点按 + 44px 热区 + 帧率关） | `gapfix-b-touch-20260924-172811.log`（`d26f48cda417df7e`）· 截图 `gapfix-b-touch-mobile-390x844-20260924-172811.png`（`dc11f25635f02927`） |
| C 边界断言 | 四类边界全过；日志 sha256 与第三批**逐位相同**（`536948e8cc373443…`）——确定性断言集跨运行零漂移 | `gapfix-c-boundary-20260924-172811.log`（`536948e8cc373443`） |
| D 全量门禁 | **GAME-GATES 9/9 全过（构建复现 + 7 spec 套件 + qa-audit 七关），state-machine 扩至 70 断言，exit 0** | `gapfix-d-full-suite-20260924-172811.log`（`820aa32db00f94f8`） |
| D 五环链（CDP 移动仿真） | 两批 `MOBILE-CHAIN: PASS`（开局/触摸移动/开火命中/暂停/重开），命中为内核真值（HP 55→3 = 26×2.0 指纹闭合） | 见上表两批 digest 对照 |

第四轮齐全率：红队移交 5 项（F1/F2/F3/U1/U2）**5/5 闭环**，A–D 证据在终稿代码态重采归档并附 sha256，**100%**。

## 第四轮提交清单

1. fix(games): 内核 `restart(nextSeed)` + `resetMatch` 统一走内核 restart + spec ⑥ 组 5 断言（F3 收口，含重建产物）
2. fix(games): cdp-mobile-chain 探针可见性改 getBoundingClientRect 口径（F2 收口）
3. test(games): 五环链第二批重放证据落盘（U1 收口，两批 28/28 结论一致）
4. （本提交）docs(myrd): 索引登记五环批次 + U2 全量 digest 复算 + 第四批 A–D 证据刷新（F1 收口）
