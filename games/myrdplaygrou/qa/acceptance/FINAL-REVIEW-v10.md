# 终审复核记录（assign_agent「试玩验收」· 2026-11-01 晚间轮 · v10 部署版）

> 本文是试玩验收节点的**终审**留档。纪律：机判结论全部来自本轮独立复跑或可溯源证据；
> 「好不好玩」的判定不归机器——四问量表截至本轮结束**未回填**，如实标注，不代填。

## 0. 终审对象锚点

| 项 | 值 |
|---|---|
| HostedApp id | `cmvxjyb8a001xm905cnip241e`（slug `myrdplaygrou`，status ready） |
| deployment id | `cmvxwpgej000zm9z6mepcek2n`（version=10，status=running，mode=bundle） |
| 部署 commit | `5b38fb89fc16ed66bd8deb0c0e0e61cdcdc089ce`（HEAD a10d92a 相对它仅新增 qa/spec 证据，`git diff 5b38fb8..HEAD` 九个文件零工程代码） |
| gitRef | `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`（绑目标分支，未用 main） |
| 最终 liveUrl | https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/ |
| 部署完成时间 | 2026-11-01T14:10:05Z（平台 deployments 记录） |

## 1. 线上一致性（本轮独立复验，非沿用前序结论）

- 本地 `games/myrdplaygrou/export/web/index.pck`：5,576,736 bytes，sha256 `19c6ae6ef9ea2c1425bdfed1c4c8b838e715f26d06bc6f3b0ae47c5684eb1f7c`
- 线上 `index.pck`（`GET /api/public/assets/index.pck.gz.b64` → base64 解码 → gzip 解压）：5,576,736 bytes，sha256 `19c6ae6ef9ea2c1425bdfed1c4c8b838e715f26d06bc6f3b0ae47c5684eb1f7c` —— **逐字节一致**
- `/health` → 200；落地页（尾斜杠 308 归一化）→ 200

## 2. ① 4 条用户反馈闭环（全部在 v10 部署版复核）

| 反馈 | 机判证据 | 线上实证 |
|---|---|---|
| P1 无音效 | smoke 音频契约：BGM 就绪 + SFX_BANK 全 8 类契约音效注册 + 常驻静音开关（`GODOT_SMOKE: PASS` 含「音频契约」项） | 本轮线上探针：手势解锁后 `window.__audioDebug()` = `{state:"running", unlocked:true, muted:false, bgmPlaying:true, addModules:1}`（audio worklet 代理加载成功）；HUD 常驻「音效开」开关可见（截图） |
| P1 植物与背景同色不可见 | smoke `acc-contrast`：spec colorPairs 逐对 WCAG 2.x 相对亮度复算 ≥3.0（含 sunflower-body-vs-lawn-dark/light、sun-pickup 两档草坪、sun-counter-vs-ui-base），渲染常量与声明色一致性机判 | 线上截图 `step2-sunflower-placed.png`：橙色向日葵立于深/浅绿棋盘草坪，肉眼清晰可辨 |
| P2 僵尸种类不足 | smoke 内容表：僵尸 4 类绝对数值（血量/速度/击杀掉落面额）逐类断言；三关扫描断言编制只用已声明种类且逐关不减；总僵尸 12/15/19 逐关抬升 | 线上截图 `step3-sun-economy.png`：僵尸从右缘进场可见 |
| P2 植物种类不足且缺向日葵 | smoke 内容表：出战卡 5 张（sunflower/peashooter/frostpea/repeater/wallnut，造价 50/100/175/200/50）；向日葵 `produce=true, shots=0` 生产单位断言；阳光经济断言（天降/击杀掉落/向日葵产出同规则点按收集 + 向日葵周期产出） | 线上截图链：选卡栏 5 张（向日葵 50 在列）→ 布防向日葵成功（阳光 150→100 扣费 + 卡片进「冷却 5s」）→ 向日葵旁产出阳光 + 天降阳光同屏（`step2/step3`） |

**人工听感/观感结论不在本轮机判范围**：音效「可闻」与画面「耐看」的主观面归用户四问量表（见 §7）。

## 3. ② 三关通关机判 + 四轴方向断言 + spec.acceptance 落档

- **三关逐关通关（本轮独立复跑）**：`godot --headless --path games/myrdplaygrou --quit-after 240 tests/smoke.tscn` 退出码 0：
  - `第 1 关通关（game_ended=true，主按钮 next，波次 4/4）`
  - `关卡推进 → 第 2 关「后院黄昏」（起始阳光 150，波数 5）` → `第 2 关通关（next，5/5）`
  - `关卡推进 → 第 3 关「屋顶夜袭」（起始阳光 200，波数 6）` → `第 3 关通关（replay，6/6）`
- **试玩三关轮换**：`playtest-rotation.log`（qa/gate-logs/20261101-r3-merge/）证据行 3 局逐局对准第 1/2/3 关（波数 4/5/6）；本轮 `verify.sh` 复跑 `GODOT_PLAYTEST: PASS`（fb=227/245/240，最长反馈窗 0.38s）
- **四轴方向断言**：`tests/smoke.gd::_step_move_axis`（AXIS_SEQUENCE 右/左/上/下逐轴，位移分量方向 + 本轴支配正交轴，阈值 8px）在本轮 GODOT_SMOKE PASS 内
- **spec.acceptance 操控语义**（平台 API 独立复核）：`GET /api/v1/game-design-specs/approved?goalId=cmvxjycvn001zm905jnwpyliv` → spec v3（status=approved）acceptance 共 14 条，含 **`acc-input-semantics`（mode=auto，check=games/myrdplaygrou/tests/smoke.gd）**——正式入链，非口头声明

## 4. ③ qa/mobile 证据时效 + 双门禁（本轮双复跑）

- 既有门禁证据（r3 节点 0eed76c/a10d92a）：`qa/mobile/report.json` verdict=PASS，checkedAt **2026-11-01T14:28:57Z**，晚于部署完成 14:10:05Z —— 是 v10 部署后的产物；`ROUND-v10-SUMMARY.md` 记录部署前本地四门禁 + 线上 pck 哈希
- **本轮验收侧再复跑（判定脚本只来自仓库，未自写未改写）**：
  - 本地四门禁 `bash games/myrdplaygrou/verify.sh` → 退出码 0：PREFLIGHT PASS（15 类，2598 文件）/ GODOT_SMOKE PASS / GODOT_FUZZ PASS（seed=20260913）/ GODOT_PLAYTEST PASS
  - 移动端门禁 `node std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs --url <liveUrl> --project games/myrdplaygrou`（--project 完全口径）→ **`MOBILE_SMOKE: PASS` 11/11 全绿，退出码 0**（2026-11-01T15:16:53Z；fps=43 软渲染口径，colorCount=8，idleDiff=316，tapDiff=117，console 零 error，视口无溢出；证据 `qa/mobile/acceptance-v10/mobile-gate/`）

## 5. ④ Bug 核销（3 条，证据可溯）

| Bug | 状态 | 本轮独立复核 |
|---|---|---|
| `cmvxrs3fv005em905y4eouy35`（冒烟缺方向断言 + spec.acceptance 缺操控语义） | resolved（2026-11-01T14:35:37Z） | 工程面：四轴方向断言在 tests/smoke.gd 且本轮 PASS；spec 面：acc-input-semantics 经平台 API 复核已在 approved spec v3 acceptance 链（§3）——**证据可溯，核销成立** |
| `cmvxr1f1a004fm905ua2ua9ir`（三关通关缺机判覆盖） | resolved（2026-11-01T14:35:37Z） | 冒烟三关扫描本轮复跑全过 + 试玩逐局轮换第 1/2/3 关证据行在档（§3）——**证据可溯，核销成立** |
| `cmvxr34hs004hm905t24jq33l`（write_document 产物回写断链） | resolved（2026-11-01T12:16:35Z） | express_lane 判定「取证查错库」：实体在 documents 库（created_at 08:31:10Z，正文 11708 字节，project_resources 绑定同刻）、goal.artifacts 引用 1:1；本轮复现其原始取证路径 `GET /api/v1/knowledge/doc?id=…` 仍 NOT_FOUND——证实该 404 是 knowledge 库视角，不代表 documents 库缺实体；goal 产物清单与 DAG 上下文均载该文档全文。**核销成立（no-defect，取证面修复）** |

关联：4 条用户反馈缺陷载体 `cmvxruft9005om905eo4govlw`（status unconfirmed）——4 条缺陷在 v10 全部闭环（§2）。平台侧未向本节点开放 bug 状态写通道（GET 可读、PATCH/POST 子路径 404），状态流转请由 owner 侧或有写权限的流程收口；本条不构成放行障碍，缺陷修复面已由机判与线上实证背书。

## 6. 终审结论

**机判面：达标（achieved-candidate）。** 双门禁本轮复跑全绿、线上产物与分支代码逐字节一致、4 条用户反馈在部署版闭环、3 条 Bug 核销证据可溯、spec.acceptance 操控语义正式入链。

**试玩面：待用户回填，本轮不代判。** 「好不好玩」归人（四问量表见 playtest_kit 产物 `playtest-kit-cmvxjycvn001zm905jnwpyliv`，截至 2026-11-01T15:3xZ 未回填）。量表回填前，目标整体结论挂「机判达标 · 试玩待裁」，不以机判全绿冒充用户认可。

## 7. 待用户处理（不另开频道，goal 会话 @Admin）

1. 打开最终版试玩：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/（手机/电脑浏览器均可；首次点按开启声音）
2. 按试玩验收包回填四问量表（playtest_kit 产物内含问题清单）：好不好玩/哪里卡/想不想再来/最想改什么
3. 调参试玩可选：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/?tuning=1 （数值改动会话内即时生效；定稿须回写 spec 再改默认值）

## 8. 本轮新增证据清单（随仓库提交）

- `qa/mobile/acceptance-v10/acceptance-probe.json` + `step0-load.png` / `step1-level-start.png` / `step2-sunflower-placed.png` / `step3-sun-economy.png` —— 验收侧线上实机探针（音频取证 + 布防截图链；真机 chrome + swiftshader 软渲染，与门禁同源环境参数）
- `qa/mobile/acceptance-v10/mobile-gate/report.json` + 三张分阶段截图 —— 本轮 MOBILE_SMOKE PASS 复跑产物
- 本文 `qa/acceptance/FINAL-REVIEW-v10.md`
