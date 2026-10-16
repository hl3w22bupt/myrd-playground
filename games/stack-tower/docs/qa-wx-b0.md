# QA 回执 — B0 微信小游戏移植轮三轨门禁（2026-09-28）

> 出品：QA 线（T5）· 对象：spec v1.3（平台 v5 `cmukkjc10001ym9nb3dnc5kt6` approved）+ N2 交付面（commit `d559752` / `f5d13fb`）
> 结论：**可机跑面全绿（六条拒绝线零命中）→ 提审包 ready；真机轨 BLOCKED（AppID 未到位，红线不执行不造假）→ 升级主人；是否提审由主人拍板**

## 一、三轨结果

### 轨1 · web 回归轨 —— **PASS（零行为变化）**
| 门禁 | 结果 | 证据 |
|---|---|---|
| typecheck（含 wx 四新文件） | exit 0 | `web-regression/2-typecheck.log` |
| 契约全量 run-all（v1.2 四判据 + 31 条） | **PASS 31 / FAIL 0 / not-runnable 0** | `web-regression/1-run-all.log` |
| P0 资产查表（霓虹 13 件） | exit 0 | `web-regression/3-assets-neon-check.log` |
| 端到端冒烟（browser，零页面错误） | PASS | `web-regression/4-smoke.log` |
| web 链路源码触碰面 | **零**（git status：既有 tracked 文件零改动，全部为新增文件） | commit `d559752`/`f5d13fb` diff |

### 轨2 · wx devtools 轨（可机跑面）—— **PASS（6/6 聚合）**
| 门禁 | 结果 | 证据 |
|---|---|---|
| wx-runtime-surface（16 断言） | PASS | `wx-track/1-wx-runtime-surface.log` |
| wx-share-loop（12 断言，主判据 5:4 卡就绪） | PASS | `wx-track/2-wx-share-loop.log` |
| wx-open-data-rank（11 断言，token 单源） | PASS | `wx-track/3-wx-open-data-rank.log` |
| wx-submission-kit（13 断言，材料 id 三向一致） | PASS | `wx-track/4-wx-submission-kit.log` |
| **bgm-loop wx 冒烟（14 断言）** | **PASS（有 wx 结果）** | `wx-track/5-bgm-loop-wx.log` |
| 平台素材查表（7 id） | PASS 7/7 | `wx-track/6-assets-wx-check.log` |
| check-wx-bundle-size（分列） | PASS（主包 317.8KB≤4MB / 子包 5.7KB≤1MB） | `wx-track/7-bundle-size.log` |
| check-numeric-freeze（只复算 N1 存档，三向对账） | PASS | `wx-track/8-numeric-freeze.log` |
| 聚合 run-wx-gate | PASS (6/6) | `wx-track/0-run-wx-gate.log` |

### 轨3 · 真机轨（Android+iOS 各一台）—— **BLOCKED（升级主人，不造假）**
- 前置缺口：①正式 **AppID** 未下发（现为测试号 touristappid）；②微信开发者工具 **CLI 未安装**（/Applications 无 wechatwebdevtools.app，2026-09-28 开工首笔实查）；③真机设备不在本执行环境。
- 挂起清单（AppID + 工具到位后复跑）：BGM onShow/onHide 真机表现 / 静音键（含系统静音开关 obeyMuteSwitch）/ 首触解锁听测 / **会话分享卡片实收**（主判据的真机最终面）/ 朋友圈附带项实收 / 开放数据域真机渲染。
- 处置依据：任务书红线「真机轨与提审不造假数据」——本轨不产生任何代用证据，结构门禁（轨2）不冒充真机结论。

## 二、六条拒绝线逐条判定（任一命中即 reject）

| # | 拒绝线（原文） | 判定 | 依据 |
|---|---|---|---|
| 1 | numeric sha256 不一致 | **未命中** | check-numeric-freeze 三向对账 PASS（存档 `c3af773b…74957d` ≡ 现行 ≡ v1.2） |
| 2 | 差集非空 | **未命中** | spec 四段（world/entities/levels/numeric）vs v1.2 深比差集为空（N1 建版守卫 + N1.5 QA 独立复算双通道）；web 契约 31/31 与 r4 基线差集为空 |
| 3 | bgm-loop 无 wx 结果 | **未命中** | `bgm-loop-wx.spec.mjs` 14 断言 PASS——被测对象 = export/wx/build-wx 编译产物（与真机同一份代码），调度连续性/静音/解锁/onShow/onHide 全绿 |
| 4 | 超预算 | **未命中** | 主包 317.8KB ≤ 4MB、开放数据域 5.7KB ≤ 1MB，分列断言双 PASS（禁合并口径） |
| 5 | web 回归失败 | **未命中** | run-all 31/31 PASS + 四判据全绿 + 零页面错误冒烟 |
| 6 | 条目缺落点或缺 check | **未命中** | 四条目 15 件落点全部具名，4 个 check 全部可执行且本轮实跑全绿 |

## 三、已知未收口项（如实单列，不计红）

1. **U-B0-1 真机轨**（本回执轨3）：AppID + 类目/资质 + devtools CLI 三缺，升级主人。
2. **U-B0-2 朋友圈实收**：附带项（不作为放行判据），真机到位后随 U-B0-1 复跑。
3. **U-B0-3 素材件数差**：任务书「8 项」vs 定稿 id 清单 7 项，差额待主人指认增补 id（N1 已登记，不擅自新编）。
4. **U-a7 沿账**：acc-a7 check 指向 `tests/audio/events.test.ts`（D4 冻结件）仓库仍不存在——v1.2 既挂账沿用，spec v1.3 未触碰（acceptance 32 条零增改）。
5. **U-B0-4 「好不好玩」**：开放数据域/分享/BGM 的体验面属人工验收范畴——机器门禁只证结构与契约，不替人判断。
