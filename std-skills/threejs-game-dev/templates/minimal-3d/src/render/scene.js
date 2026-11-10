// scene.js — three 场景装配：画质四件套（Bloom + ACES + 雾 + 重布光/软阴影）全在本文件。
// 配方依据 references/rendering-quality-recipe.md（对标产物逆向结论），参数不要自由发挥。
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { groundTexture, glowTexture, PALETTE } from "./textures.js";
import { OBSTACLES } from "../levels/level-01.js";
import { ARENA_HALF } from "../numeric.js";

/** 渲染器：ACES 色调映射 + 软阴影 + pixelRatio 上限 2（E-08） */
export function buildRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/** 场景与灯光：雾 + 半球底光 + 主方向光（软阴影）+ 2 盏彩色点缀光 */
export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.022);

  scene.add(new THREE.HemisphereLight(0x8fd8e8, 0x101820, 0.55));

  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(10, 22, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -ARENA_HALF - 4;
  key.shadow.camera.right = ARENA_HALF + 4;
  key.shadow.camera.top = ARENA_HALF + 4;
  key.shadow.camera.bottom = -ARENA_HALF - 4;
  scene.add(key);

  const cyan = new THREE.PointLight(PALETTE.accentCyan, 60, 40);
  cyan.position.set(-10, 6, -10);
  scene.add(cyan);
  const orange = new THREE.PointLight(PALETTE.accentOrange, 60, 40);
  orange.position.set(10, 6, 10);
  scene.add(orange);

  return scene;
}

/** 后期链：RenderPass → UnrealBloom → OutputPass（链尾必须有，否则画面发灰，E-01） */
export function buildComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.6, 0.5, 0.82,
  ));
  composer.addPass(new OutputPass());
  return composer;
}

export function buildCamera() {
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 18, 13);
  return camera;
}

/** 场地：网格地板（收软阴影）+ 障碍立柱（与内核 OBSTACLES 同源）+ 边界矮墙 */
export function buildArena(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(8), roughness: 0.85, metalness: 0.15 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1b2530, roughness: 0.4, metalness: 0.6 });
  for (const o of OBSTACLES) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, 2.4, 24), pillarMat);
    m.position.set(o.x, 1.2, o.z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(o.r + 0.08, 0.05, 8, 48),
      new THREE.MeshStandardMaterial({ color: PALETTE.accentCyan, emissive: PALETTE.accentCyan, emissiveIntensity: 2 }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.set(o.x, 2.42, o.z);
    scene.add(halo);
  }

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x141d26, roughness: 0.6, metalness: 0.4 });
  for (const [w, d, x, z] of [[ARENA_HALF * 2, 0.5, 0, ARENA_HALF], [ARENA_HALF * 2, 0.5, 0, -ARENA_HALF], [0.5, ARENA_HALF * 2, ARENA_HALF, 0], [0.5, ARENA_HALF * 2, -ARENA_HALF, 0]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), wallMat);
    wall.position.set(x, 0.4, z);
    wall.receiveShadow = true;
    scene.add(wall);
  }
}

/** 玩家：胶囊体 + 底部光斑（发光 sprite 喂 Bloom） */
export function buildPlayer(scene) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 0.8, 6, 16),
    new THREE.MeshStandardMaterial({ color: PALETTE.player, roughness: 0.3, metalness: 0.5 }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(2.2, 2.2, 1);
  glow.position.y = 0.05;
  group.add(glow);
  scene.add(group);
  return group;
}

/** 宝石组：八面体 + 自发光（Bloom 点亮），按 id 索引；同帧只读内核 alive 驱动可见性 */
export function buildGems(scene, world) {
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.accentCyan, emissive: PALETTE.accentCyan, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.3 });
  const meshes = world.gems.map((g) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat);
    m.position.set(g.x, 0.9, g.z);
    m.castShadow = true;
    m.userData.id = g.id;
    scene.add(m);
    return m;
  });
  return meshes;
}

/** 相机跟随：固定俯视角平滑逼近玩家（表现层手感，不影响内核） */
export function followCamera(camera, player, dt) {
  const target = new THREE.Vector3(player.x, 0, player.z);
  const wanted = target.clone().add(new THREE.Vector3(0, 18, 13));
  camera.position.lerp(wanted, Math.min(1, 5 * dt));
  camera.lookAt(target);
}

export function onResize(renderer, composer, camera) {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
