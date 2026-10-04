# deploy-20261002 — 10/2 发布 commit 原始输出归档（N2③ · B3 闭合）

> 更新时间：2026-10-03 · 负责人：主策划（程序线代执行）· 下一步：QA round-2 复检时以此目录为对账基线

## 为什么有这个目录

R2 部署轮（2026-10-02）的 `blockers.md` 引用了 `gate-logs/deploy-20261002/`，但**该目录实际未建**——
发布轮的契约与冒烟原文散落在当时 run 的工作区，未随黑板归档。A 轮 N2③ 补齐，即 B3。

## 归档对象

| 项 | 值 |
|---|---|
| 归档的 commit（g2-blocks 源仓） | `0c3aa95`（部署轮重建 PWA 导出产物，= 线上 `g2-blocks-2` 实际产物） |
| 一号仓库发布 commit | `8d40c39`（首个可玩构建部署面）· `c389982`（部署落账） |
| liveUrl | `https://leomac-studio.tail49399e.ts.net/apps/g2-blocks-2/`（玩法入口 `/gw`） |
| 归档方式 | 在上述 commit 上**复跑并归档 stdout 原文**（含命令行 / gitRef / 钉值 / UTC 时间戳 / EXIT 码） |

## 文件

| 文件 | 内容 | 判定 |
|---|---|---|
| `02-contract-check.log` | `node scripts/contract-check.mjs` 原始输出 | **18 PASS / 0 FAIL · EXIT=0** |
| `03-smoke.log` | `node tools/smoke.mjs` 原始输出 | **SMOKE: PASS · EXIT=0 · J1=175.2ms ≤ 400ms** |

## 钉值披露（防兄弟 run 误锚）

本目录所有复跑显式双钉：

```
G2_SPEC_PATH=<本run>/.myrd/spec/g2-blocks/design-spec.json
G2_REPO_ONE_ROOT=<本run>
```

原因：`src/kernel/spec-source.ts` 与 `tests/contract/repo-one.mjs` 的兄弟 run 发现器在
**多 run 并存且 version 并列最高**时，并列 tie-break 落到任意候选 → 首跑实测 ac-17
输出 `root=run-cmuq9pz86…`（上一轮 run），即旧挂账 B10 同型问题复发。钉值后 ac-17
正确输出 `root=run-cmurp7sfe000ticcx6ddkrvca`。发现器 tie-break 修复挂账，见 blockers.md。

## 附带修正（判据零改动）

`tools/smoke.mjs` 末尾清理临时目录与 chrome 退出存在竞态：`rmSync ENOTEMPTY` 使**已判 PASS**
的冒烟以退出码 1 结束（门禁被误判失败）。修法 = 先杀浏览器进程并等退出、再删目录
（`maxRetries:3`），判定逻辑零改动。首跑（修前）全文已留档于本目录 git 历史，判定行为前后一致。

## 红线遵守

- stack-tower 线零接触（ac-17 白名单机判 PASS）
- 数值零改动（numeric 锚 `302e6336…` 全程不变，本目录两个门禁均在锚不变前提下复跑）
