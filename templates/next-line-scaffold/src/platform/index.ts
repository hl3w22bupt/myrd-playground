// platform/index.ts — 平台门面（新线脚手架空壳 · 预置件①）
//
// 纪律（判例承自 g2-blocks/stack-tower）：
//   内核零平台感知：kernel/ 只 import 本文件的 Platform 接口，禁止直呼 wx/dy/window；
//   宿主差异全部收拢在 <host>.ts 实现里；能力缺失 = 显式降级（返回 kind 标识），禁静默假装成功。
export interface Storage {
  kind: 'web' | 'host' | 'noop';
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface Platform {
  readonly name: string;
  storage: Storage;
  /** 会话埋点统一出口（sink 路由由宿主实现决定；缺省 = 内存缓冲） */
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
