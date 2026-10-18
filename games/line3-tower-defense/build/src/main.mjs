const __L3_BUILD__ = { gitSha: "a2c3046cfc3fb6df853f586f64a15be50202d146", specAnchor: "cmvbqgzbl0029m9ax64foxd37@v2:approved" };
// main — 启动入口（AppHost web 面可玩装配）：canvas 全屏等比 + fixed-step 主循环 + 指针接线
// 构建注入 __L3_BUILD__（gitSha/specAnchor）→ LIVE 三点对账锚（wheat-squad __G2WS_BUILD 判例同构）
// 渲染零裸 hex：底色亦走 PALETTE token（ac-art-1/ac-art-3 单源口径）。

import { configFromSpec, MIRRORED } from "./kernel/config.mjs";
import { Game } from "./game.mjs";
import { fitView, toLogical } from "./scene/battlefield.mjs";
import { render,                           } from "./render/renderer.mjs";
import { PALETTE } from "./render/theme.mjs";

                                                                   

const canvas = document.getElementById("stage")                     ;
const ctx = canvas.getContext("2d")                    ;
if (!ctx) throw new Error("canvas 2d 上下文不可用（黑屏保护：显式失败）");

// 运行配置单源：包内 build/spec.json（approved 导出件直拷）优先，缺失/装载失败回退 MIRRORED
// （镜像断言由契约核对，两条装配路径数值等价；回退时控制台留痕不静默）。
async function boot()                {
  let cfgSource          = MIRRORED;
  try {
    const promised = (globalThis                           ).__L3_SPEC__;
    if (promised && typeof (promised                    ).then === "function") {
      cfgSource = await promised;
    }
  } catch (err) {
    console.warn("[line3] spec.json 装载失败，回退 MIRRORED 镜像:", String(err));
  }
  const cfg = configFromSpec(cfgSource);
  const game = new Game({ cfg });
  (globalThis                           ).__L3_GAME = game;

  function resize()       {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  globalThis.addEventListener("resize", resize);
  resize();

  let last = performance.now();
  let acc = 0;

  function frame(now        )       {
    const dt = Math.min(now - last, 100);
    last = now;
    game.advanceTitle(dt); // 题屏推进；running 面为 no-op
    acc += dt;
    if (game.phase !== "title") {
      game.stepFrame(acc);
      acc = 0;
    }
    const view       = fitView(canvas.width, canvas.height);
    ctx .fillStyle = PALETTE.bgDeep;
    ctx .fillRect(0, 0, canvas.width, canvas.height);
    render(ctx , view, game.phase === "title" ? null : game.sim, game.ui, game.phase, cfg);
    globalThis.requestAnimationFrame(frame);
  }

  function pointer(e              )       {
    const rect = canvas.getBoundingClientRect();
    const dprX = canvas.width / rect.width, dprY = canvas.height / rect.height;
    const v = fitView(canvas.width, canvas.height);
    const p = toLogical((e.clientX - rect.left) * dprX, (e.clientY - rect.top) * dprY, v);
    game.pointerDown(p.x, p.y);
  }
  canvas.addEventListener("pointerdown", pointer);

  globalThis.requestAnimationFrame(frame);
  (globalThis                           ).__L3_READY = true;
  (globalThis                           ).__L3_BUILD__ = { gitSha: __L3_BUILD__.gitSha, specAnchor: __L3_BUILD__.specAnchor };
}

void boot();
