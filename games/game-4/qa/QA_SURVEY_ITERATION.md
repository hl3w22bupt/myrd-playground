# 《光路谜阵》QA 自检 + 四问量表内置化 · 复验与部署取证（v18）

> 本轮节点：在既有 game-4 工程上迭代收口——① ?qa=1 真机自检模式复核；② ?tuning=1 四问量表内置化复核；
> ③ 四门禁复验 → 重导出 → AppHost 重部署（gitRef=myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg）→ 回写 liveUrl。
> 日期：2026-09-27。基线 commit：d639ab8（= 远端 myrd/game-4-goal-cmuieqj7o0031m9gyf4pbwptg）。

## 一、功能复核结论（①②已在基线完整落地，本轮逐条机核）

### ① 真机自检模式（?qa=1）
| 任务要求 | 实现位置 | 结论 |
|---|---|---|
| Godot Web 端用 JavaScriptBridge 解析 URL 参数 | `scripts/web_bridge.gd::read_url_flags()`（URLSearchParams → JSON → Dictionary）；`scripts/qa_selftest.gd::_ready()` 以 `flags.qa == "1"` 且 `WebBridge.is_web()` 激活 | ✅ |
| 自动采集触屏命中 | `qa_selftest.gd` 被动真实点击 + 主动全格 sweep（`run_auto_sweep()`），逐样本核对「点击坐标 → 路由格子 → 是否按预期旋转」 | ✅ |
| 旋转响应时延 | 点击到达 → 应用后下一渲染帧，mean/p50/p95/max（预算 120ms，`ROTATION_LATENCY_BUDGET_MS`） | ✅ |
| 音效播放状态（AudioContext/设备信息） | `WebBridge.audio_debug()` 读壳页 `window.__audioDebug()`（AudioContext state / worklet 装载数 / 状态变迁日志）+ `AudioServer` 驱动/混音率/输出设备 + `WebBridge.device_info()`（UA/DPR/屏幕/触摸点数） | ✅ |
| 一键生成 JSON 实测报告 | `build_report()` → `guanglu-qa-report/1` schema（engine/device/audio/touch/rotation_latency/level/verdict），`report_json()` 单行紧凑 | ✅ |
| iOS 系统分享/剪贴板导出 | `WebBridge.export_text()` 四级降级：navigator.share → clipboard.writeText → execCommand('copy') → Blob 下载；Promise 结果经 `window.__GUANGLU_SHARE__` 轮询（`export_status()`） | ✅ |

判定口径机判无主观项：命中率预算 `HIT_RATE_BUDGET=1.0`、时延 p95 ≤ 120ms、音频 running 或 pending_unlock（suspended/interrupted）均计入 verdict.pass。

### ② 四问量表内置化（?tuning=1 + 通关结算页）
| 任务要求 | 实现位置 | 结论 |
|---|---|---|
| 四问改为游戏内点选 | `scripts/survey_panel.gd`：q1 能/否+卡点+秒数；q2 1-5+原因；q3 四维（旋转/光束/音效/画面）各 1-5；q4 无/有+位置+表现；选项按钮 toggle_mode 点选 | ✅ |
| 答案本地持久化 | `autoload/game_state.gd`：`set_survey_answer()` 只认 `SURVEY_KEYS` 声明键，即时 `save_survey()` 落 `user://guanglu_survey.cfg`（带版本号，启动 `load_survey()` 恢复） | ✅ |
| 一键导出/分享回传 | `submit_survey()`：必答校验（`survey_missing_required()`）→ `stamp_survey_meta()` 盖章 → `guanglu-survey/1` 载荷 → `WebBridge.export_text()` 分享/剪贴板/下载 + 控制台 `GUANGLU_SURVEY` | ✅ |
| ?tuning=1 直开 | `survey_panel.gd::_ready()` 检测 `flags.tuning != ""` 浮出「入口按钮」（与调参工作台 TuningPanel 共存互不遮挡） | ✅ |
| 通关结算页入口 | 订阅 `GameState.level_solved`，通关后浮出「📋 试玩四问」按钮（已填显示「已填，可改」） | ✅ |

壳页配套（`server/src/game-page.ts`，均在引擎加载前安装）：调参桥 `?tuning=<json>` → `window.__GAME_TUNING__`（非法值降级为 `__GAME_TUNING_PANEL__='requested'`）；`?qa=1` / `?tuning=1` 徽标（启动屏一眼可辨）；移动端音频手势解锁器（AudioContext 构造器包装 + 手势内同步 resume + visibilitychange + `window.__audioDebug()` 取证口）。

## 二、门禁复验（与 CI 同源判定脚本，仓库内 std-skills/godot-game-dev/scripts/）

| 门禁 | 命令 | 结果 |
|---|---|---|
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-4` | **PASS**（13 类前置一致性检查全过，76 工程文件） |
| smoke | `GODOT_SMOKE_FRAMES=240 … smoke.sh games/game-4` | **PASS**（退出码 0；脚本内部引擎日志含 `GODOT_SMOKE: PASS` 标记、断言齐全、零 SCRIPT ERROR/Parse Error） |
| input-fuzz | `… input-fuzz.sh games/game-4` | **PASS**（`GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239`，退出码 0） |
| playtest | `… playtest.sh games/game-4` | **PASS**（`GODOT_PLAYTEST: PASS`，3 局 × 900 帧：fb=156/147/173，首奖励 1.45s/11.5s，反馈间隔 max 0.95s ≤ 10s 阈值，seed 结果多样性达标） |

环境：Godot 4.3.stable.official.77dcf97d8（`resolve-godot.sh` → PATH `godot`）。

## 三、重导出与新鲜度证明

- 预设：`games/game-4/export_presets.cfg` platform="Web"、`export_path="export/web/index.html"`、`variant/thread_support=false`。
- 命令：`godot --headless --path games/game-4 --export-release "Web" export/web/index.html` → 退出码 0。
- 产物（games/game-4/export/web/）：index.html、index.wasm（35,376,909 B）、index.pck（2,609,264 B）、index.js（331,495 B）、index.audio.worklet.js、三图标。
- **新鲜度证明**：导出后 `git status` 全净 —— 重导出产物与已提交版本**字节一致**（确定性导出），
  即仓库内 export/web 就是当前代码（含 ①②功能）的真实产物，部署侧按 assets_dir 取到的即此版本。

## 四、分支与部署口径

- 任务锁定部署 ref：`myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`（远端原不存在，按任务纪律自当前基线新建并推送）。
- 既有实现分支：`myrd/game-4-goal-cmuieqj7o0031m9gyf4pbwptg`（前序各轮产出所在，基线 d639ab8）。
- 两分支同源同内容：本轮提交同时推送到两条分支，部署 gitRef 用锁定的 `myrd/games-goal-…`，绝不落 main。

## 五、v18 部署与公网核验（2026-09-27）

- 部署请求：mode=bundle，gitRef=`myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`，sourceId=`cmuieqj7o0031m9gyf4pbwptg`，
  triggeredById=`cmuieqj7o0031m9gyf4pbwptg`，hostedAppId=`cmuieqj7n002zm9gyy4u8qeai`
- 响应：success=true，**deploymentId `cmuisxou100ccm9l6wv2gpynx`**，liveUrl `https://leomac-studio.tail49399e.ts.net/apps/game-4/`，
  status=running（旧部署全部 superseded；状态停 running 为平台已知行为，验收以公网实测为准，与 v5/v17 口径一致）
- 本轮 commit：`81e3304`（复验取证文档 + 重导出字节一致证明）

### 公网冒烟（curl 实测，全绿）

| 检查 | 结果 |
|---|---|
| GET `/apps/game-4/health` | 200，`{"ok":true,"app":"light-path-labyrinth","assets":"lazy/object-storage"}` |
| GET `/apps/game-4/`（无尾斜杠） | 200 text/html；带尾斜杠 308 规整（网关既有行为，浏览器自动跟随） |
| 壳契约标记 | `__audioDebug` / `__GAME_TUNING__` / `mode-badge` / 相对路径 `api/public/assets/index.js` / `index.wasm.gz.b64` / 标题「光路谜阵」全部 FOUND |
| GET `…/api/public/assets/index.wasm` | 200 **application/wasm**（部署硬约束） |
| GET `…/api/public/assets/index.js` | 200 text/javascript |
| GET `…/api/public/assets/index.audio.worklet.js` | 200 text/javascript |
| GET `…/api/public/assets/index.pck.gz.b64` | 200 text/plain（文本通道） |
| 资产完整性 | b64→gunzip 往返 sha256 与仓内产物一致：wasm `fe5cebc5…`(35,376,909B)、pck `f5f101f9…`(2,609,264B) |

**冒烟结论**：v18 部署公网 8/8 全绿；线上 wasm/pck 与过四门禁的仓内产物 sha256 逐字节一致，
即 ?qa=1 真机自检与 ?tuning=1 四问量表两项内置化能力已随本轮部署对公网生效。
