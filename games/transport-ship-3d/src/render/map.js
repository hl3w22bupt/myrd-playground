// map.js — lvl-01-deck 布景拼装。读 levels/level-01-deck.js 的同一份布局数据（逻辑/表现共享真源）。
// 装配顺序 = 依赖顺序：甲板 → 掩体 → 地标 → 围栏 → 海面/天空/雾 → 光照（对标样本 loadMap 口径）。
// 资产接线：贴图经 assets/a01-textures.mjs（引用失败降级平色贴图），色/光/比例取自 assets/palette.mjs。

import * as THREE from "three";
import { DECK_BOUNDS, COVERS, LANDMARKS } from "../levels/level-01-deck.js";
import { block } from "./geometry.js";
import { gameTexture, containerTexture } from "../../assets/a01-textures.mjs";
import { safe, styleCard } from "../../assets/index.mjs";

const P = styleCard();

/** 表面材质工厂：统一带「同色自发光兜底」（palette.material.ambientFloor），
 *  背光/掠射角的面永不读成纯黑剪影（风格卡 ②-b 材质兜底）。*/
function surfMat({ map = null, color = 0xffffff, roughness = 0.8, metalness = 0.2, floor = P.hull.base }) {
  return new THREE.MeshStandardMaterial({
    map, color, roughness, metalness,
    emissive: floor, emissiveIntensity: P.material.ambientFloor,
  });
}

/** 渐变天空穹顶（top/horizon/bottom + 太阳光晕），跟随相机（对标样本穹顶 shader）
 *  兜底：shader 编译失败 → 退回单色穹顶（雾色），不破坏运行。*/
export function buildSky() {
  const build = () => {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(P.sky.top) },
        horizonColor: { value: new THREE.Color(P.sky.horizon) },
        bottomColor: { value: new THREE.Color(P.sky.bottom) },
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
  };
  const flat = () => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 12, 8),
      new THREE.MeshBasicMaterial({ color: P.sky.fog, side: THREE.BackSide, fog: false }));
    mesh.frustumCulled = false;
    return mesh;
  };
  return safe("sky 穹顶", build, flat);
}

/** 围栏（元素 lvl-01-deck/railing：甲板边界，舷墙之上的栏杆 + 暖橙扶手）。
 *  立柱用 InstancedMesh 合批（~60 根只占 1 个 draw call）。*/
function buildRailing() {
  const g = new THREE.Group();
  const R = P.scale.railing;
  const steel = new THREE.MeshStandardMaterial({ color: P.hull.steel, roughness: 0.6, metalness: 0.5 });
  const handrail = new THREE.MeshStandardMaterial({ color: P.warning.orange, roughness: 0.55, metalness: 0.35 });

  const x0 = DECK_BOUNDS.minX + 0.2, x1 = DECK_BOUNDS.maxX - 0.2;
  const z0 = DECK_BOUNDS.minZ + 0.5, z1 = DECK_BOUNDS.maxZ - 0.5;
  const lenX = x1 - x0, lenZ = z1 - z0;

  // 横杆 ×2 + 踢脚板（三面：左右舷 + 舰尾；舰首由舰桥体块收边）
  const addRail = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  };
  for (const side of [-1, 1]) {
    addRail(0.07, 0.07, lenZ, side * x1, R.height, 0, handrail);
    addRail(0.05, 0.05, lenZ, side * x1, R.height * 0.55, 0, steel);
    addRail(0.05, R.toeH, lenZ, side * x1, R.toeH / 2, 0, steel);
  }
  addRail(lenX, 0.07, 0.07, 0, R.height, z1, handrail);
  addRail(lenX, 0.05, 0.05, 0, R.height * 0.55, z1, steel);
  addRail(lenX, R.toeH, 0.05, 0, R.toeH / 2, z1, steel);

  // 立柱（合批）
  const posts = [];
  for (let z = z0; z <= z1; z += R.postPitch) { posts.push([x0, z], [-x0, z]); }
  for (let x = x0; x <= x1; x += R.postPitch) posts.push([x, z1]);
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(R.postW, R.height, R.postW), steel, posts.length);
  const m4 = new THREE.Matrix4();
  posts.forEach(([x, z], i) => { m4.makeTranslation(x, R.height / 2, z); postMesh.setMatrixAt(i, m4); });
  postMesh.castShadow = true;
  postMesh.instanceMatrix.needsUpdate = true;
  g.add(postMesh);
  return g;
}

/** 布景根：返回 { group, sky, update(camera) } */
export function buildMap(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // —— 甲板主面（防滑纹）——
  const w = DECK_BOUNDS.maxX - DECK_BOUNDS.minX, d = DECK_BOUNDS.maxZ - DECK_BOUNDS.minZ;
  const deckTex = safe("a01:deck-plate 克隆", () => {
    const t = gameTexture("a01/deck-plate").clone();
    t.needsUpdate = true; t.repeat.set(w / 2, d / 2); // 2m 一格：花纹钢板颗粒更细（FPS 视距下读得清）
    return t;
  }, () => null);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.6, d),
    surfMat({ map: deckTex, color: deckTex ? 0xffffff : P.hull.shadow, roughness: 0.92, metalness: 0.1, floor: P.hull.shadow }),
  );
  deck.position.set(0, -0.3, 0);
  deck.receiveShadow = true;
  group.add(deck);

  // —— 舷墙（甲板两侧裙板，围栏元素的实体形态）——
  const hullMat = surfMat({ map: gameTexture("a01/hull-plate"), roughness: 0.85, metalness: 0.3, floor: P.hull.plate });
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
      const mat = surfMat({ map: gameTexture("a01/hull-plate"), roughness: 0.8, metalness: 0.35, floor: P.hull.plate });
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.8, 5.2, cd), mat);
      b1.position.set(cx, 2.6, cz + 1); b1.castShadow = true; b1.receiveShadow = true;
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.5, 3.6, cd * 0.7), mat);
      b2.position.set(cx, 6.9, cz - 1); b2.castShadow = true;
      const wing = block(cw * 0.22, 1.6, cd * 0.5, P.hull.wing, cx, 5.6, cz - 2.4);
      group.add(b1, b2, wing);
      // 舰桥窗带（自发光微亮）
      const strip = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.7, 0.5, 0.1),
        new THREE.MeshStandardMaterial({ color: P.hull.glass, emissive: P.hull.glassEmissive, emissiveIntensity: 0.8, roughness: 0.4 }));
      strip.position.set(cx, 3.6, cz + 1 + cd / 2 + 0.02);
      group.add(strip);
    } else {
      // 集装箱：军绿群 A / 土黄群 B（贴图资产 id 与掩体 id 对应，a01 内自动分派）
      const mat = surfMat({
        map: containerTexture(c.id), roughness: 0.75, metalness: 0.3,
        floor: c.id.includes("container-b") ? P.container.tan : P.container.green,
      });
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
        surfMat({ map: gameTexture("a01/helipad-mark"), roughness: 0.95, metalness: 0.05, floor: P.hull.deep }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(l.x, 0.012, l.z);
      pad.receiveShadow = true;
      group.add(pad);
    } else if (l.kind === "crane") {
      const steel = new THREE.MeshStandardMaterial({ color: P.warning.deep, roughness: 0.7, metalness: 0.4 });
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, l.height, 0.9), steel);
      post.position.set(l.x - 1.4, l.height / 2, l.z); post.castShadow = true;
      const jib = new THREE.Mesh(new THREE.BoxGeometry(l.height * 0.8, 0.7, 0.7), steel);
      jib.position.set(l.x - 1.4 - l.height * 0.4, l.height, l.z); jib.castShadow = true;
      group.add(post, jib);
    }
  }

  // —— 围栏（元素 lvl-01-deck/railing：舷墙之上的栏杆 + 暖橙扶手）——
  const railing = safe("a02:围栏拼装", buildRailing, () => new THREE.Group());
  group.add(railing);

  // —— 海面（大平面，波光贴图）——
  const seaTex = safe("a01:sea 克隆", () => {
    const t = gameTexture("a01/sea").clone();
    t.needsUpdate = true; t.repeat.set(60, 60);
    return t;
  }, () => null);
  const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600),
    surfMat({ map: seaTex, color: seaTex ? P.sea.tint : P.sea.base, roughness: 0.35, metalness: 0.55, floor: P.sea.base }));
  seaMesh.rotation.x = -Math.PI / 2;
  seaMesh.position.y = -3.2;
  group.add(seaMesh);

  // —— 天空 + 雾 ——
  const sky = buildSky();
  scene.add(sky);
  scene.fog = new THREE.Fog(P.sky.fog, P.light.fogRange[0], P.light.fogRange[1]);

  // —— 光照：暖白主光（阴影）+ 半球环境 + 相机同侧补光（对标样本灯光层 + QA Q7 修正）——
  const L = P.light;
  const sun = new THREE.DirectionalLight(L.sun.color, L.sun.intensity);
  sun.position.set(...L.sun.pos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(L.shadow.mapSize, L.shadow.mapSize);
  sun.shadow.camera.left = L.shadow.box.left; sun.shadow.camera.right = L.shadow.box.right;
  sun.shadow.camera.top = L.shadow.box.top; sun.shadow.camera.bottom = L.shadow.box.bottom;
  sun.shadow.camera.far = L.shadow.box.far;
  sun.shadow.bias = L.shadow.bias;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(L.hemi.sky, L.hemi.ground, L.hemi.intensity));
  const fill = new THREE.DirectionalLight(L.fill.color, L.fill.intensity);
  fill.position.set(...L.fill.pos); // 相机同侧补光，压回逆光死黑
  scene.add(fill);
  const bounce = new THREE.DirectionalLight(L.bounce.color, L.bounce.intensity);
  bounce.position.set(...L.bounce.pos); // 甲板暖反弹（自下而上，救背光面暗部）
  scene.add(bounce);

  return {
    group, sky,
    update(camera) { sky.position.copy(camera.position); }, // 穹顶跟随相机
  };
}
