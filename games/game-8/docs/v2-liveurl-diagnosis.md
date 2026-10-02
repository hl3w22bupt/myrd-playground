# game-8《牛牛打游戏》v2 线上链路诊断报告（liveUrl 端到端实测）

> **诊断轮次**：v2 手感调优上线后首轮端到端链路诊断（目标 `cmujpml1e006rm99i9hc33huu`）。
> **验收依据**：需求《牛牛打游戏 game-8 · v2 手感调优：牛牛体型放大、移动速度下调》（`cmuqmej89000ym9gg6mom93o0`）。
> **规范基准**：《Godot Web 导出与 godot-smoke 门禁实战经验》v5/v6（doc `189a580e-5cdb-4837-a5fa-38e0c12ceb88`）。
> **诊断时间**：2026-10-02（部署 v5 完成于 07:59:41Z 后）。
> **结论先行**：✅ v2 已在线上生效且量化达标——部署产物自跑门禁断言全绿（含 v2 手感基线机判），
> 线上资产与仓库导出产物逐字节一致，无需修复、无需回滚。

## 一、部署元数据（平台实测）

| 项 | 值 |
|---|---|
| HostedApp id | `cmujpmjsy006pm99ip9yws3wl`（slug `game-8`，name 牛牛打游戏，sourceType=workshop，sourceId=goalId） |
| 当前部署 id | `cmuqny37h001ficf0mpmr71mv`（**version 5，status=running**，currentDeploymentId） |
| 部署 gitRef | `myrd/games-goal-cmujpml1e006rm99i9hc33huu`（未落 main ✓） |
| 部署 commit | `1089e4b`（v2 产物重导出：PLAYER_SCALE=1.4 / PLAYER_SPEED=145；其上仅 1 个 docs 提交 `93c0e3f`，代码零差异） |
| liveUrl | `https://leomac-studio.tail49399e.ts.net/apps/game-8/` |
| 部署史 | v4=`cmuqnx9v6001dicf0fmfryxcz`（superseded，同 commit）；v5 为重试冗余但无害，当前实际服务方 |
| runtime | sandbox；路由面：GET /health（static）、GET /（static）、GET /api/public/assets/:name（public） |

## 二、公网链路实测（curl 一手取证）

| 探测 | 结果 | 判定 |
|---|---|---|
| `GET /apps/game-8/health` | HTTP 200，`{"ok":true,"app":"game-8","game":"牛牛打游戏","env":"development","assets":"lazy/object-storage"}` | ✅ 壳健康，资产=对象存储懒加载模式 |
| `GET /apps/game-8/` | HTTP 308 → `/apps/game-8`（规范化跳转）→ 200 | ✅ |
| `GET /apps/game-8/gw/health` | HTTP 200（网关子路径同源） | ✅ 网关透传正常 |
| 壳页 HTML（11,626B） | `<title>牛牛打游戏</title>`；含 `__GAME_TUNING__`（调参桥 ×2 处）、`__audioDebug`（音频手势解锁器）；资产请求全部走相对路径 `fetch(BASE_PATH + 'api/public/assets/' + name)` | ✅ 调参桥/音频解锁器/相对路径三契约在位 |
| `GET /api/public/assets/index.js` | 200（raw） | ✅ |
| `GET /api/public/assets/index.pck` | 200，base64 文本 3,333,340B → 解码 gzip → 2,513,040B | ✅ 文本通道（网关 M1 安全，无二进制响应） |
| `GET /api/public/assets/index.wasm` | 200，base64 文本 **10,696,408B**（与知识文档 v6 一手实测值完全一致）→ 解码 35,376,909B | ✅ |

## 三、仓库 ↔ 部署产物一致性（逐字节实锤）

本地导出产物（部署分支工作树 = 部署 commit `1089e4b` 导出，工作区 `run-cmuqmf3ov0015m9ggu6mxso3g`）
与线上对象存储拉回解码后的资产 **sha256 完全一致**：

| 资产 | 字节数 | sha256（本地 = 线上） |
|---|---|---|
| index.pck | 2,513,040 | `5f556ad9adf47579cb38a1fd8f7549e33b478b56cd4b3b5f112346281d699e25` |
| index.wasm | 35,376,909 | `fe5cebc590758c10bc4469be5a591e28edbde5ec8f458f21baeb83db50d028b9` |

结论：**线上伺服的就是仓库部署 commit 导出的产物，无版本漂移**。

## 四、v2 手感量化标准核验（需求 cmuqmej89000ym9gg6mom93o0）

### 4.1 数值区声明键（games/game-8/autoload/game_state.gd，commit `3a39635` diff 实录）

| 键 | v1 → v2 | 需求区间 | TUNING_META 钳制 | 判定 |
|---|---|---|---|---|
| `PLAYER_SCALE` | 1.0 → **1.4** | 1.3~1.5× 整体放大 | min 0.5 / max 2.0 / step 0.05 | ✅ 在区间内，v1 可回滚 |
| `PLAYER_SPEED` | 220 → **145** px/s（=65.9%） | v1 的 60~70% | min 60 / max 300 / step 5 | ✅ 在区间内，v1 可回滚 |

接线：`player.gd` 把 `PLAYER_SCALE` 以 uniform scale 应用到根节点，同步作用于精灵、CollisionShape2D、PickupArea 判定体（v2 拾取判定半径 22×1.4≈30.8px）；`velocity = direction * GameState.PLAYER_SPEED` 每物理帧读声明键。

### 4.2 部署产物自跑门禁断言（最高等级证据）

**用线上对象存储拉回的 index.pck 直接运行冒烟场景**：
`godot --headless --main-pack <线上pck> --quit-after 240 res://tests/smoke.tscn`
→ 退出码 0、零 SCRIPT ERROR、`GODOT_SMOKE: PASS`，签名全文：
「场景实例化/输入映射/移动方向符号(A/←减小,D/→增大)/收集判定/50 连击一致性/难度梯度/过期回收/胜负/一键重开/持久化/**v2手感基线(体型1.3~1.5x·移速60~70%)** 全部通过」

v2 断言为真实机判（smoke.gd L423-435，含 FAIL 路径）：
- `PLAYER_SCALE ∉ [1.3, 1.5]` → FAIL 签名「体型倍率 %.2f 不在区间」；
- `PLAYER_SPEED ∉ [132.0, 154.0]`（=220×0.6~0.7）→ FAIL 签名「移速不在 60%~70% 区间」；
- 另断言倍率真实接线到 Player 根节点 / CollisionShape2D / PickupArea/PickupShape 三节点。

⇒ **「牛牛变大变慢」在部署产物本身上量化达标**（1.4 ∈ [1.3,1.5]；145 ∈ [132,154]），非代码推断，是产物运行期实测。

## 五、门禁与导出证据链（本轮复跑，全部本地一手）

| 门禁步 | 命令 | 结果 |
|---|---|---|
| resolve-godot | `bash std-skills/godot-game-dev/scripts/resolve-godot.sh` | exit 0，Godot **4.3.stable.official.77dcf97d8** |
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-8` | **PREFLIGHT: PASS**（13 类前置一致性检查、40 个工程文件，exit 0） |
| smoke | `GODOT_SMOKE_FRAMES=240 … smoke.sh games/game-8` | **GODOT_SMOKE: PASS**（exit 0，SCRIPT ERROR 计数=0，240 帧预算） |
| input-fuzz | `… input-fuzz.sh games/game-8` | **GODOT_FUZZ: PASS**（seed=20260913，6 批次 239 帧，exit 0） |
| playtest | `… playtest.sh` | **脚本缺失**（模板仓库未预置，D2 依赖 / bug `cmuktchmy000km97z6kj3r2ro` Bug1，维持 blocked，不代写） |

判定脚本唯一来源 = 仓库内 `std-skills/godot-game-dev/scripts/`（preflight.py / smoke.sh / input-fuzz.sh / resolve-godot.sh 在位），未自造、未改写。

## 六、结论与遗留

**结论**：
1. 线上链路（公网入口 → 网关子路径 → 壳页 → 对象存储懒加载资产）端到端可用；
2. 线上版本 = v2（部署产物自证），牛牛体型 1.4×、移速 145px/s 均落在需求量化区间；
3. 玩法契约零回退：方向符号、50 连击判定一致性、难度梯度、过期回收、胜负四分支、一键重开、持久化断言全绿；
4. 数值可回滚：两键均为 TUNING_META 声明键，可经游戏内调参面板或壳页 `?tuning=` URL 调回 v1（1.0 / 220）。

**遗留（不阻塞本轮，责任方与恢复条件见知识文档 `943eb5eb-0949-43fe-b939-83cf171af2a3`）**：
- D1 iOS Safari 真机实测（责任方：用户/环境）；
- D2 playtest.sh 模板资产（责任方：运维，playtest 节点维持 blocked）；
- D3 用户试玩结论与调参 URL 回填（入口 `…/apps/game-8?tuning=1` 已可用）。

**本轮环境备注**：诊断沙箱对 github.com:443 直连超时（`Recv failure`），报告经 `ssh.github.com:443` 通道推送（结果见该分支提交记录）；本报告落盘于部署分支 `myrd/games-goal-cmujpml1e006rm99i9hc33huu`（docs-only，不影响部署产物字节）。
