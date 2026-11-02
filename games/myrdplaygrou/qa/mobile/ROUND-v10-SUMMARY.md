# v10 部署轮次摘要（deploy 节点，r3 门禁升级版上线）

- 日期：2026-11-01（本轮执行窗口 22:02–22:15 +0800）
- 分支：`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`（部署 gitRef 绑定目标分支，未用 main）
- 部署 commit：`5b38fb89fc16ed66bd8deb0c0e0e61cdcdc089ce`（部署前 `git ls-remote` 核对远端 = 本地 HEAD，无领先未推提交）
- deploymentId：`cmvxwpgej000zm9z6mepcek2n`（version=10，status=running，mode=bundle，sourceId=cmvxjycvn001zm905jnwpyliv 专属绑定）
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/
- 本轮上线内容：r3 门禁升级（Bug cmvxrs3fv005em905y4eouy35 冒烟四轴方向断言；Bug cmvxr1f1a004fm905ua2ua9ir 冒烟三关逐关通关扫描 + 试玩多关轮换 + 过程中暴露的 3 处扫描实现缺陷修复）× spec-v2 内容线（向日葵阳光经济 / 植物·僵尸扩容 / 音画契约机判化 / 对比度规范）

## 部署前本地四门禁（deploy 节点独立复跑，与门禁同源命令）

证据：`games/myrdplaygrou/qa/gate-logs/20261101-deploy-r3/verify-full.log`（`bash games/myrdplaygrou/verify.sh`，退出码 0，fail-closed 薄壳调度）

| 门禁 | 判定 | 实测 |
|---|---|---|
| resolve-godot.sh | 环境可用 | Godot 4.3.stable.official.77dcf97d8 |
| preflight.py | PREFLIGHT: PASS | 15 类前置一致性全部通过（2585 个工程文件） |
| smoke.sh（240 帧） | GODOT_SMOKE: PASS | 含四轴方向断言 + 三关逐关通关扫描（关卡推进/逐关胜利/难度逐关生效） |
| input-fuzz.sh | GODOT_FUZZ: PASS | seed=20260913，batches=6 |
| playtest.sh | GODOT_PLAYTEST: PASS | 3 局×900 帧轮换第 1/2/3 关，fb=227/245/240，最长反馈窗 0.38s |

## 线上一致性锚定（「部署的是不是这份代码」）

- 本地已提交导出产物：`export/web/index.pck` 5,576,736 bytes，sha256 = `19c6ae6ef9ea2c1425bdfed1c4c8b838e715f26d06bc6f3b0ae47c5684eb1f7c`（与 implement 节点 5b38fb8 提交说明所钉哈希一致）
- 部署后经资产通道取线上 `index.pck`（gzip+b64 文本 → base64 解码 → gzip 解压）：5,576,736 bytes，sha256 = `19c6ae6ef9ea2c1425bdfed1c4c8b838e715f26d06bc6f3b0ae47c5684eb1f7c` —— **逐字节一致**
- `/health` → 200 `{"ok":true,"app":"myrdplaygrou",...}`；落地页 `/`（尾斜杠 308 归一化）→ 200

## 移动端模拟门禁（部署后对真实 liveUrl，headless Chrome 390×844 DPR3 iPhone UA，`--project` 完全口径）

判定：**MOBILE_SMOKE: PASS**（退出码 0，11 项全绿；证据 = 本目录 report.json verdict=PASS + phase-load/tap/joystick.png 三张分阶段截图）

| 判定 | 结果 |
|---|---|
| network | PASS 无 5xx/404/登录墙 |
| console | PASS 零 error + 零未捕获 |
| canvas | PASS 引擎产物已挂载 |
| render | PASS 400 点采样 8 种量化色（≥2 达标） |
| animate | PASS 1.5s 双时点帧差 idleDiff=316 > 0 |
| touch-pipeline | PASS tap/swipe 均派发到 DOM |
| touch-response | PASS tap 后帧差 tapDiff=117 > 0 |
| joystick-response | 按规则裁撤（工程无虚拟摇杆，点按类玩法） |
| audio-unlock | PASS `window.__audioDebug` 契约在位 |
| viewport | PASS 无横向溢出（scrollWidth=390 = clientWidth=390） |
| fps | PASS 46 fps（swiftshader 软渲染口径 ≥8） |

## Bug 收口对照

- **cmvxrs3fv005em905y4eouy35**（冒烟契约缺方向断言 + spec.acceptance 缺操控语义声明）：工程侧四轴方向断言已由 28748cb/99ebcb9 落地并于本轮门禁复跑验证；spec 侧 `acc-input-semantics` 已随 spec v3（`cmvxw290c000wm9z6cec4yg92`，approved，14 条）经正式 revisions 通道入链（check=games/myrdplaygrou/tests/smoke.gd，mode=auto），本轮经平台 API 独立复核属实。
- **cmvxr1f1a004fm905ua2ua9ir**（冒烟与试玩驱动全部 3 关通关）：冒烟三关扫描 + 试玩 3 局轮换断言已落地，本轮 GODOT_SMOKE / GODOT_PLAYTEST 复跑全绿；线上 v10 即含该门禁升级版构建。
