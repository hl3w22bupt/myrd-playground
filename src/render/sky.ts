/**
 * render/sky —— 天空穹顶 + 太阳光晕 + 云层（AC2②：方向光 + 雾效的远景层次）。
 * 全部为静态几何/贴图：云漂移用极低频位移，无逐帧重建，60FPS 红线零压力。
 */

import * as THREE from 'three';
import type { VisualDetailPreset } from '../content/render';
import { makeCloudTexture, makeGlowTexture, makeSkyTexture } from './textures';

const DOME_RADIUS = 2400;
const CLOUD_COUNT = 14;

export class SkyDome {
  readonly group: THREE.Group;
  private clouds: THREE.Sprite[] = [];
  private elapsed = 0;

  constructor(scene: THREE.Scene, detail: VisualDetailPreset) {
    this.group = new THREE.Group();

    // —— 渐变穹顶（BackSide，跟随相机，不参与雾/光照）；低档省 draw call 不创建 ——
    if (detail.skyDome) this.addDome();
    if (detail.sunGlow) this.addSunGlow();
    if (detail.clouds) this.addClouds();
    scene.add(this.group);
  }

  private addDome(): void {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(DOME_RADIUS, 24, 14),
      new THREE.MeshBasicMaterial({
        map: makeSkyTexture(),
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      }),
    );
    dome.renderOrder = -10;
    this.group.add(dome);
  }

  private addSunGlow(): void {
    const sunDir = new THREE.Vector3(160, 260, 110).normalize();
    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: 0xfff3d0,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        fog: false,
        depthWrite: false,
      }),
    );
    sun.position.copy(sunDir.multiplyScalar(DOME_RADIUS * 0.92));
    sun.scale.setScalar(DOME_RADIUS * 0.28);
    this.group.add(sun);
  }

  /** 云层：半透明 sprite，缓漂移（仅 medium/high） */
  private addClouds(): void {
    const cloudTex = makeCloudTexture();
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: cloudTex,
          transparent: true,
          opacity: 0.5 + Math.random() * 0.25,
          fog: false,
          depthWrite: false,
        }),
      );
      const angle = (i / CLOUD_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const dist = DOME_RADIUS * (0.45 + Math.random() * 0.35);
      sprite.position.set(Math.cos(angle) * dist, 420 + Math.random() * 520, Math.sin(angle) * dist);
      const w = 340 + Math.random() * 420;
      sprite.scale.set(w, w * (0.32 + Math.random() * 0.14), 1);
      this.clouds.push(sprite);
      this.group.add(sprite);
    }
  }

  /**
   * 档位联动开关：降档时整组隐藏（0 draw call）。
   * 本地帧率基准表明：软光栅/低端设备上每 draw 固定开销显著，
   * 仅降像素比对帧率几乎无效，必须同时减少 draw 数。
   */
  setDetailVisible(on: boolean): void {
    this.group.visible = on && this.group.children.length > 0;
  }

  /** 每帧：穹顶与云跟随相机水平位置（天空无穷远），云极低频漂移 */
  update(cameraPos: THREE.Vector3, dtSec: number): void {
    if (!this.group.visible) return;
    this.group.position.set(cameraPos.x, 0, cameraPos.z);
    this.elapsed += dtSec;
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.position.x += (4 + (i % 4)) * dtSec;
      if (c.position.x - this.group.position.x > DOME_RADIUS * 0.9) {
        c.position.x = this.group.position.x - DOME_RADIUS * 0.9;
      }
    }
    void this.elapsed;
  }

  dispose(): void {
    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as unknown as { material?: THREE.Material }).material;
      if (mat) mat.dispose();
    });
    this.group.removeFromParent();
  }
}
