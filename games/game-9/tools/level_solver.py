#!/usr/bin/env python3
"""game-9 关卡可解性验证器（AC4 证据，开发期工具 —— 不是门禁，不参与 GODOT_SMOKE 判定）。

直接解析 scripts/sokoban_levels.gd 里落盘的关卡数据（单一事实源，避免两处数据漂移），
用推箱求解器验证：每一关都存在至少一条通关路径，并给出最优玩家步数。

- 前三关（状态空间小）用 BFS；状态空间大的关卡用 A*（启发值 = 每个方块到最近接线槽的
  「拉拽距离」下界，可采纳），并做简单死格剪枝（角死锁 / 墙边不可拉出的格子）。
- 求得的最优玩家步数与策划案 spec.numeric.difficulty.parMoves 一致时输出 par=一致；
  不一致只告警（说明布局或 par 有漂移），可解性仍是硬判据。

用法：
    python3 tools/level_solver.py [工程目录]      # 默认当前目录

退出码：0 = 全部关卡可解；1 = 存在不可通关关卡（AC4 违约）。
"""

from __future__ import annotations

import heapq
import re
import sys
from collections import deque
from pathlib import Path

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))
MOVE_CHARS = ("U", "D", "L", "R")  # 与 DIRS 一一对应：上 / 下 / 左 / 右
EXPANSION_CAP = 4_000_000
MAX_DEPTH = 200


def parse_layout(text: str):
    """ASCII → (墙, 接线槽, 方块, 玩家)。编码与 SokobanBoard.setup 一致。"""
    walls: set = set()
    targets: set = set()
    boxes: set = set()
    player = None
    for y, line in enumerate(text.split("\n")):
        for x, ch in enumerate(line):
            cell = (x, y)
            if ch == "#":
                walls.add(cell)
            elif ch == "$":
                boxes.add(cell)
            elif ch == "*":  # 兼容「方块已在槽上」的标准推箱编码
                boxes.add(cell)
                targets.add(cell)
            elif ch == "@":
                if player is not None:
                    raise ValueError("关卡里有多个玩家 @")
                player = cell
            elif ch == "+":  # spec 编码：+ 只表示接线槽，不叠加玩家
                targets.add(cell)
            elif ch == ".":
                pass
            else:
                raise ValueError(f"未知布局字符 {ch!r} @ {cell}")
    if player is None:
        raise ValueError("关卡缺少玩家 @")
    return walls, targets, frozenset(boxes), player


def alive_squares(walls, targets) -> set:
    """简单死格剪枝：从接线槽反向「拉」可达的格子才有活路。"""
    alive = set(targets)
    frontier = deque(targets)
    while frontier:
        cell = frontier.popleft()
        for dx, dy in DIRS:
            src = (cell[0] - dx, cell[1] - dy)
            stand = (cell[0] - 2 * dx, cell[1] - 2 * dy)
            if src in walls or src in alive or stand in walls:
                continue
            alive.add(src)
            frontier.append(src)
    return alive


def solved(boxes, targets) -> bool:
    return boxes & targets == targets and len(targets) > 0


def reconstruct(parents: dict, state) -> str:
    """沿父指针回溯到初始态，得到玩家移动串（U/D/L/R）。"""
    moves: list = []
    while state in parents:
        state, move = parents[state]
        moves.append(move)
    return "".join(reversed(moves))


def solve_bfs(walls, targets, boxes, player, want_path: bool = False):
    """BFS 求最优玩家步数；want_path=True 时额外返回移动串（父指针回溯）。"""
    alive = alive_squares(walls, targets)
    if not boxes <= alive:
        return None, 0, None
    parents: dict = {} if want_path else None
    seen = {(player, boxes)}
    queue = deque([(player, boxes, 0)])
    expanded = 0
    while queue:
        pos, cur, depth = queue.popleft()
        expanded += 1
        if expanded > EXPANSION_CAP or depth >= MAX_DEPTH:
            return None, expanded, None
        if solved(cur, targets):
            return depth, expanded, (reconstruct(parents, (pos, cur)) if want_path else None)
        for index, (dx, dy) in enumerate(DIRS):
            nxt = (pos[0] + dx, pos[1] + dy)
            if nxt in walls:
                continue
            nboxes = cur
            if nxt in cur:
                dst = (nxt[0] + dx, nxt[1] + dy)
                if dst in walls or dst in cur or dst not in alive:
                    continue
                nboxes = frozenset((cur - {nxt}) | {dst})
            state = (nxt, nboxes)
            if state in seen:
                continue
            seen.add(state)
            if parents is not None:
                parents[state] = ((pos, cur), MOVE_CHARS[index])
            queue.append((nxt, nboxes, depth + 1))
    return None, expanded, None


def solve_astar(walls, targets, boxes, player, want_path: bool = False):
    alive = alive_squares(walls, targets)
    infinity = 10 ** 9
    pull_dist = {cell: infinity for cell in alive}
    frontier = []
    for target in targets:
        if target in pull_dist:
            pull_dist[target] = 0
            frontier.append(target)
    while frontier:
        cell = frontier.pop()
        for dx, dy in DIRS:
            src = (cell[0] - dx, cell[1] - dy)
            stand = (cell[0] - 2 * dx, cell[1] - 2 * dy)
            if src in walls or src not in pull_dist or stand in walls:
                continue
            if pull_dist[src] > pull_dist[cell] + 1:
                pull_dist[src] = pull_dist[cell] + 1
                frontier.append(src)

    def heuristic(boxes_) -> int:
        return sum(pull_dist.get(box, infinity // 2) for box in boxes_)

    if heuristic(boxes) >= infinity // 2:
        return None, 0, None
    best = {(player, boxes): 0}
    came: dict = {} if want_path else None  # state -> (父 state, 移动字符)
    queue = [(heuristic(boxes), 0, player, boxes)]
    expanded = 0
    while queue:
        _, cost, pos, cur = heapq.heappop(queue)
        expanded += 1
        if expanded > EXPANSION_CAP:
            return None, expanded, None
        if solved(cur, targets):
            return cost, expanded, (reconstruct(came, (pos, cur)) if want_path else None)
        if best.get((pos, cur), infinity) < cost:
            continue
        for index, (dx, dy) in enumerate(DIRS):
            nxt = (pos[0] + dx, pos[1] + dy)
            if nxt in walls:
                continue
            nboxes = cur
            if nxt in cur:
                dst = (nxt[0] + dx, nxt[1] + dy)
                if dst in walls or dst in cur or dst not in alive:
                    continue
                nboxes = frozenset((cur - {nxt}) | {dst})
            nxt_cost = cost + 1
            state = (nxt, nboxes)
            if best.get(state, infinity) <= nxt_cost:
                continue
            best[state] = nxt_cost
            if came is not None:
                came[state] = ((pos, cur), MOVE_CHARS[index])
            heapq.heappush(queue, (nxt_cost + heuristic(nboxes), nxt_cost, nxt, nboxes))
    return None, expanded, None


def load_levels(project_dir: Path):
    """从 scripts/sokoban_levels.gd 解析关卡数据（id / par_moves / layout）。"""
    source = (project_dir / "scripts" / "sokoban_levels.gd").read_text(encoding="utf-8")
    entries = re.findall(
        r'\{\s*"id":\s*"([^"]+)",\s*"name":\s*"[^"]*",\s*"par_moves":\s*(\d+),'
        r'\s*"grid":\s*"[^"]*",\s*"layout":\s*"([^"]*)"',
        source,
    )
    if not entries:
        raise SystemExit("未能从 scripts/sokoban_levels.gd 解析到关卡数据")
    return [(level_id, int(par), layout.encode().decode("unicode_escape")) for level_id, par, layout in entries]


def replay(layout: str, moves: str) -> bool:
    """按 SokobanBoard 同一套推动规则重放移动串，通关返回 True（见证解自证）。"""
    walls, targets, boxes, player = parse_layout(layout)
    boxes = set(boxes)
    for move in moves:
        dx, dy = DIRS[MOVE_CHARS.index(move)]
        nxt = (player[0] + dx, player[1] + dy)
        if nxt in walls:
            return False
        if nxt in boxes:
            dst = (nxt[0] + dx, nxt[1] + dy)
            if dst in walls or dst in boxes:
                return False
            boxes.remove(nxt)
            boxes.add(dst)
        player = nxt
    return solved(frozenset(boxes), targets)


def main() -> int:
    args = [arg for arg in sys.argv[1:] if arg.strip()]
    want_path = "--paths" in args
    paths = [arg for arg in args if arg != "--paths"]
    project_dir = Path(paths[0] if paths else ".").resolve()
    levels = load_levels(project_dir)
    print(f"解析到 {len(levels)} 个关卡（{project_dir / 'scripts' / 'sokoban_levels.gd'}）")
    print("模式：" + ("求解 + 见证解路径（--paths）" if want_path else "仅可解性与最优步数（加 --paths 输出路径）"))
    all_solvable = True
    for level_id, par, layout in levels:
        walls, targets, boxes, player = parse_layout(layout)
        if len(boxes) <= 3:
            best, expanded, path = solve_bfs(walls, targets, boxes, player, want_path)
            solver = "BFS"
        else:
            best, expanded, path = solve_astar(walls, targets, boxes, player, want_path)
            solver = "A*"
        if best is None:
            all_solvable = False
            print(f"[FAIL] {level_id}: 无解（展开 {expanded} 态，{solver}）—— 不可通关关卡（AC4 违约）")
            continue
        par_note = "par 一致" if best == par else f"⚠️ par 漂移（spec 记录 {par}）"
        print(f"[PASS] {level_id}: 可解，最优 {best} 步 / {par_note} / {solver} 展开 {expanded} 态 / "
              f"网格 {len(layout.split(chr(10))[0])}x{len(layout.split(chr(10)))} / 方块 {len(boxes)}")
        if want_path:
            if len(path) != best:
                all_solvable = False
                print(f"[FAIL] {level_id}: 路径长度 {len(path)} != 最优步数 {best}（重建逻辑缺陷）")
                continue
            if not replay(layout, path):
                all_solvable = False
                print(f"[FAIL] {level_id}: 见证解 {path} 重放未通关（重建逻辑缺陷）")
                continue
            print(f"       solution[{level_id}] = \"{path}\"（重放验证 ✓，可直接落盘 sokoban_levels.gd）")
    if len({par for _, par, _ in levels}) < len(levels):
        all_solvable = False
        print("[FAIL] par_moves 未随难度单调递增（AC4）")
    print("关卡可解性验证：全部通过" if all_solvable else "关卡可解性验证：存在失败项")
    return 0 if all_solvable else 1


if __name__ == "__main__":
    sys.exit(main())
