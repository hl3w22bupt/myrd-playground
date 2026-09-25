# Stack Tower 技术方案（T4）— M2 首卡

> 版本：v1（2026-09-25） · 负责人：游戏程序（T4） · 依据：spec v1（platformSpecId `cmuga6tq90011gqlo3wkh9k7a`，`.myrd/spec/design-spec.json`）
> 技术栈：TypeScript 5.x + Canvas 2D + vanilla（零框架、零外部运行时依赖）
> 所有命令均可粘贴复现（仓库根目录执行）。

## 1. 架构与依赖方向

```
games/stack-tower/
├── src/
│   ├── kernel/      # 确定性内核：零 DOM、零 Canvas，Node 可直接运行
│   │   ├── numeric.ts    # 数值唯一来源（与 spec.numeric 一一对应）
│   │   ├── types.ts      # Snapshot / KernelEvent（含 tower-ripple 契约类型）/ SimHandle
│   │   ├── rng.ts        # mulberry32 seeded RNG（实现冲刺）
│   │   ├── sim.ts        # 16ms 固定步长累加器 + fastForward + restart（实现冲刺）
│   │   ├── tower.ts / block.ts / cut.ts / judge.ts / ripple.ts / difficulty.ts（实现冲刺）
│   ├── platform/    # 平台适配层：input / clock / audio / canvas 四接口
│   │   └── index.ts      # 接口 + 手动泵时钟（无头测试用）
│   ├── render/      # Canvas2D 表现层：快照→画布，tower-ripple 波纹唯一消费点
│   │   └── renderer.ts
│   ├── ui/hud.ts         # DOM HUD（实现冲刺；formatHud(snap) 为纯函数供契约断言）
│   ├── audio/sfx.ts      # WebAudio 程序化合成（实现冲刺）
│   └── app/main.ts       # 组装根：固定步长双循环 + 事件翻译
├── tests/contract/       # 契约测试（与 spec acceptance 一一映射，三态输出）
└── docs/                 # tech-plan / style-card / moodboard / qa-precheck
```

依赖红线（lint 强制，沿用 M1 规则）：`kernel → 无`（不依赖任何其他目录与 DOM API）；`render / ui / audio → kernel + platform`；`app → 全部`；`platform → 无`。内核出现 `window/document/AudioContext/requestAnimationFrame` 即打回。

## 2. platform/ 适配层方案

| 接口 | 职责 | 浏览器实现 | 无头实现 |
|---|---|---|---|
| `InputSource` | 点击/空格/触摸 → `{type:'drop'}`，去抖与多点归一 | DOM 事件监听 | `createNoopInput()`（测试直接注入 intent） |
| `ClockSource` | 帧回调 + 高精度时间 | `requestAnimationFrame` + `performance.now` | `createManualClock()` 手动泵（`advance`/`pump`） |
| `AudioSink` | 程序化合成音效（place/perfect/over） | WebAudio | `createSilentAudio()` |
| `CanvasHost` | 2D 上下文 + 逻辑尺寸（DPR 归一） | canvas 元素 | `null`（快照级断言不需要画布） |

- **逻辑坐标约定**：逻辑画布 480×720（CSS 像素），内核坐标即逻辑坐标；塔基中心 x=240。DPR 缩放只在 `CanvasHost` 实现内发生。
- 新平台（如小程序壳）= 新增一份 `Platform` 装配体，内核零改动。

## 3. 五件脚手架模板（本冲刺已落盘）

| 文件 | 内容 | 状态 |
|---|---|---|
| `src/kernel/numeric.ts` | 数值唯一来源 + 四组公式（perfectWindowMs / swingSpeed / targetLayers / perfectDistance）+ RIPPLE_DURATION | 可编译 |
| `src/kernel/types.ts` | Snapshot / KernelEvent（tower-ripple 四字段载荷）/ SimHandle（tick/fastForward/snapshot/restart） | 可编译 |
| `src/platform/index.ts` | 四接口 + 手动泵时钟 + 无声/无输入实现 | 可编译 |
| `src/render/renderer.ts` | 快照→画布（天空/塔块/摆块/波纹/碎块），波纹时长读 `duration_ms`，越界兜底 300 | 可编译 |
| `src/app/main.ts` | 组装根：事件单向流翻译 + 16ms 累加器双循环 | 可编译（依赖实现冲刺模块） |

实现冲刺补齐：`rng/sim/tower/block/cut/judge/ripple/difficulty/hud/sfx`（含 `formatHud` 纯函数导出）。

## 4. 契约测试三态协议

每条契约 = `tests/contract/<level_id>_<element_id>.spec.mjs`，与 spec `acceptance[].check` **逐字对齐**（runner 启动即校验，未登记命令直接 FAIL）。

| 三态 | 输出 | 退出码 | 语义 |
|---|---|---|---|
| PASS | `RESULT: PASS (n/n)` | 0 | 产物可达且全部断言成立 |
| FAIL | `RESULT: FAIL (k/n)` + 逐条原因 | 1 | 产物可达但有断言失败（含：命令未在 spec 登记） |
| not-runnable | `RESULT: not-runnable — <缺因>` | 0 | 实现产物未落盘（骨架期正常态，**不计绿**） |

可粘贴命令集：

```bash
# 单条契约（示例）
node games/stack-tower/tests/contract/lvl-01-stack-tower_e06-tower-ripple.spec.mjs
# 全量 8 条 + 汇总
node games/stack-tower/tests/contract/run-all.mjs
# 实现落盘后：类型检查 + 构建（产物进 build/，契约即转可执行）
cd games/stack-tower && npm run typecheck && npm run build
```

## 5. 确定性红线（契约 e02 已断言）

- 内核禁 `Math.random` / `Date.now` / `performance.now`；一切随机走 mulberry32(seed)。
- 固定步长 16ms 累加器，dt 钳制 `MAX_DT_MS=100`；`fastForward(n)` 供无头复现。
- 同 seed 同意图序列 → 逐 tick 快照全等（e02 两次轨迹全等断言）。

## 6. tower-ripple 事件管线（T1 必改②落点）

```
kernel/judge（perfect 成立）
  └─ 同 tick 上抛 {type:'tower-ripple', level_id, element_id, window_ms:140, duration_ms:300}
       └─ app/main：renderer.enqueueRipple(e, now) + sfx.play('perfect')   # 唯一副作用入口
            └─ render/renderer：300±50ms 椭圆波纹（越界按 300 兜底 + console.warn）
```

- 载荷恰四字段（加 `type` 判别字段共五键）；多一个语义字段（如 `screen_flash`）即违反降维决议，契约 e06 第 4 条断言拒绝。
- 表现层只有波纹与音效两个消费点；**无整屏 aha / 闪屏通道**。
