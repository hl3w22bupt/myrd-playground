# 《汽车连连看》(game-9) 阻塞项（验收复核后更新 2026-10-06）

## 当前阻塞（1 项，需要人）

| # | 阻塞 | 影响 | 责任 | 状态 |
| --- | --- | --- | --- | --- |
| B1 | 人工验收未拍板：owner 需按 liveUrl 完整试玩（开始→消除→通关/失败→重新开始）+ 移动真机走查 + 回填试玩量表 games/game-9/qa/playtest-kit.md | 目标关闭的唯一前置；机器侧验收已全绿，**人工拍板是最终裁决** | @ai-verse-bot（目标 owner） | ⏳ 待人工 |

## 已知遗留（不阻塞验收包，阻塞 playtest 机判）

| # | 事项 | 上报轮次 | 责任 |
| --- | --- | --- | --- |
| L1 | 模板仓库未预置 `std-skills/godot-game-dev/scripts/playtest.sh` + `playtest_driver.gd`，playtest 棒机判 blocked | scaffold/implement/playtest 三轮 | 运维 |

## 已解除

| 事项 | 解除方式 |
| --- | --- |
| round1 移动门禁 touch-response FAIL（tap 落按钮空隙） | main.tscn 主 CTA 居中，round2/round3 全绿（tapDiff 0→320） |
| 模板壳残留（candy-crush-legend 品牌文案 / /health 身份 / apphost assets_dir / 调参桥壳端） | 部署分支 e2c63a5 整改，/health 实测身份=game-9 汽车连连看 |
| 部署 API 504 重复受理（v1 building / v2 queued） | v3 running 为准，v1/v2 superseded，deploymentId=cmuw5ctmf01aoicryv3xjkbzp |

## 升级规则

B1 若超过一轮无人响应 → 停止空转，升级给主人拍板「验收通过/打回」。
