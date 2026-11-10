// scene.js — three 场景装配：画质四件套（Bloom + ACES + 雾 + 重布光/软阴影）全在本文件。
// 配方依据 references/rendering-quality-recipe.md（对标产物逆向结论），参数不要自由发挥。
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { fieldTexture, postTexture, ballTexture, glowTexture, PALETTE } from "./textures.js";
import { OBSTACLES } from "../levels/level-01.js";
import { FIELD_HALF_W, FIELD_HALF_L, GOAL_WIDTH, GOAL_LINE, CAM_HEIGHT, CAM_BACK, CAM_AHEAD, CAM_LATERAL, CAM_FRONT_LIMIT } from "../numeric.js";

const PORTRAIT_FOV = 66;   // 竖屏（aspect < 0.8）：与 CAM_* 俯仰配合让整场充满画幅，畸变可控
const LANDSCAPE_FOV = 55;

/** 渲染器：ACES 色调映射 + 软阴影 + pixelRatio 上限 2（E-08） */
export function buildRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/** 场景与灯光：雾 + 半球天光 + 主方向光（软阴影）+ 2 盏彩色点缀光
 *  扁平明快口径：主光强度收敛（ACES 下高光会把饱和色洗灰），饱和度靠色块本身。 */
export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.012);

  scene.add(new THREE.HemisphereLight(0xcfe9f7, 0x2ecc71, 0.5));

  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(10, 26, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); // 软阴影贴图下限（技能规范 ≥1024）：SwiftShader/低端机每帧开销减半
  key.shadow.camera.left = -FIELD_HALF_W - 6;
  key.shadow.camera.right = FIELD_HALF_W + 6;
  key.shadow.camera.top = FIELD_HALF_L + 8;
  key.shadow.camera.bottom = -FIELD_HALF_L - 4;
  scene.add(key);

  const blue = new THREE.PointLight(PALETTE.primary, 40, 50);
  blue.position.set(-FIELD_HALF_W, 8, -FIELD_HALF_L * 0.5);
  scene.add(blue);
  const orange = new THREE.PointLight(PALETTE.accent, 40, 50);
  orange.position.set(FIELD_HALF_W, 8, FIELD_HALF_L * 0.6);
  scene.add(orange);

  return scene;
}

/** 后期链：RenderPass → UnrealBloom → OutputPass（链尾必须有，否则画面发灰，E-01）。
 *  Bloom 半分辨率：辉光是低频信息，半分辨率视觉无损、低端机/SwiftShader 每帧模糊开销减半。 */
export function buildComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
    0.22, 0.6, 0.9,
  ));
  composer.addPass(new OutputPass());
  return composer;
}

export function buildCamera() {
  const camera = new THREE.PerspectiveCamera(LANDSCAPE_FOV, window.innerWidth / window.innerHeight, 0.1, 400);
  const pose = cameraPose({ x: 0, z: 0 });
  camera.position.copy(pose.pos);
  camera.lookAt(pose.target);
  return camera;
}

/** 场地：草地贴图（收软阴影）+ 看台色带 + 球门（门柱/横梁/网）+ 训练桩 + 广告挡板矮墙 */
export function buildArena(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_HALF_W * 2, FIELD_HALF_L * 2),
    new THREE.MeshStandardMaterial({ map: fieldTexture(), roughness: 0.9, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 场外环带（深绿，大平面延伸到雾里 —— 竖屏高机位下视野远端是场外而不是天色，消死天空）
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_HALF_W * 2 + 120, FIELD_HALF_L * 2 + 140),
    new THREE.MeshStandardMaterial({ color: 0x1d5c38, roughness: 0.95 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.05;
  apron.receiveShadow = true;
  scene.add(apron);

  // 广告挡板（四边矮墙，蓝白扁平板材）
  const boardMat = new THREE.MeshStandardMaterial({ color: PALETTE.primary, roughness: 0.5 });
  const boardTopMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  for (const [w, d, x, z] of [
    [FIELD_HALF_W * 2 + 2, 0.4, 0, FIELD_HALF_L + 1],
    [FIELD_HALF_W * 2 + 2, 0.4, 0, -FIELD_HALF_L - 1],
    [0.4, FIELD_HALF_L * 2 + 2, FIELD_HALF_W + 1, 0],
    [0.4, FIELD_HALF_L * 2 + 2, -FIELD_HALF_W - 1, 0],
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, d), boardMat);
    wall.position.set(x, 0.45, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w === 0.4 ? 0.5 : w, 0.08, d === 0.4 ? 0.5 : d), boardTopMat);
    top.position.set(x, 0.94, z);
    scene.add(top);
  }

  // 球门（+Z 端）：白色门柱 ×2 + 横梁 + 半透明背网
  const goalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.2, 12);
  for (const px of [-GOAL_WIDTH / 2, GOAL_WIDTH / 2]) {
    const post = new THREE.Mesh(postGeo, goalMat);
    post.position.set(px, 1.1, GOAL_LINE);
    post.castShadow = true;
    scene.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, GOAL_WIDTH + 0.24, 12), goalMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 2.2, GOAL_LINE);
  bar.castShadow = true;
  scene.add(bar);
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(GOAL_WIDTH, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, roughness: 1 }),
  );
  net.position.set(0, 1.1, GOAL_LINE + 0.9);
  scene.add(net);
  const netTop = new THREE.Mesh(
    new THREE.PlaneGeometry(GOAL_WIDTH, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, roughness: 1 }),
  );
  netTop.rotation.x = -Math.PI / 2;
  netTop.position.set(0, 2.2, GOAL_LINE + 0.45);
  scene.add(netTop);

  // 训练桩（橙白条纹，与内核 OBSTACLES 同源）
  const postTex = postTexture();
  for (const o of OBSTACLES) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(o.r, o.r, 2.2, 24),
      new THREE.MeshStandardMaterial({ map: postTex, roughness: 0.6 }),
    );
    m.position.set(o.x, 1.1, o.z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
}

/** 球员：蓝衣胶囊 + 肤色头 + 底部光斑（发光 sprite 喂 Bloom） */
export function buildPlayer(scene) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 0.7, 6, 16),
    new THREE.MeshStandardMaterial({ color: PALETTE.primary, roughness: 0.35 }),
  );
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.playerSkin, roughness: 0.5 }),
  );
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture("rgba(52, 152, 219, 1)"), blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.scale.set(1.6, 1.6, 1); // IP3（round-0 取证：2.2 光斑把带球球染进光晕，球体不可辨）—— 收口让球读得见
  glow.position.y = 0.05;
  group.add(glow);
  scene.add(group);
  return group;
}

/** 守门员：橙衣胶囊 + 头（x 由表现层每帧读内核 keeper.x 驱动） */
export function buildKeeper(scene) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 0.8, 6, 16),
    new THREE.MeshStandardMaterial({ color: PALETTE.accent, roughness: 0.4 }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.playerSkin, roughness: 0.5 }),
  );
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  group.position.set(0, 0, 0);
  scene.add(group);
  return group;
}

/** 足球：白底黑斑贴图球体 + 阴影 */
export function buildBall(scene) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 24, 18),
    new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.4 }),
  );
  m.position.y = 0.45;
  m.castShadow = true;
  scene.add(m);
  return m;
}

/** 金币组（IP4，round-1 取证：躺倒薄圆柱在部分机位呈细橙条、不像金币）：
 *  竖立硬币（盘面朝 ±X）+ 落点光斑喂 Bloom —— 组节点每帧自转（绕世界 Y 扫盘）+ 上下浮动
 *  （纯表现层装饰，position.x/z 每帧只读内核回写、不回写内核状态），按 id 索引。 */
export function buildCoins(scene, world) {
  const mat = new THREE.MeshStandardMaterial({
    color: PALETTE.accent, emissive: PALETTE.accent, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.6,
  });
  const spotMat = new THREE.SpriteMaterial({
    map: glowTexture("rgba(243, 156, 18, 1)"), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8,
  });
  const meshes = world.coins.map((c) => {
    const group = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20), mat);
    disc.rotation.z = Math.PI / 2;   // 盘面朝 ±X：高机位斜视下读出完整圆盘（原 rotation.x=π/2 是细条观感的根因）
    disc.castShadow = true;
    group.add(disc);
    const spot = new THREE.Sprite(spotMat);
    spot.scale.set(1.3, 1.3, 1);
    spot.position.y = -0.75;         // 地面光斑（组内 y：浮动时贴地不动）
    group.add(spot);
    group.position.set(c.x, 0.9, c.z);
    group.userData.id = c.id;
    scene.add(group);
    return group;
  });
  return meshes;
}

/** 相机目标位姿（位置 + 视线落点）：机位与视线同 x（零偏航）→ 场地纵轴恒直；
 *  机位 z 前限钳制（门线前 CAM_FRONT_LIMIT）：门前不跟着过线，进攻三区构图锁定。
 *  机位参数（高度/后偏/前视/横向系数/前限）真源 = numeric.js CAM_*（手感类，需试玩校准）。 */
function cameraPose(player) {
  const camZ = Math.min(player.z - CAM_BACK, GOAL_LINE - CAM_FRONT_LIMIT);
  return {
    pos: new THREE.Vector3(player.x * CAM_LATERAL, CAM_HEIGHT, camZ),
    target: new THREE.Vector3(player.x * CAM_LATERAL, 0, camZ + CAM_AHEAD),
  };
}

/** 逐帧跟随：位置平滑逼近、视线锁定目标位姿（dt>0 时位置与视线同步收敛，永不分叉） */
export function followCamera(camera, player, dt) {
  const pose = cameraPose(player);
  camera.position.lerp(pose.pos, Math.min(1, 5 * dt));
  camera.lookAt(pose.target);
}

/** 相机快照：跳过平滑直接落到目标位姿（冒烟协议截图用 —— 截图必须反映真实对局机位，
 *  否则位置冻结在初始点而视线跟走，会产生对角线构图的假象） */
export function snapCamera(camera, player) {
  const pose = cameraPose(player);
  camera.position.copy(pose.pos);
  camera.lookAt(pose.target);
}

export function onResize(renderer, composer, camera) {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = camera.aspect < 0.8 ? PORTRAIT_FOV : LANDSCAPE_FOV;
  camera.updateProjectionMatrix();
}

// —— 看台色带（轮 3）：门后与两侧场外的低矮看台块，填充高机位画面上部的「门后死区」
// （round-1 取证：进攻三区画幅上部 ~25% 是灰绿 apron 空带）。扁平色块语言与广告挡板同源
//（主色蓝体 + 白帽线），雾距下自然柔和。纯表现层，零内核交互。 ——
export function buildStands(scene) {
  const standMat = new THREE.MeshStandardMaterial({ color: PALETTE.primary, roughness: 0.95 });
  const standTopMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  for (const [w, d, x, z] of [
    [FIELD_HALF_W * 2 + 30, 7, 0, FIELD_HALF_L + 9],
    [FIELD_HALF_W * 2 + 30, 7, 0, -FIELD_HALF_L - 9],
    [7, FIELD_HALF_L * 2 + 30, FIELD_HALF_W + 9, 0],
    [7, FIELD_HALF_L * 2 + 30, -(FIELD_HALF_W + 9), 0],
  ]) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, d), standMat);
    stand.position.set(x, 1.4, z);
    stand.receiveShadow = true;
    scene.add(stand);
    // 白帽线只做窄檐（深 2.2m）：宽檐的白色顶面在门前构图里会变成大片白板（round-3 取证 live-08）
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w === 7 ? 7.4 : w, 0.22, d === 7 ? 7.4 : 2.2), standTopMat,
    );
    cap.position.set(x, 2.92, z);
    scene.add(cap);
  }
}

// —— 事件粒子池（IP5）：进球/扑救/收集的画面爆点。位置/速度/寿命全在 render 侧，
// 不回写内核；Math.random 抖动属配方允许的表现层非确定性装饰（内核随机源只有 rng.js）。 ——
const PARTICLE_MAX = 48;
const particlePool = [];

export function buildParticles(scene) {
  const map = glowTexture("rgba(255, 255, 255, 1)");
  for (let i = 0; i < PARTICLE_MAX; i += 1) {
    const mat = new THREE.SpriteMaterial({
      map, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    scene.add(sprite);
    particlePool.push({ sprite, life: 0, ttl: 1, vx: 0, vy: 0, vz: 0 });
  }
}

const tmpColor = new THREE.Color();
export function emitBurst(x, y, z, hex, count = 10, speed = 4, ttl = 0.7) {
  tmpColor.set(hex);
  let emitted = 0;
  for (const p of particlePool) {
    if (p.life > 0) continue;
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    p.sprite.material.color.copy(tmpColor);
    p.sprite.position.set(x, y, z);
    p.sprite.scale.set(0.42, 0.42, 1);
    p.vx = Math.cos(a) * v;
    p.vz = Math.sin(a) * v;
    p.vy = 2 + Math.random() * 3;
    p.ttl = ttl * (0.7 + Math.random() * 0.6);
    p.life = p.ttl;
    p.sprite.visible = true;
    if (++emitted >= count) break;
  }
}

export function updateParticles(dt) {
  for (const p of particlePool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.sprite.visible = false; p.sprite.material.opacity = 0; continue; }
    p.sprite.position.x += p.vx * dt;
    p.sprite.position.y += p.vy * dt;
    p.sprite.position.z += p.vz * dt;
    p.vy -= 7 * dt;                       // 轻重力：抛物线散落
    const k = p.life / p.ttl;
    p.sprite.material.opacity = Math.min(1, k * 1.6);
  }
}
