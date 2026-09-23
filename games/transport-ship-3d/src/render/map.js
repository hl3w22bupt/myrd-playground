// map.js — lvl-01-deck 布景拼装。读 levels/level-01-deck.js 的同一份布局数据（逻辑/表现共享真源）。
// 装配顺序 = 依赖顺序：甲板 → 掩体 → 地标 → 海面/天空/雾 → 光照（对标样本 loadMap 口径）。

import * as THREE from "three";
import { DECK_BOUNDS, COVERS, LANDMARKS } from "../levels/level-01-deck.js";
import { block } from "./geometry.js";
import { deckPlate, hullPlate, containerWall, helipadMark, sea } from "./textures.js";

/** 渐变天空穹顶（top/horizon/bottom + 太阳光晕），跟随相机（对标样本穹顶 shader）*/
export function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2e4a63) },
      horizonColor: { value: new THREE.Color(0xe2b58a) },
      bottomColor: { value: new THREE.Color(0x0d1c26) },
      sunDir: { value: new THREE.Vector3(0.4, 0.22, -0.89).normalize() },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 topColor, horizonColor, bottomColor, sunDir;
      void main() {
        float h = normalize(vDir).y;
        vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(h, 0.38)) : mix(horizonColor, bottomColor, pow(-h, 0.6));
        float sun = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 220.0);
        float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 6.0);
        col += vec3(1.0, 0.86, 0.62) * (sun * 1.6 + glow * 0.22);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  mesh.frustumCulled = false;
  return mesh;
}

/** 布景根：返回 { group, sky, update(camera) } */
export function buildMap(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // —— 甲板主面（防滑纹）——
  const w = DECK_BOUNDS.maxX - DECK_BOUNDS.minX, d = DECK_BOUNDS.maxZ - DECK_BOUNDS.minZ;
  const deckTex = deckPlate().clone();
  deckTex.needsUpdate = true; deckTex.repeat.set(w / 4, d / 4);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.6, d),
    new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.92, metalness: 0.1 }),
  );
  deck.position.set(0, -0.3, 0);
  deck.receiveShadow = true;
  group.add(deck);

  // —— 舷墙（甲板两侧裙板，围栏元素的实体形态）——
  const hullTex = hullPlate();
  const hullMat = new THREE.MeshStandardMaterial({ map: hullTex, roughness: 0.85, metalness: 0.3 });
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, d), hullMat);
    wall.position.set(side * (w / 2 + 0.25), 0.25, 0);
    wall.castShadow = true; wall.receiveShadow = true;
    group.add(wall);
  }
  // 舰首/舰尾封板
  for (const end of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1.1, 0.5), hullMat);
    wall.position.set(0, 0.25, end * (d / 2 + 0.25));
    wall.castShadow = true;
    group.add(wall);
  }

  // —— 掩体：舰桥（层叠）+ 集装箱（读 COVERS 同一份数据）——
  for (const c of COVERS) {
    const cw = c.maxX - c.minX, cd = c.maxZ - c.minZ;
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    if (c.id === "lvl-01-deck/bridge") {
      const tex = hullPlate();
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.35 });
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.8, 5.2, cd), mat);
      b1.position.set(cx, 2.6, cz + 1); b1.castShadow = true; b1.receiveShadow = true;
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.5, 3.6, cd * 0.7), mat);
      b2.position.set(cx, 6.9, cz - 1); b2.castShadow = true;
      const wing = block(cw * 0.22, 1.6, cd * 0.5, 0x707a86, cx, 5.6, cz - 2.4);
      group.add(b1, b2, wing);
      // 舰桥窗带（自发光微亮）
      const strip = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.7, 0.5, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x1d2b33, emissive: 0x35505c, emissiveIntensity: 0.8, roughness: 0.4 }));
      strip.position.set(cx, 3.6, cz + 1 + cd / 2 + 0.02);
      group.add(strip);
    } else {
      const isGreen = c.id.includes("container-a");
      const wallTex = containerWall(isGreen ? "#5a6b4a" : "#7a6a4a", isGreen ? "CSCL-0417" : "HYUNDAI-1108");
      const mat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.75, metalness: 0.3 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(cw, 2.9, cd), mat);
      box.position.set(cx, 1.45, cz);
      box.castShadow = true; box.receiveShadow = true;
      group.add(box);
    }
  }

  // —— 地标：停机坪 / 吊臂 ——
  for (const l of LANDMARKS) {
    if (l.kind === "helipad") {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(l.radius, 40),
        new THREE.MeshStandardMaterial({ map: helipadMark(), roughness: 0.95, metalness: 0.05 }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(l.x, 0.012, l.z);
      pad.receiveShadow = true;
      group.add(pad);
    } else if (l.kind === "crane") {
      const steel = new THREE.MeshStandardMaterial({ color: 0xb0622a, roughness: 0.7, metalness: 0.4 });
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, l.height, 0.9), steel);
      post.position.set(l.x - 1.4, l.height / 2, l.z); post.castShadow = true;
      const jib = new THREE.Mesh(new THREE.BoxGeometry(l.height * 0.8, 0.7, 0.7), steel);
      jib.position.set(l.x - 1.4 - l.height * 0.4, l.height, l.z); jib.castShadow = true;
      group.add(post, jib);
    }
  }

  // —— 海面（大平面，波光贴图）——
  const seaTex = sea().clone(); seaTex.needsUpdate = true; seaTex.repeat.set(60, 60);
  const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.35, metalness: 0.55, color: 0x9fb6bd }));
  seaMesh.rotation.x = -Math.PI / 2;
  seaMesh.position.y = -3.2;
  group.add(seaMesh);

  // —— 天空 + 雾 ——
  const sky = buildSky();
  scene.add(sky);
  scene.fog = new THREE.Fog(0x8fa4ae, 90, 380);

  // —— 光照：暖白主光（阴影）+ 半球环境（对标样本灯光层）——
  const sun = new THREE.DirectionalLight(0xffe6c2, 2.1);
  sun.position.set(60, 46, -120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -46; sun.shadow.camera.right = 46;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.far = 300;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xaad2e6, 0x514a38, 1.5));
  const fill = new THREE.DirectionalLight(0x9fb6c9, 0.4);
  fill.position.set(-50, 34, 90); // 相机同侧补光，压回逆光死黑
  scene.add(fill);

  return {
    group, sky,
    update(camera) { sky.position.copy(camera.position); }, // 穹顶跟随相机
  };
}
