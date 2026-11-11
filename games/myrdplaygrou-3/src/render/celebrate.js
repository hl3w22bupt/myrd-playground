// celebrate.js — 进球庆祝表现层（IP-3 · 进球瞬间缺画面爆点证据）：球门mouth彩带粒子爆发 + 镜头 FOV 冲击。
// 纯 render 层：由 main.handleEvents 在 goal 事件时置位，只读事件参数，不回写内核（内核确定性不受影响）。
// 预算：单 drawCall（THREE.Points 池 + 加法混合 + 径向光斑贴图；死粒子颜色收敛为黑 = 加法混合下不可见）。
import * as THREE from "three";
import { glowTexture } from "./textures.js";
import { PITCH_HALF_Z } from "../numeric.js";

const POOL = 96;          // 粒子池上限（单池复用，连续进球不叠加分配）
const LIFE = 1.9;         // 单粒子寿命（秒）：与进球特写机位 1.2s 衔接，彩带读完才散
const PUNCH_T = 0.5;      // 镜头 FOV 冲击时长（秒）

export function createCelebration(scene) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(POOL * 3);
  const colors = new Float32Array(POOL * 3);
  for (let i = 0; i < POOL; i++) positions[i * 3 + 1] = -100; // 未激活：视锥外
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.42, map: glowTexture(), vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // 池内含视锥外死粒子，关闭整体剔除
  scene.add(points);

  const vel = new Float32Array(POOL * 3);   // 速度（米/秒）
  const life = new Float32Array(POOL);      // 剩余寿命（≤0 = 死）
  const base = new Float32Array(POOL * 3);  // 基色（衰减乘子用）
  let cursor = 0; // 池游标（环形复用）

  /** 进球爆发：gz 被进球的球门 z，team 进球队（0=主蓝 / 1=客橙） */
  function burst(team) {
    const gz = team === 0 ? -PITCH_HALF_Z : PITCH_HALF_Z;
    const palette = team === 0
      ? [[0.204, 0.596, 0.859], [1, 1, 1], [0.953, 0.612, 0.071]]   // #3498db / 白 / #f39c12
      : [[0.953, 0.612, 0.071], [1, 1, 1], [0.204, 0.596, 0.859]];  // #f39c12 / 白 / 蓝点缀
    for (let n = 0; n < POOL * 0.75; n++) {
      const i = cursor; cursor = (cursor + 1) % POOL;
      positions[i * 3] = (Math.random() * 2 - 1) * 3.4;             // 门宽扇形散布
      positions[i * 3 + 1] = 0.3 + Math.random() * 0.8;
      positions[i * 3 + 2] = gz + (Math.random() * 1.6 - 0.8);
      // 速度：向场内上方喷（朝 |z| 减小方向），随机扇角
      const inward = -Math.sign(gz);
      vel[i * 3] = (Math.random() * 2 - 1) * 3.2;
      vel[i * 3 + 1] = 3.5 + Math.random() * 3.5;
      vel[i * 3 + 2] = inward * (2 + Math.random() * 4.5);
      life[i] = LIFE * (0.7 + Math.random() * 0.3);
      const c = palette[n % palette.length];
      base[i * 3] = c[0]; base[i * 3 + 1] = c[1]; base[i * 3 + 2] = c[2];
    }
  }

  /** 逐帧积分：重力 + 寿命衰减（颜色乘子 → 加法混合下渐隐）；返回是否仍有活跃粒子。
   *  空闲路径零成本：无活跃粒子时不标记缓冲上传（零 memcpy）、由调用方隐藏 Points（零 draw call）。 */
  function update(dt) {
    let alive = false;
    for (let i = 0; i < POOL; i++) {
      if (life[i] <= 0) continue;
      alive = true;
      life[i] -= dt;
      vel[i * 3 + 1] -= 9.8 * dt; // 重力
      positions[i * 3] += vel[i * 3] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (positions[i * 3 + 1] < 0.05) { // 落地反弹衰减
        positions[i * 3 + 1] = 0.05;
        vel[i * 3 + 1] *= -0.35;
        vel[i * 3] *= 0.7; vel[i * 3 + 2] *= 0.7;
      }
      const k = Math.max(0, Math.min(1, life[i] / LIFE));
      colors[i * 3] = base[i * 3] * k;
      colors[i * 3 + 1] = base[i * 3 + 1] * k;
      colors[i * 3 + 2] = base[i * 3 + 2] * k;
      if (life[i] <= 0) positions[i * 3 + 1] = -100;
    }
    if (alive) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }
    return alive;
  }

  return { burst, update, points };
}

/** 镜头 FOV 冲击状态机（进 flat 小结构，main 持有；纯读表驱动） */
export function createPunch() {
  let t = 0;
  return {
    fire() { t = PUNCH_T; },
    /** 逐帧推进；返回当前 FOV 附加角（度，0 = 无冲击） */
    step(dt) {
      if (t <= 0) return 0;
      t = Math.max(0, t - dt);
      const p = t / PUNCH_T;                    // 1→0
      return Math.sin(p * Math.PI) * 5;         // 半正弦包络，峰值 5°
    },
  };
}
