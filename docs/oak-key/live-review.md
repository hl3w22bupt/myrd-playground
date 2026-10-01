# oak-key 线上终态复核报告（liveUrl 可访问可玩 + 三项标识核对）

- 复核时间：2026-10-02（独立复核节点，不复用 deploy 节点自测结论）
- 复核人：目标 DAG「复核线上终态并回写 artifacts」子 agent
- 复核对象：HostedApp `cmupsflsj001sm9dhxt6w1oal` 当前线上部署
- 结论：**三项全部核对一致，liveUrl 公网可访问且可玩，取证标记实测产出**（对应验收标准 5 / 7）

---

## 三项标识（回写 artifacts 的核心三元组）

| 项 | 值 | 核对方式 |
| --- | --- | --- |
| **liveUrl** | `https://leomac-studio.tail49399e.ts.net/apps/oak-key/` | GET 实测 308→200；与 HostedApp 记录 `liveUrl` 字段一致 |
| **HostedApp id** | `cmupsflsj001sm9dhxt6w1oal` | GET /api/v1/apphost/apps/:id 实查：slug=oak-key、status=ready、projectId=cmupsflsc001om9dhnv8ad9xg、sourceId（goal）=cmupsfn0q001um9dhlko9t5e0 |
| **deployment id** | `cmupvkkzf0073m9dhxg4qslrr` | 与 `app.currentDeploymentId` 逐字一致；status=running（v2）；v1 `cmupvjs4d006zm9dhsaheq66g` 同 commit superseded |

部署元数据：commit `a1c978c`（`feat(oak-key): AppHost 壳接入 + Web 导出产物`）、gitRef `myrd/games-goal-cmupsfn0q001um9dhlko9t5e0`、mode=bundle、deployedBy=workflow、triggeredById=goal id。

## ① 公网可访问（HTTP 层）

| 探测 | 结果 |
| --- | --- |
| `GET /apps/oak-key/` | 308 → 200，壳页 11152 B，含调参桥 `__GAME_TUNING__` 与音频手势解锁器 `__audioDebug` 源码标记 |
| `GET /apps/oak-key/health` | 200 `{"ok":true,"app":"oak-key","probe":"forensic","env":"development","assets":"lazy/object-storage"}` |
| `api/public/assets/index.js` | 200，331,495 B |
| `api/public/assets/index.wasm.gz.b64` | 200，10,696,408 B → b64 解码 + gunzip = 35,376,909 B，magic `\0asm` ✅ |
| `api/public/assets/index.pck.gz.b64` | 200，3,339,964 B → gunzip = 2,521,776 B，magic `GDPC` ✅ |
| `api/public/assets/index.audio.worklet.js` | 200，7,298 B |

资源 404 数：**0**。资产通道（对象存储懒加载 + b64 文本回传）全链路可用。

## ② 可玩性（真实浏览器无头实测）

工具：Playwright + Chromium（SwiftShader 软件渲染 WebGL2），从公网 liveUrl 加载。

- 引擎真实启动：`Godot Engine v4.3.stable.official.77dcf97d8`，`OpenGL ES 3.0 (WebGL 2.0)` 初始化，canvas 按窗口重设为 900x700。
- HUD 实时运行：波次（第 1/3 → 2/3 波）、剩余时间倒计时、信度 ●●●、分数、玩家实时坐标（如「坐标 600,12」）。
- 输入响应闭环：R 重开、方向键移动、空格探测均有界面反馈，无卡死。
- **取证标记实测产出**（浏览器 console，逐字）：
  - `OAK_KEY_PROBE oak_key_probe=valid probe_count=1 wave=1/3 fragments=3/3 decoy=false credibility=3 key=oak-OA-K7-42 reason=校验通过`
  - `OAK_KEY_PROBE oak_key_probe=invalid probe_count=2 wave=1/3 fragments=0/3 decoy=false credibility=3 key=oak-??-??-?? reason=片段不足（0/3）`
- 界面反馈（截图 05）：「第 1 波探测：key 有效 ✓ +100 分（含时间奖励）· 组装 oak-OA-K7-42（进入第 2 波 · 片段重新布点）」。
- console error / page error：**0**；请求失败：**0**。

证据截图（本目录）：01 引擎启动 / 02 开局 / 03 R 重开 / 04 移动后 / 05 探测有效反馈 / 06 收尾。

## ③ 一致性核对（仓库侧）

- 部署 commit `a1c978c` 在本地仓库可解析，且是 gitRef 分支远端 HEAD（`677edd8`，仅多一条 docs 提交）的**祖先**——线上跑的就是已推仓库的代码。
- `apphost.toml` @ `a1c978c`：`name = "oak-key"`、`assets_dir = "games/oak-key/export/web"`、health=`/health` —— 与线上实际行为（/apps/oak-key、/health、资产懒加载）一致。
- 壳页由 `server/src/game-page.ts` 生成：`?tuning=<JSON>` 在引擎加载前写入 `window.__GAME_TUNING__`（无参数时该全局为 undefined 属**预期行为**，非缺陷）；`__audioDebug` 音频手势解锁器已安装（实例实测为 function）。
- 工程合规：`games/oak-key/project.godot` @ `a1c978c` 声明 `config/features=PackedStringArray("4.3")`、`run/main_scene="res://scenes/main.tscn"`，config/description 带取证探针标记。

## 已知差异（不阻塞，如实记录）

1. **本工作区分支的 `apphost.toml` 是旧模板**（`name = "candy-crush-legend"` / `assets_dir = "games/game/export/web"`）：本工作区落在 scaffold 分支 `myrd/oak-key-goal-cmupsfn0q001um9dhlko9t5e0`，未包含 implement 节点在 `myrd/games-goal-cmupsfn0q001um9dhlko9t5e0` 上的 oak-key 提交。线上部署读的是后者，不受影响；但若有人从这个分支重新发起部署会打到旧工程——建议后续把 oak-key 分支的改动合回，保持单一事实源。
2. 无头浏览器缺真实 GPU/音频输出，音效与真机触屏手势未在本轮覆盖（真机验收仍按验收标准 6 归外部依赖，挂起等主人）。

## 验收对照

- 验收 5「liveUrl 可访问、/health 200、浏览器完成一次完整校验」：**达成**（本轮以真实浏览器完成拾取→组装→探测→「key 有效 ✓」反馈闭环）。
- 验收 7「目标 artifacts 可见 HostedApp id、deployment id、liveUrl」：**达成**（本轮已独立复核并以 `deployment_review` 产物回写，详见目标卡片）。
