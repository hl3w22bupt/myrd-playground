// pitch.js — 球场几何与 5v5 阵型数据：内核（开球落位/门将站位钳制）与表现层（场地拼装/球衣配色）
// 共享同一份真源（webgame-prototype 目录语义）。纯数据 + 纯函数，零 three/零 DOM。
// 主队（team 0，蓝 #3498db）攻 -Z；客队（team 1，橙 #f39c12）攻 +Z。门将球衣 = 深绿变体。
import {
  PITCH_HALF_X, PITCH_HALF_Z, GOAL_HALF_WIDTH, FORMATION_SPREAD_X, TEAM_SIZE,
} from "../numeric.js";

/** 球门几何：位于 z=±PITCH_HALF_Z，mouth 半宽 GOAL_HALF_WIDTH */
export const GOALS = Object.freeze([
  { team: 0, z: -PITCH_HALF_Z, dir: -1 }, // 主队进攻的门（客队防守）
  { team: 1, z: +PITCH_HALF_Z, dir: +1 }, // 客队进攻的门（主队防守）
]);

/**
 * 5v5 开球落位（含门将）。role 权重：GK 守门、DF 阻击、MF 串联、FW 双箭头接应。
 * 返回 10 项（主队 5 + 客队 5 镜像 z→-z），num 每队 1-5（球衣号码）。
 */
export const KICKOFF_SPOTS = Object.freeze([
  // —— 主队（team 0，攻 -Z）——
  { team: 0, role: "GK", num: 1, x: 0, z: PITCH_HALF_Z - 1.6 },
  { team: 0, role: "DF", num: 2, x: -4.5, z: PITCH_HALF_Z * 0.45 },
  { team: 0, role: "MF", num: 3, x: 0, z: PITCH_HALF_Z * 0.15 },
  { team: 0, role: "FW", num: 4, x: -3.5, z: -PITCH_HALF_Z * 0.25 },
  { team: 0, role: "FW", num: 5, x: 3.5, z: -PITCH_HALF_Z * 0.25 },
  // —— 客队（team 1，攻 +Z；z 镜像）——
  { team: 1, role: "GK", num: 1, x: 0, z: -PITCH_HALF_Z + 1.6 },
  { team: 1, role: "DF", num: 2, x: 4.5, z: -PITCH_HALF_Z * 0.45 },
  { team: 1, role: "MF", num: 3, x: 0, z: -PITCH_HALF_Z * 0.15 },
  { team: 1, role: "FW", num: 4, x: 3.5, z: PITCH_HALF_Z * 0.25 },
  { team: 1, role: "FW", num: 5, x: -3.5, z: PITCH_HALF_Z * 0.25 },
]);

/** 阵型横向散布的基准宽度（DF/MF 站位用） */
export const FORMATION = Object.freeze({
  DF_X: FORMATION_SPREAD_X * 0.55,
  MF_X: FORMATION_SPREAD_X * 0.5,
  FW_X: FORMATION_SPREAD_X * 0.45,
});

/** 球迷读法：进攻方向的符号（team 0 → -1；team 1 → +1） */
export const attackDir = (team) => (team === 0 ? -1 : 1);

/** 球门内切点（x 收一点余量，方便瞄准与门将钳制） */
export const goalMouthClampX = (x) =>
  Math.max(-GOAL_HALF_WIDTH + 0.4, Math.min(GOAL_HALF_WIDTH - 0.4, x));

/** 开球阵型快照（内核 createWorld 用）：返回与 KICKOFF_SPOTS 等长的可写副本 */
export function kickoffFormation() {
  return KICKOFF_SPOTS.map((s) => ({ ...s }));
}

export { TEAM_SIZE };
