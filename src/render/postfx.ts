/**
 * render/postfx —— 轻量单 pass 后处理（AC2 画面质感叠加，60FPS 红线内）。
 *
 * 设计约束（性能）：
 * - 只有一次额外全屏 pass：场景渲到复用的 WebGLRenderTarget（构造时创建一次，resize 才
 *   setSize —— 即「渲染目标对象池」：运行期零创建/零销毁），再用单个正交全屏 quad 合成回屏。
 * - 合成 shader 把 轻量 AA（十字 luma 混合）+ 暗角 + 饱和度/对比度分级 合并为一个 pass，
 *   不引入 bloom 等多 pass 重效果，medium 档以 0.75x RT 降采样进一步压成本。
 * - 门控由 QualityPreset 决定（low 关闭 → 直接 renderer.render，零额外成本）。
 * - 逐帧零分配：uniform 对象恒定，Vector2 复用。
 */

import * as THREE from 'three';
import {
  POSTFX_CONTRAST,
  POSTFX_SATURATION,
  POSTFX_VIGNETTE,
} from '../content/render';

/** 按 preset 计算后处理 RT 分辨率（纯函数：Node 可断言） */
export function postFxResolution(
  enabled: boolean,
  scale: number,
  width: number,
  height: number,
): { width: number; height: number } {
  if (!enabled) return { width: 0, height: 0 };
  return {
    width: Math.max(2, Math.floor(width * scale)),
    height: Math.max(2, Math.floor(height * scale)),
  };
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uTexel;      // 1/RT 分辨率
  uniform float uVignette;  // 暗角强度 0..1
  uniform float uSaturation;
  uniform float uContrast;
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  void main() {
    vec3 center = texture2D(tDiffuse, vUv).rgb;

    // —— 轻量 AA：中心 + 十字 4 邻域按 luma 差异加权混合（抑制高对比锯齿边，成本 4 tap）——
    vec3 l = texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)).rgb;
    vec3 r = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb;
    vec3 t = texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)).rgb;
    vec3 b = texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb;
    float lc = luma(center);
    float ld = luma(l) + luma(r) + luma(t) + luma(b);
    float edge = clamp(abs(lc * 4.0 - ld) / max(lc + ld, 0.01), 0.0, 1.0);
    vec3 color = mix(center, (center + l + r + t + b) * 0.2, edge * 0.75);

    // —— 色彩分级：饱和度 + 对比度（明暗层次，画面更通透）——
    color = mix(vec3(luma(color)), color, uSaturation);
    color = clamp((color - 0.5) * uContrast + 0.5, 0.0, 1.0);

    // —— 暗角：以画面中心为原点的径向压暗（聚焦视线，边缘自然收束）——
    vec2 d = vUv - 0.5;
    float vig = 1.0 - uVignette * smoothstep(0.35, 0.95, dot(d, d) * 2.4);
    color *= vig;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class PostFxPass {
  /** false = 直通（renderer.render 原路径，零额外成本） */
  readonly enabled: boolean;
  private rt: THREE.WebGLRenderTarget | null = null;
  private quadScene: THREE.Scene;
  private quadCam: THREE.OrthographicCamera;
  private material: THREE.ShaderMaterial;
  private fsQuad: THREE.Mesh;

  constructor(
    enabled: boolean,
    msaa: number,
    scale: number,
    width: number,
    height: number,
    pixelRatio: number,
  ) {
    this.enabled = enabled;
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    if (!enabled) {
      this.material = null as unknown as THREE.ShaderMaterial;
      this.fsQuad = null as unknown as THREE.Mesh;
      return;
    }

    const res = postFxResolution(true, scale, width * pixelRatio, height * pixelRatio);
    this.rt = new THREE.WebGLRenderTarget(res.width, res.height, {
      type: THREE.HalfFloatType,
      samples: msaa,
      depthBuffer: true,
    });

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: this.rt.texture },
        uTexel: { value: new THREE.Vector2(1 / res.width, 1 / res.height) },
        uVignette: { value: POSTFX_VIGNETTE },
        uSaturation: { value: POSTFX_SATURATION },
        uContrast: { value: POSTFX_CONTRAST },
      },
    });
    this.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.fsQuad.frustumCulled = false;
    this.quadScene.add(this.fsQuad);
  }

  /** 主渲染入口：启用时 场景→RT→合成回屏；关闭时直通 */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.enabled || !this.rt) {
      renderer.render(scene, camera);
      return;
    }
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(prevTarget);
    renderer.render(this.quadScene, this.quadCam);
  }

  /** 视口尺寸/像素比变化时调用：仅 setSize（复用同一 RT 对象，不重建） */
  setSize(width: number, height: number, pixelRatio: number): void {
    if (!this.enabled || !this.rt) return;
    this.rt.setSize(Math.max(2, Math.floor(width * pixelRatio)), Math.max(2, Math.floor(height * pixelRatio)));
    const uTexel = this.material.uniforms.uTexel.value as THREE.Vector2;
    uTexel.set(1 / this.rt.width, 1 / this.rt.height);
  }

  dispose(): void {
    if (!this.rt) return;
    this.fsQuad.geometry.dispose();
    this.material.dispose();
    this.rt.dispose();
    this.rt = null;
  }
}
