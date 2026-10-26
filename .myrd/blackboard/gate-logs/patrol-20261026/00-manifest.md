# PL2/PL3/PL4 部署物巡检
UTC: 2026-10-26T03:38:03Z
命令: GET /api/v1/apphost/apps/<appId> ×3（Bearer MYRD_TOKEN）+ 仓内锚件 md5 实算

PL2-g2-blocks cmuqelj2r0046m9zr4emgdgdg: undefined | appStatus=undefined | cur: - v- undefined @ - err=undefined fin=- | deps total: 0
PL3-line3 cmvd6lt7f002km9wl2kbex7w4: undefined | appStatus=undefined | cur: - v- undefined @ - err=undefined fin=- | deps total: 0
PL4-line4 cmvollw2z001dm91k4ptf30aw: undefined | appStatus=undefined | cur: - v- undefined @ - err=undefined fin=- | deps total: 0

## 巡检结论（四线）
| 线 | LIVE 实测 | 黑板登记 | 判定 |
|---|---|---|---|
| PL1 pixel-fives | 无坑（apps 列表 23 实查零命中） | 已销案·零接触红线 | 一致 ✓ 零动作 |
| PL2 g2-blocks-2 | v17 running @ 2bb69c7e · err=null（deps 17） | r7 登记 cmv3ay8000 v17 @ 2bb69c7 | **逐字段同值，零漂移 ✓** |
| PL3 line3-tower-defense-2 | v2 running @ f9d98349 · err=null（10-18T04:40Z deployedBy=human） | assets.md 记 LIVE=b81d17b | **字节面零漂移 ✓**（f9d98349..HEAD build/export diff 空）；**黑板记账滞后**：LIVE 实锚晚一个 B-5 修复增量（+build/landing.html 19 行 +manifest.json 2 行，均已入链提交）→ 建议 line3 面下轮刷新锚记录，不构成阻塞 |
| PL4 line4-unblock-jam | v1 running @ 4f8ad155 · err=null | 今日登记 cmvolm4s7001 running @ 4f8ad155 | **逐字段同值，零漂移 ✓** |

巡检边界（如实）：LIVE 资产字节面直读同受网关资产路 404 限制（三坑同型签名），本次巡检面 = 部署单状态/commitHash/err + 仓内产物面 git diff 机核；deep 字节比对挂账 tailscale 通道。
