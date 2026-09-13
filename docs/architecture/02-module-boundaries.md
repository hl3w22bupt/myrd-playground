# 02 · 模块边界 与 接口契约

> 原则：边界清晰 > 接口齐全。本文只定义**模块间必然要穿越的边界**；模块内部结构留给实现者。

## 1. 目录结构与依赖方向

```
src/
├── core/          # 仿真核心：纯 TS，禁止 import three / react / DOM API
│   ├── loop.ts          # fixed timestep 循环（Node 可用，浏览器同实现）
│   ├── rng.ts           # seeded RNG + fork 子流
│   ├── world.ts         # World 状态容器 + 实体增删查
│   ├── events.ts        # GameEvent 定义与事件队列
│   ├── systems/         # parachute / movement / combat / loot / zone / ai / lifecycle
│   └── index.ts         # createMatch(config): MatchHandle
├── content/       # 配置表（JSON + zod 校验）：weapons / loot / zone / map / constants
├── render/        # Three.js：场景、资源、LOD、相机、特效、对象池、画质档
├── input/         # 键鼠 → PlayerIntent（浏览器专用）
├── ui/            # React 界面（菜单/背包/结算）+ hud/（高频直写 DOM/Canvas2D）
├── app/           # 组装根：创建 match + render + ui 并接线
└── test/          # Node 侧仿真断言（vitest），复用 core + content
```

**依赖规则（CI 强制，违反即 lint error）**：

| 模块 | 可依赖 | 禁止依赖 |
|---|---|---|
| `core` | `content` | `render` `ui` `input` `three` `react` |
| `content` | — | 其他所有模块 |
| `render` | `core`（类型与快照）、`three`、`content` | `ui` |
| `input` | `core`（类型） | `render` `ui` |
| `ui` | `core`（类型与事件）、`render` 不依赖 | `core` 内部实现细节 |
| `app` | 全部 | — |

## 2. 核心契约（TS 草案，实现以此为准）

```ts
// core/index.ts —— 仿真对外的唯一入口
export interface MatchConfig {
  seed: number;                 // 全局种子（物资/AI/航线子流由它派生）
  contentPack: ContentPack;     // 来自 content/，已通过 zod 校验
  playerCount: 1;               // 本期固定单人
  aiCount: number;              // 10..19
}

export interface MatchHandle {
  tick(intents: PlayerIntent[]): void;        // 推进一个 20ms tick
  snapshot(): WorldSnapshot;                   // 渲染层只读快照
  drainEvents(): GameEvent[];                  // 取走本 tick 事件（UI/特效消费）
  status(): MatchStatus;                       // lobby | parachuting | playing | ended
  result(): MatchResult | null;                // ended 时非空（排名/淘汰数/用时）
  elapsed(): number;                           // 逻辑毫秒
}

// core/world.ts —— 意图：输入侧唯一通道
export type PlayerIntent =
  | { kind: 'move'; dirX: number; dirZ: number }        // 归一化方向
  | { kind: 'aim'; yaw: number; pitch: number }         // 相机朝向
  | { kind: 'fire' } | { kind: 'reload' } | { kind: 'switchWeapon'; slot: number }
  | { kind: 'interact' }                                // 拾取/开包
  | { kind: 'drop'; slot: number } | { kind: 'useItem'; slot: number }
  | { kind: 'jumpFromPlane' }                           // 跳伞时机
  | { kind: 'freefallControl'; pitchInput: number; yawInput: number } // 俯冲/转向
  | { kind: 'deployParachute' };

// core/events.ts —— 输出侧唯一通道（UI 与渲染只认事件，不读内部实现）
export type GameEvent =
  | { type: 'lootSpawned'; id: string; pos: Vec3; item: ItemId }
  | { type: 'lootPickedUp'; entityId: string; item: ItemId; slot: number }
  | { type: 'weaponEquipped'; entityId: string; weapon: WeaponId }
  | { type: 'shotFired'; entityId: string; weapon: WeaponId; origin: Vec3; dir: Vec3 }
  | { type: 'damageDealt'; target: string; amount: number; bodyPart: BodyPart; lethal: boolean }
  | { type: 'entityEliminated'; entityId: string; byId: string; cause: 'shot' | 'zone' }
  | { type: 'zonePhaseChanged'; phase: number; center: Vec3; radius: number; nextCenter: Vec3; nextRadius: number }
  | { type: 'playerStateChanged'; state: PlayerState }   // UI 状态栏
  | { type: 'matchEnded'; result: MatchResult };
```

### 快照（渲染层唯一数据源）

```ts
export interface WorldSnapshot {
  tick: number;                 // 逻辑 tick 序号（渲染插值用上一/当前两帧）
  entities: EntitySnapshot[];   // 只含"会被看到"的字段，不含内部数值
  loots: LootSnapshot[];
  zone: { center: Vec3; radius: number; nextCenter: Vec3; nextRadius: number; phase: number; timeToShrink: number };
  plane: { active: boolean; pos: Vec3; dir: Vec3 } | null;
}
export interface EntitySnapshot {
  id: string; kind: 'player' | 'ai'; alive: boolean;
  pos: Vec3; yaw: number;
  state: PlayerState;           // plane | freefall | parachute | ground | dead
  weapon: WeaponId | null;
}
```

**边界纪律**：
1. 渲染层**只读** snapshot + events，任何逻辑判断（能不能拾取/会不会掉血）必须由 core 的事件或字段给出，渲染层不做规则复算。
2. `core` 的 tick 是唯一状态推进入口；`tick()` 内不允许任何 `Date.now()` / `Math.random()` / DOM 访问 —— 这是确定性（N2）的技术底线。
3. 跨模块传递一律值类型（`Vec3` 为 `{x,y,z}` 普通对象），不传类实例，避免可变共享。

## 3. 系统划分（core/systems，按 tick 执行顺序）

| 顺序 | System | 职责 | 消费/产出 |
|---|---|---|---|
| 1 | lifecycle | 对局状态机：登机→跳伞→对战→结算；胜负判定（仅剩 1 存活） | 事件 `matchEnded` |
| 2 | parachute | 运输机航线、四阶段（自由落体→开伞→滑翔→落地）物理 | `plane`、`PlayerState` |
| 3 | movement | 地面移动、地形高度采样、建筑 AABB 碰撞 | 实体 pos/yaw |
| 4 | combat | 射击节流、弹道射线、命中判定（包围盒+部位+距离衰减）、换弹/切枪 | `shotFired`/`damageDealt`/`entityEliminated` |
| 5 | loot | 物资按区域密度生成、拾取判定、背包容量/丢弃、护甲减伤/医疗回血生效 | `lootSpawned`/`lootPickedUp` |
| 6 | zone | 缩圈阶段表、圈心/半径生成与插值收缩、圈外按秒掉血 | `zonePhaseChanged`/`entityEliminated` |
| 7 | ai | FSM（patrol/loot/seek/fire/fleeZone/dead）+ 轮转分帧决策 | AI 的 PlayerIntent（复用玩家指令集） |

**AI 与玩家共用同一套 PlayerIntent 与同一套 systems**：AI 不走特权通道。这条约束让"AI 也会被淘汰/也会避毒"天然成立，也让 AC4 的命中率验证可以用 AI 对 AI 的对局复现。

## 4. 内容数据表 schema（content/，AC 数值的唯一来源）

```ts
// weapons.ts —— AC4 的数值依据
export interface WeaponDef {
  id: WeaponId;                 // e.g. 'ar_m4' | 'smg_ump'
  category: 'ar' | 'smg';
  damage: number;               // 基础伤害
  rpm: number;                  // 射速（发/分）
  magazine: number;             // 弹匣容量
  reloadMs: number;             // 换弹时间
  recoil: number;               // 后坐力系数（0..1）
  effectiveRange: number;       // 有效射程（m），超出伤害线性衰减至 50%
  spread: number;               // 散布（rad）
  projectileSpeed: number;      // 弹速 m/s（命中判定用射线扫描）
}

// loot.ts —— AC3 的生成与生效依据
export interface LootTableDef {
  zones: Array<{ name: string; centerRadius: number; density: number; pool: Array<{ item: ItemId; weight: number }> }>;
  items: Record<ItemId, ItemDef>;
}
export type ItemDef =
  | { id: ItemId; kind: 'weapon'; weaponId: WeaponId; gridCost: number }
  | { id: ItemId; kind: 'ammo'; ammoType: string; count: number; gridCost: number }
  | { id: ItemId; kind: 'armor'; damageReduction: number; gridCost: number }   // 0..1 减伤
  | { id: ItemId; kind: 'helmet'; headshotReduction: number; gridCost: number }
  | { id: ItemId; kind: 'medkit'; healAmount: number; useMs: number; gridCost: number }
  | { id: ItemId; kind: 'grenade'; damage: number; radius: number; gridCost: number };

// zone.ts —— AC5 的阶段依据（示例为 6 阶段初始建议值）
export interface ZoneConfig {
  initialRadius: number;        // 首圈半径（m），建议 600
  shrinkFactor: number;         // 每阶段半径乘数，建议 0.65
  phases: Array<{ waitSec: number; shrinkSec: number; dps: number }>;  // 圈外掉血/秒，逐阶段递增
  centerDrift: number;          // 下一圈心相对当前圈的随机偏移比例，建议 0.4
}
```

初始建议值（实现时直接落入 JSON，由测试断言，不在代码中硬编码）：

- 武器 A `ar_m4`：damage 26 / rpm 620 / magazine 30 / reloadMs 2200 / effectiveRange 350 / recoil 0.45
- 武器 B `smg_ump`：damage 18 / rpm 850 / magazine 25 / reloadMs 1800 / effectiveRange 120 / recoil 0.30
- 护甲：减伤 0.35（躯干）；头盔：爆头减伤 0.5；医疗包：+60 HP，使用 3000ms
- 部位倍率：头 2.5 / 躯干 1.0 / 四肢 0.75
- 地图：1.6km × 1.6km（AC2 的"地图尺度 5%" = 80m 容差）
- 缩圈 dps 示例：`[0.4, 0.8, 1.5, 2.5, 4, 6]`，等待/收缩秒示例：`[60/40, 50/35, 40/30, 35/25, 30/20, 25/15]`（合计 < 10 分钟，满足 AC1）

## 5. 事件协议与回放（可观测性基建，成本极低）

- **录制**：`{seed, contentPackVersion, intents[]}` 按 tick 顺序落 JSON（本地 IndexedDB / 下载）。
- **回放**：同 seed + 同意图序列重放，因 ADR-003 确定性而**必然逐帧一致**。
- 用途：bug 复现（玩家只需提供文件）、AC2 复现性断言、AI 行为回归。
- 不引入专用 replay 序列化格式/库，一个 `JSON.stringify` 即可 —— 这是确定性架构的免费收益。
