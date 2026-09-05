---
name: run-node-safe-command-execution
description: 在自动化 run / dev-test / 代码审查 / 安全节点上安全执行一次性命令，避免常驻或交互式进程导致 Worker SIGINT 挂起与空输出失败。
---

# 自动化节点安全执行命令（防 SIGINT 悬挂）

## 目的
自动化 run 节点的高频失败是 Worker SIGINT 关闭中断：命令常驻不退出，Worker 被强杀，轨迹无输出被标 failed。本技能提供一套在任何自动化节点上安全执行命令的可复用 SOP，让每次命令都能在有限时间内退出并带回可读的退出码与结果。

## 适用场景
- 在 dev-test / code-review / security 等自动化节点上执行安装、构建、测试、服务验证
- 任何必须保证「命令能退出」的一次性任务
- 需要验证本地服务可访问但不得常驻服务器的场景

## 完整步骤
1. 危险命令识别：列出待执行命令，凡属于 server/listen/watch/interactive（dev、start、watch、serve、nodemon、REPL）都标记为危险，替换为一次性等价物。
2. 非交互化：统一追加 `CI=1`、`--no-input`、`--non-interactive`、`-y`；确认没有 stdin 提示。
3. 超时包裹：所有可能耗时/挂起的命令用 `timeout <秒> cmd` 包裹；超时退出码为 124，须在结果中注明「超时」而非「业务失败」。
4. 服务验证：`timeout 30 curl -fsS http://127.0.0.1:<port>/health && echo OK` 或 `wget -qO-`，用 HTTP 状态与 curl 退出码判定，而不是启动 server。
5. 必须后台时：`setsid <cmd> &` 记录 PID，用 `timeout` 限制生命周期，任务结束前 `kill <PID>` 并确认 `ps` 无残留。
6. 结果上报：输出命令清单（命令→期望行为→退出码），附最终结果摘要；无任何输出时必须说明中断原因。
7. 失败处置：先按退出码分类（124/SIGINT=中断，非零=业务失败），中断类优先排查常驻/交互，业务失败才修正代码重试；禁止盲试。

## 示例
任务：构建前端并验证产物可访问。
```bash
# 1) 构建（非交互 + 超时）
CI=1 timeout 600 npm run build
BUILD=$?
echo "BUILD exit=$BUILD"
# 2) 用 http 服务器做一次性验证（限定生命周期）
timeout 30 python3 -m http.server 8099 --directory dist &
SRV=$!
sleep 2
timeout 20 curl -fsS http://127.0.0.1:8099/index.html; CURL=$?
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null
echo "CURL exit=$CURL"
# 3) 清理确认
ps -ef | grep "http.server 8099" | grep -v grep || echo "no residual"
exit $(( BUILD == 0 && CURL == 0 ? 0 : 1 ))
```

## 注意事项
- dev-test / code-review / security 共用 Worker，本纪律对所有自动化节点生效。
- 空输出 + failed = 先怀疑中断/常驻，不要当成业务失败去改代码。
- 若发现残留进程导致端口冲突（如 EADDRINUSE），先 `kill` 残留再绑定。
- 用 `timeout` 与 `--no-input` 双保险，防交互进程吞掉超时。