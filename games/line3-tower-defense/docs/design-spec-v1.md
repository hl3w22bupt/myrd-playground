# 单场景塔防（线 3）· 策划案 v1.0（人读版）

> 链上锚：平台 v2 `cmvbqgzbl0029m9ax64foxd37` · **approved**（2026-10-17T01:44:41Z）· 父版 v1（v0.1 骨架）superseded
> 机读单源：`.myrd/spec/line3-tower-defense/design-spec.json`（与链上锚键序无关深比零漂移 PASS）
> 本文=人读摘要；冲突时以机读单源为准。版本链台账：`.myrd/spec/line3-tower-defense/REVISIONS.md`

## meta

- **一句话**：预判敌潮路线、布防升级炮塔守住核心的波次塔防：确定性战局同 seed 逐字节可复现，程序化关卡谱系给每日挑战公平竞技。
- 品类：单场景塔防（炮塔防守 · 波次切面 · IAA 主导 · 微肉鸽）· 引擎：TS+Canvas（零 npm 依赖，wheat-squad 判例平移）· 平台目标：web / wx / dy
- 拍板链：line3-memo-v1（2026-10-16 主策划拍板，四字段+视觉基调带出处 D15-D28）→ 本轮 B2 六件套 → B5 QA 预审 PASS → B6 主策划六判据 approve
- 埋点八键（四件定名 approve 后锁定，rename 一次性收口）：`run_start` / `run_end{run_duration_ms,reason}` / **`first_tap`** / **`hint_shown{atMs,text}`** / **`first_loop_complete{atMs}`** / **`restart_clicked{count,atMs}`** / `first_placement_at{atMs}` / `feedback_latency_ms`

## world

- **主题**：极简高对比色块战场 × 治愈系微调（对标《赵云与阿斗》基调，出处 D25；正式视觉待主人过目）
- **场景**：20×12 格（640×384 逻辑面）· 1 条敌军路径（暖沙虚线箭头常显）· 网格化布防位（路径格+核心 2×2 禁建）· 核心据点生命 10
- **差异点三列（不同品类声明）**：
  | 线 | spec 文本 | 关系 |
  |---|---|---|
  | 线 1 g2-blocks | 「在 8×8 的熔炉板上交换相邻方块凑成三连……趁热把连击打满」 | 消除/三连交换大类——零机制复用 |
  | 线 2 wheat-squad | 「单指拖动小队移动、队员自动作战的局内割草生存 + 局外放置收益成长」 | 割草+放置——本作主体=布防/升级防线（预置策略），零机制复用 |
  | ⚠️相近面披露 | wheat-squad 有 waveIndex 波次节拍面 | 形态相近、机制主体不同（防守目标 vs 走位刷怪），不构成同品类 |
- **首屏文案**（12 条逐字，实现轮不得改一字）：敌潮将至 / 布防 · 升级 · 守住核心 / 开始布防 / 点击空地，放置第一座炮塔 / 选中炮塔，升级火力 / 核心 / 军费 / 波次 / 加速 / 守住啦 / 核心失守 / 再来一局
- **操作路径**（5 条带 path id）：path-place-turret-01 / path-upgrade-turret-01 / path-speed-toggle-01 / path-restart-01 / path-guidance-dismiss-01

## entities（12 条，script 落点全在盘）

kernel：e-kernel-loop（mulberry32+fixed-step）/ e-kernel-sim（stepSim 纯函数）；world：e-grid / e-core；player-side：e-turret；hostile：e-enemy / e-projectile；system：e-wave-director / e-economy / e-telemetry；presentation：e-render / e-input。逐条落点见 `docs/inventory.md`（inv-1 机判对账）。

## levels

- **level-1 首潮（教学波次）**：3 波 · 首波 ×0.5 宽松 · 首布防 ≤20s · 首升级 · 首波闭环（first_loop_complete 锚）
- **level-2 涨潮（波次爬升）**：victoryWaves=8 通关即胜利 · 敌量/血量 1.35×/波 · 漏怪核心-1，归零 defeat

## numeric（初始锚定值 · 实测后 revision 校准）

- waveBand：P50∈[240,420]s · P90≤600s · 20 种子 · start→end 链计数
- 波次：8 波 · 每波 6 敌 ×1.35 爬升 · 首波前 10 秒 ×0.5
- 炮塔：3 阶 · 伤 10×1.6/阶 · 射程 2.5 格+0.5/阶 · 射速 800ms×0.85/阶 · 放置 50 / 升级 80×1.6^(n-1)
- 敌军：hp 30×1.35/波 · 速 1.2 格/s · 出怪 900ms · 赏金 8×1.02/波；三型 grunt16/runner14/brute20（hp×1/0.6/3，速×1/1.6/0.7）
- 经济：起始 120；核心 10 命；反馈 hitFlash 90ms / 延迟 ≤100ms / 通道 ≥2 / 帧 P95≤16ms(n≥3000)；性能 ≤220 实体 / 单步 ≤16ms / 中端 ≤33ms
- palette：8 色白名单冻结（#202A38 #2F4156 #E9D8A6 #47617C #E76F51 #B75D69 #81B29A #F4F1DE）+ 两色混合派生规则（新增色相=违例）

## acceptance（15 条 · 四件套 + 11 条配套）

| 四件套 | id | mode | 判定核心 | 样本量 |
|---|---|---|---|---|
| 首 30 秒体验目标 | a1-td-first-placement-feedback | auto | 5/5 种子首布防 ≤20s + 首次命中反馈 ≤100ms | 5 |
| 单局时长双阈值 | a2-td-wave-duration-band | auto | P50∈[240,420]s · P90≤600s · 链 20/20 | 20 |
| 再来一局理由 | a3-td-restart-willingness | **manual** | 5 名真人 ≥4 人重开 ≥2 局且理由原话非空（未判定·待采，负责人+采样计划在 statement） | 5 |
| 反馈延迟+双通道 | a4-td-feedback-channels | auto | 延迟 ≤100ms · 通道 ≥2 · 帧 P95≤16ms | 全采样+n≥3000 |

配套：det-1（同 seed 逐字节）/ tex-1（零外部贴图）/ perf-1（≤220 实体·≤16ms 单步）/ a5（四事件骨架+文案三方逐字同名）/ a6（5 条路径 headless 全可达）/ ac-art-1..4（色板白名单/清单 ≤13 件封顶/theme.ts 单源/视觉签名全覆盖）/ inv-1（实体-文件对账）/ fnd-1（埋点定名逐字符）。

## 好玩终裁与红线

spec approve ≠ 好玩判定：a3 真人样本（主人圈定 5 名）与最终好玩判定始终归主人；机器只机判数值谓词面。数值面全部为初始锚定值（设计承诺，非实测），实现轮首批模拟局实测后走 revision 校准。
