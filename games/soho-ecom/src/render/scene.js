// scene.js — SOHO 房间氛围 viewer：画质四件套（Bloom + ACES + 雾 + 重布光/软阴影）全在本文件。
// 配方依据 references/rendering-quality-recipe.md，参数不要自由发挥（E-01/E-08 同口径）。
// 专业感来自灯光/泛光/色彩，不来自模型面数（spec.world.tone 拍板口径）—— 全部基本几何体拼装，零外部资产。
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { PALETTE, floorTexture, boxTexture, cityWindowTexture, glowTexture } from "./textures.js";

/** 渲染器：ACES 色调映射 + 软阴影 + pixelRatio 上限 2（E-08） */
export function buildRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/** 场景与灯光：指数雾 + 半球底光 + 主方向光（软阴影）+ 暖/冷点缀光 */
export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.02);

  scene.add(new THREE.HemisphereLight(0x9fdcea, 0x1c1620, 0.62));

  const key = new THREE.DirectionalLight(0xfff2df, 1.55);
  key.position.set(8, 14, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  scene.add(key);

  const fill = new THREE.PointLight(0xffe2bd, 16, 26);
  fill.position.set(1.5, 4.8, 2.5); // 天花暖补光：压住 murk，不让房间糊成一团
  scene.add(fill);

  return scene;
}

/** 后期链：RenderPass → UnrealBloom → OutputPass（链尾必须有，否则画面发灰，E-01） */
export function buildComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.55, 0.55, 0.8,
  ));
  composer.addPass(new OutputPass());
  return composer;
}

export function buildCamera() {
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.position.set(9.5, 6.8, 9.5);
  camera.lookAt(0, 1.2, -0.6);
  return camera;
}

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1, ...opts });

/** 慢轨道相机：轻微漂移 + 用户拖拽偏移（表现层手感，不影响内核）；构图锚在书桌工作区 */
export function orbitCamera(camera, t, drag) {
  const angle = 1.08 + Math.sin(t * 0.05) * 0.035 + drag.x;
  const radius = 10.6;
  const height = 7.8 + Math.sin(t * 0.04) * 0.25 - drag.y * 2.2;
  camera.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  camera.lookAt(0.8, 0.9, -1.6);
}

/**
 * SOHO 房间：地板/双墙/窗（城市夜景）/书桌+笔电/椅子/货架/库存纸箱堆/落地灯/地毯。
 * 返回句柄供 syncRoom 驱动；内核事件 → 表现反馈（出单纸箱跳动/回款绿色脉冲/趴窝灯光转暗）。
 */
export function buildRoom(scene) {
  const room = new THREE.Group();
  scene.add(room);

  // —— 点缀光（配方 2-4 盏彩色点光：窗边冷光 + 落地灯暖光；趴窝时由 syncRoom 调度） ——
  const cyan = new THREE.PointLight(PALETTE.accentCyan, 26, 18);
  cyan.position.set(-4.2, 3.2, -3.8); // 窗边
  room.add(cyan);
  const orange = new THREE.PointLight(PALETTE.accentOrange, 22, 16);
  orange.position.set(6.2, 3.4, -3.2); // 落地灯
  room.add(orange);

  // —— 地板与墙 ——
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(17, 11),
    new THREE.MeshStandardMaterial({ map: floorTexture(5), roughness: 0.85, metalness: 0.08 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(17, 6.4), mat(PALETTE.wall));
  backWall.position.set(0, 3.2, -5.5);
  backWall.receiveShadow = true;
  room.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(11, 6.4), mat(0x1d2a38));
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-8.5, 3.2, 0);
  leftWall.receiveShadow = true;
  room.add(leftWall);
  const skirtMat = mat(0x16202c);
  for (const [w, x, z, ry] of [[17, 0, -5.48, 0], [11, -8.48, 0, Math.PI / 2]]) {
    const sk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.06), skirtMat);
    sk.position.set(x, 0.11, z);
    sk.rotation.y = ry;
    room.add(sk);
  }

  // —— 窗：城市夜景（发光贴图，Bloom 喂食） ——
  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.3, 0.14), mat(0x2c3d4e));
  windowFrame.position.set(-4.4, 3.1, -5.42);
  room.add(windowFrame);
  const windowGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 2.0),
    new THREE.MeshBasicMaterial({ map: cityWindowTexture() }),
  );
  windowGlass.position.set(-4.4, 3.1, -5.34);
  room.add(windowGlass);

  // —— 书桌 + 笔电 + 马克杯 ——
  const desk = new THREE.Group();
  desk.position.set(2.6, 0, -3.2);
  room.add(desk);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.5), mat(0x8a6a4f));
  top.position.y = 1.5;
  top.castShadow = true;
  top.receiveShadow = true;
  desk.add(top);
  const legMat = mat(0x2c3d4e, { metalness: 0.5, roughness: 0.4 });
  for (const [lx, lz] of [[-1.5, -0.6], [1.5, -0.6], [-1.5, 0.6], [1.5, 0.6]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), legMat);
    leg.position.set(lx, 0.75, lz);
    leg.castShadow = true;
    desk.add(leg);
  }
  const laptop = new THREE.Group();
  laptop.position.set(-0.5, 1.58, 0.1);
  desk.add(laptop);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.66), mat(0x394b5c, { metalness: 0.6, roughness: 0.35 }));
  laptop.add(base);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.03, -0.3);
  lidPivot.rotation.x = -Math.PI / 2.6;
  laptop.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.68, 0.05), mat(0x394b5c, { metalness: 0.6, roughness: 0.35 }));
  lid.position.set(0, 0.34, 0);
  lidPivot.add(lid);
  const screenMat = new THREE.MeshStandardMaterial({
    color: PALETTE.accentCyan, emissive: PALETTE.accentCyan, emissiveIntensity: 1.5, roughness: 0.3,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.58), screenMat);
  screen.position.set(0, 0.34, 0.03);
  lidPivot.add(screen);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.16, 16), mat(0xd8dde2));
  mug.position.set(0.9, 1.66, 0.2);
  mug.castShadow = true;
  desk.add(mug);
  const plantPot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.14, 12), mat(0xb35c44));
  plantPot.position.set(1.4, 1.65, -0.3);
  desk.add(plantPot);
  const plant = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 8), mat(0x4f8f5f));
  plant.position.set(1.4, 1.86, -0.3);
  desk.add(plant);

  // —— 椅子 ——
  const chair = new THREE.Group();
  chair.position.set(2.6, 0, -1.9);
  room.add(chair);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.6), mat(0x35485c));
  seat.position.y = 0.62;
  seat.castShadow = true;
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.09), mat(0x35485c));
  back.position.set(0, 1.0, 0.26);
  back.castShadow = true;
  chair.add(back);
  for (const [lx, lz] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.22], [0.24, 0.22]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.07), legMat);
    leg.position.set(lx, 0.3, lz);
    chair.add(leg);
  }

  // —— 货架（墙饰） ——
  const shelfMat = mat(0x6b5140);
  for (const sy of [2.5, 3.4]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.5), shelfMat);
    board.position.set(3.6, sy, -5.2);
    board.castShadow = true;
    room.add(board);
    for (let i = 0; i < 4; i++) {
      const item = new THREE.Mesh(
        new THREE.BoxGeometry(0.3 + (i % 2) * 0.15, 0.3, 0.3),
        mat(i % 2 ? 0x9a7b52 : 0x55697d),
      );
      item.position.set(2.4 + i * 0.8, sy + 0.2, -5.2);
      room.add(item);
    }
  }

  // —— 库存纸箱堆（库存 → 箱数，单一映射见 syncRoom） ——
  const boxTex = boxTexture();
  const boxMat = new THREE.MeshStandardMaterial({ map: boxTex, roughness: 0.9, metalness: 0.02 });
  const boxes = [];
  const boxGeo = new THREE.BoxGeometry(0.82, 0.82, 0.82);
  const pile = new THREE.Group();
  pile.position.set(-6.0, 0, -3.5); // 后左角：库存区不抢书桌工区的构图
  room.add(pile);
  for (let i = 0; i < 12; i++) {
    const bx = new THREE.Mesh(boxGeo, boxMat);
    const col = i % 4;
    const row = Math.floor(i / 4);
    bx.position.set(col * 0.95, 0.41 + row * 0.84, (col % 2) * 0.12);
    bx.rotation.y = (i % 3) * 0.14;
    bx.castShadow = true;
    bx.receiveShadow = true;
    bx.visible = false;
    bx.userData.baseY = bx.position.y;
    pile.add(bx);
    boxes.push(bx);
  }
  const pallet = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.14, 1.6), mat(0x54402e));
  pallet.position.set(1.4, 0.07, 0);
  pallet.receiveShadow = true;
  pallet.visible = false; // 有货才显（syncRoom 驱动），空仓不放空托盘
  pile.add(pallet);

  // —— 落地灯 + 地毯 ——
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.6, 10), legMat);
  lampPole.position.set(6.2, 1.3, -3.2);
  room.add(lampPole);
  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 0.5, 16, 1, true),
    mat(0xf3e2c8, { emissive: PALETTE.accentOrange, emissiveIntensity: 0.7, side: THREE.DoubleSide }),
  );
  lampShade.position.set(6.2, 2.7, -3.2);
  room.add(lampShade);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), mat(0x3d5568, { roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(2.5, 0.012, 0.4);
  rug.receiveShadow = true;
  room.add(rug);

  // —— 回款脉冲环（绿色扩散，payout 事件触发） ——
  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.5, 40),
    new THREE.MeshBasicMaterial({ color: PALETTE.settleGreen, transparent: true, opacity: 0 }),
  );
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.set(2.6, 0.02, -1.6);
  room.add(pulse);

  // —— 趴窝警示光（红点光，broke 时点亮） ——
  const warn = new THREE.PointLight(PALETTE.brokeRed, 0, 10);
  warn.position.set(2.6, 1.2, -2.6);
  room.add(warn);

  // —— 粒子池（出单琥珀 / 回款绿） ——
  const glow = glowTexture();
  const particles = [];
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.set(0.5, 0.5, 1);
    sp.visible = false;
    room.add(sp);
    particles.push({ sp, life: 0, vel: new THREE.Vector3() });
  }

  return {
    group: room,
    boxes,
    pile,
    screenMat,
    pulse,
    warn,
    particles,
    lights: { cyan, orange },
    // —— 表现状态（纯装饰，不回写内核） ——
    fx: { pulseT: 0, boxPopT: 0, energyLevel: 1, brokeLevel: 0, healthLevel: 1 },
  };
}

/** 事件 → 即时表现（main.js 从内核事件流调用；只动装饰物） */
export function roomEvent(room, ev) {
  if (ev.type === "order") {
    room.fx.boxPopT = 1;
    spawnParticles(room, new THREE.Vector3(-4.5, 1.2, -2.2), PALETTE.accentOrange, 2);
  } else if (ev.type === "payout") {
    room.fx.pulseT = 1;
    spawnParticles(room, new THREE.Vector3(2.6, 1.6, -1.6), PALETTE.settleGreen, 4);
  } else if (ev.type === "broke-on") {
    spawnParticles(room, new THREE.Vector3(2.6, 1.4, -2.6), PALETTE.brokeRed, 5);
  } else if (ev.type === "game-event") {
    // M2 事件流：奇葩事件红粒子、暖心事件绿粒子（房间中央头顶爆开）
    spawnParticles(room, new THREE.Vector3(0, 1.8, -0.5), ev.mood === "good" ? PALETTE.settleGreen : PALETTE.brokeRed, 4);
  } else if (ev.type === "stage-up" || ev.type === "upgrade") {
    // M2 升级线 / 阶段提升：橙色庆祝粒子
    spawnParticles(room, new THREE.Vector3(0, 1.8, -0.5), PALETTE.accentOrange, 6);
  }
}

function spawnParticles(room, pos, color, n) {
  let spawned = 0;
  for (const p of room.particles) {
    if (spawned >= n) break;
    if (p.life > 0) continue;
    p.life = 0.9 + Math.random() * 0.4;
    p.sp.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.3, (Math.random() - 0.5) * 0.8));
    p.sp.material.color.setHex(color);
    p.sp.material.opacity = 1;
    p.sp.visible = true;
    p.vel.set((Math.random() - 0.5) * 1.2, 1.8 + Math.random(), (Math.random() - 0.5) * 1.2);
    spawned++;
  }
}

/** 每帧同步：只读内核状态映射表现（箱堆/屏幕亮度/灯色/趴窝变暗/粒子/脉冲） */
export function syncRoom(room, world, dt) {
  const fx = room.fx;

  // 库存 → 纸箱数（10 件一箱，最多 12 箱；按当日库存平滑点亮；空仓连托盘一起收起）
  const want = Math.min(12, Math.ceil(world.inventory / 10));
  room.pile.children.at(-1).visible = want > 0; // 托盘
  room.boxes.forEach((b, i) => {
    b.visible = i < want;
    if (b.visible) {
      b.position.y = b.userData.baseY + (i === want - 1 && fx.boxPopT > 0 ? Math.sin(fx.boxPopT * Math.PI) * 0.35 : 0);
    }
  });
  if (fx.boxPopT > 0) fx.boxPopT = Math.max(0, fx.boxPopT - dt * 2.2);

  // 精力 → 笔电屏幕亮度（没电了屏幕都暗）
  const energyK = Math.max(0.15, Math.min(1, world.energy / 100));
  fx.energyLevel += (energyK - fx.energyLevel) * Math.min(1, dt * 3);
  room.screenMat.emissiveIntensity = 0.4 + fx.energyLevel * 1.4;

  // 店铺健康 → 窗边冷光颜色（绿→红：店铺越糟房间越"沉"）
  const healthK = world.shopHealth / 100;
  fx.healthLevel += (healthK - fx.healthLevel) * Math.min(1, dt * 2);
  room.lights.cyan.color.setHex(healthK > 0.5 ? PALETTE.accentCyan : PALETTE.brokeRed);
  room.lights.cyan.intensity = 10 + fx.healthLevel * 16;

  // 趴窝 → 全屋灯光压暗 + 红色警示（资金链断裂前的至暗时刻）
  const brokeK = world.broke ? 1 : 0;
  fx.brokeLevel += (brokeK - fx.brokeLevel) * Math.min(1, dt * 2.5);
  const dim = 1 - fx.brokeLevel * 0.62;
  room.lights.orange.intensity = (16 + fx.energyLevel * 6) * dim;
  room.warn.intensity = fx.brokeLevel * (2.2 + Math.sin(performance.now() * 0.004) * 0.8);

  // 回款脉冲环
  if (fx.pulseT > 0) {
    fx.pulseT = Math.max(0, fx.pulseT - dt * 1.4);
    const k = 1 - fx.pulseT;
    room.pulse.scale.setScalar(1 + k * 7);
    room.pulse.material.opacity = fx.pulseT * 0.8;
  } else {
    room.pulse.material.opacity = 0;
  }

  // 粒子
  for (const p of room.particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vel.y -= dt * 2.6;
    p.sp.position.addScaledVector(p.vel, dt);
    p.sp.material.opacity = Math.max(0, Math.min(1, p.life));
    if (p.life <= 0) p.sp.visible = false;
  }
}

export function onResize(renderer, composer, camera) {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
