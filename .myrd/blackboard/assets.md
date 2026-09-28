# 资产清单黑板 — 《田园小院》

> 命名与 `games/farm-yard/.godot` 导入缓存中已有的资产一致（前序实现节点曾生成过），实现节点重新落码时**沿用此命名**，禁止另起名。

## 音频（spec §5，44.1kHz WAV，SFX 峰值 ≤ -6dBFS）

| 资产 | 类型 | 规格 | 状态 |
|---|---|---|---|
| `bgm_meadow.wav` | BGM | BPM 70~85 五声音阶循环，≈ -18 LUFS，-12dB | ⬜ 需随实现重新提交 |
| `plant.wav` | SFX | 播种 | ⬜ |
| `harvest.wav` | SFX | 收获（音高随解锁档 +0/1/2 半音） | ⬜ |
| `coin.wav` | SFX | 金币（连续入账 +1 半音阶梯 ≤5 级） | ⬜ |
| `upgrade.wav` | SFX | 升级/建造完成 | ⬜ |
| `confirm.wav` / `click.wav` | SFX | UI 确认/点击 | ⬜ |
| `fail.wav` | SFX | 余额不足（低音短促，不刺耳） | ⬜ |
| `cluck.wav` / `quack.wav` / `honk.wav` | Ambience/触发 | 禽舍鸡/鸭/鹅 | ⬜ |

## 美术与字体

| 资产 | 规格 | 状态 |
|---|---|---|
| `NotoSansSC-Regular.otf` | 正文字体，16/20/24px 三级 | ✅ 已在工程缓存（需随实现重新提交） |
| `icon.svg` / `index.png` / `index.icon.png` / `index.apple-touch-icon.png` | Web 导出图标 | ⬜ |
| 色板 | 见 spec §4.1（低饱和暖色 10 色） | 📋 已定义 |
| 假阴影 | 椭圆黑 α0.18，宽=实体×0.8 | 📋 已定义 |

> 说明：`.godot/` 导入缓存已加入 `.gitignore`，不进版本库；源资产必须随实现代码一起提交。
