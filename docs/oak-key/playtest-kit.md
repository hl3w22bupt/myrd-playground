# 《探针：验证 oak key 有效性（取证用，不计入三样例）》试玩验收包（playtest kit）

> 产出节点：试玩验收（playtest）｜目标 id：`cmupsfn0q001um9dhlko9t5e0`
> 需求 id：`cmupslvp7002gm9dh42h3maq5`｜策划案：`cmupss3we0039m9dhp8wp0ycd`（v1 / approved）
> 部署：HostedApp `cmupsflsj001sm9dhxt6w1oal`（slug `oak-key`），deployment `cmupvkkzf0073m9dhxg4qslrr`（v2），commit `a1c978c`，gitRef `myrd/games-goal-cmupsfn0q001um9dhlko9t5e0`
>
> **量表状态：待用户试玩。** 本包只交付「怎么玩、看什么、怎么把感受变成数值」；
> 好不好玩的结论只能来自真实试玩的人。在收到回填前，本节点不做任何调参回写
> （不发起 spec revisions / approve，不改代码默认值）。

---

## 0. 入口与就绪核验（本节点实测，2026-10-02）

| 检查 | 结果 |
|---|---|
| 入口 `GET /apps/oak-key`（尾斜杠 308 归一化） | **HTTP 200**，落地页 11152 B |
| `GET /apps/oak-key/health` | **200** `{"ok":true,"app":"oak-key","probe":"forensic"}` |
| 资产通道（懒加载，`api/public/assets/*`） | `index.js` 200 (331 KB) / `index.pck.gz.b64` 200 (3.3 MB) / `index.wasm.gz.b64` 200 (10.7 MB) / `index.audio.worklet.js` 200 —— **无 404** |
| 备用入口 `/apps/oak-key/gw` | HTTP 200（同一落地页） |
| 调参桥（壳页硬契约） | 落地页内含 `__GAME_TUNING__` 解析段 + 音频手势解锁器 `__audioDebug`（代码级核验） |

**入口地址（liveUrl，来自 deploy 产物，非本节点编造）**：
`https://leomac-studio.tail49399e.ts.net/apps/oak-key/`

---

## 1. 试玩指引：怎么玩、看什么

工程内没有 `.myrd/spec/design-spec.json` 导出件，按**实现说明**给指引；术语与判定规则
以 approved 策划案（`cmupss3we0039m9dhp8wp0ycd`）的 meta / numeric / content 段校准。

### 1.1 操作（桌面 / 移动）

| 动作 | 键盘 | 触屏 |
|---|---|---|
| 移动探针 | WASD / 方向键 | 左下虚拟摇杆 |
| 探测校验（拾满 3 片后） | 空格 | 右下按钮 |
| 重开一局 | R | 右下「重开」按钮 |

### 1.2 一局闭环（约 60–150 秒）

1. 场上散布 **key 片段**：蓝色 = 真实片段，红色 = 伪造片段（**红色会水平巡逻**，碰到就别捡）。
2. 拾满 **3 个真实片段**自动组装成待校验 key（HUD「组装中 key / 目标顺序」实时显示）。
3. 按**空格**送本地校验：三段判定，优先级 `format > checksum > revoked`，一次只报最高优先级原因。
4. **≤ 2 秒内**画面给出结论：
   - `key 有效 ✓`：+100 基础分 + 时间奖励（剩余 1 秒 = 5 分），进入下一波，片段重铺；
   - `key 无效 ✗`：显示无效原因，**信度 −1**（已拾片段保留，可调整后立即再探）。
5. 共 **3 波**难度梯度（伪造片段 1 → 2 → 3 个，巡逻越来越快；时限 25 / 20 / 15 秒）。
6. 波次倒计时耗尽：本波片段重铺、组装序列清空、信度 −1。
7. **信度（初始 3）扣到 0 = 失败结算**；打完 3 波 = 胜利结算（结算页含波数 / 总分 / 探测次数统计）。

### 1.3 判定规则速查（试玩时核对「无效原因」是否 believable）

- **格式** `invalid:format`：必须形如 `OAK-XXXXXXXX`（前缀 + 8 位十六进制），如 `OAK-HELLOWORLD` / `OAK-123`；
- **校验和** `invalid:checksum`：第 8 位 = 前 7 位面值之和 mod 16，如 `OAK-12345678`；
- **吊销** `invalid:revoked`：格式校验和都过但命中名单 `OAK-1337BEE5` / `OAK-FEDCBA94`；
- 其余判 `valid`。

### 1.4 看什么（试玩时重点体感，对应量表四问）

- **首分钟**：进页面到看懂「拾 3 片 → 空格探测 → 看结果」要不要人教？卡在哪一步？
- **反馈**：探测后结论出现是否 ≤ 2 秒；有效/无效有没有可感知的画面/音效反馈（Juice：弹跳/闪色/音效）；
  无效时「原因 + 信度 −1」是否一眼看懂。
- **手感**：探针移动跟不跟手（`move_speed`）、倒计时压迫感（`wave_time_scale`）、红片段威胁是否可读（`decoy_speed`）。
- **节奏**：三波之间有没有明显无聊段/断档；第几秒出现。
- **取证标记**（探针本职，顺手核一下）：浏览器 DevTools Console 里每次探测有一条
  `OAK_KEY_PROBE oak_key_probe=valid|invalid ...` 日志；存档字段落在 `user://oak_key_probe.json` 的
  `oak_key_probe` 键 —— **可检索**即达标。

---

## 2. 结构化试玩量表（四问逐条回填，请勿合并）

> 复制下面模板回填即可；「调参 URL」一栏在第 3 节的工作台里点「复制调参 URL」得到。

```text
【oak-key 试玩量表】试玩日期：        ｜ 入口：liveUrl（或 ?tuning=<JSON> 链接）

① 首分钟能否看懂目标与操作：是 / 否
   卡点（若否，卡在哪一步、第几秒）：

② 结束时想不想再来一局：1 / 2 / 3 / 4 / 5（5 = 非常想）
   原因：

③ 手感与反馈：1 / 2 / 3 / 4 / 5（打击感/音效/画面响应综合）
   具体（哪个反馈最强/最弱）：

④ 节奏有没有明显断档或无聊段：有 / 无
   出现在第几秒（以及当时在第几波）：

⑤（可选）调参 URL：?tuning=<JSON>
```

---

## 3. 调参工作台入口

**`https://leomac-studio.tail49399e.ts.net/apps/oak-key/?tuning=1`**

- 打开后**画面右上角**浮出「调参工作台」面板，按 `GameState.TUNING_META` 生成滑杆，**拖动即时生效**；
- 点面板上的**「复制调参 URL」**得到 `?tuning=<JSON>` 链接 —— 把它连同第 2 节量表发回来，
  就是一次完整的调参结果（数值会经 spec revisions 回写，产生新版本）；
- 调参**只认工程已声明的 4 个键**（URL 里未声明的键会被忽略并在 diff 说明中标注）：

| 键 | 含义 | 当前默认 | 允许范围 | 步长 |
|---|---|---|---|---|
| `move_speed` | 探针移动速度 (px/s) | 220.0 | 60 – 600 | 10 |
| `wave_time_scale` | 波次时限缩放（1.0 = 标称 25/20/15s） | 1.0 | 0.05 – 2.0 | 0.05 |
| `decoy_speed` | 伪造片段巡逻速度缩放 | 1.0 | 0.0 – 3.0 | 0.1 |
| `probe_credits` | 每局初始信度（无效/超时各 −1） | 3.0 | 1.0 – 5.0 | 1.0 |

- `?tuning=1`（非 JSON 对象）= 只开面板、不带覆盖值；`?tuning=<JSON>` = 开面板并预置数值；
  非法 JSON 按无调参处理，不阻塞启动。

---

## 4. 已知口径差与缺口（如实记录，不含任何未验证结论）

1. **spec ↔ 实现的关卡口径差**：spec.levels 声明 3 个关卡场景（`level_1/2/3.tscn`，6/12/16 样本、60/90/90s）；
   实现为**单主场景 3 波次梯度**（3 片段/波 + 伪造 1/2/3、25/20/15s）。spec 的 meta（休闲收集/取证探针）、
   numeric.rules（三段判定优先级）、content（耐玩度钩子中的「重开一局」）在实现中成立；
   「按日种子衍生样本 / 无效原因图鉴 / 全清计时挑战 / 3 个解锁项」未在实现范围内。量表按实现游玩。
2. **机器人试玩门禁判定器缺失**：`std-skills/godot-game-dev/scripts/playtest.sh`（及 `playtest_driver.gd`）
   模板仓库未预置。本节点**未自造判定器、未把平台注入目录当判定来源**，也因而不存在任何「机器人试玩 PASS」结论；
   权威 routine 模板（`std-skills/godot-game-dev/references/godot-smoke-routine.md`）的门禁链为
   availability / preflight / headless-smoke / input-fuzz 四步、不含 playtest 步，deploy 节点产物已记录该缺口并
   上报「请运维补模板仓库」，故不构成本节点阻塞。节奏类代理指标（首奖励秒数/反馈密度）在判定器补齐前**无数据**。
3. **调参生效边界**：调参只改运行中的实例；定稿数值须经 spec revisions 拍板后随下一轮重部署落进默认值
   （spec 是唯一事实源，代码默认值跟随 spec，本节点不直接改代码默认值）。

---

## 5. 收到试玩结果后本节点会做什么（回写协议，先说清再动手）

1. 解析回传 URL 里 `?tuning=<JSON>`，与 `GameState.TUNING_META` 比对：只留已声明键，逐键给
   「现值 → 新值」diff，范围外数值按钳制后的生效值标注；
2. `POST /api/v1/game-design-specs/cmupss3we0039m9dhp8wp0ycd/revisions` 把数值写进 `spec.numeric`
   （version +1，带 `sourceTrajectoryId` 溯源）→ `POST .../approve` 拍板；
3. 目标 artifacts 追加一条 `op=tuning_applied` 产物（拍板结论 + 数值 diff）；
4. **下一轮工作流按新 spec 重部署**，本节点不直接改代码默认值。

未收到用户结果前，以上 4 步全部不执行。
