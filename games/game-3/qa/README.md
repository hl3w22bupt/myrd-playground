# 《疾风忍者跑》QA 验收包（games/game-3/qa/）

> 2026-09-26 由「实现玩法」节点创建。用途：把「游戏能跑」升级为「真机上可玩、可复现、可归档」。

## 口径声明（先读这个）

本项目的验收分**两档口径**，二者不可互相替代：

| 口径 | 能证明什么 | 不能证明什么 | 状态 |
|---|---|---|---|
| **机器人试玩门禁** | 「好玩下限」的机判部分：开局正反馈及时性、反馈无断档、反馈密度、重开循环反复可玩（3 种子可复现） | 「好不好玩」（人 + 调参工作台的职责）；真实触控手感 | ✅ 已完成（`PLAYTEST.md`，GODOT_PLAYTEST: PASS） |
| **CDP 移动仿真预检** | 壳页资产通道、引擎启动链、调参桥注入、音频手势解锁的**链路正确性** | 真实触控延迟、真机音频（iOS 静音键/打断）、真机帧率/发热、Safari 版本差异 | ✅ 已完成（`cdp-precheck/`） |
| **iOS Safari 真机实测** | 上面「不能证明」的全部四项 | —— | ⏳ 待用户按 `ios-safari-checklist.md` 执行 |

**红线：CDP 预检 PASS ≠ 真机验收 PASS。** CDP 证据已实测暴露过一个环境性差异（无 GPU 的无头
Chromium 因缺 WebGL2 被引擎拒绝启动，见 `cdp-precheck/precheck-log.md` §P2）——这正是
「仿真环境 ≠ 目标环境」的直接例证，也是必须保留真机口径的原因。

## 文件索引

| 文件 | 内容 | 谁用 |
|---|---|---|
| `PLAYTEST.md` | ⓪ 机器人试玩验收包：GODOT_PLAYTEST 指标、阈值依据、负例探针证据、试玩发现的真缺陷与修复（重开防误触） | 全员只读；调参轮对照机判指标 |
| `ios-safari-checklist.md` | ① 真机实测清单：点按跳跃/二段跳、音效、加载与帧率，含机型/系统/录屏归档位 | 用户（真机执行者） |
| `cdp-precheck/` | ② CDP 移动仿真预检证据归档（**明确标注：非真机口径**） | 全员只读 |
| `tuning-params.md` | ③ 调参 URL 参数表：8 个键、钳制区间、复现 URL 生成方法 | 调手感的人 |
| `artifacts/` | 真机实测结果归档位（录屏/截图/结果表），回写模板在 `artifacts/README.md` | 用户（真机执行者） |

## 真机实测回写流程（用户执行）

1. 打开 `ios-safari-checklist.md`，按 C1–C12 逐项在 iPhone Safari 实测；
2. 录屏/截图按清单里的命名规则存入 `artifacts/`；
3. 复制 `artifacts/README.md` 里的结果表模板，逐项填 `pass / partial / fail + 证据文件名`；
4. 有手感不满意的地方，用 `tuning-params.md` 的调参 URL 在真机上复现调优，把最终定稿参数回写
   到 `artifacts/` 结果表（后续可据此改 `scripts/player.gd` 常量默认值，走正式门禁提交）。

## 工程事实速查（写本包时核实过的口径）

- liveUrl：`https://leomac-studio.tail49399e.ts.net/apps/game-3/`（`/health` 返回 `app: ninja-run`）
- 引擎：Godot 4.3 stable，gl_compatibility（WebGL2），线程支持关闭
- 壳页：`server/src/game-page.ts`（资产 base64 中转 + 音频手势解锁 + §3C 调参桥）
- 触摸输入：TouchScreenButton「跳」注入 `confirm` 动作 → 与键盘 `jump` 同一路径（`scripts/player.gd`）
- 门禁：`bash games/game-3/verify.sh` = preflight → smoke → input-fuzz → playtest（改游戏代码后必跑；
  2026-09-27 起四步全绿，playtest 判定器由运维提交落库，试玩证据见 `PLAYTEST.md`）
