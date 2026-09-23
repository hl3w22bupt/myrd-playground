// fx.js — 命中反馈（纯表现层）：命中火花粒子池。由 main 翻译内核 enemyHit 事件驱动；
// 不读内核内部状态、不写世界数据（确定性归内核，反馈外观归表现）。
// 资产接线：颜色/粒径/寿命取自 assets/palette.mjs；粒子池初始化失败 → 空实现，不破坏运行。

import * as THREE from "three";
import { safe, styleCard } from "../../assets/index.mjs";

const P = styleCard();

/** 粒子池：每簇一个 THREE.Points（1 draw call），循环复用 */
function buildSparkPool(scene) {
  const S = P.scale.spark;
  const POOL = 6;
  const bursts = [];
  for (let i = 0; i < POOL; i++) {
    const pos = new Float32Array(S.count * 3);
    const vel = new Float32Array(S.count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: P.fx.impact, size: S.size, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.visible = false;
    scene.add(points);
    bursts.push({ points, pos, vel, life: 0 });
  }
  let cursor = 0;
  return {
    /** 在世界坐标 origin 生成一簇火花；headshot 用更亮的暖橙 + 更大粒径 */
    burst(origin, headshot) {
      const b = bursts[cursor++ % bursts.length];
      b.life = S.life;
      b.points.visible = true;
      b.points.material.opacity = headshot ? 1 : 0.85;
      b.points.material.size = S.size * (headshot ? 1.5 : 1);
      for (let i = 0; i < S.count; i++) {
        const j = i * 3;
        b.pos[j] = origin.x; b.pos[j + 1] = origin.y; b.pos[j + 2] = origin.z;
        // 表现层随机（确定性归内核 RNG，这里允许 Math.random）
        const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
        const sp = S.speed * (0.4 + Math.random() * 0.6);
        b.vel[j] = Math.sin(ph) * Math.cos(th) * sp;
        b.vel[j + 1] = Math.cos(ph) * sp * 0.8 + 0.8;
        b.vel[j + 2] = Math.sin(ph) * Math.sin(th) * sp;
      }
      b.points.geometry.attributes.position.needsUpdate = true;
    },
    update(dt) {
      for (const b of bursts) {
        if (b.life <= 0) continue;
        b.life -= dt;
        if (b.life <= 0) { b.points.visible = false; b.points.material.opacity = 0; continue; }
        for (let i = 0; i < S.count; i++) {
          const j = i * 3;
          b.vel[j + 1] -= 5.5 * dt;                       // 火花下坠
          b.pos[j] += b.vel[j] * dt;
          b.pos[j + 1] += b.vel[j + 1] * dt;
          b.pos[j + 2] += b.vel[j + 2] * dt;
        }
        b.points.material.opacity *= Math.max(0, 1 - dt / S.life);
        b.points.geometry.attributes.position.needsUpdate = true;
      }
    },
  };
}

const NOOP = { burst() {}, update() {} };

/** 命中特效装配（失败降级空实现，绝不影响渲染主流程）*/
export function buildFx(scene) {
  return safe("fx:命中火花", () => buildSparkPool(scene), () => NOOP) ?? NOOP;
}

/** 由相机视线 + 内核命中距离推算命中点（enemyHit.dist = 沿射线的距离）*/
export function impactPoint(camera, dist) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  return camera.position.clone().addScaledVector(dir, dist);
}
