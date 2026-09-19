# 三 Bug 修复复核报告（移动端 DPR 触屏仿真 + 冒烟门禁）

> **复核对象**：线上 `https://leomac-studio.tail49399e.ts.net/apps/ai/`（HostedApp `cmtoavt8p0006m9y6kzy2u14w`）＋ 仓库门禁资产。
> **复核时间**：2026-09-19。
> **方法**：①线上产物指纹校验（pck/wasm md5 对比）②同口径复测——复用上一轮验收工具 `../mobile-touch-acceptance/qa_mobile_touch.mjs`（Playwright iPhone 13 DPR3 仿真 + CDP 原生触摸），`QA_FAST=1` 全流程 26 项 ③本地冒烟门禁实测（默认帧预算裸跑 + 全量 verify.sh）。
> **结果速览**：

| Bug | 结论 | 判定 |
|---|---|---|
| cmu85yqnf002wm9x5807ozpv2（选项热区 14.7 CSS pt） | **unconfirmed（未修复，线上复现）** | A6-hotzone44 NG：仍 14.7 CSS pt（标准 33%） |
| cmu85yvsh002ym9x517ufmbrj（#hint 遮挡选项 3200px²） | **unconfirmed（未修复，线上复现）** | G3-hint-overlap NG：仍 3200 px² |
| cmu85z7k50030m9x54nfnyo7o（冒烟默认预算误判 FAIL） | **resolved（本轮修复并验证）** | 裸跑默认预算 exit=0、`GODOT_SMOKE: PASS`、verify.sh 全绿 |

---

## 一、线上版本判定：部署产物仍为缺陷版本（未含任何三 Bug 修复）

**指纹证据**（经 `/apps/ai/api/public/assets/*.gz.b64` base64→gunzip 往返校验）：

| 资产 | 线上 md5 | 本地 `games/ai/export/web/`（git 1f97f2a5，v2.2.0-touch-viewport） |
|---|---|---|
| index.pck（2801968 B） | `acc2804ee4ebccbe97782db00dad4f0a` | `acc2804ee4ebccbe97782db00dad4f0a` ✅ 一致 |
| index.wasm（35376909 B） | `af4a8fc2925d992348eb30deeeb54360` | `af4a8fc2925d992348eb30deeeb54360` ✅ 一致 |

壳层 `/apps/ai` 返回的 HTML 与本仓 `server/src/game-page.ts` 逐字段一致（`#hint` 仍为 `position:fixed; bottom:10px`，无避让/隐藏联动逻辑）。

**工坊修复运行取证**（运行 `cmu860w2d0035m9x5z58uo6xf`，09:08–10:03，status=completed）：该运行实际产出是「玩法验收升级」（反馈/调参/难度梯度，commit 5772961 推至 workflow 分支），**未触及三 Bug 的任何修复点**；其发布节点明确决策「保留剧情引擎版」并以 `commitHash=1f97f2a5` 重部署（deployment `cmu87uw3z003nm9x5h3bitqf7`，v12）。即：**不存在已完成的「三 Bug 修复 diff」，线上也没有热修**——三个待修点源码均无变更：

- Bug 1：`games/ai/scripts/main.gd` `_min_option_height()` 仍为 window/canvas 比值法（无 JavaScriptBridge/devicePixelRatio）；
- Bug 2：`server/src/game-page.ts` `#hint` 无避让、无 postMessage 隐藏约定；
- Bug 3：见 §四（QA 原建议的 `Engine.max_fps=60` 早已在位，真实缺口另述）。

## 二、Bug 1 复核（cmu85yqnf002wm9x5807ozpv2）：未修复，线上复现 ❌

同口径复测（iPhone 13 DPR3，与 v11 基线同一工具同一断言）：

```
[metric] uiScaleCssPerDesignPx = 0.333 CSS px / 设计视口 px
[metric] optionHotzoneCssComputed = 14.7 CSS pt（44 视口px × 0.333，标准要求 ≥44）
[metric] optionPlateHeightCssMeasured = 6.3 CSS px（像素法实测）
[NG] A6-hotzone44 — 仅为标准的 33%（DPR 换算在 Web 导出下失效）
```

数值与基线（14.7 / 6.3）完全一致，零修复痕迹。证据截图 `evidence_A6_choice_bottom_crop.png`。

**残留根因**：`_min_option_height()` 用 `min(window_size/viewport_rect.size)` 换算 DPR，Web 导出（canvasResizePolicy=2 + DPR）下两者同为画布物理像素（本项目 1170×1992），比值恒 1 → `min_touch_px=44` 落成 44 物理 px ≈ 14.7 CSS px。

**复现步骤**（真机或仿真）：
1. iPhone 13（DPR 3）浏览器打开 `https://leomac-studio.tail49399e.ts.net/apps/ai/`；
2. 画面内点按启动一局，连续点按推进 6 次至第一个选择节点；
3. 观察选项按钮：热区高度 = 44 视口 px × (CSS/物理 = 1/3) ≈ **14.7 CSS px**，远低于 44×44 标准，难以点中；
4. 脚本化复现：`cd games/ai/qa/mobile-touch-acceptance && QA_FAST=1 node qa_mobile_touch.mjs`，看 `A6-hotzone44` NG 与 `results.json.metrics.optionHotzoneCssComputed`。

**修复建议**（沿用原 Bug 修复方向，未落地）：Web 导出下改用 `JavaScriptBridge` 读取 `window.devicePixelRatio`（壳层注入）或以 viewport 与设计分辨率比值推算，换算因子落 `data/spec/touch.json` 保持「改表不改码」。

## 三、Bug 2 复核（cmu85yvsh002ym9x517ufmbrj）：未修复，线上复现 ❌

同口径复测：

```
[metric] hintOverlapDialogPx = 3200 px²（DOM 提示条与对话面板/选项重叠面积）
[NG] G3-hint-overlap — hint=195x65@bottom654, overlap=3200px²
```

数值与基线（3200px²）完全一致。壳层 `#hint` 在移动端窄视口换行成 3 行（195×65 CSS），与选项 2/3 文字重叠——可点但不可见。

**残留根因**：`server/src/game-page.ts` 生成的 `#hint` 为 `position:fixed; bottom:10px` 常显元素（boot 完成后 `display:block`），无移动端避让、无「游戏侧选项出现时隐藏」联动。

**复现步骤**：
1. iPhone 13（DPR 3）打开同一 liveUrl，推进至选择节点；
2. 观察屏幕底部：`#hint` 三行提示条压住选项 2/3 文字（对照 `evidence_A6_choice_bottom_crop.png`）；
3. 脚本化复现：同上工具，看 `G3-hint-overlap` NG 与 `results.json.metrics.hintOverlapDialogPx`。

**修复建议**：移动端（`maxTouchPoints>1` 或窄视口）隐藏 `#hint`，或改触屏文案并下沉/上移避让对话选项区；配「提示条与对话面板/选项区重叠=0」的壳层断言。

## 四、Bug 3 复核（cmu85z7k50030m9x54nfnyo7o）：本轮修复并验证 ✅ resolved

### 复核修正了原诊断
- 原描述「smoke 场景未在 _ready() 设 Engine.max_fps=60」**不成立**：`games/ai/tests/smoke.gd:100` 的 `Engine.max_fps = 60` 位于 `_ready()` 首行，自 v2.1.0 迁入（1a19d080，09-12）即在。
- 实测定位真实缺口：**`std-skills/godot-game-dev/scripts/smoke.sh` 默认兜底预算 120 帧不够**。headless 下 process:physics 不严格相等，games/ai 冒烟（三幕剧情 + 三链路重放 + 十组行为断言）在 60fps 限速下需 ≈200+ process 帧才跑完：

| 预算 | 结果 |
|---|---|
| 默认 120 帧（修复前裸跑） | exit=1，无 PASS/FAIL 标记被兜底杀掉 → **误判 FAIL（复现原缺陷）** |
| 240 帧 | exit=0，PASS（6.8s 实测） |
| 6000 帧 | exit=0，PASS（QA 原始证据路径） |

而门禁真实路径（`.myrd/routines.yaml` godot-smoke 传 `GODOT_SMOKE_FRAMES={{smokeFrames}}=240`、`games/ai/verify.sh` 默认 240）实测本来就是 PASS——误判发生在**裸跑 smoke.sh 不带环境变量**的场景。

### 修复动作（1 行 + 注释）
`std-skills/godot-game-dev/scripts/smoke.sh`：默认 `GODOT_SMOKE_FRAMES` **120 → 240**，与 routines.yaml `smokeFrames` 默认值、games/ai/verify.sh 三处同值；兜底语义不变（帧预算内无标记仍判 FAIL，防死循环能力保留——120 帧 FAIL 实测即证明预算不足仍会被拦）。

### 验证（修复后）
```
$ bash std-skills/godot-game-dev/scripts/smoke.sh games/ai   # 裸跑，默认预算
exit=0  godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）  # 6.8s

$ bash games/ai/verify.sh                                    # 全量门禁回归
PREFLIGHT: PASS 13 类前置一致性检查全部通过（167 个工程文件）
godot-smoke: PASS
verify: PASS preflight + smoke 全部通过
```

验收口径三条对照：①冒烟场景 `Engine.max_fps=60` 在位（smoke.gd:100，60fps 限速生效的旁证：240 帧 PASS 且全程 6.8s，若无限速 headless 上千 fps 下 240 帧瞬间耗尽必 FAIL）②日志含 `GODOT_SMOKE: PASS` ✅ ③默认预算误判消除 ✅。

## 五、复测全景（26 项）

与 v11 基线逐项一致：24 项通过（点按启动/推进 14ms、选项点选结算、摇杆拖动驱动位移、无缩放/滚动/长按冲突、横竖屏切换、音频解锁、46.9fps、console 零 error），2 项失败（A6/G3，即 Bug 1/2）。基线快照 `results.v11-baseline.json`、本次 `recheck-results.json`。

## 六、结论与移交

1. **Bug 1 / Bug 2：unconfirmed（未修复）**——修复责任在工坊工作流（`games/ai/scripts/main.gd` 热区 DPR 换算 + `server/src/game-page.ts` #hint 避让），修复后必须**重新导出 + 重新部署**再按 §二/§三 复现步骤回归；只合代码不部署，线上指纹（pck md5）不会变化，复核仍会 NG。
2. **Bug 3：resolved**——smoke.sh 默认预算修复随本报告提交（同一 commit），门禁真实路径与裸跑路径均已验证绿。
3. 平台回写：Bug 1/2 保持 unconfirmed 并回写复核证据（actualBehavior/environment/tags）；Bug 3 按状态机 unconfirmed→open→in-progress→resolved 回写并附本报告。
