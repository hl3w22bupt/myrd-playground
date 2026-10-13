# CC0 资产库使用指南（godot-game-dev）

> G5 路线一：**策展库替代零贴图**。库里是 Kenney CC0 精选件（溯源见 `assets/cc0/LICENSES.md`），
> 静态精灵没有"生成一致性"问题，拷贝即用、许可干净。扩库流程在文末。

## 三步用库

```bash
# 1. 语义查库（中文/英文关键词都行，输出路径 + 接入提示）
node scripts/asset-query.mjs --need "收集 反馈 粒子"
# 2. 拷进工程（只拷用到的，保持工程精简）
cp assets/cc0/particle/magic_01.png <gamePath>/assets/particles/
# 3. 游戏里着色使用（中性灰素材靠 modulate 适配风格卡色板）
```

## 库内容速览（28 件精选）

- **particle/（17 件，512×512 透明底）**：circle_0x 光晕/涟漪、flare 强闪、light 柔光、
  magic 收集星尘、spark 火花、star 星、smoke 烟、fire 火焰/推进、slash 挥击、trace 拖尾、window 面板框
- **ui/（10 件，灰色中性系）**：矩形/圆/方按钮（flat/gloss/border 质感）、横竖滑槽（血条/进度条）、
  旋钮、勾选、空星
- **font/kenney-future-narrow.ttf**：展示字体，**只有拉丁与数字字形**——分数/倒计时用它出质感；
  中文正文仍是内置 Noto Sans SC（P13b 字形门禁口径，别拿它渲染中文）

## 反馈三件套（juice 最低配置，实现节点自检项）

1. **环境层**：`Ambience` autoload 默认已开（渐变天空 + 漂浮粒子 + 暗角）——别删；
   按风格卡换色：`Ambience.setup({"sky_top": …, "particle": "spark_01.png", …})`
2. **交互层**：收集/命中/消除调 `Ambience.burst(pos, tint)`（6 粒迸发 + 重力）；
   与 `Juice.pop/sfx` 并用（Juice 管事件有反馈，Ambience 管反馈好看）
3. **拖尾层**：高速移动贴 `trace_02.png` 拉伸（可选，速度感题材才需要）

## 纪律

- 着色用 `modulate`/`self_modulate` 对齐风格卡 palette，**不许改源图**（保持库文件 sha256 稳定，
  asset-gate 靠它做溯源）
- 工程资产入仓前跑 `node scripts/asset-gate.mjs --game <gamePath>`：
  CC0 库拷贝自动过；自备/生成资产必须在 `.myrd/compliance/checklist.json` 给许可证据
- 视觉观感上限参照：`docs/eval-harness/gallery-rsi/`（参照系截图）与
  `docs/eval-harness/2026-10-12-rsi-reference-gap-analysis.md` 的配方清单

## 扩库（运维/agent 均可）

1. 从 CC0 源（kenney.nl 等）下载新包，**只挑工作件**（整包直接塞会爆体积）；
2. 文件放 `assets/cc0/<类别>/`（小写连字符命名）；
3. `tags.json` 补条目（file/en/zh/usage 四字段）；
4. `LICENSES.md` 登记来源 URL + 许可 + 日期；
5. `node scripts/asset-gate.mjs` 全绿即入列（未登记文件会被拦）。
