/**
 * 摆动块（实体 e-block-moving）— 当前待落块：线性往返，零随机游走（保确定性）。
 * 行程：以塔顶块中心为轴，±SWING_TRAVEL_PX；到达边界立即反向（无停顿）。
 * 方向初值取自 seeded RNG（实体 e-kernel-rng）；速度取自 swingSpeed(level)。
 */
import { NUMERIC } from './numeric.js';
import { swingSpeed } from './difficulty.js';
/** 生成新摆动块：宽度继承顶部已落块；自中轴（塔顶 x）入画；初始方向由 RNG 决定。
 *  入画相位取中轴（offset=0）：保证开局第 1 次输入即存在可命中窗口（T1 必改①，QNC-02 无开局死局）。 */
export function spawnMoving(rng, level, centerX, width) {
    const dir = rng.next() < 0.5 ? -1 : 1;
    return {
        x: centerX,
        width,
        dir,
        speed: swingSpeed(level),
    };
}
/** 推进一个 fixed step：x += dir×speed×dt；越界即钳制并反向（解析解可对照） */
export function advanceMoving(m, centerX, dtMs) {
    const travel = NUMERIC.cut_width.SWING_TRAVEL_PX;
    m.x += m.dir * (m.speed * dtMs) / 1000;
    if (m.x >= centerX + travel) {
        m.x = centerX + travel;
        m.dir = -1;
    }
    else if (m.x <= centerX - travel) {
        m.x = centerX - travel;
        m.dir = 1;
    }
}
