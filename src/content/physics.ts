/**
 * content/physics —— 跳伞四阶段与地面移动物理参数（AC2 数值来源）
 */

export interface ParachuteConfig {
  /** 运输机巡航高度（m，相对海平面） */
  planeAltitude: number;
  /** 运输机速度（m/s） */
  planeSpeed: number;
  /** 运输机航线出入图缓冲（m） */
  planePathMargin: number;
  /** 自由落体重力（m/s²） */
  freefallGravity: number;
  /** 自由落体终端垂直速度（m/s） */
  freefallTerminalVy: number;
  /** 自由落体常规水平速度（m/s） */
  freefallHorizontalSpeed: number;
  /** 俯冲加成水平速度（m/s） */
  freefallDiveBonus: number;
  /** 自由落体水平机动加速度（m/s²） */
  freefallHorizontalAccel: number;
  /** 低于该离地高度（m）自动开伞 */
  autoDeployAltitude: number;
  /** 开伞瞬间减速缓冲（m/s） */
  deployBrakeVy: number;
  /** 降落伞终端下降速度（m/s） */
  chuteDescentSpeed: number;
  /** 降落伞垂直速度趋近时间常数（s） */
  chuteVyTau: number;
  /** 降落伞水平滑翔速度（m/s） */
  chuteGlideSpeed: number;
  /** 降落伞水平机动加速度（m/s²） */
  chuteHorizontalAccel: number;
  /** 视为落地的离地高度（m） */
  landingAltitude: number;
}

export const PARACHUTE: ParachuteConfig = {
  planeAltitude: 420,
  planeSpeed: 95,
  planePathMargin: 220,
  freefallGravity: 35,
  freefallTerminalVy: 55,
  freefallHorizontalSpeed: 32,
  freefallDiveBonus: 40,
  freefallHorizontalAccel: 26,
  autoDeployAltitude: 90,
  deployBrakeVy: 12,
  chuteDescentSpeed: 7,
  chuteVyTau: 0.45,
  chuteGlideSpeed: 15,
  chuteHorizontalAccel: 14,
  landingAltitude: 0.05,
};

export interface MovementConfig {
  /** 地面步行速度（m/s） */
  walkSpeed: number;
  /** 地面疾跑速度（m/s） */
  sprintSpeed: number;
  /** 地面转向灵敏度（rad/s，AI 用） */
  turnSpeed: number;
}

export const MOVEMENT: MovementConfig = {
  walkSpeed: 5.2,
  sprintSpeed: 8.6,
  turnSpeed: 6,
};

export interface BallisticConfig {
  /** 弹道下坠重力加速度（m/s²），下坠量 = 0.5 × g × t²，t = 距离 / 弹速 */
  gravityMps2: number;
  /** 弹道扫描分段长度（m）：抛物线弹道按该步长折线扫描命中（射线扫描判定，架构 §3.1） */
  segmentM: number;
}

export const BALLISTIC: BallisticConfig = {
  gravityMps2: 9.81,
  segmentM: 25,
};
