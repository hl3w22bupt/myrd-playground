export const INTENT_DEBOUNCE_MS = 300;
export function installMobileInputGuards(doc) {
    const prevent = (ev) => ev.preventDefault();
    doc.addEventListener('contextmenu', prevent); // 长按菜单
    doc.addEventListener('gesturestart', prevent); // iOS 双指缩放
    doc.addEventListener('gesturechange', prevent);
    doc.addEventListener('dblclick', prevent); // 桌面双击选中兜底
    return () => {
        const targets = doc;
        targets.removeEventListener?.('contextmenu', prevent);
        targets.removeEventListener?.('gesturestart', prevent);
        targets.removeEventListener?.('gesturechange', prevent);
        targets.removeEventListener?.('dblclick', prevent);
    };
}
/** DOM 输入源：pointerdown（触摸归一）+ 空格；300ms 去抖；R 键不算落块意图（归重开） */
export function createDomInput(target) {
    const handlers = new Set();
    let lastFire = -Infinity;
    const fire = () => {
        const now = performance.now();
        if (now - lastFire < INTENT_DEBOUNCE_MS)
            return; // 去抖：连点不做连落
        lastFire = now;
        for (const h of handlers)
            h({ type: 'drop' });
    };
    const opts = { passive: false };
    target.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fire();
    }, opts); // pointerdown 已归一点击/触摸/笔，多点触控不再各派一次
    window.addEventListener('keydown', (e) => {
        const isSpace = e.code === 'Space' || e.key === ' ';
        if (!isSpace)
            return; // r/R 归重开入口（app/main），不作为落块意图
        e.preventDefault();
        fire();
    });
    return {
        onIntent(handler) {
            handlers.add(handler);
            return () => handlers.delete(handler);
        },
    };
}
