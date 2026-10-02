# 试玩验收节点 blocked 上报 —— 目标 artifacts 回写通道 403（2026-10-02）

> 节点：工坊第四步「试玩验收」（goal `cmuieq51k002cm9gysxbyppv7` · 项目 `cmuieq51c0026m9gyynwo0sww`）。
> 结论：**status = blocked（仅限产物回写通道）**。liveUrl 已实测可达、试玩验收包已按纪律落库
> （`qa/playtest-kit.md`），但 **goal artifacts 的读与写、spec 修订写入均被平台授权层拦截**，
> 本节点无法把 `op=playtest_kit` 产物写进目标卡片。本次 403 与 2026-10-02 发布节点的
> `qa/deploy-blocked-report-2026-10-02.md` 同根因，截至本轮仍未修复。

## 一、blocked 范围（精确到步）

| 本节点步骤 | 状态 | 说明 |
|---|---|---|
| ① 前置取 liveUrl | ⚠️ 绕行完成 | goal artifacts 读不了（403），但 liveUrl 经网关实测可达（见 §三），未编造地址 |
| ② 产出试玩验收包 | ✅ 落库交付 | `qa/playtest-kit.md`（含 §〇 2026-10-02 复核）；**API 回写 artifacts 失败** |
| ③ 试玩结果回写 spec | ⏸ 跳过 | 未收到用户四问结论 + 调参 URL，依纪律本就不得执行；且写通道同样 403 |
| ④ git 提交推送 | ✅ | 本报告 + 验收包复核段 |

## 二、阻塞证据（本轮实测，含 requestId）

token 实际身份（`auth/me` + JWT claims 解码）：
`userId=cmt428ptv004bm9seap9ankcc`（目标大师 master-goal@myrd.internal），
`role=developer`，claims 含 `via=workflow-node`、**不含 `actFor`**。

| 探针 | 响应 | requestId |
|---|---|---|
| `GET /api/v1/goals/cmuieq51k002cm9gysxbyppv7` | 403 `无权访问` | req_1790900408734 |
| `GET /api/v1/goals` | 200 但 `{"goals":[]}`（目标不可见） | — |
| `GET /api/v1/projects/cmuieq51c0026m9gyynwo0sww` | 403 `您不是该项目的成员` | req_1790900434037 |
| `GET /api/v1/apphost/apps/cmuieq51i002am9gyfxqx06rl` | 403 `仅应用所有者或系统管理员可操作` | req_1790900434053 |
| `GET /api/v1/apphost/apps/cmuieq51i002am9gyfxqx06rl/deployments` | 403 同上 | req_1790900462105 |
| `PATCH /api/v1/goals/cmuieq51k002cm9gysxbyppv7`（鉴权探针，body 不含合法字段） | 403 `无权操作` | req_1790900462124 |
| `GET /api/v1/game-design-specs/approved?goalId=…` | **200**（读路径仅 requireAuth） | — |
| `POST /api/v1/game-design-specs/:id/revisions` | 写路径需项目成员（见 §四）→ 403 预期 | 未实际提交（无用户结果） |

## 三、liveUrl 是实测所得（非编造）

- `GET /apps/game-3`（网关）与 `GET https://leomac-studio.tail49399e.ts.net/apps/game-3/` 均 **200**，
  页面标题「疾风忍者跑」。
- 壳契约标记实测在位：`__GAME_TUNING__`（调参桥）、`?tuning=1`（滑杆工作台）、`__audioDebug`、
  `AudioContext` 手势解锁器、`/api/public/assets/` 相对路径。
- 线上资产指纹：`…/api/public/assets/index.pck`（base64+gzip）解码 2,557,728 B，
  sha256 `df780d9c…` = 分支 `9ca5740` 的导出 —— 即 2026-09-27 那次部署（本分支在此之后的
  `ce34959` 音效补齐、`c2dea78` MIME 加固+重导**尚未上线**）。

## 四、根因（平台源码定位，供运维/平台修复）

1. `routes/goals.ts`：所有 goal 读写路由的判据是
   `goal.userId !== effectiveAuthUserId(user) && user.role !== 'admin'` → 403。
   目标属主是创建目标的用户，本节点身份既非属主也非 admin。
2. `auth.ts`：目标编排 agent 的 token **设计上应带 `actFor=<目标属主>`**（「授权按 owner 计算」，
   注释里引 2026-09-26 实证）；而本节点 token 由 engine 以 `via=workflow-node` 签发且**无 `actFor`**
   → `effectiveAuthUserId` 回落为 token 自身 userId → 与 `goal.userId` 不匹配。
3. `routes/game-design-specs.ts`：写路径 `assertProjectWritable` →
   `assertProjectMember(projectId, user, Developer)`；本节点不是项目成员 → spec 修订写入同样被拦
   （读路径只 requireAuth，所以 approved spec 能读）。

## 五、修复建议（三选一，需平台/运维侧动手）

1. **engine 侧**：为 workflow-node token 补 `actFor=<goal 属主 userId>`（与 `goals.ts`
   自签的目标大师 token 对齐）；
2. **数据侧**：把工作流节点执行身份加入项目 `cmuieq51c0026m9gyynwo0sww` 成员（role≥developer）；
3. **平台侧**：提供 host 代写通道 —— 节点 agent 在输出里以结构化标记（如 `[CHECKPOINT]` /
   产物 JSON）声明产物，由 host 用其自身权限聚合进 `goal.artifacts`（goals.ts 已有该机制，
   若对工作流节点生效则无需改授权）。

## 六、解除条件与恢复 runbook

- 上述任一修复生效后重跑本节点：
  1. `GET /api/v1/goals/cmuieq51k002cm9gysxbyppv7` 读 artifacts（应能看到 deploy 产物 liveUrl）；
  2. `PATCH` 合并追加 `op=playtest_kit` / `artifactType=playtest_kit` 产物
     （detail = `qa/playtest-kit.md` §〇 之后的内容，量表状态「待用户试玩」）；
  3. 收到用户四问结论 + 调参 URL 后：解析 `?tuning=` JSON → 与 approved spec.numeric 逐键 diff
     （只认 `TUNING_META` 8 键）→ `POST /api/v1/game-design-specs/cmuq5dyjb00b3m9dh7tzdkl7j/revisions`
     （带 `sourceTrajectoryId`）→ `POST …/approve` → 追加 `op=tuning_applied` 产物。

## 七、红线重申

- 不伪造试玩结论：量表四问全部「待回填」，未收到用户结果前不写 spec、不改代码默认值。
- 不自造门禁判定器：本轮五个判定脚本均取自仓库内 `std-skills/godot-game-dev/scripts/`，
  `preflight.py` 实测 PASS；未从注入目录复制、未改写仓库内脚本。

## 八、重入复核（轨迹 `cmuq5tyjy00bjm9dhvqom1i8p`，2026-10-02）

结论不变：**status = blocked（仅限产物回写通道）**，且本轮首次用**真实 playtest_kit 载荷**
（`qa/artifact-playtest-kit.json`）发起 PATCH 取证，而非空体探针。

### 8.1 本轮新证（含 requestId）

| 探针 | 结果 | requestId |
|---|---|---|
| `GET /api/v1/goals/cmuieq51k002cm9gysxbyppv7` | 403 `无权访问` | req_1790901440400 |
| `GET /api/v1/projects/cmuieq51c0026m9gyynwo0sww` | 403 `您不是该项目的成员` | req_1790901440422 |
| `GET /api/v1/apphost/apps/cmuieq51i002am9gyfxqx06rl` | 403 `仅应用所有者或系统管理员可操作` | req_1790901440442 |
| `PATCH /api/v1/goals/…`（**真实 playtest_kit 载荷**） | 403 `无权操作`（鉴权先于写库，零写入） | req_1790905577017 |
| `POST /api/v1/game-design-specs/cmuq5dyjb00b3m9dh7tzdkl7j/revisions`（空体鉴权探针） | 422 schema 校验失败（校验先于鉴权，**未产生修订**） | — |
| `GET /api/v1/game-design-specs/approved?goalId=…` | 200，仍为 **v2 / approved / 同 id** → 探针零副作用 | — |

`GET /api/v1/goals`（列表）200 但 goals 为空 —— 本 token 可见目标集合仍不含该目标。

### 8.2 线上复核（入口健康，构建仍滞后于分支）

- `GET /apps/game-3` 与 `GET /apps/game-3/` 均 **200**（20,235 B），标题「疾风忍者跑」；
  壳契约标记 `__GAME_TUNING__`×7 / `?tuning=1`×4 / `__audioDebug` / `AudioContext` 解锁器 /
  相对路径资产通道全部在位 → 调参工作台入口有效。
- 资产通道实测：`index.pck.gz.b64` 在**外网入口**（tail49399e.ts.net）200 并可解码；
  `localhost:3111` 网关对 `/apps/game-3/api/public/assets/*` 返回 404（网关侧不路由该前缀，
  非应用故障——玩家经外网入口不受影响）。
- 解码指纹：2,557,728 B，sha256 `df780d9c…` = 仍为 **9ca5740** 的导出（2026-09-27 部署）。
  分支上更新的 `ce34959`（音效五件套）与 `c2dea78`（MIME 加固 + 重导 pck `b51cfba1…`
  2,612,016 B）**依旧未上线**；本地 HEAD 工程代码自 b2bc346 起零改动（其后 4 个提交全是 qa 文档）。

### 8.3 门禁资产自检（本轮）

- `std-skills/godot-game-dev/scripts/` 五个判定脚本（preflight.py / smoke.sh / input-fuzz.sh /
  playtest.sh / resolve-godot.sh）+ `references/godot-smoke-routine.md` +
  `.myrd/routines.yaml`（**id=godot-smoke**，playtestFrames=1200）全部在位 → §来源红线不触发 blocked。
- 判定脚本实跑：`preflight.py games/game-3` → **PASS**（13 类，74 工程文件）。

### 8.4 对 §五 修复建议 #3 的实证修正

前轮建议「平台提供 host 代写通道」。本轮核对平台源码：该机制**已实现但只接了目标大师**——
`[CHECKPOINT]` 标记解析在 `services/goal-master-agent`（`routes/goals.ts` 的 executeGoalDag 循环），
且 op 枚举（`CHECKPOINT_CONSTRAINT`）为 `create_requirement | run_workflow | … | revise_design_spec |
deploy_playable | deploy_tool`，**无 `playtest_kit`**。工作流节点 agent 的输出不经该解析器，
照抄输出标记不会被摄取（属表演性行为，未采用）。可用的恢复路径仍只有 §五 的 #1/#2。

### 8.5 本轮增量交付

- `qa/artifact-playtest-kit.json`：**结构完整的 `op=playtest_kit` 产物载荷**（试玩指引 /
  四问量表 / 调参工作台入口与 8 键区间 / 回收协议 / 阻塞证据俱全，量表四问「待回填」）。
  授权修复后，有权限方可直接把它 PATCH 合并进 goal.artifacts，无需重新组织内容。
- `qa/playtest-kit.md` §〇 增补一行本轮复核指针；其余内容不变。
- 试玩结果回写 spec（步骤③）：**未收到用户四问结论 + 调参 URL，按纪律跳过**，量表保持待回填。
