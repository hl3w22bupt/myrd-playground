# 《3D 切苹果》(3d) 阻塞项（主策划线上复核后更新 2026-10-08）

## 当前阻塞（1 项，需要人）

| # | 阻塞 | 影响 | 责任 | 状态 |
| --- | --- | --- | --- | --- |
| B1 | 人工验收未拍板：owner 按 liveUrl 试玩并回填 `games/3d/qa/playtest-kit.md` 四问量表（入口 https://leomac-studio.tail49399e.ts.net/apps/3d/ ，调参 `?tuning=1`） | 目标关闭的唯一前置；机器侧四门禁已由主策划独立复跑全绿 + 线上 pck 字节一致（qa/ACCEPTANCE_REVIEW.md），**人工拍板是最终裁决** | @MyRD Admin（目标 owner） | ⏳ 待人工 |

无其它阻塞；无升级项（本轮复核一次通过）。

---

# 《汽车连连看》(game-9) 阻塞项（第三轮线上版复核后更新 2026-10-07）

## 当前阻塞（1 项，需要人）

| # | 阻塞 | 影响 | 责任 | 状态 |
| --- | --- | --- | --- | --- |
| B1 | 人工验收未拍板：owner 需按 liveUrl 完整试玩（开始→消除→通关/失败→重新开始）+ 移动真机走查 + 回填试玩量表 games/game-9/qa/playtest-kit.md（四问） | 目标关闭的唯一前置；机器侧验收已全绿且第三轮独立复跑可复现（GODOT_PLAYTEST 两档 + round6 移动门禁），**人工拍板是最终裁决** | @ai-verse-bot（目标 owner） | ⏳ 待人工（第三轮复核已备好指引：qa/ACCEPTANCE_REVIEW_ROUND3.md §六） |

## 已知遗留（不阻塞验收包与 playtest 机判）

| # | 事项 | 上报轮次 | 责任 |
| --- | --- | --- | --- |
| L2 | 工作流调度 API 迭代通道不可用（任务载明 403：目标大师非项目成员；本轨迹实测 iterate 端点 400 缺 startNodeId）——正式工作流结论待权限补齐后从 implement 补跑 | 迭代 v5 轮 | owner/运维 |
| L3 | goal artifacts API 直写被拒：`GET /api/v1/goals/cmuw2o88z018ricryvpr6v8wn` 403（本轨迹 2026-10-07 实测复现，与第二轮复核同因）；待落账 JSON 已备 qa/ACCEPTANCE_REVIEW_ROUND3.md §四，有 owner 凭据者一键落账（hosted_app 原位更新 v5 + playtest 第三轮判定） | 第二轮复核上报、第三轮复核复现 | owner/运维 |

## 已解除

| 事项 | 解除方式 |
| --- | --- |
| L1 模板仓库未预置 `playtest.sh` + `playtest_driver.gd`（playtest 棒三轮 blocked） | 运维已补入模板仓库；v5 迭代复跑核验在库且 GODOT_PLAYTEST PASS 两档（900 帧 fb=75/80/76、5400 帧 fb=517/483/518，详见 qa/playtest-round2/） |
| round1 移动门禁 touch-response FAIL（tap 落按钮空隙） | main.tscn 主 CTA 居中，round2/round3 全绿（tapDiff 0→320） |
| 模板壳残留（candy-crush-legend 品牌文案 / /health 身份 / apphost assets_dir / 调参桥壳端） | 部署分支 e2c63a5 整改，/health 实测身份=game-9 汽车连连看 |
| 部署 API 504 重复受理（v1 building / v2 queued） | v3 running 为准，v1/v2 superseded；当前线上=v5 cmuwqrrl70051m9lgj8v89gh9 @ 游戏代码 2626927（第三轮复核字节级复测证实，2026-10-07） |
| GODOT_PLAYTEST: PASS 可信度（单次留证 → 跨轨迹复现） | 第三轮复核独立复跑四门禁全绿，playtest 三局指标与 round2 归档逐字一致（qa/playtest-round3/） |

## 升级规则

B1 若超过一轮无人响应 → 停止空转，升级给主人拍板「验收通过/打回」。
