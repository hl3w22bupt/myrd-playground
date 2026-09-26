# 《光路谜阵》试玩验收节点阻塞取证（playtest 节点）

- 阻塞时间：2026-09-26（playtest 节点，run `cmuievv4b004im9gyj1ga6cui`）
- 状态：**blocked —— 未产出试玩验收包**，未产生任何试玩结论
- 目标：`cmuieqj7o0031m9gyf4pbwptg`；分支 `myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`（tip `3773579`）
- 已回写：goal.artifacts 追加 `op=playtest_kit / artifactType=playtest_kit / status=blocked`

## 阻塞原因（硬约束「来源不可得 → 立即 blocked」）

门禁判定脚本 `std-skills/godot-game-dev/scripts/playtest.sh` **不在项目仓库内**。
判定器只能来自项目仓库（模板仓库预置）；平台注入目录
`.myrd-platform/.claude/skills/godot-game-dev/scripts/playtest.sh` 是阅读副本，
按硬约束不得作为判定脚本来源，也不得现场自造等价脚本 —— 否则门禁不再独立。

**需要谁做什么**：运维把 `playtest.sh`（配套 `playtest_driver.gd`）补进模板仓库
`std-skills/godot-game-dev/scripts/`；补齐后重跑 playtest 节点即可交付验收包。

## 核查证据（对远端 tip `3773579`，与部署 gitRef 一致）

`git ls-tree FETCH_HEAD std-skills/godot-game-dev/scripts/` 实有：

| 文件 | 在仓库内 |
|---|---|
| preflight.py | ✓ |
| smoke.sh | ✓ |
| input-fuzz.sh（+ input_fuzz_driver.gd） | ✓ |
| resolve-godot.sh | ✓ |
| **playtest.sh** | **✗ 缺失** |
| gate-selftest.sh / preflight_selftest.py | ✓（自测辅助） |

约束 2（门禁配置）满足：`.myrd/routines.yaml` 含 `id=godot-smoke`，
`std-skills/godot-game-dev/references/godot-smoke-routine.md` 在仓库内。

## 未被阻塞的部分（如实记录）

- deploy 产物正常：liveUrl `https://leomac-studio.tail49399e.ts.net/apps/game-4/gw`
  （artifacts 内 `op=run_workflow / status=completed`，deploymentId `cmuihb72x002dm9gcj5f1ud2b`）。
- 本节点前置「找 liveUrl」通过；阻塞点是门禁脚本缺失，不是部署缺失。
- 与 deploy 取证（`DEPLOY_SMOKE.md` 已知边界第 1 条「GODOT_PLAYTEST 未执行」）同源。

## 解除阻塞后的待办

1. 运维补齐模板仓库 `playtest.sh` → 同步进本项目仓库 `std-skills/godot-game-dev/scripts/`。
2. 重跑 playtest 节点：产出试玩验收包（试玩指引 / 四问量表 / 调参工作台入口 `<liveUrl>?tuning=1`）。
3. 量表四问逐条回填（未回填一律标「待用户试玩」，严禁编造结论）；
   收到用户调参 URL 后才走 `POST /api/v1/game-design-specs/:id/revisions` → `approve` 回写 spec。
