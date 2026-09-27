# N6 人工拍板备忘 — 霓虹夜塔视觉与 juice 冲刺（r4）

> 致：主人 · 自：主策划 · 日期：2026-09-27
> 性质：**升级件（N6 人工拍板）** —— 机器不替人判断「好不好玩」；本关不过，冲刺不算完。
> 冲刺单句目标复核：换装「霓虹夜塔」并落地 juice 四判据 = **spec v1.2 approved ✓ / 四判据冒烟全绿 ✓ / P0 资产对照过检 ✓ / 人工拍板（待您裁决）**

## 一、机器面已收口（您可只审这一段的结论）

| 项 | 结论 | 一手证据 |
|---|---|---|
| spec v1.2 | 平台 v4 approved（`cmuj5f6ik00hkm9l64r5uickm`，approved 唯一）；v1.1（D1/D2/D3）零丢失折入；v1 冻结七键 sha256 相等（机械断言进门禁） | `.myrd/spec/stack-tower-spec.json` / `design-spec.json`；QA 回执 §一 |
| 四判据 | j1 首块≤3s ✓ / j2 juice≤100ms ✓ / j3 音画≤50ms（dispatch→play，采纳 QA 重定义）✓ / j4 重开≤1.5s ✓ | run-all 31/31，`gate-logs/r4-neon-juice-20260927-n5/2-run-all.log` |
| P0 资产 13 项 | 逐件查表 PASS（hex±5 / 禁描边 / 渐变二值 / 几何±10%） | `3-assets-neon.log`；风格卡 v1.0 冻结（2026-09-27）先于验收，门序合规 |
| 门禁 | 7/7 全绿（typecheck / 契约 31 / P0 查表 / perf 相对判 / M2.1 资产 / 冒烟 / 壳形态） | `gate-logs/r4-neon-juice-20260927-n5/`（7 文件，命令+日期+输出摘要） |
| 销案 | 9/24、9/25 五案正式关账（A 失败轮 / B spec v1.1→v1.2 吸收 / C sfx-pack-v1 已交付 / D PWA 工程面 / E U7 维持立案），每案保留一次代码级复核权 | QA 回执 §四 |

## 二、待您拍板的四件事

1. **首图定稿**：基准四联图 `games/stack-tower/assets/reference/neon-night-quad-v1.png`（sha256 `01ea413e15e4c6ed…`，2×2 = 开局/游戏中/perfect 时刻/失败与重开）。**请过目定稿或给修改方向**（改色/构图 → 先升风格卡 v1.1 → 再动 theme.ts → 重生成 → hash 更新留痕）。
2. **发布包终审**：r4 变更树（theme 换装 + 开局摆位 + 涟漪池 + 五钩子埋点 + 9 条新契约）已全绿；**部署只发生在默认工作流 deploy 节点**——您批准后进入发布流程（沿 M2.1 两段式：对内回执 → deploy → 对外冒烟）。
3. **试玩终裁**：本地 `node games/stack-tower/serve.mjs` 即可试玩（开局 3–5 块 + 霓虹夜塔 + perfect 涟漪/音画）。请裁决「好不好玩」——尤其开局摆位后的首屏体感（e05 开局不劝退列）。
4. **R2 线上裁决**（承 9/26 r2 轮升级，三选一，见 `docs/qa-live-check-m21-r2.md` §三）：代理放行头 / 放宽路由护栏 / 指认非代理托管形态。裁决后复跑 N6 对外冒烟，「可安装/断网可玩」宣告随之解冻。

## 三、仍欠清单（不阻塞上述裁决，如实列明）

- 真机三项（性能绝对阈值 P95≤16.6ms / 峰值≥55fps 按两层制只在真机判：骁龙7系/天玑8000系级 + Chrome WebView，3 轮×60s；iOS Safari 首手势解锁；触控手感）——CI 相对判已 PASS 但**不得替代真机证据**。
- D4/D5 答复：`tests/audio/events.test.ts` / `bgm-loop.test.ts` 仍冻结未落盘（acc-a7 check 指向它，不计红不判绿）。
- OD 守护进程 `127.0.0.1:7456` 不可达：请修复（`pnpm tools-dev` 或等效）；本轮资产已按纪律以 repo 文件+hash 承载，未降级为纸面件。
- U7（线上贴图程序化形态）：修复 ~3 行，待您排期，未夹带本轮。
