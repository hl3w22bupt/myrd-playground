// scene.js — three 场景装配：画质四件套（Bloom + ACES + 雾 + 重布光/软阴影）+ 球场/球门/球/镜头。
// 配方依据 references/rendering-quality-recipe.md（对标产物逆向结论），参数不要自由发挥。
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { PALETTE, pitchTexture, ballTexture } from "./textures.js";
import { buildHumanoid, syncHumanoid } from "./player.js";
import { GOALS } from "../levels/pitch.js";
import { PITCH_HALF_X, PITCH_HALF_Z, BALL_RADIUS, GOAL_HALF_WIDTH } from "../numeric.js";

/** 渲染器：ACES 色调映射 + 软阴影 + pixelRatio 上限 2（E-08） */
export function buildRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false }); // SwiftShader/移动端 MSAA 成本高；平涂色块 + dpr≥2 下锯齿可接受
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * 0.75); // 0.75 内部分辨率：全屏 pass 像素量 ↓44%；平涂+辉光下视觉无损
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/** 场景与灯光：白昼天光雾 + 半球底光 + 主方向光（软阴影）+ 2 盏彩色点缀光 */
export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.012);

  scene.add(new THREE.HemisphereLight(0xdff3fb, 0x1e5c38, 0.75));

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(12, 26, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512); // 512 + PCFSoft：软阴影质感保留，阴影 pass 光栅成本 ↓4×
  key.shadow.camera.left = -PITCH_HALF_X - 6;
  key.shadow.camera.right = PITCH_HALF_X + 6;
  key.shadow.camera.top = PITCH_HALF_Z + 6;
  key.shadow.camera.bottom = -PITCH_HALF_Z - 6;
  key.shadow.camera.far = 80;
  scene.add(key);

  // 点缀光收口为 1 盏（每像素光照计算减半；SwiftShader 逐像素光照是 CPU 热点）
  const cool = new THREE.PointLight(0x7fdfff, 45, 70);
  cool.position.set(-14, 10, -12);
  scene.add(cool);

  return scene;
}

/** 后期链：RenderPass → UnrealBloom → OutputPass（链尾必须有，否则画面发灰，E-01）。
 *  Bloom 半分辨率：辉光是低频效果，半分辨率视觉无损、全屏 pass 开销砍半（移动端帧率预算） */
export function buildComposer(renderer, scene, camera) {
  // 渲染目标 UnsignedByteType：HalfFloat 的全屏 pass 带宽减半（SwiftShader 带宽热点）；平涂风格 8bit 足够
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.UnsignedByteType });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    // 1/4 分辨率：辉光是纯低频效果，1/4 分辨率肉眼无差（链内 mips 更是低频），全屏成本 ↓
    new THREE.Vector2(Math.max(1, window.innerWidth >> 2), Math.max(1, window.innerHeight >> 2)),
    0.45, 0.5, 0.86,
  ));
  composer.addPass(new OutputPass());
  return composer;
}

export function buildCamera() {
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 220);
  camera.position.set(0, 26, 22);
  return camera;
}

/** 球场：草皮标线地板（内核同源几何）+ 球门（柱/梁）+ 笼式边界挡板 */
export function buildArena(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(PITCH_HALF_X * 2 + 4, PITCH_HALF_Z * 2 + 4),
    new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.9, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // —— 球门（两侧；内核 GOALS 同源）——
  const frameMat = new THREE.MeshStandardMaterial({ color: PALETTE.goalFrame, roughness: 0.35, metalness: 0.4 });
  for (const goal of GOALS) {
    const gz = goal.z;
    const postH = 1.7;
    for (const px of [-GOAL_HALF_WIDTH, GOAL_HALF_WIDTH]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, postH, 12), frameMat);
      post.position.set(px, postH / 2, gz);
      post.castShadow = true;
      scene.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, GOAL_HALF_WIDTH * 2 + 0.18, 12), frameMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, postH, gz);
    scene.add(bar);
  }

  // —— 笼式边界挡板（内核挡板反弹的同源视觉；矮墙不挡视线）——
  const boardMat = new THREE.MeshStandardMaterial({ color: PALETTE.board, roughness: 0.6, metalness: 0.3 });
  const boardH = 0.9;
  const mkBoard = (w, d, x, z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, boardH, d), boardMat);
    b.position.set(x, boardH / 2, z);
    b.receiveShadow = true;
    b.castShadow = true;
    scene.add(b);
  };
  mkBoard(PITCH_HALF_X * 2 + 1, 0.4, 0, PITCH_HALF_Z + 1.6);
  mkBoard(PITCH_HALF_X * 2 + 1, 0.4, 0, -PITCH_HALF_Z - 1.6);
  mkBoard(0.4, PITCH_HALF_Z * 2 + 1, PITCH_HALF_X + 1.6, 0);
  mkBoard(0.4, PITCH_HALF_Z * 2 + 1, -PITCH_HALF_X - 1.6, 0);

  // 外围草坡（场地外一圈暗绿，镜头拉远时不露背景缝）
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(PITCH_HALF_X * 2 + 30, PITCH_HALF_Z * 2 + 30),
    new THREE.MeshStandardMaterial({ color: 0x249453, roughness: 1 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  scene.add(apron);
}

/** 足球：白底黑斑贴图球体（滚动由速度驱动，表现层装饰） */
export function buildBall(scene) {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
    new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.4, metalness: 0.05 }),
  );
  ball.castShadow = true;
  scene.add(ball);
  return ball;
}

/** 10 名关节人形（按内核 players 队色/号码装配） */
export function buildPlayers(scene, world) {
  return world.players.map((p) => {
    const vis = buildHumanoid(scene, { team: p.team, num: p.num, isGK: p.role === "GK" });
    let meshCount = 0;
    vis.group.traverse((o) => { if (o.isMesh) meshCount++; }); // 段件口径 = 关节树全部 mesh（躯干/头/四肢段/鞋/号/环）
    return { ...vis, id: p.id, meshCount };
  });
}

/** 逐帧同步全部人形（只读内核：位置/朝向/相位/受控显隐；事件驱动的踢腿在 main 侧置位） */
export function syncPlayers(scene, playerVis, world, dt) {
  let segments = 0;
  for (const vis of playerVis) {
    const p = world.players[vis.id];
    const moving = Math.hypot(p.vx, p.vz);
    const controlled = vis.id === world.controlledId;
    syncHumanoid(p, vis, dt, moving, controlled);
    segments += vis.meshCount;
  }
  return segments;
}

/** 球的位置 + 滚动自转（松球按速度滚；持球按持球人位置贴地） */
export function syncBall(ballMesh, world, dt) {
  const b = world.ball;
  ballMesh.position.set(b.x, BALL_RADIUS, b.z);
  const speed = Math.hypot(b.vx, b.vz);
  if (speed > 0.05) {
    // 旋转轴 = 速度方向的水平垂直轴；滚动角速度 = speed / r
    const axis = new THREE.Vector3(b.vz, 0, -b.vx).normalize();
    ballMesh.rotateOnWorldAxis(axis, (speed * dt) / BALL_RADIUS);
  }
}

/** 相机跟随：竖屏长轴 = 进攻方向（-Z），镜头在球后上方平滑逼近（表现层手感）。
 *  取景按视口宽高比自适应（IP-1 · qa/smoke/desktop 截图证据）：竖屏基准
 *  （高 17.5 / 后偏移 13）不动；宽屏（aspect>0.9）按比例收近压低——竖屏参数直接搬横屏时
 *  26m 场宽只占画面中段（水平视场角随 aspect 放大 → 两侧大片空带），收近后场宽占满画幅、
 *  球员读数变大。插值区间 0.9→2.2 线性，竖屏与桌面端点值恒定（跨轮回归可比）。 */
export function followCamera(camera, world, dt) {
  const b = world.ball;
  const t = Math.max(0, Math.min(1, ((camera.aspect || 1) - 0.9) / (2.2 - 0.9)));
  const height = 17.5 + (10 - 17.5) * t;
  const back = 13 + (8 - 13) * t;
  const target = new THREE.Vector3(b.x * 0.8, 0, b.z * 0.8 - 2);
  const wanted = new THREE.Vector3(b.x * 0.55, height, b.z * 0.62 + back);
  camera.position.lerp(wanted, Math.min(1, 3.2 * dt));
  camera.lookAt(target);
}

export function onResize(renderer, composer, camera) {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

export { syncHumanoid };
