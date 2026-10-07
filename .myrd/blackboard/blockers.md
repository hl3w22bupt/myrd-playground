# 《线上抓娃娃机》(game-11) 阻塞项（画质 v2 验收后更新 2026-10-07）

## 当前阻塞（1 项，需要人）

| # | 阻塞 | 影响 | 责任 | 状态 |
| --- | --- | --- | --- | --- |
| B1 | 人工验收未拍板（v2 轮新增第 1 步）：①画质走查——桌面浏览器（真 GPU 自动 HIGH 档）看辉光/雾效/反射/文字锐度（`?dpr=3` 对比），真机体感帧率；②试玩 1–2 局回填量表 games/game-11/qa/playtest/PLAYTEST_KIT.md | 目标关闭的唯一前置；画质 v2 机器侧三专项证据已闭环（qa/ACCEPTANCE_REVIEW_V2.md），**人工拍板是最终裁决** | @MyRD Admin（目标 owner） | ⏳ 待人工 |

## 已知遗留（不阻塞验收，已披露）

| # | 事项 | 责任 |
| --- | --- | --- |
| L1 | spec ↔ 实现 5 处差异（引擎栈 Godot vs Three.js+cannon-es、娃娃名单分档、90s vs 75s、开局币 10 vs 5、相机限位口径）已如实披露于 PLAYTEST_KIT §3；是否接受由人工验收判定，引擎段修订需走 spec revisions（version+1） | 主策划下一轮 |
| L2 | playtest 种子 20260914 首奖励 9.88s 贴近 10s 阈值（确定性路径）；如试玩反馈节奏偏慢，用 `?tuning=`（claw_speed/drop_speed/round_seconds 等 7 键）走 spec.numeric 修订 | 主策划下一轮 |
| L3 | 验收复核 token 对 apphost 读接口按属主收敛（403），部署记录详情无法直查；标识采信「平台下发参数 + 工作流运行记录 + 线上网关实测」三角一致 | 平台（权限口径，非缺陷） |
| L4 | 画质 v2 spec↔实现已披露差异：hidpi spec dpr_max=3 vs 真 GPU 钳 2；MSAA spec 桌面 4x/移动 2x vs 统一 2×——若人工验收认定须对齐，走 spec revisions（version+1），禁止两头各改 | 主策划下一轮 |
| L5 | 真机 ≥30fps 红线无法机判（门禁为 SwiftShader 口径 ≥8，实测 17）；真机帧率数据只能 owner 体感回填 | 目标 owner |
| L6 | 画质数值不进 ?tuning 面板（只覆盖 7 玩法键）；试玩指向画质数值 → spec.numeric.rendering/materials 修订 | 主策划下一轮 |

## 已解除

| 事项 | 解除方式 |
| --- | --- |
| 功能分支落后部署分支 7 提交（缺移动端修复/重导出/QA 证据），后续节点有基于陈旧代码工作的风险 | 验收复核节点 `git merge --ff-only` 快进对齐 `bffad6b` |
| 「线上=仓库」无直接证据 | index.js / index.pck sha256 指纹比对逐字节一致（qa/ACCEPTANCE_REVIEW.md §2） |
| 移动门禁仅部署节点单轮实跑 | 复核节点独立复跑 round4，与 round3 双轮 PASS 10/10（跨 2 小时结论一致） |
| 画质 v2 分支（4528083）落后远端 v2 实现 7 提交 | v2 验收节点 `git merge --ff-only` 快进对齐 `eac331b` |
| 「线上=v2 构建」需实证 | v2 验收节点线上 pck 解码 sha256=`603865ed03dc…` 与 HEAD 导出逐字节一致 + 壳页 v2 特征（__SOFT_RENDER__/CAPPED_DPR）在场（ACCEPTANCE_REVIEW_V2 §2） |
| v2 移动门禁仅部署/试玩节点实跑 | v2 验收节点独立复跑 round5，与 round2 双轮 PASS 10/10、同 fps=17（跨 24 分钟一致） |
| headless `Parameter "m" is null` 刷屏 | Godot 4.3 哑渲染器固有日志，门禁只断言 SCRIPT ERROR/Parse Error，不受影响（已知非缺陷） |

## 升级规则

B1 若超过一轮无人响应 → 停止空转，升级给主人拍板「验收通过/打回」。
