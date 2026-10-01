# 拍板卡已发出：真机实测 / 明确豁免 二选一（2026-10-02）

> 目的：对两条外部依赖（①iOS Safari 真机实测 ②四问量表试玩回填）**停止第 5 轮重复邀请**，
> 改为促用户在二选一里拍板；两个选项如实呈现，不自动补齐、不伪造结果。

## 一、发卡前的可达性核实（为什么新建频道而不是用旧频道）

| 事实 | 证据 |
|---|---|
| 既有频道「光路谜阵 · 试玩反馈」(`cmuilmi19009im9gcqjh5yuns`) 对本执行身份**不可达** | `GET /api/v1/channels/cmuilmi19009im9gcqjh5yuns` → `403 FORBIDDEN 你不是该频道成员`；`POST …/members` → `403 没有权限添加成员` |
| 该频道非「不存在」而是「私有且非成员」 | 对照组：同类频道「疾风忍者跑 · 试玩反馈」(`cmuing61c001qm9l6ecie9g44`) 在频道列表可见且 `isMember=true`，证明列表机制正常、仅此频道不可达 |
| 结论 | 按「无可用既有频道」分支执行：以目标大师名义新建私有拍板频道 |

## 二、新建私有拍板频道

- **频道**：光路谜阵 · 真机实测与四问回填拍板
- **频道 id**：`cmupzmbdz009am9dhe3lqep77`（type=private）
- **createdById**：`cmt428ptv004bm9seap9ankcc`（= goalMasterId，目标大师名义）
- **成员**（创建返回体）：owner=`cmoqv70b80000m9d4b58k27zt`（MyRD Admin，目标 owner，自动入群）、member=`cmt428ptv004bm9seap9ankcc`；memberCount=2

## 三、决策卡内容（消息已入频道，2026-10-01T20:30:37Z）

两个选项如实呈现：

- **A. 3 分钟真机实测 + 一键回填**（5 下）：Safari 打开
  `https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?qa=1&tuning=1` → 点屏幕解锁声音 →
  玩 1 关 → QA 面板「自动扫描」→「分享/复制」拷贝 → 回频道粘贴 JSON →
  顺手「📋 试玩四问」7 项必答提交导出粘贴。
  卡内如实更新了线上状态：**线上已是 v19**（此前 3 缺陷：自动扫描 0 目标 / 量表提交不可达 /
  点击旋转失效，均已修复上线；WebKit 27/27 + 对抗 16/16 复跑全绿），
  比 `IPHONE_QA_CARD.md` v1.1 里标注的「v18 局限」新，完整 5 下路径当前可用。
- **B. 明确豁免**：回复「豁免」两字 → 目标按「外部依赖已留痕」收口，
  真机/试玩结论保持如实标注（审视结论上限 = 自动化达成、真机待验、试玩待回填），不再打扰。
- 尾注：两个选项都合法；不回复则待回收位保持敞开。

## 四、纪律声明

- 未回填任何量表答案、未生成任何实测数据；`qa/ios-safari-{report,survey}-PENDING.json` 待回收位原样保留。
- 用户在频道回复后，由后续回收节点按 `IPHONE_QA_CARD.md` / `PLAYTEST_KIT.md` 的回传协议归档；
  选 B 则由目标管理大师按「外部依赖已留痕」收口。

## 五、复现命令

```bash
# 建频道
curl -X POST -H "Authorization: Bearer $MYRD_TOKEN" -H "Content-Type: application/json" \
  "$PLATFORM_API_URL/api/v1/channels" \
  -d '{"name":"光路谜阵 · 真机实测与四问回填拍板","type":"private","memberIds":["cmoqv70b80000m9d4b58k27zt"],...}'
# 发卡
curl -X POST -H "Authorization: Bearer $MYRD_TOKEN" -H "Content-Type: application/json" \
  "$PLATFORM_API_URL/api/v1/channels/cmupzmbdz009am9dhe3lqep77/messages" --data @card.json
```
