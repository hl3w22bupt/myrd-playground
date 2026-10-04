/**
 * tower-ripple 事件发射器（实体 e-ripple-emitter）— T1 必改②唯一落点。
 * 契约（spec.content.towerRipple / world.architecture_rules）：
 *  - perfect 判定成立的同一 tick 上抛，先于渲染帧消费；
 *  - 载荷恰四业务字段 {level_id, element_id, window_ms, duration_ms}（type 为判别字段）；
 *  - window_ms = 本关实际判定窗口；duration_ms 名义 300、容差 ±50（合法区间 [250,350]）；
 *  - 禁止携带 screen-flash / 整屏 aha 语义（契约 e06 第 4 条断言拒绝）。
 */
import { RIPPLE_DURATION, perfectWindowMs } from './numeric.js';
import { levelId } from './difficulty.js';
/** 波纹对应 spec 元素编号（冻结，不得改名；改名 = spec 升版） */
export const RIPPLE_ELEMENT_ID = 'e06-tower-ripple';
/** 构造契约级事件：多一个字段、少一个字段都不合格 */
export function emitTowerRipple(level) {
    return {
        type: 'tower-ripple',
        level_id: levelId(level),
        element_id: RIPPLE_ELEMENT_ID,
        window_ms: perfectWindowMs(level),
        duration_ms: RIPPLE_DURATION.NOMINAL_MS,
    };
}
