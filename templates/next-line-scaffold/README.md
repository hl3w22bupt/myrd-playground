# next-line-scaffold — 第二产品线预置件三套（B2 · 2026-10-10）

> 边界声明：这是**预置件**（任务书 B2 明示例外），不是新线工程——未写 spec、未锚风格卡、未立项。
> 主人下轮三轴选型落定后，以本目录为起点复制立项（目录迁入 `games/<new-line>/`）。

## 三套内容

| 套 | 产出 | 责任线 | 状态 |
|---|---|---|---|
| ① 程序脚手架空壳 | `src/platform/index.ts`（平台门面：接口 + noop 降级）· `src/kernel/loop.ts`（确定性内核骨架：mulberry32 + fixed-step）· `tests/contract/ac-template.spec.mjs`（契约模板）· `tools/smoke.mjs`（空壳冒烟） | 游戏程序 | **SCAFFOLD-SMOKE: PASS（4/4）**（node tools/smoke.mjs 可复跑，零 npm 依赖） |
| ② 美术模板 | `art/style-card-template.md`（风格卡四要素：**调色板/光照/线条/比例**〔美术线规范口径，N3 亲审对齐〕+ 扩展项 字体/动效 + 一致性门禁）· `art/visual-feedback-channel-spec-template.md`（视觉反馈通道规格：五要素 + 示例行） | 美术 | 模板就绪 · **N3 亲审 PASS（2026-10-10：风格卡四要素对齐修订 P-01，反馈通道规格只检零改动）**（填写时机 = 新线风格定稿，简报落账+选型后） |
| ③ 策划模板 | `design/fun-verdict-template.md`（好玩判据四件套句式 + check 指向可跑测试文件 + 措辞规范） | 游戏策划 | 模板就绪（填写时机 = 每批人工验收备料） |

## 纪律锚点（三套共同守）

1. 内核零平台感知（platform 门面唯一出口）· 确定性内核零 Math.random/Date.now
2. spec acceptance `check` 唯一落点指向可跑测试；spec 有而件缺 = 红（零断言不装绿）
3. 「好不好玩」终裁归主人；机器面只出「机制就绪、感知待真人判定」级结论
4. 数值一律 spec 单源（生成器产数据文件，零手抄第二份）
