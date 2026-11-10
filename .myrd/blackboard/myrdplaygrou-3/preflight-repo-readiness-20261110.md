# 勘验报告：仓库门禁脚本与 apphost 构建前置就绪（myrdplaygrou-3《实况足球》）

- 勘验时点：2026-11-10，分支 `myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h` @ 02fce02（勘验基线 commit）
- 任务：「核对 std-skills/threejs-game-dev/scripts 五个判定脚本与 games 目录就绪，缺失即上报不空烧」
- 工作流：Three.js 小游戏工坊流水线（workflow cmwaqvro1002pm9m2pr6vi3zp / run cmwar74im003km9m2cwb92xkq）

## 结论一览

| # | 勘验项 | 勘验前 | 现状 | 处置 |
|---|---|---|---|---|
| 1 | `std-skills/threejs-game-dev/scripts/` 五判定脚本 | **缺失**（整目录不存在，git 全历史从未入库） | **已就绪**（字节一致平移 6 件 + 实跑验证全绿） | 本节点已补齐 |
| 2 | `games/myrdplaygrou-3/` 游戏工程目录 | 不存在 | 仍不存在（属 scaffold 节点职责） | 不抢做；scaffold 输入（模板骨架）已验完整 |
| 3 | apphost 构建前置（myrdplaygrou-3 apphost.toml） | 不存在 | 仍不存在（随游戏目录而生，属 deploy 节点职责） | 已给出 wheat-squad 判例落位方案 |
| 4 | 工作流 run 运行态 | — | **paused**（服务重启中断） | 需编排侧恢复，本节点不可续 |

## ① 五个判定脚本 —— 原缺失，本节点已补齐并实证

**勘验依据**：SKILL.md §9「判定器只认**仓库内** `std-skills/threejs-game-dev/scripts/` 副本」（`.myrd-platform/.claude/skills/threejs-game-dev/SKILL.md:216`）；先例：game-9 轮 scaffold 节点曾因门禁脚本缺位走 blocked 上报（`.myrd/blocked-report.md`，2026-10-06），godot 同族脚本后已入库（`std-skills/godot-game-dev/scripts/` 13 件，routines.yaml:38-51 按仓库内路径引用）。

**勘验前实况**：`std-skills/` 下仅 experience-harness / experience-review / godot-game-dev / web-app-dev 四技能；`git log --all -- std-skills/threejs-game-dev` 为空（任何分支历史均无）。判定脚本唯一存身之处是平台技能目录 `.myrd-platform/.claude/skills/threejs-game-dev/scripts/`。

**已执行修复**：字节一致平移 6 件（5 判定脚本 + lib-png.mjs PNG/pHash 库件；脚本仅互相依赖 `./lib-png.mjs`，无目录外相对路径依赖，schemas/ 无需连带）。

**回读与机械校验证据**（CLAUDE.md 落盘红线）：

| 文件 | 字节 | cmp vs 平台源 | node --check | 功能实跑 |
|---|---|---|---|---|
| preflight.mjs | 7671 | BYTE-IDENTICAL | OK | **实跑模板 minimal-3d：P1-P8 共 21 项全 PASS，PREFLIGHT: PASS（0 WARN），EXIT=0** |
| browser-smoke.mjs | 12234 | BYTE-IDENTICAL | OK | 无用法打印、按位置参数解析（见下调用纪律） |
| asset-triple-check.mjs | 25600 | BYTE-IDENTICAL | OK | `--help` 输出用法行正常 |
| playtest-summary.mjs | 14275 | BYTE-IDENTICAL | OK | `--help` 输出用法行正常 |
| visual-ratchet.mjs | 9927 | BYTE-IDENTICAL | OK | `--help` 输出用法行正常 |
| lib-png.mjs | 10407 | BYTE-IDENTICAL | OK | （库件，随上三者 import 链加载验证） |

**下游调用纪律**：`browser-smoke.mjs` 不设 `--help` 短路，裸跑会直接进入 Chrome 探测流程——必须按签名带参调用：`node std-skills/threejs-game-dev/scripts/browser-smoke.mjs <工程目录> [--seconds 62] [--chrome <path>]`；其余四件均为 flag 式参数（`--game` 必填）。

## ② games 目录 —— myrdplaygrou-3 未建，scaffold 输入已验完整

`games/` 现有 4 工程（game、game-9、myrdplaygrou、wheat-squad）全部为 Godot（project.godot）或 wheat ts-canvas 线，**无任何 three.js 工程**；`games/myrdplaygrou-3/` 不存在。

scaffold 节点的输入已验完整：模板 `templates/minimal-3d/` 文件齐备（src/ kernel+render+levels+main+numeric、tools/ build+src-sha+verify-reproducible、tests/ run-all+单文件契约+内核确定性+状态机、index.template.html、package-lock.json），且上表 preflight 实跑 21 项全 PASS 即对该模板本体做出。

**处置**：按 SKILL.md §1 由 scaffold 节点 `cp -R` 模板起步后 `npm install`，本节点不抢建半成品工程。

## ③ apphost 构建前置 —— 判例明确，落位归 deploy 节点

- 仓库根 `apphost.toml` 是旧游戏 myrdplaygrou 的（assets_dir=`games/myrdplaygrou/export/web`），**勿动**。
- 判例（wheat-squad，`games/wheat-squad/apphost.toml`）：游戏目录内专属清单 + manifestPath 指向它，`assets_dir=games/wheat-squad/build`，注释明言「勿改仓库根 apphost.toml」。
- myrdplaygrou-3 落位方案（deploy 节点执行）：新建 `games/myrdplaygrou-3/apphost.toml`，`name="myrdplaygrou-3（实况足球）"`、`runtime="node20"`、`health="/health"`、`assets_dir` 指向单文件产物所在目录（threejs 路线产物为构建输出的 `index.html`），`manifestPath=games/myrdplaygrou-3/apphost.toml`。
- 平台 AppHost `cmwaqvrnc002jm9m2nqwfsoie`：`GET /api/v1/apphosts/<id>`、`/api/v1/app-creation/apphosts/<id>`、`/api/v1/app-hosts/<id>` 均 NOT_FOUND——**API 路径未命中，不能据此断言 AppHost 不存在**（DAG 上下文与 run contextSnapshot 均以其为既定目标）；非阻塞项。

## ④ 工作流运行态 —— run 处于 paused

`GET /api/v1/workflows/runs/cmwar74im003km9m2cwb92xkq` → `status=paused`，`startedAt=2026-11-10T13:56:28.701Z`，`completedAt=null`。服务重启中断所致，恢复属编排侧职责，本节点不代行。

## 对下游的直接指引

1. scaffold/implement 节点现在可以直接引用仓库内副本跑三层门禁（preflight / run-all / browser-smoke）与工坊判定（asset-triple-check / playtest-summary / visual-ratchet），无需再走平台技能目录相对路径。
2. 门禁不过时按 `references/error-signatures.md` 签名修；视觉/资产/shader 变更必跑 browser-smoke（SKILL.md §7 触发纪律）。
3. deploy 节点按 ③ 的 wheat 判例落 apphost.toml，manifestPath 指向游戏目录内清单，不改仓库根清单。
