# R1 复测收口轮 · 部署台账（2026-10-15 · deploy · v17 LIVE）

> 四要素：命令 / UTC / 退出码 / 工作区根。坑沿用不新建：appId `cmv36wl94001xm9mxp119q48x`（wheat-squad-2 · sourceId=wheat-squad 绑定复用）。

| 版本 | 部署单 | commit | 结果 | 说明 |
|---|---|---|---|---|
| v16 | `cmv8xs3os000cm9d…`（running→被接管） | `813fa38` | ⚠️ **坏部署（程序线操作缺陷，如实披露）** | POST 漏传 `manifestPath` → 平台按仓库根 apphost.toml（= game-9 清单，assets_dir=games/game-9/export/web）打包 → 线上面短暂呈 game-9 资产（/health app=game-9 · wheat 资产 404）。根因 = 未复用兄弟判例的完整请求体（兄弟轮 v14/v15 均带 manifestPath）。 |
| **v17** | `cmv8xviav000em9d…` **running/current** | `813fa38` | ✅ 正确 | 补 `manifestPath: games/wheat-squad/apphost.toml` 重部署（同 commit）→ 504 截断（判例）→ GET 复查已受理（building→running，errorMessage=null）→ **LIVE 三点全过**（见下） |

## v17 LIVE 三点复测（2026-10-15）

1. **壳面**：`GET /gw` → 200 · title=麦浪小队 ✓（W-3 landing 解析保持）
2. **字节全等**：`GET api/public/assets/main.mjs` md5 `6b3e349acf3a553699e240b03e81635b` ≡ 发布 commit `813fa38` build/main.mjs **逐字节全等** ✓
3. **指纹对账（本轮 sha 注入基建首秀）**：LIVE `__G2WS_BUILD = {"gitSha":"7b45b44072747ca17af96f81dd109b926745f3d4","specAnchor":"cmv8xcexk0009m9dj6ev1dj0r@v6:approved"}` —— **内嵌 gitSha ≡ 复测报告绑定 sha（`docs/r1-recheck-report.md`）** ✓ · specAnchor = 链 v6 approved ✓
4. **WS-LIVE-SMOKE**：`node tools/smoke-live.mjs` → **PASS**（ready ✓ 拖动击杀 2 → victory 167s 结算 → console 零错误）· `10-live-smoke-v17.log`

## sha 对账链条（本轮闭环陈述）

```
复测报告绑 7b45b44（受测源面 commit，采样时 HEAD）
  ≡ LIVE __G2WS_BUILD.gitSha（v17 部署物内嵌，可线上自证）
  + git diff 7b45b44..813fa38 -- src tests assets .myrd/spec = 空（源面等价证明：发布 commit 相对源面仅 docs/黑板/注入基建本身）
  + LIVE main.mjs md5 ≡ 发布 commit build 逐字节（三点复测②）
⇒ 「线上部署物构建指纹 ↔ 修复批 HEAD sha」对账闭环（v1.4 retestProtocol① 绑 sha 纪律落地）
```

- 构建语义（防混）：`build/` 内嵌 gitSha = **受测源面 commit**（复测绑定点）；发布 commit 与其差异面 = docs/黑板/日志/注入基建（构建自指性的单行滞后不变量，已 diff 实证仅 `__G2WS_BUILD` 一行差异）。
- 通道实录：两次 POST 均 504@30s 截断（平台判例形态）→ 各 GET 复查确认已受理，未盲目重发。
- **线上现状**：wheat-squad-2 = v17 LIVE @ `813fa38`（证据绑 sha，A3 真人试玩采集面即此字节）；game-9 坑（其自身 goal 线）本轮零接触——v16 坏部署仅覆盖 wheat-squad-2 坑的对象存储键，已由 v17 以正确清单覆盖修复。
