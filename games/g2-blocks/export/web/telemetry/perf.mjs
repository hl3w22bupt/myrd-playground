// telemetry/perf.ts — J1 perf 埋点（e-telemetry · ac-10）
//
// spec 口径（numeric.perf.j1 冻结块，标记名逐字）：
//   startMark = j1_settle_start（一次消除落定结算开始）
//   doneMark  = j1_feedback_done（该次反馈完成）
//   budget    = numeric.perf.j1.budgetMs（@ CPU throttle × cpuThrottleX + viewportPx）
// 双端统一标记名；performance.mark + performance.measure。
import { numeric } from '../generated/spec-data.mjs';

export const J1_START_MARK         = numeric().perf.j1.startMark;
export const J1_DONE_MARK         = numeric().perf.j1.doneMark;

                       
                      
                       
                            
 

/** 浏览器实现：performance.mark/measure（SecureContext 下可用） */
export function createPerf(now               = ()         =>
  (typeof performance !== 'undefined' ? performance.now() : 0))       {
  let startAt                = null;
  let lastJ1                = null;
  const mark = (name        )       => {
    try {
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') performance.mark(name);
    } catch { /* 无 perf API 环境降级为墙钟 */ }
  };
  return {
    settleStart()       {
      startAt = now();
      mark(J1_START_MARK);
    },
    feedbackDone()       {
      if (startAt !== null) {
        lastJ1 = now() - startAt;
        startAt = null;
      }
      mark(J1_DONE_MARK);
      try {
        if (typeof performance !== 'undefined' && typeof performance.measure === 'function'
          && typeof performance.getEntriesByName === 'function') {
          const a = performance.getEntriesByName(J1_START_MARK);
          const d = performance.getEntriesByName(J1_DONE_MARK);
          if (a.length && d.length) performance.measure('j1', a[a.length - 1].startTime, d[d.length - 1].startTime);
        }
      } catch { /* measure 失败不影响玩法 */ }
    },
    lastJ1Ms()                {
      return lastJ1;
    },
  };
}


//# sourceURL=telemetry/perf.ts