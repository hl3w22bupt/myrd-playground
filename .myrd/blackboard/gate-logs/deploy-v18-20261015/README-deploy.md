# deploy-v18-20261015 —— wheat-squad 部署轮证据档案（v19 LIVE @ 0031d31）

> 轮次：R1 复测收口后部署轮（deploy-only）· 执行：游戏程序 · 日期：2026-10-15
> 结论：**v19 running/current，部署成功，线上自测全过**；证据仅对发布 commit `0031d3140ac3ffe8ec9b4387ecdf4503bb58d620` 有效。

## 01-verify-five-step.log —— 部署前门禁（games/wheat-squad/verify.sh 五步）

- ① 统一契约门禁（approved spec 对账）：**56 PASS / 0 FAIL**（spec approved 版链 v6 · 六段完整 · 实体符号锚 13 命中 · 关卡元素编号唯一 · 数值 25 组源就绪）
- ② 自有契约套件：**16 PASS / 0 FAIL / 1 PEND**（PEND = fv-pend 放置校准，设计内挂起；A1 1.71s · A2 P50=168.096s 20 局满 · A4 max 0ms/4 通道）
- ③ WS-SMOKE headless 全链路：PASS（打开→首操作→单局结束→重开 + 四事件埋点 + console 零错误）
- ④⑤ SCOPE-GUARD 双模式：PASS（本仓零越界 + 父仓足迹白名单）
- **VERIFY_EXIT=0**

## 02-deploy-post.json —— 部署 POST 落盘（重发那次的响应体）

## 03-app-state-after504.json —— 504 后坑位现状（关键证据）

- 首发部署 POST 代理侧 **HTTP 504（响应体空）**；未盲重试，先 GET 坑位：
  发现首条 POST 已被后端受理 → **v18 `cmv95gcje000em90xh5mucjyj` running @ `0031d31`**（commitHash 在档、路由分析 /health + / + /api/public/assets/:name、durationMs=822、零 errorMessage）
- 重发 POST → **v19 `cmv95h5mf000gm90xkzq4xrcm`**（同分支同字节）
- **事故定性：同内容重复部署，非内容分叉**；教训 = 部署 504 后必须先 GET 坑位现状再决定重试（已写 blockers 部署台账）

## 04-poll-*.json —— 部署状态轮询（v19 building → running/current，app=ready）

## 05-live-smoke.log —— 线上冒烟（tools/smoke-live.mjs · 缺省=黑板登记试玩入口）

- 目标 `https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw`
- ready ✓ `__G2WS_READY=true`（线上）· 操作 ✓ 击杀 2 · 结算 ✓ **victory elapsed=167s** · console/页面零错误
- **LIVE_SMOKE_EXIT=0**

## LIVE 三点自测（curl）

| 点 | 结果 |
|---|---|
| `/health` | HTTP 200（body 为共享壳 `server/` 静态身份串 `app=game-9` —— 壳 package 名即 game-9-server，所有坑同串，**非串线**；决定性反证见下两点） |
| `/` | HTTP 308 → `/apps/wheat-squad-2` |
| `/gw` | HTTP 200 · title=**麦浪小队**（landing.html 优先伺服生效，W-3 收口态维持） |
| `gw/api/public/assets/main.mjs` | HTTP 200 · md5 `ae62534dd4cbb7626f8175906882915b` ≡ 发布 build **逐字节** · 内嵌 `__G2WS_BUILD.gitSha=29e779b…` + `specAnchor=cmv8xcexk0009m9dj6ev1dj0r@v6:approved` |

## 部署前确定性重建（禁用仓内旧产物纪律）

- 自 v17 发布 commit `bcaa8f5` 起源面 diff：`assets/manifest.json`（美术元文档，src 零引用不进运行时）+ `ci/scope-policy.json` + `qa/qa-r1-recheck-v14.md`
- `G2WS_REPO_ONE_ROOT=<本 run 根> node tools/build.mjs` 重建 → `git diff build/` = **指纹单行**（gitSha `7b45b44…`→`29e779b…`），spec.json 与单源逐字节全等 → 零内容漂移实证，随后指纹重锚提交 `0031d31` 并 push 后发起部署
