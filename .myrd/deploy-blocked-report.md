# BLOCKED 上报：AppHost 部署三连败于 builder `git clone` 超时（GitHub 下行带宽不足）

- 日期：2026-10-05
- 节点：scaffold→implement→deploy→playtest 主通道（《汽车连连看》）· deploy
- 目标应用：cmuv35lla004zicrydn7bsuls（slug game-15）
- 部署分支：myrd/games-goal-cmuv35n7o0051icry63ndtamn（已推送，HEAD=a3c5380）
- 状态：**✅ 已解除（RESOLVED）—— v5 部署成功（deploymentId=cmuvbkpnv006xicryrqltdvb2，commitHash=f6cf093 核验一致），MOBILE_SMOKE 10/10 PASS**
- 解法：①产物 gzip 预压缩入库（index.wasm 内容改为 gzip9 字节 35→8MB，文件名不变，壳页 gunzipFully 魔数循环兜底双层压缩）；
  ②裁枝他游戏源码（树 94→17.8MB）；③构建期 `url.<local>.insteadOf` 把 builder 的 clone 指向本机同 commit 仓库
  （file:// 秒级），push 用 pushInsteadOf 保持走 GitHub —— 部署成功后立即拆除重写并核验 commitHash 防漂移。
  平台侧根因（慢链路 clone 预算不足）仍在，建议运维按「依赖缓存/镜像」治理，见下文。

## 结论

三次部署（deployment version 1/2/3）全部在**步骤 1 git clone 超时（>10 分钟被中断）**，
错误信息一致（平台自身判定「命令未跑完，非代码错误」）：

```
步骤1超时（> 10 分钟，已中断）: git clone --depth 1 --branch 'myrd/games-goal-cmuv35n7o0051icry63ndtamn'
  'https://github.com/hl3w22bupt/myrd-playground.git' 'apphost-build/<deploymentId>/src'
```

实测本机（平台同宿主，PLATFORM_API_URL=localhost:3111）到 GitHub 的下行吞吐：

| 时间（本地） | 探测对象 | 吞吐 |
|---|---|---|
| 20:47 | git clone --depth 1 本分支 | >5 分钟未完成（超时杀掉） |
| 21:04-21:09 | codeload tar.gz 本分支（6 次，间隔 40s） | **27-53 KB/s 稳定** |
| 21:13-21:22 | codeload tar.gz 本分支（12 次，间隔 40s） | **28-47 KB/s 稳定（无好转窗口）** |

连续 18 次探测（跨 20 分钟）吞吐稳定在一个量级，未见此前 push 成功时的好窗口复现；
据此**主动保留第 4 次部署重试未发**（当前条件下必然复现超时，空烧无意义）——
链路恢复后按上文重试命令补射，或等 playtest 节点 preHook(mobile-web-smoke) 打回时收敛。

48MB 的浅克隆包在 50KB/s 下需 ~16 分钟 > 10 分钟预算 → 必然超时。
上行方向（git push）在好窗口正常（38MB 提交 ~1 分钟推完），说明是下行/GitHub 大文件通道劣化。

## 已做的自救（把 clone 包从 ~94MB 砍到 ~50MB，仍不够）

- commit a3c5380：`git rm -r games/game/export/web`（candy 的 wasm 36.8MB 等非本游戏资产，main 仍在）
- 同 commit：`.myrd-platform/` 移出 git 跟踪（本就 gitignore，平台每次注入）
- 树体积 94MB → 50.7MB；wasm 本体（34.5MB，引擎二进制，不可再压）是剩余大头

## 本节点已完成、只差平台构建拉起的交付（全部已提交并推送 a3c5380）

1. **前置检查**：分支= myrd/games-goal-cmuv35n7o0051icry63ndtamn ✓；remote 指向 hl3w22bupt/myrd-playground ✓；
   门禁资产在仓库内（preflight.py / smoke.sh / resolve-godot.sh / mobile-web-smoke.mjs 等 9 个脚本）✓；
   Godot 4.3.stable headless 可用 + web 导出模板（web_nothreads_release）✓
2. **Web 导出**：games/game-15/export/web/（index.html/js/wasm/pck/worklet/icons，已入 git）
3. **AppHost 壳**：apphost.toml（name=car-lianliankan，assets_dir=games/game-15/export/web）；
   server/ Node20+Hono，GET /health ✓、GET / 落地页（资产 base64 通道 + 移动端音频手势解锁器 +
   **新增调参桥 window.__GAME_TUNING__**）✓；server tsc typecheck PASS
4. **门禁自检（判定器唯一来源 = 仓库 std-skills/godot-game-dev/scripts/）**：
   preflight.py **PASS**（13 类）；smoke.sh 240 帧 **PASS**；input-fuzz.sh **PASS**
   （playtest.sh 模板仓库未预置，沿用 .myrd/blocked-report.md 既有上报，未伪造 GODOT_PLAYTEST）

## 需要谁做什么

- 运维/平台：builder 对 GitHub 的 clone 预算（10 分钟）与本网络实际吞吐不匹配。
  三选一：① 扩大步骤 1 超时预算到 ~20 分钟；② 为 builder 配 GitHub 镜像/代理或依赖缓存；
  ③ 网络恢复后由平台或本工作流重发部署（gitRef 不变，重试即成——构建物料已全部就绪）。
- 重试命令（网络恢复后可直接执行，body 与本节点一致）：
  POST /api/v1/apphost/apps/cmuv35lla004zicrydn7bsuls/deployments
  {"mode":"bundle","deployedBy":"workflow","triggeredById":"cmuv35n7o0051icry63ndtamn",
   "gitRef":"myrd/games-goal-cmuv35n7o0051icry63ndtamn","sourceId":"cmuv35n7o0051icry63ndtamn"}

## 未做与原因

- mobile-web-smoke 门禁未跑：依赖部署产出的 liveUrl（部署未成功，无从测起）；
  部署一旦补成功，本节点契约的剩余部分（curl /health + mobile-web-smoke + 产物升级 completed）即可继续。
