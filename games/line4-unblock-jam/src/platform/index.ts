// platform/index.ts — 平台门面（line4-unblock-jam · 模板平移）
//
// 纪律：内核零平台感知——kernel/ 只 import 本文件的 Platform 接口，禁直呼 wx/dy/window；
// 宿主差异收拢在 <host>.ts；能力缺失 = 显式降级（返回 kind 标识），禁静默假装成功。
export interface Storage {
  kind: 'web' | 'host' | 'noop';
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface Platform {
  readonly name: string;
  storage: Storage;
  /** 埋点统一出口（sink 路由由宿主实现决定；缺省 = 内存缓冲）——旁路打点禁止（acc-07） */
  track(eventId: string, payload: Record<string, unknown>): void;
}

export const NOOP_STORAGE: Storage = {
  kind: 'noop',
  get: () => null,
  set: () => {},
};

export function createNoopPlatform(): Platform {
  const buffered: Array<{ eventId: string; payload: Record<string, unknown> }> = [];
  return {
    name: 'noop',
    storage: NOOP_STORAGE,
    track: (eventId, payload) => { buffered.push({ eventId, payload }); },
  };
}
