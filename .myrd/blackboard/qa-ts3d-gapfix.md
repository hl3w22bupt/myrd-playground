# 运输船3D · 四项验收差距补齐（A–D）证据索引

- **需求**：《运输船3D四项验收差距补齐（构建复现/移动触摸/边界断言/仿真证据）》 id=`cmuf2tdfo002tm987jfvhdq65`
- **基线纪律**：本分支 `myrd/ts3d-gapfix-goal-cmuewc8rr0023m987wdzz4dcu` 自基线 **pr-25（commit `0659452`）快进展开**，
  A→B→C→D 四个单项提交依次叠加，diff 可整段追溯至基线（`git diff 0659452..HEAD`）
- **采集环境**：macOS + Node v26 + esbuild 0.28.2（钉版）+ 本机 Chrome 153（CDP headless，移动仿真 390×844）
- **证据时间戳**：20260924-135518（全部证据同批次采集于最终 HEAD）

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
4. （本提交）chore(games): 验收口径D 仿真证据归档
