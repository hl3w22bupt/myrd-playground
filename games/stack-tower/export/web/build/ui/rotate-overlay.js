/**
 * 横屏遮罩（实体 e-rotate-overlay，M2.1）— 判定纯函数 + DOM 遮罩（可注入，Node 可测）。
 * 契约（spec v3 content.mobile.rotateOverlay / acc-m4 / acc-m3）：
 *  - 判定 = 视口宽高比：isLandscapeViewport(w,h) ⇔ w/h > ROTATE_ASPECT_RATIO(=1)；
 *  - 激活即暂停：遮罩激活期间内核 tick 不推进、输入意图被忽略（main 消费 active 状态）；
 *  - 恢复竖屏自动解除；文案「请竖屏游玩」。
 */
/** 宽高比判定（纯函数）：横屏（w > h）即 true；正方形不算横屏 */
export function isLandscapeViewport(width, height, ratio = 1) {
    if (!(width > 0) || !(height > 0))
        return false;
    return width / height > ratio;
}
/** 遮罩控制器：DOM 可注入（测试传 null 也能跑通状态机） */
export function createRotateOverlay(ratio = 1) {
    let active = false;
    let host = null;
    let el = null;
    const handlers = new Set();
    function setActive(next) {
        if (next === active)
            return active;
        active = next;
        if (el)
            el.style.display = active ? 'flex' : 'none';
        for (const h of handlers)
            h(active);
        return active;
    }
    return {
        setViewport(width, height) {
            return setActive(isLandscapeViewport(width, height, ratio));
        },
        isActive: () => active,
        onChange(handler) {
            handlers.add(handler);
            return () => handlers.delete(handler);
        },
        mount(target) {
            host = target;
            if (!host)
                return;
            if (!el) {
                el = document.createElement('div');
                el.id = 'st-rotate-overlay';
                el.textContent = '请竖屏游玩';
                el.className = 'st-rotate-overlay';
                el.style.display = 'none';
            }
            host.appendChild(el);
        },
        dispose() {
            handlers.clear();
            el?.remove();
            el = null;
        },
    };
}
