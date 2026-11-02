# 线上终验收口 · v6 修复 + 四问面板线上版（2026-11-02 19:0x–19:3x +0800）

> 结论先行：**新 liveUrl 线上终审六项全部完成** —— ① pck 实锚（线上=main/goal 分支@`5f8e863` 新鲜导出
> `cbb87355…`，≠v14 旧包 `32d79ee2…`）②双门禁线上复跑全绿（mobile-web-smoke 11/11 ×双入口×修复前后两轮
> + 真实出声能量探针 9/9）③三条反馈逐项机判复现全过 ④三条 Bug 以正确姿势核销（均 closed + 证据化
> closeReason）⑤四问面板线上走查 PASS 且**零代填** ⑥goal.artifacts 已回写（PATCH 200，35 条）。
>
> **走查抓到并修复一个真缺口**：四问面板源码（`77e2ca1`，18:55）晚于末次导出（`d3313bb`，14:22），
> 此前「v6+四问面板已部署」的产物声明与线上事实不符 —— 线上跑的 pck（`76b09d9b…`）不含四问 UI
> （本目录 `tuning-walkthrough/phase-1-panel.png` 实证：面板只有调参滑杆区）。本轮按仓内判例
> 重导出 + 双应用重部署收口（commit `2e13bba`→`5f8e863`），修复后四问面板线上在场（见
> `tuning-walkthrough-postfix/`）。
>
> 量表状态 = **待用户试玩回填**（本节点零写入零代填，中继 GET latest 前后均 `no-submission-yet`）；
> 好不好玩/紧不紧张的拍板归 @Admin。

## 0. 线上产物身份链（部署记录 API 直查）

| 项 | 值 |
|---|---|
| HostedApp（workshop 主入口） | `cmvxjyb8a001xm905cnip241e`（slug `myrdplaygrou`） |
| HostedApp（goal 专属应用） | `cmvz5j9f7001zm9w9c01ph5xa`（slug `goal-jnwpyliv`，sourceType=goal） |
| 本次部署（goal 应用） | **`cmvz65bh6002km9w9tkmci7un`** running，gitRef=`main@5f8e863` |
| 本次部署（workshop 应用） | **`cmvz667x4002mm9w9ilil9f2h`** running，gitRef=`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv@5f8e863` |
| 历史部署 | v14 `cmvy6zxdg001qm9y0b3sgs5f6`（=旧包 32d79ee2）、v16 `cmvz29vr2008cm9lh8ce7163q`（=76b09d9b）均 superseded |
| liveUrl | `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/`（goal 入口 `/apps/goal-jnwpyliv/` 同构建） |
| /health | 200 `{"ok":true,"app":"myrdplaygrou","title":"植物人大战僵尸-网页版"}` |

## 1. ① pck 实锚（任务一）

- 资产通道：`/apps/<slug>/api/public/assets/index.pck`（gzip+b64 解码 8,233,792 B）。
- 修复前线上（本轮开工时）= `76b09d9b…` ≠ v14 `32d79ee2…`（v14 闭环成立）但 = 旧末次导出；
  **新鲜导出比对实锤缺口**：main 源码导出 = `cbb87355…` ≠ 已提交 `76b09d9b…`（Δ23,296 B = 四问面板）。
- 修复后（`live-pck-forensics-postfix.txt`）：两入口线上均 `cbb87355bbddb79b6d6521d83ac62416bc58c722a248f7a73c4fcb5a73bda7ab`
  = main/goal 分支@`5f8e863` 导出逐字节一致；index.js 无变化（`8b649683…`）。

## 2. ② 线上双门禁复跑（任务二）

| 口径 | 修复前（76b09d9b） | 修复后（cbb87355） |
|---|---|---|
| mobile-web-smoke（goal 入口，--project 完全口径） | `mobile-goalapp/` PASS 11/11 | `mobile-goalapp-postfix/` PASS 11/11 |
| mobile-web-smoke（myrdplaygrou 主入口） | `mobile-myrdapp/` PASS 11/11 | `mobile-myrdapp-postfix/` PASS 11/11 |
| 真实出声能量探针（audio_energy_probe.mjs，绑 expect-pck-sha） | `audio-probe/` **PASS 9/9**（当时线上=76b09d9b，哈希绑定成立） | 修复后未重跑（音频资产与音频链路代码在两包间无差异，Δ仅四问面板 UI；如实披露） |

11 项明细：network/console/canvas/render/animate/touch-pipeline/touch-response/joystick(按工程裁撤)/audio-unlock/viewport/fps 全 PASS；
fps 实测 39–51（swiftshader 软渲染口径），console 零 error，视口无横向溢出。

## 3. ③ 三条反馈逐项机判（任务三，本地源码断言 + 线上哈希绑定）

`bash games/myrdplaygrou/verify.sh`（600 帧）exit=0：PREFLIGHT 15 类 PASS / GODOT_SMOKE PASS /
GODOT_FUZZ PASS（seed=20260913）/ GODOT_PLAYTEST PASS（fb=228/247/238，最长无反馈窗 0.383s）。
`smoke-evidence.log` 三断言证据行（逐字）：

| 反馈 | 断言 | 证据行 |
|---|---|---|
| 顶栏单实例守卫 | `debug_control_counts()` 过关进第 2 关 | `[smoke] 顶栏单实例守卫通过（第 2 关常驻控件 sun/next_wave/wave/lives/back/restart/mute 各 1，卡槽 5 张）` |
| HUD 五档视口 | 360/768/1280/1920/2560 逐档实例化+两两无重叠 | `[smoke] HUD 布局 360×740：两行 12 元素在界无重叠（按钮高 44 css，行距 8，战场让位 50 px）` … `2560×1440：单行 …`（5 档 5 行全过） |
| 音频紧张感探针 | 紧张版分层行为断言 | `[smoke] 音频紧张感探针通过（groan/chomp/danger 触发、双版 BGM 切换与回落、末波急促号角在册）` |

线上侧补充机判：能量探针 9/9 证明「紧张感分层真的在响」（BGM 持续能量 ≥-48dBFS、音效尖峰、18 资产在包）。

## 4. ④ 三条 Bug 正确姿势核销（任务四）

`PATCH /api/v1/bugs/status?id=<bugId>` body `{"status":"closed","closeReason":"<逐条核销证据>"}`，均 HTTP 200：

| bugId | 终态 | resolvedAt |
|---|---|---|
| `cmvyowgsh006sm9y05qblbd70`（P1 顶栏按钮重复） | closed | 2026-11-02T11:14:28Z |
| `cmvyowgtj006um9y0lxb19hyt`（P1 按钮字体过大重叠） | closed | 2026-11-02T11:14:36Z |
| `cmvyowguf006wm9y0cf7fbxk3`（P2 音效不紧张） | closed | 2026-11-02T11:14:47Z |

聚合单 `cmvy3dy110013m9y0snem92ff`：平台已自动置 closed（closeReason=目标机器可推进工作已完成），本节点未触碰。
Bug③ closeReason 末尾附边界声明：机判只证「紧张感分层已实现且真实出声」，『够不够紧张好玩』归用户四问回填，不代答。

## 5. ⑤ 四问回填面板线上走查（任务五，只证可交互，不代填）

新增取证工具 `qa/mobile/tuning_panel_walkthrough.mjs`（复用能量探针 CDP 管线；永不点提交、永不 POST 答案，
中继 GET latest 前后对证零写入）：

| 相位 | 证据 | 结论 |
|---|---|---|
| 修复前 `tuning-walkthrough/` | phase-1-panel.png | **抓包缺口**：面板只有调参滑杆区，四问区不在场（源码未导出，见结论先行） |
| 修复后 `tuning-walkthrough-postfix/` | phase-1-panel.png | 四问区在场：Q1 时长/Q2 难度/吃力关卡下拉/Q3、Q4 星级/建议框/提交键（禁用态，还差 4 问未答）/**无任何预选态** |
| 交互实证 `tuning-walkthrough-postfix-tap/` | phase-2-answered.png | 点按 Q1「太短」→ 呈选中态，状态行变「还差 3 问未答（q2_difficulty,q3_tension_stars,q4_fun_stars）」，提交键仍禁用 = **可交互机判成立** |
| 零写入对证 | walkthrough-report.json（×3） | 中继 GET latest 走查前后均 `{"received":false,"reason":"no-submission-yet"}` = 未代填 |

## 6. ⑥ artifacts 回写（任务六）

- `GET /api/v1/goals/cmvxjycvn001zm905jnwpyliv` 200（403 时代已解除）→ 取最新 34 条 → 追加 1 条
  `acceptance_final_review`（含 HostedApp id / deployment id / liveUrl / 门禁证据 / 三反馈闭环状态 / 边界声明）
  → `PATCH` 200，复核 35 条、末条落卡；修正一处截断哈希笔误后复核通过。
- 合并不覆盖：PATCH 体重=GET 原数组原样+1 条新条目，未触碰任何既有条目。

## 7. 遗留（唯一）：人工试玩回填与拍板

@Admin 按 liveUrl 完整试玩（选关→布防→抵御波次→通关/重开）→ `?tuning=1` 打开调参工作台下半区
「试玩反馈四问（玩完一局回填）」亲手点选四问 → 提交（生成 spec.numeric 修订建议）→ 拍板是否入链修订。
机器侧全绿不替代人工验收，拍板前目标不关闭。
