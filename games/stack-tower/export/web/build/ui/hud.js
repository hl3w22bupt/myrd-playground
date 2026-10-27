const STATUS_TEXT = {
    ready: '准备',
    running: '进行中',
    'level-clear': '过关 · 点击进入下一关',
    'game-over': '结束 · 点击重开',
};
/** 纯函数：内核快照 → HUD 视图模型（表现与状态一一对应，逐 tick 可断言） */
export function formatHud(snap) {
    return {
        score: snap.score,
        combo: snap.combo,
        level: snap.level,
        progress: `${snap.layers}/${snap.target}`,
        status: STATUS_TEXT[snap.status],
    };
}
const NOOP_HUD = {
    update: () => { },
    onRestart: () => { },
    onToggleMute: () => { },
    setMutedVisual: () => { },
    applyRestartSkin: () => { },
};
/** 挂载 DOM HUD；root 缺失时退化为无操作（headless 安全） */
export function mountHud(root) {
    if (!root) {
        return NOOP_HUD;
    }
    const scoreEl = spawnLine(root, 'score');
    const comboEl = spawnLine(root, 'combo');
    const levelEl = spawnLine(root, 'level');
    const statusEl = spawnLine(root, 'status');
    const actions = document.createElement('div');
    actions.className = 'st-hud-actions';
    root.appendChild(actions);
    const restartBtn = document.createElement('button');
    restartBtn.textContent = '重开（R）';
    restartBtn.className = 'st-hud-restart';
    actions.appendChild(restartBtn);
    const muteBtn = document.createElement('button');
    muteBtn.textContent = '🔊 声音';
    muteBtn.className = 'st-hud-mute';
    muteBtn.setAttribute('aria-label', '切换静音');
    actions.appendChild(muteBtn);
    let restartHandler = null;
    let muteHandler = null;
    restartBtn.addEventListener('click', () => restartHandler?.());
    muteBtn.addEventListener('click', () => muteHandler?.());
    return {
        update(snap) {
            const view = formatHud(snap);
            scoreEl.textContent = `分数 ${view.score}`;
            comboEl.textContent = view.combo > 0 ? `连击 ×${view.combo}` : '连击 —';
            levelEl.textContent = `关卡进度 ${view.progress}`;
            statusEl.textContent = view.status;
        },
        onRestart(handler) {
            restartHandler = handler;
        },
        onToggleMute(handler) {
            muteHandler = handler;
        },
        setMutedVisual(muted) {
            muteBtn.textContent = muted ? '🔇 静音' : '🔊 声音';
        },
        applyRestartSkin(src) {
            restartBtn.style.backgroundImage = `url("${src}")`;
            restartBtn.style.backgroundSize = '100% 100%';
            restartBtn.style.backgroundRepeat = 'no-repeat';
        },
    };
}
function spawnLine(root, kind) {
    const el = document.createElement('div');
    el.className = `st-hud-line st-hud-${kind}`;
    root.appendChild(el);
    return el;
}
