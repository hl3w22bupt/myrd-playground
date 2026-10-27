# 证据一行式模板（g2-blocks · N4 / N5 共用）

> 更新时间：2026-10-01（N1 修复轮 · 游戏 QA 出模板）
> 负责人：游戏 QA（模板与口径）/ 全员（执行）
> 用法：每条机判证据压成一行入档（gate-logs 下对应目录），目录内 README 汇总表逐行引用；四要素缺一即按证据缺陷打回。

## 一行式格式

```
[结果] | <节点/线> | <文件名> | <日期 UTC+8> | <命令原文> | <输出摘要（含关键数字）> | <执行目录>
```

- `[结果]` ∈ `PASS` / `RED` / `PENDING-APPROVE` / `BLOCKED`（四态，禁止空缺；PENDING-APPROVE ≠ PASS，BLOCKED 须附原因与解锁条件）
- `<命令原文>`：可复制重跑的完整命令（含相对路径与参数），禁止写「见脚本」
- `<输出摘要>`：一行内含关键数字（如 `21/21 ALL-GREEN minΔE=26.555 阈值=25`），禁止只写「通过」

## 示例（本轮真实证据）

```
[PASS] | 线1 美术 | 03-matrix-21.log | 2026-10-01 | node tools/palette-gate.mjs matrix --palette assets/palette/palette-n1-final.json --threshold 25 --pairs 21 | ALL-GREEN 0红/21对 minΔE=26.555 阈值=25 margin=+1.555 selftest=18/18 | g2-blocks 仓库根
[PASS] | 线2 策划 | 02-spec-chain.log | 2026-10-01 | curl -s "$BASE/api/v1/game-design-specs/cmuovwra0004gm97tinha15zq" | v1 status=draft 回读全等 anchor=302e6336… | 平台 API
[PENDING-APPROVE] | 线3 程序 | 03-theme-framework.log | 2026-10-01 | node tests/theme.spec.mjs | PENDING-APPROVE（src/render/theme.ts 未产，冻结值实现等 approve）exit=2(--strict) | g2-blocks 仓库根
```

## 打回规则（QA 口径）

1. 缺任一要素（结果/文件/日期/命令/摘要/目录）→ 证据缺陷，打回补档，不构成「已证」。
2. `PENDING-APPROVE` 被记成 `PASS` → 假绿，按缺陷打回并计入 QA 回执。
3. `BLOCKED` 无解锁条件 → 视为空转，打回。
4. 命令不可复制重跑（路径含本机绝对路径且无替代变量说明）→ 打回。
