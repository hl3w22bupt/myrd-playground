# 真机实测归档位（iOS Safari）

> 本目录是 `../ios-safari-checklist.md` 的**结果落点**，创建时为空（占位）。
> 真机执行者按清单 C1–C12 完成后：证据文件放本目录，结果表复制下文模板填好，
> 存为 `results-<日期>.md` 并随代码一并提交。

## 文件命名规则

| 类型 | 命名 | 例 |
|---|---|---|
| 整轮录屏 | `rec-<机型>-<iOS>.mov` | `rec-iphone13mini-ios18.mov` |
| 单项截图 | `c<编号>-<机型>-<说明>.png` | `c5-iphone13mini-二段跳跨坑.png` |
| 结果表 | `results-<YYYY-MM-DD>.md` | `results-2026-10-01.md` |

（文件名出现 `/` 等非法字符时用 `-` 替代；系统大版本相同可省小版本号。）

## 结果表模板（复制到 results-<日期>.md 填写）

```markdown
# 真机实测结果 · <YYYY-MM-DD>

## 环境登记
- 机型：
- iOS / Safari：
- 网络：
- 静音键 / 音量：
- 省电模式：
- 入口 URL：https://leomac-studio.tail49399e.ts.net/apps/game-3/
- （如用了调参 URL，把完整 URL 贴在这里，参数含义见 ../tuning-params.md）

## 逐项结论
| 项 | 结论(pass/partial/fail/skip) | 证据文件 | 一句话现象 |
|---|---|---|---|
| C1 冷加载 |  | rec-….mov | 加载总耗时 __s |
| C2 失败兜底 |  | （可 skip） |  |
| C3 横竖屏 |  | c3-….png |  |
| C4 点按起跳 |  | rec-….mov |  |
| C5 二段跳/防三段 |  | c5-….png |  |
| C6 土狼时间 |  | rec-….mov |  |
| C7 跳跃缓冲 |  | rec-….mov |  |
| C8 首次手势出声 |  | rec-….mov |  |
| C9 打断恢复 |  | rec-….mov |  |
| C10 帧率 |  | rec-….mov | 省电开/关各记一行 |
| C11 发热 |  | — | 5 分钟主观等级 |
| C12 长跑与重开 |  | c12-….png |  |

## 手感定稿建议（C4–C7 若调过参）
- 试过的调参 URL：
- 结论（回写默认常量建议，供后续实现节点改 player.gd）：

## 遗留问题
- （fail/partial 项的复现步骤与频率）
```

## 口径提醒

- 本目录只收**真机**结果；CDP 仿真证据在 `../cdp-precheck/`（已完成，口径不同，勿混放）。
- `skip` 必须注明理由（如 C2 需要资产通道异常才能触发）。
- 结果回写后，若有 fail 项，交由目标大师分派修复节点；手感数值类结论直接走
  `../tuning-params.md` 的定稿流程。
