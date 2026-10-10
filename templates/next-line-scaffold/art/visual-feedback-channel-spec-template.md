# 视觉反馈通道规格模板（预置件② · 美术 × 程序 × 策划三方接口件）

> 用法：每条视觉/听觉反馈通道一行规格，五要素齐备才可入 spec acceptance（缺格 = 打回）。
> 判例承自 g2-blocks ac-31/ac-32（near-miss 弱反馈通道与结算页槽位）。

## 通道规格行（逐条填写）

| 字段 | 填写口径 |
|---|---|
| `channel-id` | 稳定 id（`vf-<场景>-<语义>`，如 `vf-clear-burst`） |
| `trigger` | 触发时点（精确到状态机相位 + 判定谓词；禁「适当时候」类模糊措辞） |
| `form` | 形态（文案/高亮/粒子/震屏/音效档位；引用风格卡四要素 token，禁新值） |
| `duration` | 时长数值（ms 档位，进 numeric 冻结面）+ 驻留/衰减口径 |
| `rate-limit` | 频控（每 N 次/局、全局帽、超限行为：静默/仅遥测）——**无频控通道必须写「无（理由）」** |
| `machine-check` | 可机关断言面（机读观测口/构造面，如 `__G2_NM bannerActive` 判例）；无机判面 = 通道不可入契约 |
| `perception-note` | 「机制就绪、感知待真人判定」条款适用面声明（观感归人工 rubric，不进契约断言） |

## 示例行（范例，非本线承诺）

```
channel-id: vf-clear-burst
trigger: 消除结算同逻辑帧末态（fillCountBasis=post-clear-same-frame-endstate）
form: 粒子簇 ×1（accentWarm 单色 · 密度档 P2）+ 音效第二档
duration: 生命 480ms + 出屏裁剪；同屏硬顶 24（超出排队丢弃，只记遥测）
rate-limit: 无（理由：消除主反馈，逐次必出；密度由硬顶约束）
machine-check: smoke 差分像素断言（存活帧命中/消亡后复采回落，判例 D1 修补）
perception-note: 「爽感是否足够」归真人 rubric
```

## 验收口径

- 每条通道五要素（trigger/form/duration/rate-limit/machine-check）齐备
- 通道 id ↔ spec acceptance ↔ 契约用例 ↔ 埋点事件 四方对齐（id 三方自洽机判）
- 表现层只读：任何通道不得改写内核状态（判例 ac-08 v1.3 同步修订断言组）
