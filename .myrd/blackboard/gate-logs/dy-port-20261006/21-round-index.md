# 21 号轮 — N3 素材接线端到端复核（2026-10-06 · 游戏美术 · 只读复核轮）

> 编号说明：20 号已被程序线例行派发证据件占用（`c6ec296` 因与我 19 号轮撞号 git mv 改号 19→20），本轮顺延 21。
> 触发：任务书第三次派发。链已收口（N1–N5 ✅），19 号轮已全链复核绿。本轮补齐上轮唯一未机判面：
> **执行要求之「素材接线引用 + 引用失败走程序化 fallback 不破坏运行」**——零改交付物，只加证据。

## 素材接线链（N3 实查定型，全链可追溯）

```
A-07 源件 assets/release/share/dy-share-720x1280.png（sha256 c705aaa6…，只读零触碰）
  → tools/build-dy.mjs（构建期缺盘即抛 L113 · 包路径字面量单源）
    → export/dy/assets/dy-share-720x1280.png（包内同源件）
    → export/dy/game.js 注入 bootDy({ shareImageUrl: 'assets/dy-share-720x1280.png' })
      → src/platform/dy/boot-dy.ts（可选注入 shareImageUrl?: string；注入缺失=被动通道不注册）
        → src/platform/dy/share.ts（shareNow/installPassive；容器缺位/通道抛错两路降级，均不抛错）
```

fallback 三层在位：①构建期缺盘 fail-fast（组包器显式失败不装绿）；②运行期两路降级 `no-dy-container` / `share-failed`（try/catch 包裹，入口保留）；③注入缺失守卫（被动通道不注册，不抛错）。dy 包零图片加载构造（ac-13 不破），卡面由 tt 容器按路径取图——引用失败只降级分享结果，运行不破坏。

## 机判结果（7/7 无红 · 21a）

| # | 断言 | 结果 |
|---|---|---|
| w1 | 包内 game.js 注入 `shareImageUrl` = 包内相对路径 | PASS |
| w2 | 卡路径字面量全 game.js 仅注入点 1 处（单源纪律） | PASS |
| w3 | 包内卡 sha256 == A-07 源件（`c705aaa6…`） | PASS |
| w4 | `assets-manifest.files[dy-share-card]` sha256+bytes 同源机判 | PASS |
| w5 | 四列核对单六 id 全在（文件名与 spec 元素 id 对应） | PASS |
| w6 | share.ts 两路降级不抛错（try/catch） | PASS |
| w7 | boot-dy 可选注入 + 缺失不注册被动通道 | PASS |

配套运行时/锚点佐证：**21b** dy-share spec 6/6（dy-s4 降级两路 PASS）· **21c** g2 直跑契约 18/18 · **21d** run 仓根派发壳入口 `node scripts/contract-check.mjs` → 18/18 exit=0（例行桥接件 `f2959a2` 在 HEAD 态工作正常）。

## 自检脚本首跑红留痕（程序性 · 非产品缺陷）

21a 的断言脚本首跑 1 红（w4）：断言取错 manifest 键（假设 `assets[]`/顶层数组，实际结构为 `files[]`）。
实读包内 manifest 确认**产品数据正确**（`files[0]=dy-share-card / c705aaa6… / 72935B` 与 A-07 全等）后修正断言重跑全绿。
**红原件未单独留档**（同名 /tmp 文件被修正重跑覆盖，程序性失误，不补造）——红因、诊断过程与本声明以本索引留痕。产品面零改动、零触碰冻结红线。

## 结论

N3「接线引用 + fallback 不破坏运行」机判闭合，19 号轮四项之外的最后一块验收拼图落定。链收口态维持不变：**approve-ready 包 + 材料清单 dy 段 v2 等主人拍板**。本轮零改 g2 仓交付物（HEAD 仍 `cfb733c`），run 仓仅新增 21 号证据四件 + 索引 + assets.md 一行回写。
