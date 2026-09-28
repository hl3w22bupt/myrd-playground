/**
 * BGM 环调度器（B0 微信小游戏移植轮 · spec v1.3 content.platform wx-runtime 条目）。
 *
 * 纪律：
 *  - 平台无关：只依赖注入面（LoopSink / 时钟 / 静音源），wx 装配体提供 InnerAudioContext 环，
 *    web（browser.ts）不接线 → web 行为零变化（v1.2 契约面不动）；
 *  - 调度连续性：提前 LOOKAHEAD_MS 预约下一圈，圈间缝隙超 GAP_BUDGET_MS 即记违例（可断言）；
 *  - onShow/onHide：resume()/pause() 幂等；静音态零输出（sink 静音占位，不解绑环）；
 *  - 首触解锁：unlock() 前的 start() 请求入队，unlock() 后补启（acc-a7 同口径：不吞不延首次出声）。
 *  - Node 可测：全部依赖注入，零 wx/DOM（bgm-loop-wx 冒烟断言点）。
 */
/** 预约提前量：距圈尾 LOOKAHEAD_MS 时预约下一圈（wx 侧即重置 InnerAudioContext 播放头） */
export const LOOKAHEAD_MS = 120;
/** 圈间缝隙预算：超过即违例（调度连续性判据） */
export const GAP_BUDGET_MS = 40;
/** 圈长：BGM 素材名义时长（wx 侧与素材 manifest 一致；测试泵用它推进） */
export const LOOP_MS = 9600;
export function createBgmLoop(deps) {
    const muted = () => (deps.mutedProvider ? deps.mutedProvider() : false);
    let startRequested = false;
    let playing = false;
    let paused = false;
    let unlocked = false;
    let loopEndsAt = 0;
    let nextBooked = false;
    let loopsScheduled = 0;
    let lastGapMs = 0;
    let gapViolations = 0;
    let lastMuted = false;
    const beginLoop = () => {
        deps.sink.start();
        playing = true;
        loopsScheduled += 1;
        loopEndsAt = deps.now() + LOOP_MS;
        nextBooked = false;
    };
    return {
        start() {
            startRequested = true;
            if (unlocked && !paused)
                beginLoop();
        },
        stop() {
            startRequested = false;
            playing = false;
            deps.sink.stop();
        },
        pause() {
            if (!playing)
                return;
            paused = true;
            deps.sink.stop();
        },
        resume() {
            if (!paused || !startRequested)
                return;
            paused = false;
            beginLoop();
        },
        syncMuted() {
            const m = muted();
            if (m !== lastMuted && playing)
                beginLoop(); // 静音切换重启槽（静音槽/发声槽互换）
            lastMuted = m;
        },
        unlock() {
            if (unlocked)
                return;
            unlocked = true;
            if (startRequested && !paused && !playing)
                beginLoop(); // 补启：不吞不延首次出声
        },
        tick(nowMs) {
            if (!playing || paused)
                return;
            this.syncMuted();
            const remain = loopEndsAt - nowMs;
            if (!nextBooked && remain <= LOOKAHEAD_MS) {
                nextBooked = true;
                loopsScheduled += 1;
            }
            if (nowMs >= loopEndsAt) {
                lastGapMs = Math.max(0, nowMs - loopEndsAt);
                if (lastGapMs > GAP_BUDGET_MS)
                    gapViolations += 1;
                loopEndsAt = nowMs + LOOP_MS;
                nextBooked = false;
            }
        },
        stats() {
            return {
                started: startRequested,
                paused,
                muted: muted(),
                unlocked,
                loopsScheduled,
                lastGapMs,
                gapViolations,
            };
        },
    };
}
