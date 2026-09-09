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

/** 弹道与后坐力参数（弹道下坠线：投射物重力 / 后坐力偏移与恢复） */
export interface BallisticConfig {
  /** 投射物重力加速度（m/s²，作用于弹丸垂直速度 → 弹道下坠） */
  projectileGravity: number;
  /** 单发后坐力垂直上抬系数（rad × recoil） */
  recoilPitchK: number;
  /** 单发后坐力水平抖动标准差系数（rad × recoil，高斯） */
  recoilYawK: number;
  /** 后坐力恢复速率（指数衰减 /s）：停火后瞄准偏移回零 */
  recoilRecoverPerSec: number;
  /** 引导（医疗）中移动速度倍率 */
  channelMoveSpeedMul: number;
}

export const BALLISTIC: BallisticConfig = {
  projectileGravity: 9.8,
  recoilPitchK: 0.0075,
  recoilYawK: 0.0032,
  recoilRecoverPerSec: 11,
  channelMoveSpeedMul: 0.5,
};
