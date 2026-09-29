/**
 * meta 存档 v2（实体 e-meta-save，spec v1.4 acc-b5）。
 *
 * 契约：
 *  - 键 `st.meta.save.v2`，JSON 带 schemaVersion="2" + createdAt/updatedAt；
 *  - 迁移零损：真实 v1.3 存档（st.settings.muted + st.telemetry.anonId 两键）迁移前后逐字节一致；
 *  - 迁移幂等：对已迁移存档重复执行零变化；
 *  - 安全降级：损坏 JSON 保留既有键、meta 段重建，绝不抛错阻断游戏。
 */
export const META_SAVE_KEY = 'st.meta.save.v2';
/** v1.3 既有键（迁移零损断言对象；本轮只新增 meta 段，不触碰） */
export const V13_KEYS = ['st.settings.muted', 'st.telemetry.anonId'];
/** 空白 v2 存档 */
export function emptyMetaSave(nowIso) {
    return {
        schemaVersion: '2',
        createdAt: nowIso,
        updatedAt: nowIso,
        streak: { current: 0, best: 0 },
        daily: { lastDate: null, claimedDates: [] },
    };
}
/** 读取 meta 存档：损坏/缺失 → 新建（不抛错）；带 schemaVersion 校验 */
export function loadMetaSave(storage, nowIso) {
    try {
        const raw = storage.getItem(META_SAVE_KEY);
        if (!raw)
            return emptyMetaSave(nowIso);
        const parsed = JSON.parse(raw);
        if (parsed && parsed.schemaVersion === '2' && typeof parsed.streak === 'object' && typeof parsed.daily === 'object') {
            return parsed;
        }
        return emptyMetaSave(nowIso); // 版本不符 → 重建（旧内容保留在原键，零触碰）
    }
    catch {
        return emptyMetaSave(nowIso); // 损坏 JSON → 安全降级
    }
}
/** 写回 meta 存档（更新 updatedAt；存储抛错上抛由调用方隔离） */
export function saveMetaSave(storage, save, nowIso) {
    storage.setItem(META_SAVE_KEY, JSON.stringify({ ...save, updatedAt: nowIso }));
}
/**
 * v1.3 → v2 迁移（acc-b5）：真实 fixture 非空断言在契约侧；
 * 本函数语义 = 校验既有两键在场 → 读旧 meta 段（幂等）→ 缺则建 v2 段。既有键零触碰。
 */
export function migrateV13(storage, nowIso) {
    const preservedKeys = V13_KEYS.filter((k) => storage.getItem(k) !== null);
    // 缺键不阻断（首次访问的全新设备没有 v1.3 键）——报告如实返回，meta 段照常建立
    const existing = storage.getItem(META_SAVE_KEY);
    if (existing) {
        return { created: false, preservedKeys };
    }
    storage.setItem(META_SAVE_KEY, JSON.stringify(emptyMetaSave(nowIso)));
    return { created: true, preservedKeys };
}
