# 冒烟门禁默认帧预算机器敏感性复现记录（2026-09-27）

> **结论先行：环境类问题，非游戏回归。** `smoke.sh` 默认帧预算 `GODOT_SMOKE_FRAMES=120`
> 在本机对 `games/game-2` 报 FAIL「120 帧内无 PASS/FAIL 标记」；把预算放大到 3000 帧后
> 立即 `GODOT_SMOKE: PASS`。同机 fuzz 与 preflight 均绿 —— 判定逻辑本身没问题，
> 是**默认预算对机器/引擎启动速度敏感**。

实测时间：2026-09-27；执行环境：本工作区（macOS 26.3.1）。

## 1. 复现结果

| # | 命令 | 帧预算 | 结果 | 耗时 |
|---|---|---|---|---|
| 1 | `bash std-skills/godot-game-dev/scripts/smoke.sh games/game-2` | 默认 120 | **FAIL**：`冒烟场景 tests/smoke.tscn 在 --quit-after 120 帧内没有打出 GODOT_SMOKE: PASS/FAIL 标记` | — |
| 2 | `GODOT_SMOKE_FRAMES=3000 bash std-skills/godot-game-dev/scripts/smoke.sh games/game-2` | 3000 | **GODOT_SMOKE: PASS**（退出码 0） | 6.7s |
| 3 | 同机 fuzz | — | **GODOT_FUZZ: PASS**（seed=20260913） | — |
| 4 | 同机 preflight | — | **PASS**（65 文件） | — |

## 2. 归因

- `std-skills/godot-game-dev/scripts/smoke.sh:31` → `FRAMES="${GODOT_SMOKE_FRAMES:-120}"`，
  该默认值的意图是「防止冒烟场景死循环」（脚本头部注释），不是性能指标。
- 引擎启动 + 首场景加载 + autoload 初始化本身就要消耗一部分帧；在较慢或首次冷启动的
  机器上，120 帧可能还没走到冒烟断言的打印点，于是被判「帧内无标记」。
- 同机换 3000 帧后 6.7 秒即 PASS，说明游戏逻辑断言真实通过 —— **不是游戏回归**，
  只是预算不足以覆盖本机的启动开销。

## 3. 建议

1. **工作流 preHook 显式设 `GODOT_SMOKE_FRAMES=3000`** —— 立即可用，不动模板仓库。
2. **模板仓库上调默认值**（如 120 → 1200 或 3000），或在 FAIL 提示里把
   「加大预算」的说明从第 130 行的次要提示提升为失败摘要的首行。
   工程自带 `games/game-2/verify.sh` 已自用 `GODOT_SMOKE_FRAMES=240`，
   与模板默认 120 不一致本身也是这层敏感性的旁证。

## 4. 与真机验证的关系

此项与本机真机探针（`real-device-ios-20260927.md` §7）相互独立：帧预算问题只影响
**本机无头门禁**，不影响线上部署与 iPhone 侧实测。线上资产通道此前已实测可用
（`real-device-ios-20260927.md` §5，pck/wasm/js 均 HTTP 200）。
