// boot-dy.ts — 抖音小游戏装配入口（DY 平台段轮 N2）
//
// 顺序敏感：先装垫片（adapter），再动态 import main.ts（main 顶层即取 document.getElementById('stage')）。
// 纪律：
//   ① 本件零内核 import；核心逻辑零改动（main.ts 原样装载）；
//   ② 生命周期接线仅表现层：onShow 首触解锁音频（容器规范），onHide 无操作（rAF 由容器自动挂起）；
//   ③ 分享环接线仅被动通道（右上角菜单/转发同卡同参，ds-acc-4）：纯跳转零数值回调，失败静默不阻塞装载；
//   ④ 无 tt 容器 = 立即显式失败（本入口只在 tt 容器内被 game.js 调用；不静默装绿）；
//   ⑤ 贴图路径纪律（ac-13）：包内分享卡路径字面量单源在 tools/build-dy.mjs，经其生成的 game.js
//      模板注入（shareImageUrl）——本件与 share.ts 零图片扩展名字面量；注入缺失时被动通道不注册
//      （右上角转发回退宿主默认截图，降级不破坏运行）；
//   ⑥ dy-diff-08 fallback：tt 侧无同构隐私弹窗 API → 本入口**零**弹窗运行时装配
//      （合规走文案位双口径，见 dy-submission-kit dk-acc-4；错抄 wx 弹窗 = 缺陷，tests/dy 反向断言）。
import { getTt } from './dy-env.mjs';
import { installDyAdapter } from './adapter.mjs';
import { createDyRuntime } from './runtime.mjs';
import { wireSharePassive } from './share.mjs';

/** 组包器注入面（game.js 模板单调用点）：仅渠道素材路径，零玩法/数值语义 */
                                
                                                                          
                         
 

export function bootDy(opts                = {})       {
  const tt = getTt();
  if (!tt) {
    // 显式失败：boot-dy 只应被 tt 容器入口调用；走到这里说明容器判定失败
    throw new Error('[g2-blocks] tt 容器判定失败：boot-dy 仅用于抖音小游戏容器（Node 侧测试请走 tests/dy/）');
  }

  installDyAdapter(tt);

  const runtime = createDyRuntime({ tt });
  runtime.attachLifecycle({
    onShow: () => { try { runtime.audio.unlock(); } catch { /* 首触解锁失败不阻塞 */ } },
    onHide: () => { /* rAF 由容器自动挂起；零内核触碰 */ },
  });

  // 分享环接线（spec dy-share-kit ds-acc-1/4 · 素材接线）：包内 720×1280 竖版卡经被动通道生效；
  // 载荷 sid 走 runtime 注入时钟（零 PII）；注册失败静默（share.ts 内降级），不阻塞 main 装载。
  if (opts.shareImageUrl) wireSharePassive(tt, runtime.clock, opts.shareImageUrl);

  void import('../../main.ts');
}


//# sourceURL=platform/dy/boot-dy.ts