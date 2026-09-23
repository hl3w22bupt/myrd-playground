// player.js — 玩家装配：指针锁定相机 + 武器视图模型双场景（对标样本核心决策：
// 枪模放独立 vmScene/vmCamera，fov 58 vs 世界 fov 78，RenderPass clear=false/clearDepth=true 叠加，
// 枪模不被世界 FOV 拉伸变形、永不穿模）。本原型无 composer，改用 onBeforeRender 双 pass 直绘 —— 语义一致。
// 资产接线：枪模经 assets/a02-geometry.mjs（引用失败降级同形兜底体）；后坐/火光幅度取自 assets/palette.mjs。

import * as THREE from "three";
import { gameModel } from "../../assets/a02-geometry.mjs";
import { safe, styleCard } from "../../assets/index.mjs";
import { EYE_HEIGHT } from "../numeric.js";

const P = styleCard();

export const WORLD_FOV = 78;
export const VM_FOV = 58;

/** 枪口火光：十字双面片 + 点光脉冲（纯表现，由 fire() 点亮、apply() 按 dt 衰减）*/
function buildMuzzleFlash(parent, localZ) {
  const M = P.scale.muzzle;
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: P.fx.muzzle, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const quad = new THREE.PlaneGeometry(M.size, M.size);
  const a = new THREE.Mesh(quad, mat);
  const b = new THREE.Mesh(quad, mat); b.rotation.y = Math.PI / 2;
  group.add(a, b);
  group.position.set(0, 0.015, localZ);
  group.visible = false;
  parent.add(group);
  return group;
}

export function buildPlayerRig(canvas) {
  const camera = new THREE.PerspectiveCamera(WORLD_FOV, canvas.clientWidth / canvas.clientHeight, 0.05, 500);
  camera.rotation.order = "YXZ";

  // —— 武器视图场景（独立灯光：主光 + 补光 + 枪口点光）——
  const vmScene = new THREE.Scene();
  const vmCamera = new THREE.PerspectiveCamera(VM_FOV, canvas.clientWidth / canvas.clientHeight, 0.01, 8);
  // 资产引用：a02/rifle（兜底链 a02 fallback → 空组，绝不阻断装配）
  const rifle = safe("a02:rifle", () => gameModel("a02/rifle"), () => new THREE.Group()) ?? new THREE.Group();
  rifle.scale.setScalar(0.8);
  rifle.position.set(0.17, -0.15, -0.30);
  rifle.rotation.set(0.015, 0.12, 0.02);
  vmScene.add(rifle);
  const muzzleFlash = safe("a02:枪口火光", () => buildMuzzleFlash(rifle, P.scale.rifle.length * -0.92), () => null);
  const vmKey = new THREE.DirectionalLight(P.light.sun.color, P.light.vm.key); vmKey.position.set(0.6, 1, 0.8);
  const vmFill = new THREE.HemisphereLight(P.light.hemi.sky, P.light.hemi.ground, P.light.vm.hemi);
  const muzzle = new THREE.PointLight(P.fx.muzzle, 0, 2.2);
  muzzle.position.set(0.16, -0.1, -1.2);
  vmScene.add(vmKey, vmFill, muzzle);

  const dir = new THREE.Vector3();
  let flashT = 0;         // 火光剩余寿命（秒）
  let lastT = 0;          // 上帧内核时间（表现层自己算 dt，不碰内核）
  const K = P.scale.rifle.kick;

  return {
    camera, vmScene, vmCamera, rifle, muzzle,
    /** 内核快照 → 相机位姿。内核 yaw 口径：0=+z；three 相机 ry=π+yaw 时视线 = (sin yaw, cos yaw)。*/
    apply(world) {
      const p = world.player;
      const dt = Math.max(0, world.time - lastT);
      lastT = world.time;
      camera.position.set(p.x, EYE_HEIGHT, p.z);
      camera.rotation.y = Math.PI + p.yaw;
      camera.rotation.x = p.pitch;
      // 行走摆动 + 开火后坐（纯表现，不影响内核；衰减按 dt 计，帧率无关）
      const t = world.time;
      const bob = p.moving ? Math.sin(t * 11) * 0.012 * (p.sprinting ? 1.6 : 1) : Math.sin(t * 2) * 0.003;
      const kick = rifle.userData.kick ?? 0;
      rifle.position.set(0.17, -0.15 + bob - kick * K.posY, -0.30 + kick * K.posZ);
      rifle.rotation.x = 0.015 + kick * K.rotX;
      rifle.userData.kick = Math.max(0, kick - dt / K.decay);
      // 枪口火光衰减
      if (flashT > 0) {
        flashT = Math.max(0, flashT - dt);
        muzzle.intensity = flashT > 0 ? 3.2 : 0;
        if (muzzleFlash) muzzleFlash.visible = flashT > 0;
      }
      camera.getWorldDirection(dir);
    },
    fire() {
      rifle.userData.kick = 1;
      flashT = P.scale.muzzle.life;
      if (muzzleFlash) muzzleFlash.visible = true;
      muzzle.intensity = 3.2;
    },
    resize(w, h) {
      camera.aspect = w / h; camera.updateProjectionMatrix();
      vmCamera.aspect = w / h; vmCamera.updateProjectionMatrix();
    },
  };
}

/** 指针锁定输入 → 意图（渲染帧增量累积，内核子步消费）*/
export function attachInput(canvas, state) {
  const keys = new Set();
  const onKeyDown = (e) => {
    keys.add(e.code);
    if (e.code === "KeyR") state.reloadQueued = true;
    if (e.code === "Space") e.preventDefault();
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onMouseMove = (e) => {
    if (document.pointerLockElement !== canvas) return;
    state.yaw -= e.movementX * 0.0022;
    state.pitch -= e.movementY * 0.0018;
    state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
  };
  const onMouseDown = (e) => { if (e.button === 0) state.firing = true; };
  const onMouseUp = (e) => { if (e.button === 0) state.firing = false; };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  return {
    /** 合成本帧意图（内核 normalize 后消费）*/
    read() {
      const forward = (keys.has("KeyW") ? 1 : 0) + (keys.has("KeyS") ? -1 : 0);
      const strafe = (keys.has("KeyD") ? 1 : 0) + (keys.has("KeyA") ? -1 : 0);
      const reload = state.reloadQueued;
      state.reloadQueued = false;
      return {
        forward, strafe,
        yaw: state.yaw, pitch: state.pitch,
        sprint: keys.has("ShiftLeft") || keys.has("ShiftRight"),
        firing: state.firing === true,
        reload,
      };
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    },
  };
}
