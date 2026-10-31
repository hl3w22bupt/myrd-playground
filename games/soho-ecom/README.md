# 白手起家·跨境电商版 · M2 事件流 + 升级线

「一人 SOHO 跨境电商」一屏经营循环：**选品 → 上架 → 出单 → T+14 回款 → 回血**，
M2 叠加**奇葩/暖心事件流 + 发货/住房升级线 + P0→P1 阶段曲线**。
Three.js 低多边形 SOHO 房间氛围 viewer + DOM 卖家后台面板；经济内核按 M0 数值框架 v1 硬编码，
kernel/render 分离 + 单文件构建复现 + 三层门禁（复用 threejs-game-dev 模板全量接线）。

- 依据：`.myrd/spec/design-spec.json`（GameDesignSpec v3 + M0 数值框架 v1，approved；M2 落地口径回写于 spec.m2 段）
- M1 需求：一屏可玩核心循环（goal-cmvv02e7a0019m9uwy2nosbkn / req cmvv0oaay002dm9uway7xk1y1）
- M2 需求：事件流 + 升级线（goal-cmvv02e7a0019m9uwy2nosbkn / req cmvv7a5bf0016m9ycmvnyohyk）

## 玩

```bash
npm install --no-fund --no-audit
node tools/build.mjs        # 产出单文件 index.html（零外部资源，双击即可玩；同步 export/web/ 供部署）
```

- 面板操作：选品上架 → 补货（¥40/件，档位 5/10/25/50 件，¥200 起）→ 订单自动出 → 等在途批次 T+14 到账 → 回血再投入
- 生活动作：泡面 ¥5 / 正经饭 ¥20 / 睡车里（免费）/ 钟点房 ¥50 / 回评（精力 5 → 店铺健康 15）
- M2 增长：现金冲到 **¥5000 触发 P1「SOHO 起量」** → 解锁广告（¥10 → 期望 +1.5 单）、
  海外仓升级（¥3000，补货 ¥40→¥20/件、毛利 ¥15→¥35）、SOHO 住房升级（¥3000，房租 ¥30→¥60/日、睡车里→睡家里 精+60）
- M2 事件流：跟卖狗 / 差评师（24h 内 ¥50+5 精力公关减半）/ 货代延误 / 海关查验 / 旺季断货 /
  老客五星复购 / 爆款自然流量 / 海外仓及时补货（海外仓升级后）——弹窗告知 + 事件流水留痕，效果全部走统一结算入口
- 桌面：空格暂停 · R 重开 · 1/2/4/8 调速 · 拖动旋转房间；触屏：点按钮 · 拖房间 · 点画面开始
- 演示存档：`?case=broke`（趴窝触发与解除）· `?case=rich`（P1 起量：升级线/广告/事件应对）
- 调参 v1（spec.tune，依据验收清单 T1/T3）：开局 ¥3000→¥3500、补货 5 件档 ¥200 贴线细水长流、P0 需求带宽对齐资本带宽（错失噪音 ~25/日 → ~7/日）、趴窝期剔除延误类事件——报告见 `docs/tune/TUNE-v1-p0-feel.md`
- 无头冒烟：`index.html?smoke=<游戏日数>`（经营自动驾驶快进，SMOKE JSON 落 `#ts-smoke` + title）
- 弹窗路径冒烟：`index.html?modal=1`（自动驾驶替身真实帧经营，但事件决策卡沿真实 DOM 路径弹出、
  打开即暂停，供 `tools/modal-smoke.mjs` 真实点击「知道了/投诉/公关」按钮——`?smoke` 协议把决策
  交给自动驾驶不弹窗，「暂停态人点弹窗按钮」这条路径由本协议覆盖）

## 一屏布局

右侧 DOM 面板七段式：三资源（精力/现金/店铺健康 + 饱腹）→ 账本三池（库存/在途批次/现金）→
选品·上架·补货 → **增长·升级线（广告 + 海外仓 + SOHO 住房）** → 回血·生活动作 →
**事件流水** → 资金流水（每笔变动可追溯）。3D 房间随状态呼吸：库存=纸箱堆、精力=笔电屏幕亮度、
店铺健康=窗边光色、趴窝=全屋压暗+红色警示灯、回款=绿色脉冲、事件=红/绿粒子、升级=橙色庆祝粒子。

## 内核规则（M1 原型口径，全部由 M0 锚点派生，无新增数值参数）

| 规则 | 内容 | M0 依据 |
|---|---|---|
| 出单 | 精力 −2、库存 −1、在途货款 +¥55 | exchangeRates.energyPerOrder / unitEconomics / levels.p0.elements |
| 单件经济 | 补货 ¥40/件 → 售 ¥55/件 → 毛利 ¥15/单（全表之锚） | exchangeRates.grossProfitPerOrder #1 / firstRestock #7（¥2000→50件=¥40/件） |
| 需求 | 单链接日需求 = base × (店铺健康/100) × 当日噪声(0.7~1.3，种子驱动) × 事件修正 | loop A 手算 30 单/日 workload（公式层基线）；实装带宽对齐资本带宽 S*≈5 件/日（合计 11/日，调参 v1 = spec.tune.demandBand）；循环 C 转化通道 |
| 精力天花板 | 可用精力 < 2 → 订单错失 | energyPerOrder「与精力上限共同决定每日单数天花板」 |
| 吃睡链 | 饱腹 = 0 → 睡车里/睡家里/钟点房精力恢复无效 | loop A「接单→精力↓→吃睡→恢复」 |
| 回款 | 到期日 = 下单日 + 14，到期当日上午自动转可用现金（误差 0 天）；事件延期经流水落账可复算 | payoutCycleDays #10 / payoutPools.settleRule |
| 趴窝 | 现金 < 固定开支 + 最低补货（档位动态：床位档 ¥230 / 海外仓 ¥130 / SOHO ¥160；调参 v1 最低档 10→5 件，口径公式不变 = spec.tune.restockLots）→ 无法补货 + 广告停投；回款到账自动解除 | payoutPools.brokeRule |
| 终局 | 趴窝 ∧ 在途空 ∧（无库存 ∨ 精力<2）∧ 现金 < ¥55（自救启动金）→ 资金链断裂 | 原作「没油趴窝」的直接翻译 |
| 时间 | 1× 下 1 游戏日 = 75 真实秒；速率 1/2/4/8×（默认 4×）；一局 30 游戏日 | time.gameDayRealSeconds=75 / sessionSeconds 900 |

## M2 事件流（spec.numeric.events 逐条对号，误差 0；落地口径见 spec.m2）

| 事件 | 类别 | 效果（效果表原文） | 应对 |
|---|---|---|---|
| 跟卖狗 | 奇葩 | 转化率 −20% × 3 游戏日 | 花 10 精力投诉提前下架 |
| 差评师 | 奇葩 | 店铺健康 −20 | 24h（1 游戏日）内 ¥50+5 精力公关 → 减半（净 −10） |
| 货代延误 | 奇葩 | 在途批次 +3 日，店铺健康 −10 | —（自动） |
| 海关查验 | 奇葩 | 现金 −¥300，在途 +2 日 | —（自动） |
| 旺季断货 | 奇葩 | 库存归零期每日店铺健康 −5 | 补货解除 |
| 老客五星复购 | 暖心 | 店铺健康 +10，心情 +5 | —（自动） |
| 爆款自然流量 | 暖心 | 当日订单 ×2 + 当日广告费返还 | —（自动） |
| 海外仓及时补货 | 暖心 | 最早在途批次 −3 日，店铺健康 +10 | —（海外仓升级后入池） |

- 心情：纯事件修正器（±%，需求乘数 = 1 + 心情/100，钳 ±20），非管理资源
- 触发节奏：每游戏日至多一次（概率 0.9、同类冷却 3 日、暖心权重 1.6），前置「至少一个链接在营」；趴窝期间剔除「货代延误 / 海关查验」（spec.tune.eventCadenceTune：趴窝期再压救命钱只产生挫败不产生张力，效果值零改动）
- 汇率波动不进 M2（spec.fx.mode=constant，P2 才降级为波动事件）；批次平移全部落流水（kind=payout-delay）可重放复算
- **决策卡暂停语义与派发豁免**：决策卡「打开即暂停」（弹窗期间时间冻结，每日结算不跳变），选择仍经
  `game.dispatch("eventChoice")` 唯一入口落账 —— dispatch 守卫对 eventChoice 在 **paused 态豁免**（玩家点
  按钮时必然处于弹窗暂停态）；其余商业动作 paused 态仍拒绝，eventChoice 在 title / gameover 态照拒
  （tests/events.spec.mjs ⑦ + tests/state-machine.spec.mjs 机判）。豁免缺失 = 按钮静默拒收、pendingEvents
  残留、同一张卡同步弹回（2026-10-31 线上 P0「知道了/投诉点了没反应」整局软锁死的根因，已修）。

## 三刀收敛（spec.mvpCuts，tests/mvp-cuts.spec.mjs 机判）

1. **三资源上线**：精力 / 现金 / 店铺健康（M2：心情进场但仅作纯事件修正器；信誉并入店铺健康，无独立信誉）
2. **库存不做管理界面**：「现金的前置形态」一条公式——补货入库 / 出单出货（海外仓只改单价不改公式）
3. **回款周期固定 T+14**：唯一回款值；无 T+7 / 回款垫资 / 周期升级（P2 内容未提前进场）

M2 仍禁（非目标，黑名单静态扫描）：招运营 / 多店铺 / 融资上市 / 品牌备案 / 自建站 / 办公室 / 汇率波动。
M2 进场：事件流（8 类）/ 升级线（海外仓、SOHO 住房）/ 广告 / P0→P1 阶段曲线——数值逐条对号（tests/mvp-cuts.spec.mjs）。

## 结构

```
index.template.html   # 入口模板（面板 CSS + DOM 骨架 + <!--BUNDLE--> 注入位）
index.html            # 构建产物：单文件、零外部资源（勿手改，node tools/build.mjs 生成）
export/web/index.html # apphost assets_dir（部署时上传对象存储，server 经 asset-store 直出）
src/
  numeric.js          # M0 数值框架 v1 代码镜像（全部锚点 + M1/M2 内核规则，禁止散落魔数）
  kernel/             # 确定性内核：零 three / 零 DOM / 零系统随机 / 零系统时钟（Node 可直接跑）
    rng.js            #   mulberry32 种子随机（唯一随机源）
    ledger.js         #   账本三池 + 唯一结算入口 settle() + 流水 journal + 重放 replay() + 批次平移 delayBatches()
    world.js          #   经济世界：选品/出单/批次结算/生活动作/趴窝判定/广告（纯函数 + 边界加固）
    events.js         #   M2 事件流引擎：8 类事件定义表 + 每日调度 + 统一结算落账 + 心情修正器
    upgrades.js       #   M2 升级线：海外仓/SOHO 一次性开关 + P0→P1 阶段沿 + 动态房租/趴窝线
    loop.js           #   固定步长累加器 + 显式状态机（守卫转移）+ fastForward 无头钩子
    autopilot.js      #   经营自动驾驶（冒烟协议与确定性测试共用的真实玩家替身，含事件应对/升级/广告决策）
  levels/products.js  # 选品目录：内核与渲染共享真源（4 商品，统一 ¥40/¥55/毛利¥15）
  render/             # 表现层：scene（SOHO 房间+画质四件套）/ textures / audio / hud / touch
  main.js             # 装配根：状态机 ↔ DOM/输入/渲染循环；事件弹窗（决策卡暂停）；?smoke= 无头冒烟协议 + ?modal=1 弹窗路径冒烟协议
tests/                # 门禁：目录扫描式聚合（run-all.mjs），新增 *.spec.mjs 自动纳入
tools/                # build（esbuild 单文件 + export 同步）+ src-sha（源码指纹）+ verify-reproducible + rich-smoke（M2 冒烟）+ modal-smoke（决策卡真实点击冒烟，可传部署 URL 实测线上）
```

## 门禁（三层，顺序固定）

```bash
node ../../std-skills/threejs-game-dev/scripts/preflight.mjs .   # ① 静态前置检查（零依赖，秒级）
node tests/run-all.mjs                                           # ② 构建复现 → 单文件契约 → 十一份契约测试
node ../../std-skills/threejs-game-dev/scripts/browser-smoke.mjs . --seconds 32  # ③ CDP 双视口冒烟
node tools/rich-smoke.mjs .                                      # ④ M2 专属：P1 曲线端到端冒烟（升级/广告/事件应对）
node tools/modal-smoke.mjs .                                     # ⑤ 决策卡真实点击冒烟（--pick counter|dismiss 两路各跑一遍）
```

契约测试与验收标准的映射：

| 测试 | 验收条目 |
|---|---|
| `pools-conservation.spec.mjs` | M1 验收 2：三池正确流转、T+14 误差 0 天（逐笔）、流水重放可复算、资金/货权守恒 |
| `settlement-entry.spec.mjs` | M1 验收 3：三资源一致结算（静态扫描 + 随机动作重放）、M0 公式逐项复算 |
| `broke-state.spec.mjs` | M1 验收 4：趴窝可触发（?case=broke）、可恢复、不误报、连点不重复扣费 |
| `mvp-cuts.spec.mjs` | M1 验收 5 + M2 范围核对：三刀保持、M2 数值对号、P2/P3 与汇率零出现 |
| `kernel-determinism.spec.mjs` | 内核确定性：同 seed 同动作序列 → 逐字段一致；自动驾驶 30 日真实对局 |
| `state-machine.spec.mjs` | 状态机边界对抗（非法转移/暂停连按/结算瞬间输入/重开全复位/NaN 污染） |
| `events.spec.mjs` | M2 验收 1+2：默认 seed ≥10 日 ≥6 类（两类均有）、效果表逐条一致、统一结算重放、差评师公关减半、弹窗期间结算不跳变、未开张零事件、暂停态决策卡落账（「知道了/投诉」paused 豁免 + 商业动作照拒） |
| `upgrades.spec.mjs` | M2 验收 3：rich 存档两级升级、连点 10 次仅扣 1 次、房租档位/睡家里/趴窝线动态 |
| `stage-curve.spec.mjs` | M2 验收 4+5：P0 禁广告/升级、¥5000 触发 P1、单位经济 ¥15→¥35、广告期望 1.5 精确、趴窝停投、P1 单向 |

## 部署（AppHost）

壳在**仓库根**（平台管线固定读 `<repo>/server/`，manifest 默认 `<repo>/apphost.toml`）：

```
apphost.toml            # 应用清单：assets_dir = games/soho-ecom/export/web（仓库根相对路径）
server/                 # Node20 + Hono 壳：/health、/ 经 asset-store 直出游戏单文件、/api/public/info
games/soho-ecom/export/web/index.html   # 构建产物（node tools/build.mjs 同步至此，随仓库提交）
```

```bash
node tools/build.mjs          # 产出 index.html 并同步 export/web/
git commit + push             # 资产目录必须在仓库里（部署按 gitRef 克隆后上传对象存储）
POST /api/v1/apphost/apps/<appId>/deployments
  {"mode":"bundle","gitRef":"<分支>"}   # manifestPath 缺省即仓库根 apphost.toml
```

壳契约：Node20 + Hono、`export default app`、`GET /health` 200、业务路由在 `/api/*` 下、
响应一律文本类（单文件 HTML 经 asset-store 直出，二进制不可过网关）。

## 派生下一里程碑（M3+）时

1. 加系统 = 先回写策划案 spec → 同步 numeric.js → 再动 kernel/render（spec 单一事实源，M2 已示范 spec.m2 段的回写格式）；
2. 汇率波动（fx-swing）在 P2 才降级为事件——进场前先删 mvp-cuts 黑名单对应条目并回写 spec；
3. 画质四件套（Bloom/ACES/雾/软阴影）不要拆——拆了画面立刻回退到 demo 感；
4. 新增门禁 = 新增 `tests/*.spec.mjs`，聚合器自动纳入。
