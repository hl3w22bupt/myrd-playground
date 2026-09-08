# MyRD Playground

MyRD AI Agent 的测试项目，用于验证以下功能：
- 🤖 AI 代码生成
- 🔄 Pull Request 创建
- 🚀 CI/CD 集成
- 📝 代码审查

---

**⚠️ 这是一个自动化测试项目，请勿依赖代码质量**

---

# 和平精英 · Web 版（pubg-web-core）

纯浏览器端（免安装客户端）的战术竞技生存玩法：**跳伞 → 物资拾取 → 武器射击 → 缩圈毒圈 → AI 生存对抗 → 唯一存活者结算**。

- 技术栈：Three.js r185 + Vite 7 + TypeScript 5.9.x，零后端静态部署
- 架构基准：《Web大逃杀技术方案与性能红线》（确定性仿真核心 50Hz fixed timestep + seeded RNG + ECS-lite，仿真/表现分离，Three.js 只做「快照 → 场景」映射）
- 对局规模：玩家 1 + AI 12（实体上限 20），程序化地图 1.6km × 1.6km（城区/野区 + AABB 建筑）

## 运行

```bash
npm install
npm run dev        # 开发
npm run build      # 生产构建（tsc 类型检查 + vite build）
npm run preview    # 预览构建产物
npm run test       # vitest：AC1–AC5 Node 全流程自动化断言
npm run lint       # eslint：依赖方向 + 确定性红线（core 内禁 Math.random/Date.now，three 仅限 render/）
```

## 目录与依赖方向

```
src/
├── content/   # 配置表（武器/物资/缩圈/地图/物理/AI 人格/空投）——AC 数值唯一来源，禁止硬编码
├── core/      # 确定性仿真核心（纯 TS，零 DOM/three；Node 可直接运行）
│   ├── rng.ts loop.ts world.ts match.ts mapgen.ts geom.ts types.ts
│   └── systems/  # lifecycle / parachute / movement / combat / loot / zone / ai / airdrop
├── render/    # Three.js（three 只允许在此 import；材质纹理/光照雾效/粒子/画质三档+自动降档/对象池）
├── input/     # 键鼠 → PlayerIntent
├── ui/        # HUD（DOM 高频直写）+ Canvas2D 小地图 + 背包/结算/开始屏
├── app/       # 组装根（rAF 可变渲染 + 50Hz 固定逻辑双循环）
└── perf/      # 帧率/1%低帧/heap 采样
```

依赖规则（CI lint 强制）：`core → content`；`content` 不依赖任何模块；`three` 仅 `render/` 可用；`render` 禁止依赖 `ui`。

## 核心玩法系统

- **弹道下坠与后坐力**：弹道按抛物线分段扫描（drop = ½gt²，g/分段来自 `content/physics.ballistic`）；后坐力 = 散布 bloom + 垂直/水平踢枪（`content/weapons.RECOIL_TUNING`），停火按速率恢复，快照朝向含偏移（镜头踢枪可见），AI 瞄准自动做下坠与后坐力补偿。
- **血包急救**：绷带/急救包/医疗包三档（回复量/引导时长/格子占用见 `content/items`），Q 自动选择可用医疗物品；受击或开火打断引导；AI 低血自动治疗、低于人格阈值时脱离交火撤退。
- **背包与物资管理**：格子容量记账、整叠丢弃（弹药堆叠数量保留、射击储备同步扣减）、拾取最近可行（最近装不下自动尝试下一件）。
- **空投**：55s 首投、110s 间隔、单局 3 次上限（`content/airdrop`）；落点在安全区内；落地散布高价值物资（空投专属 sr_awm 栓动狙击/.300 马格南/三级甲/三级盔）；HUD 横幅 + 小地图红箱标记 + 3D 伞降箱。
- **AI 行为多样化**：4 种行为人格（突击/狙击/游击/搜刮，`content/ai.AI_PERSONALITIES`）按权重确定性分配；人格缩放视野/交火距离/反应/误差/侧移，并附加差异行为（狙击保持距离、低血撤退治疗、点射节流）。

## 验收标准 → 自动化测试映射（tests/）

| AC | 断言 | 测试文件 |
|---|---|---|
| AC1 全流程闭环 ≤10min | 固定 seed 跑满局：唯一存活者、结算含排名/淘汰数/用时、AI 胜与玩家胜两分支、快照完整性、核心吞吐 | match.spec.ts |
| AC2 跳伞落地 | 同 seed 同意图序列落点逐 tick 复现（偏差 0）、四阶段完整、落点偏差 ≤80m（地图 5%）、落地 1s 内进入地面移动、自选跳伞时机 | parachute.spec.ts |
| AC3 物资生效 | 区域密度生成、武器上膛即可射击、护甲/头盔减伤、医疗回血 +60、弹药计数、背包容量上限与丢弃 | loot.spec.ts |
| AC4 射击命中 | 双武器参数可区分且与配置一致、620rpm 射速节流、100m 静止目标命中率 ≥90%（1000 发蒙特卡洛）、距离衰减、部位倍率、换弹时长、淘汰计数 | combat.spec.ts |
| AC5 缩圈与 AI | ≥3 阶段收缩且 dps 递增、圈外按秒掉血、毒圈淘汰归因、AI ≥10 且具备巡图/拾取/索敌/开火/避毒、AI 可被淘汰 | zone.spec.ts / ai.spec.ts |
| 玩法补齐·弹道与后坐力 | 下坠量公式与弹着点对照（直线 vs 弹道扫描）、下坠补偿命中、踢枪累积/封顶/停火恢复、连射命中率惩罚、aimDelta 相对瞄准通道 | ballistics.spec.ts |
| 玩法补齐·血包急救 | slot -1 自动选包、三档医疗数值与配置一致、受击/开火打断、满血拒绝与封顶、AI 低血自动治疗 | medkit.spec.ts |
| 玩法补齐·背包管理 | 拾取最近可行、整叠丢弃（堆叠数量与储备同步）、slot -1 丢弃、新物品格子记账、容量上限语义 | inventory.spec.ts |
| 玩法补齐·空投 | 调度（首投/间隔/上限）与配置一致、同 seed 确定性复现、落点在圈内、falling→landed 生命周期与事件、玩家拾取 sr_awm 即可射击 | airdrop.spec.ts |
| 玩法补齐·AI 多样化 | 人格分配确定性与多样性、人格参数缩放、狙击/突击交火距离差异、低血撤退治疗、点射节流 | aiPersona.spec.ts |

## 操作

点击画面锁定鼠标 · WASD 移动 · Shift 疾跑/俯冲 · 左键射击 · R 换弹 · 1/2 切枪 · E 拾取 · Q 使用医疗包（自动选择） · G 丢弃 · F 跳伞 · 空格 开伞 · Tab 背包 · Esc 释放鼠标
