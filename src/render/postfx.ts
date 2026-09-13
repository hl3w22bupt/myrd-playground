/**
 * render/postfx —— 后处理合成器（Bloom 泛光 + 色调映射输出）。
 * 仅可被 render/ 使用（three 引擎边界；three/examples 同属 three 包，lint 校验通过）。
 *
 * 管线：RenderPass(scene) → UnrealBloomPass → OutputPass(色调映射 + sRGB)。
 * three 仅在绘制到默认 framebuffer 时应用 toneMapping/outputColorSpace，
 * 因此中间 RenderPass 进 HalfFloat 目标保持线性，交由 OutputPass 收口 —— 避免泛光提亮被压暗。
 *
 * 档位联动：quality 低档 bloom=false → enabled=false，调用方走 renderer.render 直渲（省合成开销）；
 * 中/高档 bloom=true → 走 composer.render()。构造失败（如无 WebGL2/低端机型）调用方可整体置 null 直渲降级。
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { QualityPreset } from './quality';

export class PostFX {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private renderPass: RenderPass;
  private outputPass: OutputPass;

  /** 是否经合成器渲染（bloom 开）；false 时调用方应直渲 renderer.render */
  enabled = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
  ) {
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.5, 0.45, 0.8);
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  /** 依据画质档位设置 Bloom 参数与合成器开关 */
  configure(preset: QualityPreset): void {
    this.bloomPass.enabled = preset.bloom;
    this.bloomPass.strength = preset.bloomStrength;
    this.bloomPass.radius = preset.bloomRadius;
    this.bloomPass.threshold = preset.bloomThreshold;
    this.enabled = preset.bloom;
  }

  /** 渲染一帧（需 enabled 时调用） */
  render(): void {
    this.composer.render();
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
