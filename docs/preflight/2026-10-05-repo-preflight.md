# 直通车预检报告：仓库可达性 + godot 门禁脚本可用性

- 日期：2026-10-05
- 目标：《汽车连连看》同车种配对连连看（目标会话 `run-goal-cmuv35n7o0051icry63ndtamn`）
- 分支：`myrd/repo-preflight-goal-cmuv35n7o0051icry63ndtamn`
- 仓库：`https://github.com/hl3w22bupt/myrd-playground.git`
- 检查工具：`std-skills/godot-game-dev/scripts/repo-preflight.sh`（本次新增，可复跑）

## 结论：PASS（不 blocked）—— 可进入开发节点

`bash std-skills/godot-game-dev/scripts/repo-preflight.sh --full` 退出码 0，10 项检查全过
（A1–A5 快检 7 项 + A6 运行期 3 项）。

## 检查明细（2026-10-05 实测输出）

| 项 | 内容 | 结果 |
|---|---|---|
| A1 | origin 可达（`git ls-remote --heads origin`，3 次退避重试口径） | OK |
| A2 | 门禁脚本齐备且可执行：9 个全部在位 | OK |
| A3 | docs 只读镜像逐字节一致：`preflight.py` `smoke.sh` `resolve-godot.sh` | OK |
| A4 | python3 3.9（需 3.8+）/ node v26.7.0 / Godot 4.3.stable（经 `resolve-godot.sh` 解析） | OK |
| A5 | preflight 自测：24/24 用例符合预期（该拦的拦下、不该拦的不误报） | OK |
| A6 | `smoke.sh` 对模板工程：`godot-smoke: PASS`（退出码 0、断言标记齐全、日志无脚本错误） | OK |
| A6 | `gate-selftest.sh`（模板工程为参照）：注入缺陷全被拦（D1–D5 PASS，D6–D8 不适用 SKIP） | OK |
| A6 | `mobile_smoke_selftest.mjs`：好页/坏页A/坏页B 三例判定力自测全过 | OK |

## 预检拦下并已修复的问题（2 处）

1. **`input-fuzz.sh` 缺可执行位**（A2 拦下）。`.myrd/routines.yaml` 的 `godot-smoke` routine
   以 `bash std-skills/godot-game-dev/scripts/input-fuzz.sh` 调用不受影响，但与其余 4 个
   `.sh`（全带 exec 位）不一致。已 `chmod +x` 修复，复跑转绿。
2. **A1 首跑判 blocked：github.com git 传输端点间歇不可达**（属环境瞬时问题，非仓库缺陷）。
   实测现象：DNS 正常、`api.github.com` 返回 200，但 `github.com:443`（20.205.243.166）
   TCP 超时；数分钟后自行恢复。据此把 A1 改为「45s 超时 × 3 次（5s/15s 退避）」的重试口径，
   仍不通才判 blocked，并在失败信息里给出「稍后重跑 / 改用代理网络」的处置建议。
   教训：管道里 `git fetch | head` 后取 `$?` 拿到的是 `head` 的退出码，**可达性断言必须
   直接对 git 命令本身判定**（本次首测就栽在这上面）。

## 非阻塞漂移备忘（供后续同步，不影响本次放行）

`std-skills/godot-game-dev/`（仓库内权威副本）落后于平台注入的
`.myrd-platform/.claude/skills/godot-game-dev/`：

- `scripts/preflight.py`：仓库版 13 类检查；平台版已含 P14（Juice 单例 autoload 接线检查），
  对应自测 24 例 vs 平台版 26 例。
- `scripts/` 缺 `playtest.sh`、`playtest_driver.gd`（平台版已具备）。
- `templates/minimal-2d/` 缺 Juice autoload、`tuning_panel.gd`、sfx 资产等（平台版已具备）。

开发节点实际执行时用的是平台注入版本（能力为超集），故不构成阻塞；建议后续把平台版
回灌 `std-skills/`，并把 `docs/skills/godot-game-dev/scripts/` 三脚本镜像一并刷新（同步契约
见该目录 `README.md`：改原件后 `cp -p` 覆盖镜像）。

另：`std-skills/godot-game-dev/SKILL.md` 资产表中 preflight 自测用例数原写「19 例」，
与实测 24 例不符，本次已一并修正，并补登 `repo-preflight.sh` 条目。

## 复跑口径

```bash
# 快检（秒级）：仓库可达 / 脚本齐备 / 镜像一致 / 工具链 / preflight 自测
bash std-skills/godot-game-dev/scripts/repo-preflight.sh
# 全量（约 2-3 分钟）：追加 smoke + gate-selftest + 移动端自检的运行期验证
bash std-skills/godot-game-dev/scripts/repo-preflight.sh --full
```

退出码：`0` = 可进入开发节点；`1` = blocked（逐项打印 `REPO-PREFLIGHT: BLOCKED <原因>`）。
