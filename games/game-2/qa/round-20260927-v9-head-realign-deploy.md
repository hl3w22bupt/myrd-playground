# round-20260927 · v9 重部署：线上对齐 game-2 分支 HEAD（含 2c95a68 调参契约）

## 结论（TL;DR）
- **线上是否=HEAD：是**。线上 v9 `deploymentId=cmuiojtp90044m9l63vodcu4t`，commitHash=`54b9205`（= `myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta` HEAD），包含 `2c95a68`（TuningPanel 调参契约 + 真机验收物料）。
- 线上 `index.pck` 经 `/api/public/assets/index.pck` 下载、base64 解码、gunzip 后 **sha256=`4434bed1…629f454`，与本地 HEAD 导出产物逐字节一致（2524400B）**。
- 真机实测（iOS Safari 操作与音效验收）的版本前置就绪。

## 父 run（cmuik9hm1008hm9gcba902oh7 / startNodeId=deploy）产出核实
- v8 `cmuio5u90003om9l6baasdij9`（当时 current，commit `a3a5d2f`，gitRef=`myrd/games-goal-cmuiepudc001zm9gyyzqgztta`）：
  - `git merge-base --is-ancestor 2c95a68 a3a5d2f` → **NO**，线上不含 2c95a68。
  - `2c95a68`（tuning_panel.gd + smoke 调参断言 + qa 物料）只存在于 `myrd/game-2-goal-…` 分支，部署分支上没有。
  - v8 壳页（game-page.ts @a3a5d2f）已含调参桥双形态与音频解锁器，但游戏侧 pck 无 TuningPanel。
- 判据「线上已包含 2c95a68」不成立 → 走「从 game-2 分支 HEAD 重导出 + 重部署」。

## 执行路径
1. **合并**：`git merge` 部署分支 `57869b2` 进 game-2 分支（唯一冲突 `server/src/game-page.ts`，取部署分支版——它是功能超集：`?tuning=<json>` 契约形态 + `?tuning=1&key=value` 面板扁平回填形态双支持）。合并后 HEAD `61f7fa0` 同时具备壳页双形态调参桥 + `GameConfig.apply_tuning_bridge`（games 侧新增 62 行，消费 `window.__GAME_TUNING__`，仅 Web）+ `TuningPanel.parse_tuning_query`（game-2 侧 2c95a68）双消费端。
2. **导出**：`godot --headless --export-release Web export/web/index.html` 退出码 0；`index.pck` 2521520B → 2524400B（+2880B = TuningPanel/验收物料）；`script_export_mode=2`（脚本压缩 token 化，pck 内明文 grep 不适用，以冒烟断言为准）。
3. **门禁**（仓库内 `std-skills/godot-game-dev/scripts/` 判定）：
   - `PREFLIGHT: PASS`（13 类 / 56 文件）
   - `GODOT_SMOKE: PASS`（240 帧，退出码 0，含 2c95a68 新增调参桥断言）
   - 注：`playtest.sh` 模板仓库仍未预置（已另行建 Bug 上报），本节点不依赖。
4. **部署**：bundle 模式 `POST /api/v1/apphost/apps/cmuiepuda001xm9gyecrisk7n/deployments`，`gitRef=myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta`（沿用既有成功路径，绕开 HTTP 422 的 deploy_playable 节点接口）。构建 829ms，状态语义：`running`=服务中（非构建中）。
5. **回写**：goal artifacts 16 → 17 条（新增 hosted_app 条目，见标题）。

## 线上冒烟（v9）
| 检查 | 结果 |
| --- | --- |
| `GET /health` | 200 `{"ok":true,"app":"star-dust-collector","assets":"lazy/object-storage"}` |
| `GET /`（跟随 308 规范化重定向） | 200，壳页 12375B：AudioContext 手势解锁器 ×13、调参桥 ×3 |
| `GET /?tuning=1&invincibility_seconds=2.5` | 200，扁平形态解析生效（`flat[]` 数值化 → `window.__GAME_TUNING__`，游戏侧 TUNING_META 白名单钳制） |
| `GET /api/public/assets/index.pck` | 200 `text/plain`（base64，M1 网关文本透传契约符合） |

## 备注
- 部署分支 `myrd/games-goal-cmuiepudc001zm9gyyzqgztta`（57869b2）本轮未再推送；v9 起部署来源切换为 game-2 分支，内容为两分支超集，无功能回退（game-page.ts 取的就是部署分支版）。
- 后续节点继续在 `myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta` 上开发；若再次部署，直接用该分支 HEAD 即可。
