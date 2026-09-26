# 《光路谜阵》音效配方（程序化合成）

> `autoload/juice.gd` 的 `SFX_BANK` 指向 `assets/sfx/*.wav`；四个短音效由本页配方
> 以 Python 一段式合成（22050 Hz / 16-bit mono / 峰值 ≤ 0.5，attack 8ms + 60% release
> 防爆音），无外部素材、无版权负担。要换风格 = 按配方重跑脚本替换 wav 即可。

| 名 | 波形 | 时长 | 用途（挂点见 main.gd） |
|---|---|---|---|
| `confirm` | 880 Hz 正弦单音 | 0.07s | 旋转生效（核心交互，每次旋转即反馈） |
| `score` | C5+E5 双正弦叠置 | 0.20s | 通关结算 / 全部通关提示 |
| `hit` | 220→140 Hz 下滑正弦 | 0.09s | 撤销成功 / 重开本关 |
| `fail` | 330→247 / 247→185 Hz 双声部下滑 | 0.16s | 撤销不可用 / 未解锁关被拒 |

合成参数（与生成脚本一致的口径）：

- `env(t) = min(1, t/0.008) × min(1, (dur−t)/(dur×0.6))`（attack × release 包络）
- 叠置声部按 `1/(声部序号)` 衰减后取均值，防 clipping
- `slide=[from, to]`：频率随 `t/dur` 线性滑移

Web 端出声依赖壳页的音频手势解锁（部署线 `server/` 已带，首次触点后恢复 AudioContext）。
headless 门禁只验证 `Juice.feedback_fired` 事件流，不依赖声音设备。
