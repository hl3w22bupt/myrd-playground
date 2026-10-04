# QA 终审记录 — M2.1「有声可装」（音效 + 移动端适配 + PWA 部署）

> 更新时间：2026-09-25（复验轮：playwright 装载器统一 + sw.js 清单同步，见 §4 末两行；干净 shell 复跑全绿）· 负责人：QA 线（主策划整合）
> 基线：spec **v3 approved**（platformSpecId `cmugok2uz000xm9ilx42t8pnl`，v2 superseded）
> 基线导出：`.myrd/spec/stack-tower-spec.json`（契约与 QA 共同输入）
> 总复现：`cd games/stack-tower && npm run build && node tests/contract/run-all.mjs`（playwright 经 `tests/contract/_browser.mjs` 自动发现：本包 → PLAYWRIGHT_MODULE_DIR → npm 全局根，无需手工注入）

## 0. 总判定

| 项 | 结果 |
|---|---|
| 自动化契约 | **PASS 22 / FAIL 0 / not-runnable 0**（8 条冻结 gameplay + 14 条 M2.1 增量，逐条 RESULT 三件套见 §1） |
| 浏览器冒烟 | PASS (browser)（`node games/stack-tower/tests/smoke.mjs`） |
| 资产接线门禁 | PASS (browser)（`node games/stack-tower/tests/assets-check.mjs`，含资产全 404 负面用例） |
| 真机项 | **挂日期未核销**（acc-a2 / acc-m2 / acc-m3 / acc-d1 安装面 + acc-a5b 帧率真机面，见 §3） |
| 人工终裁 | 未拍板（「好不好玩」归主人试玩；本记录不代持人工验收） |

三态纪律：机器断言只记 PASS/FAIL/not-runnable；真机项一律「挂日期」，**approved 前的核销一律无效**。

## 1. 逐条核销三件套（复现命令 + 输出摘要 + 条目编号）

### M2 首卡冻结 8 条（回归面，v3 下零改动）

| 条目 | 复现命令 | 输出摘要 | 判定 |
|---|---|---|---|
| ac-lvl01-e01-spawn | `node games/stack-tower/tests/contract/lvl-01-stack-tower_e01-spawn-first-block.spec.mjs` | RESULT: PASS (4/4) | ✅ |
| ac-lvl01-e02-swing | `…e02-swing-motion.spec.mjs` | RESULT: PASS (4/4) | ✅ |
| ac-lvl01-e03-input | `…e03-drop-input.spec.mjs` | RESULT: PASS (4/4) | ✅ |
| ac-lvl01-e04-cut | `…e04-overlap-cut.spec.mjs` | RESULT: PASS (3/3) | ✅ |
| ac-lvl01-e05-window | `…e05-perfect-window.spec.mjs` | RESULT: PASS (4/4) | ✅ |
| ac-lvl01-e06-ripple | `…e06-tower-ripple.spec.mjs` | RESULT: PASS (4/4) | ✅ |
| ac-lvl01-e07-score | `…e07-score-hud.spec.mjs`（含数值总闸：NUMERIC ↔ spec.numeric 键序无关深比） | RESULT: PASS (4/4) | ✅ |
| ac-lvl01-e08-recover | `…e08-fail-recover.spec.mjs` | RESULT: PASS (4/4) | ✅ |

### M2.1 增量 14 条

| 条目 | 复现命令（`tests/contract/` 下） | 输出摘要 | 判定 |
|---|---|---|---|
| acc-a1 sfx-pack 注册表 | `m21-acc-a1-sfx-pack-registry.spec.mjs` | PASS (3/3)：12 文件成对对号 + 命名 `sfx-`+事件 id + 44.1kHz 全量（ogg Vorbis 头含单声道）+ restart 198ms≤200 + critical 与 voices.ts 同源 | ✅ |
| acc-a2 手势解锁 | `m21-acc-a2-unlock.spec.mjs` | PASS (3/3)：解锁前挂起零 source；unlock→state=running + 挂起补放；buffer 层直出。**真机挂账 §3** | ✅(自动化面) |
| acc-a3 静音持久 | `m21-acc-a3-mute-persist.spec.mjs` | PASS (4/4)：落盘 "1"/"0"；重建读回；静音零节点；隐私模式不抛错 | ✅ |
| acc-a4a 连击升调 | `m21-acc-a4a-combo-pitch.spec.mjs` | PASS (3/3)：1..5 连=+1..+5 半音；rate=2^(n/12)；miss 归零；seeded 5 连实测 [1,2,3,4,5] | ✅ |
| acc-a4b 封顶 | `m21-acc-a4b-combo-cap.spec.mjs` | PASS (3/3)：第 13/14/20/99 连均 +12；rate 封顶相等；12 半音=2 倍频 | ✅ |
| acc-a5a critical 不挤占 | `m21-acc-a5a-critical-priority.spec.mjs` | PASS (3/3)：满载非 critical 丢弃；miss/game-over/restart 满载仍出声（抢占最老非 critical）；池恒 ≤8 | ✅ |
| acc-a5b 有声帧预算 | `m21-acc-a5b-audio-frame-budget.spec.mjs` | PASS (2/2)：seeded 187 tick×20 tap，有声 p95=0.005ms/max=0.215ms，零 >50ms 帧，jank 不高于静音局。**真机帧率挂账 §3** | ✅(自动化面) |
| acc-a6 restart 事件 | `m21-acc-a6-restart-event.spec.mjs` | PASS (3/3)：恰 {type,source} 载荷（button/keyboard）；复位语义不变；sfx-restart ≤200ms critical 且触发出声 | ✅ |
| acc-m1 安全区 | `m21-acc-m1-safe-area.spec.mjs` | PASS (2/2)：CSS 变量绑定四边 env()；计算样式快照 `{"top":"32px","right":"22px","bottom":"28px","left":"14px"}`（注入 20/8/16/0px）。**真机清单挂账 §3** | ✅(自动化面) |
| acc-m2 触控归一 | `m21-acc-m2-touch-input.spec.mjs` | PASS (4/4)：pointerdown 单一入口+300ms 去抖；contextmenu/gesturestart/gesturechange/dblclick 全 preventDefault；touch-action:manipulation；viewport-fit=cover+user-scalable=no。**真机挂账 §3** | ✅(自动化面) |
| acc-m3 遮罩暂停 | `m21-acc-m3-rotate-pause.spec.mjs` | PASS (1/1)：Chromium 实测 portrait 35 → landscape 冻结（点击不计分）→ 重开恢复 +10；遮罩显隐随宽高比。**真机挂账 §3** | ✅(自动化面) |
| acc-m4 宽高比判定 | `m21-acc-m4-rotate-aspect.spec.mjs` | PASS (3/3)：720×480 激活 / 480×720 不激活 / 正方形不激活 / 阈值=ROTATE_ASPECT_RATIO(1) / 状态机 onChange 序列 | ✅ |
| acc-d1 PWA 壳 | `m21-acc-d1-pwa-shell.spec.mjs` | PASS (4/4)：manifest standalone+192/512 maskable（实际尺寸核对）+apple-touch-180；sw.js CACHE=st-precache-v1 与 numeric 同源+50 项 precache+fetch 拦截+activate 清旧；入口注册 SW+?fps=1 面板。**HTTPS 托管待主人指认，安装面挂账 §3** | ✅(自动化面) |
| acc-d2 断网冒烟 | `m21-acc-d2-offline-smoke.spec.mjs` | PASS (2/2)：SW precache（caches=[st-precache-v1]）→ 离线冷启动可玩（计分）→ R 重开复位 → 静音落盘且离线 reload 保持 → 零代码错误；sfx 全 404 负面用例不抛错可玩（承接 acc-a1 移出的 404 子句） | ✅ |

## 2. QA 4 项修正落条核对（全部入 v3 approved）

1. **acc-a4 拆 a4a/a4b** ✅（5 连逐块 +1 半音 / ≥14 连第 13、14 块 +12 封顶，两条独立契约独立可复现）。
2. **acc-a5 拆 a5a/a5b** ✅（单元级 spy：8 voices 满载 miss/game-over/restart 不挤占 / seeded 3 秒 20 连 tap 判据=有声局相对静音局无新增 >50ms 帧）。
3. **sfx-pack-v1 命名统一 + a1 改断言注册表完整性** ✅（`sfx-` + 事件 id；404 子句移入 acc-d2 负面用例，a1 不再断言网络行为）。
4. **tower-ripple 契约新增 restart 事件 + m1/m4 证据形式显式化** ✅（payload 恰 {source}；m4 纯函数宽高比判定；m1 计算样式快照为证据形式）。

## 3. 真机清单（挂日期：2026-09-26 待排期 · 不阻塞代码收口）

| 真机项 | 设备要求 | 证据形式 | 状态 |
|---|---|---|---|
| acc-a2 iOS 首手势解锁 | iPhone（iOS 17+，Safari 与 添加到主屏 双口径） | 录屏：冷启动首 tap 即出声；静音开关即无声 | ⏳ 挂日期 |
| acc-m2 触控真机 | 中端 Android（如 Redmi Note 系）+ iPhone | 录屏：连点无 300ms 延迟外丢点、长按无系统菜单、双指不缩放 | ⏳ 挂日期 |
| acc-m3 遮罩真机 | 同上 | 录屏：转横屏出遮罩并暂停、回竖屏续玩 | ⏳ 挂日期 |
| acc-a5b 帧率真机 | 中端 Android | `?fps=1` 面板录屏 30s：p95 ≤18.2ms、jank(>50ms)=0 | ⏳ 挂日期 |
| acc-d1 安装 | Android Chrome + iOS Safari | 安装横幅/添加到主屏 + 图标正确 + 离牌架线启动 | ⏳ 挂日期；**前置：HTTPS 托管地址待主人指认** |

## 4. 实现期缺陷台账（本轮发现并修复）

| 缺陷 | 影响 | 修复 | 回归证据 |
|---|---|---|---|
| pnglib `blend()` 三通道均写 r | M2 起**所有**生成 PNG 退化为灰度（贴图/图标全失色），既有门禁未查色值（QA 盲区） | 逐通道取源色；12 件全量重生成 | 色值抽样：e01 块面=amber 0.78 阶 (154,84,43)；目检图标琥珀/冷蓝 |
| 遮罩激活只掐输入不冻结内核 | `sim.tick(undefined)` 继续推进摆块 → 违反「激活即暂停」，恢复首点可能撞 game-over | main 帧循环 paused 时整段跳过逻辑步并丢弃时间片 | m3 契约 3 连跑 PASS |
| AudioManager unlock 先补放后预解码 | 挂起队列走程序化层而非 buffer 层（降级语义倒挂） | unlock 内 `await preload()` 后再补放 | a2 契约 PASS |
| manifest 生成键名覆盖（`m4a` 文件名被 KB 数覆盖） | acc-a1 注册表对号失败 | 键名改 `m4aKb/oggKb` | a1 契约 PASS |
| e07 数值总闸键序敏感 | 平台入库会归一化对象键序 → 基线切换即假红 | 总闸改键序无关深比（stableStringify），语义仍锁结构+数值 | e07 PASS |
| playwright 装载器三处各写一份、只认 `PLAYWRIGHT_MODULE_DIR` 显式注入 | 干净 shell 复跑门禁 → m1/m3/d2 三条浏览器级契约集体 not-runnable，A–E 汇总假 FAIL(3)（2026-09-25 复验轮实捕） | 装载统一收敛 `tests/contract/_browser.mjs`：本包 → 环境变量 → `npm root -g` 自动发现（非交互、失败路径显式 null）；assets-check / smoke 改指共享装载器 | 复验轮日志 `gate-logs/m21-reverify-20260925-art-final/`：A–E RESULT: PASS 22/22；m1/m3/d2 干净 shell 逐条 PASS |
| `sw.js` precache 清单落后 build 产物 5 项（audio-manager/voices/fps-overlay/rotate-overlay/style） | M2.1 新模块不进预缓存 → 全新离线首访缺件（回填机制兜底掩盖，冷启动离线面存疑）；生成件与生成器失同步 | `node tools/gen-sw.mjs` 重生成（清单 = build/ 目录真实扫描，确定性） | d1/d2 契约重跑 PASS；sw precache 55 项与 build 产物一致 |

### 语义裁决留档（QA 判读依据）
- **升调语义**：连击取内核 perfect 连击（combo）；「place 音第 n 连升 n 半音」读作「落块音随连击逐块 +1」（perfect 叮与 place 闷响同参），miss（combo=0）归零——与 a4a/a4b 判据（逐块 +1、13/14 封顶）自洽。
- **miss 音绑定**：`game-over(reason='total-miss')` → sfx-miss（critical）；`width-floor` → sfx-game-over（critical）；与「miss/game_over 不被挤占」判据一致。spec v3 `content.sfxPack` 的 sfx_mapping 文案与该绑定有出入，**挂入下一版修订（文案级，不涉数值/acceptance）**。
- **m4a 通道元数据**：afconvert 写 stsd channelcount=2 而实际 AAC 流为 1ch（afinfo：`1 ch, 44100 Hz, aac`）。单声道机判落点=Ogg Vorbis 头；m4a 断言采样率（stsd 实测位）+ mp4a 存在性。

## 5. 机器口径边界声明

- acc-a5b 自动化口径测的是**调度链开销**（Node 假件全链），非真机音频混音开销；真机帧率以 `?fps=1` 面板 + §3 录屏为准。
- acc-m1/m3 自动化口径在 Chromium（模拟 inset 注入 / setViewportSize）；真机 env() 与触控手感以 §3 为准。
- 人工验收未拍板前，本轮所有 ✅ 均为「自动化面核销」，不构成「好不好玩」结论。
