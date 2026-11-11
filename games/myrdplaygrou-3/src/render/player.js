// player.js — 程序化关节人形球员（v2 重建模：替换模板的胶囊体）。
// 分段四肢：骨盆→躯干→头，双臂（肩/肘两段），双腿（髋/膝两段+球鞋）—— 8 个可见关节。
// 跑动动画由内核 phase 驱动（表现层只读，不回写内核状态）；踢球/铲球动作为表现层本地计时装饰。
// 头身比 ≈1:3.2，圆润色块分面（风格卡 football-flat-bright · character 维度）。
import * as THREE from "three";
import { PALETTE, numberTexture, glowTexture } from "./textures.js";

/** 共享几何（全部工程只建一份；不同球员复用，材质按队色共享 —— draw call 收口） */
const GEO = {
  head: new THREE.SphereGeometry(0.17, 12, 10),
  hair: new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
  torso: new THREE.BoxGeometry(0.46, 0.5, 0.26),
  pelvis: new THREE.BoxGeometry(0.4, 0.16, 0.24),
  upperArm: new THREE.BoxGeometry(0.09, 0.26, 0.09),
  lowerArm: new THREE.BoxGeometry(0.08, 0.24, 0.08),
  upperLeg: new THREE.BoxGeometry(0.12, 0.3, 0.12),
  lowerLeg: new THREE.BoxGeometry(0.1, 0.28, 0.1),
  shoe: new THREE.BoxGeometry(0.12, 0.09, 0.22),
  numberPlane: new THREE.PlaneGeometry(0.3, 0.3),
  ring: new THREE.TorusGeometry(0.55, 0.05, 8, 32),
};

/** 共享材质（按 队色/部位 收口；主客门将共 5 套） */
function teamMaterials(team, isGK) {
  const jersey = new THREE.MeshStandardMaterial({
    color: isGK ? PALETTE.gk : (team === 0 ? PALETTE.home : PALETTE.away),
    roughness: 0.6, metalness: 0.05,
  });
  return {
    jersey,
    shorts: new THREE.MeshStandardMaterial({ color: team === 0 ? PALETTE.shortsHome : PALETTE.shortsAway, roughness: 0.7 }),
    socks: jersey, // 球袜 = 队服色（扁平色块分面）
    skin: new THREE.MeshStandardMaterial({ color: PALETTE.skin, roughness: 0.8 }),
    hair: new THREE.MeshStandardMaterial({ color: PALETTE.hair, roughness: 0.9 }),
    shoes: new THREE.MeshStandardMaterial({ color: PALETTE.shoes, roughness: 0.6 }),
  };
}

/** 段件：pivot Group + 偏移 mesh（关节旋转绕 pivot）；castShadow=false ——
 *  阴影投影面收口到大件（躯干/骨盆/腿段在各自声明处开），小件投影是 drawCall 翻倍的主因 */
function limb(parent, geo, mat, pivotPos, meshOffset, castShadow = false) {
  const pivot = new THREE.Group();
  pivot.position.set(...pivotPos);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...meshOffset);
  mesh.castShadow = castShadow;
  pivot.add(mesh);
  parent.add(pivot);
  return pivot;
}

/**
 * 构建一名关节人形球员。
 * @returns {{group, joints, setNum}} joints 含 run 动画需要的全部关节引用
 */
export function buildHumanoid(scene, { team, num, isGK = false }) {
  const m = teamMaterials(team, isGK);
  const group = new THREE.Group();

  // —— 骨盆 + 躯干 + 头（上身整体挂 torsoPivot，跑动时前后微倾）——
  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 0.98; // 髋高
  group.add(torsoPivot);
  const pelvis = new THREE.Mesh(GEO.pelvis, m.shorts);
  pelvis.position.y = -0.06;
  torsoPivot.add(pelvis);
  const torso = new THREE.Mesh(GEO.torso, m.jersey);
  torso.position.y = 0.31;
  torso.castShadow = true;
  torsoPivot.add(torso);
  const head = new THREE.Mesh(GEO.head, m.skin);
  head.position.y = 0.72;
  torsoPivot.add(head);
  const hair = new THREE.Mesh(GEO.hair, m.hair);
  hair.position.y = 0.745;
  torsoPivot.add(hair);

  // 背号 + 胸前小号（白字贴图；门将同规则）
  const numTex = numberTexture(num);
  const backNum = new THREE.Mesh(GEO.numberPlane, new THREE.MeshBasicMaterial({ map: numTex, transparent: true }));
  backNum.position.set(0, 0.36, -0.135);
  backNum.rotation.y = Math.PI;
  torsoPivot.add(backNum);
  // 胸前号省略（drawCall 预算）：背号是号码辨识主面（风格卡号码维度仍满足）

  // —— 双臂（肩 pivot → 上臂 + 肘 pivot → 下臂）——
  const armL = limb(torsoPivot, GEO.upperArm, m.jersey, [-0.28, 0.5, 0], [0, -0.13, 0]);
  const armR = limb(torsoPivot, GEO.upperArm, m.jersey, [0.28, 0.5, 0], [0, -0.13, 0]);
  const elbowL = limb(armL, GEO.lowerArm, m.skin, [0, -0.26, 0], [0, -0.12, 0]);
  const elbowR = limb(armR, GEO.lowerArm, m.skin, [0, -0.26, 0], [0, -0.12, 0]);

  // —— 双腿（髋 pivot → 大腿 + 膝 pivot → 小腿 + 球鞋）——
  const legL = limb(group, GEO.upperLeg, m.shorts, [-0.13, 0.98, 0], [0, -0.15, 0], true);
  const legR = limb(group, GEO.upperLeg, m.shorts, [0.13, 0.98, 0], [0, -0.15, 0], true);
  const sockL = limb(legL, GEO.lowerLeg, m.socks, [0, -0.3, 0], [0, -0.14, 0]);
  const sockR = limb(legR, GEO.lowerLeg, m.socks, [0, -0.3, 0], [0, -0.14, 0]);
  const shoeL = new THREE.Mesh(GEO.shoe, m.shoes);
  shoeL.position.set(0, -0.28, 0.04);
  sockL.add(shoeL);
  const shoeR = new THREE.Mesh(GEO.shoe, m.shoes);
  shoeR.position.set(0, -0.28, 0.04);
  sockR.add(shoeR);

  // —— 受控指示环（挂在脚边，默认隐藏；由 scene.syncPlayer 开关）——
  const ring = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.85 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.visible = false;
  group.add(ring);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
  }));
  glow.scale.set(1.6, 1.6, 1);
  glow.position.y = 0.05;
  glow.visible = false;
  group.add(glow);

  scene.add(group);
  return {
    group,
    joints: {
      torsoPivot, head,
      armL, armR, elbowL, elbowR,
      legL, legR, sockL, sockR,
      ring, glow,
    },
    /** 表现层本地装饰计时（踢腿动作）：由事件驱动，不回写内核 */
    kickTimer: 0,
  };
}

/**
 * 逐帧同步一名球员：位置/朝向/跑动相位动画。
 * @param player 内核 player（x,z,angle,phase）
 * @param vis    buildHumanoid 返回值
 * @param dt     渲染 dt（仅用于踢腿装饰计时衰减）
 * @param moving 速度模长（驱动摆幅渐入渐出）
 * @param controlled 是否受控（指示环显隐）
 */
export function syncHumanoid(player, vis, dt, moving, controlled) {
  const { group, joints } = vis;
  group.position.set(player.x, 0, player.z);
  group.rotation.y = player.angle; // 模型正面 = 局部 +Z；内核 angle=atan2(dirX,dirZ) → 直接对齐

  // 跑动相位（内核 phase 驱动）：摆幅随速度渐入渐出
  const amp = Math.min(1, moving / 4) * 0.85;
  const s = Math.sin(player.phase);
  const sOff = Math.sin(player.phase + Math.PI);
  joints.legL.rotation.x = s * amp;
  joints.legR.rotation.x = sOff * amp;
  joints.sockL.rotation.x = Math.max(0, -s) * amp * 1.2; // 膝弯只向后折
  joints.sockR.rotation.x = Math.max(0, -sOff) * amp * 1.2;
  joints.armL.rotation.x = sOff * amp * 0.7;
  joints.armR.rotation.x = s * amp * 0.7;
  joints.elbowL.rotation.x = -0.4 - Math.max(0, sOff) * amp * 0.5;
  joints.elbowR.rotation.x = -0.4 - Math.max(0, s) * amp * 0.5;
  // 躯干：前倾 + 上下微幅（速度感）
  joints.torsoPivot.rotation.x = 0.12 * Math.min(1, moving / 4);
  joints.torsoPivot.position.y = 0.98 + Math.abs(s) * 0.03 * amp;

  // 踢腿装饰：右腿前踢 0.22s（事件驱动置位，这里只做衰减与摆动）
  if (vis.kickTimer > 0) {
    vis.kickTimer = Math.max(0, vis.kickTimer - dt);
    const k = vis.kickTimer / 0.22; // 1→0
    joints.legR.rotation.x = -1.4 * k;
    joints.sockR.rotation.x = 0.5 * k;
  }

  joints.ring.visible = controlled;
  joints.glow.visible = controlled;
  if (controlled) joints.ring.rotation.z += dt * 1.5; // 指示环慢转（纯装饰）
}
