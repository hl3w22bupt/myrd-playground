# 阻塞项黑板 — line4-unblock-jam（第四产品线）

> 更新时间：2026-10-24 ｜ 负责人：主策划（整合）｜ 下一步：spec v0 入链 → QA 七条缺陷核销 → 转主人正式审查（approve 归主人）

## 当前基线（2026-10-24 · 本轮开工）

| 项 | 值 |
|---|---|
| 黑板路径 | `.myrd/blackboard/line4-unblock-jam/`（三件套，本轮新建 · **黑板登记块名写死于此**，spec 缺陷⑥核销锚点） |
| spec 版本号 | v0 执笔中 → 经 game-design-specs 接口入链为链 v1 draft（禁覆盖）；**审查通过前不作契约输入** |
| 当前分支与续接 | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `8d345e6`；`git fetch origin` 完成，远端仅 `origin/main`（无 `game/line4-unblock-jam` → 首并无对象），origin/main @ `9fbc1dc` 孤儿快照线 merge-base=∅ → 沿 10/16 判例不并入，无 rebase |
| 平台 API | `http://localhost:3111` 可达（/api/v1/health 200 · 本轮实测）；鉴权 `MYRD_TOKEN` Bearer 实查通过 |
| 产线 | ts-canvas 判例平移 · 零外部贴图 · 零 npm 依赖 |

## 阻塞登记（编号制）

| # | 事项 | 负责人 | 状态/解除判据 |
|---|---|---|---|
| L4-1 | **spec v0 正式审查（approve）** | 主人 | QA 七条缺陷核销后转正式审查即升级；approve 前零玩法逻辑零 contract 断言（红线） |
| L4-2 | 工作名与视觉方向拍板（W-L4-1/W-L4-2） | 主人 | 《挪出一条路》为工作名占位；风格卡 v1 已冻结（拍板可改，改动走 revision） |
| L4-3 | a3 真人面（好玩终裁 5 名真人） | 主人+QA | 前置=可玩面 LIVE；机器不代采 |

> 无团队侧阻塞。以上三项均主人侧动作，带证据升级不催办。
