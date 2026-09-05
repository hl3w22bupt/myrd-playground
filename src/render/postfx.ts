/**
 * render/postfx —— Bloom 光照后处理链（画面升级步：阴影 / 雾效之上的第三层光照表现）。
 *
 * 链路：RenderPass → UnrealBloomPass（亮度提取 + 5 级 mip 高斯模糊 + 叠加）→ OutputPass
 * （色调映射 ACES + sRGB 输出转换统一收敛到 OutputPass，three 官方推荐后处理收尾）。
 *
 * 性能约束（稳定 60FPS 红线）：
 * - 后处理整链可开关，按画质档位决定（content/render BLOOM_BY_QUALITY：low 关闭）；
 * - composer 惰性创建：关闭档完全不产生 render target / pass 开销，直通 renderer.render；
 * - 开关幂等（重复 setEnabled 不重复分配），resize 复用同一组 render target。
 *
 * 可测性：EffectComposer 只用 renderer 的少数几个方法，这里收敛为结构化最小接口
 * PostFxRenderer —— 真实 WebGLRenderer 天然满足；Node 测试注入 stub 即可断言链路结构
 * 与「开/关两条渲染路径」，无需 GL 上下文。
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { BloomParams } from './quality';

/** EffectComposer/Pass 链用到的 renderer 方法与属性最小集合（真实 WebGLRenderer 满足） */
export interface PostFxRenderer {
  getSize(target: THREE.Vector2): THREE.Vector2;
  getPixelRatio(): number;
  getRenderTarget(): THREE.WebGLRenderTarget | null;
  setRenderTarget(target: THREE.WebGLRenderTarget | null): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  clear(): void;
  getClearColor(target: THREE.Color): THREE.Color;
  getClearAlpha(): number;
  setClearColor(color: THREE.ColorRepresentation, alpha?: number): void;
  autoClear: boolean;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  /** @types/three 中该属性为 string（getter/setter 对），与 ColorSpace 字面量兼容 */
  outputColorSpace: string;
}

export class BloomPostFx {
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private on: boolean;
  private params: BloomParams;
  private width = 1;
  private height = 1;

  constructor(
    private readonly renderer: PostFxRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    params: BloomParams,
  ) {
    this.params = params;
    this.on = params.enabled;
    if (this.on) this.build();
  }

  /** 是否处于后处理路径 */
  get enabled(): boolean {
    return this.on;
  }

  /** 当前链路 pass 数（关闭 = 0；开启 = RenderPass + Bloom + Output = 3） */
  get passCount(): number {
    return this.composer ? this.composer.passes.length : 0;
  }

  /** 开/关后处理（幂等：同值调用零开销） */
  setEnabled(on: boolean): void {
    if (this.on === on) return;
    this.on = on;
    if (on) {
      this.build();
    } else {
      this.teardown();
    }
  }

  /** 更新档位参数（enabled 变化时联动开/关；数值变化只写 pass uniform） */
  setParams(params: BloomParams): void {
    this.params = params;
    this.setEnabled(params.enabled);
    if (this.bloomPass) {
      this.bloomPass.strength = params.strength;
      this.bloomPass.radius = params.radius;
      this.bloomPass.threshold = params.threshold;
    }
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    if (this.composer) this.composer.setSize(this.width, this.height);
  }

  /** 每帧输出：开启走 composer（后处理路径），关闭直通 renderer.render */
  render(dtSec: number): void {
    if (this.composer) {
      this.composer.render(dtSec);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose(): void {
    this.teardown();
  }

  /** 惰性构建后处理链（只在首次启用时分配 render target / 材质） */
  private build(): void {
    if (this.composer) return;
    // EffectComposer 的 TS 形参声明为 WebGLRenderer；其运行期只依赖 PostFxRenderer 列出的成员
    const composer = new EffectComposer(this.renderer as unknown as THREE.WebGLRenderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      this.params.strength,
      this.params.radius,
      this.params.threshold,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    this.bloomPass = bloom;
    this.composer = composer;
    this.setSize(this.width, this.height);
  }

  /** 释放整链（回到直通路径），可再次 build 复用 */
  private teardown(): void {
    if (!this.composer) return;
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
    this.composer = null;
    this.bloomPass = null;
    this.on = false;
  }
}
